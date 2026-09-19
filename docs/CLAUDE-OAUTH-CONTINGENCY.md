# Claude OAuth contingency

**Status:** Dormant. Production stays on `sdk-cli` until a [trigger](#reopen-trigger) fires.

Companion: [`LANE-MONITORING.md`](./LANE-MONITORING.md) (billing checks, version cadence).  
Implementation detail lives in git history — use `git show`, not this file.

Unsupported impersonation of Claude Code. Anthropic may change classification or enforcement at any time.

## Current route

Production / canonical line: `3df2adb` (**v0.7.1**).

| Claim | Value |
|---|---|
| Entrypoint | `sdk-cli` |
| System identity | Agent SDK line (“You are a Claude agent…”) |
| Turn origin | `sdk` (when present) |
| Pi system prompt / tools | Unchanged |

**Why:** real Pi requests with this coherent bundle bill to plan windows today, and keep Pi’s behavior.  
**Weakness:** Anthropic may later meter SDK / `claude -p` / third-party-shaped traffic separately. This route is the *working* costume, not a permanent entitlement.

Do not flip production to interactive `cli` markers while Pi’s system prompt remains in `system[]`.

## Outage record (authoritative)

| Field | Value |
|---|---|
| When | 2026-09-19 ~05:03Z |
| Where | Herdr pane `wA:pR`; pi session under `mobile_coding_harness` id `01a0b80c-…` |
| Model | `claude-opus-5` |
| Error | `HTTP 400` · `Third-party apps now draw from your extra usage, not your plan limits…` |
| `request_id` | `req_011CfCDKNaqT1d5Js8uJZbr9` |
| Recovery | Reset fork to `3df2adb`, `/reload` → same user text succeeded ~05:11Z |

## Classifier rule

Measured in `e847c39` by replaying **one real Pi request**, one mutation at a time, recomputing `cch`, 3× each, with **extra-usage credits exhausted** (hard oracle: 200 ≈ plan, that 400 ≈ third-party):

| Shape | Verdict |
|---|---|
| `cli` + **Pi** system prompt | Third-party 400 |
| `cli` + **Claude Code** system prompt | Plan pass |
| `cli` + CC prompt + **Pi still in another system block** | Third-party 400 |
| `sdk-cli` + Agent SDK identity + Pi prompt | Plan pass |

- Classifier reads **all** system blocks and checks **client claim ↔ prompt coherence**.
- Tool rename / drop tools / clamp `max_tokens` / `context_management` did **not** rescue `cli` + Pi prompt.
- Schema 400s (e.g. `fallbacks: Extra inputs are not permitted`) are a **different** failure class from third-party routing.

## False-green trap

Tiny / synthetic bodies often get HTTP 200 while real Pi fails the same day.

Not acceptance proof:

- default tiny `lane:check`
- hand-built “Pi-like” prompts
- HTTP 200 without an accounting oracle
- rate-limit headers without a **known-bad** control in the same run

Acceptance fixture = **captured final wire request from real Pi** (post all transforms).

## Recoverable history

| Commit | Role |
|---|---|
| `6f36b8a94c05ce308d2800435d60f0f5e056b492` | **v0.8.0** — full interactive costume (`cli`, CC-shaped fields). Caused the outage with Pi’s prompt. |
| `e847c397b1362a509d09a234ec1049add217d287` | **v0.8.1** — restored coherent `sdk-cli` persona; documents classifier; real-request replay; keeps independent fidelity work from 0.8.0. |
| `3df2adb2dd00cc1365b31e812ca64724239e4d82` | **v0.7.1** — current production after hard reset. |

```bash
git show archive/v0.8.1-classifier   # e847c39 — autopsy + sdk-cli restore
git show archive/v0.8.0-interactive  # 6f36b8a — full interactive attempt
git log --oneline archive/v0.8.0-interactive..archive/v0.8.1-classifier
```

These `archive/*` branches keep the objects reachable (not dangling reflog-only).

## Selective recovery from 0.8.x

Recover **slices**, never either commit wholesale. Keep persona = `sdk-cli` unless a [trigger](#reopen-trigger) says otherwise.

| Recover (after approval) | Notes |
|---|---|
| Capture / redaction / fingerprint compare | Observability first; no default shape change |
| Real-request `lane:check --replay` | Verdicts: plan · third-party · invalid · **inconclusive** |
| Recursive empty of string-valued `model` keys for `cch` | Needed for Opus/Fable nested advisor `model` |
| No-install version fallback bump | Installed-version discovery stays primary |
| Beta ↔ body coupling | Verify against **sdk-cli** captures per model |
| `x-claude-code-request-class` | Scope to real **main** traffic only |

| Defer / redesign | Why |
|---|---|
| `cc_prev_req` | 0.8.x used process-global last id — unsafe across sessions/concurrency |
| `x-cc-atis` | Opaque pin; wrong/stale pin worse than omit |
| Auxiliary paths | Compaction / title / bg agents may skip billing-header hook |

**Never restore as production default:**

- `cli` + Pi system prompt
- 0.8.0 interactive persona bundle
- module-global `cc_prev_req` as written
- tiny probe as plan-billing gate

## Reopen trigger

Reopen interactive-cli work only when **confirmed** with a real Pi request:

1. coherent `sdk-cli` gets the third-party-routing error, or
2. SDK-shaped traffic burns **extra usage** while plan windows should apply, or
3. Anthropic enforces separate SDK / agent billing, or
4. Daniel explicitly starts the contingency research.

Before declaring trigger: package path, loaded commit, model, account extra-usage state, exact error body, and usage delta.

## If reopened — research order

Goal: make Anthropic treat Pi as **interactive Claude Code** without wrecking Pi-on-Claude quality.

1. Stand up the [oracle](#oracle) (SDK positive + `cli`+Pi negative controls).
2. Capture **interactive TUI** system prompt + tools (`claude -p` is the **sdk** reference, not interactive).
3. Send **CC system scaffold on every request** (turn 1, tool continuation, later turns, resume, compaction). First-message-only CC system is presumed to fail classification on later turns.
4. Put **Pi policy in the first user message** (or native-looking project-memory wrapper), not as a foreign system block. Re-inject after compaction if history drops it.
5. Keep **Pi tools unchanged first**; count invalid / unavailable tool calls.
6. Optional: encode Pi deltas inside CC’s native project-instruction wrapper if user-level policy is too weak.
7. Add **minimal** core aliases only for measured failures (`Read`/`Write`/`Edit`/`Bash`, then search).
8. Schema translation only where aliases fail; preserve `tool_use` ids; keep history coherent both ways.
9. **Stop** before emulating Agent / Skill / hooks / MCP lifecycle / scheduling unless remaining surface is small.

Prompt cache may reuse a durable CC prefix; it does **not** allow omitting that prefix on later requests.

CC system transplant is allowed **if** Pi quality holds (Daniel). Quality is a separate gate from classifier pass.

## Oracle

1. Capture final serialized body from the exact production path package.
2. Record Pi version, fork commit, package path, model, endpoint, persona.
3. Redact tokens; keep structural hashes (and controlled fixtures if needed).
4. Prefer extra usage **disabled/exhausted** for the hard oracle.
5. Positive control: current `sdk-cli` + real Pi body.
6. Negative control: `cli` + **same** real Pi body — must fail or the run is **inconclusive**.
7. One conceptual variable per candidate; entrypoint/identity/turn-origin move as one bundle.
8. Recompute `cch` last; sent bytes must match post-`cch` digest.
9. Repeat ≥3× in one account/time window.
10. Keep status, exact error body, response `request-id`, usage headers.
11. Split third-party 400 vs schema/auth 400.
12. If extra usage is on: prove plan vs credit **deltas**; bare HTTP 200 is not enough.
13. Cover first turn, tool result, later turn, resume, compaction, auxiliary traffic.
14. Final acceptance: real Pi turn after reload with loaded commit recorded.

## Quality gate (interactive candidates)

Compare to current SDK+Pi on: navigate, diagnose, precise edit, multi-file edit, tool-error recovery, project instructions, custom tools, permissions, resume, compaction.

Ship blockers: third-party routing, permission bypass, wrong-file edits, orphaned tool results, large success regression.

## Stop conditions

Stop interactive work if:

- CC system is rejected on later turns or auxiliary requests;
- preserving quality requires putting Pi’s full system block back under `cli`;
- adapter must recreate most of Claude Code’s runtime;
- server requires binary attestation;
- oracle cannot tell plan from extra usage.

If SDK plan routing is also dead: API/extra billing, native Claude Code transport, or leave Anthropic.

## Related paths

| Path | Use |
|---|---|
| `src/signing.ts` | entrypoint, UA, `cch`, betas, fetch patch |
| `src/transforms.ts` | billing header + identity injection |
| `docs/LANE-MONITORING.md` | billing probes, version cadence |
| `scripts/lane-check.ts` | today: tiny A/B (false-green risk until replay lands) |
| Commits `6f36b8a`, `e847c39` | failed interactive attempt + autopsy |
