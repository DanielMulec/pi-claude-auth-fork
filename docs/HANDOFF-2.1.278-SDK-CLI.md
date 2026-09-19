# Handoff: Claude Code 2.1.278 on `sdk-cli`

Cold-start brief for the next agent. Written 2026-09-19 with GPT-5.6 Sol.  
**Status (2026-09-19):** landed as **v0.7.2** on `main` — recursive cch, 2.1.278 betas/`cc_turn_origin`, oracle tooling, real Pi plan replay + negative control. This file remains historical procedure + pitfalls.  
Companion (dormant interactive path): [`CLAUDE-OAUTH-CONTINGENCY.md`](./CLAUDE-OAUTH-CONTINGENCY.md).

## Mission

Upgrade this fork to a **verified Claude Code 2.1.278 `sdk-cli` fingerprint** while preserving Pi behavior and plan-window billing.

## Non-goals

- Interactive `cli` persona / CC system-prompt transplant (dormant — read contingency doc only if triggered).
- Changing Pi’s system prompt or tools.
- Provider redesign unrelated to 2.1.278 fidelity.
- “Fix third-party” by flipping entrypoint to `cli` while Pi’s prompt stays in `system[]` — that is a known outage.

## Repo state

| Item                         | Value                                                                                                        |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Path                         | `/Users/danielmulec/Projekte/deepseeksperiments/pi-claude-auth-fork`                                         |
| How pi loads it              | Path package in `~/.pi/agent/settings.json` → this repo                                                      |
| `main` at handoff            | `1e11037` (docs only after `3df2adb`)                                                                        |
| Runtime code baseline        | `3df2adb` **v0.7.1** (fingerprint verified through **2.1.274**)                                              |
| Machine CC install           | often newer (e.g. **2.1.278** under `~/.local/share/claude/versions`) — version string already auto-resolved |
| Persona bundle (keep atomic) | `sdk-cli` · Agent SDK identity · `cc_turn_origin=sdk` · UA `(external, sdk-cli)`                             |

Read **`AGENTS.md` first** — git + GitNexus rules are binding:

- Work from current `main` / `HEAD`.
- Move refs (pull/merge/rebase/reset/push) **only when Daniel asks**.
- Archive branches below are **evidence**, not merge-by-default targets.
- `gitnexus_impact` before symbol edits; warn on HIGH/CRITICAL.
- `gitnexus_detect_changes` before commit.

## “2.1.278 clean” checklist

- [ ] Persona stays coherent **`sdk-cli`** (no interactive identity, no Pi prompt relocate).
- [ ] Installed CC version resolved per request; no-install fallback advanced only after verify.
- [ ] Version suffix matches native 2.1.278 vectors.
- [ ] **`cch`** matches native **`claude -p`** captures for Sonnet, Opus, Fable — including **nested string `model` fields**.
- [ ] `cch` from **final sanitized body**; no post-hash mutation.
- [ ] Betas = current 2.1.278 `--print` set **plus** Pi-required feature betas only (merge, don’t replace).
- [ ] Thinking-display beta tracks actual `thinking.display`.
- [ ] Fallback betas only with fallback body fields; **Opus must not send unsupported `fallbacks`** to `/v1/messages`.
- [ ] Headers native-compatible and **scoped** (main vs auxiliary).
- [ ] Real Pi turns on Sonnet / Opus / Fable: plan use, no extra-usage delta.
- [ ] Known-bad **`cli` + Pi system** still detectable (oracle negative control).
- [ ] `pnpm test` / build / lint + fingerprint verify + real-request replay pass.

## Starting evidence

### `archive/v0.8.1-classifier` (`e847c39`)

**Mine selectively:** capture/replay, `verify:fingerprint`, real-request `lane:check`, recursive CCH + vectors, 2.1.277/278 beta↔body coupling, fallback version, classifier docs/tests.

**Review before porting:**

| Piece                         | Caution                                                |
| ----------------------------- | ------------------------------------------------------ |
| `x-claude-code-request-class` | Scope to real main traffic                             |
| `cc_prev_req`                 | Must not stay module-global                            |
| `x-cc-atis`                   | Opaque/staleable; exact match + measured value or omit |
| Aux paths                     | Compaction/title/bg may skip billing-header hook       |

### `archive/v0.8.0-interactive` (`6f36b8a`)

Use for TUI capture history and research only.

**Never restore as production default:** `cli` entrypoint, interactive identity, `cc_turn_origin=human`, interactive prompt assumptions with Pi’s system prompt.

