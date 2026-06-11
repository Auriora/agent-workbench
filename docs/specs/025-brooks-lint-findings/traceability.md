---
title: Brooks-Lint findings tracker traceability
doc_type: spec
artifact_type: traceability
status: active
owner: platform
last_reviewed: 2026-06-11
---

# Traceability

## Purpose

Map each implementation task to its finding, durable destination, and
verification evidence before closing the active spec package.

## Task To Context Matrix

| Task | Finding or source | Durable destination | Verification |
| --- | --- | --- | --- |
| T001 | Initial `$brooks-audit` capture | Spec final commit and closure log | Captured in `findings.md`. |
| T002 | `BL-ARCH-001`, `BL-ARCH-002`, `BL-ARCH-003` triage | Spec final commit and closure log | Triage recorded in `findings.md` and `tasks.md`. |
| T003 | `BL-ARCH-001` | `docs/design/layered-runtime-architecture.md` and architecture boundary tests | Boundary tests, docs tests, `pnpm typecheck`, and `pnpm test`. |
| T004 | `BL-ARCH-002` | `docs/design/layered-runtime-architecture.md` and `docs/architecture/system-architecture.md` | Boundary/metadata tests, `pnpm typecheck`, and `pnpm test`. |
| T005 | `BL-ARCH-003` | `docs/design/layered-runtime-architecture.md` and telemetry port tests | Boundary/telemetry tests, `pnpm typecheck`, and `pnpm test`. |
| T006 | Architecture remediation validation | `docs/history/spec-closure-log.md` | Architecture tests, `pnpm typecheck`, and full suite evidence. |
| T007 | Architecture durable promotion | `docs/design/layered-runtime-architecture.md`, `docs/architecture/system-architecture.md`, and `docs/reference/documentation-map.md` | Durable docs updated and linked. |
| T008 | `$brooks-debt` capture | Spec final commit and closure log | Captured in `findings.md`. |
| T009 | `BL-DEBT-001`, `BL-DEBT-002`, `BL-DEBT-003` triage | Spec final commit and closure log | Triage recorded in `findings.md` and `tasks.md`. |
| T010 | `BL-DEBT-001` | Validation-planner modules and `docs/reference/mvp-proof-matrix.md` | Verification-plan tests, contract/presenter tests, `pnpm typecheck`, and `pnpm test`. |
| T011 | `BL-DEBT-002` | Resource extractor modules and `docs/reference/mvp-proof-matrix.md` | Extraction, graph, context, SAM, CMake, scanner, and overview tests. |
| T012 | `BL-DEBT-003` | `docs/reference/runtime-contracts.md` | Runtime contract tests, `pnpm typecheck`, and `pnpm test`. |
| T013 | `$brooks-health` capture | Spec final commit and closure log | Captured in `findings.md`. |
| T014 | `BL-HEALTH-001` | MCP test harness helpers and `docs/reference/mvp-proof-matrix.md` | Targeted MCP/integration tests, `pnpm typecheck`, and `pnpm test`. |
| T015 | `$brooks-test` capture | Spec final commit and closure log | Captured in `findings.md`. |
| T016 | `BL-TEST-001`, `BL-TEST-002`, `BL-TEST-003` triage | Spec final commit and closure log | Triage recorded in `findings.md` and `tasks.md`. |
| T017 | `BL-TEST-002` | Focused validation/resource tests and `docs/reference/mvp-proof-matrix.md` | Focused unit tests, related integration tests, `pnpm typecheck`, and `pnpm test`. |
| T018 | `BL-TEST-003` | Broad fixture helper structure and `docs/reference/mvp-proof-matrix.md` | Targeted fixture tests, `pnpm typecheck`, `pnpm test`, spec lint, and `git diff --check`. |

## Requirement To Delivery Matrix

| Requirement | Delivered by | Durable destination |
| --- | --- | --- |
| Requirement 1: Findings Ledger | T001, T008, T013, T015 | Final spec commit and closure log preserve captured Brooks reports. |
| Requirement 2: Triage And Task Conversion | T002, T009, T016 | Final spec commit preserves triage rationale and task evidence. |
| Requirement 3: Architecture Boundary Integrity | T003, T004, T005, T006 | `docs/design/layered-runtime-architecture.md`, `docs/architecture/system-architecture.md`, boundary tests, and telemetry tests. |
| Requirement 4: Durable Documentation Promotion | T007, T012, T014, T017, T018 | `docs/reference/runtime-contracts.md`, `docs/reference/mvp-proof-matrix.md`, `docs/reference/documentation-map.md`, and `docs/history/spec-closure-log.md`. |

## Design To Implementation Matrix

| Design section | Implemented by | Evidence |
| --- | --- | --- |
| Finding Lifecycle | T001, T002, T008, T009, T013, T015, T016 | Findings statuses and linked tasks are preserved in the final spec commit. |
| Data Model | T001-T018 | Findings, tasks, verification, and traceability artifacts use stable IDs and evidence links. |
| Report Capture | T001, T008, T013, T015 | Brooks audit, debt, health, and test review reports were captured without overwriting earlier evidence. |
| Task Conversion | T002, T009, T016 | Accepted findings map to remediation tasks with dependencies and evidence. |
| Boundary Test Remediation Shape | T003, T004, T005, T006 | Boundary tests enforce parser-backed import extraction, inward dependencies, and telemetry port ownership. |
| Code Ownership Remediation Shape | T004, T005, T010, T011, T012 | Response metadata, telemetry, validation planning, resource extraction, and runtime contracts were split behind stable ownership boundaries. |

## Open Decision Impact

No open decisions remain for spec closure. The closure action is `removed` after
the final active-package commit, with current behavior promoted to durable docs
and the detailed spec package available through Git history.

## Closure Mapping

The final active-package commit preserves the detailed findings, task evidence,
verification log, and this traceability matrix. Current behavior is promoted to
durable docs as follows:

- Layer ownership and dependency rules:
  `docs/design/layered-runtime-architecture.md`
- System-level boundary summary:
  `docs/architecture/system-architecture.md`
- Runtime contract module ownership:
  `docs/reference/runtime-contracts.md`
- Fixture, MCP harness, focused unit, and broad fixture maintainability gates:
  `docs/reference/mvp-proof-matrix.md`
- Closed-spec history and retrieval commit:
  `docs/history/spec-closure-log.md`
