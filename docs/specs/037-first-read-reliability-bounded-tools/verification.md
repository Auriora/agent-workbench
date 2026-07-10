---
title: First-read reliability and bounded tools verification
doc_type: spec
artifact_type: verification
status: draft
owner: platform
last_reviewed: 2026-07-10
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Verification

## Scope

This verification record covers Spec 037 from backlog promotion through
implementation, durable promotion, and closure readiness. Phases 1-4 are
complete: the package is created, current runtime response behavior is
reconciled, shared contract/fixture foundations are in place, first-read
resource/tool hardening is validated, and accepted behavior is promoted to
durable docs.

## Quality Gates

| Gate | Required? | Status | Evidence |
|------|-----------|--------|----------|
| Requirements acceptance criteria reviewed | yes | passed | Requirements reviewed through Phase 4 scope. |
| Task evidence complete | yes | passed | T001-T010 complete. |
| Automated tests pass or alternate verification recorded | yes | passed | Phase 4 docs validation, typecheck, and full suite passed. |
| Durable documentation updates identified | yes | passed | `change-impact.md` identifies targets. |
| Durable documentation promoted or explicitly deferred | yes | passed | Accepted behavior promoted; residual graph completion and telemetry evidence are routed. |
| Spec cleanup decision recorded | yes | passed | Ready for explicit closure cleanup. |
| Governance or policy conflicts resolved | yes | passed | D001-D003 approved; no open decisions remain. |

## Validation Commands

| Command | Purpose | Result | Evidence |
|---------|---------|--------|----------|
| `git diff --check -- docs/specs/037-first-read-reliability-bounded-tools` | Markdown and whitespace sanity for spec artifacts. | passed | 2026-07-10: no whitespace errors. |
| `pnpm exec vitest run tests/docs/docs-links-metadata.test.ts` | Documentation metadata/link regression after spec creation. | passed | 2026-07-10: 1 file, 2 tests passed. |
| `pnpm run typecheck` | TypeScript contract/use-case validation after implementation. | passed | 2026-07-10: `tsc --noEmit` passed. |
| `pnpm run test` | Full regression before closure. | passed | 2026-07-10: Phase 3 full run passed, 78 files and 581 tests. |
| `pnpm exec vitest run tests/contracts/response-metadata.test.ts tests/workspace/file-catalog-scanner.test.ts` | Phase 2 focused contract and fixture validation. | passed | 2026-07-10: 2 files and 33 tests passed. |
| `pnpm exec vitest run tests/runtime/status.test.ts tests/mcp/repo-status-resource.test.ts tests/mcp/repo-scope-overview-resource.test.ts tests/mcp/context-for-task-tool.test.ts tests/docs/query-docs.test.ts tests/diagnostics/diagnose-changed-files.test.ts tests/mcp/diagnostics-for-files-tool.test.ts tests/mcp/verification-plan-tool.test.ts` | Phase 3 focused resource/tool validation. | passed | 2026-07-10: 8 files and 130 tests passed. |
| `pnpm exec vitest run tests/docs/docs-links-metadata.test.ts` | Phase 4 durable-doc metadata/link validation. | passed | 2026-07-10: 1 file and 2 tests passed. |
| `pnpm run typecheck` | Phase 4 TypeScript validation after durable promotion. | passed | 2026-07-10: `tsc --noEmit` passed. |
| `pnpm run test` | Phase 4 full regression after durable promotion. | passed | 2026-07-10: full suite passed, 78 files and 581 tests. |
| `git diff --check` | Workspace whitespace validation. | passed | 2026-07-10: no whitespace errors. |
| `lint_spec_package` | Lifecycle package validation. | passed | 2026-07-10: 0 errors, 0 warnings, 0 info. |
| `task_state_audit` | Lifecycle task evidence audit. | passed | 2026-07-10: no findings. |
| `closure_check` | Lifecycle closure-readiness check. | passed | 2026-07-10: ready with no blockers. |

## Requirement Coverage

| Requirement | Acceptance criteria covered | Evidence | Residual risk |
|-------------|-----------------------------|----------|---------------|
| Requirement 1 | resource/tool hardening | T004, T006, T007, and T009 cover state metadata mapping through existing fields, first-read surface behavior, and durable docs. | No residual risk accepted in this spec. |
| Requirement 2 | resource/tool hardening | T005, T006, T007, and T009 cover skipped, provider-limited, and budgeted evidence across representative surfaces and durable docs. | Graph completion remains routed to EB014. |
| Requirement 3 | resource/tool hardening | T004, T006, T007, and T009 cover proof-like trust restrictions, provider-limited diagnostics, non-executed validation planning, and durable docs. | No residual risk accepted in this spec. |
| Requirement 4 | fixture and focused tests | T005, T006, T007, T008, and T010 cover fixtures, adapter fakes, resource tests, tool tests, and full validation. | No residual risk accepted in this spec. |
| Requirement 5 | durable promotion | T009 promotes accepted behavior; T010 records validation and closure readiness. | Closure cleanup remains an explicit final step. |

