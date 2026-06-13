---
title: Spec task traceability lookup design
doc_type: spec
artifact_type: design
status: active
owner: platform
last_reviewed: 2026-06-09
---

# Technical Design

## Overview

Add spec-aware routing to Agent Workbench task context, with an explicit
boundary that spec-lifecycle-manager remains authoritative for spec task
context, traceability, reconciliation, promotion, closure checks, migrations,
templates, Kiro-style lifecycle workflow, and lifecycle policy.

Agent Workbench should help agents join lifecycle context to repository
evidence. It should not become the lifecycle engine.

## High-Level Design

Components:

- Spec-reference detector in `context_for_task` for prompts mentioning spec
  paths, spec IDs, task IDs, requirements, design, tasks, reconciliation, or
  closure.
- Companion lifecycle integration metadata that can report
  spec-lifecycle-manager as configured, discovered, callable, unavailable, or
  unknown.
- Lifecycle context bridge that can consume companion preflight, task detail,
  validation plan, evidence quality, task-state audit, and closure-risk
  summaries as upstream context before broad repo search.
- Bounded local spec routing reader for fallback evidence only when
  spec-lifecycle-manager is unavailable or unknown.
- Repo-evidence bridge from lifecycle task context to Agent Workbench files,
  symbols, impact, edit preview, diagnostics, and validation planning.
- Skill and Kiro Power guidance that states the ownership boundary.

## Low-Level Design

The detector should recognize explicit lifecycle references without broadly
scanning every spec by default. When spec-lifecycle-manager MCP is available,
Agent Workbench should emit a next action or routing hint to use
`task_context` or `traceability_lookup` for authoritative lifecycle context.
If the caller supplies companion lifecycle outputs, or the active client can
prove the companion surfaces are callable, Agent Workbench should treat those
outputs as the first routing input. It should join lifecycle preflight, task
detail, validation plan, evidence quality, task-state audit, and closure-risk
summaries to repository files, symbols, diagnostics, and verification planning
without reinterpreting lifecycle status.

The local reader should read only bounded Markdown files in a selected spec
package. It may extract artifact presence, headings, checklist IDs, likely file
mentions, and validation headings as routing evidence. It must label that output
as non-authoritative and must not assemble closure decisions, reconcile drift,
select next tasks, update statuses, rewrite specs, or normalize templates.

Lifecycle evidence and repository evidence remain separate in presentation.
Task-state, evidence-quality, and closure-risk findings may become caveats,
blockers, or next-action routing hints, but they must not become Agent
Workbench-owned task transitions or closure decisions.

Integration health/profile output should treat spec-lifecycle-manager as a
companion runtime, not as an Agent Workbench backend. If caller-discovered
evidence is absent, the lifecycle surface remains unknown and must not appear as
proven callable.

## Operational Considerations

- Treat archived specs as historical.
- Avoid broad scanning unless the prompt clearly references specs.
- Keep excerpts bounded and repo-relative.
- Prefer discovered companion lifecycle context over local spec parsing when
  available, but do not make spec-lifecycle-manager a required backend for
  normal Agent Workbench operation.
- Keep Kiro-specific spec workflow, hooks, prompts, and templates in
  spec-lifecycle-manager.
- Agent Workbench hooks remain limited to readiness and quiet post-edit
  feedback; spec transition, reconciliation, closure, and task-status hooks are
  lifecycle-manager concerns.

## Open Questions

- Exact mechanism for discovering companion MCP callability in each client.
- Whether Agent Workbench should ever broker a lifecycle MCP call, or only
  report the appropriate companion tool next action.
