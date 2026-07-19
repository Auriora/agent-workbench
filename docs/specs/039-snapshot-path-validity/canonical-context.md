---
title: Snapshot path validity canonical context
doc_type: spec
artifact_type: canonical-context
status: draft
owner: platform
last_reviewed: 2026-07-19
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Canonical Context

## Purpose

Prevent the deleted Spec 035 package and stale Workbench index from being
mistaken for current implementation authority while repairing snapshot trust.

## Authority Hierarchy

Repository instructions, current source/tests, durable docs, Git evidence, and
live filesystem/runtime evidence remain higher authority than this temporary
package. The package is canonical only for the intended Spec 039 delivery slice.

## Always-Canonical External Sources

| Source | Authority reason | Handling |
| --- | --- | --- |
| `AGENTS.md` | Repository implementation and validation policy | Read before every task. |
| current source and tests | Implementation truth | Reconcile conflicts; do not override. |
| `docs/design/graph-store-design.md` | Graph persistence owner | Promote accepted invariants here. |
| `docs/design/runtime-operations-design.md` | Freshness/refresh owner | Promote invalidation behavior here. |
| `docs/design/mcp-surface-design.md` | Public MCP behavior owner | Promote stale/degraded behavior here. |
| `docs/reference/runtime-contracts.md` | Contract vocabulary owner | Reuse canonical enums/shapes. |
| Git commit `c90769b` and current filesystem | Deletion evidence | Treat Spec 035 paths as absent/historical. |

## Spec-Canonical Working Sources

| Source | Role | Scope |
| --- | --- | --- |
| `requirements.md` | accepted intent | Spec 039 |
| `design.md` | implementation approach | Spec 039 |
| `tasks.md` | execution index | Spec 039 |
| `traceability.md` | task/requirement mapping | Spec 039 |

## Imported Sources

| Spec path | Source path | Revision/date | Status | Canonical scope | Promotion target |
| --- | --- | --- | --- | --- | --- |
| `requirements.md` | EB051 in `docs/backlog/README.md` | 2026-07-19 | adapted | observed defect and intended outcomes | backlog delivery status |
| `change-impact.md` | current durable graph/runtime/MCP docs | 2026-07-19 | summarized | current behavior boundaries | same durable owners |
| `verification.md` | live snapshot and Git deletion evidence | 2026-07-19 | summarized | defect reproduction only | dogfood ledger if retained |

## Non-Canonical Background Sources

| Source | Reason non-canonical | Handling |
| --- | --- | --- |
| `docs/specs/035-trust-calibration-tool-outputs/**` from stale index output | Deleted historical scaffolding | Use only as defect evidence; do not restore or direct-read. |
| stale snapshot `1783312125057` | Known path-invalid evidence | Do not use for implementation/closure claims. |

## Promotion Map

| Spec-local content | Durable destination | Required before closure |
| --- | --- | --- |
| snapshot validity and invalidation | runtime operations; runtime contracts | yes |
| graph/docs removal invariants | graph store design | yes |
| public stale/degraded behavior | MCP surface design; changelog | yes |
| delivery/residual status | backlog and history records | yes |
