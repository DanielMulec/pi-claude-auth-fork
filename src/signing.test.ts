import assert from "node:assert/strict"
import { afterEach, test } from "node:test"
import {
    buildBillingHeaderValue,
    buildUserAgent,
    CC_VERSION,
    computeVersionSuffix,
    extractFirstUserMessageText,
    patchClaudeCodeCch,
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

test("extractFirstUserMessageText: first text block", () => {
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

test("computeVersionSuffix: live 2.1.234 PROBE_OK suffix", () => {
    assert.equal(
        computeVersionSuffix("Reply with exactly: PROBE_OK", "2.1.234"),
        "1c7",
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

test("buildBillingHeaderValue: 2.1.234 live shape", () => {
    const header = buildBillingHeaderValue(
        [{ role: "user", content: "Reply with exactly: PROBE_OK" }],
        "2.1.234",
        "sdk-cli",
        "6d3eeb40-a69c-4013-a9d5-5cf59b1923ac",
    )
    assert.equal(
        header,
        "x-anthropic-billing-header: cc_version=2.1.234.1c7; cc_entrypoint=sdk-cli; cch=00000; cc_prompt_id=6d3eeb40-a69c-4013-a9d5-5cf59b1923ac;",
    )
})

test("buildUserAgent: default Claude Code form", () => {
    delete process.env.ANTHROPIC_USER_AGENT
    delete process.env.ANTHROPIC_CLI_VERSION
    delete process.env.CLAUDE_CODE_ENTRYPOINT
    assert.equal(buildUserAgent(), "claude-cli/2.1.234 (external, sdk-cli)")
})

test("CC_VERSION: pinned to live-captured Claude Code release", () => {
    assert.equal(CC_VERSION, "2.1.234")
})
