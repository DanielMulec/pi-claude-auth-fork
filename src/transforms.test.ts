import assert from "node:assert/strict"
import { test } from "node:test"
import { AGENT_SDK_IDENTITY, LEGACY_CLI_IDENTITY } from "./signing.ts"
import { injectBillingHeader, parseClaudeCodeIdentity } from "./transforms.ts"

function claudePayload() {
    return {
        model: "claude-haiku-4-5",
        system: [{ type: "text", text: LEGACY_CLI_IDENTITY }],
        messages: [{ role: "user", content: "Reply with exactly: PROBE_OK" }],
    }
}

test("injectBillingHeader: billing + Agent SDK identity, keeps extra system", () => {
    const payload = {
        model: "claude-sonnet-4-6",
        system: [
            { type: "text", text: LEGACY_CLI_IDENTITY },
            {
                type: "text",
                text: "Pi system",
                cache_control: { type: "ephemeral" },
            },
        ],
        messages: [{ role: "user", content: "Reply with exactly: PROBE_OK" }],
    }
    const out = injectBillingHeader(payload, "sess-1", {
        deviceId: "f".repeat(64),
        accountUuid: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
    })
    assert.ok(out)
    const system = out.system as Array<{
        text: string
        cache_control?: unknown
    }>
    assert.equal(system.length, 3)
    assert.match(
        system[0].text,
        /^x-anthropic-billing-header: cc_version=2\.1\.267\.124; cc_entrypoint=sdk-cli; cch=00000; cc_prompt_id=[0-9a-f-]{36};$/,
    )
    assert.equal(system[1].text, AGENT_SDK_IDENTITY)
    assert.equal(system[2].text, "Pi system")
    assert.deepEqual(system[2].cache_control, { type: "ephemeral" })
    assert.deepEqual(out.metadata, {
        user_id: JSON.stringify({
            device_id: "f".repeat(64),
            account_uuid: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
            session_id: "sess-1",
        }),
    })
})

test("injectBillingHeader: undefined without OAuth identity", () => {
    assert.equal(
        injectBillingHeader({
            model: "claude-haiku-4-5",
            system: [{ type: "text", text: "some other system prompt" }],
            messages: [{ role: "user", content: "hi" }],
        }),
        undefined,
    )
})

test("injectBillingHeader: undefined for non-Claude models", () => {
    assert.equal(
        injectBillingHeader({
            model: "gpt-4o",
            system: [{ type: "text", text: LEGACY_CLI_IDENTITY }],
            messages: [{ role: "user", content: "hi" }],
        }),
        undefined,
    )
})

test("injectBillingHeader: idempotent", () => {
    const first = injectBillingHeader(claudePayload())
    assert.ok(first)
    const second = injectBillingHeader(first)
    assert.ok(second)
    const system = second.system as Array<{ text: string }>
    assert.equal(
        system.filter((e) => e.text.startsWith("x-anthropic-billing-header"))
            .length,
        1,
    )
    assert.equal(system.filter((e) => e.text === AGENT_SDK_IDENTITY).length, 1)
})

test("parseClaudeCodeIdentity: rejects bad ids", () => {
    assert.equal(
        parseClaudeCodeIdentity({
            userID: "bad",
            oauthAccount: {
                accountUuid: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
            },
        }),
        undefined,
    )
})
