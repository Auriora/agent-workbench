---
title: Agent Workbench Codex plugin
doc_type: runbook
status: draft
owner: platform
last_reviewed: 2026-06-13
---

# Agent Workbench Codex Plugin

This plugin packages the Codex-facing Agent Workbench integration. It can be
installed from a local checkout or as part of the GHCR Agent Workbench package.

It packages:

- `skills/agent-workbench/SKILL.md` for workflow guidance
- `hooks/` scripts and hook configuration for optional quiet lifecycle feedback
- `.mcp.json` for the Agent Workbench MCP server binding
- `kiro-power/` for Kiro Power, Agent Skills, MCP, and hook adapter packaging
- `claude-plugin/` for Claude Code plugin, skill, MCP, and hook adapter packaging

The plugin does not reimplement runtime code. Its MCP binding launches the
stable installed package launcher, not runtime source copied into Codex's plugin
cache. Use `scripts/install-agent-workbench-package.sh` to install the package,
register the local plugin marketplace entry, cachebust the plugin, and run
`codex plugin add agent-workbench@<personal-marketplace>`.

After source or dependency changes, install a package containing the updated
runtime, reinstall the plugin, then restart Codex.

## Quick Start

From this repository or an unpacked package source, install the package-backed
Codex plugin:

```bash
scripts/install-agent-workbench-package.sh
```

For an npm package install, run:

```bash
npx @auriora/agent-workbench install
```

Verify the plugin is installed and enabled:

```bash
codex plugin list
```

In a new Codex session, use Agent Workbench through MCP. The first useful
resources are `repo:///status`, `repo:///scope`, and `repo:///overview`.
For task work, use `context_for_task` before broad reads and
`verification_plan` before running validation. Use
`integration:///profiles/codex` for the Codex integration profile and
`integration:///health/agent-workbench` for integration health.

To update after source, dependency, skill, hook, or MCP config changes:

```bash
scripts/install-agent-workbench-package.sh
codex plugin add agent-workbench@auriora-local
```

Then restart Codex so the plugin cache, skill, hooks, and MCP server config are
rediscovered.

To uninstall the Codex plugin from the current Codex installation:

```bash
codex plugin remove agent-workbench@auriora-local
```

Remove the installed package prefix separately only when no other local setup
uses it.

Review plugin hook trust in Codex after install or update. Hooks are quiet and
non-repairing; if the MCP launcher is missing, reinstall the package rather
than relying on SessionStart or PostToolUse hooks to repair setup.

For normal Codex workspace sessions, do not set
`AGENT_WORKBENCH_DEFAULT_REPO_ROOT`; the MCP server should default to Codex's
active working directory. Use that environment variable or `--repo-root` only
for fixed-target launches outside the active workspace.

## Local Installation Model

The local plugin source lives at `~/plugins/agent-workbench` after package
installation. The personal marketplace entry points at that source, and Codex
loads an installed copy from its plugin cache. The plugin MCP binding must keep
launching the package prefix through `bin/agent-workbench-mcp`.

The repository also includes `.agents/plugins/marketplace.json` for checkout
marketplace inspection and `.well-known/mcp/server-card.json` for local MCP
discoverability metadata. The server card lists public resources and tools,
including `codex-integration-profile` and `integration-health`.

## GHCR Package Model

The package definition lives under `packaging/agent-workbench/` and releases an
OCI image to GHCR. The image contains runtime source, docs, package metadata,
the Codex plugin, MCP config, skills, hooks, and the package installer.

Hooks are installed through plugin-bundled `hooks/hooks.json`. They are not
duplicated into `~/.codex/hooks.json`.

## Hook Behavior

Hooks are silent by default. Set `AGENT_WORKBENCH_HOOK_FEEDBACK=basic` to emit
compact session-start context only. File-edit hooks stay silent unless they have
an actionable finding to report.

Post-edit feedback is limited to cheap local findings: generated/local artifact
touches, workspace-escape-looking paths, merge-conflict markers, and syntax
failures for Python, JavaScript, JSON, TOML, and shell files. The hooks never
report clean edits, never suggest follow-up calls from file-edit events, never
return partial results for timeouts or failures, and never block Codex editing.
Runtime analysis remains MCP-owned.

## Kiro Power

The Kiro integration lives in `kiro-power/`. It packages `POWER.md`,
`mcp.json`, a Kiro-importable copy of the Agent Workbench skill, a Kiro CLI
custom-agent config, and Kiro-shaped hook adapters.

Kiro hook payloads and output semantics differ from Codex hooks, so the Power
uses adapter scripts instead of reusing `hooks/hooks.json`. The adapters reuse
the same quiet hook checks and emit plain Kiro hook context only when basic
feedback is enabled and an actionable message exists.

Install the package-backed runtime first, then add `kiro-power/` as a local
Power in Kiro. The MCP binding launches
`${AGENT_WORKBENCH_INSTALL_ROOT:-$HOME/.local/share/agent-workbench}/bin/agent-workbench-mcp`.

## Claude Code Plugin

The Claude Code integration lives in `claude-plugin/`. It packages a
`.claude-plugin/plugin.json` manifest, `.mcp.json`, a Claude Code skill, and
Claude-shaped hook configuration.

Claude Code plugin components live at the plugin root. Only `plugin.json` is
inside `.claude-plugin/`; `skills/`, `hooks/`, and `.mcp.json` must remain at
the Claude plugin root. Test it locally with:

```bash
claude --plugin-dir plugins/agent-workbench/claude-plugin
```

After source or hook changes, run `/reload-plugins` in Claude Code.
