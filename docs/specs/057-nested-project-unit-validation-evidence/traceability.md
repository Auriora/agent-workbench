---
title: Nested project-unit validation evidence traceability
doc_type: spec
artifact_type: traceability
status: draft
owner: platform
last_reviewed: 2026-08-04
---

# Traceability Matrix

## Purpose

Map every Spec 057 requirement and correctness property to its design,
implementation task, verification evidence, and durable promotion target. This
matrix is the starting point for task execution and closure reconciliation.

## Task To Context Matrix

| Task ID | Requirements | Acceptance Criteria | Design Sections | Change Impact | Verification | Durable Targets | Open Decisions |
|---------|--------------|---------------------|-----------------|---------------|--------------|-----------------|----------------|
| T001 | Requirement 2, Requirement 3, Requirement 4, Requirement 7, Requirement 8 | Requirement 2 AC1; Requirement 3 AC1; Requirement 3 AC4; Requirement 4 AC3; Requirement 7 AC1; Requirement 8 AC2; Requirement 8 AC3 | Data Models; Function Signatures and Interfaces; Migration and Compatibility | Contract, fixture, and compatibility deltas | G1, G2 | `docs/reference/runtime-contracts.md` | Smallest additive contract shape, resolved in T001 |
| T002 | Requirement 1, Requirement 3 | Requirement 1 AC1; Requirement 1 AC2; Requirement 1 AC3; Requirement 1 AC4; Requirement 1 AC5; Requirement 3 AC1; Requirement 3 AC2; Requirement 3 AC3 | Algorithms and Logic; Data Flow | Discovery and selection delta | G2 | `docs/design/edit-and-validation-loop-design.md` | none |
| T003 | Requirement 2 | Requirement 2 AC1; Requirement 2 AC2; Requirement 2 AC3; Requirement 2 AC4; Requirement 2 AC5 | Components and Changes; Algorithms and Logic; Security, Trust, and Access | Marker-recognition delta | G2 | `docs/design/edit-and-validation-loop-design.md` | none |
| T004 | Requirement 4, Requirement 8 | Requirement 4 AC1; Requirement 4 AC2; Requirement 4 AC3; Requirement 4 AC4; Requirement 8 AC1; Requirement 8 AC2; Requirement 8 AC3; Requirement 8 AC4 | Data Flow; Error Handling | Readiness/blocking delta | G2 | `docs/design/edit-and-validation-loop-design.md`, `docs/reference/runtime-contracts.md` | none |
| T005 | Requirement 1, Requirement 2, Requirement 3, Requirement 4, Requirement 7, Requirement 8 | Requirement 1 AC1; Requirement 1 AC2; Requirement 1 AC3; Requirement 1 AC4; Requirement 1 AC5; Requirement 2 AC1; Requirement 2 AC2; Requirement 2 AC3; Requirement 2 AC4; Requirement 2 AC5; Requirement 3 AC1; Requirement 3 AC2; Requirement 3 AC3; Requirement 3 AC4; Requirement 3 AC5; Requirement 4 AC1; Requirement 4 AC2; Requirement 4 AC3; Requirement 4 AC4; Requirement 7 AC1; Requirement 8 AC1; Requirement 8 AC2; Requirement 8 AC3; Requirement 8 AC4 | Correctness Property Coverage; Validation Strategy | Foundation checkpoint | G1-G3 | none | none |
| T006 | Requirement 5 | Requirement 5 AC1; Requirement 5 AC2; Requirement 5 AC3; Requirement 5 AC4 | Data Models; Error Handling | Git claim-separation delta | G3 | `docs/design/edit-and-validation-loop-design.md`, contract docs if public | Existing port or new narrow read-only port, resolved before coding |
| T007 | Requirement 6, Requirement 8 | Requirement 6 AC1; Requirement 6 AC2; Requirement 6 AC3; Requirement 6 AC4; Requirement 6 AC5; Requirement 8 AC1; Requirement 8 AC2; Requirement 8 AC3; Requirement 8 AC4 | Security, Trust, and Access; Slice Boundary And Residual Architecture | Submodule boundary and follow-up delta | G4 | `docs/backlog/README.md`, security docs if required | none |
| T008 | Requirement 1, Requirement 2, Requirement 3, Requirement 4, Requirement 5, Requirement 6, Requirement 8 | Requirement 1 AC1; Requirement 1 AC2; Requirement 1 AC3; Requirement 1 AC4; Requirement 1 AC5; Requirement 2 AC1; Requirement 2 AC2; Requirement 2 AC3; Requirement 2 AC4; Requirement 2 AC5; Requirement 3 AC1; Requirement 3 AC2; Requirement 3 AC3; Requirement 3 AC4; Requirement 3 AC5; Requirement 4 AC1; Requirement 4 AC2; Requirement 4 AC3; Requirement 4 AC4; Requirement 5 AC1; Requirement 5 AC2; Requirement 5 AC3; Requirement 5 AC4; Requirement 6 AC1; Requirement 6 AC2; Requirement 6 AC3; Requirement 6 AC4; Requirement 6 AC5; Requirement 8 AC1; Requirement 8 AC2; Requirement 8 AC3; Requirement 8 AC4 | System Architecture; Data Flow; Migration and Compatibility | Planner/presenter compatibility delta | G1-G5 | `docs/reference/runtime-contracts.md`, `docs/design/edit-and-validation-loop-design.md` | none |
| T009 | Requirement 1, Requirement 2, Requirement 3, Requirement 4, Requirement 5, Requirement 6, Requirement 7, Requirement 8 | All acceptance criteria | Validation Strategy | Regression evidence | G2-G5 | none | none |
| T010 | Requirement 1, Requirement 2, Requirement 3, Requirement 4, Requirement 5, Requirement 6, Requirement 7, Requirement 8 | All acceptance criteria | Validation Strategy; Security, Trust, and Access | Review findings | G6 | none | none |
| T011 | Requirement 1, Requirement 2, Requirement 3, Requirement 4, Requirement 5, Requirement 6, Requirement 7, Requirement 8 | All acceptance criteria | Validation Strategy; Operational Considerations | Full validation evidence | G7 | none | none |
| T012 | Requirement 1, Requirement 2, Requirement 3, Requirement 4, Requirement 5, Requirement 6, Requirement 7, Requirement 8 | Durable promotion criteria | Slice Boundary And Residual Architecture; Operational Considerations | All promotion targets | G8 | backlog, design, runtime contracts, capability matrix, security doc | Existing Spec 058 accepted as the single follow-up destination |
| T013 | Requirement 1, Requirement 2, Requirement 3, Requirement 4, Requirement 5, Requirement 6, Requirement 7, Requirement 8 | All acceptance criteria | All design sections | Closure reconciliation | G1-G9 | all promoted targets | none |

