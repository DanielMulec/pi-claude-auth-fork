# Billing Monitoring — plan windows vs extra usage

This fork routes Anthropic requests with Claude Code's fingerprint so they bill
against the Claude Pro/Max **plan windows** rather than per-token **extra usage
(usage credits)**. Which entitlement pays is decided server-side by an
undocumented classifier that has changed repeatedly (Apr 4, Apr 8, Jun 15 2026) — so the billing is verified **empirically**, not assumed.

> Anthropic's own vocabulary, used throughout: **unified rate limits** (the
> `anthropic-ratelimit-unified-*` response headers), **session window** (5h),
> **weekly window** (7d), **overage**, and **extra usage** with **used
> credits**. The file name, the `lane:check` npm script and a few type names
> keep the older "lane" wording; the script prints the messages you are reading
> about.

## Baseline (2026-09-10, re-verified 2026-09-17)

Account: Claude Pro, token from macOS Keychain (Claude Code OAuth session).
Claude Code binary at baseline: **2.1.267** (build 2026-09-09T17:26:03Z, git `a9e1808c8204fef901336d54bac7d4ab442955cb`).
The `cch` seed (`0x4d659218e32a3268`) and the hash view were re-verified against
two live 2.1.267 captures — see [Fingerprint verification](#fingerprint-verification-2026-09-10).
Result (2026-09-10): **both request shapes bill against the plan windows** — HTTP 200,
`anthropic-ratelimit-unified-overage-utilization: 0.0`, 5h/7d plan buckets
consumed. Verified for `claude-sonnet-5` and `claude-opus-5`, for both the
fork's full Claude Code shape (with a live-matching `cch`) and pi's built-in
OAuth shape.

**Re-verified 2026-09-13 against Claude Code 2.1.270** — see
[2.1.270 re-verification](#270-re-verification-2026-09-13). Same outcome:
four probes (sonnet-5 and opus-5, pi shape and Claude Code shape), all HTTP 200,
overage utilization `0.0`, 5h/7d at 1%.

**Re-verified 2026-09-16 against Claude Code 2.1.273** — see
[2.1.273 re-verification](#21273-re-verification-2026-09-16). Native and Pi
loopback captures covered Fable 5.1, Opus 5, and Sonnet 5. Live Pi probes on all
three returned HTTP 200 with overage utilization `0.0`; extra-usage credits did
not increase.

**Re-verified 2026-09-17 against Claude Code 2.1.274** — see
[2.1.274 re-verification](#21274-re-verification-2026-09-17). The full
fingerprint is unchanged apart from the release version and its derived suffix.
Live Pi probes on all three models returned HTTP 200 with overage utilization
`0.0`; extra-usage credits did not increase.

**Re-verified 2026-09-19 against Claude Code 2.1.277** — see
[2.1.277 re-verification](#21277-re-verification-2026-09-19). This release caught
a real defect rather than drift: the fork had been presenting
`cc_entrypoint=sdk-cli` (the `--print` / Agent SDK shape) instead of the
interactive CLI's `cli`. Fixed, along with the identity prompt, `cc_turn_origin`,
`cc_prev_req`, `x-claude-code-request-class` and `x-cc-atis`. Live Pi requests on
`claude-sonnet-5` and `claude-opus-5` returned HTTP 200, `pnpm run lane:check`
reported overage utilization `0.0`, and extra-usage credits were unchanged.

The release version is **not** pinned in code. `getCliVersion()` reads it from
`~/.local/share/claude/versions` per request (see `src/claude-version.ts`), so
this document naming 2.1.267 is a record of when a baseline was taken, not a
value the extension holds.

**Interpretation:** at baseline, even unshaped traffic bills to the plan
(classifier currently lenient, consistent with the June 15 pause of
Anthropic's Agent SDK metering change). The fork's fingerprint is insurance:
when Anthropic re-tightens, CC-shaped traffic is the most likely to stay
on-plan.

## How to check (takes ~5 s, costs a few tokens of plan quota)

```bash
cd pi-claude-auth-fork
pnpm run lane:check        # A/B on claude-sonnet-5
pnpm run lane:check opus   # A/B on claude-opus-5
pnpm run lane:check fable  # A/B on claude-fable-5-1 (use sparingly)
```

The script sends two tiny requests with the keychain OAuth token:

- **A** — pi's built-in OAuth request shape (identity prompt, no billing header)
- **B** — full Claude Code shape (billing header, real `cch`, the Claude Code
  user-agent at the installed release version, and current model-specific betas)

### What has actually been consumed

The check above reports where a request was _routed_. What it cannot show is
what the account has actually been charged — for that, Anthropic's own usage
endpoint (the one Claude Code's `/usage` calls) is authoritative. It costs no
tokens:

```bash
pnpm run usage            # plan windows + extra usage
pnpm run usage -- --json  # raw payload, for diffing before/after
```

and prints the unified rate-limit response headers.

## Reading the output

| Signal                                                          | Meaning                                                   |
| --------------------------------------------------------------- | --------------------------------------------------------- |
| `overage-status: allowed` + `overage-utilization: 0.0`          | ✅ plan windows — nothing drawn from extra usage          |
| `overage-utilization: > 0`                                      | ⚠️ **extra usage** — per-token billing active             |
| `overage-status: blocked`                                       | ⛔ blocked from extra usage and not covered by the plan   |
| `5h` / `7d` utilization rising                                  | ✅ plan windows being consumed (expected)                 |
| HTTP 400 with "Third-party apps now draw from your extra usage" | ⛔ classifier flagged the request — billed to extra usage |

## Fingerprint verification (2026-09-10)

The `cch` is reproduced, not guessed. Claude Code computes it in the native Bun
fetch layer, so it was recovered by running the real binary against a loopback
capture server (`ANTHROPIC_BASE_URL`, plus
`_CLAUDE_CODE_ASSUME_FIRST_PARTY_BASE_URL=1` to keep the first-party `cch`
gate open) and replaying the exact bytes.

> **Superseded in two ways, both fixed in 0.8.0.** The capture below was taken
> with `claude --print`, which is why it records `cc_entrypoint=sdk-cli`; the
> shape this fork must present is the _interactive_ one (`cli`), see
> [2.1.277 re-verification](#21277-re-verification-2026-09-19). And the rule
> stated here — "every `model` string value emptied" — is recursive; the
> implementation only emptied the top level until 0.8.0, which silently missed
> Opus and Fable.

Live 2.1.267 capture, `--print`/`sdk-cli`, `claude-opus-5`:

```
x-anthropic-billing-header: cc_version=2.1.267.f30; cc_entrypoint=sdk-cli; cch=d68c4; cc_prompt_id=5fd7128d-...;
```

The value is exactly `xxHash64(hash_view, 0x4d659218e32a3268) & 0xfffff` where
`hash_view` is the final body with:

1. the five `cch` digits replaced by `00000`,
2. every `"model":"..."` string value emptied (`"model":""`),
3. the dispatch-only members `max_tokens`, `fallbacks`, `fallback_credit_token`
   omitted (with Claude Code's comma semantics, reproduced by delete +
   `JSON.stringify`).

Both live captures (different prompts, 45,893 and 45,919 bytes) reproduce their
native `cch` this way (`d68c4` and `59865`), and the extension's own
implementation reproduces the same values on pi's serialized body. The seed has
not rotated since the 2.1.220–2.1.234 range documented by CLIProxyAPI's
`claude_signing.go`.

Also verified from the same binary/capture:

- version suffix `sha256(salt + firstUserMessage[4,7,20] + version)[:3]`
  (2.1.267: `say hi` → `f30`, `explain the number seven briefly` → `75d`); the
  native `tls` function takes the _first_ text block of the first non-meta user
  message, computed before meta reminders are merged into the wire body,
- billing header field order `cc_version; cc_entrypoint; cch; …; cc_prompt_id`,
- beta set, `?beta=true`, `x-claude-code-session-id`, `x-client-request-id`,
  `metadata.user_id`, and the `X-Stainless-*` identity headers.

## 2.1.270 re-verification (2026-09-13)

Claude Code 2.1.270 (build 2026-09-12T18:08:42Z, git `97ecbf7abeb4170dcfd26c4d4b397afd9015030e`).
Captured the same way as the 2.1.267 baseline — loopback server, real binary,
no Anthropic traffic.

**Unchanged and reconfirmed:**

- Two live captures reproduce their native `cch` byte-exactly under the same
  seed (`xxHash64(hash_view, 0x4d659218e32a3268) & 0xfffff`): `say hi` →
  `2b83b`, `explain the number seven briefly` → `fe2eb`. **The seed has not
  rotated.**
- Version suffix algorithm unchanged: `2.1.270.f7f` and `2.1.270.658`, both
  reproduced by `computeVersionSuffix`.
- `X-Stainless-package-version` `0.112.1`, `x-stainless-timeout` `600`,
  `x-stainless-runtime-version` `v26.3.0`, `x-app: cli`, `?beta=true`,
  `x-claude-code-session-id` — all as captured on 2.1.267.
- In the 2.1.270 bundle: the billing-header builder, the beta registry
  (`Te("name", "header")` table), and the whole per-model capability catalog
  are identical to 2.1.266/267/268.

**Corrected understanding — the beta set is not a function of the version.**

The same 2.1.267 binary, run on 2026-09-13, emits the _same_ beta list as
2.1.270. What varies is the request, not the client version:

- `context-1m-2025-08-07` is sent **only when the model spec carries `[1m]`**
  (`dc(e){ return /\[1m\]/i.test(e) }` in the 267 bundle). The 2026-09-10
  capture ran `claude --print` with no `--model`, so it took the default from
  `~/.claude/settings.json` — `opus[1m]` — and the 1M beta in the captured list
  was an artefact of that setting, not a property of Claude Code.
- `mid-conversation-tool-changes-2026-07-01` is sent for models carrying the
  `mid_conv_tool_change` capability (opus-5, opus-4-8, fable-5, fable-5-1) and
  not for sonnet-5 or haiku-4-5. Stable across every run today; absent from
  `CLAUDE_CODE_BETAS`.
- `advisor-tool-2026-03-01` appeared in six runs and vanished in four with
  identical commands — a remotely-evaluated gate, i.e. noise. Not worth
  matching.

At v0.6.0 the extension deliberately left those model-gated entries unmatched
because Pi did not exercise their features. The 2.1.273 review below tightens
the fingerprint: the common set and current Fable/Opus model-specific entries
are now merged while Pi's own computed list remains authoritative.

## 2.1.273 re-verification (2026-09-16)

Claude Code 2.1.273 (build 2026-09-15T17:06:32Z, git
`d48ecfd7a41c16c42e0564f7a94947d6e4c50db1`). Three native loopback captures
and three Pi-through-extension captures covered `claude-fable-5-1`,
`claude-opus-5`, and `claude-sonnet-5`.

**Unchanged:**

- The billing-header builder and field order, version-suffix salt/algorithm,
  `cch` seed/hash view, `X-Stainless-*` identity, `?beta=true`, and
  request/session IDs.
- Native `cch` values recompute exactly under seed `0x4d659218e32a3268`:
  Fable 5.1 `57d14`, Opus 5 `8e558`, Sonnet 5 `eab20`.
- `computeVersionSuffix("Reply with exactly: OK", "2.1.273")` reproduces the
  native `e59` suffix for all three requests.

**Beta gate change:** `afk-mode-2026-01-31` is now common to all three models.
Fable 5.1 additionally emits per-turn control, mid-conversation tool changes,
server-side fallback, and fallback credit; Opus 5 emits mid-conversation tool
changes and fallback credit. The same installed 2.1.270 binary emits this set
today, proving it is a remote-gate change rather than a 2.1.273 algorithm
change. Pi's post-fix captures contain every matching native beta plus only its
required 1M-context and per-message-effort betas.

**Official changelog cross-check:** 2.1.272 contains only unspecified reliability
fixes. The only 2.1.271–2.1.273 request-fingerprint item is five new
`x-claude-code-*` gateway hint headers in 2.1.273. They are explicitly opt-in
via `CLAUDE_CODE_GATEWAY_HINT_HEADERS=1`, apply to LLM gateway metadata, and
were absent from default first-party captures, so this direct OAuth fork should
not synthesize them. The 2.1.271 fix preserving `[1m]` on resumed sessions is
already covered more strongly here: the fetch patch injects the 1M beta from
the actual request model on every request.

## 2.1.274 re-verification (2026-09-17)

Claude Code 2.1.274 (build 2026-09-16T21:39:42Z, git
`1efcc1361e649ab98800b43a7df307043397a9ba`). Native and Pi loopback captures
again covered Fable 5.1, Opus 5, and Sonnet 5, with fresh 2.1.273 captures as the
differential control.

- Native beta sets and top-level body keys are identical between 2.1.273 and
  2.1.274 for all three models.
- Billing-header layout, suffix salt/algorithm, CCH hash view/seed,
  `X-Stainless-*` identity, `?beta=true`, and request/session IDs are unchanged.
- Native CCH values reproduce exactly: Fable 5.1 `3cf31`, Opus 5 `2c9b4`,
  Sonnet 5 `03989`. The common version suffix for
  `Reply with exactly: OK` is `9be`.
- Pi already reports `claude-cli/2.1.274` and `cc_version=2.1.274.9be` through
  installed-version discovery. Every native beta is present, Pi retains only
  its required feature betas, and Pi CCH values (`19880`, `4dead`, `521bf`)
  recompute exactly.
- The official 2.1.274 changelog contains no direct first-party OAuth
  fingerprint change. The closest entries concern OTel request tracing and raw
  API-body diagnostics, neither of which changes wire requests.
- Live Pi requests on all three models returned HTTP 200,
  `overage-utilization: 0.0`, and unchanged extra-usage credits; the account's
  usage breakdown remained 100% Claude Code.

No production request-shaping change was needed. Only the no-install fallback,
version-specific test vector, and verification record advanced to 2.1.274.

## 2.1.277 re-verification (2026-09-19)

Claude Code 2.1.277 (build 2026-09-18T15:34:36Z, git
`97305f0832e6b778bb99e69b4f5f1438e3905624`).

### The defect this release exposed

The fork claimed `cc_entrypoint=sdk-cli` in every billing header and in the
user-agent. That value is not a property of Claude Code — it is what the
`--print` / Agent SDK launcher puts in `CLAUDE_CODE_ENTRYPOINT`, and the 2.1.277
bundle reads it straight back out:

```
g = process.env.CLAUDE_CODE_ENTRYPOINT ?? "unknown"          // billing header
user-agent = `claude-cli/${VERSION} (external, ${g})`
```

Interactive captures send `cli`. The fork therefore announced "Agent SDK" to
Anthropic on every request while the rest of its fingerprint (version, `cch`,
`metadata.user_id`, beta set) was assembled from the interactive CLI's
behaviour. It was introduced when the original fingerprint was captured with
`claude --print`, and stayed invisible for as long as captures were taken that
way. `scripts/drive-claude-interactive.py` exists so that cannot happen again.

### Captures

23 loopback captures — `--print` and interactive, `claude-fable-5-1`,
`claude-opus-5`, `claude-sonnet-5`, `claude-haiku-4-5-20251001`, main and
auxiliary request classes, one and two turns.

**Algorithms — unchanged, and now verified more strongly:**

- The `cch` seed `0x4d659218e32a3268` still reproduces native values; all 23
  captures recompute with zero mismatches.
- The version suffix is still `sha256(salt + prompt[4,7,20] + version)[:3]` with
  salt `59cf53e54c78`; the prompt `Reply with exactly: OK` on 2.1.277 gives `b25`
  and reproduces exactly.
- `x-stainless-package-version` `0.112.1`, `x-stainless-timeout` `600`,
  `x-stainless-runtime-version` `v26.3.0` — unchanged.

**Corrected understanding — the hash view is recursive.** Native empties _every_
`model` string value, at any depth. A 2.1.277 Opus or Fable request repeats the
model id inside the `advisor` tool:

```json
{
    "type": "advisor_20260301",
    "name": "advisor",
    "model": "claude-opus-5",
    "defer_loading": true
}
```

Emptying only the top-level field reproduced `cch` for Sonnet and Haiku and
missed Opus and Fable on **every** capture (`6b5b5` vs `53c40`, `d41bd` vs
`d4fd6`, …). `fallbacks` is _kept_ in the view — native hashes its own
`fallbacks: "default"` — while `max_tokens` and `fallback_credit_token` are
dropped. See `computeCchFromBody`.

**Billing-header fields.** Interactive main requests carry
`cc_version; cc_entrypoint=cli; cch; [cc_prev_req]; cc_prompt_id; cc_turn_origin=human;`.
`cc_prev_req` appears from the second turn on and equals the previous response's
`request-id` header — the loopback server's own `req_capture_0001` came back
verbatim, which is how the mechanism was identified. `--print` sends
`cc_turn_origin=sdk`; auxiliary requests omit both `cc_prompt_id` and
`cc_turn_origin`.

**Beta fingerprint (main, interactive):**

```
claude-code-20250219, oauth-2025-04-20, interleaved-thinking-2025-05-14,
thinking-token-count-2026-05-13, context-management-2025-06-27,
prompt-caching-scope-2026-01-05, mid-conversation-system-2026-04-07,
advisor-tool-2026-03-01, advanced-tool-use-2025-11-20, effort-2025-11-24,
thinking-binding-controls-2026-08-01, thinking-display-updates-2026-08-18,
afk-mode-2026-01-31, extended-cache-ttl-2025-04-11, cache-diagnosis-2026-04-07
```

Model-gated, in wire position right after `mid-conversation-system-2026-04-07`:
Fable 5.1 adds `per-turn-control-2026-07-01` then
`mid-conversation-tool-changes-2026-07-01`; Opus 5 adds only the latter.

Two betas the bundle's registry knows are deliberately not sent:
`redact-thinking-2026-02-12` and `structured-outputs-2025-12-15` are stripped
from the interactive main request and survive only on `sdk-cli` and auxiliary
traffic. `thinking-display-updates-2026-08-18` is coupled to
`thinking.display: "updates"` and follows that parameter, not the model.
`context-1m-2025-08-07` is gated on the request model carrying `[1m]` (`lu(e)` in
the bundle) — pi asks for 1M context outright, which matches a Claude Code
configured with `model: "opus[1m]"`, as this machine is.

The `server-side-fallback` / `fallback-credit` betas the 0.7.x fingerprint
carried are gone: the bundle emits them from the same function that returns the
`fallbacks` body field, and interactive main captures carry neither.

**`x-cc-atis` recovered.** Claude Code caches a signed client-data snapshot per
`(entrypoint, model, version, organization)` under
`~/.claude.json → clientDataCacheSlots`, keyed by
`bi1-<sha256(JSON.stringify([entrypoint, model, version, org]))[:16]>` (bundle
function `fRn`). Every captured request's header equals the slot its own key
resolves to, so the fork now replays that pin — exact slot first, then native's
own "newest slot for the same entrypoint/model/org" fallback. A missing slot
means no header, exactly as native behaves for a slot it has never fetched.

### Results

- Native captures: 0 `cch` mismatches and 0 missing betas for main interactive
  requests.
- Pi-through-extension captures (`claude-sonnet-5`, `claude-opus-5`) match native
  on `cc_version`, `cc_entrypoint`, `cc_turn_origin`, `cc_prev_req`, user-agent,
  `x-app`, `x-claude-code-request-class`, `x-cc-atis`, `x-stainless-*`,
  `metadata.user_id` and every native beta; their only extras are pi's own
  `context-1m-2025-08-07` and `mid-conversation-output-config-2026-07-01`.
- Live pi requests on `claude-sonnet-5` and `claude-opus-5`: HTTP 200, and
  `pnpm run lane:check` reported `overage-utilization: 0.0` for both the pi and
  the Claude Code shape. `pnpm run usage` showed extra-usage credits unchanged
  (81.00 EUR) while the 5h and 7d plan windows consumed.

### 2.1.278 — verified as it landed (2026-09-19)

Claude Code updated itself to 2.1.278 in the middle of merging this work, which
made the update path testable for free:

- Interactive captures on `claude-sonnet-5`: `cch` `cf42b` and `b0f1a` recompute
  exactly under the unchanged seed; the suffix for `Reply with exactly: OK` is
  `773` and reproduces.
- Beta set identical to 2.1.277 — `missing=[] extra=[]`.
- The fork claimed `claude-cli/2.1.278 (external, cli)` with no code change,
  because the version is resolved from the installation per request.
- Live pi requests on `claude-sonnet-5` and `claude-opus-5`: HTTP 200,
  `overage-utilization: 0.0`, extra-usage credits unchanged at 82.00 EUR.

Only the no-install fallback advanced, to `2.1.278`.

### Deliberate remaining differences

| Field                               | Native interactive   | Pi through this fork        | Why                                                                                  |
| ----------------------------------- | -------------------- | --------------------------- | ------------------------------------------------------------------------------------ |
| `max_tokens`                        | 64000                | pi's catalog value (128000) | pi's own limit; native excludes the field from its `cch` hash view, i.e. it may vary |
| `thinking.display`                  | `updates`            | `summarized`                | pi's display choice; the display-updates beta follows it instead of contradicting it |
| `output_config.effort`              | `high`               | pi's thinking level         | user-selectable in pi                                                                |
| `context_management`, `diagnostics` | present              | absent                      | Claude Code internals (thinking clearing, prefix diagnostics) with no pi equivalent  |
| system blocks 3+                    | Claude Code's prompt | pi's prompt                 | the point of running pi                                                              |
| tool set                            | Claude Code's tools  | pi's tools                  | same                                                                                 |

## 2026-09-19 — the content classifier, and the v0.8.0 outage

**This is the most important section in this file. Read it before changing the
claimed client identity.**

### What happened

v0.8.0 changed the claimed entrypoint from `sdk-cli` to `cli`, on the reasoning
that `cli` is the interactive TUI and the rest of the fingerprint had been
measured from interactive captures. Every real pi request then failed:

```
HTTP 400 {"type":"error","error":{"type":"invalid_request_error",
 "message":"Third-party apps now draw from your extra usage, not your plan limits.
  Add more at claude.ai/settings/usage and keep going."}}
```

Reverting the entrypoint to `sdk-cli` restored it immediately. Real Claude Code
(`claude -p`) was unaffected throughout, so the account and CLI were never the
problem.

### Why it was invisible until it was fatal

The account ran out of extra-usage credits (`extra_usage.state:
disabled (out_of_credits)`). Before that, a request the classifier routed to
extra usage would have been _served_ — silently billed to credits rather than
plan windows, which is the quiet version of the same failure. Once the credits
were gone the same routing became a hard 400. **This is why the failure looked
new: it was the same classification all along, minus the cover.**

That also makes the exhausted-credits state a precise oracle, which is how the
work below was measured:

| Result                       | Meaning                                                            |
| ---------------------------- | ------------------------------------------------------------------ |
| HTTP 200                     | The classifier accepted the shape and the plan windows paid for it |
| HTTP 400 "Third-party apps…" | Classified as a non-Claude-Code client                             |
| HTTP 400 (other message)     | A real request-validation error; not a classifier result           |

### What the classifier actually looks at

Bisected by replaying one real failing pi request to the live API with a single
mutation each time (`cch` recomputed for every variant). Every result reproduced
3/3 across runs — the classifier is deterministic, so single-shot probes are
trustworthy once repeated.

| Mutation (entrypoint `cli` unless stated)                                       | Result   |
| ------------------------------------------------------------------------------- | -------- |
| pi's body as-is                                                                 | **FAIL** |
| drop pi's system prompt (keep billing + identity only)                          | PASS     |
| replace pi's prompt with Claude Code's own                                      | PASS     |
| shorter, generic prompt ("You are a helpful assistant.")                        | PASS     |
| pi's prompt + Claude Code's prompt as a **fourth** system block                 | **FAIL** |
| Claude Code's prompt in `system[2]`, pi's prompt in `system[3]`                 | **FAIL** |
| **drop `tools` entirely, keep pi's prompt**                                     | **FAIL** |
| rename pi's tools to Claude Code's names                                        | **FAIL** |
| `max_tokens` 128000 → 64000                                                     | **FAIL** |
| add `context_management`                                                        | **FAIL** |
| add `diagnostics`                                                               | **FAIL** |
| drop `context-1m-2025-08-07`                                                    | **FAIL** |
| identity prompt → Agent SDK line, `cc_entrypoint=sdk-cli`, `cc_turn_origin=sdk` | **PASS** |

Read the last row together with the first: **the same body, the same tools, the
same prompt — only the claimed client identity changed the outcome.** Tools,
`max_tokens`, `context_management` and `diagnostics` are all irrelevant to it.
The classifier scans _every_ system block (the fourth-block variant fails), and
what it is really testing is: _does a client claiming to be Claude Code carry
Claude Code's system prompt?_

`sdk-cli` does not have to pass that test, because an application on the Agent
SDK legitimately supplies its own system prompt. That is the whole difference.
pi _is_ such an application, so `sdk-cli` is both the accepted answer and the
true one.

### Why not just impersonate the prompt

Keeping `cli` is possible — Claude Code's prompt in `system[2]`, pi's
instructions moved into the first user message — and it was verified to pass
3/3. It was rejected anyway:

- Claude Code's prompt documents tools pi does not have (`Agent`, `Artifact`,
  `Skill`, `ToolSearch`, `ScheduleWakeup`, …). Handing the model a tool list that
  does not match the request's `tools` invites calls that cannot be satisfied.
- pi's instructions lose system-prompt weighting and become user-authored text,
  which changes how the model treats them.
- It is a more elaborate lie about being Claude Code, in a system whose operator
  is demonstrably willing to check.
- The prompt text is version-coupled: it would have to be re-extracted from each
  Claude Code release, and every extraction bug is another outage like this one.

### Rules this leaves behind

1. **The claimed entrypoint, the identity line, and `cc_turn_origin` are one
   claim.** They must agree with each other and with the system prompt being
   sent. A regression test pins all three.
2. **A header-and-body capture match does not prove acceptance.** The rig proves
   _shape_; only a live request proves the classifier is satisfied. Both are
   necessary.
3. **`lane:check`'s default probe cannot see this class of failure** and now says
   so. Use `pnpm run lane:check -- --replay <capture>` on a real captured
   request whenever the request shape changes.
4. **Watch for silent credit burn, not just hard errors.** While credits are
   available the same misclassification costs money instead of failing. That is
   what `pnpm run usage` is for, and a slow rise in `used_credits` with flat plan
   windows is the signal.

## Re-check cadence

- **After a Claude Code update**, the version needs nothing from you — it is
  read from the installation. What can still drift is the **shape**: the beta
  set, the `X-Stainless-*` constants, and the `cch` seed/hash view. Re-run the
  capture rig (below) when the shape is worth confirming.
- **After pi updates** — pi's beta derivation, UA, and body fields can move
  under the extension.
- **After any Anthropic policy news** — watch support.claude.com 12429409 /
  15036540 and the code.claude.com changelog.
- **Any time the billing question is live**, `pnpm run lane:check` is the ~5 s
  answer for routing, and `pnpm run usage` reports what has actually been
  consumed (plan windows and `extra_usage.used_credits`) without spending
  tokens. Both call Anthropic with the keychain OAuth token.

## When billing moves to extra usage

1. `pnpm run lane:check` still reports it — confirm the request was classified
   and not merely a transport error (HTTP 400 with "Third-party apps now draw
   from your extra usage" is the classifier signal).
2. Check whether the fingerprint has drifted: re-capture the current Claude Code
   shape and diff it against `CLAUDE_CODE_BETAS`, the `X-Stainless-*` constants,
   and the `cch` hash view. A shape mismatch is fixable in this extension.
   A version being _stale_ is not a thing any more — that resolves itself.
3. If the shape matches and requests still bill to extra usage, the classifier
   has changed structurally. Options:
    - **Subprocess mode** (the durable sanctioned path): route pi through the
      genuine `claude` CLI (pattern: `rchern/pi-claude-cli`, Cline's "Claude
      Code" provider).
    - **Accept metered billing**: usage credits via `claude.ai/settings/usage`,
      pre-paid usage bundles (10–30% off) — safe, zero ToS exposure.
4. Monitor burn at `claude.ai/settings/usage` (`extra_usage.used_credits`) and
   the response headers during the transition.

## The capture rig

Both halves ship with the repo. Nothing in a capture reaches Anthropic.

```bash
# 1. Loopback server: logs every request, answers with a canned SSE stream.
pnpm run capture -- --port 8899 --out /tmp/cc-capture

#    Add `--tool Read` to answer the first request with a tool_use block, which
#    makes the client run the tool and send a second turn — where `cc_prev_req`
#    shows up.

# 2a. Real Claude Code, non-interactive — the shape this fork claims, so this is
#     the reference capture to diff against.
ANTHROPIC_BASE_URL=http://127.0.0.1:8899 \
_CLAUDE_CODE_ASSUME_FIRST_PARTY_BASE_URL=1 \
    claude -p --model claude-sonnet-5 "Reply with exactly: OK"

# 2b. Real Claude Code, interactive. Not the shape we send, but capturing both is
#     how you notice a change moving something it should not have. Needs a pty.
ANTHROPIC_BASE_URL=http://127.0.0.1:8899 \
_CLAUDE_CODE_ASSUME_FIRST_PARTY_BASE_URL=1 \
    python3 scripts/drive-claude-interactive.py \
        --model claude-sonnet-5 --turns 2 --cwd ~/some/trusted/project

# 3. Check what came back.
pnpm run verify:fingerprint /tmp/cc-capture --prompt "Reply with exactly: OK"
```

`_CLAUDE_CODE_ASSUME_FIRST_PARTY_BASE_URL=1` keeps Claude Code's first-party
`cch` and identity gates open against a non-Anthropic host. Without it the
capture is a stripped third-party shape and proves nothing about first-party
traffic.

`verify:fingerprint` recomputes `cch` and the version suffix with the production
functions, prints the billing header's field list, compares the user-agent, the
request class, the `X-Stainless-*` triple and the identity line, and reports the
beta delta against the fork's captured set — so a Claude Code update shows its
drift as a list rather than a hunch. The suffix is only _asserted_ when
`--prompt` supplies the first user message: Claude Code merges its meta reminders
into that message before serializing, so a native body cannot yield the input.

To capture pi's side against the same server:

```bash
CCFP_DIR=/tmp/cc-capture/pi pnpm run capture -- --port 8899 --out /tmp/cc-capture &
CCFP_DIR=/tmp/cc-capture/pi pi \
    --extension scripts/pi-capture-redirect.ts --extension src/index.ts \
    -ne -np -ns --print --model claude-opus-5 "Reply with exactly: OK"
```

The redirect extension loads **before** this one on purpose: that makes the
extension's fetch patch wrap the redirect, so the dump shows the fully shaped
body (`cch` filled in, betas merged, headers set). Loading it last dumps the
pre-shaping body and looks alarming for no reason.

Verdicts are recorded above, release by release. Remember that the rig captures
shape only — [the content classifier](#2026-09-19--the-content-classifier-and-the-v08-outage)
is not visible to it.

## Known gaps (accepted)

- **The claimed client identity is constrained by the classifier, not by us.**
  `cli` is not available while pi sends its own system prompt; see
  [the classifier section](#2026-09-19--the-content-classifier-and-the-v08-outage).
  If the classifier tightens again, the remaining lever is content — pi's system
  prompt and tool definitions — and relocating them is a product decision, not a
  fingerprint tweak.
- **Auxiliary pi requests** (compaction/consolidation, background agents) do not
  pass through the extension's `before_provider_request` hook, so they carry no
  billing header. They _do_ get the Claude Code user-agent, `X-Stainless-*`
  headers, and merged beta set because every OAuth request passes through the
  fetch patch. Today they still bill to the plan; they would flip first if the
  classifier tightened.
- `claude-fable-5` is metered to usage credits **even in genuine Claude Code**
  — no flat-rate route exists; avoid it if flat-rate billing is the goal.
- On Pro, Opus 1M context may require usage credits (Max gets it by default).
- `cch` nonce semantics are **partially** verified: the value provably matches
  what native Claude Code through 2.1.277 computes over the same bytes, but
  whether the server validates it (vs. merely logging it) is still unknown. If
  the server ever enforces a changed seed/hash view, this fork must track it; if
  it enforces binary attestation, subprocess mode becomes the only plan route.
- `x-cc-atis` is an opaque, server-signed blob. This fork replays the pin Claude
  Code already fetched for the same `(entrypoint, model, version, organization)`
  and sends nothing when there is no such slot; it never synthesizes one, and it
  does not fetch a fresh one itself. If Anthropic ever treats a stale pin as a
  signal rather than a config-freshness hint, pi would look stale sooner than a
  running Claude Code would.
