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
| Requirements acceptance criteria reviewed | yes | pending | Draft requirements created from EB003. |
| Task evidence complete | yes | partial | T001-T003 complete; implementation tasks pending. |
| Automated tests pass or alternate verification recorded | yes | pending | No implementation validation yet. |
| Durable documentation updates identified | yes | pending | `change-impact.md` identifies targets. |
| Durable documentation promoted or explicitly deferred | yes | pending | Not started. |
| Spec cleanup decision recorded | yes | pending | Not ready for closure. |
| Governance or policy conflicts resolved | yes | partial | D001-D003 approved; no Phase 1 blockers remain. |

## Validation Commands

| Command | Purpose | Result | Evidence |
|---------|---------|--------|----------|
| `git diff --check -- docs/specs/037-first-read-reliability-bounded-tools` | Markdown and whitespace sanity for spec artifacts. | passed | 2026-07-10: no whitespace errors. |
| `pnpm exec vitest run tests/docs/docs-links-metadata.test.ts` | Documentation metadata/link regression after spec creation. | passed | 2026-07-10: 1 file, 2 tests passed. |
| `pnpm typecheck` | TypeScript contract/use-case validation after implementation. | pending | Required after code changes. |
| `pnpm test` | Full regression before closure. | pending | Required before closure unless waived with residual risk. |

## Requirement Coverage

| Requirement | Acceptance criteria covered | Evidence | Residual risk |
|-------------|-----------------------------|----------|---------------|
| Requirement 1 | planning only | T002 selected existing response fields; T004 adds helper tests. | EB024 only for a proven field gap. |
| Requirement 2 | planning only | T003 selects T004 before surface work. | Skipped-work shape may vary by surface until T006/T007. |
| Requirement 3 | planning only | Minimum evidence contract recorded in `design.md`. | Existing tools may still differ until hardening tasks run. |
| Requirement 4 | none yet | Pending fixture design. | D002 approves hybrid filesystem fixtures and adapter fakes. |
| Requirement 5 | package scaffold only | Spec package created. | Durable promotion pending. |

## Correctness Property Coverage

| Property | Covered by | Evidence | Residual risk |
|----------|------------|----------|---------------|
| CP-001 | Pending contract/MCP tests. | Pending. | None accepted yet. |
| CP-002 | Pending failure-mode tests. | Pending. | None accepted yet. |
| CP-003 | Pending skipped-work tests. | Pending. | None accepted yet. |
| CP-004 | Pending verification-plan tests. | Pending. | None accepted yet. |

## Scope Reconciliation Before Closure

| Broad requirement, design target, or review finding | Implemented in this spec | Coverage state | Deferred or rejected work | Destination | Blocks closure? | Evidence |
|-----------------------------------------------------|--------------------------|----------------|---------------------------|-------------|-----------------|----------|
| First-read valid/stale/degraded/blocked behavior | Phase 1 reconciliation only | not-covered | none | active spec | yes | T002 found existing fields sufficient; T004 must prove helper behavior. |
| Bounded skipped-work reporting | none yet | not-covered | none | active spec | yes | Pending. |
| Cold/stale/degraded/blocked fixtures | none yet | not-covered | none | active spec | yes | Pending. |
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
| T001 | complete | Spec package scaffolded on 2026-07-09; package lint and docs validation recorded on 2026-07-10. | Implementation pending. |
| T002 | complete | 2026-07-10: inspected runtime contracts, response metadata helpers, repo status/scope/overview, task context, docs query, diagnostics, and verification planning. Existing public response fields cover the first slice; no EB024 prerequisite found. | Implementation coverage still pending. |
| T003 | complete | 2026-07-10: selected T004 as the first implementation slice and recorded the minimum evidence contract in `design.md`. | T004 should prove helper/contract behavior before broader first-read surface hardening. |
| T004 | pending | | |
| T005 | pending | | |
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
