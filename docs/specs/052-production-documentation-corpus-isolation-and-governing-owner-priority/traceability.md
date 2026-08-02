---
title: Production documentation corpus isolation and governing-owner priority traceability
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
| T001 | Requirement 1, Requirement 2, Requirement 3, Requirement 4, Requirement 5, Requirement 6 | all readiness | all | G1 | none | none |
| T002 | Requirement 2, Requirement 4 | Requirement 2 AC1-AC6; Requirement 4 AC1-AC4 | Data models; policy versions and migration | G2 | graph-store design; runtime contracts | schema seam confirmation, non-blocking |
| T003 | Requirement 1 | AC1-AC6 | Corpus classification | G3 | documentation map; MCP surface design | none |
| T004 | Requirement 1, Requirement 2, Requirement 5 | Requirement 1 all; Requirement 2 AC2-AC6; Requirement 5 AC1-AC2, AC4 | Components; data flow; count semantics | G3, G4 | MCP surface design; runtime contracts | none |
| T005 | Requirement 2, Requirement 4 | Requirement 2 all; Requirement 4 AC2-AC3 | Data models; error handling; migration | G4, G6 | graph-store design; runtime contracts | none after T002 |
| T006 | Requirement 3, Requirement 4 | Requirement 3 all; Requirement 4 AC1-AC4 | Ranking algorithm; migration | G5, G6 | MCP surface design; graph-store design; runtime contracts | none |
| T007 | Requirement 5 | all | Validation strategy | G3-G6 | MVP proof matrix | none |
| T008 | Requirement 1, Requirement 2, Requirement 3, Requirement 4, Requirement 5 | all | Validation and operations | G7, G8 | dogfood ledger | none |
| T009 | Requirement 6 | all | Promotion map and slice boundary | G9, G10 | all promotion targets | none |

## Requirement To Delivery Matrix

| Requirement | Priority | Acceptance criteria | Design sections | Tasks | Verification | Durable targets | Coverage state | Residual destination |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Requirement 1 | must-have | AC1-AC6 | Corpus classification; components | T003, T004, T007 | G3 | documentation map; MCP surface design | not-covered | none; blocks implementation completion |
| Requirement 2 | must-have | AC1-AC6 | Count semantics; data models; error handling | T002, T004, T005, T007 | G4 | graph-store design; runtime contracts | not-covered | none; blocks implementation completion |
| Requirement 3 | must-have | AC1-AC6 | Ranking algorithm | T006, T007 | G5 | MCP surface design; runtime contracts | not-covered | none; blocks implementation completion |
| Requirement 4 | must-have | AC1-AC4 | Policy versions and migration | T002, T005, T006, T007 | G6 | graph-store design; runtime contracts | not-covered | none; blocks implementation completion |
| Requirement 5 | must-have | AC1-AC4 | Validation strategy | T004, T007, T008 | G3-G8 | MVP proof matrix; dogfood ledger | not-covered | none; blocks implementation completion |
| Requirement 6 | must-have | AC1-AC3 | Slice boundary; promotion map | T009 | G9, G10 | backlog and all promoted docs | not-covered | none; blocks closure |

## Correctness Property Coverage

| Property | Requirements | Design sections | Tasks | Tests or verification | Residual risk |
| --- | --- | --- | --- | --- | --- |
| CP-001 | Requirement 1, Requirement 5 | Corpus classification | T003, T004, T007 | G3 root-shape tests | broader fixture conventions remain gated |
| CP-002 | Requirement 1 | Components and changes | T003, T004 | G3 parity test | none expected |
| CP-003 | Requirement 2 | Count semantics | T004, T005, T007 | G4 count contracts | none expected |
| CP-004 | Requirement 3 | Ranking algorithm | T006, T007 | G5 candidate permutations | exact concern only |
| CP-005 | Requirement 3, Requirement 4 | Ranking and migration | T006, T007 | G5/G6 deterministic pagination | none expected |
| CP-006 | Requirement 2, Requirement 4 | Error handling; migration | T005, T007 | G4/G6 stale-policy blocker | refresh required operationally |
| CP-007 | Requirement 1, Requirement 3, Requirement 5 | Corpus and ranking exclusion | T003, T004, T006, T007 | G3/G5 excluded-owner tests | additive public state |

## Design To Implementation Matrix

| Design section | Requirements | Tasks | Interfaces or files | Verification | Coverage state | Residual destination |
| --- | --- | --- | --- | --- | --- | --- |
| Corpus classification | Requirement 1 | T003, T004 | domain policy and two use cases | G3 | not-covered | none |
| Count semantics and policy identity | Requirement 2 | T002, T005 | contracts, ports, store, query | G4 | not-covered | none |
| Ranking algorithm | Requirement 3 | T006 | ranking policy and query docs | G5 | not-covered | none |
| Policy versions and migration | Requirement 4 | T002, T005, T006 | contracts and graph store | G6 | not-covered | none |
| Cross-surface proof | Requirement 5 | T007, T008 | fixtures, unit/integration/MCP tests | G3-G8 | not-covered | none |
| Promotion and residual boundary | Requirement 6 | T009 | durable docs/backlog/history | G9, G10 | not-covered | EB059 and EB065 |

## Open Decision Impact

No product decision blocks implementation. T002 must select the smallest
schema-aligned persistence form while preserving the requirements and design
invariants; a material departure requires package reconciliation and review.

## Maintenance Notes

- Update coverage states only with concrete evidence.
- Keep requirement and property mappings synchronized if tasks are split.
- `not-covered` is truthful at creation and blocks implementation/closure until
  evidence is recorded.
