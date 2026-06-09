# Agent Workbench Claude Code Plugin

This directory packages the Claude Code-facing Agent Workbench integration.

It includes:

- `.claude-plugin/plugin.json` for Claude Code plugin metadata
- `.mcp.json` for the Agent Workbench MCP server binding
- `skills/agent-workbench/SKILL.md` for Claude Code skill guidance
- `hooks/hooks.json` for Claude Code lifecycle hook configuration
- `hooks/` scripts that adapt Agent Workbench quiet hook behavior to Claude
  Code hook events

The plugin does not contain or launch a second runtime implementation. MCP
configuration launches the installed package prefix at
`~/.local/share/agent-workbench/bin/agent-workbench-mcp` unless
`AGENT_WORKBENCH_INSTALL_ROOT` overrides it.

Install or refresh the runtime package before loading the plugin:

```bash
scripts/install-agent-workbench-package.sh \
  --prefix "$HOME/.local/share/agent-workbench" \
  --skip-codex-config
```

Test locally with Claude Code:

```bash
claude --plugin-dir plugins/agent-workbench/claude-plugin
```

After edits, run `/reload-plugins` in Claude Code to reload plugin skills,
hooks, MCP servers, and agents.
