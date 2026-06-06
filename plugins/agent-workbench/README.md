# Agent Workbench Codex Plugin

This plugin packages the Codex-facing Agent Workbench integration. It can be
installed from a local checkout or as part of the GHCR Agent Workbench package.

It packages:

- `skills/agent-workbench/SKILL.md` for workflow guidance
- `hooks/` scripts and hook configuration for optional quiet lifecycle feedback
- `.mcp.json` for the Agent Workbench MCP server binding

The plugin does not reimplement runtime code. Its MCP binding launches the
stable installed package launcher, not runtime source copied into Codex's plugin
cache. Use `scripts/install-agent-workbench-package.sh` to install the package,
register the local plugin marketplace entry, cachebust the plugin, and run
`codex plugin add agent-workbench@<personal-marketplace>`.

After source or dependency changes, install a package containing the updated
runtime, reinstall the plugin, then restart Codex.

For normal Codex workspace sessions, do not set
`AGENT_WORKBENCH_DEFAULT_REPO_ROOT`; the MCP server should default to Codex's
active working directory. Use that environment variable or `--repo-root` only
for fixed-target launches outside the active workspace.

## Local Installation Model

The local plugin source lives at `~/plugins/agent-workbench` after package
installation. The personal marketplace entry points at that source, and Codex
loads an installed copy from its plugin cache. The plugin MCP binding must keep
launching the package prefix through `bin/agent-workbench-mcp`.

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
