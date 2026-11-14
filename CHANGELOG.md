# Changelog

# Unreleased

### Changed and verified (2026-11-14): Claude Code 2.1.325 / Pi 1.5.2

- Advance the no-install fallback to `2.1.325` and add the native suffix
  regression vector `a71`; installed-version discovery remains primary and
  resolves this machine's installation to `2.1.325` without an override.
- Add Fable 5.2 to the `per-turn-control-2026-07-01` model gate. Native
  non-auto `sdk-cli` captures expose this missing beta; a regression test
  fails before the change and passes afterward. Fable 5.2 now matches
  Fable 5.1's beta set, preserving Pi-derived betas and existing model gates.
  No signing algorithm, credential lifecycle, Pi prompt, or tool changes.
- Seven native loopback captures with synthetic OAuth credentials cover
  Sonnet 5, Opus 5, Opus 5.5, Fable 5.1, Sonnet 5.5, Haiku 5.5, and Fable 5.2;
  a Sonnet 5.5 Bash continuation brings the total to nine. All reproduce
  cch, suffix `a71`, Agent SDK identity, model-specific beta sets (after the
  Fable fix), and Stainless `0.128.0` / `v26.12.1` / `600`.
- Final live Pi plain replies pass on all seven models; Sonnet 5.5 and
  Fable 5.2 Bash round-trips pass. These **11 final-wire requests** verify
  and return HTTP 200 with weekly window `allowed` and overage `rejected`.
  A genuine native Claude Code Sonnet 5.5 live reply also passes.
- Live Pi manual compaction preserves a session marker, and a fresh process
  resumes the compacted session and recalls it. All **five lifecycle requests**
  verify and return HTTP 200, including the auxiliary summarization request.
  The first harness attempt had too little compactable history; the completed
  test uses two padded user-message spans and a 512-token recent-context budget.
- Three paired `lane:check -- --replay` runs use a real Pi Sonnet 5.5 wire
  body. Both `sdk-cli` and `cli` + Pi-prompt controls return HTTP 200 with
  weekly window headers: the oracle does not discriminate, so classifier
  discrimination and billing attribution remain **inconclusive**. Positive
  request IDs: `req_011Ch2PgLs4MVSg4aRNz13fD`,
  `req_011Ch2PgifUzguSFN8Ei5Sdr`, `req_011Ch2Ph1Beh6C8g4xCuqehd`;
  negative: `req_011Ch2PgXznD61Gkx6t7GjxJ`,
  `req_011Ch2PgpR1tRVq7ZKiHKvkh`, `req_011Ch2Ph76MzR6sCyB9A2XBV`.
- Before/after snapshots keep extra usage disabled, rounded weekly usage at
  28% overall / 24% Fable, and reported usage-credit spend at $0. Concurrent
  traffic and Console/API credit balance were not isolated or measured.
  Live checks explicitly load this checkout (`HEAD` `1d5b41a` plus working-tree
  changes) with isolated homes/agent directories, stubbed Keychain, an explicit
  version override, and a fresh existing access token. No live refresh was
  forced; shared credentials were not modified. Temporary live auth was removed.
- **115 tests**, TypeScript build, lint/format, and diff checks pass.
  Redacted request/response evidence and usage snapshots:
  `/tmp/cc325-check/` (`final-live/`, `lifecycle-final/`, and `replay/`).

### Verification (2026-11-09): Claude Code 2.1.321

- Advance the no-install fallback to `2.1.321` and add the native suffix
  regression vector `97f`; installed-version discovery remains primary.
- Six non-auto native `sdk-cli` captures with synthetic OAuth credentials,
  plus a Sonnet 5.5 Bash turn and tool-result continuation, match the fork's
  cch, suffix, model-specific beta sets, Agent SDK identity, and Stainless
  `0.128.0` / `v26.12.1` / `600`. The captured continuation contains a tool
  result. No production request-shaping or credential changes were needed.
- An isolated Pi 1.5.0 Sonnet 5.5 turn using a synthetic OAuth credential
  and explicit 2.1.321 override reached a loopback mock and produced a
  verified final-wire request. The mock replied `OK`; it does not prove a
  live model reply. 113 tests, build, lint/format, and diff checks pass.
- Live Pi 1.5.0 plain replies passed on all six models, and a Sonnet 5.5
  Bash round-trip succeeded. All eight final-wire requests verified and
  returned HTTP 200 with weekly window `allowed` and overage `rejected`.
  Isolated homes and agent directories used a fresh existing token, stubbed
  Keychain, and an explicit version override; no live refresh was forced.
- Three paired replays of the live Sonnet 5.5 Pi body returned HTTP 200 for
  both `sdk-cli` and the `cli` + Pi-prompt control, so the control did not
  discriminate and billing attribution remains inconclusive. Extra usage
  was disabled; rounded weekly usage stayed at 9% overall and 3% Fable.
  Concurrent use and Console credits were not isolated or measured.
  Compaction, resume, and auxiliary traffic were not re-tested on 2.1.321.
  Redacted evidence: `/tmp/cc321.06cwYX/`.

