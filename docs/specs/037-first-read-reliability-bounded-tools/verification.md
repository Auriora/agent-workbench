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
implementation, durable promotion, and closure readiness. Phase 1 is complete:
the package is created, the current runtime response behavior is reconciled, and
the first implementation slice is selected. Implementation evidence is pending.

## Quality Gates

| Gate | Required? | Status | Evidence |
|------|-----------|--------|----------|
| Requirements acceptance criteria reviewed | yes | partial | Requirements reviewed through Phase 2 scope; durable promotion pending. |
| Task evidence complete | yes | partial | T001-T005 complete; T006-T010 pending. |
| Automated tests pass or alternate verification recorded | yes | passed | Phase 2 focused tests, typecheck, and second full suite passed. |
| Durable documentation updates identified | yes | pending | `change-impact.md` identifies targets. |
| Durable documentation promoted or explicitly deferred | yes | pending | Not started. |
| Spec cleanup decision recorded | yes | pending | Not ready for closure. |
| Governance or policy conflicts resolved | yes | partial | D001-D003 approved; no Phase 2 blockers remain. |

## Validation Commands

| Command | Purpose | Result | Evidence |
|---------|---------|--------|----------|
| `git diff --check -- docs/specs/037-first-read-reliability-bounded-tools` | Markdown and whitespace sanity for spec artifacts. | passed | 2026-07-10: no whitespace errors. |
| `pnpm exec vitest run tests/docs/docs-links-metadata.test.ts` | Documentation metadata/link regression after spec creation. | passed | 2026-07-10: 1 file, 2 tests passed. |
| `pnpm run typecheck` | TypeScript contract/use-case validation after implementation. | passed | 2026-07-10: `tsc --noEmit` passed. |
| `pnpm run test` | Full regression before closure. | passed | 2026-07-10: second full run passed, 78 files and 577 tests. |
| `pnpm exec vitest run tests/contracts/response-metadata.test.ts tests/workspace/file-catalog-scanner.test.ts` | Phase 2 focused contract and fixture validation. | passed | 2026-07-10: 2 files and 33 tests passed. |

## Requirement Coverage

| Requirement | Acceptance criteria covered | Evidence | Residual risk |
|-------------|-----------------------------|----------|---------------|
| Requirement 1 | helper foundation | T004 covers state metadata mapping through existing fields. | Surface-specific hardening remains in T006/T007. |
| Requirement 2 | planning only | T003 selects T004 before surface work. | Skipped-work shape may vary by surface until T006/T007. |
| Requirement 3 | helper foundation | T004 covers proof-like trust restrictions for unsafe evidence states. | Existing tools may still differ until hardening tasks run. |
| Requirement 4 | fixture foundation | T005 adds hybrid filesystem fixture plus adapter-fake coverage. | Surface-specific fixture assertions remain in T006/T007. |
| Requirement 5 | package scaffold only | Spec package created. | Durable promotion pending. |

## Correctness Property Coverage

| Property | Covered by | Evidence | Residual risk |
|----------|------------|----------|---------------|
| CP-001 | Contract/helper tests. | `response-metadata.test.ts` covers metadata/trust alignment. | MCP golden coverage remains in T006/T007. |
| CP-002 | Contract/helper and fixture tests. | Adapter-fake tests cover unsafe evidence states. | Surface minimum-evidence tests remain in T006/T007. |
| CP-003 | Scanner fixture test. | `file-catalog-scanner.test.ts` covers skipped and budget-truncated evidence. | Tool-level skipped-work summaries remain in T006/T007. |
| CP-004 | Pending verification-plan tests. | Pending. | None accepted yet. |

## Scope Reconciliation Before Closure

| Broad requirement, design target, or review finding | Implemented in this spec | Coverage state | Deferred or rejected work | Destination | Blocks closure? | Evidence |
|-----------------------------------------------------|--------------------------|----------------|---------------------------|-------------|-----------------|----------|
| First-read valid/stale/degraded/blocked behavior | helper foundation | partial | none | active spec | yes | T004 proves shared metadata/trust behavior. |
| Bounded skipped-work reporting | fixture foundation | partial | none | active spec | yes | T005 scanner fixture covers skipped and budget-truncated evidence. |
| Cold/stale/degraded/blocked fixtures | fixture/fake foundation | partial | none | active spec | yes | T005 combines filesystem fixture and adapter-fake state tests. |
| Durable docs promotion | package only | partial-blocking | implementation docs pending | active spec | yes | Pending. |

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
| T006 | pending | | |
| T007 | pending | | |
| T008 | pending | | |
| T009 | pending | | |
| T010 | pending | | |

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
| Requirements and accepted behavior | `docs/reference/runtime-contracts.md`, `docs/design/mcp-surface-design.md` | pending | |
| Technical design or architecture | `docs/design/runtime-operations-design.md`, `docs/design/graph-store-design.md` | pending | |
| Contracts, schemas, data flow, or integration behavior | `docs/reference/runtime-contracts.md` | pending | |
| Operational steps, rollout, validation, or recovery | `docs/design/runtime-operations-design.md`, optional runbook update if needed | pending | |
| Decisions and rationale | `docs/history/spec-closure-log.md` during closure | pending | |
| Follow-up work | `docs/backlog/README.md` or follow-up spec | pending | |

### Spec Cleanup Decision

- **Cleanup action:** keep active
- **Reason:** Implementation and durable promotion are pending.
- **Final spec commit:** pending
- **Closure log path:** `docs/history/spec-closure-log.md`
- **Closure log entry updated:** no
- **Closure cleanup commit:** pending
- **Active indexes updated:** no
- **Durable docs linked back to evidence where useful:** no
- **Residual spec-only content:** listed below

Residual spec-only content:

- All implementation decisions and validation evidence remain active-spec-only
  until tasks complete.

## Ship Or Closure Risk

- **Risk level:** medium
- **Breaking change:** no
- **Blast radius checked:** no
- **Rollback path:** not required yet
- **Requires human review:** yes
- **Release notes needed:** no
- **Follow-up issue or spec needed:** unknown

### Risk Rationale

This spec affects first-call trust across multiple public MCP surfaces. The
intended behavior is additive and clarifying, but careless implementation could
change response envelopes or agent decision-making broadly. The first
implementation slice is now narrowed to T004 helper/contract behavior; risk
remains medium until that behavior is fixture-backed and consumed by the
individual surfaces.

## Readiness Decision

- **Ready for promotion:** no
- **Ready for release:** no
- **Ready for closure:** no

## Related Artifacts

- Requirements: `requirements.md`
- Canonical Context: `canonical-context.md`
- Change Impact: `change-impact.md`
- Open Decisions: `open-decisions.md`
- Design: `design.md`
- Tasks: `tasks.md`
- Traceability: `traceability.md`
