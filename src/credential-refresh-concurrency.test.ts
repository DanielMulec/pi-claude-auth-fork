/** Real subprocess refresh paths, isolated from the user's login and network. */
import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import {
    chmodSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    rmSync,
    writeFileSync,
} from "node:fs"
import { createServer } from "node:http"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { test } from "node:test"
import { pathToFileURL } from "node:url"
import { lockSync } from "proper-lockfile"

const credentialsModule = new URL("./credentials.ts", import.meta.url).href

for (const mode of [
    "expiry",
    "revoked-token recovery",
    "native lock holder",
    "expiry persistence failure",
    "recovery persistence failure",
]) {
    const recovery = mode.includes("recovery")
    const persistenceFailure = mode.includes("persistence failure")
    test(
        `shared refresh: ${mode} is single-flight across processes`,
        {
            timeout: 15_000,
            skip:
                process.platform === "win32" ? "POSIX fake CLI fixture" : false,
        },
        async () => {
            const dir = mkdtempSync(join(tmpdir(), "claude-refresh-race-"))
            const claudeDir = join(dir, ".claude")
            mkdirSync(claudeDir)
            const initial = {
                accessToken: "rejected-access",
                refreshToken: "single-use-refresh",
                expiresAt: recovery ? Date.now() + 3_600_000 : 1,
            }
            const credentialPath = join(claudeDir, ".credentials.json")
            writeFileSync(
                credentialPath,
                JSON.stringify({ claudeAiOauth: initial }),
            )
            // Never invoke the real Claude CLI if the losing refresh falls back.
            const bin = join(dir, "bin")
            mkdirSync(bin)
            const cli = join(bin, "claude")
            writeFileSync(cli, "#!/bin/sh\nexit 1\n")
            chmodSync(cli, 0o700)
            let requests = 0
            const server = createServer((req, res) => {
                req.resume()
                req.on("end", () => {
                    requests++
                    res.setHeader("content-type", "application/json")
                    if (requests > 1) {
                        res.writeHead(400)
                        res.end(
                            JSON.stringify({
                                error: "invalid_grant",
                                error_description:
                                    "Refresh token not found or invalid",
                            }),
                        )
                        return
                    }
                    // Both processes have time to enter the real refresh path.
                    setTimeout(() => {
                        if (persistenceFailure) rmSync(credentialPath)
                        res.end(
                            JSON.stringify({
                                access_token: "rotated-access",
                                refresh_token: "rotated-refresh",
                                expires_in: 3600,
                            }),
                        )
                    }, 350)
                })
            })
            await new Promise<void>((resolve) =>
                server.listen(0, "127.0.0.1", resolve),
            )
            const address = server.address()
            assert.ok(address && typeof address !== "string")
            const preload = join(dir, "fetch.mjs")
            writeFileSync(
                preload,
                `
            const original = globalThis.fetch
            globalThis.fetch = (url, init) => {
                if (url !== "https://platform.claude.com/v1/oauth/token") throw new Error("unexpected network request")
                return original("http://127.0.0.1:${address.port}/token", init)
            }
        `,
            )
            const worker = `
            import { writeFileSync, existsSync } from "node:fs"
            import { initAccounts, setActiveAccountSource, refreshIfNeeded, recoverRevokedAccessToken } from ${JSON.stringify(credentialsModule)}
            const initial = ${JSON.stringify(initial)}
            const account = { source: "file", label: "test", credentials: initial }
            initAccounts([account]); setActiveAccountSource("file")
            writeFileSync(process.env.READY_PATH, "ready")
            while (!existsSync(process.env.START_PATH)) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 5)
            const result = ${recovery ? 'recoverRevokedAccessToken("rejected-access")' : "refreshIfNeeded(account)?.accessToken"}
            process.stdout.write(JSON.stringify({ access: result ?? null }))
        `
            const children: ReturnType<typeof spawn>[] = []
            try {
                const workers = [0, 1].map(
                    (i) =>
                        new Promise<{ access: string | null }>(
                            (resolve, reject) => {
                                const child = spawn(
                                    process.execPath,
                                    [
                                        "--experimental-strip-types",
                                        "--input-type=module",
                                        "-e",
                                        worker,
                                    ],
                                    {
                                        env: {
                                            ...process.env,
                                            HOME: dir,
                                            USERPROFILE: dir,
                                            CLAUDE_CONFIG_DIR: claudeDir,
                                            CLAUDE_SECURESTORAGE_CONFIG_DIR:
                                                claudeDir,
                                            PI_CODING_AGENT_DIR: dir,
                                            PI_CLAUDE_AUTH_DEBUG: "",
                                            PATH: `${bin}:${process.env.PATH}`,
                                            NODE_OPTIONS: `--import=${pathToFileURL(preload).href}`,
                                            READY_PATH: join(dir, `ready-${i}`),
                                            START_PATH: join(dir, "start"),
                                        },
                                        stdio: ["ignore", "pipe", "pipe"],
                                    },
                                )
                                children.push(child)
                                let stdout = ""
                                let stderr = ""
                                child.stdout!.on("data", (chunk) => {
                                    stdout += chunk
                                })
                                child.stderr!.on("data", (chunk) => {
                                    stderr += chunk
                                })
                                child.on("error", reject)
                                child.on("exit", (code) => {
                                    if (code !== 0)
                                        return reject(
                                            new Error(
                                                `worker exited ${code}: ${stderr}`,
                                            ),
                                        )
                                    try {
                                        resolve(JSON.parse(stdout))
                                    } catch (error) {
                                        reject(error)
                                    }
                                })
                            },
                        ),
                )
                const { existsSync } = await import("node:fs")
                const deadline = Date.now() + 5000
                while (
                    ![0, 1].every((i) => existsSync(join(dir, `ready-${i}`)))
                ) {
                    assert.ok(
                        Date.now() < deadline,
                        "workers did not become ready",
                    )
                    await new Promise((resolve) => setTimeout(resolve, 5))
                }
                if (mode === "native lock holder") {
                    // Native proper-lockfile's exact lock-directory protocol. Its
                    // replacement credential must be adopted after it releases.
                    const releaseNative = lockSync(claudeDir, {
                        lockfilePath: join(claudeDir, ".oauth_refresh.lock"),
                        realpath: false,
                        stale: 60_000,
                        update: 5_000,
                    })
                    setTimeout(() => {
                        writeFileSync(
                            credentialPath,
                            JSON.stringify({
                                claudeAiOauth: {
                                    accessToken: "rotated-access",
                                    refreshToken: "rotated-refresh",
                                    expiresAt: Date.now() + 3_600_000,
                                },
                            }),
                        )
                        releaseNative()
                    }, 350)
                }
                writeFileSync(join(dir, "start"), "go")
                if (persistenceFailure) {
                    const results = await Promise.allSettled(workers)
                    assert.equal(
                        requests,
                        1,
                        "must not reuse the rotated token after its persistence fails",
                    )
                    assert.ok(
                        results.some(
                            (r) =>
                                r.status === "rejected" &&
                                /persist|persistence/.test(String(r.reason)),
                        ),
                    )
                    assert.ok(
                        results.every(
                            (r) =>
                                r.status === "rejected" ||
                                r.value.access === null,
                        ),
                        "an unpersisted token must not be reported healthy",
                    )
                    return
                }
                const results = await Promise.all(workers)
                assert.equal(
                    requests,
                    mode === "native lock holder" ? 0 : 1,
                    "the shared single-use refresh token was submitted more than once",
                )
                assert.deepEqual(results, [
                    { access: "rotated-access" },
                    { access: "rotated-access" },
                ])
                assert.equal(
                    JSON.parse(readFileSync(credentialPath, "utf8"))
                        .claudeAiOauth.refreshToken,
                    "rotated-refresh",
                )
            } finally {
                for (const child of children)
                    if (child.exitCode === null) child.kill()
                await new Promise<void>((resolve) =>
                    server.close(() => resolve()),
                )
                rmSync(dir, { recursive: true, force: true })
            }
        },
    )
}
