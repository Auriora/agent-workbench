---
name: agent-workbench
description: Use Agent Workbench before making repository claims not verified in the current session. It returns authority and currency signals, ranked file, symbol, and documentation evidence, and explicit safe_to_use_for, not_safe_to_use_for, and must_verify_by boundaries for overviews, review, implementation, debugging, and validation planning.
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Agent Workbench

Use this skill when working in a repository that has the Agent Workbench MCP
server configured.

Agent Workbench is the executable runtime. This skill only teaches the workflow.
Do not duplicate MCP schemas, backend output, or runtime behavior in prompts or
local scripts.

## Why use it

Direct file reads show what a file says. They do not establish whether it is
canonical and current or which stronger claims it supports. Agent Workbench
makes verified claims cheap by returning authority and currency signals, ranked
file, symbol, and documentation evidence, and explicit trust boundaries. It
does not make direct reads unnecessary; it tells you which reads and validation
the claim still requires.

Use this skill whenever a task requires a repository claim that is not already
verified in the current session. Skip it only when the task requires no
repository evidence.

Every response's `meta.trust` states what its evidence supports:

- `safe_to_use_for` lists the claims supported by the current evidence.
- `not_safe_to_use_for` lists claims the response does not prove.
- `must_verify_by` names the direct reads or validation needed before making a
  stronger claim.

Read these fields from the response; do not assume or hardcode their values.

## Default Workflow

1. Read `repo:///orientation` for a compact trust and freshness receipt. Follow
   its links to `repo:///status`, `repo:///scope`, or `repo:///overview` only
   when the task needs that detailed evidence.
2. If Agent Workbench tool schemas are deferred or not visible in the current
   client, call tool discovery for `agent-workbench context_for_task
   verification_plan diagnostics_for_files docs_search`. Do not hardcode
   client-specific wrapper names.
3. Use `context_for_task` before making a repository claim not already verified
   in the current session, including a quick repository overview.
4. Inspect governing-document authority and currency, ranked file and symbol
   evidence, and `meta.trust`. Perform the direct reads it requires.
5. Use targeted symbol, reference, and impact surfaces for implementation work.
6. Use preview/apply surfaces for workspace writes when available.
7. Use `verification_plan` for validation planning and quiet post-edit static
   feedback.

## Cheap-task example

Even for `summarize this repo`:

1. `repo:///orientation`
2. `context_for_task` with `task: "summarize this repo"`
3. Use governing-document authority and currency plus ranked file and symbol
   evidence to select bounded reads.
4. Read the selected evidence and follow `meta.trust` before making the summary's
   claims.

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

Then `docs_search`, `docs_map`, `repo:///docs/overview`, and `repo:///docs/map` use that
scope by default until `docs_scope` changes or clears it. A per-call
`scope_path` overrides the session default. Clear the default with:

```json
{ "action": "clear" }
```

If spec-lifecycle-manager is unavailable, Agent Workbench local spec routing is
non-authoritative. Treat it as bounded routing evidence only; do not use it to
change task status, reconcile specs, promote docs, or close specs.

## Kiro Integration

This skill is packaged in the Agent Workbench Kiro Power. The Power includes
MCP configuration and Kiro hook adapters that launch the installed Agent
Workbench package entrypoint; it must not launch runtime code from the Power
directory.

- `AGENTS.md` and Kiro steering give repository guidance.
- The MCP server is the only executable runtime surface.
- The Power packages this skill, quiet hooks, and MCP server configuration.
- Hooks are wrappers and must stay quiet and action-gated unless explicitly silenced.

## Failure Discipline

- Do not add primary-plus-fallback routes unless the spec and fixture-backed
  tests explicitly require them.
- Do not treat partial timeout or failure output as successful evidence.
- Look for root cause first. Fix the underlying issue or report structured
  degraded/blocked state with the missing evidence named.
