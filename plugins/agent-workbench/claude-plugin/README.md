<!--
Copyright (C) 2026 Auriora
SPDX-License-Identifier: GPL-3.0-or-later
-->

# Agent Workbench Claude Code Plugin

This directory packages the Claude Code-facing Agent Workbench integration.

It includes:

- `.claude-plugin/plugin.json` for Claude Code plugin metadata
- `.mcp.json` for the Agent Workbench MCP server binding
- `CLAUDE.md` for Claude Code project-memory guidance when the plugin root is
  the active workspace
- `skills/agent-workbench/SKILL.md` for Claude Code skill guidance
- `hooks/hooks.json` for Claude Code lifecycle hook configuration
- `hooks/` scripts that adapt Agent Workbench quiet hook behavior to Claude
  Code hook events

The plugin does not contain or launch a second runtime implementation. The
`.mcp.json` launches the installed package prefix through the portable shim
(`${CLAUDE_PLUGIN_ROOT}/mcp-launch.mjs`), which resolves the prefix
(`~/.local/share/agent-workbench` by default, or `AGENT_WORKBENCH_INSTALL_ROOT`)
and starts the server.

Install or refresh the runtime package before loading the plugin:

```bash
npx @auriora/agent-workbench install -- \
  --prefix "$HOME/.local/share/agent-workbench" \
  --skip-codex-config
```

Test locally with Claude Code:

```bash
claude --plugin-dir plugins/agent-workbench/claude-plugin
```

After edits, run `/reload-plugins` in Claude Code to reload plugin skills,
hooks, MCP servers, and agents.

SessionStart hook output is intentionally orientation only. For behavior Claude
Code should treat as project guidance, keep `CLAUDE.md` aligned with the shared
workflow and avoid relying on hook prose alone.
