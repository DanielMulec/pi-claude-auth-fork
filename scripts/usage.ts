/**
 * Plan windows and extra usage for the Claude Code account.
 *
 * Calls the endpoint Claude Code's own `/usage` calls — Anthropic's unified
 * rate-limit view of the account. This is the *accounting* side of what
 * `lane:check` infers from response headers: the check says where a request was
 * routed, this says what has actually been consumed. Costs no tokens.
 *
 * Usage:
 *   pnpm run usage              # human-readable
 *   pnpm run usage -- --json    # raw payload, for diffing before/after
 */

import { readAllClaudeAccounts } from "../src/keychain.ts"

const USAGE_URL = "https://api.anthropic.com/api/oauth/usage"

interface UsageWindow {
    utilization?: number | null
    resets_at?: string | null
    used_dollars?: number | null
    limit_dollars?: number | null
}

interface UsageLimit {
    kind?: string
    percent?: number
    severity?: string
    is_active?: boolean
    resets_at?: string
    scope?: { model?: { display_name?: string } | null } | null
}

interface ExtraUsage {
    is_enabled?: boolean
    monthly_limit?: number | null
    used_credits?: number | null
    currency?: string | null
    decimal_places?: number
    spend_limit_reached?: boolean
    disabled_reason?: string | null
    user_disabled?: boolean
}

interface UsagePayload {
    limits?: UsageLimit[]
    extra_usage?: ExtraUsage
    [key: string]: unknown
}

/** `session` / `weekly_all` / `weekly_scoped` in Anthropic's own words. */
function limitLabel(limit: UsageLimit): string {
    const model = limit.scope?.model?.display_name
    switch (limit.kind) {
        case "session":
            return "session (5h)"
        case "weekly_all":
            return "weekly (7d)"
        case "weekly_scoped":
            return `weekly (${model ?? "model-scoped"})`
        default:
            return limit.kind ?? "window"
    }
}

/** Rows from `limits[]`, falling back to the named window objects. */
function windowRows(payload: UsagePayload): Array<[string, number, string]> {
    const rows: Array<[string, number, string]> = []
    for (const limit of payload.limits ?? []) {
        if (typeof limit.percent !== "number") continue
        const severity =
            limit.severity && limit.severity !== "normal"
                ? ` [${limit.severity}]`
                : ""
        rows.push([
            limitLabel(limit) + severity,
            limit.percent,
            limit.resets_at ?? "",
        ])
    }
    if (rows.length > 0) return rows

    for (const [key, value] of Object.entries(payload)) {
        if (key === "extra_usage") continue
        if (!value || typeof value !== "object") continue
        const window = value as UsageWindow
        if (typeof window.utilization !== "number") continue
        rows.push([
            key.replace(/_/g, " "),
            window.utilization,
            window.resets_at ?? "",
        ])
    }
    return rows
}

function relative(iso: string): string {
    const at = Date.parse(iso)
    if (Number.isNaN(at)) return iso
    const minutes = Math.round((at - Date.now()) / 60_000)
    if (minutes <= 0) return "now"
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)
    if (days > 0) return `in ${days}d ${hours % 24}h`
    if (hours > 0) return `in ${hours}h ${minutes % 60}m`
    return `in ${minutes}m`
}

function formatCredits(extra: ExtraUsage): string {
    const amount = extra.used_credits
    if (typeof amount !== "number") return "—"
    const currency = extra.currency ?? ""
    const digits = extra.decimal_places ?? 2
    return `${amount.toFixed(digits)} ${currency}`.trim()
}

function report(label: string, expiresAt: number, payload: UsagePayload): void {
    console.log(
        `Account: ${label} (token valid until ${new Date(expiresAt).toISOString()})`,
    )

    console.log("\nPlan windows")
    const rows = windowRows(payload)
    if (rows.length === 0) {
        console.log("  (none reported)")
    }
    for (const [name, percent, resets] of rows) {
        const reset = resets ? `  resets ${relative(resets)}` : ""
        console.log(
            `  ${name.padEnd(22)}${percent.toFixed(1).padStart(5)}%${reset}`,
        )
    }

    console.log("\nExtra usage")
    const extra = payload.extra_usage
    if (!extra) {
        console.log("  (not reported)")
        return
    }
    console.log(`  ${"used credits".padEnd(22)}${formatCredits(extra)}`)
    console.log(
        `  ${"monthly limit".padEnd(22)}${
            typeof extra.monthly_limit === "number"
                ? `${extra.monthly_limit.toFixed(extra.decimal_places ?? 2)} ${extra.currency ?? ""}`.trim()
                : "none"
        }`,
    )
    console.log(
        `  ${"spend limit reached".padEnd(22)}${extra.spend_limit_reached ? "yes" : "no"}`,
    )
    const state = !extra.is_enabled
        ? `disabled${extra.disabled_reason ? ` (${extra.disabled_reason})` : ""}`
        : extra.user_disabled
          ? "disabled by user"
          : "enabled"
    console.log(`  ${"state".padEnd(22)}${state}`)
}

async function main(): Promise<void> {
    const asJson = process.argv.slice(2).includes("--json")

    const accounts = readAllClaudeAccounts()
    if (accounts.length === 0) {
        console.error(
            "No Claude Code credentials found. Run `claude` to authenticate first.",
        )
        process.exit(1)
    }
    const { label, credentials } = accounts[0]

    const res = await fetch(USAGE_URL, {
        headers: {
            authorization: `Bearer ${credentials.accessToken}`,
            "content-type": "application/json",
            accept: "application/json",
        },
    })
    if (!res.ok) {
        const body = (await res.text()).slice(0, 300).replace(/\s+/g, " ")
        console.error(`HTTP ${res.status} from ${USAGE_URL}: ${body}`)
        process.exit(1)
    }

    const payload = (await res.json()) as UsagePayload
    if (asJson) {
        console.log(JSON.stringify(payload, null, 2))
        return
    }
    report(label, credentials.expiresAt, payload)
}

main()
