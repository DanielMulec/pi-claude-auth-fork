import { createHash } from "node:crypto"

const BILLING_SALT = "59cf53e54c78"
const CCH_PLACEHOLDER = "cch=00000"
const MASK_64 = 0xffffffffffffffffn
const PRIME64_1 = 0x9e3779b185ebca87n
const PRIME64_2 = 0xc2b2ae3d27d4eb4fn
const PRIME64_3 = 0x165667b19e3779f9n
const PRIME64_4 = 0x85ebca77c2b2ae63n
const PRIME64_5 = 0x27d4eb2f165667c5n

// Live-captured Claude Code 2.1.266 (2026-09-09, build 2026-09-08T23:01:17Z,
// git eb01d6090964). Override via ANTHROPIC_CLI_VERSION.
export const CC_VERSION = "2.1.266"
export const CC_ENTRYPOINT = "sdk-cli"

// SDK/runtime identity Claude Code 2.1.266 reports in X-Stainless-* headers.
// pi's own @anthropic-ai/sdk is newer (0.123.x), which is itself a fingerprint.
export const CC_SDK_PACKAGE_VERSION = "0.112.1"
export const CC_RUNTIME_VERSION = "v26.3.0"
export const CC_STAINLESS_TIMEOUT = "600"
export const AGENT_SDK_IDENTITY =
    "You are a Claude agent, built on Anthropic's Claude Agent SDK."
export const LEGACY_CLI_IDENTITY =
    "You are Claude Code, Anthropic's official CLI for Claude."

// Verified 2026-09-09 against two live Claude Code 2.1.266 captures: the seed
// still reproduces native cch exactly (it has not rotated since 2.1.220-2.1.234).
// Override via ANTHROPIC_CCH_SEED.
const DEFAULT_CCH_SEED = 0x4d659218e32a3268n

// The 1M-context beta is model-gated in Claude Code; inserted per request by
// the fetch patch for models with a 1M window.
export const LONG_CONTEXT_BETA = "context-1m-2025-08-07"

// Claude Code's 200K-window models. Everything else in pi's Claude catalog
// (fable-5, opus-4-6/7/8, opus-5, sonnet-4-5/4-6/5) is 1M-capable.
const CONTEXT_200K_MODEL = /^claude-(haiku-4-5|opus-4-5)(?:-|$)/

export function supportsLongContextBeta(model: string | undefined): boolean {
    return typeof model === "string" && !CONTEXT_200K_MODEL.test(model)
}

// Claude Code 2.1.266 first-party default beta set, in wire order, minus the
// model-gated 1M beta. Live-captured 2026-09-09 on claude-opus-5.
export const CLAUDE_CODE_BETAS = [
    "claude-code-20250219",
    "oauth-2025-04-20",
    "interleaved-thinking-2025-05-14",
    "thinking-token-count-2026-05-13",
    "context-management-2025-06-27",
    "prompt-caching-scope-2026-01-05",
    "mid-conversation-system-2026-04-07",
    "advanced-tool-use-2025-11-20",
    "effort-2025-11-24",
    "fallback-credit-2026-06-01",
    "extended-cache-ttl-2025-04-11",
    "cache-diagnosis-2026-04-07",
].join(",")

export function getCliVersion(): string {
    return process.env.ANTHROPIC_CLI_VERSION ?? CC_VERSION
}

export function getEntrypoint(): string {
    return process.env.CLAUDE_CODE_ENTRYPOINT ?? CC_ENTRYPOINT
}

export function getCchSeed(): bigint {
    const raw = process.env.ANTHROPIC_CCH_SEED
    if (!raw) return DEFAULT_CCH_SEED
    return BigInt(
        raw.startsWith("0x") || raw.startsWith("0X") ? raw : `0x${raw}`,
    )
}

export function buildUserAgent(): string {
    return (
        process.env.ANTHROPIC_USER_AGENT ??
        `claude-cli/${getCliVersion()} (external, ${getEntrypoint()})`
    )
}

interface Message {
    role?: string
    content?: string | Array<{ type?: string; text?: string }>
}

export function extractFirstUserMessageText(messages: Message[]): string {
    const userMsg = messages.find((m) => m.role === "user")
    if (!userMsg) return ""
    const content = userMsg.content
    if (typeof content === "string") return content
    if (Array.isArray(content)) {
        const textBlock = content.find((b) => b.type === "text")
        if (textBlock?.text) return textBlock.text
    }
    return ""
}

export function computeVersionSuffix(
    messageText: string,
    version: string,
): string {
    const sampled = [4, 7, 20]
        .map((i) => (i < messageText.length ? messageText[i] : "0"))
        .join("")
    return createHash("sha256")
        .update(`${BILLING_SALT}${sampled}${version}`)
        .digest("hex")
        .slice(0, 3)
}

