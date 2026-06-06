---
title: Codex Agent Workbench plugin and MCP setup
doc_type: runbook
status: draft
owner: platform
last_reviewed: 2026-06-05
---

# Codex Agent Workbench Plugin And MCP Setup

## Purpose

Define the supported local-development and packaged setup for using Agent
Workbench from Codex without creating a second executable runtime path.

## Supported Model

Agent Workbench has one executable Codex runtime path per install:

- Local development: host-level Codex MCP configuration launches
  `src/mcp/stdio.ts` from this repository checkout.
- Packaged install: host-level Codex MCP configuration launches the installed
  package prefix created by `scripts/install-agent-workbench-package.sh`.

The Codex plugin is a wrapper only:

- It installs the `agent-workbench` skill.
- It may install optional quiet hook artifacts.
- It must not register an MCP server for local development.
- It must not launch a cache-relative runtime path.

The GHCR package is the distribution wrapper for complete installs. It contains
runtime source, docs, package metadata, the Codex plugin wrapper, skills, hooks,
and an installer that writes host-level MCP and hook configuration. This is not
a second runtime implementation; it is the same MCP entrypoint installed under a
stable prefix.

Companion MCP servers, such as a spec lifecycle server for a separate docs
repository, should also be configured as host-level Codex MCP entries. Keep
their install and validation notes with the repository they target; the Agent
Workbench plugin should not package or proxy those companion runtimes.

This keeps source updates explicit:

- Local development: restart Codex after source changes. After dependency
  changes, run `pnpm install` in this repository checkout, then restart Codex.
- Packaged install: install a new GHCR package version, then restart Codex.

Do not rely on plugin reinstall as the runtime update mechanism.

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

## GHCR Package Installation

The package definition lives at `packaging/agent-workbench/`:

- `Containerfile` builds the GHCR image.
- `package-manifest.json` lists installed components.
- `.github/workflows/release-ghcr.yml` publishes tagged releases to GHCR.
- `scripts/install-agent-workbench-package.sh` installs the package into a
  stable host prefix.

The installer copies all project components required by the runtime and Codex
integration:

- runtime source and package metadata
- documentation
- Codex plugin manifest, skill, and hooks
- host launcher for the MCP stdio server

Run a package install from a checkout or unpacked package source:

```bash
scripts/install-agent-workbench-package.sh
```

Use explicit locations when needed:

```bash
scripts/install-agent-workbench-package.sh \
  --prefix "$HOME/.local/share/agent-workbench" \
  --codex-home "$HOME/.codex"
```

The installer writes a marked block to `~/.codex/config.toml` unless
`--skip-codex-config` is passed. That block includes:

- `[mcp_servers.agent-workbench]` pointing at the installed package launcher
- `SessionStart` and `PostToolUse` hooks pointing at installed hook scripts

This hook config is the fallback for package/plugin environments where the
plugin manifest cannot declare or install hooks directly.

Build and publish use the package containerfile:

```bash
docker build -f packaging/agent-workbench/Containerfile -t ghcr.io/bcherrington/agent-workbench:0.1.0 .
```

Tagged GitHub releases publish through the GHCR workflow.

## Validation

Use these checks before considering plugin/runtime setup changes complete:

```bash
python3 /home/bcherrington/.codex/skills/.system/plugin-creator/scripts/validate_plugin.py plugins/agent-workbench
pnpm exec vitest run tests/integration/codex-integration-profile.test.ts tests/integration/common-integration-profile.test.ts
```

For package changes, also run:

```bash
scripts/install-agent-workbench-package.sh --dry-run --skip-codex-config
pnpm exec vitest run tests/integration/codex-integration-profile.test.ts
```

For broader runtime-impacting changes, also run:

```bash
pnpm typecheck
pnpm test
```
