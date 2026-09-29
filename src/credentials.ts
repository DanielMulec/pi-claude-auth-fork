import { execFileSync, execSync } from "node:child_process"
import {
    existsSync,
    mkdirSync,
    readFileSync,
    renameSync,
    rmdirSync,
    rmSync,
    statSync,
    writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import {
    readAllClaudeAccounts,
    refreshAccount,
    writeBackCredentials,
    type ClaudeAccount,
    type ClaudeCredentials,
} from "./keychain.ts"
import { log } from "./logger.ts"
import { getAuthJsonPath, getPiAgentDir } from "./paths.ts"

export type { ClaudeCredentials } from "./keychain.ts"
export type { ClaudeAccount } from "./keychain.ts"

const CREDENTIAL_CACHE_TTL_MS = 30_000

const accountCacheMap = new Map<
    string,
    { creds: ClaudeCredentials; cachedAt: number }
>()
let activeAccountSource: string | null = null
let allAccounts: ClaudeAccount[] = []

export function initAccounts(accounts: ClaudeAccount[]): void {
    allAccounts = accounts
}

export function getAccounts(): ClaudeAccount[] {
    return allAccounts
}

export function setActiveAccountSource(source: string): void {
    const previous = activeAccountSource
    activeAccountSource = source
    accountCacheMap.delete(source)
    if (previous && previous !== source) {
        log("account_switch", { newSource: source, previousSource: previous })
    }
}

export function refreshAccountsList(): ClaudeAccount[] {
    allAccounts = readAllClaudeAccounts()
    return allAccounts
}

function getActiveAccount(): ClaudeAccount | null {
    if (allAccounts.length === 0) return null
    if (activeAccountSource) {
        const found = allAccounts.find((a) => a.source === activeAccountSource)
        if (found) return found
    }
    return allAccounts[0]
}

function getAccountStateFile(): string {
    return join(getPiAgentDir(), "claude-account-source.txt")
}

export function loadPersistedAccountSource(): string | null {
    try {
        const path = getAccountStateFile()
        if (existsSync(path)) {
            return readFileSync(path, "utf-8").trim() || null
        }
    } catch {
        // ignore
    }
    return null
}

export function saveAccountSource(source: string): void {
    try {
        const path = getAccountStateFile()
        const dir = dirname(path)
        if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
        writeFileSync(path, source, "utf-8")
    } catch {
        // Non-fatal
    }
}

// auth.json is shared by every running pi process and by pi's own
// AuthStorage. Pi serializes access with proper-lockfile: a `<file>.lock`
// directory, treated as stale once its mtime is older than the holder's
// `stale` window (10s sync, 30s async; live holders refresh the mtime).
// We take the same lock so our read-modify-write never interleaves with pi's
// truncate-then-write, and so pi never reads our file half-written.
const AUTH_LOCK_STALE_MS = 30_000
const AUTH_LOCK_WAIT_MS = 500
const AUTH_LOCK_RETRY_MS = 5

function sleepSync(ms: number): void {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
}

/** Acquire pi's auth.json lock; returns a release function or null on timeout. */
function acquireAuthLock(authPath: string): (() => void) | null {
    const lockPath = `${authPath}.lock`
    const deadline = Date.now() + AUTH_LOCK_WAIT_MS
    while (true) {
        try {
            mkdirSync(lockPath)
            return () => {
                try {
                    rmdirSync(lockPath)
                } catch {
                    // Already removed (e.g. judged stale by another process).
                }
            }
        } catch (err) {
            if ((err as NodeJS.ErrnoException).code !== "EEXIST") throw err
        }
        try {
            if (Date.now() - statSync(lockPath).mtimeMs > AUTH_LOCK_STALE_MS) {
                rmdirSync(lockPath)
                continue
            }
        } catch {
            // Lock vanished between mkdir and stat: retry immediately.
            continue
        }
        if (Date.now() >= deadline) return null
        sleepSync(AUTH_LOCK_RETRY_MS)
    }
}

type SyncOutcome = "written" | "unchanged" | "locked" | "unreadable"

function isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value)
}

