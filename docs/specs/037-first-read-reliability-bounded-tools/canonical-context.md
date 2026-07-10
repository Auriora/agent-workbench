---
title: First-read reliability and bounded tools canonical context
doc_type: spec
artifact_type: canonical-context
status: draft
owner: platform
last_reviewed: 2026-07-10
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Canonical Context

## Purpose

This package promotes EB003 into an active implementation spec for first-read
reliability and bounded tool behavior. The slice spans runtime envelopes,
MCP resources and tools, graph/cache operations, trust metadata, validation
planning, diagnostics, and durable documentation, so it needs an explicit
working-context map.

## Authority Hierarchy

The spec-local context is canonical only for this active implementation slice.
It does not override system, developer, or user instructions, `AGENTS.md`,
source code, tests, generated contracts, live runtime evidence, or durable
current-state documentation. Conflicts with current code or tests are
reconciliation inputs, not permission to bypass the normal architecture or
validation rules.

## Always-Canonical External Sources

`AGENTS.md`

- Authority reason: repository instructions for structure, validation,
  architecture, and fallback discipline.
- Handling: read before changing governed paths.

`src/contracts/`

- Authority reason: runtime and presentation contracts used by MCP resources and
  tools.
- Handling: treat as implementation truth; migrate only through tests and
  durable docs.

`src/application/use-cases/`

- Authority reason: current resource/tool behavior for status, scope, overview,
  context, docs, diagnostics, and verification planning.
- Handling: inspect before designing each task slice.

`tests/`

- Authority reason: current acceptance and regression evidence.
- Handling: use focused fixtures before broad validation.

Live MCP/resource outputs

- Authority reason: runtime evidence for current freshness, degradation, and
  trust metadata behavior.
- Handling: use as dogfood evidence, not as a substitute for tests.

## Spec-Canonical Working Sources

`requirements.md`

- Role: accepted intent.
- Scope: Spec 037.
- Notes: defines first-read reliability, bounded work, and degradation
  requirements.

`design.md`

- Role: implementation approach.
- Scope: Spec 037.
- Notes: maps requirements to contracts, use cases, budgets, and fixtures.

`tasks.md`

- Role: execution index.
- Scope: Spec 037.
- Notes: do not implement from task text alone.

`traceability.md`

- Role: task-to-context lookup.
- Scope: Spec 037.
- Notes: use before selecting an implementation task.

`verification.md`

- Role: validation and closure evidence.
- Scope: Spec 037.
- Notes: update as implementation proceeds.

`change-impact.md`

- Role: durable-doc impact.
- Scope: Spec 037.
- Notes: tracks docs that must be promoted before closure.

`open-decisions.md`

- Role: implementation-blocking decision tracker.
- Scope: Spec 037.
- Notes: resolve or route D001-D003 before implementation starts.

## Imported Sources

`docs/backlog/README.md#eb003-first-read-reliability-and-bounded-tool-behavior`

- Spec path: `requirements.md`.
- Source revision or date: 2026-07-09.
- Status: adapted.
- Canonical scope: EB003 friction signal, acceptance, validation, and promotion
  target.
- Promotion target: `docs/backlog/README.md`.

`docs/reference/runtime-contracts.md`

- Spec path: `requirements.md`, `design.md`.
- Source revision or date: 2026-07-09.
- Status: summarized.
- Canonical scope: envelope, freshness, evidence, trust, and validation
  vocabulary.
- Promotion target: `docs/reference/runtime-contracts.md`.

`docs/design/runtime-operations-design.md`

- Spec path: `design.md`.
- Source revision or date: 2026-07-09.
- Status: summarized.
- Canonical scope: cache, warmup, queue, stale/fresh state, and runtime
  operations behavior.
- Promotion target: `docs/design/runtime-operations-design.md`.

`docs/design/mcp-surface-design.md`

- Spec path: `design.md`.
- Source revision or date: 2026-07-09.
- Status: summarized.
- Canonical scope: public MCP resource/tool expectations and response
  presentation.
- Promotion target: `docs/design/mcp-surface-design.md`.

`docs/design/graph-store-design.md`

- Spec path: `design.md`.
- Source revision or date: 2026-07-09.
- Status: summarized.
- Canonical scope: snapshot, graph freshness, skipped evidence, and query-budget
  behavior.
- Promotion target: `docs/design/graph-store-design.md`.

`docs/reference/dogfood-evidence-ledger.md`

- Spec path: `design.md`.
- Source revision or date: 2026-07-09.
- Status: background.
- Canonical scope: dogfood evidence and follow-up routing for runtime
  reliability.
- Promotion target: `docs/reference/dogfood-evidence-ledger.md`.

## Non-Canonical Background Sources

Closed specs listed in `docs/history/spec-closure-log.md`

- Reason non-canonical: historical delivery records, not active implementation
  scaffolding.
- Handling: use only to avoid re-opening closed scope or to find durable
  destinations.

Removed packages listed in `docs/history/spec-archive-index.md`

- Reason non-canonical: archived implementation context.
- Handling: use as evidence pointers, not current specs.

Stale MCP index entries for removed `docs/specs/*` paths

- Reason non-canonical: runtime index may lag the live filesystem.
- Handling: verify with direct filesystem reads before relying on active-spec
  state.

## Promotion Map

- First-read envelope/freshness behavior:
  `docs/reference/runtime-contracts.md`; required before closure.
- Resource/tool bounded-work behavior:
  `docs/design/mcp-surface-design.md`; required before closure.
- Cache, warmup, stale/degraded operational behavior:
  `docs/design/runtime-operations-design.md`; required before closure.
- Snapshot/query-budget and skipped-evidence behavior:
  `docs/design/graph-store-design.md`; required before closure.
- Backlog status and residual follow-up routing:
  `docs/backlog/README.md`; required before closure.
- Dogfood or smoke evidence: `docs/reference/dogfood-evidence-ledger.md` when
  durable evidence is captured; not required before closure.

## Related Artifacts

- Requirements: `requirements.md`
- Design: `design.md`
- Tasks: `tasks.md`
- Traceability: `traceability.md`
- Change impact: `change-impact.md`
- Verification: `verification.md`
- Open decisions: `open-decisions.md`