function rotateLeft(value: bigint, bits: bigint): bigint {
    const normalized = value & MASK_64
    return ((normalized << bits) | (normalized >> (64n - bits))) & MASK_64
}

function readUint32LE(bytes: Uint8Array, offset: number): bigint {
    return BigInt(
        (bytes[offset] |
            (bytes[offset + 1] << 8) |
            (bytes[offset + 2] << 16) |
            (bytes[offset + 3] << 24)) >>>
            0,
    )
}

function readUint64LE(bytes: Uint8Array, offset: number): bigint {
    return (
        readUint32LE(bytes, offset) | (readUint32LE(bytes, offset + 4) << 32n)
    )
}

function round(accumulator: bigint, input: bigint): bigint {
    const mixed = (accumulator + input * PRIME64_2) & MASK_64
    return (rotateLeft(mixed, 31n) * PRIME64_1) & MASK_64
}

function mergeRound(accumulator: bigint, value: bigint): bigint {
    return ((accumulator ^ round(0n, value)) * PRIME64_1 + PRIME64_4) & MASK_64
}

export function xxHash64(bytes: Uint8Array, seed = 0n): bigint {
    let offset = 0
    let hash: bigint
    if (bytes.length >= 32) {
        let v1 = (seed + PRIME64_1 + PRIME64_2) & MASK_64
        let v2 = (seed + PRIME64_2) & MASK_64
        let v3 = seed & MASK_64
        let v4 = (seed - PRIME64_1) & MASK_64
        while (offset <= bytes.length - 32) {
            v1 = round(v1, readUint64LE(bytes, offset))
            v2 = round(v2, readUint64LE(bytes, offset + 8))
            v3 = round(v3, readUint64LE(bytes, offset + 16))
            v4 = round(v4, readUint64LE(bytes, offset + 24))
            offset += 32
        }
        hash =
            (rotateLeft(v1, 1n) +
                rotateLeft(v2, 7n) +
                rotateLeft(v3, 12n) +
                rotateLeft(v4, 18n)) &
            MASK_64
        hash = mergeRound(hash, v1)
        hash = mergeRound(hash, v2)
        hash = mergeRound(hash, v3)
        hash = mergeRound(hash, v4)
    } else {
        hash = (seed + PRIME64_5) & MASK_64
    }
    hash = (hash + BigInt(bytes.length)) & MASK_64
    while (offset <= bytes.length - 8) {
        const lane = round(0n, readUint64LE(bytes, offset))
        hash = (rotateLeft(hash ^ lane, 27n) * PRIME64_1 + PRIME64_4) & MASK_64
        offset += 8
    }
    if (offset <= bytes.length - 4) {
        hash ^= readUint32LE(bytes, offset) * PRIME64_1
        hash = (rotateLeft(hash, 23n) * PRIME64_2 + PRIME64_3) & MASK_64
        offset += 4
    }
    while (offset < bytes.length) {
        hash ^= BigInt(bytes[offset]) * PRIME64_5
        hash = (rotateLeft(hash, 11n) * PRIME64_1) & MASK_64
        offset++
    }
    hash ^= hash >> 33n
    hash = (hash * PRIME64_2) & MASK_64
    hash ^= hash >> 29n
    hash = (hash * PRIME64_3) & MASK_64
    hash ^= hash >> 32n
    return hash & MASK_64
}

/**
 * Structure-aware cch: xxHash64 over Claude Code's hash view of the final body
 * — every `model` string emptied and the dispatch-only members omitted.
 * `fallbacks`/`fallback_credit_token` are pi-only additions the native client
 * never hashes (Claude Code 2.1.266 omits them from its own hash view too).
 */
export function computeCchFromBody(body: Record<string, unknown>): string {
    const normalized = structuredClone(body)
    normalized.model = ""
    delete normalized.max_tokens
    delete normalized.fallbacks
    delete normalized.fallback_credit_token
    const hash = xxHash64(
        new TextEncoder().encode(JSON.stringify(normalized)),
        getCchSeed(),
    )
    return (hash & 0xfffffn).toString(16).padStart(5, "0")
}

export function buildBillingHeaderValue(
    messages: Message[],
    version: string,
    entrypoint: string,
    promptId: string = crypto.randomUUID(),
): string {
    const text = extractFirstUserMessageText(messages)
    const suffix = computeVersionSuffix(text, version)
    return (
        `x-anthropic-billing-header: ` +
        `cc_version=${version}.${suffix}; ` +
        `cc_entrypoint=${entrypoint}; ` +
        `${CCH_PLACEHOLDER}; ` +
        `cc_prompt_id=${promptId};`
    )
}

