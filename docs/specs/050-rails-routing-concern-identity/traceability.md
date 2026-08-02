---
title: Rails routing concern identity traceability
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
| T001 | Requirement 1, Requirement 2, Requirement 3, Requirement 4, Requirement 5 | All | Overview; requirement coverage; slice boundary | Design MoE gate | none | none |
| T002 | Requirement 1, Requirement 2, Requirement 3, Requirement 5 | Requirement 1 AC1-AC4; Requirement 2 AC1-AC5; Requirement 3 AC1-AC3; Requirement 5 AC1-AC3 | Data model; algorithms; error handling | Focused parser and graph tests | none | none |
| T003 | Requirement 1, Requirement 2, Requirement 3, Requirement 4, Requirement 5 | All implementation ACs | Components; data model; algorithms | Focused parser and graph tests | adapter design | none |
| T004 | Requirement 3, Requirement 4, Requirement 5 | Requirement 3 AC1-AC3; Requirement 4 AC1-AC4; Requirement 5 AC1-AC3 | Provenance; validation strategy | Reference, impact, task-context tests | runtime contracts unchanged | none |
| T005 | SC-003-SC-005 | Success criteria | Validation; operational considerations | Typecheck, full suite, dogfood | design, matrix, changelog, EB010, ledger | none |
| T006 | Requirement 1, Requirement 2, Requirement 3, Requirement 4, Requirement 5, SC-001-SC-005 | All | Complete design | MoE dispositions | all named targets | none |

## Requirement To Delivery Matrix

| Requirement | Priority | Acceptance Criteria | Design Sections | Tasks | Verification | Durable Targets | Coverage State | Residual Destination |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Requirement 1 | must-have | AC1, AC2, AC3, AC4 | Data model; algorithms | T002, T003 | Parser and graph tests | adapter design | complete | none |
| Requirement 2 | must-have | AC1, AC2, AC3, AC4, AC5 | Data model; algorithms | T002, T003 | Parser and graph tests, including ordinary resource-edge preservation with `concerns:` | adapter design, matrix | complete | none |
| Requirement 3 | must-have | AC1, AC2, AC3 | Provenance across reuse and contained routes | T002, T003, T004 | Multi-hop graph test | adapter design | complete | none |
| Requirement 4 | must-have | AC1, AC2, AC3, AC4 | Components; validation strategy | T003, T004 | Reference, impact, task-context tests | changelog | complete | none |
| Requirement 5 | should-have | AC1, AC2, AC3 | Error handling; slice boundary | T002, T003, T004 | Cycle and failure regressions | EB010 | complete | none |

## Correctness Property Coverage

| Property | Requirements | Design sections | Tasks | Tests or verification | Residual risk |
| --- | --- | --- | --- | --- | --- |
| CP-001 | Requirement 1 | Data model | T002, T003 | Repeated extraction and duplicate declarations | none |
| CP-002 | Requirement 2, Requirement 4 | Resolver algorithm | T002-T004 | Unique/missing/ambiguous graph cases | none |
| CP-003 | Requirement 1, Requirement 2, Requirement 3, Requirement 4 | Provenance path | T002-T004 | Metadata and multi-hop traversal | Bounded static scope only |
| CP-004 | Requirement 1, Requirement 2 | Resolver algorithm | T002, T003 | Duplicate ambiguity regression | none |
| CP-005 | Requirement 5 | Error handling | T002-T004 | Nested/cyclic finite edge test | No runtime expansion |
| CP-006 | Requirement 4, Requirement 5 | Components; compatibility | T003-T005 | Code review, typecheck, full suite | none |

## Design To Implementation Matrix

| Design Section | Requirements | Tasks | Interfaces Or Files | Verification | Coverage State | Residual Destination |
| --- | --- | --- | --- | --- | --- | --- |
| Components and changes | Requirement 1, Requirement 2, Requirement 3, Requirement 4, Requirement 5 | T002-T004 | Ruby parser and graph indexer | Focused tests | complete | none |
| Data model | Requirement 1, Requirement 2, Requirement 3 | T002, T003 | Generic graph node/reference models | Identity and metadata tests | complete | none |
| Provenance across reuse | Requirement 3, Requirement 4 | T002-T004 | Existing graph traversal | Multi-hop impact test | complete | none |
| Slice boundary | Requirement 5 | T005, T006 | EB010 and durable docs | Review and promotion | partial-routed | EB010 |

## Open Decision Impact

No open decision blocks implementation. Callable concerns, runtime options, and
route-set expansion remain outside the accepted slice under EB010.

Post-implementation reconciliation on 2026-08-02 reviewed the final requirement
wording against every task, acceptance criterion, correctness property, and
residual destination; no coverage row remains partial-blocking.