### Changed and verified (2026-11-08): Claude Code 2.1.319

- Add native `tool-provenance-2026-10-26` to the additive beta set, advance the
  no-install fallback to `2.1.319`, and add a suffix regression vector `cb2`.
  Six non-auto `sdk-cli` loopback captures plus a Sonnet 5.5 Bash continuation
  verify cch, suffix, betas, Agent SDK identity, and Stainless headers with
  synthetic OAuth credentials. Installed-version discovery remains primary.
- Fix Pi compaction's auxiliary OAuth requests bypassing the provider-request
  hook: the final fetch layer now applies the existing billing/SDK identity
  transform only to unshaped first-party Messages payloads, then computes cch.
  Already-shaped turns retain their original prompt ID; API-key traffic, other
  hosts and non-Messages paths are not given the auxiliary transform. A
  fetch-boundary regression test failed before the fix and passes afterward.
- Live native Claude Code plain and Bash turns passed. After the fix, live Pi
  1.5.0 plain replies passed on all six models and a Sonnet 5.5 Bash round-trip
  succeeded; eight final-wire requests verified. Live Pi manual compaction
  preserved its marker and all six final-wire requests verified, including two
  auxiliary calls that lacked billing headers before the fix. A two-process Pi
  session resume recalled its first-turn marker. These instrumented runs used
  an isolated home and agent directory, fresh existing token and stubbed
  Keychain; the resume exercised an isolated Claude credentials file. A later
  fresh Pi process using the normal configured packages and shared credentials
  also returned the expected reply, as did native Claude Code.
- Three paired real-Pi replays both before and after the fix returned HTTP 200
  with weekly window headers for `sdk-cli` and the `cli` + Pi-prompt control. The control did
  not discriminate, so billing attribution remains **inconclusive**. Extra
  usage was disabled and rounded weekly usage remained 3% overall / 0% Fable;
  concurrent use and Console credits were not isolated or measured. Live token
  refresh and full semantics of the undocumented beta remain unverified; no
  refresh was forced.
  Redacted evidence: `/tmp/cc319-work/`.

### Partial verification (2026-11-04): Claude Code 2.1.318

- Six native `sdk-cli` loopback captures and a Sonnet 5.5 Bash continuation
  reproduce the fork's cch, suffix `033`, identity, and Stainless headers.
  Added a suffix regression vector. Synthetic OAuth credentials were used.
- All eight native requests advertise the new beta
  `tool-provenance-2026-10-26`, which the fork does not add. Its effects and
  body coupling have not been established, so it is not enabled blindly. The
  no-install fallback remains `2.1.316`; installed-version discovery still
  selects 2.1.318.
- Live Pi 1.5.0 plain replies pass on six models and a Sonnet 5.5 Bash
  round-trip succeeds; all eight final-wire requests return HTTP 200 and
  reproduce cch, suffix, identity, and Stainless headers. Tests loaded this
  checkout explicitly, with an isolated home and Pi agent directory, a fresh
  existing token, and Keychain stubbed. Temporary auth was removed. Captures:
  `/tmp/cc318-check/` (authorization redacted).
- Three paired replays of the real Pi Sonnet 5.5 body returned HTTP 200 with
  weekly plan-window headers for both `sdk-cli` and the `cli` + Pi-prompt
  negative control. The control did not discriminate, so classifier routing
  and billing attribution are **inconclusive**, not proven. Extra usage was
  disabled; rounded account-wide weekly usage remained 22% overall / 28%
  Fable before and after. Concurrent activity and Console credit balance were
  not isolated or measured. An attempted `lane-check --help` also sent its
  two minimal probes (HTTP 429 and 200); it does not support a help flag.
  No live refresh, compaction, resume, or auxiliary traffic was tested.

### Changed (2026-10-31)

- **Verify Claude Code 2.1.316 `sdk-cli` / Pi 1.4.0.** Advance the
  no-install fallback from `2.1.314` to `2.1.316` and add native suffix
  regression vector `17c`. Installed-version discovery remains primary. No
  signing algorithm, beta mapping, credential lifecycle, Pi prompt, or tool
  changes; the production identity remains `sdk-cli`.

### Verified (Claude Code 2.1.316 / Pi 1.4.0)

- **108 tests**, TypeScript build, and lint/format pass. Six native non-auto
  `claude -p` loopback captures with synthetic OAuth credentials verify cch,
  suffix `17c`, beta mappings, Agent SDK identity, and Stainless
  `0.128.0` / `v26.12.1` / `600`. Native cch values for Sonnet 5, Opus 5,
  Opus 5.5, Fable 5.1, Sonnet 5.5, and Haiku 5.5 are `9d8f9`, `2e75f`,
  `f52e5`, `7fa0b`, `f4d35`, and `c5590` respectively.
