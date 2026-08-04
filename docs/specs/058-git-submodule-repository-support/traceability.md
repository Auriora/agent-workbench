---
title: Git submodule repository support traceability
doc_type: spec
artifact_type: traceability
status: draft
owner: platform
last_reviewed: 2026-08-04
---

# Traceability Matrix

## Purpose

Map every requirement and correctness property to design, implementation,
verification, and durable promotion. `complete` below means the specification
package covers the requirement; implementation evidence remains pending.

## Task To Context Matrix

| Task ID | Requirements | Acceptance Criteria | Design Sections | Change Impact | Verification | Durable Targets | Open Decisions |
|---------|--------------|---------------------|-----------------|---------------|--------------|-----------------|----------------|
| T001 | Requirement 2, Requirement 4, Requirement 6, Requirement 7 | Requirement 2 AC2; Requirement 2 AC3; Requirement 2 AC4; Requirement 4 AC1; Requirement 4 AC2; Requirement 4 AC3; Requirement 4 AC4; Requirement 4 AC5; Requirement 6 AC1; Requirement 6 AC2; Requirement 6 AC3; Requirement 6 AC5; Requirement 7 AC1; Requirement 7 AC2; Requirement 7 AC3 | Data Models; Shared Command Runner Hardening; Migration and Compatibility | Contract and command-seam delta | G1 | runtime contracts; layered architecture; threat model | D001 |
| T002 | Requirement 2, Requirement 6, Requirement 7 | Requirement 2 AC1; Requirement 2 AC2; Requirement 2 AC3; Requirement 2 AC4; Requirement 6 AC1; Requirement 6 AC2; Requirement 6 AC3; Requirement 6 AC4; Requirement 6 AC5; Requirement 7 AC1; Requirement 7 AC2; Requirement 7 AC3; Requirement 7 AC4 | Git Evidence Operation Set; Error Handling; Security, Trust, and Access | Fixed Git adapter delta | G2 | layered architecture; threat model | none |
| T003 | Requirement 1, Requirement 2, Requirement 7, Requirement 8 | Requirement 1 AC2; Requirement 1 AC3; Requirement 2 AC1-AC5; Requirement 7 AC1-AC4; Requirement 8 AC1; Requirement 8 AC2 | Authority Model; Data Models; Discovery Algorithm | State and fixture delta | G3 | workspace safety; runtime contracts | none |
| T004 | Requirement 1, Requirement 3, Requirement 7 | Requirement 1 AC1-AC4; Requirement 3 AC1; Requirement 3 AC2; Requirement 3 AC3; Requirement 3 AC4; Requirement 3 AC5; Requirement 7 AC1-AC4 | Authority Model; Discovery Algorithm; Security, Trust, and Access | Recursive composition delta | G3 | workspace safety; layered architecture | none |
| T005 | Requirement 1, Requirement 2, Requirement 3, Requirement 6, Requirement 7, Requirement 8 | Requirement 1 AC1-AC4; Requirement 2 AC1-AC5; Requirement 3 AC1-AC5; Requirement 6 AC1-AC5; Requirement 7 AC1-AC4; Requirement 8 AC1; Requirement 8 AC2; Requirement 8 AC4 | Correctness Property Coverage; Validation Strategy | Foundation checkpoint | G1-G3 | none | none |
| T006 | Requirement 1, Requirement 7, Requirement 8 | Requirement 1 AC1; Requirement 1 AC2; Requirement 1 AC3; Requirement 1 AC4; Requirement 7 AC2; Requirement 7 AC4; Requirement 8 AC2; Requirement 8 AC4; Requirement 8 AC5 | Authority Model; Catalog Federation | Workspace policy delta | G4 | workspace safety; threat model | none |
| T007 | Requirement 1, Requirement 3, Requirement 4, Requirement 8 | Requirement 1 AC1-AC4; Requirement 3 AC2-AC5; Requirement 4 AC1; Requirement 4 AC4; Requirement 4 AC5; Requirement 8 AC1-AC5 | Catalog Federation; Repository Provenance Resolution | Scanner federation delta | G4 | workspace safety; runtime contracts | none |
| T008 | Requirement 2, Requirement 4, Requirement 7, Requirement 8 | Requirement 2 AC2-AC4; Requirement 4 AC1; Requirement 4 AC2; Requirement 4 AC3; Requirement 4 AC4; Requirement 4 AC5; Requirement 7 AC1-AC3; Requirement 8 AC3; Requirement 8 AC5 | Storage Model; Snapshot Freshness; Migration and Compatibility | Schema and freshness delta | G5 | graph-store design; runtime contracts | D002 |
| T009 | Requirement 4, Requirement 5, Requirement 7, Requirement 8 | Requirement 4 AC1; Requirement 4 AC4; Requirement 4 AC5; Requirement 5 AC1; Requirement 5 AC2; Requirement 5 AC3; Requirement 5 AC4; Requirement 5 AC5; Requirement 7 AC1; Requirement 7 AC3-AC5; Requirement 8 AC3-AC5 | Validation Planning; Error Handling | Spec 057 T001-T009 verified integration delta | G6 | validation design; runtime contracts; backlog | none |
| T010 | Requirement 2, Requirement 4, Requirement 5, Requirement 7, Requirement 8 | Requirement 2 AC2-AC4; Requirement 4 AC1-AC5; Requirement 5 AC1-AC5; Requirement 7 AC1-AC5; Requirement 8 AC3; Requirement 8 AC5 | Repository Provenance Resolution; Validation Planning; Migration and Compatibility | Public provenance delta | G7 | runtime contracts | none |
| T011 | Requirement 1, Requirement 2, Requirement 3, Requirement 4, Requirement 5, Requirement 6, Requirement 7, Requirement 8 | All acceptance criteria | Validation Strategy; Security, Trust, and Access | Review findings | G8 | none | none |
| T012 | Requirement 1, Requirement 2, Requirement 3, Requirement 4, Requirement 5, Requirement 6, Requirement 7, Requirement 8 | All acceptance criteria | Validation Strategy; Operational Considerations | Full validation | G9 | none | none |
| T013 | Requirement 1, Requirement 2, Requirement 3, Requirement 4, Requirement 5, Requirement 6, Requirement 7, Requirement 8 | Durable promotion criteria | Slice Boundary And Residual Architecture; Operational Considerations | All promotion targets plus active Spec 057 supersession reconciliation | G10 | all promotion targets; Spec 057 package or closure record | none |
| T014 | Requirement 1, Requirement 2, Requirement 3, Requirement 4, Requirement 5, Requirement 6, Requirement 7, Requirement 8 | All acceptance criteria | all design sections | Closure reconciliation | G1-G11 | all promoted targets and lifecycle history | none |

