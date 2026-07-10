---
title: First-read reliability and bounded tools canonical context
doc_type: spec
artifact_type: canonical-context
status: draft
owner: platform
last_reviewed: 2026-07-09
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

| Source | Authority reason | Handling |
|--------|------------------|----------|
| `AGENTS.md` | Repository instructions for structure, validation, architecture, and fallback discipline. | Read before changing governed paths. |
| `src/contracts/` | Runtime and presentation contracts used by MCP resources and tools. | Treat as implementation truth; migrate only through tests and durable docs. |
| `src/application/use-cases/` | Current resource/tool behavior for status, scope, overview, context, docs, diagnostics, and verification planning. | Inspect before designing each task slice. |
| `tests/` | Current acceptance and regression evidence. | Use focused fixtures before broad validation. |
| live MCP/resource outputs | Runtime evidence for current freshness, degradation, and trust metadata behavior. | Use as dogfood evidence, not as a substitute for tests. |

## Spec-Canonical Working Sources

| Source | Role | Scope | Notes |
|--------|------|-------|-------|
| `requirements.md` | Accepted intent | Spec 037 | Defines first-read reliability, bounded work, and degradation requirements. |
| `design.md` | Implementation approach | Spec 037 | Maps requirements to contracts, use cases, budgets, and fixtures. |
| `tasks.md` | Execution index | Spec 037 | Do not implement from task text alone. |
| `traceability.md` | Task-to-context lookup | Spec 037 | Use before selecting an implementation task. |
| `verification.md` | Validation and closure evidence | Spec 037 | Update as implementation proceeds. |
| `change-impact.md` | Durable-doc impact | Spec 037 | Tracks docs that must be promoted before closure. |

## Imported Sources

| Spec path | Source path | Source revision or date | Status | Canonical scope | Promotion target |
|-----------|-------------|-------------------------|--------|-----------------|------------------|
| `requirements.md` | `docs/backlog/README.md#eb003-first-read-reliability-and-bounded-tool-behavior` | 2026-07-09 | adapted | EB003 friction signal, acceptance, validation, and promotion target. | `docs/backlog/README.md` |
| `requirements.md`, `design.md` | `docs/reference/runtime-contracts.md` | 2026-07-09 | summarized | Envelope, freshness, evidence, trust, and validation vocabulary. | `docs/reference/runtime-contracts.md` |
| `design.md` | `docs/design/runtime-operations-design.md` | 2026-07-09 | summarized | Cache, warmup, queue, stale/fresh state, and runtime operations behavior. | `docs/design/runtime-operations-design.md` |
| `design.md` | `docs/design/mcp-surface-design.md` | 2026-07-09 | summarized | Public MCP resource/tool expectations and response presentation. | `docs/design/mcp-surface-design.md` |
| `design.md` | `docs/design/graph-store-design.md` | 2026-07-09 | summarized | Snapshot, graph freshness, skipped evidence, and query-budget behavior. | `docs/design/graph-store-design.md` |
| `design.md` | `docs/reference/dogfood-evidence-ledger.md` | 2026-07-09 | background | Dogfood evidence and follow-up routing for runtime reliability. | `docs/reference/dogfood-evidence-ledger.md` |

## Non-Canonical Background Sources

| Source | Reason non-canonical | Handling |
|--------|----------------------|----------|
| closed specs listed in `docs/history/spec-closure-log.md` | Historical delivery records, not active implementation scaffolding. | Use only to avoid re-opening closed scope or to find durable destinations. |
| removed packages listed in `docs/history/spec-archive-index.md` | Archived implementation context. | Use as evidence pointers, not current specs. |
| stale MCP index entries for removed `docs/specs/*` paths | Runtime index may lag the live filesystem. | Verify with direct filesystem reads before relying on active-spec state. |

## Promotion Map

| Spec-local content | Durable destination or route | Required before closure |
|--------------------|------------------------------|-------------------------|
| First-read envelope/freshness behavior | `docs/reference/runtime-contracts.md` | yes |
| Resource/tool bounded-work behavior | `docs/design/mcp-surface-design.md` | yes |
| Cache, warmup, stale/degraded operational behavior | `docs/design/runtime-operations-design.md` | yes |
| Snapshot/query-budget and skipped-evidence behavior | `docs/design/graph-store-design.md` | yes |
| Backlog status and residual follow-up routing | `docs/backlog/README.md` | yes |
| Dogfood or smoke evidence | `docs/reference/dogfood-evidence-ledger.md` when durable evidence is captured | no |

## Related Artifacts

- Requirements: `requirements.md`
- Design: `design.md`
- Tasks: `tasks.md`
- Traceability: `traceability.md`
- Change impact: `change-impact.md`
- Verification: `verification.md`
