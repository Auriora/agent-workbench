---
title: Agent IDE capability analysis design
doc_type: spec
artifact_type: design
status: archived
owner: platform
last_reviewed: 2026-06-05
---

# Technical Design

## Overview

This spec is an analysis and planning slice. It will inspect the predecessor
`agent-ide` repository, compare its capabilities against Agent Workbench, and
produce a prioritized replacement plan. The output should be durable enough to
guide future implementation specs, but it must not make `agent-ide` internals
the architecture source of truth.

## High-Level Design

The analysis has four layers:

1. Inventory predecessor behavior from local docs, skill/plugin manifests,
   MCP/tool definitions, hooks, telemetry notes, cache/runtime code, tests, and
   evaluation notes.
2. Normalize each finding into a language-neutral capability taxonomy:
   status/preflight, context routing, docs/config search, symbol navigation,
   references/impact, diagnostics, validation planning, post-edit feedback,
   edit safety, telemetry, hooks, cache/warmup, and integration guidance.
3. Reconcile each capability with Agent Workbench durable docs, active specs,
   archived specs, current code, and dogfood feedback.
4. Promote the result into roadmap updates and follow-up specs for coherent
   implementation slices.

## Low-Level Design

The analysis artifact should use a matrix with these fields:

- `capability`: stable name in Agent Workbench vocabulary.
- `agent_ide_surface`: predecessor resource, tool, hook, skill, command, or
  internal workflow.
- `observed_value`: why agents used it or what problem it solved.
- `agent_workbench_status`: implemented, active spec, backlog, proposed spec,
  deferred, rejected, or unclear.
- `language_neutral_lesson`: portable behavior to keep.
- `python_specific_parts`: details that must not become shared runtime
  assumptions.
- `recommended_action`: improve existing tool, add new tool, add provider,
  update presenter, update docs, create spec, defer, or reject.
- `evidence_needed`: fixtures, telemetry, dogfood repo, tests, or design
  decision needed before implementation.

The analysis should prefer local evidence in this order:

1. Agent Workbench durable docs and active specs.
2. Agent Workbench code/tests and MCP contracts.
3. Existing Agent Workbench dogfood notes.
4. `agent-ide` docs, tests, skills/plugins, telemetry, and runtime code.
5. User-provided comparisons from external repo agents.

Recommended public tool changes must pass these checks:

- Can the workflow be better handled by `context_for_task`,
  `verification_plan`, or presenter guidance?
- Does the capability require a new application use case, or only better
  routing/ranking within an existing one?
- Can the response use the shared envelope and capability labels?
- Is the capability useful across multiple languages or project types?
- Does it avoid hidden broad scans, command execution, and noisy hook output?

## Operational Considerations

The analysis may inspect neighboring local repositories such as
`../agent-ide`, but it must not modify them. Any generated comparison notes
should live inside this repository under `docs/reference/` or `.tmp/`, depending
on whether they are intended to become durable evidence.

If telemetry or Jaeger data is used, the analysis must record what time window
and data source were inspected. Sensitive paths, command arguments, or payloads
must be summarized rather than copied wholesale.

## Open Questions

- Which `agent-ide` telemetry window is representative enough for current
  replacement planning?
- Should the final matrix live as a durable reference doc, a design appendix,
  or both?
- Which gaps deserve immediate specs after Specs 007-009, and which should
  remain durable roadmap items until more dogfood evidence exists?