## Correctness Property Coverage

| Property | Covered by | Evidence | Residual risk |
|----------|------------|----------|---------------|
| CP-001 | Contract/helper, resource/tool tests, and durable docs. | `response-metadata.test.ts`, resource envelopes, diagnostics envelopes, verification-plan envelopes, and runtime contracts cover metadata/trust alignment. | No residual risk accepted in this spec. |
| CP-002 | Contract/helper, fixture, resource/tool tests, and durable docs. | Adapter-fake tests plus Phase 3 resource/tool tests cover unsafe evidence states and named reasons. | No residual risk accepted in this spec. |
| CP-003 | Scanner fixture, first-read surface tests, and durable docs. | Scanner, scope/overview, context, docs, verification-plan, graph-store, and MCP docs cover bounded skipped-work and budget evidence. | Graph completion remains routed to EB014. |
| CP-004 | Verification-plan tests and durable docs. | Verification-plan tests and runtime/MCP docs cover non-executed command planning and passed-validation trust restrictions. | No residual risk accepted in this spec. |

## Scope Reconciliation Before Closure

| Broad requirement, design target, or review finding | Implemented in this spec | Coverage state | Deferred or rejected work | Destination | Blocks closure? | Evidence |
|-----------------------------------------------------|--------------------------|----------------|---------------------------|-------------|-----------------|----------|
| First-read valid/stale/degraded/blocked behavior | helper foundation plus resource/tool surfaces | complete | none | n/a | no | T004, T006, T007, T009, and durable docs prove shared and surface behavior. |
| Bounded skipped-work reporting | fixture foundation plus resource/tool surfaces | complete | graph completion executor | EB014 | no | T005, T006, T007, T009, and durable docs cover skipped, provider-limited, and budgeted evidence. |
| Cold/stale/degraded/blocked fixtures | fixture/fake foundation plus resource/tool surfaces | complete | none | n/a | no | T005, T006, and T007 combine filesystem fixtures, adapter fakes, and surface tests. |
| Durable docs promotion | runtime contracts, operations, MCP surface, graph store, backlog | complete | closure history only | closure step | no | T009 promotion is complete. |

## Agent Readiness Evidence

| Field | Evidence | Residual risk |
|-------|----------|---------------|
| Scope and out-of-scope files | Scope spans first-read use cases, contracts, runtime/graph/docs helpers, and durable docs. Out of scope: command execution and fallback parser/semantic paths. | First slice is narrowed to T004 helper/contract behavior before broad tool hardening. |
| Must-read and optional context | Must read `requirements.md`, `design.md`, `traceability.md`, `change-impact.md`, and relevant durable docs before implementation. | T004 should read `response-metadata.ts` and `tests/contracts/response-metadata.test.ts` before editing. |
| Permissions and approval points | Local repo edits and tests are normal. Network/publishing not needed. | Daemon/socket tests may require unrestricted environment. |
| Validation commands and expected signals | Focused Vitest slices, `pnpm typecheck`, full `pnpm test`, docs metadata/link tests. | Native/sandbox constraints must be recorded if encountered. |
| Review needs | Contract and MCP output behavior should be reviewed before broad rollout. | Golden output churn risk. |
| Durable-doc or closure impact | Durable promotion required before closure. | Active spec must not be removed until promoted. |
| Optional repo-evidence provider caveats | MCP index can be stale for removed spec packages; direct filesystem verification is required. | Record stale MCP evidence as caveat, not blocker. |

## Task Evidence

