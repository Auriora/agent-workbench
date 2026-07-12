---
name: agent-workbench
description: Use Agent Workbench as the MCP-backed IDE runtime for repository status, task context, targeted navigation, edit planning, and validation planning.
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Agent Workbench

Use this skill when working in a repository that has the Agent Workbench MCP
server configured.

Agent Workbench is the executable runtime. This skill only teaches the workflow.
Do not duplicate MCP schemas, backend output, or runtime behavior in prompts or
local scripts.

## Default Workflow

1. Read `repo:///orientation` for a compact trust and freshness receipt. Follow
   its links to `repo:///status`, `repo:///scope`, or `repo:///overview` only
   when the task needs that detailed evidence.
2. If Agent Workbench tool schemas are deferred or not visible in the current
   client, call tool discovery for `agent-workbench context_for_task
   verification_plan diagnostics_for_files docs_search`. Do not hardcode
   client-specific wrapper names.
3. Use `context_for_task` before broad file reads.
4. Use targeted symbol, reference, and impact surfaces for implementation work.
5. Use preview/apply surfaces for workspace writes when available.
6. Use `verification_plan` for validation planning and quiet post-edit static feedback.

## Spec Lifecycle Boundary

When work is driven by `docs/specs/[###-slug]/`, `Spec NNN`, or a `TNNN` task,
use spec-lifecycle-manager for authoritative lifecycle preflight, task context,
traceability, evidence quality, task-state audit, promotion planning, closure
risk, and closure checks. Agent Workbench can consume those outputs through
`context_for_task.lifecycle_context` and join them to repository files,
diagnostics, symbols, impact, edit preview, and validation planning.

When using Agent Workbench docs tools for spec implementation evidence, keep
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

If spec-lifecycle-manager is unavailable, Agent Workbench local spec routing is
non-authoritative. Treat it as bounded routing evidence only; do not use it to
change task status, reconcile specs, promote docs, or close specs.

## Codex Integration

Read `integration:///profiles/codex` when you need to know which Codex surfaces
are active:

- `AGENTS.md` gives repository guidance.
- The MCP server is the only executable runtime surface.
- The plugin packages this skill, quiet hooks, and MCP server configuration.
- The plugin MCP server launches the installed Agent Workbench package
  entrypoint; it must not launch runtime code from the plugin cache.
- Hooks are wrappers and must stay quiet and action-gated unless explicitly silenced.

## Failure Discipline

- Do not add primary-plus-fallback routes unless the spec and fixture-backed
  tests explicitly require them.
- Do not treat partial timeout or failure output as successful evidence.
- Look for root cause first. Fix the underlying issue or report structured
  degraded/blocked state with the missing evidence named.