## Requirement To Delivery Matrix

| Requirement | Priority | Acceptance Criteria | Design Sections | Tasks | Verification | Durable Targets | Coverage State | Residual Destination |
|-------------|----------|---------------------|-----------------|-------|--------------|-----------------|----------------|----------------------|
| Requirement 1 Selected-scope discovery | must-have | AC1-AC5 | Algorithms and Logic; Data Flow | T002, T005, T008, T009, T011 | G2, G5, G7 | `docs/design/edit-and-validation-loop-design.md` | complete | none |
| Requirement 2 Evidence-backed markers | must-have | AC1-AC5 | Components and Changes; Algorithms and Logic; Security, Trust, and Access | T001, T003, T005, T009, T011 | G1, G2, G5 | design doc and runtime contracts if public | complete | none |
| Requirement 3 Per-unit candidates | must-have | AC1-AC5 | Data Models; Data Flow; Migration and Compatibility | T001, T002, T005, T008, T009, T011 | G1, G2, G5 | runtime contracts and validation design | complete | none |
| Requirement 4 Structured blocking | must-have | AC1-AC4 | Data Models; Error Handling | T001, T004, T005, T008, T009, T011 | G1-G3, G5 | runtime contracts and validation design | complete | none |
| Requirement 5 Broken Git metadata | must-have | AC1-AC4 | Error Handling; Data Models | T006, T008, T009, T011 | G3, G5 | validation design and contract docs if public | complete | none |
| Requirement 6 Submodule awareness | must-have | AC1-AC5 | Security, Trust, and Access; Slice Boundary And Residual Architecture | T007-T13 | G4-G9 | backlog follow-up and security docs if needed | complete | none |
| Requirement 7 Mixed-language fixture | must-have | AC1-AC5 | Components and Changes; Validation Strategy | T001, T005, T009, T011 | G2-G5 | dogfood ledger only if real-repo evidence is later accepted | complete | none |
| Requirement 8 Planning-only boundary | must-have | AC1-AC4 | Security, Trust, and Access; Error Handling | T001, T003-T9, T011 | G1-G5, G7 | validation design and security docs if needed | complete | none |

`complete` here means implementation, focused and full validation, independent
review, and durable promotion evidence are recorded in `verification.md`.

