---
title: First-read reliability and bounded tools traceability
doc_type: spec
artifact_type: traceability
status: draft
owner: platform
last_reviewed: 2026-07-10
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Traceability Matrix

## Purpose

Map Spec 037 requirements, design sections, tasks, verification gates, durable
targets, and open decisions. Before implementing a task, read this matrix and
the linked source artifacts.

## Task To Context Matrix

| Task ID | Requirements | Acceptance Criteria | Design Sections | Change Impact | Verification | Durable Targets | Open Decisions |
|---------|--------------|---------------------|-----------------|---------------|--------------|-----------------|----------------|
| T001 | Requirement 5 | AC1-AC3 | `design.md#overview` | `change-impact.md#promotion-targets` | `verification.md#quality-gates` | `docs/backlog/README.md` | none |
| T002 | Requirement 1; Requirement 2; Requirement 3 | R1 AC1-AC3; R2 AC1-AC3; R3 AC1-AC3 | `design.md#components-and-changes` | `change-impact.md#durable-source-mapping` | `verification.md#agent-readiness-evidence` | runtime contracts and design docs | `open-decisions.md#d001-response-state-vocabulary`, `open-decisions.md#d002-failure-mode-fixture-strategy`, `open-decisions.md#d003-shared-classifier-ownership` |
| T003 | Requirement 1; Requirement 2; Requirement 3 | R1 AC1-AC3; R2 AC1-AC3; R3 AC1-AC3 | `design.md#first-implementation-slice`, `design.md#minimum-evidence-contract-for-t004` | `change-impact.md#proposed-changes` | `verification.md#scope-reconciliation-before-closure` | T004 helper/contract slice; later durable runtime contracts | `open-decisions.md#d001-response-state-vocabulary`, `open-decisions.md#d002-failure-mode-fixture-strategy`, `open-decisions.md#d003-shared-classifier-ownership` |
| T004 | Requirement 1; Requirement 3 | R1 AC1-AC3; R3 AC1-AC3 | `design.md#data-models`, `design.md#function-signatures-and-interfaces` | `change-impact.md#proposed-changes` | `verification.md#validation-commands` | `docs/reference/runtime-contracts.md` | `open-decisions.md#d001-response-state-vocabulary`, `open-decisions.md#d003-shared-classifier-ownership` |
| T005 | Requirement 4 | AC1-AC3 | `design.md#validation-strategy` | none | `verification.md#validation-commands` | none | D002 |
| T006 | Requirement 1; Requirement 2; Requirement 3; Requirement 4 | R1 AC1-AC3; R2 AC1-AC3; R3 AC1-AC3; R4 AC1-AC3 | `design.md#components-and-changes`, `design.md#error-handling` | `change-impact.md#proposed-changes` | `verification.md#requirement-coverage` | runtime operations, MCP surface, runtime contracts | `open-decisions.md#d001-response-state-vocabulary` |
| T007 | Requirement 1; Requirement 2; Requirement 3; Requirement 4 | R1 AC1-AC3; R2 AC1-AC3; R3 AC1-AC3; R4 AC1-AC3 | `design.md#components-and-changes`, `design.md#error-handling` | `change-impact.md#proposed-changes` | `verification.md#requirement-coverage` | MCP surface, graph store, runtime contracts | `open-decisions.md#d001-response-state-vocabulary` |
| T008 | Requirement 1; Requirement 2; Requirement 3; Requirement 4 | All AC for R1-R4 | `design.md#validation-strategy` | none | `verification.md#evidence-log` | none | `open-decisions.md` if unresolved |
| T009 | Requirement 5 | AC1-AC3 | `design.md#operational-considerations` | `change-impact.md#promotion-targets` | `verification.md#durable-promotion-and-cleanup` | runtime contracts, MCP surface, runtime operations, graph store, backlog | none |
| T010 | Requirement 5 | AC1-AC3 | `design.md#validation-strategy` | `change-impact.md#promotion-targets` | `verification.md#ship-or-closure-risk` | closure log and archive index during closure | none |

## Requirement To Delivery Matrix

