/**
 * Billing check: which entitlement does Anthropic bill this request against?
 *
 * Two modes, and the difference matters.
 *
 * **`--replay <capture>` is the authoritative one.** It re-sends a request the
 * extension actually produced — captured with `pnpm run capture` plus
 * `scripts/pi-capture-redirect.ts` — to the live API and reports the verdict.
 * Because the body is real pi traffic, it exercises everything the classifier
 * looks at, including the system prompt.
 *
 * **The default A/B probe cannot do that.** It sends a minimal body (no tools, a
 * two-line system prompt, `max_tokens: 16`), which Anthropic accepts regardless
 * of the client. On 2026-09-19 that gap cost an outage: the probe reported plan
 * windows while every real pi request was being rejected as third-party, because
 * the classifier's check is on the *system prompt*, and the probe has no system
 * prompt to speak of. Treat a green default probe as "the headers are plausible",
 * never as "pi is accepted". The probe prints that caveat itself.
 *
 * Both modes print the unified rate-limit response headers:
 *   - anthropic-ratelimit-unified-overage-*    -> extra usage
 *   - anthropic-ratelimit-unified-5h/-7d-*     -> plan windows
 *   - HTTP 400 "Third-party apps now draw from your extra usage" -> blocked
 *
 * The file name, the `lane:check` npm script and the `LaneHeaders` type keep
 * the older "lane" wording; everything printed here uses Anthropic's terms.
 *
 * Usage:
 *   pnpm run lane:check                          # A/B headers probe, sonnet-5
 *   pnpm run lane:check opus                     # A/B headers probe, opus-5
 *   pnpm run lane:check fable                    # A/B headers probe, fable-5-1
 *   pnpm run lane:check -- --replay <capture>    # replay a real shaped request
 */

import { randomUUID } from "node:crypto"
import { readAllClaudeAccounts } from "../src/keychain.ts"
import { readFileSync } from "node:fs"
import {
    applyClaudeCodeHeaderFidelity,
    buildUserAgent,
    mergeCapturedBetas,
    patchClaudeCodeCch,
    THINKING_DISPLAY_UPDATES,
} from "../src/signing.ts"
import { installedClaudeCodeVersion } from "../src/claude-version.ts"
import { injectBillingHeader } from "../src/transforms.ts"

const API_URL = "https://api.anthropic.com/v1/messages"

/**
 * The A/B probe's stand-in for pi's system prompt. It is deliberately not
 * Claude Code's: pi sends its own, and a probe that looked like Claude Code
 * would hide exactly the mismatch this file now warns about.
 */
const PROBE_PROMPT =
    "You are an expert coding assistant operating inside a coding agent harness."

// pi 0.85's built-in OAuth request shape (from pi-ai/dist/api/anthropic-messages.js)
const PI_BETAS =
    "claude-code-20250219,oauth-2025-04-20,fine-grained-tool-streaming-2025-05-14,interleaved-thinking-2025-05-14"
const PI_UA = "claude-cli/2.1.251"

const argv = process.argv.slice(2)
const args = new Set(argv)
const replayArg = argv.indexOf("--replay")
const REPLAY = replayArg >= 0 ? argv[replayArg + 1] : undefined
const MODEL = args.has("fable")
    ? "claude-fable-5-1"
    : args.has("opus")
      ? "claude-opus-5"
      : "claude-sonnet-5"
const USER_TEXT = "Reply with exactly: OK"

interface LaneHeaders {
    overageStatus?: string | null
    overageUtilization?: string | null
    h5Status?: string | null
    h5Utilization?: string | null
    h7Status?: string | null
    h7Utilization?: string | null
    requestId?: string | null
}

