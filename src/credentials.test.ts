import assert from "node:assert/strict"
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
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
