---
title: Agent Workbench adoption flow traceability
doc_type: spec
artifact_type: traceability
status: draft
owner: platform
last_reviewed: 2026-07-12
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Traceability Matrix

## Task To Context Matrix

| Task ID | Requirements | Acceptance Criteria | Design Sections | Change Impact | Verification | Durable Targets | Open Decisions |
| --- | --- | --- | --- | --- | --- | --- | --- |
| T001 | Requirement 2 | AC1-AC5 | Orientation Entry Path | none | Baseline, receipt, invalidation, trust, and budget fixtures | MCP surface design; runtime contracts | D001 resolved |
| T002 | Requirements 3-4 | R3 AC1-AC5; R4 AC1-AC4 | Context Continuation; Navigation Flow | none | Adjudicated usefulness, no-noise, decision, and budget fixtures | MCP surface; language adapter design | D002 resolved |
| T003 | Requirements 2-4 | R2 AC1-AC5; R3 AC1-AC5; R4 AC1-AC4 | Orientation, Context Continuation, Navigation | none | Contract, golden, degraded, budget tests | MCP surface; runtime contracts | D001-D002 resolved |
| T003.1 | Requirements 2-4 | Contract-relevant criteria | Orientation, Context Continuation, Navigation | none | Failing contract and golden fixtures | none | D001-D002 resolved |
| T003.2 | Requirements 2-4 | Implementation-relevant criteria | Orientation, Context Continuation, Navigation | none | Focused implementation tests | MCP surface; runtime contracts | D001-D002 resolved |
| T003.3 | Requirements 2-4 | R2 AC1-AC5; R3 AC3-AC5; R4 AC3-AC4 | Error Handling And Trust | none | Budget, degraded, blocked, unsupported fixtures | runtime contracts | none |
| T003.4 | Requirements 2-4 | All | Correctness Property Coverage | none | CP-001, CP-002, and CP-005 tests | none | none |
| T004 | Requirement 1 | AC1-AC4 | Claude Activation | none | Claude and cross-client plugin fixtures | Coding-agent integration design | none |
| T005 | Requirement 5 | AC1-AC6 | Intent-Aware Validation | none | Intent, deduplication, and trust fixtures | Edit/validation loop; integration design | none |
| T006 | Requirements 1-5 | All | Validation Strategy | none | All quality gates | none | none |
| T007 | Requirements 1-5 | All | Slice Boundary | none | Promotion and closure checks | All named durable owners; backlog/history | none |

## Requirement To Delivery Matrix

| Requirement | Priority | Tasks | Properties | Coverage state | Residual destination |
| --- | --- | --- | --- | --- | --- |
| Requirement 1: Executable Claude Activation | must-have | T004, T006, T007 | CP-004, CP-005 | not-covered | EB041 / Spec 038 |
| Requirement 2: Snapshot-Aware Orientation | must-have | T001, T003, T006, T007 | CP-001, CP-002, CP-005 | not-covered | EB048 / Spec 038 |
| Requirement 3: Executable Task Continuation | must-have | T002, T003, T006, T007 | CP-002, CP-005 | not-covered | EB049 / Spec 038 |
| Requirement 4: Bounded Navigation Flow | should-have | T002, T003, T006, T007 | CP-002, CP-005 | not-covered | EB049 / Spec 038 |
| Requirement 5: Intent-Aware Validation Guidance | must-have | T005, T006, T007 | CP-003, CP-005 | not-covered | EB050 / Spec 038 |

## Correctness Property Coverage

| Property | Requirements | Tasks | Planned evidence | Residual risk |
| --- | --- | --- | --- | --- |
| CP-001 | R2 | T001, T003, T006 | Snapshot determinism fixtures | Pending. |
| CP-002 | R2-R4 | T001-T003, T006 | Capability/schema golden tests | Pending. |
| CP-003 | R5 | T005, T006 | Validation trust golden tests | Pending. |
| CP-004 | R1 | T004, T006 | Architecture and plugin validation | Pending. |
| CP-005 | R1-R5 | T001, T002, T004-T006 | Controlled decision-quality, action, round-trip, byte, and latency comparison | Pending. |

## Open Decision Impact

| Decision | Blocks | Requirements | Tasks | Resolution needed |
| --- | --- | --- | --- | --- |
| D001 Orientation contract | resolved | R2 | T001, T003 | Compact additive receipt; detailed resources unchanged. |
| D002 Navigation interface | resolved | R4 | T002, T003 | Progressive existing tools; no combined tool in this slice. |

## Design To Implementation Matrix

| Design section | Requirements | Tasks | Interfaces or files | Verification | Coverage state |
| --- | --- | --- | --- | --- | --- |
| Claude Activation | R1 | T004 | Claude plugin skill, hook, docs, integration tests | Plugin validation | not-covered |
| Orientation Entry Path | R2 | T001, T003 | Orientation use case, contracts, MCP resource/presenter | Contract and budget tests | not-covered |
| Context Continuation | R3 | T003 | Task-context use case and presenter | Golden/schema tests | not-covered |
| Navigation Flow | R4 | T002, T003 | Existing graph query tools and selective continuations | Query, decision, and budget tests | not-covered |
| Intent-Aware Validation | R5 | T005 | Task-context and verification policy/presentation | Intent/trust fixtures | not-covered |

## Maintenance Notes

- Update coverage state from `not-covered` only when task evidence exists.
- Every partial or out-of-scope result requires one durable destination.
