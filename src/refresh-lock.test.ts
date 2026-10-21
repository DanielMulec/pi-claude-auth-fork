import { execFileSync } from "node:child_process"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { test } from "node:test"

test("native refresh lock: recovers an orphan and releases after errors", () => {
    const dir = mkdtempSync(join(tmpdir(), "claude-refresh-lock-"))
    try {
        const module = new URL("./refresh-lock.ts", import.meta.url).href
        execFileSync(
            process.execPath,
            [
                "--experimental-strip-types",
                "--input-type=module",
                "-e",
                `
            import assert from "node:assert/strict"
            import { existsSync, mkdirSync, utimesSync } from "node:fs"
            import { join } from "node:path"
            import { withClaudeRefreshLock } from ${JSON.stringify(module)}
            const path = join(process.env.CLAUDE_SECURESTORAGE_CONFIG_DIR, ".oauth_refresh.lock")
            mkdirSync(path)
            const old = new Date(Date.now() - 70_000)
            utimesSync(path, old, old)
            assert.equal(withClaudeRefreshLock(() => "recovered"), "recovered")
            assert.equal(existsSync(path), false)
            assert.throws(() => withClaudeRefreshLock(() => { throw new Error("fixture") }), /fixture/)
            assert.equal(existsSync(path), false)
            mkdirSync(path)
            let ran = false
            assert.equal(withClaudeRefreshLock(() => { ran = true }), null)
            assert.equal(ran, false, "must fail closed while a live native lock is held")
            assert.equal(existsSync(path), true, "must not steal a live lock")
        `,
            ],
            {
                env: {
                    ...process.env,
                    CLAUDE_SECURESTORAGE_CONFIG_DIR: dir,
                    PI_CODING_AGENT_DIR: dir,
                },
                stdio: "pipe",
                timeout: 10000,
            },
        )
    } finally {
        rmSync(dir, { recursive: true, force: true })
    }
})
