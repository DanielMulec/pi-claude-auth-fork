import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import {
    existsSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    rmSync,
    statSync,
    utimesSync,
    writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, beforeEach, test } from "node:test"
import {
    buildOAuthRefreshRequest,
    loadPersistedAccountSource,
    OAUTH_CLIENT_ID,
    OAUTH_TOKEN_URL,
    parseOAuthResponse,
    recoverRevokedAccessToken,
    saveAccountSource,
    syncAuthJson,
} from "./credentials.ts"

let dir = ""
let prevEnv: string | undefined

beforeEach(() => {
    prevEnv = process.env.PI_CODING_AGENT_DIR
    dir = mkdtempSync(join(tmpdir(), "pi-claude-auth-test-"))
    process.env.PI_CODING_AGENT_DIR = dir
})

afterEach(() => {
    if (prevEnv === undefined) delete process.env.PI_CODING_AGENT_DIR
    else process.env.PI_CODING_AGENT_DIR = prevEnv
    rmSync(dir, { recursive: true, force: true })
})

test("forceRefreshActiveCredentials: adopts a fresh Claude login before refreshing stale credentials", () => {
    // A separate HOME keeps this real file-storage path off the user's account.
    const claudeDir = join(dir, ".claude")
    mkdirSync(claudeDir)
    const fresh = {
        accessToken: "new-login-access",
        refreshToken: "new-login-refresh",
        expiresAt: Date.now() + 3_600_000,
    }
    writeFileSync(
        join(claudeDir, ".credentials.json"),
        JSON.stringify({ claudeAiOauth: fresh }),
    )
    const moduleUrl = new URL("./credentials.ts", import.meta.url).href
    const script = `
        import assert from "node:assert/strict"
        import { forceRefreshActiveCredentials, initAccounts, setActiveAccountSource } from ${JSON.stringify(moduleUrl)}
        for (const expiresAt of [1, Date.now() + 3_600_000]) {
            initAccounts([{ label: "Claude", source: "file", credentials: {
                accessToken: "stale-access", refreshToken: "invalid-refresh", expiresAt,
            } }])
            setActiveAccountSource("file")
            assert.deepEqual(forceRefreshActiveCredentials(), {
                ...${JSON.stringify(fresh)}, subscriptionType: undefined, scopes: undefined,
            })
        }
    `
    execFileSync(
        process.execPath,
        ["--experimental-strip-types", "--input-type=module", "-e", script],
        {
            env: { ...process.env, HOME: dir, USERPROFILE: dir },
            timeout: 5_000,
            stdio: "pipe",
        },
    )
})

test("getCredentialsForSync: never republishes an old session token after another login", () => {
    const claudeDir = join(dir, ".claude")
    mkdirSync(claudeDir)
    const fresh = {
        accessToken: "fresh-access",
        refreshToken: "fresh-refresh",
        expiresAt: Date.now() + 3_600_000,
    }
    writeFileSync(
        join(claudeDir, ".credentials.json"),
        JSON.stringify({ claudeAiOauth: fresh }),
    )
    const moduleUrl = new URL("./credentials.ts", import.meta.url).href
    execFileSync(
        process.execPath,
        [
            "--experimental-strip-types",
            "--input-type=module",
            "-e",
            `
        import assert from "node:assert/strict"
        import { rmSync } from "node:fs"
        import { initAccounts, setActiveAccountSource, getCredentialsForSync } from ${JSON.stringify(moduleUrl)}
        initAccounts([{ label: "test", source: "file", credentials: {
            accessToken: "old-access", refreshToken: "old-refresh", expiresAt: Date.now() + 7_200_000,
        } }])
        setActiveAccountSource("file")
        assert.equal(getCredentialsForSync()?.accessToken, "fresh-access")
        rmSync(${JSON.stringify(join(claudeDir, ".credentials.json"))})
        assert.equal(getCredentialsForSync(), null, "a missing source must not resurrect cached credentials")
    `,
        ],
        {
            env: { ...process.env, HOME: dir, USERPROFILE: dir },
            timeout: 5_000,
            stdio: "pipe",
        },
    )
})

