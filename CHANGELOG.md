# Changelog

# 0.7.11 (2026-10-10) — fork release

### Changed

- **Verified Claude Code 2.1.296 `sdk-cli` fingerprint** with **Pi 1.1.0**.
  No production request-shaping change was needed. Installed-version discovery
  stays primary; `FALLBACK_CC_VERSION` is `2.1.296`.
- **Dev dependency on Pi is `^1.1.0`** (was `^1.0.4`), with the lockfile
  updated. Added the native 2.1.296 suffix regression vector. Pi prompts, tools,
  request identity, signing algorithms, OAuth recovery, and beta mapping are
  unchanged.
- **Haiku 5.5 is now live-tested** using the user's existing Pi catalog. No
  model registration or user model-configuration changes were made.

### Verified

- **88 tests**, TypeScript build, lint/format checks, and `git diff --check` pass.
- Native non-auto `claude -p` loopback captures on **Sonnet 5, Opus 5,
  Opus 5.5, Fable 5.1, Sonnet 5.5, Haiku 5.5** reproduce cch exactly:
  `7756c` / `b8d58` / `ac78a` / `ab9aa` / `79493` / `ab202`.
  Suffix **`92f`** for `Reply with exactly: OK`; billing fields, Agent SDK
  identity, required betas, and Stainless `0.128.0` / `v26.3.0` / `600` still
  match. The installed binary retains the suffix salt, OAuth token URL, and
  client id. No remote-gated beta was added as a production default.
- Fresh Pi 1.1.0 processes loading this checkout's `src/index.ts`: all six
  loopback captures verify, and plain replies plus bash tool round-trips pass
  on all six models (**18 live HTTP 200 requests**). All final-wire fingerprints
  verify, including both Haiku 5.5 tool-round-trip requests.
- **Three paired real-Pi routing replays** of a final Sonnet 5.5 body:
  production SDK shape returns HTTP 200 with plan-window headers; the test-only
  `cli` + Claude Code identity + `human` persona, retaining Pi's system prompt
  and recomputing cch, returns the exact third-party HTTP 400 on every pair.
  Positive request ids: `req_011CftMBgUjCzoE5NVuHkUHA`,
  `req_011CftMBs9At4iubYcB7U736`, `req_011CftMC3ARixJiWrbxwnvYe`.
  Negative request ids: `req_011CftMBod5xnCZAgA4wbEj5`,
  `req_011CftMBybNjy1kvSurTLmzh`, `req_011CftMCBB94zeVHuMVdcFwJ`.
  Production identity was not changed.
- **Accounting remains inconclusive:** usage before, after the live tests,
  and after the replay pairs stayed **5h 0% / 7d 46%**. OAuth extra usage was
  disabled, reported spend stayed **$0**, and the weekly breakdown stayed
  100% Claude Code. The paired controls support routing compatibility, not an
  attributable deduction or proof about Console/API credit consumption.
  Console balance was not observed. Compaction/auxiliary paths were not tested.
- Official [2.1.294–2.1.296 changelog](https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md)
  covers hooks, gateways, headless lifecycle, Haiku 5.5 token counting, and
  Sonnet 5.5 cache-read cost estimates. Native captures and real Pi acceptance,
  rather than those release notes, establish the fingerprint compatibility.

# 0.7.10 (2026-10-07) — fork release

### Changed

- **Verified Claude Code 2.1.293 `sdk-cli` fingerprint** with **Pi 1.0.4**.
  Installed-version discovery stays primary; `FALLBACK_CC_VERSION` is `2.1.293`.
- **Haiku 5.5 request-beta support:** merge `per-turn-control-2026-07-01` and
  `mid-conversation-tool-changes-2026-07-01`, matching the native capture.
  Older Haiku models retain their existing gates. This does **not** register a
  model or modify Pi's model catalog/configuration.
- Added the native 2.1.293 suffix vector and Haiku beta regression coverage,
  including older/malformed model names and preservation of Pi-supplied betas.
  Pi prompts, tools, request identity, signing algorithms, and OAuth recovery
  are unchanged.

### Verified

- **87 tests**, TypeScript build, lint/format checks, and `git diff --check` pass.
- Native non-auto `claude -p` loopback captures on **Sonnet 5, Sonnet 5.5,
  Opus 5, Opus 5.5, Fable 5.1, Haiku 5.5** reproduce the unchanged cch hash
  view and suffix algorithm. Suffix **`e51`** for `Reply with exactly: OK`;
  native Haiku 5.5 cch **`26b25`**. OAuth constants, billing fields, Agent SDK
  identity, and Stainless `0.128.0` / `v26.3.0` / `600` remain unchanged.
  Known remote-gated `inline-tools` and `advisor-tool` extras are not made
  production defaults; Pi's own beta contributions remain additive.
- Fresh Pi processes loading this checkout's `src/index.ts` pass plain replies
  and bash tool round-trips on the five existing catalog models (**15 HTTP 200
  requests**, all final-wire fingerprints verified). Response headers allow
  plan windows and reject disabled overage. Haiku 5.5 live Pi testing is
  **pending the user's model-catalog refresh**; native capture and regression
  tests are not substitutes for that live test.
