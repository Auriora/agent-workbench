# Agent Workbench Kiro Power

This directory packages the Kiro-facing Agent Workbench integration.

It includes:

- `POWER.md` for Kiro Power activation and workflow guidance
- `mcp.json` for the Agent Workbench MCP server binding
- `skills/agent-workbench/SKILL.md` for portable Agent Skills import
- `.kiro/hooks/*.kiro.hook` for Kiro IDE Agent Hooks panel templates
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

Kiro IDE hooks are workspace files. If Kiro does not create them from the Power
onboarding instructions, copy the templates into the workspace:

```bash
mkdir -p .kiro/hooks
cp plugins/agent-workbench/kiro-power/.kiro/hooks/*.kiro.hook .kiro/hooks/
```

The IDE post-write hook is an `askAgent` hook. Kiro IDE `runCommand` hooks do
not provide the changed-file tool payload on stdin, so automatic post-write
command hooks are not shipped.

For Kiro CLI custom-agent hooks, copy `agents/agent-workbench.json` to
`~/.kiro/agents/agent-workbench.json` or `.kiro/agents/agent-workbench.json`.
Kiro CLI loads hooks from agent configuration. Kiro IDE displays hooks from
`.kiro/hooks/*.kiro.hook`. The Power supplies both templates plus the MCP
binding and workflow guidance.
