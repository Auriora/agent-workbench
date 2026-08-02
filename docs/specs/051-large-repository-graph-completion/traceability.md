---
title: Large-repository graph completion traceability
doc_type: spec
artifact_type: traceability
status: draft
owner: platform
last_reviewed: 2026-08-02
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Traceability Matrix

## Task To Context Matrix

| Task ID | Requirements | Acceptance criteria | Design sections | Verification | Durable targets | Open decisions |
| --- | --- | --- | --- | --- | --- | --- |
| T001 | Requirement 1, Requirement 2, Requirement 3, Requirement 4, Requirement 5, Requirement 6, Requirement 7 | All phase-1 | Overview, validation strategy | Verification evidence preconditions | none | none |
| T002 | Requirement 3, Requirement 4, Requirement 5, Requirement 6, Requirement 7 | All phase-1 | Scope map, lifecycle model | Traceability and verification setup | none | none |
| T003 | Requirement 1 (AC1-AC4), Requirement 2 | AC1-AC4 | Coverage truth model, deterministic seed | Passing scanner/extraction tests | runtime contracts | none |
| T004 | Requirement 1 (AC5-AC6), Requirement 3, Requirement 4 | all mapped criteria | Continuation + atomic publication | Passing store/workflow tests | runtime contracts | none |
| T005 | Requirement 5 | AC1-AC4 | Downstream trust propagation | Passing contract/query tests | runtime-contracts + mcp-surface | none |
| T006 | Requirement 1 (AC5), Requirement 6 | AC1-AC3 | Debug-sweep completion parity | Passing debug tests and Rails sweeps | debug tooling doc ownership | none |
| T007 | Requirement 7 | all | Coverage strategy + risks | Full suite and Rails sweep pass | none | none |
| T008 | Requirement 1, Requirement 2, Requirement 3, Requirement 4, Requirement 5, Requirement 6, Requirement 7 | all | full spec coverage | Full verification and reviews | durable docs | none |

## Requirement To Delivery Matrix

| Requirement | Priority | Acceptance criteria | Design sections | Tasks | Verification | Coverage State | Residual Destination |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Requirement 1 | must-have | AC1-AC6 | Coverage truth model | T003, T004, T006, T007 | Passed | complete | none |
| Requirement 2 | must-have | AC1-AC3 | Deterministic seed | T003, T007 | Passed | complete | none |
| Requirement 3 | must-have | AC1-AC4 | Continuation model | T004, T007 | Passed | complete | none |
| Requirement 4 | must-have | AC1-AC7 | Atomic publication and partial-seed usability | T004, T005, T007 | Passed | complete | none |
| Requirement 5 | must-have | AC1-AC4 | Downstream trust propagation | T005, T007 | Passed | complete | none |
| Requirement 6 | must-have | AC1-AC3 | Debug-sweep parity | T006, T007 | Passed | complete | none |
| Requirement 7 | must-have | AC1-AC3 | Regression strategy | T007 | Passed | complete | none |

## Design To Implementation Matrix

| Design section | Requirements | Task ownership | Verification readiness |
| --- | --- | --- | --- |
| Coverage truth model | Requirement 1 | T003, T004 | Planned unit/integration |
| Deterministic priority seeding | Requirement 2 | T003 | Planned unit/integration |
| Continuation semantics | Requirement 3 | T004 | Planned workflow tests |
| Atomic publication | Requirement 4 | T004 | Planned transaction tests |
| Trust propagation | Requirement 5 | T005 | Planned query tests |
| Debug completion parity | Requirement 6 | T006 | Planned end-to-end |
| Regression matrix | Requirement 7 | T007 | Planned regression suite |

## Design To Verification Matrix

| Design element | Requirement | Task | Verification | Coverage state | Residual risk |
| --- | --- | --- | --- | --- | --- |
| Coverage truth model | Requirement 1 | T003, T004 | Counter, completion, deadline and generation assertions | complete | none identified |
| Priority seeding | Requirement 2 | T003 | Exact/pattern ordering and continuation tests | complete | none identified |
| Continuation model | Requirement 3 | T004 | Resume, owner, cancel and stale tests | complete | none identified |
| Atomic publication | Requirement 4 | T004 | Seed clone and publication-boundary tests | complete | none identified |
| Trust propagation | Requirement 5 | T005 | Partial/complete coverage contract tests | complete | none identified |
| Debug parity | Requirement 6 | T006 | Debug production-loop replay and Rails sweep | complete | none identified |
| Regression coverage | Requirement 7 | T007 | Full suite, prior gerald and two Rails runs | complete | real engine route remains fixture-backed |

## Open Decision Impact

- Stale continuation ownership is generation-based; no time-based TTL is introduced.
- No open blocking decision is outstanding for snapshot-scoped chunk execution and stable
  target publication semantics.
