import assert from "node:assert/strict"
import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, test } from "node:test"
import {
    applyClaudeCodeHeaderFidelity,
    buildBillingHeaderValue,
    buildUserAgent,
    CLAUDE_CODE_BETAS,
    CC_REQUEST_CLASS,
    CC_ENTRYPOINT,
    CC_SDK_PACKAGE_VERSION,
    CC_TURN_ORIGIN,
    computeCchFromBody,
    computeVersionSuffix,
    extractFirstUserMessageText,
    LONG_CONTEXT_BETA,
    mergeCapturedBetas,
    patchClaudeCodeCch,
    resetLastResponseRequestId,
    setLastResponseRequestId,
    supportsLongContextBeta,
    xxHash64,
} from "./signing.ts"

const prevUa = process.env.ANTHROPIC_USER_AGENT
const prevVer = process.env.ANTHROPIC_CLI_VERSION
const prevEntry = process.env.CLAUDE_CODE_ENTRYPOINT
const prevSeed = process.env.ANTHROPIC_CCH_SEED
const prevConfigDir = process.env.CLAUDE_CONFIG_DIR

// `applyClaudeCodeHeaderFidelity` consults Claude Code's cached client-data pin.
// Point it at an empty directory so the tests never read (or depend on) the
// developer's own ~/.claude.json.
process.env.CLAUDE_CONFIG_DIR = mkdtempSync(join(tmpdir(), "pi-cc-atis-"))

afterEach(() => {
    restore("ANTHROPIC_USER_AGENT", prevUa)
    restore("ANTHROPIC_CLI_VERSION", prevVer)
    restore("CLAUDE_CODE_ENTRYPOINT", prevEntry)
    restore("ANTHROPIC_CCH_SEED", prevSeed)
    restore("CLAUDE_CONFIG_DIR", prevConfigDir)
})

function restore(key: string, value: string | undefined): void {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
}

test("extractFirstUserMessageText: first text block of first user message", () => {
    assert.equal(
        extractFirstUserMessageText([
            {
                role: "user",
                content: [
                    { type: "text", text: "from reminder block" },
                    { type: "text", text: "typed prompt" },
                ],
            },
        ]),
        "from reminder block",
    )
    assert.equal(
        extractFirstUserMessageText([
            {
                role: "user",
                content: [{ type: "text", text: "from block" }],
            },
        ]),
        "from block",
    )
})

test("computeVersionSuffix: live 2.1.267 captures", () => {
    assert.equal(
        computeVersionSuffix("Reply with exactly: PROBE_OK", "2.1.267"),
        "124",
    )
    // 2026-09-10 live captures: cc_version=2.1.267.f30 for the prompt "say hi"
    // and cc_version=2.1.267.75d for "explain the number seven briefly".
    assert.equal(computeVersionSuffix("say hi", "2.1.267"), "f30")
    assert.equal(
        computeVersionSuffix("explain the number seven briefly", "2.1.267"),
        "75d",
    )
})

test("computeVersionSuffix: live 2.1.270 captures", () => {
    // 2026-09-13 live captures against the 2.1.270 binary: the same prompt
    // yields a different suffix because the version string is hashed with it.
    assert.equal(computeVersionSuffix("say hi", "2.1.270"), "f7f")
    assert.equal(
        computeVersionSuffix("explain the number seven briefly", "2.1.270"),
        "658",
    )
})

test("computeVersionSuffix: live 2.1.273 capture", () => {
    // 2026-09-16: identical across native Fable 5.1, Opus 5 and Sonnet 5
    // captures for this prompt.
    assert.equal(
        computeVersionSuffix("Reply with exactly: OK", "2.1.273"),
        "e59",
    )
})

test("computeVersionSuffix: live 2.1.274 capture", () => {
    // 2026-09-17: identical across native Fable 5.1, Opus 5 and Sonnet 5
    // captures for this prompt.
    assert.equal(
        computeVersionSuffix("Reply with exactly: OK", "2.1.274"),
        "9be",
    )
})

test("xxHash64: standard vectors", () => {
    const enc = new TextEncoder()
    assert.equal(xxHash64(enc.encode("")).toString(16), "ef46db3751d8e999")
    assert.equal(xxHash64(enc.encode("hello")).toString(16), "26c7827d889f6da3")
})

