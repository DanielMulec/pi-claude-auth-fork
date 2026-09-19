#!/usr/bin/env python3
"""Capture rig, Claude Code interactive half: drive the real TUI in a pty.

**Research / contingency only.** Production fingerprint work for this fork uses
`claude -p` (sdk-cli). The interactive CLI cannot be reached with `--print`:
`--print` sends `cc_entrypoint=sdk-cli`, the Agent SDK identity line, and
`cc_turn_origin=sdk`. Only the TUI sends `cli` / the CLI identity / `human`.

Driving the TUI needs a pty, which Node cannot do without a native addon, so
this one script is Python. Any Python 3 works; macOS ships one.

Usage (with `pnpm run capture` already listening):

    ANTHROPIC_BASE_URL=http://127.0.0.1:8899 \\
    _CLAUDE_CODE_ASSUME_FIRST_PARTY_BASE_URL=1 \\
        python3 scripts/drive-claude-interactive.py \\
            --model claude-sonnet-5 --turns 2 \\
            --capture-dir /tmp/cc-capture \\
            --log /tmp/cc-capture/tui.log

Exits non-zero when the expected number of requests never arrived, so a rig run
cannot silently "succeed" with no evidence.
"""

from __future__ import annotations

import argparse
import errno
import fcntl
import json
import os
import pty
import select
import signal
import struct
import subprocess
import sys
import termios
import time

AP = argparse.ArgumentParser()
AP.add_argument("--model", default=None, help="passed to `claude --model`")
AP.add_argument("--turns", type=int, default=1, help="requests to capture")
AP.add_argument("--cwd", default=os.path.expanduser("~"), help="a trusted project dir")
AP.add_argument("--capture-dir", default="/tmp/cc-capture")
AP.add_argument("--log", default=None, help="raw TUI transcript (ansi included)")
AP.add_argument("--prompt", default="Reply with exactly: OK")
AP.add_argument("--follow-up", default="Reply with exactly: DONE")
AP.add_argument("--ready-timeout", type=float, default=45.0)
AP.add_argument("--turn-timeout", type=float, default=90.0)
AP.add_argument("--env", action="append", default=[], metavar="K=V")
ARGS = AP.parse_args()

ENV = dict(os.environ)
ENV.setdefault("TERM", "xterm-256color")
# Claude Code sets this itself per launch mode; a stale value would make the
# capture lie about which mode produced it.
ENV.pop("CLAUDE_CODE_ENTRYPOINT", None)
for pair in ARGS.env:
    key, _, value = pair.partition("=")
    ENV[key] = value

ARGV = ["claude"]
if ARGS.model:
    ARGV += ["--model", ARGS.model]

MASTER, SLAVE = pty.openpty()
# A realistic window size: the TUI degrades on the 80x24 default and may skip
# the status render this script waits for.
fcntl.ioctl(SLAVE, termios.TIOCSWINSZ, struct.pack("HHHH", 50, 200, 0, 0))

PROC = subprocess.Popen(
    ARGV,
    stdin=SLAVE,
    stdout=SLAVE,
    stderr=SLAVE,
    cwd=ARGS.cwd,
    env=ENV,
    close_fds=True,
    start_new_session=True,
)
os.close(SLAVE)
LOG = open(ARGS.log, "wb") if ARGS.log else None


def pump(seconds: float) -> bool:
    """Read the pty for up to `seconds`. False once the child closed it."""
    deadline = time.time() + seconds
    while time.time() < deadline:
        readable, _, _ = select.select([MASTER], [], [], 0.2)
        if not readable:
            continue
        try:
            chunk = os.read(MASTER, 65536)
        except OSError as exc:
            if exc.errno == errno.EIO:
                return False
            raise
        if not chunk:
            return False
        if LOG:
            LOG.write(chunk)
            LOG.flush()
    return True


def send(text: str) -> None:
    try:
        os.write(MASTER, text.encode())
    except OSError as exc:
        print(f"send failed: {exc}", file=sys.stderr)


def captured(model: str | None) -> int:
    """Requests for `model` seen in the capture dir so far."""
    try:
        with open(f"{ARGS.capture_dir}/index.jsonl") as handle:
            rows = [json.loads(line) for line in handle if line.strip()]
    except FileNotFoundError:
        return 0
    if not model:
        return sum(1 for row in rows if row.get("path", "").startswith("/v1/messages"))
    want = model.replace("[1m]", "")
    return sum(1 for row in rows if (row.get("model") or "").startswith(want))


def await_captures(target: int, label: str) -> bool:
    deadline = time.time() + ARGS.turn_timeout
    while time.time() < deadline:
        if captured(ARGS.model) >= target:
            pump(3.0)  # let the streamed response finish rendering
            print(f"{label}: captured {captured(ARGS.model)}", file=sys.stderr)
            return True
        pump(1.0)
    print(
        f"{label}: TIMEOUT after {ARGS.turn_timeout}s "
        f"(have {captured(ARGS.model)}, want {target})",
        file=sys.stderr,
    )
    return False


def shutdown() -> int:
    send("\x1b")
    pump(0.4)
    send("/exit\r")
    pump(2.0)
    send("\x03")
    pump(1.5)
    try:
        os.killpg(os.getpgid(PROC.pid), signal.SIGTERM)
    except ProcessLookupError:
        pass
    try:
        PROC.wait(timeout=15)
    except subprocess.TimeoutExpired:
        os.killpg(os.getpgid(PROC.pid), signal.SIGKILL)
    if LOG:
        LOG.close()
    try:
        os.close(MASTER)
    except OSError:
        pass
    print(f"claude exited rc={PROC.returncode}", file=sys.stderr)
    return 0


def main() -> int:
    before = captured(ARGS.model)
    if not pump(ARGS.ready_timeout):
        print("claude exited before the prompt was ready", file=sys.stderr)
        return 1
    prompts = [ARGS.prompt]
    if ARGS.turns > 1:
        prompts.append(ARGS.follow_up)
    for index, prompt in enumerate(prompts, start=1):
        send(prompt + "\r")
        if not await_captures(before + index, f"turn {index}"):
            shutdown()
            return 1
    return shutdown()


if __name__ == "__main__":
    sys.exit(main())
