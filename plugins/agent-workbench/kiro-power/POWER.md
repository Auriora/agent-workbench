---
name: "agent-workbench"
displayName: "Agent Workbench"
description: "Use the Agent Workbench MCP runtime for repository status, scoped context, symbol navigation, edit planning, and validation planning."
keywords: ["agent-workbench", "mcp", "repo status", "symbol search", "validation plan", "workspace edit", "code navigation"]
author: "Auriora"
---

# Agent Workbench

Agent Workbench is the executable MCP runtime for repository-aware coding-agent
work. This Power packages Kiro guidance, MCP configuration, a portable skill,
workspace hook templates, and quiet hook adapters around the installed Agent
Workbench runtime.

Do not run runtime code from this Power directory. The MCP server must launch
the stable package prefix:

```bash
${AGENT_WORKBENCH_INSTALL_ROOT:-$HOME/.local/share/agent-workbench}/bin/agent-workbench-mcp
```

## Onboarding

1. Verify the package-backed runtime is installed:

   ```bash
   test -x "${AGENT_WORKBENCH_INSTALL_ROOT:-$HOME/.local/share/agent-workbench}/bin/agent-workbench-mcp"
   ```

2. If the launcher is missing, install Agent Workbench from the repository or
   unpacked package source:

   ```bash
   scripts/install-agent-workbench-package.sh \
     --prefix "$HOME/.local/share/agent-workbench" \
     --skip-codex-config
   ```

3. Import the bundled skill if Kiro did not install it automatically:

   ```bash
   mkdir -p "$HOME/.kiro/skills"
   cp -a skills/agent-workbench "$HOME/.kiro/skills/agent-workbench"
   ```

4. Create IDE hooks from the bundled templates if Kiro did not create them
   automatically. IDE hooks must be workspace files under `.kiro/hooks/`. Add
   the bundled definitions to these workspace paths:

   - `.kiro/hooks/agent-workbench-ready-check.kiro.hook`
   - `.kiro/hooks/agent-workbench-post-write-feedback.kiro.hook`

   The ready check is a manual `runCommand` hook because current Kiro IDE hook
   files use `userTriggered` for on-demand commands. The post-write hook uses
   `askAgent` because Kiro IDE `runCommand` hooks do not provide the changed-file
   tool payload on stdin. Startup and payload-aware hooks for Kiro CLI custom
   agents remain in the agent configuration in the next step.

5. For CLI custom-agent hook support, add the contents of
   `agents/agent-workbench.json` to `~/.kiro/agents/agent-workbench.json` or to
   the workspace `.kiro/agents/agent-workbench.json`.

## Workflow

Use Agent Workbench when repository context, impact, navigation, edit planning,
or validation planning is unclear.

1. Read `repo:///status`, `repo:///scope`, and `repo:///overview` before relying
   on runtime output.
2. Use `context_for_task` before broad file reads.
3. Use targeted symbol, reference, and impact surfaces for implementation work.
4. Use preview/apply surfaces for workspace writes when available.
5. Use `verification_plan` for validation planning and quiet post-edit static
   feedback.

## Boundaries

- MCP is the only executable runtime surface.
- Skills and Power guidance explain how to use the runtime; they do not
  duplicate runtime logic.
- Hooks are quiet adapters. They must not install, repair, retry, or add hidden
  fallback behavior.
- Do not return partial results as success for crashes, timeouts, or missing
  evidence. Use structured degraded or blocked state.
