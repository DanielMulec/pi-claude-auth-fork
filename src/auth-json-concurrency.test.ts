/**
 * Multi-process regression test for the auth.json wipe (2026-09-11, 2026-09-29).
 *
 * Several pi processes (parallel subagents, Telegram, intercom peers) each run
 * syncAuthJson at startup and on a 5-minute timer, while pi itself rewrites
 * auth.json under its proper-lockfile lock with a truncate-then-write. A sync
 * that reads auth.json mid-write sees "" and must never answer by writing an
 * anthropic-only file.
 *
 * Pi's writer is simulated with the real proper-lockfile that pi uses, so the
 * test also proves lock compatibility with pi.
 */
import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import {
    existsSync,
    mkdtempSync,
    readFileSync,
    realpathSync,
    rmSync,
    writeFileSync,
} from "node:fs"
import { createRequire } from "node:module"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(here, "..")
const credentialsModule = join(here, "credentials.ts")

function resolvePiLockfile(): string | null {
    try {
        const pi = realpathSync(
            join(repoRoot, "node_modules/@earendil-works/pi-coding-agent"),
        )
        return createRequire(join(pi, "package.json")).resolve(
            "proper-lockfile",
        )
    } catch {
        return null
    }
}

const SYNC_WORKER = `
import { syncAuthJson } from ${JSON.stringify(credentialsModule)}
const iterations = Number(process.argv[1])
for (let i = 0; i < iterations; i++) {
    syncAuthJson({ accessToken: "acc-" + process.pid + "-" + i, refreshToken: "ref", expiresAt: i })
}
`

// Mirrors pi's FileAuthStorageBackend.withLock: lock, read, merge, then a
// non-atomic writeFileSync (truncate + write) of the whole file.
const PI_WRITER = (lockfilePath: string) => `
import { readFileSync, writeFileSync } from "node:fs"
import { createRequire } from "node:module"
const lockfile = createRequire(import.meta.url)(${JSON.stringify(lockfilePath)})
const [authPath, iterationsArg, id] = process.argv.slice(1)
const iterations = Number(iterationsArg)
const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
for (let i = 0; i < iterations; i++) {
    let release
    for (let attempt = 0; ; attempt++) {
        try { release = lockfile.lockSync(authPath, { realpath: false }); break }
        catch (e) { if (e.code !== "ELOCKED" || attempt > 500) throw e; sleep(2) }
    }
    try {
        const data = JSON.parse(readFileSync(authPath, "utf-8"))
        data["pi-writer-" + id] = { type: "api_key", key: "k" + i }
        writeFileSync(authPath, JSON.stringify(data, null, 2), { mode: 0o600 })
    } finally { release() }
}
`

function run(args: string[], env: NodeJS.ProcessEnv): Promise<string> {
    return new Promise((resolve, reject) => {
        const child = spawn(process.execPath, args, {
            env,
            stdio: ["ignore", "ignore", "pipe"],
        })
        let stderr = ""
        child.stderr.on("data", (d) => (stderr += d))
        child.on("error", reject)
        child.on("exit", (code) =>
            code === 0
                ? resolve(stderr)
                : reject(new Error(`worker exited ${code}: ${stderr}`)),
        )
    })
}

const lockfilePath = resolvePiLockfile()

test(
    "syncAuthJson: concurrent processes never drop other providers",
    { skip: lockfilePath ? false : "pi's proper-lockfile not installed" },
    async () => {
        const dir = mkdtempSync(join(tmpdir(), "pi-claude-auth-race-"))
        try {
            const authPath = join(dir, "auth.json")
            const seeded = {
                deepseek: { type: "api_key", key: "sk-deepseek" },
                meta: { type: "api_key", key: "sk-meta" },
                xai: { type: "oauth", access: "a", refresh: "r", expires: 1 },
            }
            writeFileSync(authPath, JSON.stringify(seeded, null, 2), {
                mode: 0o600,
            })

            const env = {
                ...process.env,
                PI_CODING_AGENT_DIR: dir,
                PI_CLAUDE_AUTH_DEBUG: "",
            }
            const syncArgs = [
                "--experimental-strip-types",
                "--no-warnings",
                "--input-type=module",
                "-e",
                SYNC_WORKER,
                "--",
            ]
            const piArgs = [
                "--no-warnings",
                "--input-type=module",
                "-e",
                PI_WRITER(lockfilePath!),
                "--",
            ]

            const workers: Promise<string>[] = []
            for (let w = 0; w < 6; w++) {
                workers.push(run([...syncArgs, "300"], env))
            }
            for (let w = 0; w < 2; w++) {
                workers.push(run([...piArgs, authPath, "300", String(w)], env))
            }
            await Promise.all(workers)

            const final = JSON.parse(readFileSync(authPath, "utf-8"))
            for (const provider of Object.keys(seeded)) {
                assert.deepEqual(
                    final[provider],
                    seeded[provider as keyof typeof seeded],
                    `${provider} was dropped from auth.json`,
                )
            }
            assert.ok(final["pi-writer-0"], "pi writer 0 entry lost")
            assert.ok(final["pi-writer-1"], "pi writer 1 entry lost")
            assert.equal(final.anthropic?.type, "oauth")
            assert.equal(existsSync(`${authPath}.lock`), false, "lock leaked")
        } finally {
            rmSync(dir, { recursive: true, force: true })
        }
    },
)