| Task ID | Status | Evidence | Notes |
|---------|--------|----------|-------|
| T001 | complete | Spec package scaffolded on 2026-07-09; package lint and docs validation recorded on 2026-07-10. | Phase 2 now complete. |
| T002 | complete | 2026-07-10: inspected runtime contracts, response metadata helpers, repo status/scope/overview, task context, docs query, diagnostics, and verification planning. Existing public response fields cover the first slice; no EB024 prerequisite found. | Phase 2 now complete. |
| T003 | complete | 2026-07-10: selected T004 as the first implementation slice and recorded the minimum evidence contract in `design.md`. | Phase 2 now complete. |
| T004 | complete | 2026-07-10: added focused `response-metadata.test.ts` coverage for state metadata mapping and proof-like trust restrictions. | Existing helper ownership confirmed; no public enum migration selected. |
| T005 | complete | 2026-07-10: added `fixture-first-read-failure-modes` plus scanner coverage for unsupported, skipped, and budget-truncated evidence. | Adapter-fake tests cover runtime state cases; existing scanner test covers permission-limited paths. |
| T006 | complete | 2026-07-10: scan truncation and row budgets now flow through shared status metadata; resource tests cover stale scope, unavailable overview, skipped paths, unsupported coverage, provider failure envelopes, watcher caveats, and bounded status metadata. | Durable promotion remains in T009. |
| T007 | complete | 2026-07-10: diagnostics provider failure now returns a top-level needed status with reduced analysis validity; focused tool tests cover context skipped work, docs cold/refreshing/unsafe paths, diagnostics missing/provider-limited states, and non-executed validation-plan trust boundaries. | Durable promotion remains in T009. |
| T008 | complete | 2026-07-10: Phase 3 focused Vitest slices passed with 8 files and 130 tests; `pnpm run typecheck` and `pnpm run test` passed. | Durable promotion remains in T009. |
| T009 | complete | 2026-07-10: promoted accepted first-read metadata, trust, hidden-work, skipped-evidence, graph/docs coverage, diagnostics, and validation-plan behavior to durable docs. | Residual graph completion is routed to EB014; telemetry evidence is routed to EB009. |
| T010 | complete | 2026-07-10: docs metadata/link test, typecheck, full suite, lifecycle lint, task audit, closure check, and diff whitespace checks were recorded. | Ready for explicit closure cleanup. |

## Evidence Log

| Date | Evidence | Result | Notes |
|------|----------|--------|-------|
| 2026-07-09 | Created active Spec 037 package from EB003. | pending validation | Scaffold only. |
| 2026-07-10 | `git diff --check -- docs/specs/037-first-read-reliability-bounded-tools`. | passed | No whitespace errors. |
| 2026-07-10 | `pnpm exec vitest run tests/docs/docs-links-metadata.test.ts`. | passed | 1 file and 2 tests passed. |
| 2026-07-10 | Approved D001-D003 recommendations in `open-decisions.md`. | approved | Use existing response fields with additive helper semantics, hybrid fixture/fake tests, and shared helper ownership with per-use-case evidence inputs. |
| 2026-07-10 | T002 runtime-contract reconciliation. | complete | Existing fields and `response-metadata.ts` helper behavior are sufficient for the first slice; EB024 is not a prerequisite. |
| 2026-07-10 | T003 first implementation slice selection. | complete | T004 selected: shared response metadata/helper contract coverage before broad first-read surface hardening. |
| 2026-07-10 | `pnpm exec vitest run tests/contracts/response-metadata.test.ts tests/workspace/file-catalog-scanner.test.ts`. | passed | 2 files and 33 tests passed. |
| 2026-07-10 | T004 shared state and trust classification. | complete | Existing response metadata helpers are covered by focused stale, degraded, cold, and unavailable-state tests. |
| 2026-07-10 | T005 first-read failure fixture foundation. | complete | Hybrid filesystem fixture and adapter-fake coverage are in place for Phase 2. |
| 2026-07-10 | `pnpm run typecheck`. | passed | `tsc --noEmit` passed. |
| 2026-07-10 | `pnpm run test`. | passed | First full run hit a daemon entrypoint timeout; isolated daemon test passed, then second full run passed with 78 files and 577 tests. |
| 2026-07-10 | `pnpm exec vitest run tests/runtime/status.test.ts tests/mcp/repo-status-resource.test.ts tests/mcp/repo-scope-overview-resource.test.ts tests/mcp/context-for-task-tool.test.ts tests/docs/query-docs.test.ts tests/diagnostics/diagnose-changed-files.test.ts tests/mcp/diagnostics-for-files-tool.test.ts tests/mcp/verification-plan-tool.test.ts`. | passed | Phase 3 focused resource/tool validation passed with 8 files and 130 tests. |
| 2026-07-10 | T006 repo status, scope, and overview hardening. | complete | Resource and runtime tests cover stale, unavailable, skipped, unsupported, provider failure, watcher, and budgeted evidence states. |
| 2026-07-10 | T007 context, docs, diagnostics, and verification planning hardening. | complete | Tool tests cover skipped, missing, provider-limited, non-executed validation, and unsafe-claim boundaries. |
| 2026-07-10 | `pnpm run typecheck`. | passed | Phase 3 `tsc --noEmit` passed. |
| 2026-07-10 | T008 focused first-read validation checkpoint. | complete | Focused tests and typecheck passed; durable promotion remains in T009. |
| 2026-07-10 | `pnpm run test`. | passed | Phase 3 full suite passed with 78 files and 581 tests. |
| 2026-07-10 | T009 durable documentation promotion. | complete | Runtime contracts, runtime operations, MCP surface, graph-store, and backlog docs now carry accepted first-read reliability behavior. |
| 2026-07-10 | `pnpm exec vitest run tests/docs/docs-links-metadata.test.ts`. | passed | Phase 4 docs metadata/link validation passed with 1 file and 2 tests. |
| 2026-07-10 | `pnpm run typecheck`. | passed | Phase 4 `tsc --noEmit` passed. |
| 2026-07-10 | `pnpm run test`. | passed | Phase 4 full suite passed with 78 files and 581 tests. |
| 2026-07-10 | T010 closure-readiness checkpoint. | complete | Full validation and durable promotion evidence recorded; closure cleanup remains explicit. |
| 2026-07-10 | `git diff --check`. | passed | No whitespace errors. |
| 2026-07-10 | `lint_spec_package`. | passed | Lifecycle lint reported 0 errors, 0 warnings, and 0 info. |
| 2026-07-10 | `task_state_audit`. | passed | Lifecycle task audit reported no findings. |
| 2026-07-10 | `closure_check`. | passed | Lifecycle closure check reported ready with no blockers. |

