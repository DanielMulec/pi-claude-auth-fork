import assert from "node:assert/strict"
import { mkdirSync, mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, test } from "node:test"
import {
    FALLBACK_CC_VERSION,
    installedClaudeCodeVersion,
    pickNewestVersion,
    resetVersionWarning,
    resolveClaudeCodeVersion,
} from "./claude-version.ts"

const prevOverride = process.env.ANTHROPIC_CLI_VERSION

afterEach(() => {
    if (prevOverride === undefined) delete process.env.ANTHROPIC_CLI_VERSION
    else process.env.ANTHROPIC_CLI_VERSION = prevOverride
    resetVersionWarning()
})

function withReleases(names: string[], fn: (dir: string) => void): void {
    const dir = mkdtempSync(join(tmpdir(), "cc-versions-"))
    try {
        for (const name of names) mkdirSync(join(dir, name))
        fn(dir)
    } finally {
        rmSync(dir, { recursive: true, force: true })
    }
}

test("pickNewestVersion: numeric order, not lexicographic", () => {
    // String comparison would rank "2.1.9" above "2.1.10".
    assert.equal(pickNewestVersion(["2.1.9", "2.1.10"]), "2.1.10")
    assert.equal(pickNewestVersion(["2.1.270", "2.1.268", "2.1.99"]), "2.1.270")
    assert.equal(pickNewestVersion(["2.10.0", "2.9.9"]), "2.10.0")
})

test("pickNewestVersion: ignores names that are not releases", () => {
    assert.equal(
        pickNewestVersion([
            "nightly",
            "2.1",
            "2.1.270.bak",
            "v2.1.271",
            ".DS_Store",
        ]),
        undefined,
    )
    assert.equal(pickNewestVersion(["junk", "2.1.270"]), "2.1.270")
})

test("pickNewestVersion: empty input", () => {
    assert.equal(pickNewestVersion([]), undefined)
    assert.equal(pickNewestVersion(["2.1.270"]), "2.1.270")
})

test("installedClaudeCodeVersion: newest installed release", () => {
    withReleases(["2.1.267", "2.1.268", "2.1.270"], (dir) => {
        assert.equal(installedClaudeCodeVersion(dir), "2.1.270")
    })
})

test("installedClaudeCodeVersion: missing directory is undefined", () => {
    assert.equal(
        installedClaudeCodeVersion("/nonexistent/claude/versions"),
        undefined,
    )
})

test("resolveClaudeCodeVersion: installed release is used as-is", () => {
    delete process.env.ANTHROPIC_CLI_VERSION
    withReleases(["2.1.270"], (dir) => {
        assert.deepEqual(resolveClaudeCodeVersion(dir), {
            version: "2.1.270",
            source: "installed",
            detail: dir,
        })
    })
})

test("resolveClaudeCodeVersion: ANTHROPIC_CLI_VERSION wins over disk", () => {
    process.env.ANTHROPIC_CLI_VERSION = "9.9.9"
    withReleases(["2.1.270"], (dir) => {
        assert.deepEqual(resolveClaudeCodeVersion(dir), {
            version: "9.9.9",
            source: "override",
        })
    })
})

test("resolveClaudeCodeVersion: falls back when nothing is installed", () => {
    delete process.env.ANTHROPIC_CLI_VERSION
    assert.deepEqual(resolveClaudeCodeVersion("/nonexistent/claude/versions"), {
        version: FALLBACK_CC_VERSION,
        source: "fallback",
    })
})
