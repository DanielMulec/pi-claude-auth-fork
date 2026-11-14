import assert from "node:assert/strict"
import { test } from "node:test"
import {
    AGENT_SDK_IDENTITY,
    computeCchFromBody,
    installClaudeCodeFetchPatch,
    LEGACY_CLI_IDENTITY,
} from "./signing.ts"
import { injectBillingHeader } from "./transforms.ts"

test("final fetch shapes OAuth auxiliary requests without reshaping normal turns", async () => {
    const original = globalThis.fetch
    const sent: Array<{ url: string; headers: Headers; body: string }> = []
    globalThis.fetch = async (input, init) => {
        sent.push({
            url: String(input),
            headers: new Headers(init?.headers),
            body: String(init?.body),
        })
        return new Response("ok", { status: 200 })
    }
    try {
        installClaudeCodeFetchPatch(injectBillingHeader)
        const auxiliary = {
            model: "claude-sonnet-5-5",
            messages: [
                { role: "user", content: "Summarize this conversation" },
            ],
            max_tokens: 100,
            stream: true,
            metadata: { user_id: "preserve-existing-metadata" },
            system: [
                { type: "text", text: LEGACY_CLI_IDENTITY },
                {
                    type: "text",
                    text: "You are a context summarization assistant.",
                },
            ],
        }
        const normal = injectBillingHeader(structuredClone(auxiliary))
        assert.ok(normal)
        const normalText = (normal.system as Array<{ text: string }>)[0].text
        const headers = { authorization: "Bearer sk-ant-oat-test-only" }
        await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers,
            body: JSON.stringify(auxiliary),
        })
        await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers,
            body: JSON.stringify(normal),
        })
        await fetch("https://example.invalid/v1/messages", {
            method: "POST",
            headers,
            body: JSON.stringify(auxiliary),
        })
        await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: { "x-api-key": "test-only" },
            body: JSON.stringify(auxiliary),
        })
        await fetch("https://api.anthropic.com/v1/messages/count_tokens", {
            method: "POST",
            headers,
            body: JSON.stringify(auxiliary),
        })
        await fetch(
            new Request("https://api.anthropic.com/v1/messages", {
                method: "POST",
                headers,
                body: JSON.stringify(auxiliary),
            }),
        )
        const body = JSON.parse(sent[0].body) as typeof auxiliary
        assert.match(body.system[0].text, /^x-anthropic-billing-header: /)
        assert.equal(body.system[1].text, AGENT_SDK_IDENTITY)
        assert.equal(body.system[2].text, auxiliary.system[1].text)
        assert.deepEqual(body.metadata, auxiliary.metadata)
        const hash = /cch=([0-9a-f]{5})/.exec(body.system[0].text)?.[1]
        assert.ok(hash)
        body.system[0].text = body.system[0].text.replace(
            /cch=[0-9a-f]{5}/,
            "cch=00000",
        )
        assert.equal(hash, computeCchFromBody(body))
        const promptId = /cc_prompt_id=([0-9a-f-]{36})/.exec(
            body.system[0].text,
        )?.[1]
        assert.equal(sent[0].headers.get("x-claude-code-prompt-id"), promptId)
        const normalWire = JSON.parse(sent[1].body) as typeof auxiliary
        assert.equal(
            normalWire.system[0].text.replace(/cch=[0-9a-f]{5}/, "cch=00000"),
            normalText,
        )
        assert.deepEqual(JSON.parse(sent[2].body).system, auxiliary.system)
        assert.deepEqual(JSON.parse(sent[3].body).system, auxiliary.system)
        assert.deepEqual(JSON.parse(sent[4].body).system, auxiliary.system)
        assert.match(
            JSON.parse(sent[5].body).system[0].text,
            /^x-anthropic-billing-header: /,
        )
    } finally {
        globalThis.fetch = original
    }
})
