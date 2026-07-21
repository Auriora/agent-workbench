---
title: Reference completeness traceability
doc_type: spec
artifact_type: traceability
status: draft
owner: platform
last_reviewed: 2026-07-20
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Traceability

## Requirement To Delivery Matrix

| Requirement | Priority | Acceptance Criteria | Design Sections | Tasks | Verification | Durable Targets | Coverage State | Residual Destination |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Requirement 1 | must-have | AC1.1, AC1.2, AC1.3, AC1.4, AC1.5, AC1.6, AC1.7, AC1.8 | Graph-First Selection; Declared Lexical Evidence Universe; Coverage Receipt | T001-T008, T010-T013 | V001-V005, V007, V013-V018 | MCP surface design; runtime contracts | contract-covered | runtime implementation remains in active Spec 042 |
| Requirement 2 | must-have | AC2.1, AC2.2, AC2.3, AC2.4, AC2.5, AC2.6, AC2.7, AC2.8 | Cursor Authentication And Lexical Scan State; File-Atomic Admission And Accounting; Lexical Page Algorithm | T001, T004-T008, T010-T013 | V001-V003, V005-V008, V013-V018 | graph store design; runtime contracts | contract-covered | route pagination remains in active Spec 042 |
| Requirement 3 | must-have | AC3.1, AC3.2, AC3.3, AC3.4, AC3.5, AC3.6, AC3.7 | Coverage Receipt; Contract Boundary; File-Atomic Admission And Accounting | T001, T003-T008, T010-T013 | V001-V004, V006-V008, V013-V018 | runtime contracts | contract-covered | presentation/accounting implementation remains in active Spec 042 |
| Requirement 4 | must-have | AC4.1, AC4.2, AC4.3, AC4.4, AC4.5, AC4.6, AC4.7, AC4.8, AC4.9 | Declared Lexical Evidence Universe; Lexical Output Unit; Validation Strategy | T002-T013 | V002, V005-V015, V017-V018 | language adapter design; MVP proof matrix; EB053; dogfood ledger | fixture-characterized | continuation/parser proof remains in active Spec 042 |

## Correctness Property Mapping

| Property | Design Sections | Tasks | Verification | Coverage |
| --- | --- | --- | --- | --- |
| CP-001 | Graph-First Selection; Coverage Receipt | T001, T003-T004, T006-T008 | V001-V005 | planned |
| CP-002 | Cursor Authentication And Lexical Scan State; Lexical Page Algorithm | T001, T004-T005, T008 | V002, V005-V006 | planned |
| CP-003 | Coverage Receipt; Contract Boundary | T001, T004, T006-T008 | V001, V003-V004 | planned |
| CP-004 | File-Atomic Admission And Accounting; Lexical Page Algorithm | T001, T004-T005, T008 | V002, V006, V008 | planned |
| CP-005 | Graph-First Selection; Security And Trust | T001, T003-T004, T006-T008 | V001-V004 | planned |
| CP-006 | Lexical Output Unit; Lexical Page Algorithm | T001-T002, T004-T005, T008 | V001-V002, V005-V006 | planned |
| CP-007 | Cursor Authentication And Lexical Scan State; Lexical Page Algorithm | T001, T005, T008 | V006 | planned |
| CP-008 | Cursor Authentication And Lexical Scan State; Failure Behavior | T001, T005-T008 | V001, V006 | planned |
| CP-009 | Declared Lexical Evidence Universe; Coverage Receipt | T001-T004, T006-T008 | V001-V005 | planned |
| CP-010 | Graph-First Selection; Cursor Authentication And Lexical Scan State | T001, T003, T005-T008 | V001-V003, V006 | planned |
| CP-011 | Declared Lexical Evidence Universe; Lexical Page Algorithm; Coverage Receipt | T001-T002, T004-T008 | V001-V003, V005-V006, V008 | planned |

## Task To Context Matrix