- **Billing investigation: inconclusive.** A real
  `anthropic/claude-sonnet-5-5:high` subagent completed three model turns. Usage
  before, immediately after, and about six minutes later stayed **5h 0% / 7d
  44%**; OAuth extra usage was disabled and reported spend stayed **$0**.
  No attributable plan deduction was observed. Pi's approximately **$0.0955**
  token-cost estimate is not an invoice. Console/API credit balance was not
  observed, so no claim is made about its consumption. The separate
  [monthly API credits policy](https://support.claude.com/en/articles/17154008-monthly-api-credits-for-max-and-team-plans)
  and [Agent SDK policy](https://support.claude.com/en/articles/15036540-use-the-claude-agent-sdk-with-your-claude-plan)
  do not by themselves establish this fork's billing route.
- The 2.1.292 paired billing oracle below is historical evidence, not a new
  2.1.293 oracle. No 2.1.293 paired negative controls were run. Production
  retains the existing `sdk-cli` identity; billing remains an open measurement
  question, documented in [`docs/LANE-MONITORING.md`](docs/LANE-MONITORING.md).

# 0.7.9 (2026-10-06) — fork release

### Changed

- **Verified Claude Code 2.1.292 `sdk-cli` fingerprint** and **Pi 1.0.4**. No
  request-shaping change was needed. Installed-version discovery stays primary;
  `FALLBACK_CC_VERSION` is `2.1.292`.
- **Dev dependency on Pi is `^1.0.4`** (was `^1.0.2`), with the lockfile updated.
- Added the native 2.1.292 version-suffix regression vector and refreshed the
  canonical-line and billing verification records. Pi prompts, tools, identity,
  OAuth refresh/recovery, and beta merging are unchanged.

### Verified

- Installed binary **2.1.292** (build `2026-10-06T05:25:12Z`, git
  `37832d0b7cad7b40bac7c82dff58629313913edf`). Binary strings still contain
  suffix salt `59cf53e54c78`, OAuth token URL
  `https://platform.claude.com/v1/oauth/token`, client id
  `9d1c250a-e61b-44d9-88ed-5944d1962f5e`, and Stainless `0.128.0`.
- Native `claude -p --permission-mode dontAsk` loopback captures for **Sonnet 5,
  Opus 5, Opus 5.5, Fable 5.1, Sonnet 5.5**: suffix **`d1c`** for
  `Reply with exactly: OK`; native cch values `79396` / `e8890` / `61ab9` /
  `746d2` / `8b826` recompute exactly under the unchanged seed/hash view.
  Billing fields, Agent SDK identity, Stainless `0.128.0` / `v26.3.0` / `600`,
  and required betas match the fork. Native extras remain the known remote-gated
  `advisor-tool` and `inline-tools`; Pi supplies its own inline-tools beta where
  needed. Opaque ATIS remains intermittent and is not copied.
- **Pi 1.0.4, loading this checkout's `src/index.ts` in fresh processes:**
  loopback captures on all five models pass fingerprint verification. Live
  plain replies and bash tool round-trips pass on all five models (**15 HTTP 200
  requests**); every final wire body recomputes cch and the version suffix.
  Response headers report allowed plan windows and rejected/disabled overage.
- **Discriminating real-Pi billing oracle, 3 paired replays:** a captured final
  Sonnet 5 request returns **HTTP 200 / plan** on all three SDK-positive runs;
  changing only the persona bundle to `cli` + Claude Code identity + `human`
  turn origin (keeping Pi's system prompt and recomputing cch) returns the
  exact **third-party HTTP 400** on all three negative runs. Positive request ids:
  `req_011Cfmbwr4GHGh1iEMUSmQzg`, `req_011Cfmbx2v88p7GcWwhNgwaa`,
  `req_011CfmbxFJ1Y33vSFnRe116z`. Negative request ids:
  `req_011CfmbwxyFNoMGBDoCUbRUx`, `req_011CfmbxBfUWtQmAHW3zUimp`,
  `req_011CfmbxN8n9xPeHq5mc7CAA`. The negative shape is test-only, never a
  production setting.
- Account usage before/after: **extra usage disabled**, spend **$0**, usage
  breakdown **100% Claude Code**. Rounded usage-endpoint totals stayed 5h 2% /
  7d 44%; no claim of an attributable usage delta from those rounded totals.
- Official [2.1.290–2.1.292 changelog](https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md):
  gateway beta rejection recovery, macOS login/Keychain reporting, and SDK
  lifecycle fixes, but no announced direct OAuth request-fingerprint change.
  Native captures and real Pi acceptance, not release notes, are the gate.

# 0.7.8 (2026-10-04) — fork release

### Changed

- **Verified Claude Code 2.1.289 `sdk-cli` fingerprint** and **Pi 1.0.2**. No
  request-shaping change was needed. Installed-version discovery stays primary;
  `FALLBACK_CC_VERSION` is `2.1.289`.
- **Dev dependency on Pi is `^1.0.2`** (was `^1.0.1`).

### Verified

- Binary `2.1.289` (build 2026-10-03T19:21:39Z, git `736d26eef42d1e3017e07e6d5bd0970b8c3a068f`)
  against `2.1.288` (build 2026-10-02T16:42:03Z). The beta-date registry, billing-header
  builder, OAuth token URL, OAuth client id, and Stainless `0.128.0` strings are
  identical. Native `claude -p` loopback captures of both versions (Sonnet 5, Opus 5.5)
  have the same header names, same body keys, and same beta header; only
  `user-agent` and per-request ids differ.
- Native `claude -p` 2.1.289 loopback captures (`--permission-mode dontAsk`; Sonnet 5,
  Opus 5, Opus 5.5, Fable 5.1, Sonnet 5.5): version suffix `fbd` for
  `Reply with exactly: OK`; cch `c847a` / `69eca` / `9e86c` / `8e348` / `7a952`
  recompute exactly under the unchanged seed. Observed extras are only the known
  remote-gated `advisor-tool` and `inline-tools`.
- Pi 1.0.2 through this extension: loopback captures on all five models recompute
  `cch` and the suffix, carry Stainless `0.128.0` and `claude-cli/2.1.289`, and
  contain every native beta. A Pi bash tool round-trip capture (Opus 5.5)
  recomputes `cch` on both requests. Live Pi turns with extra usage **disabled**
  returned `OK` on all five models, and a bash tool round-trip passed on all five;
  no third-party 400s.
- **Pi 1.0.1 → 1.0.2:** the bundled Anthropic provider is byte-identical apart from
  chunk-hash import names; 1.0.2 only adds OpenAI-compatible
  `samplingParamsByThinkingLevel`. The Pi 1.0.1 change that matters to this fork
  (tools added or redefined mid-conversation are defined inline) makes Pi send
  `inline-tools-2026-09-15` itself on models with native tool changes (not Sonnet 5).
  The merge keeps Pi's betas, native sdk-cli sends the same beta on those models, and
  live turns accept it, so nothing was changed.
- Official 2.1.289 changelog has no billing-header, `cch`, beta-set, or OAuth-protocol
  entry. It reverts the 2.1.288 `claude auth status` change that signed out VS Code
  extension users; this fork reads the Keychain directly and never calls that command.

# 0.7.7 (2026-10-03) — fork release

### Changed

- **Verified Claude Code 2.1.288 `sdk-cli` fingerprint** while keeping the coherent
  Agent SDK persona. Installed-version discovery stays primary; `FALLBACK_CC_VERSION`
  is `2.1.288`.
- **Dev dependency on Pi is `^1.0.1`** (was `^0.83.0`), so types check against the
  Pi that actually runs. The peer dependency stays `*`.
- **Stainless package version** is `0.128.0` (was `0.127.0`). Runtime `v26.3.0` and
  timeout `600` did not move. Bun's embedded user-agent is still
  `bun/1.4.3 … node/v26.3.0`.
- Beta set, billing-header field order, `cch` seed/hash view, version-suffix
  algorithm, OAuth token URL, client id, refresh JSON body, and the revoked-token
  401 body are unchanged from 2.1.287.
- Sonnet 5.5's catalog gained `per_turn_timing`. Native sends `timing-2026-09-09`
  only when `CLAUDE_CODE_PER_TURN_TIMING` is set, so this fork still does not
  advertise it.
- Still omit `advisor-tool`, `inline-tools`, `afk-mode`, `dangerous-tool-use`,
  `anthropic-dispatch-id`, and `x-cc-atis`. The first two are the same remote gates
  as 2.1.287 (`tengu_sage_compass2`, `tengu_brisk_meadow`). Dispatch id `v2d` is
  `tengu_dreamy_frost`. ATIS was present on some live captures and absent on others.

### Verified

- Binary `2.1.288` (build 2026-10-02T16:42:03Z, git `17fe1eb736e5b1433d6ca86a1db334cec8520450`)
  against `2.1.287` (build 2026-10-01T16:02:06Z, git `3c446a1b98aceb99a6cdee0f84a8bea42f4a8937`).
  Billing-header builder, salt `59cf53e54c78`, suffix samples `[4, 7, 20]`, identity
  strings, and the beta registry are the same. No beta date string was added or removed.
- Native `claude -p` 2.1.288 loopback captures (`--permission-mode dontAsk`; Sonnet 5,
  Opus 5, Opus 5.5, Fable 5.1, Sonnet 5.5) plus one auto-mode Sonnet 5 control:
  version suffix `733` for `Reply with exactly: OK`; cch values `c7bf5` / `e963f` /
  `eea56` / `5974f` / `11d1b` (auto control `65ac6`). They recompute exactly under
  the unchanged seed.
- A second dontAsk pass with `CLAUDE_CODE_DISABLE_ADVISOR_TOOL=1` dropped
  `advisor-tool` and the advisor tool. `inline-tools` remained only on models with
  `mid_conv_tool_change`, matching the unchanged `tengu_brisk_meadow` gate.
- Pi 1.0.0 through this extension: loopback captures on all five models recompute
  `cch`, carry Stainless `0.128.0`, and keep pi's own betas
  (`mid-conversation-output-config`, `thinking-binding-controls`). Live Pi turns
  with extra usage **disabled** returned `OK` on all five models, and a bash
  tool round-trip passed on Sonnet 5.5, Opus 5, and Fable 5.1. Plan windows were
  charged; no third-party 400s.
- Official 2.1.288 changelog has no billing-header, `cch`, beta-set, or OAuth entry.
  It adds `CLAUDE_CODE_DISABLE_STRUCTURED_OUTPUTS` and limits background-command
  timeouts to unattended sessions (`-p`, Agent SDK, CI, cloud). Neither changes
  this fork's request shape.

# 0.7.6 (2026-10-02) — fork release

### Changed

- **Verified Claude Code 2.1.287 `sdk-cli` fingerprint** while keeping the coherent
  Agent SDK persona. Installed-version discovery stays primary; `FALLBACK_CC_VERSION`
  is `2.1.287`.
- **Stainless package version** is `0.127.0` (was `0.112.1`). It moved in 2.1.285
  and is unchanged through 2.1.287. Runtime `v26.3.0` and timeout `600` did not move.
- **Sonnet 5.5** now gets `mid-conversation-tool-changes-2026-07-01` as well as
  `per-turn-control`, matching Fable 5.1 / Opus 5.5. The 2.1.287 model catalog adds
  `mid_conv_tool_change`; 2.1.284–2.1.286 did not. Sonnet 5 still has neither extra.
- Still omit `afk-mode` and `dangerous-tool-use`: 2.1.287 sends them only from auto
  mode, with the `safeguards` body. Non-auto `-p` and Pi do not.

### Verified

- Native `claude -p` 2.1.287 loopback captures (`--permission-mode dontAsk`; Sonnet 5,
  Opus 5, Opus 5.5, Fable 5.1, Sonnet 5.5): version suffix `5a4` for
  `Reply with exactly: OK`; cch values `f5763` / `cbaaf` / `68b04` / `26e89` /
  `92a06` recompute exactly under the unchanged seed.
- Billing-header field order, `cch` hash view, Agent SDK identity, `?beta=true`,
  `x-claude-code-request-class`, and `x-claude-code-prompt-id` are unchanged.
  OAuth refresh is still JSON `POST https://platform.claude.com/v1/oauth/token`
  with client id `9d1c250a-e61b-44d9-88ed-5944d1962f5e`. The 401 body is still
  `OAuth access token has been revoked` (the new "OAuth token revoked" string is
  Claude Code's display copy, not the API body).
- Binary-only betas not on these captures, so not advertised: `cache-keepalive-2026-09-03`,
  `timing-2026-09-09`, `inline-tools-2026-09-15`. `user-profiles-2026-08-18` is a
  `/v1/user_profiles` beta, not a messages beta.
- Official 2.1.285–2.1.287 changelog has no billing-header, `cch`, or beta-set entry.
  The Stainless bump and the Sonnet 5.5 capability are capture findings, not changelog items.

# 0.7.5 (2026-09-29) — fork release

### Fixed

- **auth.json wipe under concurrent pi processes.** `syncAuthJson` did an
  unlocked read-modify-write and "started fresh" on an empty or unparsable
  file. When it read auth.json during pi's (or another process's)
  truncate-then-write, it rewrote the file with only `anthropic`, dropping every
  other provider's credentials. Seen 2026-09-11 and 2026-09-29, both right after
  parallel subagent launches. Now:
  - takes pi's own `auth.json.lock` (proper-lockfile-compatible mkdir lock,
    30s stale window, 500ms wait, skip on contention);
  - never writes when an existing auth.json is empty, unparsable, or not an
    object;
  - writes via temp file + rename, so readers never see a partial file;
  - skips the write when the `anthropic` entry is already current, so the
    5-minute sync timer is normally a no-op.
- `oauth.refreshToken` no longer calls `syncAuthJson`: pi invokes it while
  holding the auth.json lock and persists the returned credentials itself.

### Verified

- New multi-process test (`src/auth-json-concurrency.test.ts`): 6 sync workers
  plus 2 pi-style writers using pi's real proper-lockfile; fails on 0.7.4,
  passes on 0.7.5. Unit tests cover empty/corrupt files, held and stale locks,
  and no-op syncs.

# 0.7.4 (2026-09-28) — fork release

### Changed

- **Verified Claude Code 2.1.284 `sdk-cli` fingerprint** while keeping the coherent
  Agent SDK persona. Installed-version discovery stays primary; `FALLBACK_CC_VERSION`
  is `2.1.284`.
- **Billing header** gains native first-turn `cc_prompt_index=0; cc_turn_index=1`
  after `cc_turn_origin`. Later-turn counters are not tracked (same class of
  omission as `cc_prev_req`).
- **Beta delta vs 2.1.283:** drop `advisor-tool-2026-03-01` from the common
  sdk-cli set (feature-gated; absent from all five live `-p` captures).
  `claude-sonnet-5-5` gets `per-turn-control` but not mid-conversation tool
  changes. Still omit `afk-mode` and `dangerous-tool-use`: 2.1.284 defaults bare
  `-p` to auto mode, but non-auto `-p` (dontAsk/manual/acceptEdits) and Pi do not
  send the coupled `safeguards` body.
- Stainless identity, `cch` seed/hash view, and version-suffix algorithm are
  unchanged. `x-cc-atis` and `anthropic-dispatch-id` stay omitted.

### Verified

- Native `claude -p` 2.1.284 loopback captures (Sonnet 5, Opus 5, Opus 5.5,
  Fable 5.1, Sonnet 5.5): version suffix `f4f` for `Reply with exactly: OK`;
  cch values `a3c4c` / `f53b0` / `5e5a4` / `7aca3` / `9615a` recompute exactly
  under the unchanged seed.
- Non-auto permission modes drop `afk-mode`, `dangerous-tool-use`, and
  `safeguards`; billing still has `cc_prompt_index` / `cc_turn_index`.
- Official 2.1.284 changelog: Sonnet 5.5 (`claude-sonnet-5-5`, 1M context),
  default auto mode for interactive (and, as captured, bare `-p`). No OAuth
  token-endpoint change.

# 0.7.3 (2026-09-26) — fork release

### Changed

- **Verified Claude Code 2.1.283 `sdk-cli` fingerprint** while keeping the coherent
  Agent SDK persona. Installed-version discovery stays primary; `FALLBACK_CC_VERSION`
  is `2.1.283`.
- **Beta delta vs 2.1.278:** stop advertising `afk-mode-2026-01-31` on main traffic
  (2.1.283 sends it only from auto mode). `claude-opus-5-5` now gets the same
  per-turn-control gate as Fable 5.1, ahead of mid-conversation tool changes.
- **`x-claude-code-prompt-id`** is copied from the billing block's `cc_prompt_id`.
  `anthropic-dangerous-direct-browser-access: true` matches the Claude Code SDK
  client. `anthropic-dispatch-id` and `x-cc-atis` stay omitted: the first is a
  remote gate, the second was present on only one of four live captures.
- **OAuth refresh matches 2.1.283:** `POST https://platform.claude.com/v1/oauth/token`
  with a JSON body and the issued scope list. Client id is unchanged.
- **Revoked-token 401:** re-read Keychain/file before refreshing, and replay the
  request once if a different access token is available. A concurrent Claude Code
  rotation revokes the access token Pi still holds; refreshing the already-rotated
  refresh token is worse than adopting the new one.

### Verified

- Native `claude -p` 2.1.283 loopback captures (Sonnet 5, Opus 5, Opus 5.5,
  Fable 5.1): version suffix `284` for `Reply with exactly: OK`; cch values
  `f273b` / `2f5ff` / `7eb44` / `f0548` recompute exactly under the unchanged seed.
- Pi-black's 2.1.280 patch only bumps a version constant. It does not cover the
  2.1.283 beta, prompt-id, or token-endpoint changes above.
- Both token hosts still answer `invalid_grant` for a fake refresh token. Native
  refresh nevertheless uses `platform.claude.com` and `application/json`.

# 0.7.2 (2026-09-19) — fork release

### Changed

- **Verified Claude Code 2.1.278 `sdk-cli` fingerprint** while keeping the coherent
  Agent SDK persona (`cc_entrypoint=sdk-cli`, Agent SDK identity,
  `cc_turn_origin=sdk`). Interactive `cli` remains dormant contingency only.
- **Recursive `cch` hash view:** every string-valued `model` key is emptied at any
  depth (fixes Opus/Fable advisor nested `model`). Hash view keeps `fallbacks`
  and drops only dispatch-only `max_tokens` / `fallback_credit_token`. Pi still
  strips array `fallbacks` from the wire body (OAuth schema).
- **2.1.278 beta set (native `--print`):** add `advisor-tool` and
  `thinking-binding-controls`; stop advertising bare `server-side-fallback` /
  `fallback-credit` on main traffic; gate `thinking-display-updates` on
  `thinking.display === "updates"` only.
- Billing header gains `cc_turn_origin=sdk`; headers gain
  `x-claude-code-request-class: main`. `x-cc-atis` and process-global
  `cc_prev_req` are deliberately omitted.
- `FALLBACK_CC_VERSION` advanced to `2.1.278` (installed discovery stays primary).
- **Oracle tooling:** `pnpm run capture`, `verify:fingerprint`, pi capture
  redirect, interactive TUI driver (research only). `lane:check` gains
  `--replay`, third-party / invalid / plan / extra-usage / blocked /
  inconclusive verdict classes, and a false-green caveat on the tiny A/B probe.

### Verified

- Native `claude -p` 2.1.278 loopback captures (Sonnet 5, Opus 5, Fable 5.1):
  cch `27ff3` / `67c38` / `a8630`, suffix `773` for `Reply with exactly: OK`;
  nested advisor `model` on Opus/Fable; beta delta vs fork empty after upgrade.
- Real Pi path-package wire captures through this extension: cch recomputes;
  live `--replay` HTTP 200 `class=plan` on all three models with extra usage
  disabled (`overageStatus=rejected`).
- Negative control: same Pi body with `cli` + human turn origin → HTTP 400
  third-party classifier (oracle discriminates).
- `pnpm test` 62/62; `pnpm build`, `oxlint`, `oxfmt --check` clean.

# 0.7.1 (2026-09-17) — fork release

### Changed

- Re-verified Claude Code 2.1.274 and advanced the no-install fallback from
  `2.1.273` to `2.1.274`. Normal requests already reported 2.1.274 immediately
  through installed-version discovery; no production request shaper changed.
- Added the live 2.1.274 version-suffix vector (`Reply with exactly: OK` →
  `9be`) and updated the fingerprint record.

### Verified

- Official 2.1.274 changelog reviewed. Its changes concern memory warnings,
  MCP behavior, telemetry, gateways, UI, agents, and reliability; none changes
  the direct first-party OAuth request fingerprint.
- Native Fable 5.1, Opus 5, and Sonnet 5 loopback captures match 2.1.273 in
  beta sets, body keys, billing-header layout, CCH hash view/seed, and Stainless
  identity. Their native 2.1.274 CCH values (`3cf31`, `2c9b4`, `03989`) and
  `9be` suffix all reproduce exactly.
- Pi-through-extension loopback captures report 2.1.274 automatically, contain
  every matching native beta plus only Pi's required feature betas, and their
  CCH values (`19880`, `4dead`, `521bf`) recompute exactly.
- Live Pi requests on Fable 5.1, Opus 5, and Sonnet 5 all returned HTTP 200 with
  `overage-utilization: 0.0`; extra-usage credits remained unchanged and the
  usage breakdown remained 100% Claude Code.
- `pnpm test` 57/57 pass; `pnpm build`, `oxlint`, and `oxfmt --check` clean.

# 0.7.0 (2026-09-16) — fork release

### Changed

- **Re-verified the complete request fingerprint against Claude Code 2.1.273.**
  The billing-header builder, version suffix algorithm, `cch` seed/hash view,
  `X-Stainless-*` identity, `?beta=true`, and request/session IDs are unchanged.
  `FALLBACK_CC_VERSION` is now `2.1.273`; installed-version discovery remains
  the normal path.
- **Track the current common and model-gated beta fingerprint.** A remote gate
  now makes both 2.1.270 and 2.1.273 emit `afk-mode-2026-01-31` for Fable 5.1,
  Opus 5, and Sonnet 5. Model-specific additions are reproduced too:
    - Fable 5.1: per-turn control, mid-conversation tool changes, server-side
      fallback, and fallback credit
    - Opus 5: mid-conversation tool changes and fallback credit
    - Sonnet 5: no additional model-gated entries

  Pi's own derived betas remain authoritative and additive, so its 1M-context
  and per-message-effort features are preserved.
- **Make `lane:check` use the production shaping functions** instead of its own
  narrower static approximation. It now includes the Stainless headers,
  client-request ID, current model-specific betas, and supports
  `pnpm run lane:check fable`.

### Verified

- Three native loopback captures (Fable 5.1, Opus 5, Sonnet 5) reproduce their
  2.1.273 `cch` values exactly under the unchanged seed
  `0x4d659218e32a3268` (`57d14`, `8e558`, `eab20`). The version suffix is `e59`
  for `Reply with exactly: OK` on all three.
- Three end-to-end Pi loopback captures through this extension contain every
  beta in the matching native request, plus only Pi's required feature betas;
  their emitted `cch` values recompute exactly.
- Live Pi requests through the extension on `claude-fable-5-1`,
  `claude-opus-5`, and `claude-sonnet-5`: all HTTP 200,
  `overage-utilization: 0.0`, plan-window utilization reported, and Anthropic's
  usage endpoint showed no increase in extra-usage credits.
- Official 2.1.271–2.1.273 changelog reviewed. The new 2.1.273
  `x-claude-code-*` gateway hint headers are opt-in and absent from default
  first-party OAuth traffic; the 2.1.271 `[1m]` resume fix is already covered
  by per-request model gating. No other entry changes this fork's request path.
- Real OAuth refresh returned HTTP 200, rotated both tokens, wrote them back to
  macOS Keychain, and a follow-up usage query succeeded with the new token.
- `pnpm test` 56/56 pass; `pnpm build`, `oxlint`, and `oxfmt --check` clean.

# [0.6.0](https://github.com/pankajudhas81/pi-claude-auth/compare/v0.5.1...v0.6.0) (2026-09-13) — fork release

### Changed

- **The Claude Code release version is no longer pinned — it is read from the
  installation.** `CC_VERSION` was a copy of a value that moves upstream every
  release, so it went stale silently and every Claude Code update needed a code
  change. `getCliVersion()` now resolves the newest release under
  `~/.local/share/claude/versions` per request (see `src/claude-version.ts`).
  The version is not decoration: it goes on the wire as `user-agent` and inside
  `cc_version=`, and it is hashed into the version suffix, so a stale copy was
  both a rejection risk (`claude_code_version_too_old`) and a fingerprint
  mismatch.

    - `FALLBACK_CC_VERSION` covers a machine with no Claude Code installed; it is
      announced once on stderr when used, rather than falling back silently
    - `ANTHROPIC_CLI_VERSION` keeps working and wins over anything on disk
    - resolution is per request, not cached, so a mid-session Claude Code update
      is picked up by the next request with no restart

- **The user-agent is re-asserted per request in the fetch patch.** It was set
  once at extension load through `pi.registerProvider`, so a Claude Code update
  mid-session would leave later requests claiming the old release while the
  billing header — rebuilt per request — claimed the new one. A side effect:
  auxiliary requests (compaction, background agents) now carry the Claude Code
  user-agent, the `X-Stainless-*` headers and the merged beta set, since the
  fetch patch sees every OAuth request.

- Test assertions no longer encode a release number. `transforms.test.ts`
  asserted `cc_version=2.1.267.<suffix>` literally and broke the moment the
  version resolved from disk — it now matches the shape, with the
  version-specific vectors kept in `signing.test.ts` where the version is an
  explicit input.

- **Prose now uses Anthropic's vocabulary for billing.** "Lane" was this
  fork's own coinage; the terms that appear in Anthropic's response headers are
  **unified rate limits**, **session window** (5h), **weekly window** (7d),
  **overage**, and **extra usage**. Code identifiers, the `lane:check` npm
  script and `scripts/lane-check.ts` keep their names — including the
  output strings the script prints, now reworded to match.

### Verified

- Two live Claude Code 2.1.270 captures reproduce their native `cch`
  byte-exactly under the unchanged seed `0x4d659218e32a3268`
  (`say hi` → `2b83b`, `explain the number seven briefly` → `fe2eb`), and both
  `cc_version` suffixes reproduce (`f7f`, `658`).
- The 2.1.270 bundle is fingerprint-identical to 2.1.267: same billing-header
  builder, same beta registry, same per-model capability catalog, same
  `X-Stainless-*` constants.
- End-to-end capture of pi's own request through the extension: `cch`
  recomputes exactly, suffix matches, and the user-agent reports the installed
  release without any code holding that number.
- `pnpm run lane:check` on `claude-sonnet-5` and `claude-opus-5` (pi shape and
  Claude Code shape): all HTTP 200, `overage-utilization: 0.0`, 5h/7d plan
  buckets consumed — billing stayed on the plan windows.
- `pnpm test` 52/52 pass; `pnpm lint` and `tsc` clean.

# [0.5.1](https://github.com/pankajudhas81/pi-claude-auth/compare/v0.5.0...v0.5.1) (2026-09-11) — fork release

### Fixed

- **The captured Claude Code beta set is merged into pi's beta list instead of
  replacing it.** pi-ai treats a configured `anthropic-beta` header as a full
  replacement for the list it derives from a model's compat flags
  (`getBetaFeatures()`, pi-ai 0.85.1), and the extension declared
  `CLAUDE_CODE_BETAS` through `pi.registerProvider(...).headers`. That silently
  deleted `mid-conversation-output-config-2026-07-01` and
  `thinking-binding-controls-2026-08-01`, which pi adds for models carrying
  `compat.supportsMidConvoEffort` — `claude-fable-5-1` and `claude-opus-5`.
  Anthropic rejected those requests with
  `messages.1.output_config: Extra inputs are not permitted`, so both models were
  unusable on the subscription lane.

    - `src/index.ts` — no longer declares `anthropic-beta` as provider metadata
      (keeps `user-agent` / `x-app`)
    - `src/signing.ts` — adds `mergeCapturedBetas()`, called from the fetch patch
      after `applyClaudeCodeHeaderFidelity()`: pi's list and its order stay
      authoritative, the captured set is appended and de-duplicated.
      `CLAUDE_CODE_BETAS` itself is unchanged
    - `src/signing.test.ts` — encodes the invariant *never removes a beta pi
      computed*

  Side effect: the Claude Code beta fingerprint no longer leaks onto non-OAuth
  API-key requests, since the fetch patch only engages for `sk-ant-oat` tokens.

### Verified

- `pnpm test` 43/43 pass (3 new); `pnpm build`, `oxlint` and `oxfmt --check`
  clean.
- End-to-end through the extension's own `installClaudeCodeFetchPatch()`:
  `claude-fable-5-1` and `claude-opus-5` emit 15 betas — all 12 captured entries
  preserved, `context-1m-2025-08-07` still injected by the existing model-gated
  rule, plus pi's two per-message-effort betas. Body shape unchanged and the
  per-message `output_config.effort` value intact.
- `scripts/lane-check.ts` is deliberately untouched so the 2026-09-10 lane
  baseline stays comparable; its "shape B" is now marginally narrower than the
  extension's real traffic.

# [0.5.0](https://github.com/pankajudhas81/pi-claude-auth/compare/v0.4.0...v0.5.0) (2026-09-10) — fork release

### Changed

- Bump pinned Claude Code version `2.1.266` → **`2.1.267`** (`src/signing.ts`,
  build 2026-09-09T17:26:03Z, git `a9e1808c8204fef901336d54bac7d4ab442955cb`).
  2.1.267 is protocol-identical to 2.1.266 apart from the version string: same
  beta set, same `X-Stainless-*` identity headers, same body shape, same native
  `cch` hash view.

### Verified

- **Seed unchanged and confirmed:** two live Claude Code 2.1.267 captures
  (`/v1/messages?beta=true`, `sdk-cli`) are reproduced byte-exactly by
  `xxHash64(hash_view, 0x4d659218e32a3268) & 0xfffff` (`say hi` → `d68c4`;
  `explain the number seven briefly` → `59865`).
- `cc_version` suffix algorithm re-verified against live 2.1.267
  (`say hi` → `f30`; `explain the number seven briefly` → `75d`). Binary
  cross-check confirms the suffix input is the first text block of the first
  non-meta user message (native `tls` function), computed before meta reminders
  are merged into the serialized body.
- End-to-end capture of pi's own OAuth request through the extension: the
  emitted `cch` matches the same reference implementation, and the header/UA/
  beta/Stainless shape matches the 2.1.267 capture.
- Billing lane re-checked live 2026-09-10 (`pnpm run lane:check` and
  `lane:check opus`): HTTP 200, `overage-utilization: 0.0`, plan buckets
  consumed for both the pi shape and the 2.1.267 shape.

# [0.4.0](https://github.com/pankajudhas81/pi-claude-auth/compare/v0.3.0...v0.4.0) (2026-09-09) — fork release

### Changed

- Bump pinned Claude Code version `2.1.234` → **`2.1.266`** (`src/signing.ts`,
  build 2026-09-08T23:01:17Z, git `eb01d6090964`). Anthropic rejects stale
  versions with `claude_code_version_too_old` on newer models, so the pin is
  functional, not cosmetic.
- Refresh `CLAUDE_CODE_BETAS` to the live 2.1.266 first-party default set
  (adds `cache-diagnosis-2026-04-07`, keeps wire order). The model-gated
  `context-1m-2025-08-07` beta is now inserted per request for 1M-window
  models (fable-5, opus-4-6/7/8, opus-5, sonnet-4-5/4-6/5) and omitted for
  the 200K models (haiku-4-5, opus-4-5).
- Align remaining Stainless identity headers with Claude Code 2.1.266
  (`x-stainless-package-version: 0.112.1`, `x-stainless-timeout: 600`,
  `x-stainless-runtime-version: v26.3.0`) so pi's newer SDK does not stand out.
- `computeCchFromBody` now excludes `fallbacks` and `fallback_credit_token`
  from the hash view as well (matching Claude Code's own view), so pi-only
  fields can never perturb the `cch`.

### Verified

- **Seed unchanged and confirmed:** two live Claude Code 2.1.266 captures
  (`/v1/messages?beta=true`, `sdk-cli`) are reproduced byte-exactly by
  `xxHash64(hash_view, 0x4d659218e32a3268) & 0xfffff`, where `hash_view` is the
  final body with the `cch` digits zeroed, every `model` string emptied, and
  `max_tokens`/`fallbacks`/`fallback_credit_token` omitted.
- End-to-end capture of pi's own OAuth request through the extension: the
  emitted `cch` matches the same reference implementation, and the header/UA/
  beta/Stainless shape matches the 2.1.266 capture.
- `cc_version` suffix algorithm re-verified against live 2.1.266
  (`say hi` → `fce`; `Reply with exactly: PROBE_OK` → `687`).
- Billing lane re-checked live 2026-09-09 (`pnpm run lane:check` and
  `lane:check opus`): HTTP 200, `overage-utilization: 0.0`, plan buckets
  consumed for both the pi shape and the 2.1.266 shape.

# [0.3.0](https://github.com/pankajudhas81/pi-claude-auth/compare/v0.2.0...v0.3.0) (2026-08-17) — fork release

### Changed

- Live-captured Claude Code **2.1.234** request shape: Agent SDK identity
  line, `cc_prompt_id`, `metadata.user_id` from `~/.claude.json`, session and
  request-id headers, full `anthropic-beta` list, `?beta=true`.
- `cch` is now structure-aware XXH64 on the final SDK JSON (not SHA-256 of
  the user text). Seed is overridable via `ANTHROPIC_CCH_SEED` — the native
  Bun seed still rotates per Claude Code release.
- Stop relocating Pi's system prompt into the first user message.
- Strip Pi 0.84+ official-API `fallbacks` on Claude Code OAuth (opus-5 400).

# [0.2.0](https://github.com/pankajudhas81/pi-claude-auth/compare/v0.1.3...v0.2.0) (2026-08-06) — fork release

### Changed

- Bump pinned Claude Code version `2.1.160` → `2.1.222` (`src/signing.ts`):
  billing header `cc_version` and user-agent must track the current Claude
  Code release. Runtime override via `ANTHROPIC_CLI_VERSION` unchanged.
- pi ≥ 0.83 compatibility: `ModelRegistry.authStorage` was removed in pi 0.83,
  so same-session credential injection is now feature-detected (works on older
  pi). On 0.83+, auth.json seeding covers the next session and `/login` the
  current one.
- Compile against `@earendil-works/pi-coding-agent@^0.83.0` types
  (`OAuthCredential` export was removed; credential type now derived from
  `ProviderConfig`).

### Added

- `claude-sonnet-5` and `claude-opus-5` to the supported-models smoke test
  (`scripts/test-models.ts`); `CLI_VERSION` aligned to `2.1.222`.
- Pin-enforcement test for `CC_VERSION` (`src/signing.test.ts`).
- README: fork-status banner, updated supported-models table, version-pin and
  pi ≥ 0.83 troubleshooting notes.

## 0.1.3 (2026-06-04, upstream)

- (upstream: see git history)
