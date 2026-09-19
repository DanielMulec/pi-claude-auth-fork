import { createHash } from "node:crypto"
import { readClaudeClientAtis } from "./atis.ts"
import { resolveClaudeCodeVersion } from "./claude-version.ts"

const BILLING_SALT = "59cf53e54c78"
const CCH_PLACEHOLDER = "cch=00000"
const MASK_64 = 0xffffffffffffffffn
const PRIME64_1 = 0x9e3779b185ebca87n
const PRIME64_2 = 0xc2b2ae3d27d4eb4fn
const PRIME64_3 = 0x165667b19e3779f9n
const PRIME64_4 = 0x85ebca77c2b2ae63n
const PRIME64_5 = 0x27d4eb2f165667c5n

/**
 * The entrypoint pi claims.
 *
 * Claude Code does not hardcode this: it reads `CLAUDE_CODE_ENTRYPOINT`
 * (`process.env.CLAUDE_CODE_ENTRYPOINT ?? "unknown"` in the 2.1.277 bundle) and
 * its own launchers set it — `cli` for the interactive TUI, `sdk-cli` for
 * `--print` / the Agent SDK. Reporting `sdk-cli` made every request look like it
 * came from the SDK rather than the interactive CLI, which is the identity this
 * fork exists to present, so the default is now the interactive one.
 */
export const CC_ENTRYPOINT = "cli"

/**
 * `cc_turn_origin`, also read by Claude Code from its own environment.
 *
 * Live 2.1.277 captures: the interactive CLI sends `human`, `--print` sends
 * `sdk`. Same origin vocabulary as the entrypoint split.
 */
export const CC_TURN_ORIGIN = "human"

/** Pi's requests are the main thread from Anthropic's point of view. */
export const CC_REQUEST_CLASS = "main"

/** Claude Code's `request-id` values, the input to `cc_prev_req`. */
const PREV_REQUEST_ID = /^req_[A-Za-z0-9_-]{1,36}$/

// SDK/runtime identity Claude Code reports in X-Stainless-* headers. Verified
// unchanged across 2.1.266/267/268/270/277 — unlike the release version, these
// do not move every release and nothing server-side enforces them. pi's own
// @anthropic-ai/sdk is newer (0.123.x, runtime v26.5.0), which is itself a
// fingerprint: the fetch patch overwrites all three.
export const CC_SDK_PACKAGE_VERSION = "0.112.1"
export const CC_RUNTIME_VERSION = "v26.3.0"
export const CC_STAINLESS_TIMEOUT = "600"
export const AGENT_SDK_IDENTITY =
    "You are a Claude agent, built on Anthropic's Claude Agent SDK."
export const LEGACY_CLI_IDENTITY =
    "You are Claude Code, Anthropic's official CLI for Claude."
/** The third variant: `--print` with an appended system prompt. */
export const LEGACY_CLI_AGENT_SDK_IDENTITY =
    "You are Claude Code, Anthropic's official CLI for Claude, running within the Claude Agent SDK."

// Verified 2026-09-10 against two live Claude Code 2.1.267 captures: the seed
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

// Claude Code's 2.1.277 first-party beta set shared by Fable 5.1, Opus 5 and
// Sonnet 5, in wire order, minus the model-gated 1M beta. Live-captured
// 2026-09-19 from the interactive CLI (`cc_entrypoint=cli`).
//
// The 2.1.277 bundle's registry (`Vae` / `XKt` in chunk-c6v4tbe9) shows these
// are per-model capability flags read from remote config, not release constants:
// `advisor-tool`, `thinking-binding-controls` and `thinking-display-updates`
// arrived through gates. What is stable is that an interactive first-party
// request to these models carries exactly this list, which is what a fingerprint
// has to reproduce.
//
// Two entries are deliberately absent even though the registry knows them:
// `redact-thinking-2026-02-12` and `structured-outputs-2025-12-15`. Live captures
// show both are stripped from the interactive main request (they survive only on
// `sdk-cli` and auxiliary/title traffic), so emitting them would be a tell.
//
// This is merged into pi's computed beta list (see `mergeCapturedBetas`), never
// asserted as a replacement. pi-ai treats a configured `anthropic-beta` header
// as a full override of its own derivation, so handing this list to
// `pi.registerProvider` silently removed every beta pi adds from a model's
// compat flags — including the per-message-effort betas that
// `claude-fable-5-1` and `claude-opus-5` need.
export const CLAUDE_CODE_BETAS = [
    "claude-code-20250219",
    "oauth-2025-04-20",
    "interleaved-thinking-2025-05-14",
    "thinking-token-count-2026-05-13",
    "context-management-2025-06-27",
    "prompt-caching-scope-2026-01-05",
    "mid-conversation-system-2026-04-07",
    "advisor-tool-2026-03-01",
    "advanced-tool-use-2025-11-20",
    "effort-2025-11-24",
    "thinking-binding-controls-2026-08-01",
    "thinking-display-updates-2026-08-18",
    "afk-mode-2026-01-31",
    "extended-cache-ttl-2025-04-11",
    "cache-diagnosis-2026-04-07",
].join(",")

