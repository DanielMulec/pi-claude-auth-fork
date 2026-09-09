# Lane Monitoring — billing-lane verification

This fork routes Anthropic requests with Claude Code's fingerprint so they bill
against the Claude Pro/Max **subscription plan** rather than per-token
**extra usage / usage credits**. The billing lane is decided server-side by an
undocumented classifier that has changed repeatedly (Apr 4, Apr 8, Jun 15 2026) — so the lane is verified **empirically**, not assumed.

## Baseline (2026-09-09)

Account: Claude Pro, token from macOS Keychain (Claude Code OAuth session).
Claude Code binary: **2.1.266** (build 2026-09-08T23:01:17Z, git `eb01d6090964`).
The `cch` seed (`0x4d659218e32a3268`) and the hash view were re-verified against
two live 2.1.266 captures — see [Fingerprint verification](#fingerprint-verification-2026-09-09).
Result (2026-09-09): **both request shapes land on the plan lane** — HTTP 200,
`anthropic-ratelimit-unified-overage-utilization: 0.0`, 5h/7d plan buckets
consumed. Verified for `claude-sonnet-5` and `claude-opus-5`, for both the
fork's full Claude Code shape (with a live-matching `cch`) and pi's built-in
OAuth shape.

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
```

The script sends two tiny requests with the keychain OAuth token:

- **A** — pi's built-in OAuth request shape (identity prompt, no billing header)
- **B** — full Claude Code shape (billing header, real `cch`, `claude-cli/2.1.266`, 13 betas)

and prints the billing-lane response headers.

## Reading the output

| Signal                                                          | Meaning                                               |
| --------------------------------------------------------------- | ----------------------------------------------------- |
| `overage-status: allowed` + `overage-utilization: 0.0`          | ✅ plan lane — nothing drawn from usage credits       |
| `overage-utilization: > 0`                                      | ⚠️ **extra-usage lane** — per-token billing active    |
| `overage-status: blocked`                                       | ⛔ account blocked from extra usage (and not on plan) |
| `5h` / `7d` utilization rising                                  | ✅ plan-lane buckets being consumed (expected)        |
| HTTP 400 with "Third-party apps now draw from your extra usage" | ⛔ classifier flagged the request — off plan lane     |

## Fingerprint verification (2026-09-09)

The `cch` is reproduced, not guessed. Claude Code computes it in the native Bun
fetch layer, so it was recovered by running the real binary against a loopback
capture server (`ANTHROPIC_BASE_URL`, plus
`_CLAUDE_CODE_ASSUME_FIRST_PARTY_BASE_URL=1` to keep the first-party `cch`
gate open) and replaying the exact bytes.

Live 2.1.266 capture, `--print`/`sdk-cli`, `claude-opus-5`:

```
x-anthropic-billing-header: cc_version=2.1.266.fce; cc_entrypoint=sdk-cli; cch=ae14b; cc_prompt_id=8d75e0cb-...;
```

The value is exactly `xxHash64(hash_view, 0x4d659218e32a3268) & 0xfffff` where
`hash_view` is the final body with:

1. the five `cch` digits replaced by `00000`,
2. every `"model":"..."` string value emptied (`"model":""`),
3. the dispatch-only members `max_tokens`, `fallbacks`, `fallback_credit_token`
   omitted (with Claude Code's comma semantics, reproduced by delete +
   `JSON.stringify`).

Both live captures (different prompts, 45,722 and 45,748 bytes) reproduce their
native `cch` this way, and the extension's own implementation reproduces the
same values on pi's serialized body. The seed has not rotated since the
2.1.220–2.1.234 range documented by CLIProxyAPI's `claude_signing.go`.

Also verified from the same binary/capture:

- version suffix `sha256(salt + firstUserMessage[4,7,20] + version)[:3]`
  (2.1.266: `say hi` → `fce`),
- billing header field order `cc_version; cc_entrypoint; cch; …; cc_prompt_id`,
- beta set, `?beta=true`, `x-claude-code-session-id`, `x-client-request-id`,
  `metadata.user_id`, and the `X-Stainless-*` identity headers.

## Re-check cadence

- **After every Claude Code update** (the `CC_VERSION` pin in `src/signing.ts`
  must track the current Claude Code release; drift is the #1 cause of lane
  flips). Check current CC version with `claude --version`.
- **Weekly**, plus after pi updates and after any Anthropic policy news
  (watch: support.claude.com 12429409 / 15036540, code.claude.com changelog).

## When the lane flips

1. Bump the pin: `export ANTHROPIC_CLI_VERSION=<new-version>` (immediate
   override) and/or bump `CC_VERSION` in `src/signing.ts` + the pin tests in
   `src/signing.test.ts`, re-run `pnpm test`.
2. Re-run `pnpm run lane:check` — should return to plan lane.
3. If it stays off-plan, the classifier has changed structurally. Options:
    - **Subprocess mode** (the durable sanctioned path): route pi through the
      genuine `claude` CLI (pattern: `rchern/pi-claude-cli`, Cline's "Claude
      Code" provider).
    - **Accept metered billing**: usage credits via `claude.ai/settings/usage`,
      pre-paid usage bundles (10–30% off) — safe, zero ToS exposure.
4. Monitor burn at `claude.ai/settings/usage` (`extra_usage.used_credits`) and
   the response headers during the transition.

## Known gaps (accepted)

- **Auxiliary pi requests** (compaction/consolidation, background agents) do
  not pass through the extension's `before_provider_request` hook and go
  unshaped — the same gap exists in sibling extensions (gotgenes
  pi-anthropic-auth). Today they still bill to the plan (baseline); they would
  flip first if the classifier tightens.
- `claude-fable-5` is metered to usage credits **even in genuine Claude Code**
  — no flat-rate route exists; avoid it if flat-rate billing is the goal.
- On Pro, Opus 1M context may require usage credits (Max gets it by default).
- `cch` nonce semantics are **partially** verified: the value now provably
  matches what native Claude Code 2.1.266 computes over the same bytes, but
  whether the server validates it (vs. merely logging it) is still unknown. If
  the server ever _enforces_ a version-derived value, bumping the pin and seed
  keeps the client side correct; if it enforces binary attestation, subprocess
  mode becomes the only flat-rate route.
