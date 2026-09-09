# Changelog

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