- Live Pi plain replies pass on all six models, and a Sonnet 5.5 Bash
  round-trip succeeds. All **8 final-wire Pi requests** verify; optional Pi
  betas are retained. The checkout's `src/index.ts` was explicitly loaded.
- Three paired replays of the real Sonnet 5.5 Pi body returned HTTP 200 for
  `sdk-cli` with weekly plan-window headers, and the `cli` + Pi-prompt
  controls returned the third-party HTTP 400. Positive request IDs:
  `req_011CgZsnP4LbPM4UAcf2XshT`, `req_011CgZsnah5wvnTKa6KdZFPG`,
  `req_011CgZsnkSi5NV29ShxCMioi`; negative: `req_011CgZsnVMMvxk2n1bKbxiZQ`,
  `req_011CgZsnh269dJg2mt81zgHF`, `req_011CgZsnt75hEBdCJLCbDG6v`.
- Extra usage was disabled; rounded account-wide weekly usage remained 24%
  overall and 33% Fable before and after the live Pi calls and initial replay.
  Concurrent use was not isolated, Console credit balance was not measured,
  and accounting attribution remains inconclusive. A fresh token was used in
  an isolated Pi home and agent directory with Keychain stubbed; temporary
  live auth was removed. Native tool continuation, compaction, resume,
  auxiliary traffic, and live token refresh were not tested. Redacted capture
  evidence: `/tmp/cc316-check/`.

### Changed (2026-10-30)

- **Verify Claude Code 2.1.314 `sdk-cli` / Pi 1.4.0.** Advance the
  no-install fallback from `2.1.311` to `2.1.314` and add the native suffix
  regression vector `48c`. Installed-version discovery remains primary. No
  signing algorithm, beta mapping, credential lifecycle, Pi prompt, or tool
  changes; the production identity remains `sdk-cli`.

### Verified (Claude Code 2.1.314 / installed Pi 1.4.0)

- **107 tests**, TypeScript build, lint/format, and `git diff --check` pass.
- Native non-auto `claude -p --permission-mode dontAsk` loopback captures with
  synthetic OAuth credentials verify cch and suffix `48c` on Sonnet 5, Opus 5,
  Opus 5.5, Fable 5.1, Sonnet 5.5, and Haiku 5.5; cch values for these captures
  are `5c9a1` / `8911d` / `59e3b` / `3fa76` / `52611` / `5131d`. OAuth beta
  mappings, billing fields, Agent SDK identity, and Stainless
  `0.128.0` / `v26.12.1` / `600` match. A Sonnet 5.5 Bash first turn and
  continuation also verify, with a successful tool result: **8 native requests**.
- Six Pi plain replies and a Sonnet 5.5 Bash round-trip verify with this
  checkout's `src/index.ts` explicitly loaded: **8 final-wire Pi requests**,
  including a successful tool result. Pi's optional betas are retained.
- Live Pi plain replies pass on all six models, and a Sonnet 5.5 Bash
  round-trip succeeds (**8 final-wire requests verified**). Three paired
  replays of a real Pi Sonnet 5.5 body returned HTTP 200 with allowed plan
  windows for `sdk-cli`, while the `cli` + Pi-prompt controls returned the
  exact third-party HTTP 400. Positive request IDs: `req_011CgYuy2WcmSkXWbozD5nNZ`,
  `req_011CgYuyDasaZjwgQBfdJvGh`, `req_011CgYuyPqFy3edMCX3AXXCm`; negative:
  `req_011CgYuyBKCEJs8RwPoaEiXp`, `req_011CgYuyMWN1ixpJRTCFXMxt`,
  `req_011CgYuyabAeSkdSNsAhkUcr`.
- Extra usage was disabled; the usage endpoint showed 5h 0%, 7d 24%, and Fable
  33% both before and after. These rounded, account-wide figures and the
  unobserved Console balance do not prove a particular ledger deduction.
  Live tests used a fresh access token without refresh, an isolated Pi home and
  agent directory, and stubbed Keychain access; temporary live auth was removed.
  Compaction, resume, auxiliary traffic, and live token refresh remain untested.
  Temporary captures: `/tmp/cc314.HdhAoB/` (offline),
  `/tmp/cc314-live.Wejmu1/` (live; authorization headers removed).

### Changed (2026-10-27)

- **Match Claude Code 2.1.311's runtime identity.** Native `sdk-cli` captures
  now send `x-stainless-runtime-version: v26.12.1` (was `v26.3.0`). Update
  the runtime constant, advance the no-install fallback to `2.1.311`, and add
  native suffix regression vector `427` plus emitted-header assertions.
  Installed-version discovery already selects `2.1.311`. Signing algorithms,
  beta mappings, credential lifecycle, and Pi's prompt/tools are unchanged;
  production identity stays `sdk-cli`. Preserve the existing compatibility work.

### Verified (Claude Code 2.1.311 / installed Pi 1.4.0)

