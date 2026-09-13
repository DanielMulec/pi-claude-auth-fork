# Changelog

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