```bash
git show archive/v0.8.1-classifier
git show archive/v0.8.0-interactive
git diff 3df2adb..archive/v0.8.1-classifier --stat
```

Do **not** cherry-pick either archive wholesale.

## Known pitfalls

| Pitfall                           | Fact                                                                                  |
| --------------------------------- | ------------------------------------------------------------------------------------- |
| Classifier coherence              | `cli` + real Pi system → third-party 400 (`req_011CfCDKNaqT1d5Js8uJZbr9`, 2026-09-19) |
| False green                       | Tiny/`lane:check`/hand-built “Pi-like” can 200 while real Pi fails                    |
| HTTP 200                          | Not plan proof if extra usage is available                                            |
| Old `cch`                         | Top-level-only `model=""` misses Opus/Fable nested advisor `model`                    |
| Opus schema                       | `fallbacks: Extra inputs are not permitted` ≠ third-party classifier                  |
| Native reference for this mission | **`claude -p` / sdk-cli**, not interactive TUI                                        |
| More headers                      | More coherence surfaces — omit uncertain optionals                                    |

## Work order

1. **Baseline** — Read AGENTS, this handoff, contingency, LANE-MONITORING, current tests, both archive diffs.  
   _Done when:_ port list is independent slices with risk notes.
2. **Oracle first** — Port capture/replay + verdict classes **without** default shape change.  
   _Done when:_ SDK positive, `cli`+Pi negative, and schema-invalid fallback are distinguished.
3. **Recursive CCH** — Native 2.1.278 Sonnet/Opus/Fable vectors.  
   _Done when:_ vectors match; sent bytes = post-`cch` digest.
4. **Version evidence** — Fallback/vectors only; discovery stays authoritative.  
   _Done when:_ 2.1.278 suffix tests pass.
5. **Beta/body coherence** — Per-model table: native `--print` ∪ Pi-required.  
   _Done when:_ no missing required / no unsupported advertised.
6. **Headers audit** — Only proven sdk-class fields; main vs aux mapped.  
   _Done when:_ no unscoped globals.
7. **Real Pi verify** — Path package after `/reload`; Sonnet/Opus/Fable; usage delta.  
   _Done when:_ hard oracle = plan; no extra-usage burn.
8. **Review** — GitNexus detect_changes + independent review before commit/push asks.

## Verification

```bash
pnpm test && pnpm run build && pnpm run lint
pnpm run lane:check && pnpm run lane:check opus && pnpm run lane:check fable
pnpm run usage
```

After restoring archive tooling (if ported):

```bash
# names may differ — check package.json on archive branch
pnpm run verify:fingerprint -- <capture-dir>
pnpm run lane:check -- --replay <real-pi-capture>
```

**Oracle rules (short):** final path-package body · extra usage exhausted when possible · SDK+ / CLI+Pi− same window · inconclusive if negative doesn’t fail · one variable · `cch` last · ≥3 repeats · split third-party vs schema 400 · finish with real Pi after reload.

## Files

| Path                               | Role                                  |
| ---------------------------------- | ------------------------------------- |
| `AGENTS.md`                        | Git / GitNexus                        |
| `docs/CLAUDE-OAUTH-CONTINGENCY.md` | Persona decision; dormant interactive |
| `docs/LANE-MONITORING.md`          | Billing probes / cadence              |
| `src/signing.ts` (+ tests)         | Persona, `cch`, betas, fetch patch    |
| `src/transforms.ts` (+ tests)      | Billing + identity blocks             |
| `src/claude-version.ts` (+ tests)  | Version resolution                    |
| `src/index.ts`                     | Hooks / provider register             |
| `scripts/lane-check.ts`            | Probe (smoke until replay)            |
| `scripts/usage.ts`                 | Plan vs extra usage                   |

Archive-only to evaluate: `scripts/capture-requests.ts`, capture pty driver, `scripts/verify-fingerprint.ts`, `src/atis.ts`.

## Skills

- GitNexus exploring / impact-analysis (mandatory per AGENTS)
- `diagnosing-bugs` — real-request oracle before hypotheses
- `tdd` — vectors first per slice
- `code-review` — before merge
- `resolving-merge-conflicts` — only if Daniel authorizes a conflicted port

## Stop and ask Daniel

- Any ref move, commit, or push
- Persona / system-prompt / production-default change
- Reviving interactive-CLI behavior
- HIGH/CRITICAL GitNexus impact
- Non-discriminating oracle (negative control not failing)
- Global `cc_prev_req`, stale ATIS, unscoped request-class
- Scope creep past 2.1.278 fidelity
