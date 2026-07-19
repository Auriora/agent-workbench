---
title: Snapshot path validity traceability
doc_type: spec
artifact_type: traceability
status: draft
owner: platform
last_reviewed: 2026-07-19
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Traceability Matrix

## Task To Context Matrix

| Task | Requirements | Acceptance Criteria | Properties | Design sections | Verification | Durable targets |
| --- | --- | --- | --- | --- | --- | --- |
| T001 | Requirement 1; Requirement 2; Requirement 3; Requirement 4; Requirement 5 | Requirement 1 AC1-AC4; Requirement 2 AC1-AC4; Requirement 3 AC1-AC4; Requirement 4 AC1-AC4; Requirement 5 AC1-AC4 | CP-001-CP-005 | Shared Validity; Cross-Surface; Graph Guard; Docs Removal | Reproduction and contract fixtures | runtime contracts |
| T002 | Requirement 1; Requirement 5 | Requirement 1 AC1-AC4; Requirement 5 AC1-AC4 | CP-001, CP-005 | Shared Validity; Coordinated Invalidation | Valid/missing/incomplete/budget tests | runtime operations; graph store |
| T003 | Requirement 2 | Requirement 2 AC1-AC4 | CP-002 | Cross-Surface Freshness | Same-snapshot golden comparison | runtime contracts; MCP surface |
| T004 | Requirement 3 | Requirement 3 AC1-AC4 | CP-003 | Graph Query Guard | Deleted-node and provider-error tests | MCP surface; runtime contracts |
| T005 | Requirement 4 | Requirement 4 AC1-AC4 | CP-004 | Transactional Documentation Removal | SQLite/count/FTS tests | graph store design |
| T006 | Requirement 1; Requirement 2; Requirement 3; Requirement 4; Requirement 5 | all | CP-001-CP-005 | Validation Strategy | Focused and full gates | none |
| T007 | Requirement 1; Requirement 2; Requirement 3; Requirement 4; Requirement 5 | all | all | Slice Boundary | Promotion and closure checks | all named durable owners |

## Requirement To Delivery Matrix

| Requirement | Priority | Acceptance Criteria | Design Sections | Tasks | Verification | Durable Targets | Coverage State | Residual Destination |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Requirement 1 | must-have | AC1-AC4 | Shared Snapshot Validity; Coordinated Invalidation | T001-T002, T006-T007 | Valid/missing/incomplete/budget fixtures | runtime operations; runtime contracts | complete | none |
| Requirement 2 | must-have | AC1-AC4 | Cross-Surface Freshness | T001, T003, T006-T007 | Same-snapshot golden comparison | runtime contracts; MCP surface | complete | none |
| Requirement 3 | must-have | AC1-AC4 | Graph Query Guard | T001, T004, T006-T007 | Deleted-node and provider-error tests | MCP surface; runtime contracts | complete | none |
| Requirement 4 | must-have | AC1-AC4 | Transactional Documentation Removal | T001, T005-T007 | SQLite/count/FTS tests | graph store design | complete | none |
| Requirement 5 | must-have | AC1-AC4 | Shared Validity; Validation Strategy | T001-T002, T006-T007 | Budget/cache/compatibility tests | runtime operations | complete | none |

## Correctness Property Coverage

| Property | Requirements | Tasks | Planned evidence | Residual risk |
| --- | --- | --- | --- | --- |
| CP-001 | Requirement 1 | T001-T002 | Index-then-delete freshness fixture | pending |
| CP-002 | Requirement 2 | T001, T003 | Same-snapshot cross-surface golden | pending |
| CP-003 | Requirement 3 | T001, T004 | Deleted-node MCP regression | pending |
| CP-004 | Requirement 4 | T001, T005 | SQLite row/count/FTS assertions | pending |
| CP-005 | Requirement 1, Requirement 5 | T001-T002 | Low-budget/incomplete receipt fixture | pending |

## Design To Implementation Matrix

| Design section | Requirements | Tasks | Likely interfaces/files | Coverage state |
| --- | --- | --- | --- | --- |
| Shared Snapshot Validity | Requirement 1, Requirement 5 | T001-T002 | application use case, runtime model/contracts, path port | not-covered |
| Coordinated Invalidation | Requirement 1, Requirement 5 | T002 | change queue, warm-up, server composition | not-covered |
| Cross-Surface Freshness | Requirement 2 | T003 | status/orientation/task/docs/query helpers | not-covered |
| Graph Query Guard | Requirement 3 | T004 | graph use cases, presenters, registries | not-covered |
| Transactional Documentation Removal | Requirement 4 | T005 | SQLite graph/docs store | not-covered |

## Open Decision Impact

| Decision ID | Blocks | Requirements | Tasks | Resolution needed |
| --- | --- | --- | --- | --- |
| D001 validity cache key | T002 implementation | Requirement 1, Requirement 5 | T001-T002 | Select an existing catalog/change-generation signal or document the minimal new contract before implementation. |

## Maintenance Notes

- Replace `not-covered` only with concrete task and verification evidence.
- Any partial result requires one destination before closure.
