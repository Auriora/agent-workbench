# Agent Workbench Codex Plugin

This plugin is a Codex wrapper around the Agent Workbench MCP runtime.

It packages:

- `.mcp.json` for launching the stdio MCP server from this repository checkout
- `skills/agent-workbench/SKILL.md` for workflow guidance
- `hooks/` scripts and hook configuration for optional quiet lifecycle feedback

The plugin does not copy or reimplement runtime code. The MCP server is launched
from `../../src/mcp/stdio.ts`, so local development should use this plugin from a
checkout-linked location. Restart Codex after source changes. Run `pnpm install`
after dependency changes, then restart Codex.

For normal Codex workspace sessions, do not set
`AGENT_WORKBENCH_DEFAULT_REPO_ROOT`; the MCP server should default to Codex's
active working directory. Use that environment variable or `--repo-root` only
for fixed-target launches outside the active workspace.

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