## Requirement To Delivery Matrix

| Requirement | Priority | Acceptance Criteria | Design Sections | Tasks | Verification | Durable Targets | Coverage State | Residual Destination |
|-------------|----------|---------------------|-----------------|-------|--------------|-----------------|----------------|----------------------|
| Requirement 1 | must-have | AC1-AC4 | Authority Model; Catalog Federation | T003-T007, T010-T014 | G3, G4, G7-G11 | workspace safety; threat model | complete | none |
| Requirement 2 | must-have | AC1-AC5 | Data Models; Git Evidence Operation Set; Discovery Algorithm | T001-T005, T008, T010-T014 | G1-G3, G5, G7-G11 | runtime contracts; architecture | complete | none |
| Requirement 3 | must-have | AC1-AC5 | Discovery Algorithm; Catalog Federation | T004, T005, T007, T011-T014 | G3, G4, G8-G11 | workspace safety; architecture | complete | none |
| Requirement 4 | must-have | AC1-AC5 | Storage Model; Repository Provenance Resolution; Snapshot Freshness | T001, T007-T014 | G1, G4-G11 | graph-store design; runtime contracts | complete | none |
| Requirement 5 | must-have | AC1-AC5 | Validation Planning | T009-T014 | G6-G11 | validation design; runtime contracts | complete | none |
| Requirement 6 | must-have | AC1-AC5 | Git Evidence Operation Set; Shared Command Runner Hardening; Security, Trust, and Access | T001, T002, T005, T011-T014 | G1-G3, G8-G11 | architecture; threat model | complete | none |
| Requirement 7 | must-have | AC1-AC5 | Data Models; Error Handling | T001-T005, T006, T008-T014 | G1-G11 | runtime contracts; workspace safety | complete | none |
| Requirement 8 | must-have | AC1-AC5 | Validation Strategy | T003-T014 | G3-G11 | all promotion targets | complete | none |

