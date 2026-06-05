# Agent Workbench Codex Plugin

This plugin is a Codex wrapper around the Agent Workbench MCP runtime.

It packages:

- `skills/agent-workbench/SKILL.md` for workflow guidance
- `hooks/` scripts and hook configuration for optional quiet lifecycle feedback

The plugin does not copy, launch, or reimplement runtime code. For local
development, configure the MCP server at the Codex host level with absolute
paths to this repository checkout. The plugin is only the installable wrapper
for skill guidance and optional quiet hooks; it must not create a cache-relative
MCP runtime path. Restart Codex after source changes. Run `pnpm install` after
dependency changes, then restart Codex.

For normal Codex workspace sessions, do not set
`AGENT_WORKBENCH_DEFAULT_REPO_ROOT`; the MCP server should default to Codex's
active working directory. Use that environment variable or `--repo-root` only
for fixed-target launches outside the active workspace.

## Local Installation Model

Use host-level Codex MCP configuration for the executable server, for example:

```toml
[mcp_servers.agent-workbench]
command = "node"
args = [
  "--import",
  "tsx",
  "/absolute/path/to/agent-workbench/src/mcp/stdio.ts"
]
```

Install the plugin only to make the `agent-workbench` skill and quiet hook
artifacts available. If Codex shows a plugin-provided MCP server for
`agent-workbench`, disable that plugin server and keep the host-level server as
the single executable runtime path.

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