test("parseOAuthResponse: maps a valid token response", () => {
    const creds = parseOAuthResponse(
        JSON.stringify({
            access_token: "new-access",
            refresh_token: "new-refresh",
            expires_in: 100,
        }),
        "old-refresh",
        1_000,
    )
    assert.ok(creds)
    assert.equal(creds.accessToken, "new-access")
    assert.equal(creds.refreshToken, "new-refresh")
    assert.equal(creds.expiresAt, 1_000 + 100 * 1000)
})

test("parseOAuthResponse: keeps current refresh token when not rotated", () => {
    const creds = parseOAuthResponse(
        JSON.stringify({ access_token: "a", expires_in: 10 }),
        "keep-me",
        0,
    )
    assert.ok(creds)
    assert.equal(creds.refreshToken, "keep-me")
})

test("parseOAuthResponse: defaults expires_in to 36000s", () => {
    const creds = parseOAuthResponse(
        JSON.stringify({ access_token: "a" }),
        "r",
        0,
    )
    assert.ok(creds)
    assert.equal(creds.expiresAt, 36_000 * 1000)
})

test("parseOAuthResponse: returns null without an access token", () => {
    assert.equal(parseOAuthResponse(JSON.stringify({ error: "x" }), "r"), null)
    assert.equal(parseOAuthResponse("not json", "r"), null)
})

test("syncAuthJson: writes a pi oauth entry under anthropic", () => {
    syncAuthJson({
        accessToken: "acc",
        refreshToken: "ref",
        expiresAt: 12345,
    })
    const raw = readFileSync(join(dir, "auth.json"), "utf-8")
    const parsed = JSON.parse(raw) as {
        anthropic: {
            type: string
            access: string
            refresh: string
            expires: number
        }
    }
    assert.deepEqual(parsed.anthropic, {
        type: "oauth",
        access: "acc",
        refresh: "ref",
        expires: 12345,
    })
})

test("syncAuthJson: preserves other providers in auth.json", () => {
    const authPath = join(dir, "auth.json")
    // Seed an unrelated provider, then sync anthropic on top of it.
    writeFileSync(
        authPath,
        JSON.stringify({ openai: { type: "api_key", key: "sk-test" } }),
        "utf-8",
    )
    syncAuthJson({ accessToken: "a2", refreshToken: "r2", expiresAt: 2 })
    const parsed = JSON.parse(readFileSync(authPath, "utf-8")) as {
        anthropic: { access: string }
        openai: { type: string; key: string }
    }
    assert.equal(parsed.anthropic.access, "a2")
    assert.deepEqual(parsed.openai, { type: "api_key", key: "sk-test" })
})

test("syncAuthJson: never rewrites an empty or unparsable auth.json", () => {
    const authPath = join(dir, "auth.json")
    for (const content of ["", "   \n", '{"deepseek": {"type": "api_k', "[]"]) {
        writeFileSync(authPath, content, "utf-8")
        syncAuthJson({ accessToken: "a", refreshToken: "r", expiresAt: 1 })
        assert.equal(readFileSync(authPath, "utf-8"), content)
    }
})

test("syncAuthJson: waits for pi's lock and skips while it is held", () => {
    const authPath = join(dir, "auth.json")
    const seeded = JSON.stringify({ xai: { type: "api_key", key: "k" } })
    writeFileSync(authPath, seeded, "utf-8")
    mkdirSync(`${authPath}.lock`)
    syncAuthJson({ accessToken: "a", refreshToken: "r", expiresAt: 1 })
    assert.equal(readFileSync(authPath, "utf-8"), seeded)
    assert.ok(existsSync(`${authPath}.lock`), "must not steal a live lock")
})

