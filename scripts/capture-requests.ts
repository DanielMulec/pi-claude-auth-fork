#!/usr/bin/env node
/**
 * Loopback capture server — the first half of the capture rig.
 *
 * Answers `POST /v1/messages` with a minimal, well-formed SSE stream and writes
 * every request it sees to disk, so the *real* Claude Code binary or pi can be
 * fingerprinted without sending anything to Anthropic.
 *
 * Usage:
 *   node --experimental-strip-types scripts/capture-requests.ts [--port 8899] \
 *       [--out /tmp/cc-capture] [--tool Read] [--tool-turns 1]
 *
 * `--tool` answers the first `--tool-turns` requests with a `tool_use` block
 * instead of text, which makes the client run the tool and send a follow-up
 * request. That second request is where `cc_prev_req` (and the mid-conversation
 * system message) appear.
 *
 * Then point a client at it:
 *
 *   # Real Claude Code, interactive (the shape this fork reproduces):
 *   ANTHROPIC_BASE_URL=http://127.0.0.1:8899 \
 *   _CLAUDE_CODE_ASSUME_FIRST_PARTY_BASE_URL=1 \
 *       python3 scripts/drive-claude-interactive.py --model claude-sonnet-5
 *
 *   # Real Claude Code, non-interactive (`cc_entrypoint=sdk-cli`, for contrast):
 *   ANTHROPIC_BASE_URL=http://127.0.0.1:8899 \
 *   _CLAUDE_CODE_ASSUME_FIRST_PARTY_BASE_URL=1 \
 *       claude -p --model claude-sonnet-5 "Reply with exactly: OK"
 *
 *   # Pi through this extension:
 *   CCFP_DIR=/tmp/cc-capture/pi \
 *   pi --extension scripts/pi-capture-redirect.ts --extension src/index.ts \
 *      -ne -np -ns --print --model claude-sonnet-5 "Reply with exactly: OK"
 *
 * `_CLAUDE_CODE_ASSUME_FIRST_PARTY_BASE_URL` keeps Claude Code's first-party
 * `cch` and identity gates open against a non-Anthropic host; without it the
 * captured request is a stripped third-party shape and proves nothing.
 *
 * Whatever was captured is verified with:
 *   node --experimental-strip-types scripts/verify-fingerprint.ts <out>
 */
import { createServer, type ServerResponse } from "node:http"
import { appendFileSync, mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"

const argv = process.argv.slice(2)

function flag(name: string, fallback: string): string {
    const at = argv.indexOf(name)
    return at >= 0 && argv[at + 1] !== undefined ? argv[at + 1] : fallback
}

const OUT = flag("--out", "/tmp/cc-capture")
const PORT = Number(flag("--port", "8899"))
const TOOL = flag("--tool", "")
const TOOL_TURNS = Number(flag("--tool-turns", "1"))

mkdirSync(OUT, { recursive: true })

let counter = 0
let toolTurnsUsed = 0

function toolInput(tool: string): Record<string, unknown> {
    if (tool === "Bash") return { command: "true", description: "noop" }
    return { file_path: "/tmp/cc-capture-probe.txt" }
}

function stream(res: ServerResponse, model: string): void {
    // Echoed by the client as `cc_prev_req` on the next turn; Claude Code only
    // replays values that match `^req_[A-Za-z0-9_-]{1,36}$`.
    const requestId = `req_capture_${String(++counter).padStart(4, "0")}`
    const useTool = TOOL !== "" && toolTurnsUsed < TOOL_TURNS
    if (useTool) toolTurnsUsed++

    res.writeHead(200, {
        "content-type": "text/event-stream",
        "cache-control": "no-cache",
        connection: "keep-alive",
        "request-id": requestId,
        "anthropic-ratelimit-unified-status": "allowed",
        "anthropic-ratelimit-unified-overage-status": "allowed",
        "anthropic-ratelimit-unified-overage-utilization": "0.0",
        "anthropic-ratelimit-unified-5h-utilization": "0.01",
        "anthropic-ratelimit-unified-7d-utilization": "0.01",
    })

    const first = {
        type: "content_block_start",
        index: 0,
        content_block: useTool
            ? {
                  type: "tool_use",
                  id: "toolu_capture_0001",
                  name: TOOL,
                  input: {},
              }
            : { type: "text", text: "" },
    }
    const delta = useTool
        ? {
              type: "content_block_delta",
              index: 0,
              delta: {
                  type: "input_json_delta",
                  partial_json: JSON.stringify(toolInput(TOOL)),
              },
          }
        : {
              type: "content_block_delta",
              index: 0,
              delta: { type: "text_delta", text: "OK" },
          }

    const events: Array<[string, unknown]> = [
        [
            "message_start",
            {
                type: "message_start",
                message: {
                    id: `msg_capture_${counter}`,
                    type: "message",
                    role: "assistant",
                    model,
                    content: [],
                    stop_reason: null,
                    stop_sequence: null,
                    usage: { input_tokens: 1, output_tokens: 1 },
                },
            },
        ],
        ["content_block_start", first],
        ["content_block_delta", delta],
        ["content_block_stop", { type: "content_block_stop", index: 0 }],
        [
            "message_delta",
            {
                type: "message_delta",
                delta: {
                    stop_reason: useTool ? "tool_use" : "end_turn",
                    stop_sequence: null,
                },
                usage: { output_tokens: 1 },
            },
        ],
        ["message_stop", { type: "message_stop" }],
    ]
    for (const [event, payload] of events) {
        res.write(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`)
    }
    res.end()
}

const server = createServer((req, res) => {
    const chunks: Buffer[] = []
    req.on("data", (chunk: Buffer) => chunks.push(chunk))
    req.on("end", () => {
        const raw = Buffer.concat(chunks).toString("utf8")
        const path = req.url ?? "/"
        let body: unknown
        try {
            body = raw ? JSON.parse(raw) : undefined
        } catch {
            body = undefined
        }
        const model = (body as { model?: string } | undefined)?.model
        const id = String(counter).padStart(3, "0")
        const name = `${id}-${(model ?? "unknown").replace(/[^\w.-]/g, "_")}.json`
        writeFileSync(
            join(OUT, name),
            JSON.stringify(
                {
                    id,
                    method: req.method,
                    path,
                    headers: req.headers,
                    body,
                    bodyRaw: body === undefined && raw ? raw : undefined,
                },
                null,
                2,
            ),
        )
        appendFileSync(
            join(OUT, "index.jsonl"),
            `${JSON.stringify({
                name,
                path,
                model,
                userAgent: req.headers["user-agent"],
            })}\n`,
        )
        console.error(`[capture] ${name} ${req.method} ${path}`)

        if (!path.includes("/v1/messages")) {
            res.writeHead(200, { "content-type": "application/json" })
            res.end("{}")
            return
        }
        stream(res, model ?? "claude-sonnet-5")
    })
})

server.listen(PORT, "127.0.0.1", () => {
    console.error(`[capture] http://127.0.0.1:${PORT} -> ${OUT}`)
    if (TOOL !== "") {
        console.error(
            `[capture] first ${TOOL_TURNS} message(s) answer with a ${TOOL} tool_use`,
        )
    }
})
