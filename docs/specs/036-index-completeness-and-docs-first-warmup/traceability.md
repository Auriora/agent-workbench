---
title: Index completeness and docs-first warmup traceability
doc_type: spec
artifact_type: traceability
status: draft
owner: platform
last_reviewed: 2026-07-07
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Traceability Matrix

## Purpose

Map requirements, design sections, tasks, verification evidence, durable-doc
targets, and open decisions for Spec 036. Before implementing a task, review
the row for that task ID and the linked requirement/design rows.

## Task To Context Matrix

| Task ID | Requirements | Acceptance Criteria | Design Sections | Change Impact | Verification | Durable Targets | Open Decisions |
| --- | --- | --- | --- | --- | --- | --- | --- |
| T001 | all | package readiness | Overview; Requirement Coverage | all | Quality Gates; Task Evidence | none yet | none |
| T002 | Requirement 5 | AC1 | Validation Strategy; Downstream Task Guidance | Bug Fix Details | `tests/graph/extraction-pipeline.test.ts` | none yet | none |
| T003 | Requirements 1, 2, 4, 5 | R1 AC1; R2 AC1, AC3; R4 AC1, AC3; R5 AC1 | Requirement Coverage; Correctness Property Coverage | Proposed Changes | `tests/graph/extraction-pipeline.test.ts`; `tests/runtime/process-workspace-change-queue.test.ts` | none yet | none |
| T004 | Requirement 2 | AC1, AC2, AC3 | High-Level Design; Algorithms and Logic; Data Flow | Proposed Changes | `tests/graph/extraction-pipeline.test.ts`; docs FTS tests | Graph store design; MCP surface design | D001 |
| T005 | Requirements 1, 3, 4 | R1 AC1-3; R3 AC1, R3 AC3; R4 AC1-2 | Data Models; Function Signatures; Error Handling | Proposed Changes | `pnpm typecheck`; focused Vitest run | Runtime contracts; runtime operations design | D001, D002 |
| T006 | Requirement 4 | AC1, AC2, AC3 | Function Signatures; Error Handling | Proposed Changes | `tests/docs/query-docs.test.ts` | MCP surface design; runtime contracts | D002 |
| T007 | Requirement 3 | AC1, AC2, AC3 | Data Flow; Slice Boundary And Residual Architecture; Operational Considerations | Proposed Changes; Promotion Targets | Scope Reconciliation Before Closure | Runtime operations design; backlog if deferred | D001 |
| T008 | all | validation | Validation Strategy | all | all | none yet | D001, D002 |
| T009 | all | durable promotion | Operational Considerations | Promotion Targets | Durable Promotion And Cleanup | runtime operations, graph store, MCP surface, runtime contracts, changelog/backlog as needed | D001, D002 |
| T010 | all | closure readiness | Slice Boundary And Residual Architecture | Promotion Targets | Scope Reconciliation; Spec Cleanup Decision | closure log/archive index if closing | none |

## Requirement To Delivery Matrix

| Requirement | Priority | Acceptance Criteria | Design Sections | Tasks | Verification | Durable Targets | Coverage State | Residual Destination |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Requirement 1: Truncated Warmup Must Not Publish Complete Freshness | must-have | AC1, AC2, AC3 | Data Models; Function Signatures; Error Handling | T003, T005, T008, T009 | Metadata/status/MCP tests | Runtime contracts; runtime operations design | implemented-not-promoted | Durable promotion remains in T009. |
| Requirement 2: Docs Search Must Not Depend On Source-Graph Warmup Order | must-have | AC1, AC2, AC3 | High-Level Design; Algorithms and Logic; Data Flow | T002, T003, T004, T008, T009 | Large-repo docs fixture and docs FTS tests | Graph store design; MCP surface design | implemented-not-promoted | Durable promotion remains in T009. |
| Requirement 3: Graph Warmup May Be Bounded But Must Be Resumable Or Explicitly Partial | must-have | AC1, AC2, AC3 | Data Flow; Slice Boundary; Operational Considerations | T005, T007, T008, T009 | Runtime queue/completion tests | Runtime operations design; backlog if deferred | partially-implemented | T007 must decide completion executor or durable deferral. |
| Requirement 4: Coverage Metadata Must Be Diagnosable | should-have | AC1, AC2, AC3 | Data Models; Function Signatures; Error Handling | T003, T005, T006, T008, T009 | Contract/presenter/docs-search tests | Runtime contracts; MCP surface design | implemented-not-promoted | Durable promotion remains in T009. |
| Requirement 5: Large-Repo Regression Must Be Fixture-Backed | must-have | AC1, AC2, AC3 | Validation Strategy; Downstream Task Guidance | T002, T003, T004, T008 | Fixture-backed Vitest tests | MVP proof matrix if needed | implemented-not-promoted | T007 still owns completion/deferral proof. |

## Correctness Property Coverage

| Property | Requirements | Design Sections | Tasks | Tests Or Verification | Residual Risk |
| --- | --- | --- | --- | --- | --- |
| CP-001 | Requirement 1 | Data Models; Error Handling | T003, T005, T008 | Truncated warmup metadata tests | Durable promotion remains. |
| CP-002 | Requirements 1, 2, 3, 4 | Data Models; Function Signatures | T005, T006, T008 | Separate docs/graph coverage contract tests | T007 still owns completion/deferral. |
| CP-003 | Requirements 2, 5 | Algorithms and Logic; Data Flow | T002, T004, T008 | Phase 1 characterization test plus Phase 2 passing behavior tests | Durable promotion remains. |
| CP-004 | Requirement 3 | Data Flow; Operational Considerations | T007, T008 | Completion state tests or durable deferral evidence | Medium/high until D001 is resolved. |

## Design To Implementation Matrix

| Design Section | Requirements | Tasks | Interfaces Or Files | Verification | Coverage State | Residual Destination |
| --- | --- | --- | --- | --- | --- | --- |
| Docs/config seed phase | Requirement 2 | T004 | `index-repository-graph.ts`, docs indexing helpers, SQLite docs store | Docs FTS fixture tests | implemented-not-promoted | T009 durable docs |
| Graph seed phase | Requirement 3 | T005, T007 | `server.ts`, `index-repository-graph.ts`, warmup worker | Runtime/status tests | partially-implemented | T007 |
| Completion phase | Requirement 3 | T007 | `process-workspace-change-queue.ts`, warmup worker, runtime operations | Runtime queue/completion tests | not-covered | pending D001 |
| Coverage metadata | Requirements 1, 4 | T005, T006 | `src/contracts`, response metadata, presenters, MCP registries | Contract/MCP/trust tests | implemented-not-promoted | T009 durable docs |
| Durable promotion | all | T009, T010 | durable docs listed in `change-impact.md` | Docs review and link/metadata checks | not-covered | none |

## Open Decision Impact

| Decision ID | Blocks | Affected Requirements | Affected Tasks | Resolution Needed |
| --- | --- | --- | --- | --- |
| D001 | Design, implementation, verification, closure | Requirement 3 | T004, T005, T007, T008, T009 | Decide whether this spec implements resumable completion or ships partial-state correctness plus a durable completion follow-up. |
| D002 | Contract shape and docs promotion | Requirements 1, 4 | T005, T006, T008, T009 | Decide where docs/graph coverage state is persisted and which public fields expose it. |

## Maintenance Notes

- Update this matrix if task IDs, requirements, or durable targets change.
- `not-covered` and `partial-blocking` rows block closure until implemented,
  rejected with rationale, or routed to one explicit destination.
- Do not implement from task text alone; read the linked design and requirement
  rows first.