## Correctness Property Coverage

| Property | Requirements | Design Sections | Tasks | Tests Or Verification | Residual Risk |
|----------|--------------|-----------------|-------|-----------------------|---------------|
| CP-001 Unit locality | Requirement 1, Requirement 2, Requirement 3 | Algorithms and Logic; Data Flow | T002, T003, T005, T008, T009, T011 | G2, G5 | Aggregators must remain explicit. |
| CP-002 Selection isolation | Requirement 1, Requirement 3, Requirement 7 | Algorithms and Logic | T002, T005, T009, T011 | G2, G5 | Broad no-selection requests remain bounded but less specific. |
| CP-003 Determinism | Requirement 1, Requirement 7 | Algorithms and Logic | T002, T005, T009, T011 | G2, G5 | Test permutations must cover catalog and marker ordering. |
| CP-004 Non-execution | Requirement 2, Requirement 4, Requirement 6, Requirement 7, Requirement 8 | Security, Trust, and Access | T001, T003-T5, T007-T9, T011 | G1, G2, G4, G5, G7 | Planned command objects remain data. |
| CP-005 Claim separation | Requirement 5 | Data Models; Error Handling | T006, T008, T009, T011 | G3, G5 | Public wording must not imply cleanliness. |
| CP-006 Boundary confinement | Requirement 6, Requirement 8 | Security, Trust, and Access | T007-T9, T011 | G4, G5 | Full submodule behavior remains routed. |

## Design To Implementation Matrix

| Design Section | Requirements | Tasks | Interfaces Or Files | Verification | Coverage State | Residual Destination |
|----------------|--------------|-------|---------------------|--------------|----------------|----------------------|
| System Architecture | Requirement 1, Requirement 2, Requirement 3, Requirement 4, Requirement 5, Requirement 6, Requirement 7, Requirement 8 | T002-T9 | discovery, planner, presenter | G2-G5 | complete | none |
| Components and Changes | Requirement 1, Requirement 2, Requirement 3, Requirement 4, Requirement 5, Requirement 6, Requirement 7, Requirement 8 | T001-T9 | files listed in design | G1-G5 | complete | none |
| Data Models | Requirement 3, Requirement 4, Requirement 5, Requirement 6 | T001, T004, T006-T8 | contract and internal unit types | G1, G3-G5 | complete | none |
| Data Flow | Requirement 1, Requirement 3, Requirement 4, Requirement 8 | T002-T5, T008-T9 | discovery and planner use cases | G2, G5 | complete | none |
| Algorithms and Logic | Requirement 1, Requirement 2, Requirement 3 | T002, T003, T008, T009 | pure discovery/selection helpers | G2, G5 | complete | none |
| Error Handling | Requirement 2, Requirement 4, Requirement 5, Requirement 6, Requirement 8 | T003, T004, T006-T9 | blockers, risks, status | G2-G5 | complete | none |
| Security, Trust, and Access | Requirement 2, Requirement 5, Requirement 6, Requirement 8 | T003, T006-T9 | boundary parser, safe ports, tests | G3-G5 | complete | none |
| Migration and Compatibility | Requirement 3, Requirement 4 | T001, T008, T009 | public schema/presenter | G1, G5 | complete | none |
| Residual Architecture | Requirement 6 | T007, T012, T013 | backlog route and closure record | G4, G8, G9 | complete | none |

## Open Decision Impact

| Decision ID | Blocks | Affected Requirements | Affected Tasks | Resolution Needed |
|-------------|--------|-----------------------|----------------|-------------------|
| D001 | resolved | Requirement 3, Requirement 4 | T001, T008 | Optional bounded `project_units` under contract `0.1`; flat `planned_commands` remains compatible. |
| D002 | resolved | Requirement 5, Requirement 8 | T006, T008 | Bounded workspace reads inspect local Git metadata; no process or Git CLI port was added. |
| D003 | resolved | Requirement 6 | T012, T013 | Existing Spec 058 is the single durable full-submodule destination. |

## Maintenance Notes

- Update coverage states only from implementation and validation evidence, not
  from task intent.
- If a public field or blocker vocabulary changes, update requirements, design,
  tasks, contract tests, runtime contract docs, and this matrix together.
- Full submodule traversal cannot be absorbed into T007 or marked complete by
  boundary detection; it requires D003 routing.
- No green test result can substitute for CP-004 port-spy evidence that target
  operations were not called.
- This matrix was reconciled after the independent spec review and the split of
  implementation review, full validation, promotion, and closure into
  T010-T013.
