<!--
Copyright (C) 2026 Auriora
SPDX-License-Identifier: GPL-3.0-or-later
-->

# Agent Workbench Kiro Power

This directory packages the Kiro-facing Agent Workbench integration.

It includes:

- `POWER.md` for Kiro Power activation and workflow guidance
- `mcp.json` for the Agent Workbench MCP server binding
- `skills/agent-workbench/SKILL.md` for portable Agent Skills import
- `.kiro/hooks/*.kiro.hook` for Kiro IDE Agent Hooks panel templates
- `agents/agent-workbench.json` for Kiro CLI custom-agent hooks
- `hooks/` scripts that adapt Agent Workbench quiet hooks to Kiro hook payloads

The Power does not contain or launch a second runtime implementation. Set
`AGENT_WORKBENCH_INSTALL_ROOT` to the installed npm package root; `mcp.json`
invokes that package's portable `mcp-launch.mjs` directly with `node`. There is
no shell or default-path fallback.

Install or refresh the runtime package before adding the Power:

```bash
agent_workbench_prefix="$HOME/.local/share/agent-workbench"
npm install -g https://github.com/Auriora/agent-workbench/releases/download/vX.Y.Z/auriora-agent-workbench-X.Y.Z.tgz --prefix "$agent_workbench_prefix"
export AGENT_WORKBENCH_INSTALL_ROOT="$(npm root -g --prefix "$agent_workbench_prefix")/@auriora/agent-workbench"
```

The export deliberately resolves npm's global module directory; the prefix
itself is not the package root.

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
