/**
 * Capture rig, pi half: redirect Anthropic traffic to the loopback capture
 * server and dump the exact wire request.
 *
 * Load it *before* the auth extension so the auth extension's fetch patch wraps
 * this one — otherwise the dump shows the body before the extension shaped it,
 * with `cch=00000` still in place and pi's own beta list.
 *
 *   pi --extension scripts/pi-capture-redirect.ts --extension src/index.ts \
 *      -ne -np -ns --print --model claude-sonnet-5 "Reply with exactly: OK"
 */
import { mkdirSync, writeFileSync, appendFileSync } from "node:fs"
import { join } from "node:path"

const OUT = process.env.CCFP_DIR ?? "/tmp/cc-capture/pi"
const TARGET = process.env.CCFP_TARGET ?? "http://127.0.0.1:8899"
mkdirSync(OUT, { recursive: true })

let n = 0
const original = globalThis.fetch.bind(globalThis)

globalThis.fetch = async (input, init) => {
    const url =
        typeof input === "string"
            ? input
            : input instanceof URL
              ? input.toString()
              : input.url
    const headers = new Headers(
        input instanceof Request ? input.headers : undefined,
    )
    for (const [k, v] of new Headers(init?.headers)) headers.set(k, v)
    const body =
        typeof init?.body === "string"
            ? init.body
            : input instanceof Request
              ? await input.clone().text()
              : undefined

    if (!url.includes("api.anthropic.com")) {
        return original(input as RequestInfo, init)
    }

    const id = String(n++).padStart(3, "0")
    const name = `pi-${id}.json`
    const rec: Record<string, unknown> = {
        id,
        url,
        method: init?.method ?? (input as Request).method ?? "POST",
        headers: Object.fromEntries(headers),
        body,
    }
    try {
        writeFileSync(join(OUT, name), JSON.stringify(rec, null, 2))
    } catch {
        /* ignore */
    }
    appendFileSync(
        join(OUT, "index.jsonl"),
        JSON.stringify({
            name,
            url,
            ua: headers.get("user-agent"),
            model: body ? (JSON.parse(body).model ?? null) : null,
            requestClass: headers.get("x-claude-code-request-class"),
        }) + "\n",
    )
    console.error(`[pi-capture] ${name} -> ${url}`)

    const rewritten = url.replace("https://api.anthropic.com", TARGET)
    if (typeof init?.body === "string") {
        return original(rewritten, { ...init, headers })
    }
    if (input instanceof Request) {
        return original(
            new Request(rewritten, {
                method: input.method,
                headers,
                body: input.body,
                duplex: "half",
            } as RequestInit),
        )
    }
    return original(rewritten, { ...init, headers })
}

export default function () {
    /* no pi hooks needed */
}
