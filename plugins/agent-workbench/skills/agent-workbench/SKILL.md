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

1. Read `repo:///status` before relying on runtime output.
2. Use `context_for_task` before broad file reads.
3. Use targeted symbol, reference, and impact surfaces for implementation work.
4. Use preview/apply surfaces for workspace writes when available.
5. Use `verification_plan` semantics for validation and post-edit feedback.

## Codex Integration

Read `integration:///profiles/codex` when you need to know which Codex surfaces
are active:

- `AGENTS.md` gives repository guidance.
- The MCP server is the only executable runtime surface.
- The plugin packages MCP config, this skill, and optional quiet hooks.
- Hooks are wrappers and must stay silent unless configured for basic feedback.

## Failure Discipline

- Do not add primary-plus-fallback routes unless the spec and fixture-backed
  tests explicitly require them.
- Do not treat partial timeout or failure output as successful evidence.
- Look for root cause first. Fix the underlying issue or report structured
  degraded/blocked state with the missing evidence named.