test("patchClaudeCodeCch: recovered 2.1.224 vector", () => {
    delete process.env.ANTHROPIC_CCH_SEED
    const body =
        '{"model":"claude-opus-5","messages":[{"role":"user","content":"A"}],"max_tokens":64000,"stream":true,"system":[{"type":"text","text":"x-anthropic-billing-header: cc_version=2.1.224.000; cc_entrypoint=sdk-cli; cch=00000;"}]}'
    assert.match(patchClaudeCodeCch(body), /cch=7ba34/)
})

test("patchClaudeCodeCch: strips Pi opus-5 fallbacks", () => {
    delete process.env.ANTHROPIC_CCH_SEED
    const body = JSON.stringify({
        model: "claude-opus-5",
        messages: [{ role: "user", content: "A" }],
        max_tokens: 64000,
        fallbacks: [{ model: "claude-opus-4-8" }],
        system: [
            {
                type: "text",
                text: "x-anthropic-billing-header: cc_version=2.1.224.000; cc_entrypoint=sdk-cli; cch=00000;",
            },
        ],
    })
    const out = JSON.parse(patchClaudeCodeCch(body)) as {
        fallbacks?: unknown
        system: Array<{ text: string }>
    }
    assert.equal(out.fallbacks, undefined)
    assert.match(out.system[0].text, /cch=[0-9a-f]{5}/)
    assert.doesNotMatch(out.system[0].text, /cch=00000/)
})

test("patchClaudeCodeCch: strips fallbacks without billing header", () => {
    const body = JSON.stringify({
        model: "claude-opus-5",
        messages: [{ role: "user", content: "A" }],
        fallbacks: [{ model: "claude-opus-4-8" }],
    })
    const out = JSON.parse(patchClaudeCodeCch(body)) as { fallbacks?: unknown }
    assert.equal("fallbacks" in out, false)
})

test("patchClaudeCodeCch: live 2.1.267 vector", () => {
    delete process.env.ANTHROPIC_CCH_SEED
    const body =
        '{"model":"claude-opus-5","messages":[{"role":"user","content":[{"type":"text","text":"say hi"}]}],"max_tokens":64000,"stream":true,"system":[{"type":"text","text":"x-anthropic-billing-header: cc_version=2.1.267.f30; cc_entrypoint=sdk-cli; cch=00000; cc_prompt_id=00000000-0000-4000-8000-000000000000;"}]}'
    assert.match(patchClaudeCodeCch(body), /cch=d50c9/)
})

test("patchClaudeCodeCch: pi-only fallbacks stay out of the hash view", () => {
    delete process.env.ANTHROPIC_CCH_SEED
    const body = JSON.stringify({
        model: "claude-opus-5",
        messages: [
            { role: "user", content: [{ type: "text", text: "say hi" }] },
        ],
        max_tokens: 64000,
        stream: true,
        system: [
            {
                type: "text",
                text: "x-anthropic-billing-header: cc_version=2.1.267.f30; cc_entrypoint=sdk-cli; cch=00000; cc_prompt_id=00000000-0000-4000-8000-000000000000;",
            },
        ],
        fallbacks: [{ model: "claude-opus-4-8" }],
    })
    assert.match(patchClaudeCodeCch(body), /cch=d50c9/)
})

test("applyClaudeCodeHeaderFidelity: stainless identity + 1M beta", () => {
    const headers = new Headers({
        "anthropic-beta":
            "claude-code-20250219,oauth-2025-04-20,effort-2025-11-24",
    })
    applyClaudeCodeHeaderFidelity(
        headers,
        '{"model":"claude-opus-5","messages":[]}',
    )
    assert.equal(
        headers.get("x-stainless-package-version"),
        CC_SDK_PACKAGE_VERSION,
    )
    assert.equal(headers.get("x-claude-code-request-class"), CC_REQUEST_CLASS)
    assert.equal(
        headers.get("anthropic-beta"),
        `claude-code-20250219,oauth-2025-04-20,${LONG_CONTEXT_BETA},effort-2025-11-24`,
    )
})

