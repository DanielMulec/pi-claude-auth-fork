/**
 * Billing check: which entitlement does Anthropic bill this request against?
 *
 * Sends two tiny requests with the same OAuth token and model:
 *   A) pi's built-in OAuth request shape (identity prompt, no billing header)
 *   B) full Claude Code shaping (billing header, current UA, full betas)
 *
 * Prints the unified rate-limit response headers for each. The entitlement is
 * visible in Anthropic's own headers:
 *   - anthropic-ratelimit-unified-overage-*    -> extra usage
 *   - anthropic-ratelimit-unified-5h/-7d-*     -> plan windows
 *   - HTTP 400 "Third-party apps now draw from your extra usage" -> blocked
 *
 * The file name, the `lane:check` npm script and the `LaneHeaders` type keep
 * the older "lane" wording; everything printed here uses Anthropic's terms.
 *
 * Usage:
 *   pnpm run lane:check            # A/B on claude-sonnet-5
 *   pnpm run lane:check opus       # A/B on claude-opus-5
 *   pnpm run lane:check fable      # A/B on claude-fable-5-1
 */

import { randomUUID } from "node:crypto"
import { readAllClaudeAccounts } from "../src/keychain.ts"
import {
    applyClaudeCodeHeaderFidelity,
    buildBillingHeaderValue,
    buildUserAgent,
    CC_ENTRYPOINT,
    getCliVersion,
    mergeCapturedBetas,
    patchClaudeCodeCch,
} from "../src/signing.ts"

const API_URL = "https://api.anthropic.com/v1/messages"
const IDENTITY = "You are Claude Code, Anthropic's official CLI for Claude."

// pi 0.85's built-in OAuth request shape (from pi-ai/dist/api/anthropic-messages.js)
const PI_BETAS =
    "claude-code-20250219,oauth-2025-04-20,fine-grained-tool-streaming-2025-05-14,interleaved-thinking-2025-05-14"
const PI_UA = "claude-cli/2.1.251"

const args = new Set(process.argv.slice(2))
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

function verdict(lane: LaneHeaders): string {
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
    const system = [{ type: "text" as const, text: IDENTITY }]
    if (shape === "cc") {
        system.unshift({
            type: "text" as const,
            text: buildBillingHeaderValue(
                [{ role: "user", content: USER_TEXT }],
                getCliVersion(),
                CC_ENTRYPOINT,
            ),
        })
    }

    const url = shape === "cc" ? `${API_URL}?beta=true` : API_URL
    const body = {
        model: MODEL,
        max_tokens: 16,
        system,
        messages: [{ role: "user", content: USER_TEXT }],
        stream: false,
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
        mergeCapturedBetas(headers, MODEL)
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
        console.log(`verdict: ${verdict(lane)}`)
        console.log(`body: ${snippet}${text.length > 160 ? "…" : ""}`)
    } catch (err) {
        console.error(`${label}: request failed: ${String(err)}`)
    }
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

    await send("A: pi built-in OAuth shape", credentials.accessToken, "pi")
    await send("B: Claude Code shape", credentials.accessToken, "cc")
}

main()