## Manual Or External Verification

None yet.

## Residual Risks

- D001 approves existing response fields plus additive helper semantics; T002
  found no concrete field-level gap. EB024 remains a residual destination only
  if T004 or later surface tests prove one.
- D002 approves adapter fakes for nondeterministic runtime, watcher, provider,
  stale, or blocked states; filesystem fixtures should still cover
  repository-shape behavior.
- Golden MCP responses may churn; keep output changes additive where possible.

## Durable Promotion And Cleanup

| Spec content | Durable destination or deferral | Status | Evidence |
|--------------|---------------------------------|--------|----------|
| Requirements and accepted behavior | `docs/reference/runtime-contracts.md`, `docs/design/mcp-surface-design.md` | promoted | First-read state, trust, and public surface behavior promoted. |
| Technical design or architecture | `docs/design/runtime-operations-design.md`, `docs/design/graph-store-design.md` | promoted | Bounded first-read operation, graph/docs coverage, and skipped evidence promoted. |
| Contracts, schemas, data flow, or integration behavior | `docs/reference/runtime-contracts.md` | promoted | Existing metadata vocabulary retained; no public enum migration needed. |
| Operational steps, rollout, validation, or recovery | `docs/design/runtime-operations-design.md` | promoted | Hidden work, refresh, queue, and unavailable-state behavior promoted. |
| Decisions and rationale | `docs/history/spec-closure-log.md` during closure | deferred to closure | Closure history should be written during the explicit cleanup step. |
| Follow-up work | `docs/backlog/README.md` | promoted | Graph completion routed to EB014; telemetry evidence routed to EB009. |

### Spec Cleanup Decision

- **Cleanup action:** ready for closure cleanup
- **Reason:** Implementation, validation, and durable promotion are complete.
- **Final spec commit:** Phase 4 commit recorded in commit history
- **Closure log path:** `docs/history/spec-closure-log.md`
- **Closure log entry updated:** no
- **Closure cleanup commit:** pending
- **Active indexes updated:** no
- **Durable docs linked back to evidence where useful:** yes
- **Residual spec-only content:** listed below

Residual spec-only content:

- Detailed task execution history remains active-spec-only until closure
  history is written.

## Ship Or Closure Risk

- **Risk level:** low
- **Breaking change:** no
- **Blast radius checked:** yes
- **Rollback path:** not required yet
- **Requires human review:** no
- **Release notes needed:** no
- **Follow-up issue or spec needed:** yes, existing EB014 and EB009 routing only

### Risk Rationale

This spec affects first-call trust across multiple public MCP surfaces, but the
accepted implementation is additive and uses existing response metadata fields.
Focused tests, full regression, lifecycle checks, and durable promotion are
complete. Remaining work is outside this spec: graph completion beyond the
first-pass budget is routed to EB014, and telemetry/reporting evidence is
routed to EB009.

## Readiness Decision

- **Ready for promotion:** yes
- **Ready for release:** yes
- **Ready for closure:** yes

## Related Artifacts

- Requirements: `requirements.md`
- Canonical Context: `canonical-context.md`
- Change Impact: `change-impact.md`
- Open Decisions: `open-decisions.md`
- Design: `design.md`
- Tasks: `tasks.md`
- Traceability: `traceability.md`
