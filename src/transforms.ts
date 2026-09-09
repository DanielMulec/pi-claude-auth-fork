import { readFileSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"
import {
    AGENT_SDK_IDENTITY,
    buildBillingHeaderValue,
    getCliVersion,
    getEntrypoint,
    LEGACY_CLI_IDENTITY,
} from "./signing.ts"

const BILLING_PREFIX = "x-anthropic-billing-header"

type SystemEntry = { type?: string; text?: string } & Record<string, unknown>

interface AnthropicPayload {
    model?: unknown
    system?: unknown
    messages?: unknown
    metadata?: unknown
}

export interface ClaudeCodeIdentity {
    deviceId: string
    accountUuid: string
}

function isClaudeModel(model: unknown): model is string {
    return typeof model === "string" && model.toLowerCase().includes("claude")
}

function entryText(entry: unknown): string {
    if (typeof entry === "string") return entry
    if (entry && typeof entry === "object") {
        const text = (entry as { text?: unknown }).text
        if (typeof text === "string") return text
    }
    return ""
}

export function parseClaudeCodeIdentity(
    value: unknown,
): ClaudeCodeIdentity | undefined {
    if (!value || typeof value !== "object") return undefined
    const rec = value as { userID?: unknown; oauthAccount?: unknown }
    if (typeof rec.userID !== "string" || !/^[0-9a-f]{64}$/u.test(rec.userID)) {
        return undefined
    }
    const account =
        rec.oauthAccount && typeof rec.oauthAccount === "object"
            ? (rec.oauthAccount as { accountUuid?: unknown }).accountUuid
            : undefined
    if (typeof account !== "string") return undefined
    if (
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(
            account,
        )
    ) {
        return undefined
    }
    return { deviceId: rec.userID, accountUuid: account }
}

export function discoverClaudeCodeIdentity(): ClaudeCodeIdentity | undefined {
    const fromEnv = parseClaudeCodeIdentity({
        userID: process.env.CLAUDE_CODE_DEVICE_ID,
        oauthAccount: { accountUuid: process.env.CLAUDE_CODE_ACCOUNT_UUID },
    })
    if (fromEnv) return fromEnv
    const path = join(
        process.env.CLAUDE_CONFIG_DIR || homedir(),
        ".claude.json",
    )
    try {
        return parseClaudeCodeIdentity(
            JSON.parse(readFileSync(path, "utf8")) as unknown,
        )
    } catch {
        return undefined
    }
}

/**
 * Shape an Anthropic OAuth payload like live Claude Code 2.1.266:
 * system[0] billing header, system[1] Agent SDK identity, then Pi's prompt.
 */
export function injectBillingHeader(
    payload: unknown,
    sessionId?: string,
    identity?: ClaudeCodeIdentity,
): AnthropicPayload | undefined {
    if (!payload || typeof payload !== "object") return undefined

    const p = payload as AnthropicPayload
    if (!isClaudeModel(p.model)) return undefined
    if (!Array.isArray(p.messages)) return undefined

    const system: SystemEntry[] = Array.isArray(p.system)
        ? [...(p.system as SystemEntry[])]
        : []

    const isOAuthShaped = system.some((e) => {
        const text = entryText(e)
        return (
            text.startsWith(LEGACY_CLI_IDENTITY) ||
            text.startsWith(AGENT_SDK_IDENTITY) ||
            text.startsWith(BILLING_PREFIX)
        )
    })
    if (!isOAuthShaped) return undefined

    const remaining = system.filter((e) => {
        const text = entryText(e)
        return (
            !text.startsWith(BILLING_PREFIX) &&
            !text.startsWith(LEGACY_CLI_IDENTITY) &&
            !text.startsWith(AGENT_SDK_IDENTITY)
        )
    })

    const billingHeader = buildBillingHeaderValue(
        p.messages as Array<{
            role?: string
            content?: string | Array<{ type?: string; text?: string }>
        }>,
        getCliVersion(),
        getEntrypoint(),
    )

    p.system = [
        { type: "text", text: billingHeader },
        { type: "text", text: AGENT_SDK_IDENTITY },
        ...remaining,
    ]

    if (identity && sessionId) {
        p.metadata = {
            user_id: JSON.stringify({
                device_id: identity.deviceId,
                account_uuid: identity.accountUuid,
                session_id: sessionId,
            }),
        }
    }

    return p
}
