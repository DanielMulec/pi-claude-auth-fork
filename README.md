# pi-claude-auth

> **Fork status (v0.7.1):** maintained fork of upstream `pi-claude-auth@0.1.3` (last upstream release 2026-06-04).
> Changes vs upstream:
>
> - **Claude Code version is read from the installation, not pinned** — the release number is resolved from `~/.local/share/claude/versions` on every request, so a Claude Code update needs no change here. `ANTHROPIC_CLI_VERSION` remains a manual override, and a constant covers machines with no Claude Code installed (announced on stderr when used)
> - **`cch` verified through live Claude Code 2.1.274** — the recovered seed (`4d659218e32a3268`) plus Claude Code's hash view (empty `model`, dropped `max_tokens`/`fallbacks`/`fallback_credit_token`) reproduces native `cch` on live captures
> - **The current beta fingerprint is merged into pi's, never substituted for it** — the 2.1.274 capture confirms the common set and Fable 5.1 / Opus 5 model-gated betas, while preserving every beta pi derives from model compatibility flags
> - **pi ≥ 0.83 compatibility**: `ModelRegistry.authStorage` (removed in 0.83) is now feature-detected; auth.json seeding + `/login` cover the current session
> - **New models added to the smoke-test list**: `claude-sonnet-5`, `claude-opus-5`

