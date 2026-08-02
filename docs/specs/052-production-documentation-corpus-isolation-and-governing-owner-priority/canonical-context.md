---
title: Production documentation corpus canonical context
doc_type: spec
artifact_type: canonical-context
status: draft
owner: platform
last_reviewed: 2026-08-02
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Canonical Context

## Purpose

Prevent the dogfood ledger, backlog, removed specs, or fixture documentation
from being mistaken for current behavior authority while this package changes
the very rules used to rank canonical documentation.

## Authority Hierarchy

Repository instructions, live source/tests/contracts, durable canonical owners,
and verified runtime evidence remain authoritative outside this active slice.
This package is canonical only for Spec 052 intended behavior and delivery.

## Always-Canonical External Sources

| Source | Authority reason | Handling |
| --- | --- | --- |
| `AGENTS.md` | Repository instructions | Read before implementation and validation. |
| source, contracts, tests, and live SQLite evidence | Current implementation truth | Reconcile conflicts; do not overwrite them with spec assumptions. |
| `docs/reference/documentation-map.md` | Canonical concern-owner mapping | Preserve exact concern terms and owner semantics. |
| `docs/reference/runtime-contracts.md` | Public contract vocabulary | Promote accepted version/count/trust changes here. |
| `docs/design/mcp-surface-design.md` | Public docs routing behavior | Promote accepted corpus/ranking/failure behavior here. |
| `docs/design/graph-store-design.md` | Persistence and migration behavior | Promote corpus-policy and universe migration behavior here. |

## Spec-Canonical Working Sources

| Source | Role | Scope | Notes |
| --- | --- | --- | --- |
| `requirements.md` | accepted intent | Spec 052 | Governs observable acceptance. |
| `design.md` | implementation approach | Spec 052 | Must remain traceable to requirements. |
| `tasks.md` | execution index | Spec 052 | Do not implement from tasks alone. |
| `research.md` | selected alternatives | Spec 052 | Records rejected fallback/query-time approaches. |

## Imported Sources

| Spec path | Source path | Source revision or date | Status | Canonical scope | Promotion target |
| --- | --- | --- | --- | --- | --- |
| `requirements.md` | `docs/backlog/README.md` EB064 | 2026-08-02 | adapted | problem, acceptance, exclusions | backlog delivery record plus durable docs |
| `research.md` | `docs/reference/dogfood-evidence-ledger.md` | 2026-07-21 entry | summarized | reproduction evidence only | retain ledger and add acceptance result |

## Non-Canonical Background Sources

| Source | Reason non-canonical | Handling |
| --- | --- | --- |
| removed Specs 043 and 044 | historical delivery scaffolding | Use Git history only to explain prior decisions. |
| `docs/reference/dogfood-evidence-ledger.md` | supporting evidence, not behavior owner | Use for reproduction and final acceptance only. |
| embedded fixture documentation | test evidence for containing repository | Exclude from production corpus; include when fixture is root. |

## Promotion Map

| Spec-local content | Durable destination or route | Required before closure |
| --- | --- | --- |
| production corpus eligibility and concern ownership | `docs/reference/documentation-map.md` | yes |
| docs surface ranking/count/failure behavior | `docs/design/mcp-surface-design.md`, `docs/reference/runtime-contracts.md` | yes |
| storage/version/migration behavior | `docs/design/graph-store-design.md` | yes |
| accepted requirements and proof | `docs/requirements/runtime-requirements.md`, `docs/reference/mvp-proof-matrix.md` | yes |
| delivery and residual ownership | `docs/backlog/README.md`, `docs/reference/dogfood-evidence-ledger.md`, `docs/reference/agent-readable-changelog.md` | yes |

## Related Artifacts

- Requirements: `requirements.md`
- Design: `design.md`
- Tasks: `tasks.md`
- Change Impact: `change-impact.md`
- Verification: `verification.md`