test("applyClaudeCodeHeaderFidelity: no 1M beta on 200K models", () => {
    const headers = new Headers({
        "anthropic-beta": "claude-code-20250219,oauth-2025-04-20",
    })
    applyClaudeCodeHeaderFidelity(
        headers,
        '{"model":"claude-haiku-4-5","messages":[]}',
    )
    assert.equal(
        headers.get("anthropic-beta"),
        "claude-code-20250219,oauth-2025-04-20",
    )
})

test("mergeCapturedBetas: never removes a beta pi computed", () => {
    // Regression guard for claude-fable-5-1 / claude-opus-5. pi-ai derives these
    // from `supportsMidConvoEffort`; pinning the captured set as a provider
    // header made pi-ai replace its whole list with the captured one and the API
    // rejected the message-level output_config it had already been sent.
    const piComputed = [
        "claude-code-20250219",
        "oauth-2025-04-20",
        "mid-conversation-output-config-2026-07-01",
        "thinking-binding-controls-2026-08-01",
    ].join(",")
    const headers = new Headers({ "anthropic-beta": piComputed })

    mergeCapturedBetas(headers, {})

    const betas = (headers.get("anthropic-beta") ?? "").split(",")
    for (const beta of piComputed.split(",")) {
        assert.ok(betas.includes(beta), `dropped pi beta: ${beta}`)
    }
    for (const beta of CLAUDE_CODE_BETAS.split(",")) {
        assert.ok(betas.includes(beta), `missing captured beta: ${beta}`)
    }
    assert.equal(new Set(betas).size, betas.length, "duplicate beta")
})

test("mergeCapturedBetas: keeps pi's order, appending only what it lacks", () => {
    const headers = new Headers({
        "anthropic-beta": "claude-code-20250219,oauth-2025-04-20",
    })

    mergeCapturedBetas(headers, {})

    const betas = (headers.get("anthropic-beta") ?? "").split(",")
    assert.deepEqual(betas.slice(0, 2), [
        "claude-code-20250219",
        "oauth-2025-04-20",
    ])
    assert.equal(betas.length, CLAUDE_CODE_BETAS.split(",").length)
})

test("mergeCapturedBetas: sets the captured set when pi computed none", () => {
    const headers = new Headers()

    mergeCapturedBetas(headers, {})

    assert.equal(headers.get("anthropic-beta"), CLAUDE_CODE_BETAS)
})

test("mergeCapturedBetas: 2.1.277 Sonnet 5 captured set", () => {
    const headers = new Headers()

    mergeCapturedBetas(headers, {
        model: "claude-sonnet-5",
        thinkingDisplay: "updates",
    })

    const betas = (headers.get("anthropic-beta") ?? "").split(",")
    assert.ok(betas.includes("advisor-tool-2026-03-01"))
    assert.ok(betas.includes("afk-mode-2026-01-31"))
    assert.ok(betas.includes("thinking-display-updates-2026-08-18"))
    assert.ok(!betas.includes("mid-conversation-tool-changes-2026-07-01"))
    assert.ok(!betas.includes("per-turn-control-2026-07-01"))
    // Native strips both from the interactive main request.
    assert.ok(!betas.includes("redact-thinking-2026-02-12"))
    assert.ok(!betas.includes("structured-outputs-2025-12-15"))
})

test("mergeCapturedBetas: 2.1.277 Opus 5 model betas", () => {
    const headers = new Headers()

    mergeCapturedBetas(headers, {
        model: "claude-opus-5",
        thinkingDisplay: "updates",
    })

    const betas = (headers.get("anthropic-beta") ?? "").split(",")
    assert.ok(betas.includes("mid-conversation-tool-changes-2026-07-01"))
    assert.ok(!betas.includes("per-turn-control-2026-07-01"))
    // Fallback betas ride with a `fallbacks` body field native sends only on
    // auxiliary traffic; a main request carries neither.
    assert.ok(!betas.includes("server-side-fallback-2026-06-01"))
    assert.ok(!betas.includes("fallback-credit-2026-06-01"))
})

