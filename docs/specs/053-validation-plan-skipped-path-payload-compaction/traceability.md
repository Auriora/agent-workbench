---
title: Validation-plan skipped-path payload compaction traceability
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

| Task ID | Requirements | Acceptance Criteria | Design Sections | Change Impact | Verification | Durable Targets | Open Decisions |
| --- | --- | --- | --- | --- | --- | --- | --- |
| T001 | Requirement 1-6 | readiness | all | all | G1 | none | none |
| T002 | Requirement 1, Requirement 2, Requirement 3, Requirement 5 | Requirement 1 AC1-AC6; Requirement 2 AC1-AC5; Requirement 3 AC1, AC4-AC5; Requirement 5 AC2, AC4-AC5 | Data models; migration and compatibility | contracts | G2 | runtime contracts | none |
| T003 | Requirement 1, Requirement 2, Requirement 3 | Requirement 1 AC1-AC5; Requirement 2 AC1-AC4; Requirement 3 AC1-AC3, AC5 | algorithms; interfaces | summary policy | G3 | MCP surface design | none |
| T004 | Requirement 1, Requirement 3, Requirement 4 | Requirement 1 AC1-AC5; Requirement 3 AC1-AC5; Requirement 4 AC1, AC3-AC4 | scanner component; data flow | scanner receipt | G3, G4 | runtime contracts; MCP surface design | none |
| T005 | Requirement 1, Requirement 2, Requirement 3, Requirement 4, Requirement 5 | Requirement 1 AC1, Requirement 1 AC2, Requirement 1 AC3, Requirement 1 AC4, Requirement 1 AC5, Requirement 1 AC6; Requirement 2 AC1, Requirement 2 AC2, Requirement 2 AC3, Requirement 2 AC4, Requirement 2 AC5; Requirement 3 AC1, Requirement 3 AC2, Requirement 3 AC3, Requirement 3 AC4, Requirement 3 AC5; Requirement 4 AC1, Requirement 4 AC2, Requirement 4 AC3, Requirement 4 AC4, Requirement 4 AC5; Requirement 5 AC1, Requirement 5 AC2, Requirement 5 AC3, Requirement 5 AC4, Requirement 5 AC5 | plan projection; compatibility | public validation plan | G4, G5 | runtime contracts; MCP surface design | none |
| T006 | Requirement 2, Requirement 4, Requirement 5 | Requirement 2 AC2-AC5; Requirement 4 AC1-AC5; Requirement 5 AC1-AC5 | context/presenter components; security | cross-surface parity | G5 | MCP surface design | none |
| T007 | Requirement 6 | Requirement 6 AC1, Requirement 6 AC2, Requirement 6 AC3, Requirement 6 AC4 | validation strategy | proof | G3-G6 | proof matrix | none |
| T008 | Requirement 1, Requirement 2, Requirement 3, Requirement 4, Requirement 5, Requirement 6 | Requirement 1 AC1-AC6; Requirement 2 AC1-AC5; Requirement 3 AC1-AC5; Requirement 4 AC1-AC5; Requirement 5 AC1-AC5; Requirement 6 AC1-AC4 | operations; validation | evidence | G7, G8 | dogfood ledger | none |
| T009 | Requirement 6 | Requirement 6 AC5 | promotion and residual boundary | all | G9, G10 | all promotion targets | none |

## Requirement To Delivery Matrix

| Requirement | Priority | Acceptance Criteria | Design Sections | Tasks | Verification | Durable Targets | Coverage State | Residual Destination |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Requirement 1 | must-have | AC1-AC6 | scanner receipt; data model; algorithm | T002-T005, T007 | G2-G4 | runtime contracts; MCP surface design | complete | exact population and conservation tests pass |
| Requirement 2 | must-have | AC1-AC5 | sample policy; security | T002, T003, T005-T007 | G2-G5 | runtime contracts; MCP surface design | complete | deterministic sampling and presenter redaction pass |
| Requirement 3 | must-have | AC1-AC5 | population truth; slice boundary | T002-T005, T007 | G3, G4 | runtime requirements; MCP surface design | complete | scanner retains exact counts beyond raw evidence bound without changing traversal |
| Requirement 4 | must-have | AC1-AC5 | priority paths; blocker preservation | T004-T007 | G4, G5 | runtime contracts; MCP surface design | complete | actionable requested exclusion and runtime-warning tests pass |
| Requirement 5 | must-have | AC1-AC5 | shared policy; compatibility | T002, T005-T007 | G2, G5 | runtime contracts; MCP surface design | complete | contract, context, planner, and presenter parity pass |
| Requirement 6 | must-have | AC1-AC5 | validation; promotion | T007-T009 | G6-G10 | proof matrix; backlog; changelog; ledger | complete | five-gate, full-suite, dogfood, promotion, and final review evidence recorded |