function syncToPath(authPath: string, creds: ClaudeCredentials): SyncOutcome {
    const dir = dirname(authPath)
    if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true, mode: 0o700 })
    }
    const release = acquireAuthLock(authPath)
    if (!release) return "locked"
    try {
        let auth: Record<string, unknown> = {}
        if (existsSync(authPath)) {
            // Never "start fresh" over an existing file: an empty or
            // unparsable auth.json means another writer is mid-write or the
            // file is damaged, and rewriting it would drop every other
            // provider's credentials. Skip; the next sync retries.
            const raw = readFileSync(authPath, "utf-8").trim()
            if (!raw) return "unreadable"
            let parsed: unknown
            try {
                parsed = JSON.parse(raw)
            } catch {
                return "unreadable"
            }
            if (!isPlainObject(parsed)) return "unreadable"
            auth = parsed
        }
        // pi persists OAuth credentials as `{ type: "oauth", access, refresh,
        // expires }` keyed by provider id. Seeding the `anthropic` entry lets
        // pi use the Claude Code credentials with no separate /login.
        const entry = {
            type: "oauth",
            access: creds.accessToken,
            refresh: creds.refreshToken,
            expires: creds.expiresAt,
        }
        const current = auth.anthropic
        if (
            isPlainObject(current) &&
            current.type === entry.type &&
            current.access === entry.access &&
            current.refresh === entry.refresh &&
            current.expires === entry.expires
        ) {
            return "unchanged"
        }
        auth.anthropic = entry
        // Write-then-rename so no reader ever sees a truncated file.
        const tmpPath = `${authPath}.${process.pid}.${Date.now()}.tmp`
        try {
            writeFileSync(tmpPath, JSON.stringify(auth, null, 2), {
                encoding: "utf-8",
                mode: 0o600,
            })
            renameSync(tmpPath, authPath)
        } catch (err) {
            rmSync(tmpPath, { force: true })
            throw err
        }
        return "written"
    } finally {
        release()
    }
}

export function syncAuthJson(creds: ClaudeCredentials): void {
    const authPath = getAuthJsonPath()
    try {
        const outcome = syncToPath(authPath, creds)
        log("sync_auth_json", {
            path: authPath,
            success: outcome === "written" || outcome === "unchanged",
            outcome,
        })
    } catch (err) {
        log("sync_auth_json", {
            path: authPath,
            success: false,
            error: err instanceof Error ? err.message : String(err),
        })
        throw err
    }
}

/** Claude Code 2.1.283 `TOKEN_URL`. The old claude.ai host still answers, but native refresh does not use it. */
export const OAUTH_TOKEN_URL = "https://platform.claude.com/v1/oauth/token"
export const OAUTH_CLIENT_ID = "9d1c250a-e61b-44d9-88ed-5944d1962f5e"

/** `dYe()` in Claude Code 2.1.283 when plugins scopes are registered. */
export const OAUTH_REFRESH_SCOPES = [
    "user:profile",
    "user:inference",
    "user:sessions:claude_code",
    "user:mcp_servers",
    "user:file_upload",
    "user:plugins",
] as const

export interface OAuthRefreshRequest {
    url: string
    headers: { "Content-Type": "application/json" }
    body: {
        grant_type: "refresh_token"
        refresh_token: string
        client_id: string
        scope: string
    }
}

/** Canonical 2.1.283 order for issued scopes, then any extra stored scopes. */
export function oauthRefreshScope(stored?: readonly string[]): string {
    if (!stored || stored.length === 0) return OAUTH_REFRESH_SCOPES.join(" ")
    const known = new Set(stored)
    const ordered = OAUTH_REFRESH_SCOPES.filter((scope) => known.has(scope))
    const extra = stored.filter(
        (scope) =>
            !OAUTH_REFRESH_SCOPES.includes(
                scope as (typeof OAUTH_REFRESH_SCOPES)[number],
            ),
    )
    return (ordered.length > 0 ? [...ordered, ...extra] : [...stored]).join(" ")
}

export function buildOAuthRefreshRequest(
    refreshToken: string,
    scopes?: readonly string[],
): OAuthRefreshRequest {
    return {
        url: OAUTH_TOKEN_URL,
        headers: { "Content-Type": "application/json" },
        body: {
            grant_type: "refresh_token",
            refresh_token: refreshToken,
            client_id: OAUTH_CLIENT_ID,
            scope: oauthRefreshScope(scopes),
        },
    }
}

/**
 * Parse a raw OAuth token response into ClaudeCredentials.
 * Returns null if the response is missing a valid access_token.
 * Defaults expires_in to 36000s (10h) to match observed Claude token lifetime.
 */
export function parseOAuthResponse(
    raw: string,
    currentRefreshToken: string,
    now: number = Date.now(),
): ClaudeCredentials | null {
    let data: {
        access_token?: string
        refresh_token?: string
        expires_in?: number
        error?: string
    }
    try {
        data = JSON.parse(raw)
    } catch {
        return null
    }

    if (!data.access_token) return null

    return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token ?? currentRefreshToken,
        expiresAt: now + (data.expires_in ?? 36_000) * 1000,
    }
}

