---
title: Codex Agent Workbench plugin and MCP setup
doc_type: runbook
status: draft
owner: platform
last_reviewed: 2026-06-05
---

# Codex Agent Workbench Plugin And MCP Setup

## Purpose

Define the supported local-development setup for using Agent Workbench from
Codex without creating a second executable runtime path.

## Supported Model

Agent Workbench has one executable Codex runtime path:

- Host-level Codex MCP configuration launches `src/mcp/stdio.ts` from this
  repository checkout.

The Codex plugin is a wrapper only:

- It installs the `agent-workbench` skill.
- It may install optional quiet hook artifacts.
- It must not register an MCP server for local development.
- It must not launch a copied or cache-relative runtime path.

This keeps source updates simple: restart Codex after source changes. After
dependency changes, run `pnpm install` in this repository checkout, then restart
Codex. Do not rely on plugin reinstall as the runtime update mechanism.

## Host-Level MCP Configuration

Configure Codex with an MCP server that points at this checkout:

```toml
[mcp_servers.agent-workbench]
enabled = true
command = "node"
args = [
  "--import",
  "tsx",
  "/absolute/path/to/agent-workbench/src/mcp/stdio.ts"
]
```

For normal Codex workspace sessions, leave
`AGENT_WORKBENCH_DEFAULT_REPO_ROOT` unset. The MCP process should default to the
active Codex workspace. Use an explicit `repo_root` argument or
`AGENT_WORKBENCH_DEFAULT_REPO_ROOT` only for fixed-target launches outside an
active workspace.

## Plugin Installation

The local plugin source lives at `plugins/agent-workbench/`.

The plugin manifest should include skill metadata but no `mcpServers` entry.
If `codex plugin list` or Codex UI shows a plugin-provided Agent Workbench MCP
server, disable that plugin server and keep the host-level
`mcp_servers.agent-workbench` entry as the single executable runtime path.

When changing plugin packaging, update the plugin cachebuster and reinstall:

```bash
python3 /home/bcherrington/.codex/skills/.system/plugin-creator/scripts/update_plugin_cachebuster.py plugins/agent-workbench
codex plugin add agent-workbench@auriora-local
```

After reinstall, start a new Codex session to pick up changed skills or plugin
metadata.

## Validation

Use these checks before considering plugin/runtime setup changes complete:

```bash
python3 /home/bcherrington/.codex/skills/.system/plugin-creator/scripts/validate_plugin.py plugins/agent-workbench
pnpm exec vitest run tests/integration/codex-integration-profile.test.ts tests/integration/common-integration-profile.test.ts
```

For broader runtime-impacting changes, also run:

```bash
pnpm typecheck
pnpm test
```