## Correctness Property Coverage

| Property | Requirements | Design Sections | Tasks | Tests Or Verification | Residual Risk |
| --- | --- | --- | --- | --- | --- |
| CP-001 | Requirement 1, 3, 6 | accumulator; scanner receipt | T002-T005, T007 | G3/G4 conservation and over-100 tests | none expected |
| CP-002 | Requirement 2, 6 | fixed sample algorithm | T002, T003, T005-T007 | G3/G5 boundary tests | none expected |
| CP-003 | Requirement 2, 5, 6 | deterministic finalization | T003, T005-T007 | G3/G5 permutations | none expected |
| CP-004 | Requirement 3, 6 | no control-flow influence | T003-T005, T007 | G3/G4 scanner spy and command parity | existing upstream scanner limits remain explicit |
| CP-005 | Requirement 4, 6 | actionable projection | T004-T007 | G4/G5 intersection and conservation | request contract bounds individual evidence |
| CP-006 | Requirement 3, 5, 6 | source versus sample truncation | T002, T004-T007 | G2/G4/G5 truncated scanner doubles | no repository-completeness claim when truncated |

## Design To Implementation Matrix

| Design Section | Requirements | Tasks | Interfaces Or Files | Verification | Coverage State | Residual Destination |
| --- | --- | --- | --- | --- | --- | --- |
| shared population accumulator | Requirement 1-3 | T003 | domain policy; policy tests | G3 | complete | none |
| scanner population receipt | Requirement 1, 3, 4 | T002, T004 | scanner; ports; scanner tests | G3, G4 | complete | none |
| structured validation receipt | Requirement 1-5 | T002, T005 | contracts; planner; contract/MCP tests | G2, G4 | complete | none |
| task-context parity | Requirement 5 | T006 | task context; context tests | G5 | complete | none |
| presenter redaction | Requirement 2, 4 | T006 | presenters; presentation/translation tests | G5 | complete | none |
| generated/vendor acceptance | Requirement 6 | T007, T008 | fixture; MCP/stdio tests | G6-G8 | complete | none |
| promotion and residual boundary | Requirement 6 | T009 | durable docs/backlog/history | G9, G10 | complete | existing traversal/continuation policy remains separately owned |

## Open Decision Impact

No product decision blocks implementation. The design fixes the additive field,
sample limit, population count basis, actionable boundary, and raw-output
retirement for this surface. A material departure requires reconciliation and
review before implementation continues.

## Maintenance Notes

- T001 review reconciled required scanner-result producers/doubles, the
  planner/presenter task boundary, all-reason task-context parity, the 50-path
  actionable detail bound, the canonical policy-test path, and exact-count
  memory evidence across requirements, design, tasks, and verification; all
  revised downstream artifacts were reviewed before T001 completion.
- T002-T008 implementation and validation completed the exact population,
  public compaction, context parity, redaction, five-gate, full-suite, and
  checkout-source dogfood paths. T009 promoted the accepted behavior and
  retained EB014, EB059, EB061, and unrelated public surfaces separately.
- Update coverage states only with concrete implementation and validation
  evidence.
- Preserve the distinction between scanner-source truncation and presentation
  sample truncation in every mapping.
- Do not mark Requirement 1 or Requirement 3 complete if counts stop at either
  the scanner's raw compatibility bound or the public sample bound.

## Related Artifacts

- Requirements: `requirements.md`
- Design: `design.md`
- Tasks: `tasks.md`
- Change impact: `change-impact.md`
- Verification: `verification.md`
