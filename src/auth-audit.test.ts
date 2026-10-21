import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import {
    mkdtempSync,
    readdirSync,
    readFileSync,
    rmSync,
    statSync,
    writeFileSync,
    mkdirSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { test } from "node:test"

test("auth audit: durable, bounded metadata only; never stores tokens", () => {
    const dir = mkdtempSync(join(tmpdir(), "claude-auth-audit-"))
    try {
        const events = join(dir, "claude-auth-events")
        mkdirSync(events)
        writeFileSync(join(events, "2000-01-01.jsonl"), "old")
        const module = new URL("./auth-audit.ts", import.meta.url).href
        const script = `
            import { recordAuthEvent } from ${JSON.stringify(module)}
            recordAuthEvent("refresh_begin", "file", {
                accessToken: "private-access-sentinel", refreshToken: "private-refresh-sentinel", expiresAt: 123,
            })
        `
        for (let i = 0; i < 2; i++) {
            execFileSync(
                process.execPath,
                [
                    "--experimental-strip-types",
                    "--input-type=module",
                    "-e",
                    script,
                ],
                {
                    env: { ...process.env, PI_CODING_AGENT_DIR: dir },
                    stdio: "pipe",
                },
            )
        }
        const files = readdirSync(events)
        assert.equal(files.length, 1, "old events must expire")
        const path = join(events, files[0]!)
        const raw = readFileSync(path, "utf8")
        assert.ok(!raw.includes("private-access-sentinel"))
        assert.ok(!raw.includes("private-refresh-sentinel"))
        const lines = raw
            .trim()
            .split("\n")
            .map((line) => JSON.parse(line))
        assert.equal(lines.length, 2, "new processes must append, not truncate")
        assert.equal(lines[0].accessId, lines[1].accessId)
        assert.equal(lines[0].refreshId, lines[1].refreshId)
        assert.equal(lines[0].expiresAt, 123)
        if (process.platform !== "win32")
            assert.equal(statSync(path).mode & 0o777, 0o600)
    } finally {
        rmSync(dir, { recursive: true, force: true })
    }
})
