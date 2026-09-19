/**
 * Verify a captured Anthropic request against this fork's fingerprint.
 *
 * Usage:
 *   pnpm run verify:fingerprint -- <file|dir>...
 *
 *   # `--prompt` supplies the first user message's text when the capture's body
 *   # does not contain it verbatim (Claude Code merges its meta reminders into
 *   # the first user message before serializing). The version suffix is only
 *   # asserted when it is known or supplied.
 *   pnpm run verify:fingerprint -- capture.json --prompt "Reply with exactly: OK"
 *
 * Reads the dumps written by `scripts/capture-requests.ts` (or any JSON with
 * `headers` + `body`, or a bare request body). Recomputes cch and the
 * `cc_version` suffix with the production functions and reports the beta
 * delta, so a Claude Code update can be checked against real traffic without
 * spending plan quota on live probes.
 *
 * For the 2.1.278 mission, prefer native **`claude -p` / sdk-cli** captures as
 * the positive reference. Interactive TUI dumps are contingency research only.
 */
import { readFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"
import {
    buildUserAgent,
    capturedBetasFor,
    computeCchFromBody,
    computeVersionSuffix,
    extractFirstUserMessageText,
} from "../src/signing.ts"

const BILLING_PREFIX = "x-anthropic-billing-header: "
const CCH_PLACEHOLDER = "cch=00000"

interface Capture {
    headers?: Record<string, string>
    /** Parsed body (`capture-requests.ts`) or the exact wire bytes
     *  (`pi-capture-redirect.ts`). */
    body?: Record<string, unknown> | string
}

interface Message {
    role?: string
    content?: string | Array<{ type?: string; text?: string }>
}

// `--prompt` is parsed out before the file list.
function parseArgs(argv: string[]): { paths: string[]; prompt?: string } {
    const paths: string[] = []
    let prompt: string | undefined
    for (let i = 0; i < argv.length; i++) {
        if (argv[i] === "--prompt") {
            prompt = argv[++i]
            continue
        }
        paths.push(argv[i])
    }
    return { paths, prompt }
}

const { paths: targets, prompt: promptOverride } = parseArgs(
    process.argv.slice(2),
)

function collect(paths: string[]): string[] {
    const out: string[] = []
    for (const path of paths) {
        const stats = statSync(path, { throwIfNoEntry: false })
        if (!stats) continue
        if (stats.isDirectory()) {
            for (const name of readdirSync(path)) {
                if (name.endsWith(".json")) out.push(join(path, name))
            }
        } else {
            out.push(path)
        }
    }
    return out.sort()
}

/** The request body, whether the dump stored it parsed or serialized. */
function parseBody(
    raw: Capture | Record<string, unknown>,
): Record<string, unknown> | undefined {
    const body = (raw as Capture).body ?? raw
    if (typeof body === "string") {
        try {
            const parsed = JSON.parse(body) as unknown
            return parsed &&
                typeof parsed === "object" &&
                !Array.isArray(parsed)
                ? (parsed as Record<string, unknown>)
                : undefined
        } catch {
            return undefined
        }
    }
    return body && typeof body === "object" && !Array.isArray(body)
        ? (body as Record<string, unknown>)
        : undefined
}

function systemTexts(body: Record<string, unknown>): string[] {
    const system = body.system
    if (!Array.isArray(system)) return []
    return system.map((entry) => {
        if (typeof entry === "string") return entry
        const text = (entry as { text?: unknown }).text
        return typeof text === "string" ? text : ""
    })
}

let failures = 0
let checked = 0

for (const path of collect(targets)) {
    let raw: Capture | Record<string, unknown>
    try {
        raw = JSON.parse(readFileSync(path, "utf8")) as Capture
    } catch {
        continue
    }
    const body = parseBody(raw)
    if (body === undefined) continue
    const texts = systemTexts(body)
    if (!texts[0]?.startsWith(BILLING_PREFIX)) continue
    checked++

    const header = texts[0]
    const headers = new Headers((raw as Capture).headers ?? {})
    const version = /cc_version=([\d.]+)\./.exec(header)?.[1] ?? "?"
    const nativeSuffix = /cc_version=[\d.]+\.([0-9a-f]{3})/.exec(header)?.[1]
    const entrypoint = /cc_entrypoint=([a-z-]+)/.exec(header)?.[1] ?? "?"
    const nativeCch = /cch=([0-9a-f]{5})/.exec(header)?.[1]
    const fields = [...header.matchAll(/cc_[a-z_]+=/gu)].map((match) =>
        match[0].slice(0, -1),
    )

    // Recompute cch over the same bytes native hashed.
    const placeheld: Record<string, unknown> = structuredClone(body)
    ;(placeheld.system as Array<{ text: string }>)[0].text = header.replace(
        /cch=[0-9a-f]{5}/,
        CCH_PLACEHOLDER,
    )
    const mineCch = computeCchFromBody(placeheld)
    const cchOk = nativeCch === undefined || mineCch === nativeCch
    if (!cchOk) failures++

    // Claude Code merges its meta reminders into the first user message before
    // serializing, so the suffix's input is not recoverable from a native body —
    // only `--prompt` can verify it. Pi's bodies do carry the real prompt, so a
    // derived value is still reported, just not asserted.
    const derived = extractFirstUserMessageText(
        (body.messages ?? []) as Message[],
    )
    const prompt = promptOverride ?? derived
    const mineSuffix = computeVersionSuffix(prompt, version)
    const suffixOk = nativeSuffix === undefined || mineSuffix === nativeSuffix
    const suffixAsserted = promptOverride !== undefined
    if (suffixAsserted && !suffixOk) failures++

    console.log(`${path}`)
    console.log(
        `  model=${String(body.model)} entrypoint=${entrypoint} version=${version}`,
    )
    console.log(`  fields: ${fields.join(" ")}`)
    console.log(
        `  cch    native=${nativeCch ?? "-"} recomputed=${mineCch} ${cchOk ? "OK" : "MISMATCH"}`,
    )
    console.log(
        `  suffix native=${nativeSuffix ?? "-"} recomputed=${mineSuffix} ` +
            (suffixAsserted
                ? suffixOk
                    ? "OK"
                    : "MISMATCH"
                : nativeSuffix === undefined || suffixOk
                  ? "(not asserted; pass --prompt)"
                  : "(not asserted; body's first user message is Claude Code's merged reminder)"),
    )
    if (headers.has("user-agent")) {
        console.log(
            `  user-agent: ${headers.get("user-agent")} | this fork sends: ${buildUserAgent()}`,
        )
    }
    console.log(
        `  request-class=${headers.get("x-claude-code-request-class") ?? "-"} ` +
            `atis=${headers.has("x-cc-atis") ? "present" : "-"} ` +
            `stainless=${headers.get("x-stainless-package-version") ?? "-"}/` +
            `${headers.get("x-stainless-runtime-version") ?? "-"}/` +
            `${headers.get("x-stainless-timeout") ?? "-"}`,
    )
    console.log(`  identity[1]=${JSON.stringify(texts[1]?.slice(0, 70) ?? "")}`)

    // Beta delta against what this fork emits for the same request shape. On a
    // native capture anything listed under "missing" is drift this fork has not
    // tracked; on a pi capture the extras are often pi's own feature betas.
    const observed = (headers.get("anthropic-beta") ?? "")
        .split(",")
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0)
    if (observed.length > 0) {
        const expected = capturedBetasFor({
            model: typeof body.model === "string" ? body.model : undefined,
            thinkingDisplay: (body.thinking as { display?: string } | undefined)
                ?.display,
        })
        // "missing" = fork expects but capture lacks; "extra" = capture has fork
        // does not emit for this model.
        const missing = expected.filter((beta) => !observed.includes(beta))
        const extra = observed.filter((beta) => !expected.includes(beta))
        console.log(
            `  betas observed=${observed.length} missing=${JSON.stringify(missing)} extra=${JSON.stringify(extra)}`,
        )
    }
    console.log()
}

if (checked === 0) {
    console.log("no OAuth-shaped captures found")
}
console.log(
    failures === 0
        ? `${checked} capture(s) verified`
        : `${failures} mismatch(es) across ${checked} capture(s)`,
)
process.exit(failures === 0 ? 0 : 1)
