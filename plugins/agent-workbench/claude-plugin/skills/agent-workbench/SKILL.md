---
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

## Spec Documentation Scope

When work is driven by `docs/specs/[###-slug]/`, `Spec NNN`, or a `TNNN` task
and Agent Workbench docs tools are used for implementation evidence, keep
canonical spec evidence bounded to the active package. Prefer setting the MCP
session default with `docs_scope`:

```json
{ "action": "set", "scope_path": "docs/specs/[###-slug]" }
```

Then `docs_search`, `repo:///docs/overview`, and `repo:///docs/map` use that
scope by default until `docs_scope` changes or clears it. A per-call
`scope_path` overrides the session default. Clear the default with:

```json
{ "action": "clear" }
```

## Claude Code Integration

This skill is packaged in the Agent Workbench Claude Code plugin. The plugin
includes MCP configuration and Claude Code hook adapters that launch the
installed Agent Workbench package entrypoint; it must not launch runtime code
from Claude Code's plugin cache.

- `CLAUDE.md` and repository instructions give project guidance.
- The MCP server is the only executable runtime surface.
- The plugin packages this skill, quiet hooks, and MCP server configuration.
- Hooks are wrappers and must stay silent unless configured for basic feedback.

## Failure Discipline

- Do not add primary-plus-fallback routes unless the spec and fixture-backed
  tests explicitly require them.
- Do not treat partial timeout or failure output as successful evidence.
- Look for root cause first. Fix the underlying issue or report structured
  degraded or blocked state with the missing evidence named.
