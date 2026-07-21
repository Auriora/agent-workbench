---
title: Ranked documentation readiness canonical context
doc_type: spec
artifact_type: canonical-context
status: draft
owner: platform
last_reviewed: 2026-07-21
---

# Canonical Context

## Purpose

Bind Spec 044 to the live `0.6.1` failure and the durable contracts that already
govern ranking, snapshot publication, and first-read trust. The package changes
readiness propagation; it does not redesign authority-aware ranking order or
ranked-universe capacity.

## Authority Hierarchy

Repository instructions, source, tests, public contracts, and live persisted
state remain authoritative. This package is canonical only for the active
implementation slice.

## Always-Canonical External Sources

| Source | Authority reason | Handling |
| --- | --- | --- |
| `AGENTS.md` | Repository implementation and validation rules | Apply to every task. |
| `src/application/use-cases/query-docs.ts` | Current ranking-readiness behavior | Reconcile changes against blocked variants. |
| `src/application/use-cases/get-repo-status.ts` | Current status shape | Extend through application and presentation boundaries. |
| `src/application/use-cases/get-repo-orientation.ts` | Current first-read blocker aggregation | Preserve bounded first-read behavior. |
| `src/application/use-cases/document-currency-routing.ts` | Current concern-map validation | Reuse; do not create a second validator. |
| live snapshot and concern-index state | Runtime truth | Use bounded read-only evidence for acceptance. |

## Spec-Canonical Working Sources

| Source | Role | Scope | Notes |
| --- | --- | --- | --- |
| `requirements.md` | accepted intent | Spec 044 | Defines readiness and trust outcomes. |
| `design.md` | implementation approach | Spec 044 | Defines one readiness path from store to status/orientation. |
| `tasks.md` | execution index | Spec 044 | Follow dependencies and evidence gates. |
| `traceability.md` | bidirectional coverage | Spec 044 | Reconcile before implementation and closure. |

## Imported Sources

| Spec path | Source path | Source revision or date | Status | Canonical scope | Promotion target |
| --- | --- | --- | --- | --- | --- |
| `canonical-context.md` | `docs/backlog/README.md#eb060-ranked-documentation-readiness-and-first-read-trust` | 2026-07-21 | adapted | problem, acceptance, sequencing | backlog status and closure evidence |
| `canonical-context.md` | `docs/design/mcp-surface-design.md` | 2026-07-21 | summarized | first-read and docs-search public policy | same document |
| `canonical-context.md` | `docs/design/runtime-operations-design.md` | 2026-07-21 | summarized | freshness versus reuse | same document |
| `canonical-context.md` | `docs/reference/runtime-contracts.md` | 2026-07-21 | summarized | status, orientation, and blocked result vocabulary | same document |
| `canonical-context.md` | `docs/design/graph-store-design.md` | 2026-07-21 | summarized | concern-index publication/readiness | same document |

## Non-Canonical Background Sources

| Source | Reason non-canonical | Handling |
| --- | --- | --- |
| removed Spec 043 package | Historical delivery scaffolding | Use the closure log and Git history only for audit. |
| EB059 | Separate capacity/eviction decision | Do not fold into Spec 044. |
| EB061 | Separate reference capability decision | Do not fold into Spec 044. |
| EB062 | Separate node-FTS identity and storage repair | Do not fold into Spec 044. |

## Promotion Map

| Spec-local content | Durable destination or route | Required before closure |
| --- | --- | --- |
| readiness and recovery contract | `docs/reference/runtime-contracts.md`, `docs/design/mcp-surface-design.md` | yes |
| publication and status flow | `docs/design/graph-store-design.md`, `docs/design/runtime-operations-design.md` | yes |
| repository map authoring rule | `docs/reference/documentation-map.md` | yes |
| repository-real concern extraction gate | `docs/reference/mvp-proof-matrix.md` | yes |
| implementation evidence | `docs/reference/dogfood-evidence-ledger.md`, closure log | yes |
