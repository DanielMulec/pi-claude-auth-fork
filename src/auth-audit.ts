import { createHash } from "node:crypto"
import {
    appendFileSync,
    mkdirSync,
    readdirSync,
    rmSync,
    statSync,
} from "node:fs"
import { join } from "node:path"
import type { ClaudeCredentials } from "./keychain.ts"
import { getPiAgentDir } from "./paths.ts"

type AuthEvent =
    | "refresh_begin"
    | "refresh_persisted"
    | "refresh_failed"
    | "persistence_failed"
    | "revoked_401"
    | "recovery_adopted"
    | "sync_adopted"
    | "shaping_without_credentials"
    | "lock_timeout"
    | "lock_release_failed"

/** Small, always-on incident trail. Never accepts raw error text or token fields. */
export function recordAuthEvent(
    event: AuthEvent,
    source?: string,
    creds?: ClaudeCredentials,
): void {
    try {
        const dir = join(getPiAgentDir(), "claude-auth-events")
        mkdirSync(dir, { recursive: true, mode: 0o700 })
        const now = new Date()
        const day = now.toISOString().slice(0, 10)
        const path = join(dir, `${day}.jsonl`)
        // Bound retention and disk use. No auth operation may depend on logging.
        for (const name of readdirSync(dir)) {
            if (
                /^\d{4}-\d{2}-\d{2}\.jsonl$/.test(name) &&
                Date.parse(name.slice(0, 10)) < now.getTime() - 14 * 86_400_000
            ) {
                rmSync(join(dir, name), { force: true })
            }
        }
        try {
            if (statSync(path).size >= 2 * 1024 * 1024) return
        } catch {
            /* new day */
        }
        const id = (value: string) =>
            createHash("sha256").update(value).digest("hex").slice(0, 16)
        appendFileSync(
            path,
            JSON.stringify({
                ts: now.toISOString(),
                pid: process.pid,
                event,
                source,
                ...(creds
                    ? {
                          accessId: id(creds.accessToken),
                          refreshId: id(creds.refreshToken),
                          expiresAt: creds.expiresAt,
                      }
                    : {}),
            }) + "\n",
            { mode: 0o600 },
        )
    } catch {
        // Full disk, permissions, etc. must not invalidate a working login.
    }
}
