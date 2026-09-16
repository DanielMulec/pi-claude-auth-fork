import { readdirSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"
import { log } from "./logger.ts"

/**
 * Last Claude Code release this fork's fingerprint was verified against.
 *
 * A fallback, not a pin: the version is normally read from the Claude Code
 * installation on this machine (see `resolveClaudeCodeVersion`). This constant
 * only covers a machine with no Claude Code installed, so the extension can
 * still emit a well-formed billing header instead of failing outright. Using it
 * costs accuracy, so it is announced on stderr the first time.
 */
export const FALLBACK_CC_VERSION = "2.1.273"

/** Claude Code release directories are named bare `x.y.z`. */
const RELEASE_NAME = /^\d+\.\d+\.\d+$/u

export type VersionSource = "override" | "installed" | "fallback"

export interface ResolvedVersion {
    version: string
    source: VersionSource
    /** Where the version came from, for diagnostics. */
    detail?: string
}

/** Where Claude Code's installer keeps its releases, newest last. */
export function claudeVersionsDir(): string {
    return join(homedir(), ".local", "share", "claude", "versions")
}

/**
 * Newest release among candidate names, or undefined when none is a release.
 *
 * Compared numerically, not as strings: `2.1.10` is newer than `2.1.9`, and
 * lexicographic comparison gets that backwards.
 */
export function pickNewestVersion(names: string[]): string | undefined {
    let newest: string | undefined
    for (const name of names) {
        if (!RELEASE_NAME.test(name)) continue
        if (newest === undefined || compareVersions(name, newest) > 0) {
            newest = name
        }
    }
    return newest
}

function compareVersions(left: string, right: string): number {
    const a = left.split(".").map(Number)
    const b = right.split(".").map(Number)
    for (let i = 0; i < 3; i++) {
        const delta = (a[i] ?? 0) - (b[i] ?? 0)
        if (delta !== 0) return delta
    }
    return 0
}

/**
 * Newest Claude Code release installed here, or undefined when there is no
 * installation to read.
 */
export function installedClaudeCodeVersion(
    dir: string = claudeVersionsDir(),
): string | undefined {
    try {
        return pickNewestVersion(readdirSync(dir))
    } catch (err) {
        log("claude_version_read_failed", {
            dir,
            error: err instanceof Error ? err.message : String(err),
        })
        return undefined
    }
}

let fallbackAnnounced = false

/**
 * The Claude Code version this process should claim to be.
 *
 * Resolved per call rather than cached for the process lifetime: a Claude Code
 * update mid-session is then reflected by the very next request, and the lookup
 * is a single directory read. `ANTHROPIC_CLI_VERSION` remains an explicit
 * escape hatch and wins over anything found on disk.
 */
export function resolveClaudeCodeVersion(
    dir: string = claudeVersionsDir(),
): ResolvedVersion {
    const override = process.env.ANTHROPIC_CLI_VERSION
    if (override) {
        return { version: override, source: "override" }
    }

    const installed = installedClaudeCodeVersion(dir)
    if (installed) {
        return { version: installed, source: "installed", detail: dir }
    }

    announceFallback()
    return { version: FALLBACK_CC_VERSION, source: "fallback" }
}

/**
 * Say it once per process. Repeating this on every request would be noise;
 * staying silent would let a stale version go unnoticed, which is the failure
 * this module exists to remove.
 */
function announceFallback(): void {
    if (fallbackAnnounced) return
    fallbackAnnounced = true
    log("claude_version_fallback", { version: FALLBACK_CC_VERSION })
    console.warn(
        `pi-claude-auth: no Claude Code installation found in ${claudeVersionsDir()}; ` +
            `claiming version ${FALLBACK_CC_VERSION}. ` +
            `Set ANTHROPIC_CLI_VERSION to override.`,
    )
}

/** Test seam: re-arm the once-per-process fallback warning. */
export function resetVersionWarning(): void {
    fallbackAnnounced = false
}