/**
 * `thinking-display-updates-2026-08-18` is coupled to the request's thinking
 * display, not to the model.
 *
 * Live 2.1.277 captures: the interactive CLI sends the beta *and*
 * `thinking.display: "updates"`. `--print` and the auxiliary requests ask for
 * `display: "summarized"` and send no such beta. Emitting the beta while asking
 * for a summary would be both unfaithful and a functional risk — the server may
 * answer in a display mode pi did not ask for — so it follows the parameter.
 */
const DISPLAY_UPDATES_BETA = "thinking-display-updates-2026-08-18"
export const THINKING_DISPLAY_UPDATES = "updates"

const MID_CONVERSATION_TOOL_CHANGE_MODEL =
    /^claude-(?:fable-5(?:-1)?|opus-(?:4-8|5))(?:-|$)/
const FABLE_5_1_MODEL = /^claude-fable-5-1(?:-|$)/

/**
 * The Claude Code release this request claims to be.
 *
 * Read from the Claude Code installation on this machine rather than held as a
 * constant, so a Claude Code update needs no code change here. The value goes
 * on the wire twice — as `user-agent` and inside `cc_version=` — and is also an
 * input to the version suffix hash, so a stale copy is both a rejection risk
 * and a fingerprint mismatch. Resolved per call; see ./claude-version.ts.
 */
