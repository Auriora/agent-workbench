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

## Hook Behavior

Hooks are silent by default. Set `AGENT_WORKBENCH_HOOK_FEEDBACK=basic` to emit
compact MCP follow-up guidance.

The hooks never run diagnostics, never return partial results for timeouts or
failures, and never block Codex editing. Runtime analysis remains MCP-owned.