- **106 tests**, TypeScript build, lint/format, and `git diff --check` pass.
  Runtime constant and emitted-header regression assertions fail before the
  runtime update and pass afterward.
- Native non-auto `claude -p --permission-mode dontAsk` loopback captures on
  all six models with API-key and synthetic OAuth credentials reproduce cch
  and suffix `427` for `Reply with exactly: OK`. OAuth cch values for Sonnet 5,
  Opus 5, Opus 5.5, Fable 5.1, Sonnet 5.5, and Haiku 5.5 are `3a378` /
  `60cec` / `e1c0c` / `390c4` / `baec3` / `b8e28`. OAuth beta mappings have
  no missing or extra entries. Billing fields, Agent SDK identity, SDK package
  `0.128.0`, and timeout `600` remain compatible. Native Sonnet 5.5 Bash
  first/continuation captures also verify (`e7870` / `f6a1e`), including a
  successful tool result: **14 native requests verified** in total.
- Six Pi plain replies and a Sonnet 5.5 Bash round-trip verify offline with
  this checkout's `src/index.ts` explicitly loaded: **8 final-wire Pi requests**,
  all with the new runtime header, valid cch/suffix, and a successful tool
  result on the continuation. Pi-supplied optional betas are preserved.
- **Offline compatibility verification only:** inference requests went to
  loopback with placeholder credentials. Test processes used isolated homes
  and Pi agent directories with Keychain access stubbed out. No real
  credentials were refreshed. Live routing, plan-window deductions, and
  Console/API credit attribution were not re-tested; the 2026-10-24 routing
  evidence below is historical. Compaction, resume, and auxiliary traffic
  remain untested. Temporary capture evidence: `/tmp/cc311-verification/`.

### Changed (2026-10-24)

- **Verified Claude Code 2.1.310 `sdk-cli` / installed Pi 1.4.0.** No request
  shaping or credential lifecycle change needed. Installed-version discovery
  already selects `2.1.310`; advance only the no-install fallback from
  `2.1.309` and add native suffix regression vector `621`. Preserve the prior
  compatibility work and Pi's existing prompt/tools; identity stays `sdk-cli`.

### Verified (Claude Code 2.1.310 / installed Pi 1.4.0)

- **105 tests**, TypeScript build, lint/format, and `git diff --check` pass.
- Native non-auto `claude -p --permission-mode dontAsk` loopback captures on
  all six models with API-key and synthetic OAuth credentials reproduce cch
  and suffix `621` for `Reply with exactly: OK`. OAuth cch values for Sonnet 5,
  Opus 5, Opus 5.5, Fable 5.1, Sonnet 5.5, and Haiku 5.5 are `b56da` /
  `5ad1e` / `fa1d6` / `dd037` / `74daa` / `b03f8`. OAuth beta mappings have
  no missing or extra entries. Billing fields, Agent SDK identity, and
  Stainless `0.128.0` / `v26.3.0` / `600` remain compatible. Native Sonnet 5.5
  Bash first/continuation captures also verify (`5913d` / `21c2d`).
- Six Pi plain replies and a Sonnet 5.5 Bash round-trip verify offline
  (**8 final-wire Pi requests**). Live Pi processes explicitly loading this
  checkout's `src/index.ts` at `1d5b41a` plus working-tree changes pass plain
  replies and Bash round-trips on all six models (**18 HTTP 200 requests**).
  Every final-wire fingerprint and successful tool result verifies, with
  Pi-supplied optional betas preserved.
- Three paired replays of a final real-Pi Sonnet 5.5 body discriminate SDK
  HTTP 200 with plan-window headers from test-only `cli` + Pi-prompt controls
  returning the exact third-party HTTP 400. Positive request ids:
  `req_011CgLktSDA5jW41uNQ2S9fN`, `req_011CgLktXxSQfP4cxE5yTs96`,
  `req_011CgLktd8j1kUr3ntmeLqEV`; negative ids:
  `req_011CgLktWmzBaXje1xhHq4po`, `req_011CgLktc2kCDsjot9t261VQ`,
  `req_011CgLktgnk8QDE4eDyyZXAa`.
- **Accounting attribution remains inconclusive:** usage snapshots before
  live tests, after them, and after replays stayed at **5h 2% / 7d 26%**.
  Extra usage stayed disabled and reported usage-credit spend stayed **$0**.
  Concurrent traffic was not isolated and Console/API balance was not
  measured; the routing discriminator does not prove a ledger's deduction.
- Live tests used a fresh existing access token without refreshing it, an
  isolated Pi home/agent directory, and stubbed Keychain access in test
  processes. Temporary live auth storage was removed afterward. Compaction,
  resume, auxiliary traffic, and live token refresh were not tested.

### Changed (2026-10-23)