export function refreshViaOAuth(
    refreshToken: string,
    scopes?: readonly string[],
): ClaudeCredentials | null {
    // Use a Node subprocess to perform the HTTP request synchronously.
    // The refresh request is passed via stdin to avoid exposure in process args.
    // 2.1.283 posts JSON, not a form body, to platform.claude.com.
    const request = buildOAuthRefreshRequest(refreshToken, scopes)
    const script = `
    process.stdin.resume();
    let input = '';
    process.stdin.on('data', c => input += c);
    process.stdin.on('end', () => {
      let request;
      try { request = JSON.parse(input); }
      catch { process.stdout.write(JSON.stringify({ error: 'bad input' })); process.exit(1); }
      fetch(request.url, {
        method: 'POST',
        headers: request.headers,
        body: JSON.stringify(request.body)
      })
      .then(async r => {
        const text = await r.text();
        if (!r.ok) {
          process.stdout.write(JSON.stringify({ error: String(r.status) }));
          process.exit(1);
        }
        process.stdout.write(text);
      })
      .catch(e => { process.stdout.write(JSON.stringify({ error: String(e) })); process.exit(1); });
    });
  `

    try {
        log("refresh_started", { source: "oauth" })
        const result = execFileSync(process.execPath, ["-e", script], {
            input: JSON.stringify(request),
            timeout: 15_000,
            encoding: "utf-8",
            stdio: ["pipe", "pipe", "ignore"],
        })

        const creds = parseOAuthResponse(result, refreshToken)
        if (!creds) {
            log("refresh_failed", {
                source: "oauth",
                error: "no access_token in response",
            })
            return null
        }

        log("refresh_success", { source: "oauth" })
        return creds
    } catch (err) {
        log("refresh_failed", {
            source: "oauth",
            error: err instanceof Error ? err.message : String(err),
        })
        return null
    }
}

function refreshViaCli(): void {
    const maxAttempts = 2
    for (let i = 0; i < maxAttempts; i++) {
        log("refresh_started", { source: "cli", attempt: i + 1 })
        try {
            execSync("claude -p . --model haiku", {
                timeout: 60_000,
                encoding: "utf-8",
                env: { ...process.env, TERM: "dumb" },
                stdio: "ignore",
                cwd: tmpdir(),
            })
            log("refresh_success", { source: "cli" })
            return
        } catch (err) {
            log("refresh_failed", {
                source: "cli",
                attempt: i + 1,
                error: err instanceof Error ? err.message : String(err),
            })
            // Non-fatal: retry once, then give up
        }
    }
}

export function refreshIfNeeded(
    account?: ClaudeAccount,
): ClaudeCredentials | null {
    const target = account ?? getActiveAccount()
    if (!target) return null

    // Claude Code 2.1.281+ writes rotated tokens to the Keychain, and that
    // rotation revokes the previous access token immediately. An in-memory
    // copy is not authoritative for any source.
    const onDisk = refreshAccount(target.source)
    if (onDisk) target.credentials = onDisk

    const creds = target.credentials
    if (creds.expiresAt > Date.now() + 60_000) return creds

    log("refresh_needed", {
        source: target.source,
        expiresAt: creds.expiresAt,
        expiresIn: creds.expiresAt - Date.now(),
    })

    // Try direct OAuth refresh first (zero LLM tokens consumed)
    if (creds.refreshToken) {
        const oauthCreds = refreshViaOAuth(creds.refreshToken, creds.scopes)
        if (oauthCreds && oauthCreds.expiresAt > Date.now() + 60_000) {
            oauthCreds.scopes ??= creds.scopes
            target.credentials = oauthCreds
            writeBackCredentials(target.source, oauthCreds)
            return oauthCreds
        }
    }

    // Fall back to CLI-based refresh (consumes Haiku tokens)
    log("refresh_fallback_cli", { source: target.source })
    refreshViaCli()
    const refreshed = refreshAccount(target.source)
    if (refreshed && refreshed.expiresAt > Date.now() + 60_000) {
        target.credentials = refreshed
        return refreshed
    }

    log("refresh_exhausted", {
        source: target.source,
        hadCredentials: !!refreshed,
        expiresAt: refreshed?.expiresAt,
    })
    return null
}

