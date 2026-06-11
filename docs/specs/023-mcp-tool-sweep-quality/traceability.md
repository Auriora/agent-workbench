---
title: MCP tool sweep quality traceability
doc_type: spec
artifact_type: traceability
status: active
owner: platform
last_reviewed: 2026-06-11
---

# Traceability

## Requirement To Delivery Matrix

| Requirement | Acceptance criteria | Tasks | Implementation evidence | Verification evidence | Durable destination |
| --- | --- | --- | --- | --- | --- |
| Requirement 1: Permanent MCP Tool Sweep Harness | R1.1-R1.6 | T001, T002, T003, T009, T010 | `src/debug/mcp-tool-sweep.ts`, `tests/mcp/debug-harness.test.ts` | Fixture sweeps, progress-report tests, final T015 committed-sandbox sweep | `docs/design/observability-debugging-design.md`, `docs/design/runtime-operations-design.md` |
| Requirement 2: Readiness And Metadata Semantics | R2.1-R2.4 | T004, T011 | `src/presentation/metadata.ts`, `src/application/use-cases/get-repo-status.ts`, `src/application/use-cases/query-helpers.ts`, `tests/runtime/status.test.ts`, `tests/mcp/repo-status-resource.test.ts` | Focused status/orientation/MCP tests, final full suite, final T015 sweep | `docs/reference/runtime-contracts.md` |
| Requirement 3: Documentation Tool Correctness | R3.1-R3.5 | T005, T008 | `src/application/use-cases/query-docs.ts`, `src/presentation/docs-presenter.ts`, `tests/docs/query-docs.test.ts`, `tests/docs/docs-presenter.test.ts` | Focused docs and presenter tests, final full suite, final T015 sweep | `docs/reference/runtime-contracts.md`, `docs/reference/documentation-map.md` |
| Requirement 4: Graph-Backed Tool Sweep Quality | R4.1-R4.4 | T006 | `src/debug/mcp-tool-sweep.ts`, `src/application/use-cases/query-helpers.ts`, `tests/mcp/debug-harness.test.ts`, `tests/graph/query-tools.test.ts` | Focused graph/query/debug-harness tests, final full suite, final T015 sweep | `docs/reference/runtime-contracts.md` |
| Requirement 5: Verification Planning Clarity | R5.1-R5.4 | T007 | `src/application/use-cases/plan-verification.ts`, `tests/mcp/verification-plan-tool.test.ts` | Focused verification-plan tests, final full suite, final T015 sweep | `docs/reference/runtime-contracts.md` |
| Requirement 6: Durable Quality Gates | R6.1-R6.4 | T010, T012, T013, T014 | Durable docs promotion and spec evidence updates | `pnpm typecheck`, focused tests, `pnpm test`, `git diff --check`, spec lint, final committed-sandbox sweep | `docs/design/observability-debugging-design.md`, `docs/design/runtime-operations-design.md`, `docs/reference/runtime-contracts.md`, `docs/reference/documentation-map.md` |

## Task To Context Matrix

| Task | Requirement context | Design context | Verification context | Status |
| --- | --- | --- | --- | --- |
| T001-T003 | Requirement 1 | Debug Harness, Call Planning, Fixture Strategy | Baseline fixture and committed-sandbox sweeps | Complete |
| T004, T011 | Requirement 2 | Metadata Corrections | Status/orientation/MCP resource tests, final sweep | Complete |
| T005 | Requirement 3 | Metadata Corrections, Fixture Strategy | Docs query and MCP docs tests | Complete |
| T006 | Requirement 4 | Sweep input selector, graph-backed metadata corrections | Graph query, MCP query, context, and debug-harness tests | Complete |
| T007 | Requirement 5 | Verification-plan presenter corrections | Verification-plan MCP tests | Complete |
| T008 | Requirement 3, Requirement 6 | Compact skipped-path presentation | Docs presenter, query-docs, context, debug-harness tests | Complete |
| T009-T010 | Requirement 1, Requirement 6 | Progress reporting and reproducible dogfood | Progress-report tests and committed-sandbox sweeps | Complete |
| T012 | Requirement 6 | Operational considerations | Bounded concurrency decision in verification/durable docs | Complete |
| T013-T014 | Requirement 6 | Durable quality gates and promotion | Full suite, final sweep, durable docs, spec lint | Complete |

## Design To Implementation Matrix

| Design area | Implementation | Test evidence | Notes |
| --- | --- | --- | --- |
| Debug Harness | `src/debug/mcp-tool-sweep.ts` | `tests/mcp/debug-harness.test.ts` | Uses public MCP registry coverage and local `.tmp` reports. |
| Call Planning | `discoverRepoFacts`, scanner-visible file selection, indexed-symbol selection | Debug-harness scanner-visible and indexed-symbol tests | Workspace-write calls are allowed only for fixtures or explicit sandboxes. |
| Metadata Corrections | `src/presentation/metadata.ts`, `src/application/use-cases/query-helpers.ts`, docs/status use cases | Status, docs, graph, verification-plan tests | Cold graph/docs blocked states are valid blocked evidence, not invalid input. |
| Documentation Edge Cases | `src/application/use-cases/query-docs.ts` | `tests/docs/query-docs.test.ts`, `tests/mcp/docs-surfaces.test.ts` | Missing and no-heading Markdown are distinguishable. |
| Verification Planning | `src/application/use-cases/plan-verification.ts` | `tests/mcp/verification-plan-tool.test.ts` | Blocked summaries include reason and next action while keeping commands non-executed. |
| Durable Quality Gates | Spec evidence, durable docs, final sweep | `pnpm typecheck`, focused tests, `pnpm test`, `git diff --check`, spec lint | Final sweep reports 176 full rows and no non-full rows. |

## Open Decision Impact

| Decision | Impact | Disposition |
| --- | --- | --- |
| No-heading Markdown should be `done` with zero headings or `needed` with a warning. | Affects docs outline semantics and next actions. | Resolved as `done` with an empty heading list because the requested document exists and direct-read evidence is available. |
| Sweep concurrency for large repositories. | Could shorten dogfood but adds report ordering, cancellation, and SQLite coordination risk. | Deferred; serial remains the closure path. Future bounded repo-level concurrency requires isolated per-repo runtimes and deterministic report assembly. |
| Workspace-write behavior on external repos. | Original external repositories must not be mutated during dogfood. | Resolved: write-capable sweep rows run only against fixtures or explicit sandbox copies. |
| Cold graph/docs blocked metadata. | Affects whether agents treat unavailable evidence as product failure. | Resolved as valid blocked metadata with explicit blocker/next action where applicable. |

## Closure Evidence

- Final full suite: `pnpm test` passed with 59 files and 395 tests on
  2026-06-11.
- Final committed-sandbox sweep:
  `.tmp/agent-workbench-tool-sweep-t015-full/mcp-tool-sweep-2026-06-11T14-00-18-411Z.json`
  covered 176 rows with 176 full, 0 partial, 0 degraded, 0 blocked, and 0
  invalid results.
- Workspace-write rows ran only against committed-tree sandbox copies, not
  original external repositories.
- Durable docs now describe the sweep harness, quality labels, sandbox-write
  boundary, bounded concurrency decision, and `no_adapter_coverage` caveat.