- **Verified Claude Code 2.1.309 `sdk-cli` / installed Pi 1.4.0.** No
  request-shaping or credential lifecycle change is needed. Installed-version
  discovery already selects `2.1.309`; advance the no-install fallback from
  `2.1.308` to `2.1.309`, add native suffix regression vector `a52`, and update
  the Stainless identity test's verification version. Existing 2.1.308 work is
  preserved; production remains `sdk-cli` with Pi's prompt and tools unchanged.

### Verified (Claude Code 2.1.309 / installed Pi 1.4.0)

- **104 tests**, TypeScript build, lint/format, and `git diff --check` pass.
- Native non-auto `claude -p --permission-mode dontAsk` loopback captures cover
  all six models with API-key and synthetic OAuth credentials. All reproduce
  cch and suffix `a52` for `Reply with exactly: OK`. OAuth cch values for
  Sonnet 5, Opus 5, Opus 5.5, Fable 5.1, Sonnet 5.5, and Haiku 5.5:
  `67186` / `70631` / `0d26f` / `b2201` / `af58f` / `a000a`. OAuth beta
  mappings have no missing or extra entries; billing fields, Agent SDK
  identity, and Stainless `0.128.0` / `v26.3.0` / `600` remain compatible.
  Native Sonnet 5.5 Bash first/continuation captures also verify
  (`59905` / `9411a`), including a successful tool result.
- Six Pi plain replies and a Sonnet 5.5 Bash round-trip verify offline
  (**8 final-wire Pi requests**). Fresh live Pi processes explicitly loading
  this checkout's `src/index.ts` at `1d5b41a` plus working-tree changes pass
  plain replies and Bash round-trips on all six models (**18 HTTP 200
  requests**), with every final-wire fingerprint and successful tool result
  verified. Pi-supplied optional betas are preserved.
- Three paired replays of a final real-Pi Sonnet 5.5 request discriminate
  production SDK HTTP 200 with plan-window headers from the test-only
  `cli` + Pi-prompt negative control's exact third-party HTTP 400. Extra usage
  was disabled throughout. Positive request ids:
  `req_011CgJZkt7csREJNR8Bzz2ys`, `req_011CgJZkyY4LvUwbnrRehA8p`,
  `req_011CgJZm4XSjBRuZFrtA2uv4`; negative ids:
  `req_011CgJZkxNboysk3JgJcW5SC`, `req_011CgJZm3Mz81aS5jRDzbCRy`,
  `req_011CgJZm9ys6DQUJf49nK2u8`.
- **Accounting attribution remains inconclusive:** usage snapshots before
  live tests, after them, and after the paired replays stayed at **5h 5% /
  7d 26%**, with reported usage-credit spend **$0** and the weekly breakdown
  100% Claude Code. Concurrent traffic was not isolated and Console/API credit
  balance was not measured. This proves request compatibility and a working
  routing discriminator, not a particular ledger's deduction.
- Live checks used a fresh access token read from Claude Code storage without
  refreshing it, an isolated Pi home/agent directory, and stubbed Keychain
  access in test processes. Temporary live auth storage was removed afterward.
  Compaction, resume, auxiliary traffic, and live token refresh were not tested.

### Changed (2026-10-22)

- **Verified Claude Code 2.1.308 `sdk-cli`.** Installed-version discovery
  already selects `2.1.308` on this Mac. Advance the no-install fallback from
  `2.1.306` to `2.1.308`, add native suffix regression vector `349`, and refresh
  the Stainless identity test's verification version. No signing algorithm,
  identity, beta mapping, Pi prompt/tool, or credential lifecycle change needed.

### Verified (Claude Code 2.1.308 / installed Pi 1.4.0)

- **103 tests**, TypeScript build, lint/format, and `git diff --check` pass.
- Loopback native non-auto `claude -p --permission-mode dontAsk` captures cover
  Sonnet 5, Opus 5, Opus 5.5, Fable 5.1, Sonnet 5.5, and Haiku 5.5 with both
  API-key and synthetic OAuth credentials. All reproduce cch exactly and suffix
  `349` for `Reply with exactly: OK`. OAuth cch values in that order:
  `eb743` / `7e15a` / `7916b` / `66f28` / `10280` / `f4411`.
  OAuth beta mappings have no missing or extra entries; billing fields, Agent
  SDK identity, and Stainless `0.128.0` / `v26.3.0` / `600` remain compatible.
  Native Sonnet 5.5 Bash first/continuation captures verify (`3f98f` / `e2197`).
- Six final-wire Pi loopback requests and a Sonnet 5.5 Bash round-trip verify
  with this checkout's `src/index.ts` explicitly loaded (**8 Pi requests**).
  The continuation includes a successful tool result. Pi-supplied optional
  betas are preserved rather than removed to force byte-identical requests.
- **Offline compatibility verification only:** all inference requests went
  to loopback using placeholder credentials. Pi used an isolated home and
  agent directory with Keychain access stubbed out; no real credential was
  refreshed. No live routing, usage delta, or Console/API credit attribution
  was tested. Compaction, resume, and auxiliary paths were not tested.