test("mergeCapturedBetas: 2.1.277 Fable 5.1 model betas", () => {
    const headers = new Headers()

    mergeCapturedBetas(headers, {
        model: "claude-fable-5-1",
        thinkingDisplay: "updates",
    })

    const betas = (headers.get("anthropic-beta") ?? "").split(",")
    for (const beta of [
        "per-turn-control-2026-07-01",
        "mid-conversation-tool-changes-2026-07-01",
    ]) {
        assert.ok(betas.includes(beta), `missing Fable beta: ${beta}`)
    }
    // Native puts per-turn control before mid-conversation tool changes.
    assert.ok(
        betas.indexOf("per-turn-control-2026-07-01") <
            betas.indexOf("mid-conversation-tool-changes-2026-07-01"),
    )
})

test("mergeCapturedBetas: display-updates beta follows thinking.display", () => {
    // Live 2.1.277: the interactive CLI sends the beta together with
    // `thinking.display: "updates"`; `--print` asks for `summarized` and sends
    // no such beta. Pi asks for `summarized`, so the beta must not be claimed.
    const headers = new Headers()

    mergeCapturedBetas(headers, {
        model: "claude-sonnet-5",
        thinkingDisplay: "summarized",
    })

    const betas = (headers.get("anthropic-beta") ?? "").split(",")
    assert.ok(!betas.includes("thinking-display-updates-2026-08-18"))
    assert.ok(betas.includes("thinking-binding-controls-2026-08-01"))
})

test("supportsLongContextBeta: catalog windows", () => {
    assert.equal(supportsLongContextBeta("claude-opus-5"), true)
    assert.equal(supportsLongContextBeta("claude-sonnet-5"), true)
    assert.equal(supportsLongContextBeta("claude-haiku-4-5"), false)
    assert.equal(supportsLongContextBeta("claude-opus-4-5"), false)
    assert.equal(supportsLongContextBeta(undefined), false)
})

test("buildBillingHeaderValue: 2.1.277 live sdk-cli shape", () => {
    // Native 2.1.277 `--print`, `claude-sonnet-5`, prompt "Reply with exactly:
    // OK": cc_version=2.1.277.b25; cc_entrypoint=sdk-cli; cch=...;
    // cc_prompt_id=...; cc_turn_origin=sdk;
    const header = buildBillingHeaderValue(
        [{ role: "user", content: "Reply with exactly: OK" }],
        "2.1.277",
        "sdk-cli",
        "6d3eeb40-a69c-4013-a9d5-5cf59b1923ac",
    )
    assert.equal(
        header,
        "x-anthropic-billing-header: cc_version=2.1.277.b25; cc_entrypoint=sdk-cli; cch=00000; cc_prompt_id=6d3eeb40-a69c-4013-a9d5-5cf59b1923ac; cc_turn_origin=sdk;",
    )
})

test("buildBillingHeaderValue: cc_prev_req precedes cc_prompt_id", () => {
    // Native field order from a live 2.1.277 second turn.
    const header = buildBillingHeaderValue(
        [{ role: "user", content: "Reply with exactly: OK" }],
        "2.1.277",
        "sdk-cli",
        "6d3eeb40-a69c-4013-a9d5-5cf59b1923ac",
        "req_capture_0001",
    )
    assert.ok(
        header.includes(
            "cch=00000; cc_prev_req=req_capture_0001; cc_prompt_id=6d3eeb40-a69c-4013-a9d5-5cf59b1923ac; cc_turn_origin=sdk;",
        ),
    )
})

test("cc_prev_req: only well-formed request ids are replayed", () => {
    resetLastResponseRequestId()
    setLastResponseRequestId("not-a-request-id")
    assert.equal(
        buildBillingHeaderValue(
            [{ role: "user", content: "Reply with exactly: OK" }],
            "2.1.277",
            "sdk-cli",
            "6d3eeb40-a69c-4013-a9d5-5cf59b1923ac",
        ).includes("cc_prev_req"),
        false,
    )
    setLastResponseRequestId("req_abc123")
    assert.ok(
        buildBillingHeaderValue(
            [{ role: "user", content: "Reply with exactly: OK" }],
            "2.1.277",
            "sdk-cli",
            "6d3eeb40-a69c-4013-a9d5-5cf59b1923ac",
        ).includes("cc_prev_req=req_abc123;"),
    )
    resetLastResponseRequestId()
})