export function patchClaudeCodeCch(serializedBody: string): string {
    let body: Record<string, unknown>
    try {
        const parsed = JSON.parse(serializedBody)
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
            throw new Error("not an object")
        }
        body = parsed as Record<string, unknown>
    } catch {
        return serializedBody
    }
    // Pi 0.84+ adds official-API fallbacks on opus-5; Claude Code OAuth rejects the field.
    delete body.fallbacks
    const system = body.system
    if (!Array.isArray(system) || !system[0] || typeof system[0] !== "object") {
        return JSON.stringify(body)
    }
    const billing = system[0] as { text?: string }
    if (typeof billing.text !== "string") return JSON.stringify(body)
    if (!billing.text.startsWith("x-anthropic-billing-header: ")) {
        return JSON.stringify(body)
    }
    if (!billing.text.includes(CCH_PLACEHOLDER)) return JSON.stringify(body)
    if (typeof body.model !== "string" || !("max_tokens" in body)) {
        return JSON.stringify(body)
    }
    const cch = computeCchFromBody(body)
    billing.text = billing.text.replace(CCH_PLACEHOLDER, `cch=${cch}`)
    return JSON.stringify(body)
}

function requestUrl(input: RequestInfo | URL): string {
    if (typeof input === "string") return input
    if (input instanceof URL) return input.toString()
    return input.url
}

function withBetaTrue(url: string): string {
    if (!url.includes("/v1/messages") || url.includes("beta=")) return url
    return url.includes("?") ? `${url}&beta=true` : `${url}?beta=true`
}

function isOAuthAnthropic(headers: Headers): boolean {
    const auth = headers.get("authorization") ?? ""
    return auth.includes("sk-ant-oat")
}

function modelFromSerializedBody(serialized: string): string | undefined {
    try {
        const parsed = JSON.parse(serialized) as { model?: unknown }
        return typeof parsed.model === "string" ? parsed.model : undefined
    } catch {
        return undefined
    }
}

function insertBeta(headers: Headers, beta: string): void {
    const current = headers.get("anthropic-beta")
    if (!current) return
    const betas = current
        .split(",")
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0)
    if (betas.includes(beta)) return
    const anchor = betas.indexOf("oauth-2025-04-20")
    betas.splice(anchor >= 0 ? anchor + 1 : betas.length, 0, beta)
    headers.set("anthropic-beta", betas.join(","))
}

/**
 * Close the remaining client-identity gaps between pi's SDK and Claude Code:
 * Stainless version/timeout/runtime headers plus the model-gated 1M beta.
 */
export function applyClaudeCodeHeaderFidelity(
    headers: Headers,
    serializedBody: string | undefined,
): void {
    headers.set("x-stainless-package-version", CC_SDK_PACKAGE_VERSION)
    headers.set("x-stainless-timeout", CC_STAINLESS_TIMEOUT)
    headers.set("x-stainless-runtime-version", CC_RUNTIME_VERSION)
    if (
        serializedBody !== undefined &&
        supportsLongContextBeta(modelFromSerializedBody(serializedBody))
    ) {
        insertBeta(headers, LONG_CONTEXT_BETA)
    }
}

let fetchPatched = false
let activeSessionId: string | undefined

export function setActiveSessionId(sessionId: string | undefined): void {
    activeSessionId = sessionId
}

/** Patch global fetch so cch is computed on the final SDK JSON body. */
export function installClaudeCodeFetchPatch(): void {
    if (fetchPatched) return
    fetchPatched = true
    const original = globalThis.fetch.bind(globalThis)
    globalThis.fetch = async (input, init) => {
        const headers = new Headers(
            input instanceof Request ? input.headers : undefined,
        )
        if (init?.headers) {
            for (const [name, value] of new Headers(init.headers)) {
                headers.set(name, value)
            }
        }
        if (!isOAuthAnthropic(headers)) {
            return original(input as RequestInfo, init)
        }

        const url = withBetaTrue(requestUrl(input as RequestInfo | URL))
        if (!headers.has("x-client-request-id")) {
            headers.set("x-client-request-id", crypto.randomUUID())
        }
        if (activeSessionId && !headers.has("x-claude-code-session-id")) {
            headers.set("x-claude-code-session-id", activeSessionId)
        }

        const serializedBody =
            typeof init?.body === "string"
                ? init.body
                : input instanceof Request
                  ? await input.clone().text()
                  : undefined
        applyClaudeCodeHeaderFidelity(headers, serializedBody)

        if (serializedBody !== undefined) {
            const patched = patchClaudeCodeCch(serializedBody)
            if (typeof init?.body === "string") {
                return original(url, { ...init, headers, body: patched })
            }
            return original(
                new Request(url, {
                    method: (input as Request).method,
                    headers,
                    body: patched,
                    signal: init?.signal ?? (input as Request).signal,
                }),
            )
        }
        return original(url, { ...init, headers })
    }
}