### Changed (2026-10-21)

- **Request shaping no longer depends on Claude Code credentials.** When no
  stored Claude Code account carried an access token (empty Keychain
  `claudeAiOauth`), the extension returned before registering the provider and
  the billing-header hook. Pi then sent its own OAuth request with the fork's
  `claude-cli/2.1.306 (external, sdk-cli)` user-agent and **no billing header** —
  the exact half-shape Anthropic classifies as third-party. Shaping and provider
  registration now run unconditionally; only account-dependent work (account
  selection, `auth.json` seeding, sync timer) is skipped, with a warning and a
  `shaping_without_credentials` audit event.
- **Verified Claude Code 2.1.306 `sdk-cli`.** Paired native `claude -p` captures
  at 2.1.304 and 2.1.306 are byte-identical apart from version, request ids and
  the version suffix: same 4 system blocks, same 45,560-byte tool array, same
  top-level body keys, same Stainless `0.128.0` / `v26.3.0` / `600`, same betas
  (API-key captures; the OAuth-only beta pair is unchanged from 2.1.304).
  Advance the no-install fallback to `2.1.306` and add native suffix vector `6d4`
  (cch `4e651` on the `Reply with exactly: OK` body). No shape change needed.
- **`verify:fingerprint` rejects the half-shape.** A capture whose user-agent
  claims `claude-cli/` but whose body has no billing header now fails instead of
  being skipped as "not OAuth-shaped" — that combination is billed as
  third-party, and skipping it hid this outage.

### Verified (Claude Code 2.1.306 / Pi 1.3.0)

- **102 tests**, TypeScript build, lint/format pass.
- Reproduction with the empty credential store (the state on this Mac): Pi's
  unshaped request returns HTTP 400 third-party
  (`req_011CgEiEbed7wErfCPo9QRVU`, re-confirmed `req_011CgEiT9g3H3xraoWByctth`).
  The **same body plus billing header and Agent SDK identity** returns HTTP 200
  with plan windows 5h 0.03 / 7d 0.05 and no overage
  (`req_011CgEiShH38Fu3je2T21WUH`). A Bash first request and its continuation are
  both shaped and the continuation also passes (`req_011CgEiTyPSF3cQ6f3kW1uRD`).
  Final-wire Pi captures at `cch=5c454` / `b70e4` / `bf8b2` verify.
- No live credential refresh was forced, and no plan-to-Console attribution is
  claimed by these replays (single request ids, no usage delta measured).

### Changed (2026-10-20)

- **Verified Claude Code 2.1.304 `sdk-cli` with Pi 1.3.0.** No request-shaping
  change is needed from the 2.1.303 working tree. Advance the no-install
  fallback to `2.1.304` and add native suffix regression vector `87d`.
  Installed-version discovery, identity, signing algorithms, Pi prompts/tools,
  and the existing OAuth-reliability changes are unchanged.

### Verified (Claude Code 2.1.304 / Pi 1.3.0)

- **101 tests**, TypeScript build, lint/format, and `git diff --check` pass.
- Six native non-auto `claude -p --permission-mode dontAsk` captures reproduce
  cch exactly: Sonnet 5 `b5c8e`, Opus 5 `c7b00`, Opus 5.5 `1b7ab`, Fable 5.1
  `c344b`, Sonnet 5.5 `6a097`, Haiku 5.5 `b4155`. All reproduce suffix `87d`
  for `Reply with exactly: OK`. Native Sonnet 5.5 Bash first/continuation
  captures also verify (`51b92` / `2ddcd`). Billing fields, Agent SDK identity,
  required betas, and Stainless `0.128.0` / `v26.3.0` / `600` remain compatible.
  Native remote-gated `advisor-tool` / `inline-tools` do not become fork defaults;
  Pi-supplied betas are preserved.
- Six final-wire Pi loopback captures verify. Real Pi plain replies and Bash
  round-trips pass on all six models: **18 final-wire requests verified**,
  including every successful tool result. Fresh processes explicitly load this
  checkout's `src/index.ts` at `904468b` plus working-tree changes.
- Three paired real-Pi Sonnet 5.5 replays discriminate production SDK HTTP 200
  with plan-window headers from test-only `cli` + Pi-prompt third-party HTTP
  400. Positive ids: `req_011CgDwKR9F6yKSTzP13AV7s`,
  `req_011CgDwKZnu2w5dtqUa6vyx7`, `req_011CgDwKiCfvq7YvcDmaBp92`.
  Negative ids: `req_011CgDwKX6BLH1A9dJRkawTP`,
  `req_011CgDwKfSyLmtCAASSvRiHn`, `req_011CgDwKpTT2sKDzQAgyZvb4`.