test("computeCchFromBody: empties nested model strings", () => {
    // Regression guard for the 2.1.277 Opus/Fable captures. The advisor tool
    // repeats the model id, and native's hash view empties every `model` string
    // value, not just the top level. Emptying only the top level reproduced cch
    // for Sonnet and Haiku but missed Opus and Fable on all 15 live captures.
    const body = {
        model: "claude-opus-5",
        messages: [],
        tools: [
            { name: "Read", input_schema: { type: "object" } },
            {
                type: "advisor_20260301",
                name: "advisor",
                model: "claude-opus-5",
                defer_loading: true,
            },
            {
                name: "Agent",
                input_schema: {
                    properties: { model: { type: "string" } },
                },
            },
        ],
    }
    const deep = computeCchFromBody(body)
    // Independent implementation of the same rule: the serialized form only
    // contains `"model":"..."` for string-valued properties, so a textual
    // replacement of every occurrence must agree.
    const clone: Record<string, unknown> = { ...body }
    const textual = xxHash64(
        new TextEncoder().encode(
            JSON.stringify(clone).replace(/"model":"[^"]*"/g, '"model":""'),
        ),
        0x4d659218e32a3268n,
    )
    assert.equal(deep, (textual & 0xfffffn).toString(16).padStart(5, "0"))

    // And the old top-level-only view must NOT agree — otherwise this test
    // would not be guarding anything.
    const shallow = { ...body, model: "" } as Record<string, unknown>
    const shallowHash = xxHash64(
        new TextEncoder().encode(JSON.stringify(shallow)),
        0x4d659218e32a3268n,
    )
    assert.notEqual(
        deep,
        (shallowHash & 0xfffffn).toString(16).padStart(5, "0"),
    )
})

test("computeCchFromBody: keeps fallbacks, drops max_tokens", () => {
    // Live 2.1.277 Fable 5.1 auxiliary capture: native sends
    // `fallbacks: "default"` and hashes it, while `max_tokens` is dropped.
    const withMax = {
        model: "claude-fable-5-1",
        messages: [],
        fallbacks: "default",
        max_tokens: 64000,
    }
    const withoutMax: Record<string, unknown> = { ...withMax }
    delete withoutMax.max_tokens
    assert.equal(computeCchFromBody(withMax), computeCchFromBody(withoutMax))

    const withoutFallbacks: Record<string, unknown> = { ...withMax }
    delete withoutFallbacks.fallbacks
    assert.notEqual(
        computeCchFromBody(withMax),
        computeCchFromBody(withoutFallbacks),
    )
})

test("buildUserAgent: default Claude Code form", () => {
    delete process.env.ANTHROPIC_USER_AGENT
    delete process.env.CLAUDE_CODE_ENTRYPOINT
    // Injected so the assertion does not depend on which Claude Code release
    // happens to be installed on the machine running the tests.
    process.env.ANTHROPIC_CLI_VERSION = "2.1.267"
    assert.equal(buildUserAgent(), "claude-cli/2.1.267 (external, sdk-cli)")
})

test("buildUserAgent: version tracks ANTHROPIC_CLI_VERSION", () => {
    delete process.env.ANTHROPIC_USER_AGENT
    delete process.env.CLAUDE_CODE_ENTRYPOINT
    process.env.ANTHROPIC_CLI_VERSION = "2.1.270"
    assert.equal(buildUserAgent(), "claude-cli/2.1.270 (external, sdk-cli)")
    assert.match(computeVersionSuffix("say hi", "2.1.270"), /^f7f$/)
})

test("entrypoint, identity and turn origin stay consistent", () => {
    // Regression guard for the v0.8.0 regression: the classifier rejects a
    // claimed interactive entrypoint carrying a foreign system prompt, and the
    // failure is a request-time 400, not a failing test. Keep the three halves of
    // the claim — entrypoint, identity line, turn origin — locked together.
    assert.equal(CC_ENTRYPOINT, "sdk-cli")
    assert.equal(CC_TURN_ORIGIN, "sdk")
    assert.ok(buildUserAgent().endsWith("(external, sdk-cli)"))
})
