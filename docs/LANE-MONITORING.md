# Billing Monitoring — plan windows vs extra usage

This fork routes Anthropic requests with Claude Code's fingerprint so they bill
against the Claude Pro/Max **plan windows** rather than per-token **extra usage
(usage credits)**. Which entitlement pays is decided server-side by an
undocumented classifier that has changed repeatedly (Apr 4, Apr 8, Jun 15 2026) — so the billing is verified **empirically**, not assumed.

**Classifier / identity contingency** (dormant; production stays `sdk-cli`):
[CLAUDE-OAUTH-CONTINGENCY.md](./CLAUDE-OAUTH-CONTINGENCY.md). Tiny `lane:check`
probes can be **false green** — a real Pi wire capture is the acceptance fixture
when diagnosing third-party routing.

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

## Known gaps (accepted)

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
  what native Claude Code through 2.1.273 computes over the same bytes, but
  whether the server validates it (vs. merely logging it) is still unknown. If
  the server ever enforces a changed seed/hash view, this fork must track it; if
  it enforces binary attestation, subprocess mode becomes the only plan route.
