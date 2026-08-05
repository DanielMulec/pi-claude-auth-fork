# Changelog

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