| Requirement | Priority | Acceptance Criteria | Design Sections | Tasks | Verification | Durable Targets | Coverage State | Residual Destination |
|-------------|----------|---------------------|-----------------|-------|--------------|-----------------|----------------|----------------------|
| Requirement 1 | must-have | AC1-AC3 | `design.md#data-models`, `design.md#error-handling` | T002, T003, T004, T006, T007, T008 | `verification.md#requirement-coverage` | `docs/reference/runtime-contracts.md`, `docs/design/mcp-surface-design.md` | not-covered | active spec |
| Requirement 2 | must-have | AC1-AC3 | `design.md#algorithms-and-logic`, `design.md#components-and-changes` | T002, T003, T005, T006, T007, T008 | `verification.md#requirement-coverage` | `docs/design/runtime-operations-design.md`, `docs/design/graph-store-design.md` | not-covered | active spec |
| Requirement 3 | must-have | AC1-AC3 | `design.md#error-handling`, `design.md#security-trust-and-access` | T002, T003, T004, T006, T007, T008 | `verification.md#requirement-coverage` | `docs/reference/runtime-contracts.md`, `docs/design/mcp-surface-design.md` | not-covered | active spec |
| Requirement 4 | must-have | AC1-AC3 | `design.md#validation-strategy` | T005, T006, T007, T008, T010 | `verification.md#validation-commands` | none | not-covered | active spec |
| Requirement 5 | must-have | AC1-AC3 | `design.md#operational-considerations` | T001, T009, T010 | `verification.md#durable-promotion-and-cleanup` | durable docs and history indexes | partial-blocking | active spec |

## Correctness Property Coverage

| Property | Requirements | Design Sections | Tasks | Tests Or Verification | Residual Risk |
|----------|--------------|-----------------|-------|-----------------------|---------------|
| CP-001 | Requirement 1 | `design.md#data-models` | T004, T006, T007 | Contract and MCP golden tests | Pending. |
| CP-002 | Requirements 1, 3 | `design.md#error-handling` | T004, T005, T006, T007 | Failure-mode fixture tests | Pending. |
| CP-003 | Requirement 2 | `design.md#algorithms-and-logic` | T005, T006, T007 | Skipped-work/truncation tests | Pending. |
| CP-004 | Requirement 3 | `design.md#data-models` | T007, T008 | Verification-plan tests | Pending. |

## Design To Implementation Matrix

| Design Section | Requirements | Tasks | Interfaces Or Files | Verification | Coverage State | Residual Destination |
|----------------|--------------|-------|---------------------|--------------|----------------|----------------------|
| `design.md#components-and-changes` | Requirement 1; Requirement 2; Requirement 3; Requirement 4 | T002, T006, T007 | `src/application/use-cases/*`, `tests/*` | Focused Vitest suites | not-covered | active spec |
| `design.md#data-models` | Requirements 1, 3 | T004 | `src/contracts/*`, response metadata helpers | Contract tests | not-covered | active spec |
| `design.md#error-handling` | Requirements 1-3 | T004, T006, T007 | use cases and presenters | MCP/resource tests | not-covered | active spec |
| `design.md#validation-strategy` | Requirements 4, 5 | T005, T008, T010 | `tests/`, `verification.md` | Focused and full validation | not-covered | active spec |
| `design.md#operational-considerations` | Requirement 5 | T009, T010 | durable docs | Docs validation and closure checks | not-covered | active spec |

## Open Decision Impact

| Decision ID | Blocks | Affected Requirements | Affected Tasks | Resolution Needed |
|-------------|--------|-----------------------|----------------|-------------------|
| D001 | Design and implementation | Requirements 1, 3 | T003, T004, T006, T007 | Approved: existing public response fields with additive helper semantics; EB024 only for a proven field-level gap. |
| D002 | Fixture design | Requirement 4 | T003, T005 | Approved: hybrid filesystem fixtures plus adapter fakes. |
| D003 | Shared helper ownership | Requirements 1-3 | T003, T004 | Approved: shared application-level helper with per-use-case evidence inputs. |

## Phase 1 Reconciliation

T002 result:
Current response vocabulary is sufficient for the first slice. EB024 is not a
prerequisite; continue with additive helper semantics. Evidence:
`response-metadata.ts` already maps runtime trust classification, watcher
freshness, caveats, and trust restrictions onto existing response fields.

T003 result:
T004 is selected as the first implementation slice. Start with helper/contract
tests before broad first-read surface hardening. Evidence is recorded in
`design.md#first-implementation-slice` and `verification.md#task-evidence`.

## Maintenance Notes

- Update coverage states as tasks complete.
- Do not close the spec while any must-have row remains `not-covered`,
  `partial-blocking`, or without a residual destination.
- If EB024 becomes a prerequisite, mark affected implementation tasks
  attention-needed rather than forcing status vocabulary into this spec.
- Apply approved `open-decisions.md` entries before marking T003 complete.
