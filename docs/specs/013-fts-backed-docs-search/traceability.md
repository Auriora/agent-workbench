---
title: FTS-backed docs search traceability
doc_type: spec
artifact_type: traceability
status: archived
owner: platform
last_reviewed: 2026-06-06
---

# Traceability Matrix

## Task To Context Matrix

| Task ID | Requirements | Acceptance Criteria | Design Sections | Durable Targets | Verification |
| --- | --- | --- | --- | --- | --- |
| T001 | Requirement 2, Requirement 4 | Requirement 2 AC1-AC3; Requirement 4 AC1 | `design.md#querying`, `design.md#operational-considerations` | fixtures and parity cases | `verification.md#parity-scenarios` |
| T002 | Requirement 1, Requirement 2, Requirement 3 | Requirement 1 AC1-AC3; Requirement 2 AC1-AC3; Requirement 3 AC1-AC3 | `design.md#data-model`, `design.md#querying`, `design.md#surface-compatibility` | storage and cursor decision record | `verification.md#quality-gates` |
| T003 | Requirement 1, Requirement 3 | Requirement 1 AC1-AC3; Requirement 3 AC1-AC3 | `design.md#data-model`, `design.md#degraded-state` | docs index ports and contracts | `verification.md#quality-gates` |
| T004 | Requirement 1 | Requirement 1 AC1-AC3 | `design.md#data-model`, `design.md#indexing` | SQLite FTS docs index migration | `verification.md#quality-gates` |
| T005 | Requirement 1 | Requirement 1 AC1-AC3 | `design.md#indexing`, `design.md#operational-considerations` | docs index writer | `verification.md#quality-gates` |
| T006 | Requirement 2 | Requirement 2 AC1-AC3 | `design.md#querying` | FTS query adapter and ranking | `verification.md#quality-gates` |
| T007 | Requirement 1 | Requirement 1 AC2-AC3 | `design.md#indexing`, `design.md#operational-considerations` | warmup/snapshot integration | `verification.md#quality-gates` |
| T008 | Requirement 2, Requirement 3 | Requirement 2 AC1-AC3; Requirement 3 AC1-AC3 | `design.md#querying`, `design.md#surface-compatibility` | `docs_search` use case and MCP behavior | `verification.md#quality-gates` |
| T009 | Requirement 3 | Requirement 3 AC1-AC3 | `design.md#degraded-state`, `design.md#surface-compatibility` | degraded-state and telemetry coverage | `verification.md#quality-gates` |
| T010 | Requirement 4 | Requirement 4 AC1-AC2 | `design.md#operational-considerations` | parity evidence | `verification.md#parity-scenarios` |
| T011 | Requirement 4 | Requirement 4 AC3 | `design.md#overview`, `design.md#operational-considerations` | durable design/reference docs and archived spec | `verification.md#quality-gates` |

## Requirement To Delivery Matrix

| Requirement | Tasks |
| --- | --- |
| Requirement 1: FTS Docs Index | T003, T004, T005, T007 |
| Requirement 2: Search Ranking And Pagination | T001, T006, T008 |
| Requirement 3: Existing Docs Surface Compatibility | T003, T008, T009 |
| Requirement 4: Parity And Promotion Evidence | T001, T010, T011 |

## Design To Implementation Matrix

| Design Section | Requirements | Tasks | Durable Targets | Verification |
| --- | --- | --- | --- | --- |
| `design.md#data-model` | Requirement 1, Requirement 3 | T002, T003, T004 | SQLite docs index schema and contracts | adapter and contract tests |
| `design.md#indexing` | Requirement 1 | T005, T007 | warmup/snapshot integration | runtime and adapter tests |
| `design.md#querying` | Requirement 2, Requirement 3 | T001, T006, T008 | `docs_search` use case and MCP behavior | docs search and MCP tests |
| `design.md#degraded-state` | Requirement 1, Requirement 3 | T003, T008, T009 | degraded/blocked envelopes | stale/invalid index tests |
| `design.md#surface-compatibility` | Requirement 3 | T008, T009 | public docs surface compatibility | MCP golden tests |
| `design.md#operational-considerations` | Requirement 4 | T010, T011 | parity evidence and durable docs | dogfood and closure checks |

## Open Decision Impact

| Decision | Options | Related Tasks |
| --- | --- | --- |
| OD-001 storage location | Existing graph SQLite database, separate docs tables in same database, or separate docs SQLite file | T002, T004, T005 |
| OD-002 cursor shape | Opaque offset token, snapshot plus rank offset, or query hash plus offset | T002, T003, T006, T008 |
| OD-003 overview/map index use | Keep scanner/direct read for overview/map in this spec or migrate them to indexed docs tables later | T002, T008, T011 |
