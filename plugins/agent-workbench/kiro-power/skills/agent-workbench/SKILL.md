---
name: agent-workbench
description: Use Agent Workbench as the MCP-backed IDE runtime for repository status, task context, targeted navigation, edit planning, and validation planning.
---

# Agent Workbench

Use this skill when working in a repository that has the Agent Workbench MCP
server configured.

Agent Workbench is the executable runtime. This skill only teaches the workflow.
Do not duplicate MCP schemas, backend output, or runtime behavior in prompts or
local scripts.

## Default Workflow

1. Read `repo:///status`, `repo:///scope`, and `repo:///overview` before relying on runtime output.
2. Use `context_for_task` before broad file reads.
3. Use targeted symbol, reference, and impact surfaces for implementation work.
4. Use preview/apply surfaces for workspace writes when available.
5. Use `verification_plan` for validation planning and quiet post-edit static feedback.

## Kiro Integration

This skill is packaged in the Agent Workbench Kiro Power. The Power includes
MCP configuration and Kiro hook adapters that launch the installed Agent
Workbench package entrypoint; it must not launch runtime code from the Power
directory.

- `AGENTS.md` and Kiro steering give repository guidance.
- The MCP server is the only executable runtime surface.
- The Power packages this skill, quiet hooks, and MCP server configuration.
- Hooks are wrappers and must stay silent unless configured for basic feedback.

## Failure Discipline

- Do not add primary-plus-fallback routes unless the spec and fixture-backed
  tests explicitly require them.
- Do not treat partial timeout or failure output as successful evidence.
- Look for root cause first. Fix the underlying issue or report structured
  degraded/blocked state with the missing evidence named.