/**
 * Force a refresh of the active account's credentials and write the rotated
 * tokens back to storage. Used by pi's `oauth.refreshToken` hook, which is
 * invoked when the token stored in auth.json is at/near expiry.
 *
 * Re-reads the source first (the Claude CLI may have already rotated the
 * token), then falls back to a direct OAuth refresh.
 */
export function forceRefreshActiveCredentials(): ClaudeCredentials | null {
    const account = getActiveAccount()
    if (!account) return null

    accountCacheMap.delete(account.source)

    // The on-disk/keychain source may already hold a fresher token.
    const onDisk = refreshAccount(account.source)
    if (onDisk) account.credentials = onDisk
    if (account.credentials.expiresAt > Date.now() + 60_000) {
        accountCacheMap.set(account.source, {
            creds: account.credentials,
            cachedAt: Date.now(),
        })
        return account.credentials
    }

    const fresh = refreshIfNeeded(account)
    if (fresh) {
        accountCacheMap.set(account.source, {
            creds: fresh,
            cachedAt: Date.now(),
        })
    }
    return fresh
}

export interface RevokedRecoveryDeps {
    readActive: () => { source: string; credentials: ClaudeCredentials } | null
    reread: (source: string) => ClaudeCredentials | null
    refresh: (
        refreshToken: string,
        scopes?: string[],
    ) => ClaudeCredentials | null
    commit: (source: string, creds: ClaudeCredentials) => void
}

function defaultRevokedRecoveryDeps(): RevokedRecoveryDeps {
    return {
        readActive: () => {
            const account = getActiveAccount()
            if (!account) return null
            return { source: account.source, credentials: account.credentials }
        },
        reread: (source) => {
            accountCacheMap.delete(source)
            return refreshAccount(source)
        },
        refresh: (refreshToken, scopes) =>
            refreshViaOAuth(refreshToken, scopes),
        commit: (source, creds) => {
            const account = getActiveAccount()
            if (account && account.source === source) {
                account.credentials = creds
            }
            writeBackCredentials(source, creds)
            syncAuthJson(creds)
            accountCacheMap.set(source, { creds, cachedAt: Date.now() })
        },
    }
}

/**
 * Recover from `OAuth access token has been revoked` without rotating a token
 * another process already replaced.
 *
 * Re-read storage first. Refresh only when that read still holds the rejected
 * access token.
 */
export function recoverRevokedAccessToken(
    failedAccessToken: string,
    deps: RevokedRecoveryDeps = defaultRevokedRecoveryDeps(),
): string | null {
    const active = deps.readActive()
    if (!active) return null

    const external = deps.reread(active.source)
    const current = external ?? active.credentials
    if (current.accessToken && current.accessToken !== failedAccessToken) {
        deps.commit(active.source, current)
        return current.accessToken
    }
    if (!current.refreshToken) return null

    const fresh = deps.refresh(current.refreshToken, current.scopes)
    if (
        !fresh ||
        !fresh.accessToken ||
        fresh.accessToken === failedAccessToken
    ) {
        return null
    }
    fresh.scopes ??= current.scopes
    deps.commit(active.source, fresh)
    return fresh.accessToken
}

/**
 * Returns the active account's credentials for auth.json sync purposes.
 * Unlike getCachedCredentials(), this does NOT trigger a refresh.
 * Returns null if no account or credentials are expired.
 */
export function getCredentialsForSync(): ClaudeCredentials | null {
    const account = getActiveAccount()
    if (!account) return null

    const creds = account.credentials
    if (creds.expiresAt > Date.now() + 60_000) {
        return creds
    }

    // Near expiry -- don't refresh here, let the per-request path handle it.
    return null
}

export function getCachedCredentials(): ClaudeCredentials | null {
    const account = getActiveAccount()
    if (!account) return null

    const now = Date.now()
    const cached = accountCacheMap.get(account.source)
    if (
        cached &&
        now - cached.cachedAt < CREDENTIAL_CACHE_TTL_MS &&
        cached.creds.expiresAt > now + 60_000
    ) {
        log("cache_hit", {
            source: account.source,
            ttlRemaining: CREDENTIAL_CACHE_TTL_MS - (now - cached.cachedAt),
        })
        return cached.creds
    }

    log("cache_miss", {
        source: account.source,
        reason: cached ? "stale or expiring" : "empty",
    })

    const fresh = refreshIfNeeded(account)
    if (!fresh) {
        log("credentials_unavailable", { source: account.source })
        accountCacheMap.delete(account.source)
        return null
    }

    accountCacheMap.set(account.source, { creds: fresh, cachedAt: now })
    return fresh
}