test("syncAuthJson: breaks a stale lock", () => {
    const authPath = join(dir, "auth.json")
    writeFileSync(authPath, "{}", "utf-8")
    mkdirSync(`${authPath}.lock`)
    const old = new Date(Date.now() - 60_000)
    utimesSync(`${authPath}.lock`, old, old)
    syncAuthJson({ accessToken: "a", refreshToken: "r", expiresAt: 1 })
    const parsed = JSON.parse(readFileSync(authPath, "utf-8"))
    assert.equal(parsed.anthropic.access, "a")
    assert.equal(existsSync(`${authPath}.lock`), false)
})

test("syncAuthJson: leaves auth.json untouched when anthropic is current", () => {
    const authPath = join(dir, "auth.json")
    syncAuthJson({ accessToken: "a", refreshToken: "r", expiresAt: 1 })
    const before = statSync(authPath).ino
    syncAuthJson({ accessToken: "a", refreshToken: "r", expiresAt: 1 })
    assert.equal(statSync(authPath).ino, before)
    assert.equal((statSync(authPath).mode & 0o777).toString(8), "600")
})

test("account source persistence round-trips", () => {
    assert.equal(loadPersistedAccountSource(), null)
    saveAccountSource("Claude Code-credentials")
    assert.equal(loadPersistedAccountSource(), "Claude Code-credentials")
})

test("buildOAuthRefreshRequest: 2.1.283 JSON token endpoint and scopes", () => {
    assert.equal(OAUTH_TOKEN_URL, "https://platform.claude.com/v1/oauth/token")
    assert.deepEqual(buildOAuthRefreshRequest("refresh-token"), {
        url: "https://platform.claude.com/v1/oauth/token",
        headers: { "Content-Type": "application/json" },
        body: {
            grant_type: "refresh_token",
            refresh_token: "refresh-token",
            client_id: OAUTH_CLIENT_ID,
            scope: "user:profile user:inference user:sessions:claude_code user:mcp_servers user:file_upload user:plugins",
        },
    })
})

test("buildOAuthRefreshRequest: keeps issued scopes and canonical order", () => {
    const request = buildOAuthRefreshRequest("refresh-token", [
        "user:file_upload",
        "user:inference",
        "user:plugins",
        "user:projects:read",
    ])
    assert.equal(
        request.body.scope,
        "user:inference user:file_upload user:plugins user:projects:read",
    )
})

test("recoverRevokedAccessToken: uses a newer stored token and does not refresh", () => {
    let refreshed = 0
    let committed = 0
    const recovered = recoverRevokedAccessToken("old-access", {
        readActive: () => ({
            source: "Claude Code-credentials",
            credentials: {
                accessToken: "old-access",
                refreshToken: "old-refresh",
                expiresAt: 1,
            },
        }),
        reread: () => ({
            accessToken: "keychain-access",
            refreshToken: "keychain-refresh",
            expiresAt: 2,
        }),
        refresh: () => {
            refreshed++
            return {
                accessToken: "should-not-run",
                refreshToken: "x",
                expiresAt: 3,
            }
        },
        commit: () => {
            committed++
        },
    })
    assert.equal(recovered, "keychain-access")
    assert.equal(refreshed, 0)
    assert.equal(committed, 1)
})

test("recoverRevokedAccessToken: refreshes only when storage still has the revoked token", () => {
    const recovered = recoverRevokedAccessToken("revoked-access", {
        readActive: () => ({
            source: "file",
            credentials: {
                accessToken: "revoked-access",
                refreshToken: "refresh",
                expiresAt: 1,
                scopes: ["user:inference"],
            },
        }),
        reread: () => ({
            accessToken: "revoked-access",
            refreshToken: "refresh",
            expiresAt: 1,
            scopes: ["user:inference"],
        }),
        refresh: (_token, scopes) => {
            assert.deepEqual(scopes, ["user:inference"])
            return {
                accessToken: "fresh-access",
                refreshToken: "fresh-refresh",
                expiresAt: 9,
            }
        },
        commit: (_source, creds) => {
            assert.equal(creds.accessToken, "fresh-access")
            assert.deepEqual(creds.scopes, ["user:inference"])
        },
    })
    assert.equal(recovered, "fresh-access")
})