| Task ID | Requirements | Acceptance Criteria | Design Sections | Verification | Durable Targets |
| --- | --- | --- | --- | --- | --- |
| T001 | Requirement 1, Requirement 2, Requirement 3 | AC1.1, AC1.2, AC1.3, AC1.4, AC1.5, AC1.6, AC1.7, AC1.8, AC2.1, AC2.2, AC2.3, AC2.4, AC2.5, AC2.6, AC2.7, AC2.8, AC3.1, AC3.2, AC3.3, AC3.4, AC3.5, AC3.6, AC3.7 | Contract Boundary; Coverage Receipt; Cursor Authentication And Lexical Scan State | V001 | runtime contracts; language adapter design |
| T002 | Requirement 4 | AC4.1, AC4.2, AC4.3, AC4.4, AC4.5, AC4.6, AC4.7, AC4.8, AC4.9 | Confirmed Root Cause; Declared Lexical Evidence Universe; Validation Strategy | V002, V005 | EB053; MVP proof matrix |
| T003 | Requirement 1, Requirement 3, Requirement 4 | AC1.1, AC1.2, AC1.3, AC1.4, AC1.7, AC1.8, AC3.1, AC3.2, AC3.3, AC4.8, AC4.9 | Graph-First Selection | V002 | MCP surface design; runtime contracts |
| T004 | Requirement 1, Requirement 2, Requirement 3, Requirement 4 | AC1.5, AC1.6, AC2.1, AC2.2, AC2.5, AC2.6, AC2.8, AC3.2, AC3.3, AC3.4, AC3.5, AC3.6, AC3.7, AC4.6, AC4.7 | Declared Lexical Evidence Universe; File-Atomic Admission And Accounting; Lexical Page Algorithm | V002, V005, V008 | graph store design; MCP surface design |
| T005 | Requirement 2, Requirement 3, Requirement 4 | AC2.1, AC2.2, AC2.3, AC2.4, AC2.5, AC2.6, AC2.7, AC2.8, AC3.1, AC3.6, AC3.7, AC4.3, AC4.5, AC4.9 | Cursor Authentication And Lexical Scan State; Lexical Page Algorithm | V006, V008 | graph store design; runtime contracts |
| T006 | Requirement 1, Requirement 2, Requirement 3 | AC1.1, AC1.2, AC1.3, AC1.4, AC1.5, AC1.6, AC1.8, AC3.1, AC3.2, AC3.3, AC3.4, AC3.5, AC3.6, AC3.7 | Coverage Receipt; Contract Boundary | V003 | runtime contracts; MCP surface design |
| T007 | Requirement 1, Requirement 3 | AC1.1, AC1.2, AC1.3, AC1.4, AC1.5, AC1.6, AC1.7, AC1.8, AC3.1, AC3.2, AC3.3, AC3.4, AC3.5, AC3.6, AC3.7 | Security And Trust; Failure Behavior | V003-V004 | runtime contracts; MCP surface design |
| T008 | Requirement 1, Requirement 2, Requirement 3, Requirement 4 | all | Validation Strategy | V001-V006, V008 | verification record |
| T009 | Requirement 4 | AC4.1, AC4.2, AC4.3, AC4.4 | Operational Considerations; Validation Strategy | V010-V012 | plugin runbook; MVP proof matrix |
| T010 | Requirement 1, Requirement 2, Requirement 3, Requirement 4 | all | Validation Strategy | V007, V009-V012 | verification record |
| T011 | Requirement 1, Requirement 2, Requirement 3, Requirement 4 | all | Requirement Coverage; Security And Trust | V013-V015 | review disposition |
| T012 | Requirement 1, Requirement 2, Requirement 3, Requirement 4 | all | Durable Promotion Targets | V016 | all promotion targets |
| T013 | Requirement 1, Requirement 2, Requirement 3, Requirement 4 | all | Durable Promotion Targets | V017-V018 | closure log; archive index |

## Design To Implementation Matrix

| Design section | Planned implementation | Task | Verification |
| --- | --- | --- | --- |
| Graph-First Selection | preserve existing graph branch in `find-references.ts` | T003 | V002-V005 |
| Declared Lexical Evidence Universe | policy classifier and searchable-candidate state | T001-T002, T004 | V001-V002, V005 |
| Cursor Authentication And Lexical Scan State | authenticated scan/result/composite cursors, daemon key expiry, and ordered catalog continuation | T001, T003, T005 | V001-V003, V006 |
| File-Atomic Admission And Accounting | declared-size admission, whole-file reads, exact receipt counters | T001, T004-T006 | V001-V003, V008 |
| Coverage Receipt | canonical graph/response contracts and presenter | T001, T006 | V001, V003-V004 |
| Lexical Output Unit | occurrence scanner with path/line/column ordering | T002, T004-T005 | V002, V005-V006 |
| Failure Behavior | cursor, read, snapshot, candidate, and budget outcomes | T001-T006 | V001-V006, V008 |
| Security And Trust | response validity, caveats, truncation, and next action | T007 | V003-V004 |
| Operational Considerations | compatibility, package, real provider, and bounded latency gates | T006-T010 | V003-V012 |

## Open Decision Impact

No open product decision blocks implementation. T001 owns additive field names
and cursor schema version only; whole-file atomicity, evidence-universe scope,
and exact accounting semantics are fixed by the requirements and design.

## Review Evidence

The four blockers, sixteen additional authoring findings, and five final-audit
findings are mapped in `review-disposition.md`. Phase 1 adds contract and fixture
coverage only; runtime delivery remains planned until T003-T010 and their
verification gates complete.
