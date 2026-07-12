---
title: Agent Workbench adoption flow design
doc_type: spec
artifact_type: design
status: draft
owner: platform
last_reviewed: 2026-07-12
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Technical Design

## Overview

The slice improves the existing provider-neutral MCP workflow rather than
adding another implementation path. Provider packages activate the workflow;
the runtime supplies orientation, task context, navigation, and validation
planning through existing layered use cases and thin MCP presenters.

## Requirement Coverage

| Requirement | Design coverage | Validation |
| --- | --- | --- |
| R1 | Claude skill, startup guidance, package validation | Claude plugin fixtures and skill validation |
| R2 | Compact orientation receipt linked to existing detailed resources | Receipt, compatibility, invalidation, and budget tests |
| R3 | Selective continuation policy in existing task-context presentation | Usefulness, cap, deduplication, and schema fixtures |
| R4 | Progressive use of existing graph tools | Minimum-evidence query fixtures, budgets, metadata tests |
| R5 | Intent classification in task context and validation recommendation policy | Read-only/edit/review/docs/closure fixtures |

## Correctness Property Coverage

| Property | Design behavior | Validation direction |
| --- | --- | --- |
| CP-001 | Snapshot identity controls refresh guidance. | Deterministic contract tests. |
| CP-002 | Continuations are filtered through caller capability and schemas. | Golden and schema tests. |
| CP-003 | Validation retains planned/blocked/executed distinctions. | Trust golden tests. |
| CP-004 | Provider files contain guidance and wrappers only. | Architecture and plugin validation. |
| CP-005 | Default guidance has a no-noise and response-budget ceiling. | Baseline comparison and adjudicated workflow fixtures. |

## High-Level Design

The runtime remains provider-neutral and layered. Provider packages expose one
entry action; application use cases own orientation, task-continuation, graph,
and validation policy; MCP registries remain thin schema and presentation
adapters.

### Components And Changes

### Claude Activation

Make the packaged Agent Workbench skill the one canonical Claude entry action.
Startup output may contain one compact conditional pointer to that skill, but
must not repeat its workflow, invoke it automatically, or duplicate the same
instruction through several surfaces. Keep launchers and hooks quiet wrappers;
no Claude-specific routing enters application or domain layers.

### Orientation Entry Path

Add one compact orientation receipt resource. It contains snapshot identity,
freshness and trust summaries, material blockers, and links or next actions for
the existing detailed status, scope, and overview resources. It does not embed
their inventories in `context_for_task`, deprecate them, or hide degraded
evidence. Refresh policy is driven by material root, scope, policy, runtime,
and index-validity changes; ordinary content edits may mark graph evidence
stale without forcing the orientation ritual to repeat.

### Context Continuation

Refine the existing ordered `next_actions`; do not introduce a parallel
continuation field. Emit one primary and at most two secondary actions only
when they resolve a named uncertainty with material expected information gain.
Reuse resolved node IDs, return exact arguments, include a short reason and
expected evidence, and deduplicate calls already satisfied by the response.
Put only task-blocking unavailable evidence in compact `limitations` output.

Deterministic precedence is: material blocker or invalid orientation, direct
source evidence needed for the current question, semantic navigation needed to
resolve a named uncertainty, then validation needed for an edit or closure
decision. Omit the list when no further call materially improves the task.

### Navigation Flow

Use the existing `symbol_search`, `find_references`, and `impact` surfaces
progressively. Recommend only the minimum evidence needed for the current
uncertainty; definition-only and reference-only tasks must not over-fetch impact
or tests. A combined public tool is outside this slice and requires a separate
controlled proposal rather than low invocation counts alone.

### Intent-Aware Validation

Use evidence precedence rather than a free-text-first classifier: explicit
caller mode or user instruction, task-owned edit set and current phase,
lifecycle evidence, then bounded task-text inference. Pre-existing unrelated
dirty files do not imply edit intent. Unknown or conflicting intent stays
neutral. Validation becomes prominent only when it changes the next safe
decision; unchanged advice is not repeated. The planner continues to propose
commands without executing them.

## Low-Level Design

The selected D001 and D002 contracts must define their exact request and
response fields in the canonical contract modules before presenter changes.
Continuation construction filters candidate actions by caller capability,
evidence availability, and argument-schema completeness.

### Data Flow

```text
provider guidance
  -> orientation entry path
  -> context_for_task
  -> selective callable continuation when useful
  -> minimum bounded navigation when applicable
  -> verification_plan when task evidence warrants it
```

## Error Handling And Trust

- Preserve structured fresh, stale, degraded, blocked, and unsupported states.
- Do not return partial success after timeout or crash.
- Do not introduce retries, alternate parsers, shell fallbacks, or hidden tool
  execution.
- Treat history measurements as planning evidence only.
- Valid `partial` evidence means a bounded operation completed and truthfully
  reported capability or coverage gaps. Timeout, crash, or corrupt snapshot is
  degraded or blocked and cannot claim a useful partial result.

## Slice Boundary And Residual Architecture

| Target | In this slice | Out of this slice | Destination | Blocks closure? |
| --- | --- | --- | --- | --- |
| Cross-client activation | Claude guidance plus shared workflow consistency | New provider runtimes | backlog | no |
| Orientation consolidation | Compact receipt plus unchanged detailed resources | Removing legacy resources | EB048 | no |
| Executable continuation | Ranked schema-valid actions | Autonomous action execution | none | no |
| Navigation ergonomics | Progressive existing-flow improvement | Combined public tool; semantic/LSP fallback | EB049 | no |
| Intent-aware validation | Recommendation prominence | Command execution | EB050 | no |

## Decisions

- **D001 resolved:** use a compact aggregate orientation receipt linked to the
  existing detailed resources; do not embed broad orientation in task context.
- **D002 resolved:** improve progressive continuation through existing graph
  tools; do not add a combined public navigation tool in this slice.

## Open Questions

- What existing per-surface byte and latency budgets form the baseline for the
  no-regression gate? T001 records them before implementation.

## Validation Strategy

Use contract, golden, integration, architecture-boundary, budget, package, and
adjudicated workflow fixtures. Compare current and proposed behavior for target
selection, evidence completeness, unsupported claims, irrelevant actions,
caller decisions, tool round trips, and payload bytes. History replay is
observational evidence and does not replace controlled tests or become a
closure gate for increased invocation.

## Operational Considerations

No migration, network service, or command runner is introduced. Existing
resources and tools remain available until compatibility evidence supports any
deprecation. Runtime telemetry may observe call sequences, but normal operation
must not depend on history mining or an external analysis service.

This slice is additive: existing field semantics and detailed resource outputs
remain stable. Startup text, orientation receipts, and task-context responses
must stay within recorded baseline budgets. New guidance that exceeds a budget
requires an explicit review showing the compensating decision-quality benefit.

## Related Artifacts

- Requirements: `requirements.md`
- Tasks: `tasks.md`
- Traceability: `traceability.md`
- Verification: `verification.md`