## Design To Implementation Matrix

| Design target | Implementation tasks | Verification | Residual |
|---------------|----------------------|--------------|----------|
| Authority and composition discovery | T003-T006 | G3, G4 | unrelated nested repositories stay refused |
| One bounded Git evidence path | T001, T002 | G1, G2 | remote/mutating Git unavailable |
| Catalog federation | T006, T007 | G4 | writes unavailable |
| Storage and freshness | T008 | G5 | old snapshots cannot prove composition completeness |
| Repository-local validation planning | T009 | G6 | target commands remain unexecuted |
| Public repository provenance | T010 | G7 | additive compatibility only |
| Review, regression, promotion, closure | T011-T014 | G8-G11 | release is separately authorized |

## Open Decision Impact

| Decision | Owner task | Constrained outcomes | Blocking now? |
|----------|------------|----------------------|---------------|
| D001 exact additive contract and shared runner evolution | T001 | one hardened shared runner; no fallback | no, resolved before coding |
| D002 schema version and migration name | T008 | normalized repository-unit table and composition fingerprint | no, implementation detail |

## Correctness Property Matrix

| Property | Design proof obligation | Tasks | Verification |
|----------|-------------------------|-------|--------------|
| CP-001 Declared-scope admission | Reconciled evidence and policy exception | T003-T007, T011 | G3, G4, G8 |
| CP-002 Repository isolation | Lineage keys and longest-prefix provenance | T001, T008-T011 | G1, G5-G8 |
| CP-003 Recursive determinism | Stable ordering and shared consumption budget | T003-T005, T008, T011 | G3, G5, G8 |
| CP-004 Bound confinement | Canonical path/Git-dir checks and cycle guard | T002-T007, T011 | G2-G4, G8 |
| CP-005 Non-mutation/no-network | Fixed Git operations and port spies | T001-T007, T011-T012 | G1-G4, G8-G9 |
| CP-006 Claim truthfulness | Per-claim all-requested-repositories reduction | T008-T011 | G5-G8 |
| CP-007 Selection isolation | Repository-local views and sibling metamorphic test | T004, T007, T009-T011 | G3, G4, G6-G8 |

## Scope Reconciliation

| Scope | Coverage before implementation | Destination | Blocks closure? |
|-------|--------------------------------|-------------|-----------------|
| Declared initialized submodule reads without prompts | not-covered | T001-T010 | yes |
| Recursive bounds, cycles, and state handling | not-covered | T002-T008 | yes |
| Repository-qualified graph/docs/context/status | not-covered | T008/T010 | yes |
| Repository-local Spec 057 planning | not-covered | T009/T010 after Spec 057 T001-T009 complete and verified | yes |
| Durable authority and contract promotion | not-covered | T013 | yes |
| Submodule initialization/update/remote comparison | out-of-scope | intentionally rejected | no |
| Writes and target command execution | out-of-scope | intentionally rejected | no |
| Git worktrees, subtrees, vendor copies, arbitrary multi-repo workspaces | out-of-scope | future evidence-gated specs | no |

## Related Artifacts

- Requirements: `requirements.md`
- Canonical Context: `canonical-context.md`
- Design: `design.md`
- Change Impact: `change-impact.md`
- Tasks: `tasks.md`
- Verification: `verification.md`