function extract(headers: Headers): LaneHeaders {
    return {
        overageStatus: headers.get(
            "anthropic-ratelimit-unified-overage-status",
        ),
        overageUtilization: headers.get(
            "anthropic-ratelimit-unified-overage-utilization",
        ),
        h5Status: headers.get("anthropic-ratelimit-unified-5h-status"),
        h5Utilization: headers.get(
            "anthropic-ratelimit-unified-5h-utilization",
        ),
        h7Status: headers.get("anthropic-ratelimit-unified-7d-status"),
        h7Utilization: headers.get(
            "anthropic-ratelimit-unified-7d-utilization",
        ),
        requestId: headers.get("request-id"),
    }
}

const THIRD_PARTY = /Third-party apps now draw from your extra usage/iu

function verdict(status: number, lane: LaneHeaders, text: string): string {
    if (THIRD_PARTY.test(text)) {
        return (
            "⛔ CLASSIFIED THIRD-PARTY — Anthropic refuses this shape. This is not " +
            "a billing-preference result: something in the request identifies pi as " +
            "a non-Claude-Code client (2026-09-19: a claimed `cli` entrypoint with a " +
            "foreign system prompt). See docs/LANE-MONITORING.md."
        )
    }
    if (status >= 400) {
        return `⛔ HTTP ${status} — request rejected, see body`
    }
    const overage = Number(lane.overageUtilization ?? "0")
    if (overage > 0) {
        return "⚠️  EXTRA USAGE BILLED (overage utilization > 0)"
    }
    if (lane.overageStatus === "blocked") {
        return "⛔ BLOCKED from extra usage and not covered by the plan"
    }
    if (lane.h5Utilization || lane.h7Utilization) {
        return "✅ PLAN WINDOWS (5h/7d utilization consumed, overage burn 0.0)"
    }
    return "❓ no unified rate-limit headers — inspect status/body"
}

async function send(
    label: string,
    token: string,
    shape: "pi" | "cc",
): Promise<void> {
    const url = shape === "cc" ? `${API_URL}?beta=true` : API_URL
    let body: Record<string, unknown> = {
        model: MODEL,
        max_tokens: 16,
        system: [{ type: "text", text: PROBE_PROMPT }],
        messages: [{ role: "user", content: USER_TEXT }],
        stream: false,
    }
    if (shape === "cc") {
        // Shaped by the extension's own transform, so the probe cannot drift
        // from production the way a hand-written identity line would.
        body =
            (injectBillingHeader(body) as
                | Record<string, unknown>
                | undefined) ?? body
    }
    const serializedBody = JSON.stringify(body)
    const headers = new Headers({
        authorization: `Bearer ${token}`,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
        accept: "application/json",
        "x-app": "cli",
        "anthropic-dangerous-direct-browser-access": "true",
    })
    if (shape === "pi") {
        headers.set("user-agent", PI_UA)
        headers.set("anthropic-beta", PI_BETAS)
    } else {
        headers.set("user-agent", buildUserAgent())
        headers.set("x-claude-code-session-id", randomUUID())
        headers.set("x-client-request-id", randomUUID())
        mergeCapturedBetas(headers, {
            model: MODEL,
            // The probe reproduces Claude Code's header set, not pi's body. On
            // live traffic native pairs this beta with `thinking.display:
            // "updates"`; the probe sends no thinking block at all.
            thinkingDisplay: THINKING_DISPLAY_UPDATES,
        })
        applyClaudeCodeHeaderFidelity(headers, serializedBody)
    }

    // The cc shape must carry a real cch, not the placeholder. The canonical
    // shapers above keep this probe aligned with the extension's live traffic.
    const serialized =
        shape === "cc" ? patchClaudeCodeCch(serializedBody) : serializedBody

    try {
        const res = await fetch(url, {
            method: "POST",
            headers,
            body: serialized,
        })
        const lane = extract(res.headers)
        const text = await res.text()
        const snippet = text.slice(0, 160).replace(/\s+/g, " ")
        console.log(`\n── ${label} (${shape} shape, ${MODEL}) ──`)
        console.log(`HTTP ${res.status}`)
        console.log(`request-id: ${lane.requestId ?? "—"}`)
        for (const [k, v] of Object.entries(lane)) {
            if (k === "requestId") continue
            console.log(`  ${k}: ${v ?? "—"}`)
        }
        console.log(`verdict: ${verdict(res.status, lane, text)}`)
        console.log(`body: ${snippet}${text.length > 160 ? "…" : ""}`)
    } catch (err) {
        console.error(`${label}: request failed: ${String(err)}`)
    }
}