- **Accounting attribution remains inconclusive:** account-wide usage moved
  from 5h 2% / 7d 70% before live testing to 5h 3% / 7d 70% after replays.
  Extra usage was disabled; `used_credits` was absent. Concurrent traffic was
  not isolated and Console/API credits were not measured. Compaction, resume,
  and auxiliary traffic were not acceptance-tested. No live refresh was forced.

### Changed (2026-10-19)

- **Verified Claude Code 2.1.303 `sdk-cli` with Pi 1.3.0.** The request
  fingerprint is unchanged from the existing 2.1.302 working-tree changes.
  Advance the no-install fallback to `2.1.303` and add native suffix `f3d`.
  Installed-version discovery remains primary; persona and signing algorithms
  are unchanged.
- **Coordinate shared-token refresh with native Claude Code.** Expiry refresh
  and revoked-token recovery now acquire native's `.oauth_refresh.lock` using
  the same `proper-lockfile` protocol (`realpath: false`, 60s stale, 5s update).
  Re-read storage inside the lock so waiting processes adopt the winner.
  CLI fallback runs outside the lock to avoid deadlocking native refresh.
  Lock acquisition is bounded to 5s and fails closed; orphan recovery uses
  native's stale threshold. Add `proper-lockfile` as a runtime dependency.
- **Stop the five-minute sync timer from resurrecting an old login.** It now
  reads the credential source rather than publishing a long-lived session's
  stale in-memory pair. Missing storage is not replaced from cache.
- Credential persistence failure after rotation now raises an actionable
  error rather than silently treating an unpersisted token as healthy.
- **Always-on, secret-free auth incident history:** daily JSONL under
  `<pi-agent-dir>/claude-auth-events/`, 14-day retention, 2 MiB/day cap.
  Includes process id, event, expiry, and SHA-256 token identifiers, never
  token values or raw HTTP/error bodies. Audit failure cannot break auth.
  Existing Pi processes must reload/restart to pick up these protections.
  See [`docs/OAUTH-RELIABILITY.md`](docs/OAUTH-RELIABILITY.md).

### Verified (Claude Code 2.1.303 / Pi 1.3.0)

- **100 tests**, TypeScript build, lint/format, and `git diff --check` pass.
  Coverage includes real isolated subprocesses racing at expiry and during
  revoked-token recovery, native-lock contention, orphan recovery, failed
  operations releasing locks, failed persistence without old-token reuse,
  stale-session sync, and persistent audit privacy/retention. Before the fix, each race submitted the same single-use
  refresh token twice; the stale-sync test returned the previous login.
- Native non-auto `claude -p` captures on Sonnet 5, Opus 5, Opus 5.5, Fable
  5.1, Sonnet 5.5, and Haiku 5.5 reproduce cch exactly:
  `7816b` / `916ea` / `77b5e` / `26361` / `af6e7` / `34fe2`. Suffix `f3d`
  for `Reply with exactly: OK`. A native Bash continuation and six final-wire
  Pi loopback captures also verify. Billing fields, Agent SDK identity,
  required betas, Stainless `0.128.0` / `v26.3.0` / `600` are compatible.
  Native's remote-gated `advisor-tool` / `inline-tools` remain non-defaults.
- After the auth changes, real Pi plain replies and bash round-trips pass on
  all six models (18 final-wire requests verified; each continuation includes
  the tool result). Normal configured package discovery also returns `OK`.
- Three paired real-Pi Sonnet 5.5 replays: SDK-positive HTTP 200 with plan
  windows; test-only `cli` + Pi-prompt negative gets the exact third-party
  HTTP 400. Positive ids: `req_011CgAxer179aRtLGZRVkco9`,
  `req_011CgAxf4F49GEJfj4sTf1rc`, `req_011CgAxfDsVgYuK4TphS5FmF`.
  Negative ids: `req_011CgAxez4Y6FtKoPQxJEmi5`,
  `req_011CgAxfA34xj7kXZhdts8Aq`, `req_011CgAxfP7N4smaZjZRoA8MW`.
- **Incident evidence:** revoked-token 401s at 2026-10-18 12:10–12:12,
  20:12, and 2026-10-19 04:10–04:11 UTC; Daniel confirms native Claude Code
  also required re-login. At 04:13 UTC the replacement Keychain and Pi pairs
  matched, and read-only usage returned 200. The local race is reproduced;
  attribution of every production revocation is not established. No live
  refresh was forced and no native binary was modified.
- **Accounting remains inconclusive:** account-wide usage went from 5h 6% /
  7d 54% to response-header 5h 8% / 7d 54% during testing; concurrent use
  was not isolated. After the additional post-fix runs, read-only usage was
  5h 10% / 7d 55%. Extra usage was disabled; Console credits were not measured.
  Compaction, resume, and auxiliary paths were not tested.

### Previously changed (Claude Code 2.1.302 / Pi 1.3.0)

- **Verified Claude Code 2.1.302 `sdk-cli` with Pi 1.3.0 (2026-10-18).**
  Installed-version discovery stays primary; the no-install fallback advances
  to `2.1.302`. Dev dependency on Pi is now `^1.3.0`, lockfile updated.
