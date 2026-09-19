import { createHash } from "node:crypto"
import { readFileSync, statSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"
import { log } from "./logger.ts"

/**
 * `x-cc-atis` — Claude Code's client-data pin.
 *
 * Anthropic hands the client a signed config snapshot and a pin for it; the
 * request echoes the pin back so the server can tell a stale client from a
 * current one. Claude Code caches one snapshot per
 * `(entrypoint, model, version, organization)` under
 * `~/.claude.json → clientDataCacheSlots`, keyed by
 * `bi1-<sha256(JSON.stringify([entrypoint, model, version, org]))[:16]>`
 * (recovered from the 2.1.277 bundle's `fRn`, and confirmed against live
 * captures: all 15 captured requests' headers equal the slot their own key
 * resolves to).
 *
 * Only the pin is replayed, never the snapshot: pi does not need Claude Code's
 * feature flags, and a pin is what native puts on the wire. The lookup is
 * deliberately exact — if pi claims a release Claude Code has not run yet, the
 * slot does not exist and no header is sent, which is what native does in the
 * same situation.
 */
const SLOT_PREFIX = "bi1-"

/** Printable ASCII only, matching Claude Code's own validation. */
const PRINTABLE = /^[\x21-\x7e]+$/

export interface ClientDataRequest {
    entrypoint?: string
    model?: string
    version?: string
    /** Defaults to the install's organization, read from `~/.claude.json`. */
    organizationUuid?: string
}

interface ClientDataSlot {
    at?: unknown
    entrypoint?: unknown
    model?: unknown
    org?: unknown
    data?: unknown
}

export function claudeConfigPath(): string {
    return join(process.env.CLAUDE_CONFIG_DIR || homedir(), ".claude.json")
}

/** Claude Code's slot key for one request shape. */
export function clientDataSlotKey(
    entrypoint: string | undefined,
    model: string,
    version: string,
    organizationUuid: string,
): string {
    const serialized = JSON.stringify([
        entrypoint ?? null,
        model,
        version,
        organizationUuid,
    ])
    return `${SLOT_PREFIX}${createHash("sha256").update(serialized).digest("hex").slice(0, 16)}`
}

function slotAtis(slot: unknown): string | undefined {
    if (!slot || typeof slot !== "object") return undefined
    const data = (slot as ClientDataSlot).data
    if (!data || typeof data !== "object") return undefined
    const atis = (data as { atis?: unknown }).atis
    return typeof atis === "string" && PRINTABLE.test(atis) ? atis : undefined
}

function slotsOf(config: unknown): Record<string, ClientDataSlot> | undefined {
    if (!config || typeof config !== "object") return undefined
    const slots = (config as { clientDataCacheSlots?: unknown })
        .clientDataCacheSlots
    if (!slots || typeof slots !== "object" || Array.isArray(slots)) {
        return undefined
    }
    return slots as Record<string, ClientDataSlot>
}

function organizationOf(config: unknown): string | undefined {
    if (!config || typeof config !== "object") return undefined
    const account = (config as { oauthAccount?: unknown }).oauthAccount
    if (!account || typeof account !== "object") return undefined
    const uuid = (account as { organizationUuid?: unknown }).organizationUuid
    return typeof uuid === "string" && uuid.length > 0 ? uuid : undefined
}

/**
 * Exact slot, then the newest slot for the same
 * `(entrypoint, model, organization)` with a different version.
 *
 * The fallback mirrors Claude Code's own "stale match" (`wK` in the 2.1.277
 * bundle): after a Claude Code update the new version's slot does not exist yet
 * and the client keeps sending the last pin it received until it refetches.
 */
export function pickClientDataAtis(
    slots: Record<string, ClientDataSlot>,
    request: ClientDataRequest & {
        model: string
        version: string
        organizationUuid: string
    },
): string | undefined {
    const exact =
        slots[
            clientDataSlotKey(
                request.entrypoint,
                request.model,
                request.version,
                request.organizationUuid,
            )
        ]
    const exactAtis = slotAtis(exact)
    if (exactAtis !== undefined) return exactAtis

    let newest: ClientDataSlot | undefined
    let newestAt = Number.NEGATIVE_INFINITY
    for (const slot of Object.values(slots)) {
        if (!slot || typeof slot !== "object") continue
        if ((slot.entrypoint ?? null) !== (request.entrypoint ?? null)) continue
        if (slot.model !== request.model) continue
        if (slot.org !== request.organizationUuid) continue
        const atis = slotAtis(slot)
        if (atis === undefined) continue
        const at = typeof slot.at === "number" ? slot.at : 0
        if (at > newestAt) {
            newestAt = at
            newest = slot
        }
    }
    return slotAtis(newest)
}

interface CacheEntry {
    key: string
    config: unknown
}

let cache: CacheEntry | undefined

/**
 * Re-read when the file's mtime or size moves, so a pin Claude Code refreshes
 * mid-session is picked up without re-parsing a multi-megabyte file per request.
 */
function readConfig(path: string): unknown {
    const stats = statSync(path)
    const key = `${stats.mtimeMs}:${stats.size}`
    if (cache && cache.key === key) return cache.config
    const config = JSON.parse(readFileSync(path, "utf8")) as unknown
    cache = { key, config }
    return config
}

/** Test seam: drop the parsed-config cache. */
export function resetClaudeConfigCache(): void {
    cache = undefined
}

export function readClaudeClientAtis(
    request: ClientDataRequest,
): string | undefined {
    const model = request.model
    const version = request.version
    if (model === undefined || version === undefined) return undefined
    const path = claudeConfigPath()
    let config: unknown
    try {
        config = readConfig(path)
    } catch (err) {
        log("claude_client_data_read_failed", {
            path,
            error: err instanceof Error ? err.message : String(err),
        })
        return undefined
    }
    const organizationUuid = request.organizationUuid ?? organizationOf(config)
    if (organizationUuid === undefined) return undefined

    const slots = slotsOf(config)
    if (slots === undefined) return undefined
    return pickClientDataAtis(slots, {
        entrypoint: request.entrypoint,
        model,
        version,
        organizationUuid,
    })
}
