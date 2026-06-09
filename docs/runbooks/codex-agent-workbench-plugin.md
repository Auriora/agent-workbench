---
title: Codex Agent Workbench plugin and MCP setup
doc_type: runbook
status: draft
owner: platform
last_reviewed: 2026-06-06
---

# Codex Agent Workbench Plugin And MCP Setup

## Purpose

Define the supported local-development and packaged setup for using Agent
Workbench from Codex without creating a second executable runtime path.

## Supported Model

Agent Workbench has one executable Codex runtime path per packaged install:

- The Codex plugin installs the `agent-workbench` skill.
- The Codex plugin installs quiet lifecycle hooks from `hooks/hooks.json`.
- The Codex plugin registers the `agent-workbench` MCP server through
  `.mcp.json`.
- The plugin MCP server launches the stable package prefix created by
  `scripts/install-agent-workbench-package.sh`.
- The plugin must not launch runtime code from Codex's plugin cache path.

The GHCR package is the distribution wrapper for complete installs. It contains
runtime source, docs, package metadata, the Codex plugin, skills, hooks, MCP
configuration, and an installer that registers the plugin through the personal
marketplace. This is not a second runtime implementation; the plugin MCP config
launches the same MCP entrypoint installed under a stable prefix.

Companion MCP servers, such as a spec lifecycle server for a separate docs
repository, should also be configured as host-level Codex MCP entries. Keep
their install and validation notes with the repository they target; the Agent
Workbench plugin should not package or proxy those companion runtimes.

This keeps source updates explicit:

- Install a new package version.
- Reinstall `agent-workbench@<personal-marketplace>`.
- Restart Codex so skills, hooks, and MCP tools are discovered from the updated
  plugin cache.

For normal Codex workspace sessions, leave
`AGENT_WORKBENCH_DEFAULT_REPO_ROOT` unset. The MCP process should default to the
active Codex workspace. Use an explicit `repo_root` argument or
`AGENT_WORKBENCH_DEFAULT_REPO_ROOT` only for fixed-target launches outside an
active workspace.

## Plugin Installation

The local plugin source lives at `plugins/agent-workbench/`.

The plugin manifest includes `skills` and `mcpServers`. Codex auto-discovers
`hooks/hooks.json` when the plugin is enabled. The `.mcp.json` file launches the
installed package launcher and must not point at a plugin-cache source path.

When changing plugin packaging, update the plugin cachebuster and reinstall:

```bash
python3 /home/bcherrington/.codex/skills/.system/plugin-creator/scripts/update_plugin_cachebuster.py plugins/agent-workbench
codex plugin add agent-workbench@auriora-local
```

After reinstall, start a new Codex session to pick up changed skills, hooks,
MCP tools, and plugin metadata.

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
- Codex plugin manifest, MCP config, skill, and hooks
- host launcher for the MCP stdio server
- dependency manifest and lockfile

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

Unless `--skip-codex-config` is passed, the installer:

- removes any old marked `# BEGIN Agent Workbench package install` host-level
  MCP block from `~/.codex/config.toml`;
- copies the plugin source to `~/plugins/agent-workbench`;
- ensures the personal marketplace exposes `agent-workbench`;
- cachebusts the local plugin version; and
- runs `codex plugin add agent-workbench@<personal-marketplace>`.

Hooks remain plugin-bundled. They are not duplicated into `~/.codex/hooks.json`.
Codex may require hook trust review before plugin hooks run.

Dependency installation is explicit in
`packaging/agent-workbench/package-manifest.json`. The package requires
Node.js 22 or newer and pnpm 10.18.1. If the source package does not already
include `node_modules`, the installer runs:

```bash
pnpm install --frozen-lockfile
pnpm rebuild:native
```

Native module installation requires Python 3, `make`, and a C++20-capable
compiler. Runtime dependencies must stay under `dependencies` in `package.json`;
do not leave launcher-required packages such as `tsx` in `devDependencies`.

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

## Kiro Power Packaging

The Kiro integration is packaged under
`plugins/agent-workbench/kiro-power/`. It is a distribution wrapper around the
same installed runtime prefix, not another runtime implementation.

The Power includes:

- `POWER.md` for Kiro activation and workflow guidance
- `mcp.json` for the Agent Workbench MCP binding
- `skills/agent-workbench/SKILL.md` for Agent Skills import
- `agents/agent-workbench.json` for Kiro CLI custom-agent hook configuration
- Kiro hook adapters in `hooks/`

Install or refresh the runtime package first:

```bash
scripts/install-agent-workbench-package.sh \
  --prefix "$HOME/.local/share/agent-workbench" \
  --skip-codex-config
```

Then add `plugins/agent-workbench/kiro-power/` as a local Power in Kiro. If Kiro
does not automatically import the bundled skill, import
`plugins/agent-workbench/kiro-power/skills/agent-workbench/` from the Agent
Steering & Skills panel or copy it to `~/.kiro/skills/agent-workbench`.

Kiro hooks are configured through Kiro agent configuration, not Codex
`hooks/hooks.json`. Use `kiro-power/agents/agent-workbench.json` as the source
for a global or workspace Kiro custom agent.

## Claude Code Plugin Packaging

The Claude Code integration is packaged under
`plugins/agent-workbench/claude-plugin/`. It is a distribution wrapper around
the same installed runtime prefix, not another runtime implementation.

The plugin includes:

- `.claude-plugin/plugin.json` for Claude Code plugin metadata
- `.mcp.json` for the Agent Workbench MCP binding
- `skills/agent-workbench/SKILL.md` for Claude Code skill guidance
- `hooks/hooks.json` for Claude Code hook configuration
- Claude Code hook adapters in `hooks/`

Install or refresh the runtime package first:

```bash
scripts/install-agent-workbench-package.sh \
  --prefix "$HOME/.local/share/agent-workbench" \
  --skip-codex-config
```

Then test the plugin locally:

```bash
claude --plugin-dir plugins/agent-workbench/claude-plugin
```

Claude Code plugin layout differs from Kiro and Codex: only
`.claude-plugin/plugin.json` belongs inside `.claude-plugin/`; `skills/`,
`hooks/`, and `.mcp.json` belong at the Claude plugin root. Run
`/reload-plugins` after editing hooks, skills, or MCP config.
