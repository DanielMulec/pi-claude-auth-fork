import { mkdirSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"
import { lockSync } from "proper-lockfile"
import { log } from "./logger.ts"
import { recordAuthEvent } from "./auth-audit.ts"

/**
 * Native 2.1.303 m4n/$Ws uses these same proper-lockfile options. Only hold
 * this around the bounded 15s OAuth request and persistence, NEVER around
 * `claude -p`: the CLI must acquire this lock itself. The native 60s stale
 * threshold permits recovery after a killed process without stealing a live
 * lock. Synchronous work must stay below that threshold (no CLI fallback).
 */
export function withClaudeRefreshLock<T>(operation: () => T): T | null {
    const secureDir = process.env.CLAUDE_SECURESTORAGE_CONFIG_DIR
    const dir = (
        secureDir !== undefined
            ? secureDir || join(homedir(), ".claude")
            : process.env.CLAUDE_CONFIG_DIR || join(homedir(), ".claude")
    ).normalize("NFC")
    mkdirSync(dir, { recursive: true, mode: 0o700 })
    const started = Date.now()
    let release: () => void
    while (true) {
        try {
            release = lockSync(dir, {
                lockfilePath: join(dir, ".oauth_refresh.lock"),
                realpath: false,
                stale: 60_000,
                update: 5_000,
            })
            break
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== "ELOCKED") throw error
            // Pi may already hold its 30s auth.json lock. Leave room for
            // the 15s HTTP timeout plus bounded Keychain read/write calls.
            if (Date.now() - started >= 5_000) {
                recordAuthEvent("lock_timeout")
                log("refresh_lock_timeout", {
                    pid: process.pid,
                    waitedMs: Date.now() - started,
                })
                return null
            }
            Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 25)
        }
    }
    log("refresh_lock_acquired", {
        pid: process.pid,
        waitedMs: Date.now() - started,
    })
    try {
        return operation()
    } finally {
        try {
            release()
        } catch {
            recordAuthEvent("lock_release_failed")
        }
        log("refresh_lock_released", { pid: process.pid })
    }
}