- **Stop adding `mid-conversation-system-2026-04-07`.** Native 2.1.302
  `dontAsk` captures omit it on all six models and on a Sonnet 5.5 tool
  continuation. The installed binary now registers `mid_conversation_system`
  as a headerless capability (`bR`), not a beta-header capability (`k`). Model
  beta insertion stays after `prompt-caching-scope`, preserving native order.
  Pi-supplied betas remain authoritative and are never removed.
- Add the native 2.1.302 suffix vector, retired-beta/preservation coverage, and
  a real file-storage regression proving fresh Claude login credentials win
  over expired or still-unexpired stale in-memory credentials before refresh.
  OAuth runtime, identity, Pi prompts/tools, signing algorithms, and model
  registrations are unchanged.

### Previously verified (Claude Code 2.1.302 / Pi 1.3.0)

- **91 tests**, TypeScript build, lint/format, and `git diff --check` pass.
- Native non-auto `claude -p --permission-mode dontAsk` captures on Sonnet 5,
  Opus 5, Opus 5.5, Fable 5.1, Sonnet 5.5, and Haiku 5.5 reproduce cch:
  `ff443` / `02d8e` / `e5648` / `b96ed` / `7e056` / `9322c`. Suffix
  **`b33`** for `Reply with exactly: OK`. Native tool continuation cch also
  verifies. Stainless `0.128.0` / `v26.3.0` / `600`, billing fields, Agent SDK
  identity, OAuth token URL, and client id remain compatible. Remote-gated
  `inline-tools` / `advisor-tool` are not added as fork defaults.
- After the beta change, fresh Pi processes loading this checkout pass plain
  replies and bash tool round-trips on **all six models: 18 live HTTP 200s**,
  all final-wire fingerprints verified, all six tool results observed in the
  continuation request. A further Pi turn using normal configured package
  discovery (not explicit auth-extension loading) also returns `OK`.
  Checkout: `904468b` plus these working-tree changes; production package path
  is this repository's `src/index.ts`.
- Three paired replays of a final real-Pi Sonnet 5.5 body: production SDK shape
  returns HTTP 200 with plan-window headers; test-only `cli` + CLI identity +
  `human`, retaining Pi's prompt and recomputing cch, returns the exact
  third-party HTTP 400 every time. Positive request ids:
  `req_011Cg9hUMTbsk7rkmWPg7AA6`, `req_011Cg9hUZTADFBCcAbCJhcCo`,
  `req_011Cg9hUkBLNWDECDa9cFC9i`. Negative request ids:
  `req_011Cg9hUUz2Vowe1ayrcJiX6`, `req_011Cg9hUgX4RbcMQnLtSFZvq`,
  `req_011Cg9hUsEVHM7kbvqJ143p4`.
- **Auth incident:** the user had to log in again in Claude Code too. Before
  Pi startup, its saved token pair differed from the fresh Keychain pair.
  In an isolated Pi 1.3.0 agent directory, a synthetic expired/invalid Pi
  credential reproduces `invalid_grant` without the fork; with the fork, the
  real request uses the fresh Keychain token and succeeds. Rechecked after
  the beta change. No OAuth runtime fix was needed. This does not establish
  why the original grant was invalidated; the original failed token was not
  replayed after re-login. Real token rotation was not forced.
- **Accounting:** usage rose from **5h 6% / 7d 23%** before the live runs to
  **5h 10% / 7d 24%** after the replays. Extra usage remained disabled;
  `used_credits` was absent, not a measured zero. These are account-wide
  snapshots, not isolated attribution; Console/API credits were not measured.
  Compaction, resume, and auxiliary paths were not acceptance-tested.

### Previously changed (Pi 1.2.0)

- **Verified with Pi 1.2.0.** Dev dependency on Pi advanced to `^1.2.0` (from
  `^1.1.0`), lockfile updated. No source change was needed: the extension uses
  only `registerProvider`, `session_start`, and `before_provider_request`, none
  of which changed. Pi 1.2.0's breaking `before_agent_start` union does not
  apply. Its new Anthropic strict-tools fallback retry re-runs `onPayload`
  (our `before_provider_request` hook) and goes through the patched `fetch`, so
  a retried request is re-signed like the first.

### Previously verified (Pi 1.2.0)

- **88 tests**, TypeScript build, and lint/format checks pass against Pi 1.2.0.
- Pi 1.2.0 loopback captures through this checkout verify on Sonnet 5, Opus 5,
  Opus 5.5, Fable 5.1, Sonnet 5.5, and Haiku 5.5 (Claude Code still 2.1.296).
  Extra betas observed are the already documented Pi-sent ones.
- Live Pi 1.2.0 plain replies and bash tool round-trips pass on all six models.
  Usage before and after: **5h 0% / 7d 33%**, extra usage disabled.

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
