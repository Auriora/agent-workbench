# Agent Workbench Kiro Power

This directory packages the Kiro-facing Agent Workbench integration.

It includes:

- `POWER.md` for Kiro Power activation and workflow guidance
- `mcp.json` for the Agent Workbench MCP server binding
- `skills/agent-workbench/SKILL.md` for portable Agent Skills import
- `agents/agent-workbench.json` for Kiro CLI custom-agent hooks
- `hooks/` scripts that adapt Agent Workbench quiet hooks to Kiro hook payloads

The Power does not contain or launch a second runtime implementation. MCP
configuration launches the installed package prefix at
`~/.local/share/agent-workbench/bin/agent-workbench-mcp` unless
`AGENT_WORKBENCH_INSTALL_ROOT` overrides it.

Install or refresh the runtime package before adding the Power:

```bash
scripts/install-agent-workbench-package.sh \
  --prefix "$HOME/.local/share/agent-workbench" \
  --skip-codex-config
```

Then open Kiro, choose Powers, add a local Power, and select this directory.

For Kiro CLI custom-agent hooks, copy `agents/agent-workbench.json` to
`~/.kiro/agents/agent-workbench.json` or `.kiro/agents/agent-workbench.json`.
Kiro loads hooks from agent configuration, while the Power supplies the MCP
binding and workflow guidance.