Self-contained Anthropic auth for the [pi coding agent](https://pi.dev) using
your existing Claude Code credentials — no separate login or API key needed.

## Quick start

```bash
pi install npm:@pankajudhas81/pi-claude-auth
```

Restart pi, pick a model with `/model` (or Ctrl+L). Done — your Claude Code
credentials are already seeded.

## Prerequisites

> **Claude Code must be installed and authenticated first.**
>
> The extension reads from your macOS Keychain entry
> `Claude Code-credentials`. Run `claude` at least once so the entry exists.
> On Linux/Windows, `~/.claude/.credentials.json` is used instead.

- [Claude Code](https://docs.anthropic.com/en/docs/claude-code/overview)
  installed and authenticated (run `claude` at least once)
- [pi](https://pi.dev) installed
  (`npm install -g --ignore-scripts @earendil-works/pi-coding-agent`)
- macOS preferred (uses Keychain). Linux and Windows work via the credentials
  file fallback.

## Installation

### Option A: pi package manager (recommended)

```bash
pi install npm:@pankajudhas81/pi-claude-auth
```

Installs the extension globally to `~/.pi/agent/npm/`. Use `-l` for a
project-local install.

### Option B: Declare in settings.json (dotfiles-friendly)

Add to `~/.pi/agent/settings.json` (global) or `.pi/settings.json` (project):

```json
{
    "packages": ["npm:@pankajudhas81/pi-claude-auth@latest"]
}
```

Then just run `pi`. The extension loads automatically.

### Option C: Let an LLM do it

Paste this into any LLM agent (pi, Claude Code, Cursor, etc.):

```
Install the pi-claude-auth package and configure it by following:
https://raw.githubusercontent.com/pankajudhas81/pi-claude-auth/main/installation.md
```

### Updating

```bash
pi update npm:@pankajudhas81/pi-claude-auth
```

## Verify it's working

After installation, run:

```bash
pi config
```

You should see the extension listed:

```
npm:@pankajudhas81/pi-claude-auth (user)
  Extensions
    [x] src/index.ts
```

Then start pi and pick any Claude model with `/model`. If it responds, auth is
working.

## Usage

Run `pi`, then pick a Claude model with `/model` (or Ctrl+L). The extension has
already seeded your Claude Code credentials, so there is nothing else to do — no
`/login`, no API key. Tokens refresh in the background and rotated tokens are
written back to Claude Code's storage.

If your Claude Code credentials aren't OAuth-based, the extension stays out of
the way and pi falls through to its standard Anthropic auth.

## Why pi-claude-auth?

There are several good community projects solving Anthropic auth for pi (see
[Acknowledgements](#acknowledgements)). Here's what makes this one different:

- **Zero-login** — if Claude Code is authenticated, pi works immediately. No
  browser OAuth dance, no `/login`, no API key. Install and go.
- **Keychain-native** — reads directly from macOS Keychain (the same secure
  storage Claude Code uses). No credential files to manage on macOS.
- **Multi-account switching** — detects all Claude Code accounts automatically.
  Switch via `/login` when you have multiple accounts (Pro, Max, etc.).
- **Background sync** — re-syncs auth every 5 minutes and writes refreshed
  tokens back to Claude Code's storage, keeping both tools in sync.
- **Two-tier token refresh** — refreshes directly via Anthropic's OAuth endpoint
  (zero LLM tokens consumed), falls back to the Claude CLI only if needed.

If you prefer a browser-based OAuth flow or need relay/caching features,
check out [pi-anthropic-oauth](https://github.com/leohenon/pi-anthropic-oauth)
or [@cortexkit/pi-anthropic-auth](https://pi.dev/packages/@cortexkit/pi-anthropic-auth)
— both are solid options.

## Supported models

16 supported models. Run `pnpm run test:models` to verify against your account.

| Model                      |
| -------------------------- |
| claude-haiku-4-5           |
| claude-haiku-4-5-20251001  |
| claude-opus-4-0            |
| claude-opus-4-1            |
| claude-opus-4-1-20250805   |
| claude-opus-4-20250514     |
| claude-opus-4-5            |
| claude-opus-4-5-20251101   |
| claude-opus-4-6            |
| claude-opus-4-7            |
| claude-opus-4-8            |
| claude-opus-5              |
| claude-sonnet-4-0          |
| claude-sonnet-4-20250514   |
| claude-sonnet-4-5          |
| claude-sonnet-4-5-20250929 |
| claude-sonnet-4-6          |
| claude-sonnet-5            |

## Credential sources

The extension checks these in order:

1. macOS Keychain (all `Claude Code-credentials*` entries — multiple accounts
   are detected automatically)
2. `~/.claude/.credentials.json` (fallback, works on all platforms)

## Multiple accounts (macOS)

If you have multiple Claude Code accounts authenticated on macOS, the extension
detects all of them from the Keychain automatically. Each account is labeled by
its subscription tier (Claude Pro, Claude Max, etc.).

To switch accounts:

```
/login
```

Select the `anthropic` provider, then pick the account you want. Your selection
is persisted across sessions in `~/.pi/agent/claude-account-source.txt`. If only
one account is found, the picker is skipped.

## Troubleshooting

| Problem                            | Solution                                                                                                                                                                |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "No Claude Code credentials found" | Run `claude` to authenticate with Claude Code first                                                                                                                     |
| Models missing right after install | On pi ≥ 0.83 the credential lands in `auth.json` for the **next** session: restart pi once, or run `/login` and pick `Claude Code (subscription)` to use it immediately |
| "Keychain is locked"               | Run `security unlock-keychain ~/Library/Keychains/login.keychain-db`                                                                                                    |
| "Token expired and refresh failed" | The extension runs the `claude` CLI to refresh automatically. If this fails, re-authenticate by running `claude`                                                        |
| Not working on Linux/Windows       | Ensure `~/.claude/.credentials.json` exists. Run `claude` to create it                                                                                                  |
| Keychain access denied             | Grant access when macOS prompts you                                                                                                                                     |
| Keychain read timed out            | Restart Keychain Access (can happen on macOS Tahoe)                                                                                                                     |
| Package not updating               | Run `pi update npm:@pankajudhas81/pi-claude-auth`                                                                                                                       |

### Claude Code version

The release number this extension claims is **read from the Claude Code
installed on your machine** (`~/.local/share/claude/versions`, newest entry), so
a Claude Code update needs nothing from you. It is resolved per request, which
means a mid-session update is picked up without restarting pi.

If no installation is found, the extension falls back to the last version it
was verified against and says so on stderr. To force a specific version — for
example if billing ever reverts to extra usage — override it:

```bash
export ANTHROPIC_CLI_VERSION=<version>
```

or update the package:

```bash
pi update npm:@pankajudhas81/pi-claude-auth
```

See [docs/LANE-MONITORING.md](docs/LANE-MONITORING.md) for the billing
check (`pnpm run lane:check`), the consumed-usage report (`pnpm run usage`),
and the re-check cadence. If Anthropic starts treating SDK-shaped traffic as
extra usage, see the dormant plan in
[docs/CLAUDE-OAUTH-CONTINGENCY.md](docs/CLAUDE-OAUTH-CONTINGENCY.md) — do not
flip to interactive `cli` identity while Pi's system prompt is still in
`system[]`.

### Monitoring usage

```bash
pnpm run usage   # plan windows + extra usage, straight from Anthropic
```

Shows what the subscription plan has consumed (session, weekly, and
model-scoped windows) and what has been drawn from extra usage credits — the
accounting side of whether the Claude Code fingerprint is doing its job. Costs
no tokens.

### Diagnostic logging

If you hit auth errors that are hard to reproduce, enable debug logging to
capture the full auth flow:

```bash
export PI_CLAUDE_AUTH_DEBUG=1
```

Restart pi and reproduce the issue. The extension writes structured JSON logs to
`~/.pi/agent/pi-claude-auth-debug.log`. All secrets (tokens, API keys) are
automatically redacted — the log file is safe to share when reporting an issue.

To write logs to a custom path:

```bash
export PI_CLAUDE_AUTH_DEBUG=/tmp/pi-claude-auth-debug.log
```

Disable when done:

```bash
unset PI_CLAUDE_AUTH_DEBUG
```

## Validating OAuth refresh

To verify the direct OAuth token refresh works with your credentials:

```bash
pnpm run validate:oauth                # refresh + write-back (safe)
pnpm run validate:oauth -- --dry-run   # show what would be sent, no request
```

This reads your stored credentials, calls Anthropic's OAuth token endpoint, and
writes the new tokens back to storage. Refresh tokens rotate on each use, so
write-back is enabled by default to keep your stored credentials valid.

## Environment variables

| Variable                | Description                                                                 | Default            |
| ----------------------- | --------------------------------------------------------------------------- | ------------------ |
| `PI_CODING_AGENT_DIR`   | pi's config directory (where `auth.json` lives)                             | `~/.pi/agent`      |
| `PI_CLAUDE_AUTH_DEBUG`  | Enable diagnostic logging (`1` for default path, or a custom file path)     | disabled           |
| `ANTHROPIC_CLI_VERSION` | Claude CLI version for billing headers (default: the installed Claude Code) | —                  |
| `ANTHROPIC_CCH_SEED`    | 64-bit hex seed for structure-aware `cch` (native seed rotates)             | `4d659218e32a3268` |

## How it works

This is a pi [extension](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/extensions.md)
(packaged as a pi package) that sources Anthropic credentials from Claude Code
instead of asking you to log in again.

On startup it reads your Claude Code OAuth tokens from the macOS Keychain (or
`~/.claude/.credentials.json` on other platforms), caches them in memory with a
30-second TTL, and seeds them into pi's `~/.pi/agent/auth.json` under the
`anthropic` provider. pi then uses those credentials with **zero separate
login**. On macOS, multiple Claude Code accounts are detected automatically and
can be switched via `/login`.

It overrides the `anthropic` provider's OAuth lifecycle: when a token is near
expiry, pi delegates refresh to this extension, which refreshes directly via
Anthropic's OAuth endpoint (zero LLM tokens consumed), falls back to the Claude
CLI if that fails, and writes rotated tokens **back** to the Keychain or
credentials file so Claude Code and pi stay in sync. A background re-sync runs
every 5 minutes. pi's built-in Anthropic provider handles the Claude Code
request fidelity (identity, beta flags, tool naming) for OAuth tokens.

### Technical details

- Reads all `Claude Code-credentials*` Keychain entries on macOS (labeled by
  subscription tier), falling back to `~/.claude/.credentials.json`
- Seeds the active account's tokens into `~/.pi/agent/auth.json` as an
  `{ type: "oauth", access, refresh, expires }` entry under `anthropic`, so pi
  uses them with no separate `/login`
- Registers an `anthropic` OAuth provider override via
  `pi.registerProvider("anthropic", { oauth })`:
    - `login` reads the Keychain/file (no browser) and exposes an account picker
      when multiple accounts exist
    - `refreshToken` refreshes directly via `POST https://claude.ai/v1/oauth/token`
      (no LLM tokens), falls back to the `claude` CLI, and writes rotated tokens
      back to the Keychain (macOS) or credentials file (other platforms)
    - `getApiKey` returns the freshest cached access token
- Re-syncs `auth.json` every 5 minutes (sync never triggers a refresh; refresh
  is lazy, only when pi requests it or a request needs a fresh token)
- pi's built-in Anthropic provider applies the Claude Code identity, beta flags,
  and tool-name conventions for OAuth tokens, so requests look like Claude Code
- The captured Claude Code first-party beta set is **merged into** pi's computed
  list at fetch time (`mergeCapturedBetas`) rather than declared as provider
  metadata. pi-ai treats a configured `anthropic-beta` header as a full
  replacement, so declaring the list here would drop the betas pi derives from a
  model's compat flags — the merge is strictly additive
- If credentials aren't OAuth-based or can't be read, the extension disables
  itself and pi continues with its standard Anthropic auth

## Acknowledgements

This project is motivated by and copies patterns from
[opencode-claude-auth](https://github.com/griffinmartin/opencode-claude-auth)
by Griffin Martin. That project solved the same problem for
[opencode](https://github.com/nichochar/opencode) — reusing Claude Code OAuth
credentials so you don't need a separate login. We adopted the same approach
(Keychain reading, token refresh, credential seeding) and adapted it for pi's
extension API.

The community has built several other great solutions worth checking out:

- **[pi-anthropic-oauth](https://github.com/leohenon/pi-anthropic-oauth)** by
  Leo Henon — a browser-based OAuth flow for pi. Uses a local callback server
  for a full OAuth dance via `/login anthropic`. Different approach from ours
  (browser login vs. Keychain reading), well-maintained, and popular (39 stars).
  If you prefer authenticating directly through Anthropic's login page rather
  than piggybacking on Claude Code credentials, this is a great choice.

- **[@cortexkit/pi-anthropic-auth](https://pi.dev/packages/@cortexkit/pi-anthropic-auth)**
  by ismeth / CortexKit — a shared-core monorepo supporting both pi and OpenCode
  through `@cortexkit/anthropic-auth-core`. Offers advanced features like relay
  proxying via Cloudflare Workers, prompt caching controls (`/claude-cache`),
  quota management, fast-mode for Opus, and routing strategies. The most
  feature-rich option in this space (1,540 downloads/mo). If you need caching,
  relay, or quota features, check this one out.

All three projects (and ours) exist because the community wants to use pi with
Claude Pro/Max subscriptions. Different approaches, same goal. Pick whichever
fits your workflow best.

## Disclaimer

This extension uses Claude Code's OAuth credentials to authenticate with
Anthropic's API. Anthropic's Terms of Service state that Claude Pro/Max
subscription tokens should only be used with official Anthropic clients. This
extension exists as a community workaround and may stop working if Anthropic
changes their OAuth infrastructure. Use at your own discretion.

## License

MIT
