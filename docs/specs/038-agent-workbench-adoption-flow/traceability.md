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
| T001.1 | Requirement 2 | AC2-AC4 | Orientation Entry Path; Error Handling And Trust | none | Material watcher-state reuse fixtures | MCP surface design; runtime contracts | none |
| T002 | Requirements 3-4 | R3 AC1-AC5; R4 AC1-AC4 | Context Continuation; Navigation Flow | none | Adjudicated usefulness, no-noise, decision, and budget fixtures | MCP surface; language adapter design | D002 resolved |
| T002.1 | Requirements 3-5 | R3 AC1-AC3; R4 AC1; R5 AC4-AC5 | Context Continuation; Navigation Flow; Intent-Aware Validation | none | Exposed-schema and negative action-selection fixtures | none | none |
| T002.2 | Requirements 1-5 | SC-003-SC-005 | Validation Strategy | none | Comparative action, decision, round-trip, and byte fixtures | none | none |
| T003 | Requirements 2-4 | R2 AC1-AC5; R3 AC1-AC5; R4 AC1-AC4 | Orientation, Context Continuation, Navigation | none | Contract, golden, degraded, budget tests | MCP surface; runtime contracts | D001-D002 resolved |
| T003.1 | Requirements 2-4 | Contract-relevant criteria | Orientation, Context Continuation, Navigation | none | Failing contract and golden fixtures | none | D001-D002 resolved |
| T003.2 | Requirements 2-4 | Implementation-relevant criteria | Orientation, Context Continuation, Navigation | none | Focused implementation tests | MCP surface; runtime contracts | D001-D002 resolved |
| T003.3 | Requirements 2-4 | R2 AC1-AC5; R3 AC3-AC5; R4 AC3-AC4 | Error Handling And Trust | none | Budget, degraded, blocked, unsupported fixtures | runtime contracts | none |
| T003.4 | Requirements 2-4 | All | Correctness Property Coverage | none | CP-001, CP-002, and CP-005 tests | none | none |
| T003.5 | Requirement 3 | AC1-AC2 | Context Continuation | none | Registered normal-client schema parsing | MCP surface; runtime contracts | none |
| T003.6 | Requirements 3-5 | R3 AC1-AC3; R4 AC1; R5 AC1 | Context Continuation; Navigation Flow; Intent-Aware Validation | none | Relevance and action-priority collision fixtures | MCP surface; edit/validation loop | none |
| T004 | Requirement 1 | AC1-AC4 | Claude Activation | none | Claude and cross-client plugin fixtures | Coding-agent integration design | none |
| T005 | Requirement 5 | AC1-AC6 | Intent-Aware Validation | none | Intent, deduplication, and trust fixtures | Edit/validation loop; integration design | none |
| T005.1 | Requirement 5 | AC4-AC5 | Intent-Aware Validation | none | Unknown, conflicting, and negated intent fixtures | Edit/validation loop | none |
| T005.2 | Requirement 5 | AC1 | Intent-Aware Validation | none | Four-candidate explicit edit/closure fixture | Edit/validation loop | none |
| T005.3 | Requirements 3 and 5 | R3 AC5; R5 AC6 | Context Continuation; Intent-Aware Validation | none | Contract decision plus repeat-call fixture | Runtime contracts; MCP surface | Platform decision required |
| T006 | Requirements 1-5 | All | Validation Strategy | none | All quality gates | none | none |
| T007 | Requirements 1-5 | All | Slice Boundary | none | Promotion and closure checks | All named durable owners; backlog/history | none |

## Requirement To Delivery Matrix

| Requirement | Priority | Tasks | Properties | Coverage State | Residual Destination |
| --- | --- | --- | --- | --- | --- |
| Requirement 1 | must-have | T004, T006, T007 | CP-004, CP-005 | covered | none |
| Requirement 2 | must-have | T001, T003, T006, T007 | CP-001, CP-002, CP-005 | covered | none |
| Requirement 3 | must-have | T002, T003, T006, T007 | CP-002, CP-005 | covered | none |
| Requirement 4 | should-have | T002, T003, T006, T007 | CP-002, CP-005 | covered | EB049 retains future combined-navigation proposals only. |
| Requirement 5 | must-have | T005, T006, T007 | CP-003, CP-005 | covered | none |

## Correctness Property Coverage

| Property | Requirements | Tasks | Planned evidence | Residual risk |
| --- | --- | --- | --- | --- |
| CP-001 | R2 | T001, T003, T006 | Snapshot determinism fixtures | Passed. |
| CP-002 | R2-R4 | T001-T003, T006 | Capability/schema golden tests | Passed. |
| CP-003 | R5 | T005, T006 | Validation trust golden tests | Passed. |
| CP-004 | R1 | T004, T006 | Architecture and plugin validation | Passed. |
| CP-005 | R1-R5 | T001, T002, T004-T006 | Controlled decision-quality, action, round-trip, byte, and latency comparison | Passed with accepted <=512-byte action-explanation cost and fewer irrelevant/repeated actions. |

## Open Decision Impact

| Decision | Blocks | Requirements | Tasks | Resolution needed |
| --- | --- | --- | --- | --- |
| D001 Orientation contract | resolved | R2 | T001, T003 | Compact additive receipt; detailed resources unchanged. |
| D002 Navigation interface | resolved | R4 | T002, T003 | Progressive existing tools; no combined tool in this slice. |

## Design To Implementation Matrix

| Design section | Requirements | Tasks | Interfaces or files | Verification | Coverage state |
| --- | --- | --- | --- | --- | --- |
| Claude Activation | R1 | T004 | Claude plugin skill, hook, docs, integration tests | Plugin validation | covered |
| Orientation Entry Path | R2 | T001, T003 | Orientation use case, contracts, MCP resource/presenter | Contract and budget tests | covered |
| Context Continuation | R3 | T003 | Task-context use case and presenter | Golden/schema tests | covered |
| Navigation Flow | R4 | T002, T003 | Existing graph query tools and selective continuations | Query, decision, and budget tests | covered |
| Intent-Aware Validation | R5 | T005 | Task-context and verification policy/presentation | Intent/trust fixtures | covered |

## Maintenance Notes

- Update coverage state from `not-covered` only when task evidence exists.
- Every partial or out-of-scope result requires one durable destination.