export function getCliVersion(): string {
    return resolveClaudeCodeVersion().version
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

/**
 * `request-id` of the last response, replayed as `cc_prev_req` on the next
 * request. Native chains turns this way: a live 2.1.277 capture's second turn
 * carries `cc_prev_req` equal to the first turn's response `request-id`.
 *
 * The value is validated by the same regex Claude Code uses, so a missing or
 * foreign header simply produces no field rather than a malformed one.
 */
let lastResponseRequestId: string | undefined

export function setLastResponseRequestId(
    value: string | null | undefined,
): void {
    lastResponseRequestId =
        typeof value === "string" && PREV_REQUEST_ID.test(value)
            ? value
            : undefined
}

export function getLastResponseRequestId(): string | undefined {
    return lastResponseRequestId
}

/** Test seam: forget the previous turn's request-id. */
export function resetLastResponseRequestId(): void {
    lastResponseRequestId = undefined
}

interface Message {
    role?: string
    content?: string | Array<{ type?: string; text?: string }>
}

// Mirrors native Claude Code's prompt extraction (`tls` in the 2.1.267 bundle):
// first user message, first text block. Claude Code computes the billing-header
// version suffix from this string *before* meta reminders are merged into the
// serialized body, which is why a live CC body's first block (a reminder) is not
// the suffix input even though `tls` takes the first text block.
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
 * Claude Code's hash view: every key named `model` whose value is a string,
 * emptied at any depth.
 *
 * The depth matters. A 2.1.277 Opus/Fable request embeds the model id a second
 * time inside the `advisor` tool (`{"type":"advisor_20260301","name":"advisor",
 * "model":"claude-opus-5",...}`), and native empties that one too. Emptying only
 * the top-level field reproduced cch for Sonnet and Haiku but missed Opus and
 * Fable on every live 2.1.277 capture — 14 of 15 captures only reproduce once
 * the walk is recursive.
 *
 * `fallbacks` is *kept*: native hashes its own `fallbacks` field (it sends the
 * literal `"default"` on auxiliary traffic). What native drops is
 * `max_tokens` and `fallback_credit_token` — values it rewrites at dispatch.
 */
function emptyModelStrings(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(emptyModelStrings)
    if (value === null || typeof value !== "object") return value
    const source = value as Record<string, unknown>
    const out: Record<string, unknown> = {}
    for (const [key, val] of Object.entries(source)) {
        out[key] =
            key === "model" && typeof val === "string"
                ? ""
                : emptyModelStrings(val)
    }
    return out
}

/**
 * Structure-aware cch: xxHash64 over Claude Code's hash view of the final body —
 * every `model` string emptied and the dispatch-only members omitted.
 */
export function computeCchFromBody(body: Record<string, unknown>): string {
    const normalized: Record<string, unknown> = { ...body }
    delete normalized.max_tokens
    delete normalized.fallback_credit_token
    const hash = xxHash64(
        new TextEncoder().encode(JSON.stringify(emptyModelStrings(normalized))),
        getCchSeed(),
    )
    return (hash & 0xfffffn).toString(16).padStart(5, "0")
}

/**
 * The billing header, in native field order:
 * `cc_version; cc_entrypoint; cch; [cc_prev_req]; cc_prompt_id; cc_turn_origin`.
 *
 * 2.1.277 captures of the interactive CLI carry `cc_turn_origin=human` on every
 * main request; `--print` sends `sdk` there. `cc_prev_req` appears from the
 * second turn on and echoes the previous response's `request-id`.
 */
export function buildBillingHeaderValue(
    messages: Message[],
    version: string,
    entrypoint: string,
    promptId: string = crypto.randomUUID(),
    prevRequestId: string | undefined = getLastResponseRequestId(),
    turnOrigin: string | undefined = CC_TURN_ORIGIN,
): string {
    const text = extractFirstUserMessageText(messages)
    const suffix = computeVersionSuffix(text, version)
    // Each field fragment carries its own leading space, mirroring Claude Code's
    // builder (`cc_entrypoint=${g};${y}${C}${S}${w}${je}${Ye}`), so optional
    // fields slot in without leaving a gap behind.
    const prev =
        prevRequestId !== undefined ? ` cc_prev_req=${prevRequestId};` : ""
    const origin =
        turnOrigin !== undefined ? ` cc_turn_origin=${turnOrigin};` : ""
    return (
        `x-anthropic-billing-header: ` +
        `cc_version=${version}.${suffix}; ` +
        `cc_entrypoint=${entrypoint};` +
        ` ${CCH_PLACEHOLDER};` +
        `${prev}` +
        ` cc_prompt_id=${promptId};` +
        `${origin}`
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

/** What a captured request needs to be reproduced. */
export interface CapturedRequestShape {
    model?: string
    /** `thinking.display` from the same body. */
    thinkingDisplay?: string
}

function shapeFromSerializedBody(serialized: string): CapturedRequestShape {
    try {
        const parsed = JSON.parse(serialized) as {
            model?: unknown
            thinking?: { display?: unknown }
        }
        return {
            model: typeof parsed.model === "string" ? parsed.model : undefined,
            thinkingDisplay:
                typeof parsed.thinking?.display === "string"
                    ? parsed.thinking.display
                    : undefined,
        }
    } catch {
        return {}
    }
}

/**
 * Merge Claude Code's captured first-party beta set into the list pi computed
 * for this request, keeping pi's entries and their order intact.
 *
 * pi-ai decides its beta list in `getBetaFeatures()` and treats a configured
 * `anthropic-beta` header as a complete replacement (`configuredFeatures !==
 * undefined` returns early). Declaring the captured set as a provider header
 * therefore *subtracted* betas pi derives from a model's compat flags. For
 * models with `supportsMidConvoEffort` that dropped
 * `mid-conversation-output-config-2026-07-01` and
 * `thinking-binding-controls-2026-08-01`, and the API answered
 * `messages.N.output_config: Extra inputs are not permitted`.
 *
 * Merging here instead makes the captured set purely additive: pi stays
 * authoritative for feature betas, so betas for future pi features cannot be
 * dropped by this extension.
 */
export function mergeCapturedBetas(
    headers: Headers,
    request: CapturedRequestShape,
): void {
    const current = headers.get("anthropic-beta")
    const betas = (current ?? "")
        .split(",")
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0)
    for (const beta of capturedBetasFor(request)) {
        if (!betas.includes(beta)) betas.push(beta)
    }
    headers.set("anthropic-beta", betas.join(","))
}

/**
 * Current live-captured Claude Code betas for one request, including
 * model-gated entries.
 *
 * The `server-side-fallback` / `fallback-credit` betas are gone: the 2.1.277
 * bundle emits them only together with a `fallbacks` body field (the same
 * function returns `{fallbacks: ...}` and pushes both betas), and interactive
 * main requests carried neither. Pi's `fallbacks` is stripped on OAuth anyway,
 * so advertising a fallback capability the request does not carry would be the
 * one thing native never does.
 */
export function capturedBetasFor(request: CapturedRequestShape): string[] {
    const betas = CLAUDE_CODE_BETAS.split(",")
    const model = request.model
    if (!model) return betas

    const afterSystem = betas.indexOf("mid-conversation-system-2026-04-07") + 1
    const systemBetas: string[] = []
    if (FABLE_5_1_MODEL.test(model)) {
        systemBetas.push("per-turn-control-2026-07-01")
    }
    if (MID_CONVERSATION_TOOL_CHANGE_MODEL.test(model)) {
        systemBetas.push("mid-conversation-tool-changes-2026-07-01")
    }
    betas.splice(afterSystem, 0, ...systemBetas)

    if (request.thinkingDisplay !== THINKING_DISPLAY_UPDATES) {
        const at = betas.indexOf(DISPLAY_UPDATES_BETA)
        if (at >= 0) betas.splice(at, 1)
    }
    return betas
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
 * Stainless version/timeout/runtime headers, the request class, the cached
 * client-data pin, and the model-gated 1M beta.
 */
export function applyClaudeCodeHeaderFidelity(
    headers: Headers,
    serializedBody: string | undefined,
): void {
    headers.set("x-stainless-package-version", CC_SDK_PACKAGE_VERSION)
    headers.set("x-stainless-timeout", CC_STAINLESS_TIMEOUT)
    headers.set("x-stainless-runtime-version", CC_RUNTIME_VERSION)
    headers.set("x-claude-code-request-class", CC_REQUEST_CLASS)

    if (serializedBody === undefined) return
    const shape = shapeFromSerializedBody(serializedBody)

    if (supportsLongContextBeta(shape.model)) {
        insertBeta(headers, LONG_CONTEXT_BETA)
    }
    // Best effort: Claude Code itself has no pin for a slot it has never
    // fetched, and sends none either.
    const atis = readClaudeClientAtis({
        entrypoint: getEntrypoint(),
        model: shape.model,
        version: getCliVersion(),
    })
    if (atis !== undefined) headers.set("x-cc-atis", atis)
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
        mergeCapturedBetas(
            headers,
            serializedBody === undefined
                ? {}
                : shapeFromSerializedBody(serializedBody),
        )
        // Re-assert the user-agent per request. The provider registration sets
        // it once at extension load, so a Claude Code update mid-session would
        // leave every later request claiming the old release while the billing
        // header (built per request) claimed the new one.
        headers.set("user-agent", buildUserAgent())

        return rememberRequestId(
            serializedBody !== undefined
                ? sendWithBody(
                      original,
                      url,
                      input as RequestInfo | URL,
                      init,
                      headers,
                      patchClaudeCodeCch(serializedBody),
                  )
                : original(url, { ...init, headers }),
        )
    }
}

/**
 * Record the response's `request-id` for the next request's `cc_prev_req`.
 * Read off the headers, so the streamed body is never touched.
 */
function rememberRequestId(pending: Promise<Response>): Promise<Response> {
    return pending.then((response) => {
        setLastResponseRequestId(response.headers.get("request-id"))
        return response
    })
}

function sendWithBody(
    original: typeof fetch,
    url: string,
    input: RequestInfo | URL,
    init: RequestInit | undefined,
    headers: Headers,
    body: string,
): Promise<Response> {
    if (typeof init?.body === "string") {
        return original(url, { ...init, headers, body })
    }
    if (input instanceof Request) {
        return original(
            new Request(url, {
                method: input.method,
                headers,
                body,
                signal: init?.signal ?? input.signal,
            }),
        )
    }
    return original(url, { ...init, headers, body })
}
