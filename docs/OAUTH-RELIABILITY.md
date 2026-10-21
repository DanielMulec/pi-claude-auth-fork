# Shared Claude OAuth reliability

## Status — 2026-10-19

Two reproducible defects are fixed in the working tree:

1. Multiple fork processes could submit the same refresh token concurrently,
   both at expiry and during revoked-access-token recovery.
2. A long-lived session's five-minute sync timer could overwrite Pi's saved
   credentials with an earlier login's still-unexpired in-memory pair.

These defects can cause auth failures. They are **not proof that every observed
shared-token revocation had this cause**. Daniel reports that native Claude
Code required re-login too; Pi-only retry logic is not sufficient protection.
There is no promise of eliminating server-side revocation or required login.

## Incident evidence

Real Pi session errors, inspected without exposing credential values:

| UTC                    | Evidence                                                                                                                                            |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-10-18 12:10–12:12 | Concurrent Fable/Opus requests return revoked-token 401; a new Pi session also gets OAuth `invalid_grant` / `Refresh token not found or invalid`.   |
| 2026-10-18 20:12:07    | Fable revoked-token 401, `req_011CgAK4RJneGZQVTkU2wUt7`.                                                                                            |
| 2026-10-19 04:10:05    | Fable revoked-token 401, `req_011CgAwWg8CZ6KARdah9GmeR`.                                                                                            |
| 2026-10-19 04:11:43    | Same session, revoked-token 401, `req_011CgAwdv4nGBXmTZ8anYPhi`.                                                                                    |
| 2026-10-19 04:13:52    | Replacement Keychain/Pi access and refresh pairs match; stored expiry 12:12 UTC; read-only OAuth usage returns 200, `req_011CgAwoTfp6YRTNSQHY3aMH`. |

Only one primary `Claude Code-credentials` Keychain item was found, with the
expected macOS account attribute. No duplicate-item repair was performed.
Recent native debug logs and current fork refresh diagnostics were unavailable,
so the precise initiating writer for the past incidents cannot be identified.
No failed production refresh token was replayed and no live refresh was forced.

## Reproduction and fix

```sh
node --test --experimental-strip-types src/credential-refresh-concurrency.test.ts
node --test --experimental-strip-types --test-name-pattern='never republishes' src/credentials.test.ts
```

The race tests spawn actual independent processes through production
`refreshIfNeeded` and `recoverRevokedAccessToken`, with isolated credential
storage and a local single-use-token endpoint. Before the fix, both submit the
same token: `2 !== 1`; the loser receives `invalid_grant`. The sync regression
returned `old-access` instead of the replacement login. After the fix, waiters
adopt the persisted winner, and sync reads storage rather than session memory.
These are controlled reproductions of defects, not a recreation of Anthropic's
undocumented token-family revocation policy.

### Coordination with native Claude Code 2.1.303

Inspection of the installed binary's `m4n` / `$Ws` lock implementation confirms:

- secure-storage directory: `CLAUDE_SECURESTORAGE_CONFIG_DIR`, otherwise
  `CLAUDE_CONFIG_DIR`, otherwise `~/.claude`;
- `proper-lockfile` lock directory `.oauth_refresh.lock`;
- `realpath: false`, stale threshold 60 seconds, update interval 5 seconds.

The fork uses the same library, path and options. It re-reads credentials
**after** acquiring the lock, then keeps the lock through direct refresh and
persistence. It never runs `claude -p` while holding that lock: native must
acquire it itself. A test holds native's lock with `proper-lockfile`, installs
a replacement credential, then releases it; fork processes adopt it without
making any refresh request.

The synchronous acquisition wait is capped at five seconds, leaving room for
the 15-second HTTP timeout and bounded Keychain operations while Pi may hold
its own 30-second auth-file lock. Timeout fails closed, not by submitting a
competing refresh. A busy/slow native owner can therefore cause a temporary
auth failure; retry once it has finished rather than immediately re-login.
A killed owner's lock is recoverable at native's 60-second stale threshold.
Tests cover stale-lock recovery, release after exceptions, and not stealing
a live lock. The sync implementation must not be extended to hold this lock
through long-running work: its JavaScript heartbeat cannot run while blocked.

A successful rotation whose write-back fails is no longer silently accepted.
It raises an actionable error. Tests remove the credential store during a
successful response and verify neither refresh path reports the unpersisted
token as healthy or reuses the old refresh token. Missing storage during
recovery fails closed rather than falling back to session memory.
Local code cannot undo an already-completed
server rotation; storage permissions/unavailability must be corrected before
another login is expected to persist.

### Rollout requirement

**Reload or restart every existing Pi process using this shared login.**
Changing files on disk does not replace code already loaded by a running
session. An old process can continue bypassing the lock or republishing its
stale token. This work does not kill/restart active agents automatically.
New processes load the checkout's updated `src/index.ts`; the package release
number stays v0.7.11 with unreleased working-tree changes.

No native binary patch, scheduled refresh, token-pinning job, or new login
secret is needed for these fixes. Avoid proactive forced refresh jobs: they
add another writer rather than resolving ownership.

## Persistent incident history

Auth lifecycle events are always recorded under:

```
<pi-agent-dir>/claude-auth-events/YYYY-MM-DD.jsonl
```

Default agent directory: `~/.pi/agent`; `PI_CODING_AGENT_DIR` is respected.
Files are private (0600), append across processes, expire after 14 days, and
are capped at 2 MiB/day. Audit errors never break authentication.

Records contain time, PID, event, source, expiry, and truncated SHA-256 access/
refresh identifiers. **No token values, request bodies, or raw errors.** The
identifiers let a later diagnosis see whether two processes refreshed the
same generation and whether a new pair was persisted or adopted. This is an
incident trail for updated fork processes, **not** a native Keychain write
watcher or an alert service; it cannot identify an uninstrumented external
writer on its own. Full debug logging remains opt-in.

If the problem recurs after every Pi process has reloaded:

1. Preserve these event files and exact Pi/native error timestamps **before**
   logging in again, where possible. Never export raw Keychain entries.
2. Check whether native Claude Code is also broken; do not classify 401 or
   `invalid_grant` as a billing/fingerprint issue.
3. Compare event token identifiers, processes and lock timeouts. Check for
   other hosts/tools sharing the login and older clients using legacy locks.
4. If all local writers are coordinated but the current stored pair is still
   revoked, investigate upstream/session-policy revocation. Native OAuth
   policy is not under the fork's control. Consider credential isolation or
   the genuine Claude CLI transport only with explicit product trade-offs.

## Upstream context, not local proof

[Claude Code #76905](https://github.com/anthropics/claude-code/issues/76905)
reports shared macOS Keychain refresh races and forced re-login in older
versions. [#54443](https://github.com/anthropics/claude-code/issues/54443)
reports early 401 followed by refresh 400 across concurrent sessions. These
are user reports, not proof of a 2.1.303 native defect. The current binary
already implements a native cross-process lock; our demonstrated gap was
bypassing that lock from the fork.
