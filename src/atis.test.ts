import assert from "node:assert/strict"
import { mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, test } from "node:test"
import {
    clientDataSlotKey,
    pickClientDataAtis,
    readClaudeClientAtis,
    resetClaudeConfigCache,
    claudeConfigPath,
} from "./atis.ts"

// The organization the live captures were taken under, and the slot keys Claude
// Code derived for it. Both keys were read straight out of a real
// ~/.claude.json after the 2.1.277 captures that produced them.
const ORG = "181b4f97-1a10-47b1-bd46-53d0bffc8ef6"

const prevConfigDir = process.env.CLAUDE_CONFIG_DIR

afterEach(() => {
    resetClaudeConfigCache()
    if (prevConfigDir === undefined) delete process.env.CLAUDE_CONFIG_DIR
    else process.env.CLAUDE_CONFIG_DIR = prevConfigDir
})

test("clientDataSlotKey: reproduces live Claude Code slot keys", () => {
    assert.equal(
        clientDataSlotKey("cli", "claude-sonnet-5", "2.1.277", ORG),
        "bi1-f1d00a06152961b4",
    )
    assert.equal(
        clientDataSlotKey("sdk-cli", "claude-sonnet-5", "2.1.277", ORG),
        "bi1-138717101b71688d",
    )
    assert.equal(
        clientDataSlotKey("cli", "claude-fable-5-1", "2.1.277", ORG),
        "bi1-d4ef485ed27a4bae",
    )
    // `bi1-7b76a09565e44d4b` is the real slot for ("cli", opus-5, 2.1.277, ORG).
    // A missing entrypoint serializes as null, per the bundle's
    // `e.entrypoint ?? null`, and therefore lands on a different slot.
    assert.equal(
        clientDataSlotKey("cli", "claude-opus-5", "2.1.277", ORG),
        "bi1-7b76a09565e44d4b",
    )
    assert.equal(
        clientDataSlotKey(undefined, "claude-opus-5", "2.1.277", ORG),
        "bi1-2d17cbf4c2fd9070",
    )
})

test("pickClientDataAtis: exact slot wins over a newer stale slot", () => {
    const key = clientDataSlotKey("cli", "claude-sonnet-5", "2.1.277", ORG)
    assert.equal(
        pickClientDataAtis(
            {
                [key]: {
                    at: 1,
                    entrypoint: "cli",
                    model: "claude-sonnet-5",
                    org: ORG,
                    data: { atis: "v1.exact.pin" },
                },
                "bi1-other": {
                    at: 9_999_999_999_999,
                    entrypoint: "cli",
                    model: "claude-sonnet-5",
                    org: ORG,
                    data: { atis: "v1.stale.pin" },
                },
            },
            {
                entrypoint: "cli",
                model: "claude-sonnet-5",
                version: "2.1.277",
                organizationUuid: ORG,
            },
        ),
        "v1.exact.pin",
    )
})

test("pickClientDataAtis: falls back to the newest matching slot", () => {
    // Claude Code's own `wK` behaviour: after a release bump the exact slot is
    // missing and the client keeps sending the last pin it received.
    const slots = {
        "bi1-older": {
            at: 1000,
            entrypoint: "cli",
            model: "claude-sonnet-5",
            org: ORG,
            data: { atis: "v1.older.pin" },
        },
        "bi1-newer": {
            at: 2000,
            entrypoint: "cli",
            model: "claude-sonnet-5",
            org: ORG,
            data: { atis: "v1.newer.pin" },
        },
    }
    assert.equal(
        pickClientDataAtis(slots, {
            entrypoint: "cli",
            model: "claude-sonnet-5",
            version: "2.1.278",
            organizationUuid: ORG,
        }),
        "v1.newer.pin",
    )
})

test("pickClientDataAtis: ignores other entrypoints, models and orgs", () => {
    const request = {
        entrypoint: "cli",
        model: "claude-sonnet-5",
        version: "2.1.277",
        organizationUuid: ORG,
    }
    for (const slot of [
        {
            at: 1,
            entrypoint: "sdk-cli",
            model: "claude-sonnet-5",
            org: ORG,
            data: { atis: "v1.pin" },
        },
        {
            at: 1,
            entrypoint: "cli",
            model: "claude-opus-5",
            org: ORG,
            data: { atis: "v1.pin" },
        },
        {
            at: 1,
            entrypoint: "cli",
            model: "claude-sonnet-5",
            org: "other-org",
            data: { atis: "v1.pin" },
        },
    ]) {
        assert.equal(pickClientDataAtis({ "bi1-x": slot }, request), undefined)
    }
})

test("pickClientDataAtis: rejects a pin that is not printable ascii", () => {
    const slots = {
        "bi1-x": {
            at: 1,
            entrypoint: "cli",
            model: "claude-sonnet-5",
            org: ORG,
            data: { atis: "has a space" },
        },
    }
    assert.equal(
        pickClientDataAtis(slots, {
            entrypoint: "cli",
            model: "claude-sonnet-5",
            version: "2.1.277",
            organizationUuid: ORG,
        }),
        undefined,
    )
})

test("readClaudeClientAtis: reads the slot for the claimed identity", () => {
    const dir = mkdtempSync(join(tmpdir(), "pi-cc-atis-read-"))
    process.env.CLAUDE_CONFIG_DIR = dir
    resetClaudeConfigCache()
    const key = clientDataSlotKey("cli", "claude-sonnet-5", "2.1.277", ORG)
    writeFileSync(
        join(dir, ".claude.json"),
        JSON.stringify({
            oauthAccount: { organizationUuid: ORG },
            clientDataCacheSlots: {
                [key]: {
                    at: 1,
                    entrypoint: "cli",
                    model: "claude-sonnet-5",
                    org: ORG,
                    data: { atis: "v1.live.pin" },
                },
            },
        }),
    )
    assert.equal(
        readClaudeClientAtis({
            entrypoint: "cli",
            model: "claude-sonnet-5",
            version: "2.1.277",
        }),
        "v1.live.pin",
    )
})

test("readClaudeClientAtis: missing file or unknown slot is undefined", () => {
    const dir = mkdtempSync(join(tmpdir(), "pi-cc-atis-empty-"))
    process.env.CLAUDE_CONFIG_DIR = dir
    resetClaudeConfigCache()
    assert.equal(claudeConfigPath(), join(dir, ".claude.json"))
    assert.equal(
        readClaudeClientAtis({
            entrypoint: "cli",
            model: "claude-sonnet-5",
            version: "2.1.277",
            organizationUuid: ORG,
        }),
        undefined,
    )
})
