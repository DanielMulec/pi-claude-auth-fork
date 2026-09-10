import assert from "node:assert/strict"
import { afterEach, test } from "node:test"
import {
    applyClaudeCodeHeaderFidelity,
    buildBillingHeaderValue,
    buildUserAgent,
    CC_SDK_PACKAGE_VERSION,
    CC_VERSION,
    computeVersionSuffix,
    extractFirstUserMessageText,
    LONG_CONTEXT_BETA,
    patchClaudeCodeCch,
    supportsLongContextBeta,
    xxHash64,
} from "./signing.ts"

const prevUa = process.env.ANTHROPIC_USER_AGENT
const prevVer = process.env.ANTHROPIC_CLI_VERSION
const prevEntry = process.env.CLAUDE_CODE_ENTRYPOINT
const prevSeed = process.env.ANTHROPIC_CCH_SEED

afterEach(() => {
    restore("ANTHROPIC_USER_AGENT", prevUa)
    restore("ANTHROPIC_CLI_VERSION", prevVer)
    restore("CLAUDE_CODE_ENTRYPOINT", prevEntry)
    restore("ANTHROPIC_CCH_SEED", prevSeed)
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

test("supportsLongContextBeta: catalog windows", () => {
    assert.equal(supportsLongContextBeta("claude-opus-5"), true)
    assert.equal(supportsLongContextBeta("claude-sonnet-5"), true)
    assert.equal(supportsLongContextBeta("claude-haiku-4-5"), false)
    assert.equal(supportsLongContextBeta("claude-opus-4-5"), false)
    assert.equal(supportsLongContextBeta(undefined), false)
})

test("buildBillingHeaderValue: 2.1.267 live shape", () => {
    const header = buildBillingHeaderValue(
        [{ role: "user", content: "Reply with exactly: PROBE_OK" }],
        "2.1.267",
        "sdk-cli",
        "6d3eeb40-a69c-4013-a9d5-5cf59b1923ac",
    )
    assert.equal(
        header,
        "x-anthropic-billing-header: cc_version=2.1.267.124; cc_entrypoint=sdk-cli; cch=00000; cc_prompt_id=6d3eeb40-a69c-4013-a9d5-5cf59b1923ac;",
    )
})

test("buildUserAgent: default Claude Code form", () => {
    delete process.env.ANTHROPIC_USER_AGENT
    delete process.env.ANTHROPIC_CLI_VERSION
    delete process.env.CLAUDE_CODE_ENTRYPOINT
    assert.equal(buildUserAgent(), "claude-cli/2.1.267 (external, sdk-cli)")
})

test("CC_VERSION: pinned to live-captured Claude Code release", () => {
    assert.equal(CC_VERSION, "2.1.267")
})
