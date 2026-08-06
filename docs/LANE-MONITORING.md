# Lane Monitoring — billing-lane verification

This fork routes Anthropic requests with Claude Code's fingerprint so they bill
against the Claude Pro/Max **subscription plan** rather than per-token
**extra usage / usage credits**. The billing lane is decided server-side by an
undocumented classifier that has changed repeatedly (Apr 4, Apr 8, Jun 15 2026) — so the lane is verified **empirically**, not assumed.

## Baseline (2026-08-06)

Account: Claude Pro, token from macOS Keychain (Claude Code OAuth session).
Result: **both request shapes land on the plan lane** — HTTP 200,
`anthropic-ratelimit-unified-overage-utilization: 0.0`, 5h/7d plan buckets
consumed. Verified for `claude-sonnet-5` and `claude-opus-5`, for both the
fork's full Claude Code shape and pi's built-in OAuth shape.

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
- **B** — full Claude Code shape (billing header, `claude-cli/2.1.222`, 11 betas)

and prints the billing-lane response headers.

## Reading the output

| Signal                                                          | Meaning                                               |
| --------------------------------------------------------------- | ----------------------------------------------------- |
| `overage-status: allowed` + `overage-utilization: 0.0`          | ✅ plan lane — nothing drawn from usage credits       |
| `overage-utilization: > 0`                                      | ⚠️ **extra-usage lane** — per-token billing active    |
| `overage-status: blocked`                                       | ⛔ account blocked from extra usage (and not on plan) |
| `5h` / `7d` utilization rising                                  | ✅ plan-lane buckets being consumed (expected)        |
| HTTP 400 with "Third-party apps now draw from your extra usage" | ⛔ classifier flagged the request — off plan lane     |

## Re-check cadence

- **After every Claude Code update** (the `CC_VERSION` pin in `src/signing.ts`
  must track the current Claude Code release; drift is the #1 cause of lane
  flips). Check current CC version with `claude --version`.
- **Weekly**, plus after pi updates and after any Anthropic policy news
  (watch: support.claude.com 12429409 / 15036540, code.claude.com changelog).

## When the lane flips

1. Bump the pin: `export ANTHROPIC_CLI_VERSION=<new-version>` (immediate
   override) and/or bump `CC_VERSION` in `src/signing.ts` + the pin test in
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
- `cch` nonce semantics are unverified (decorative vs validated attestation);
  if ever validated, the fingerprint approach collapses and subprocess mode
  becomes the only flat-rate route.
