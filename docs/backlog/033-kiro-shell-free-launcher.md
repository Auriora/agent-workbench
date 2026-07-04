---
title: Convert Kiro Power to the shell-free .mjs launcher
doc_type: backlog
status: proposed
owner: platform
source_spec: docs/specs/033-cross-platform-packaging at final spec commit 0d2cc48
last_reviewed: 2026-07-04
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Convert Kiro Power to the shell-free `.mjs` launcher

## Context

Spec 033 made Codex and Claude launch the MCP server shell-free via
`mcp-launch.mjs`, and changed the generated host launcher from `bin/agent-workbench-mcp`
(bash) to `bin/agent-workbench-mcp.mjs` (Node). Kiro was explicitly outside spec
033's Requirement 2 baseline (Claude/Codex only) and was not converted.

As a result, Kiro's MCP launch is currently **broken**: `plugins/agent-workbench/kiro-power/mcp.json`
still runs `bash -lc exec ".../bin/agent-workbench-mcp"`, but the installer no
longer generates that file. The Kiro MCP server will fail to start until the
entry point is updated.

## Scope

Convert the Kiro Power entry point to launch the Node `.mjs` launcher, preferably
shell-free to match Codex/Claude.

- **Minimal (restore function):** point `mcp.json` at the new launcher, e.g.
  `bash -lc exec "node \"${AGENT_WORKBENCH_INSTALL_ROOT:-$HOME/.local/share/agent-workbench}/bin/agent-workbench-mcp.mjs\""`.
  Keeps `bash -lc` only for `${VAR:-default}` expansion; un-breaks Kiro now.
- **Shell-free (preferred):** launch `node` directly against a Kiro-resolvable
  path to the `.mjs` launcher or the `mcp-launch.mjs` shim, with no `bash -lc`.
  Requires determining how Kiro expands env/tokens in `mcp.json` args (the open
  question that kept this out of spec 033).

Also drop the inline `AGENT_WORKBENCH_HOOK_FEEDBACK=basic` prefix from the Kiro
`.kiro.hook`/agent commands (harmless now — the in-script default is `basic` —
but the same shell-free cleanup).

## Acceptance (for the follow-up, not this routing note)

- Kiro MCP server starts against the installed `.mjs` launcher.
- `tests/integration/kiro-power.test.ts` updated to assert the new launch shape.
- Power docs drop the "Pending (spec 033)" launcher caveats.

## References

- Removed Spec 033 verification at final spec commit `0d2cc48` (Residual Risks).
- `plugins/agent-workbench/kiro-power/mcp.json`,
  `plugins/agent-workbench/kiro-power/POWER.md`.
- Codex/Claude shell-free model: `plugins/agent-workbench/mcp-launch.mjs`.