/**
 * Re-send a captured request to the live API. The capture carries the extension's
 * final body and headers; only the bearer token is replaced, so this is the exact
 * shape pi would send, judged by the real classifier.
 */
async function replay(path: string, token: string): Promise<void> {
    const raw = JSON.parse(readFileSync(path, "utf8")) as {
        url?: string
        headers?: Record<string, string>
        body?: string | Record<string, unknown>
    }
    const body =
        typeof raw.body === "string" ? raw.body : JSON.stringify(raw.body)
    const headers = new Headers()
    for (const [k, v] of Object.entries(raw.headers ?? {})) {
        if (
            ["authorization", "content-length", "host", "connection"].includes(
                k,
            )
        ) {
            continue
        }
        headers.set(k, v)
    }
    headers.set("authorization", `Bearer ${token}`)

    const claimed = /cc_version=([\d.]+)\./.exec(body)?.[1]
    const url = (raw.url ?? API_URL).replace(
        /^https:\/\/api\.anthropic\.com/,
        "https://api.anthropic.com",
    )

    console.log(`\n── REPLAY ${path} ──`)
    console.log(`url: ${url}`)
    console.log(`claimed version: ${claimed ?? "—"}`)
    if (claimed !== undefined) {
        const installed = installedClaudeCodeVersion()
        if (installed !== undefined && claimed !== installed) {
            console.log(
                `⚠️  capture claims ${claimed} but ${installed} is installed — ` +
                    `re-capture before trusting this result`,
            )
        }
    }

    const res = await fetch(
        url.split("?")[0] + (url.includes("?") ? `?${url.split("?")[1]}` : ""),
        {
            method: "POST",
            headers,
            body,
        },
    )
    const lane = extract(res.headers)
    const text = await res.text()
    console.log(`HTTP ${res.status}`)
    console.log(`request-id: ${lane.requestId ?? "—"}`)
    for (const [k, v] of Object.entries(lane)) {
        if (k === "requestId") continue
        console.log(`  ${k}: ${v ?? "—"}`)
    }
    console.log(`verdict: ${verdict(res.status, lane, text)}`)
    console.log(`body: ${text.slice(0, 200).replace(/\s+/g, " ")}`)
}

async function main(): Promise<void> {
    const accounts = readAllClaudeAccounts()
    if (accounts.length === 0) {
        console.error(
            "No Claude Code credentials found. Run `claude` to authenticate first.",
        )
        process.exit(1)
    }
    const { label, credentials } = accounts[0]
    console.log(
        `Account: ${label} | Model: ${MODEL} | Token expires: ` +
            `${new Date(credentials.expiresAt).toISOString()}`,
    )

    if (REPLAY !== undefined) {
        await replay(REPLAY, credentials.accessToken)
        return
    }

    await send("A: pi built-in OAuth shape", credentials.accessToken, "pi")
    await send("B: Claude Code shape", credentials.accessToken, "cc")
    console.log(
        "\n⚠️  This probe sends a minimal body and cannot exercise Anthropic's\n" +
            "   content classifier. To test what pi actually sends, capture a real\n" +
            "   request and replay it:\n" +
            "     pnpm run capture -- --out /tmp/cc-capture &\n" +
            "     CCFP_DIR=/tmp/cc-capture/pi pi --extension scripts/pi-capture-redirect.ts \\\n" +
            "         --extension src/index.ts -ne -np -ns --print --model " +
            MODEL +
            ' "Reply with exactly: OK"\n' +
            "     pnpm run lane:check -- --replay /tmp/cc-capture/pi/pi-000.json",
    )
}

main()
