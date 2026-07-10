---
title: First-read reliability and bounded tools verification
doc_type: spec
artifact_type: verification
status: draft
owner: platform
last_reviewed: 2026-07-09
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Verification

## Scope

This verification record covers Spec 037 from backlog promotion through
implementation, durable promotion, and closure readiness. The current state is
spec creation only; implementation evidence is pending.

## Quality Gates

| Gate | Required? | Status | Evidence |
|------|-----------|--------|----------|
| Requirements acceptance criteria reviewed | yes | pending | Draft requirements created from EB003. |
| Task evidence complete | yes | pending | T001 scaffolded; implementation tasks pending. |
| Automated tests pass or alternate verification recorded | yes | pending | No implementation validation yet. |
| Durable documentation updates identified | yes | pending | `change-impact.md` identifies targets. |
| Durable documentation promoted or explicitly deferred | yes | pending | Not started. |
| Spec cleanup decision recorded | yes | pending | Not ready for closure. |
| Governance or policy conflicts resolved | yes | pending | Open decisions remain. |

## Validation Commands

| Command | Purpose | Result | Evidence |
|---------|---------|--------|----------|
| `git diff --check` | Markdown and whitespace sanity for spec artifacts. | pending | Run after package creation. |
| `pnpm exec vitest run tests/docs/docs-links-metadata.test.ts` | Documentation metadata/link regression after spec creation. | pending | Run after package creation or docs promotion. |
| `pnpm typecheck` | TypeScript contract/use-case validation after implementation. | pending | Required after code changes. |
| `pnpm test` | Full regression before closure. | pending | Required before closure unless waived with residual risk. |

## Requirement Coverage

| Requirement | Acceptance criteria covered | Evidence | Residual risk |
|-------------|-----------------------------|----------|---------------|
| Requirement 1 | none yet | Pending implementation. | First-read vocabulary may need EB024. |
| Requirement 2 | none yet | Pending implementation. | Skipped-work shape may vary by surface. |
| Requirement 3 | none yet | Pending implementation. | Existing tools may already return partial data differently. |
| Requirement 4 | none yet | Pending fixture design. | Some blocked states may require adapter fakes. |
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
| First-read valid/stale/degraded/blocked behavior | none yet | not-covered | none | active spec | yes | Pending. |
| Bounded skipped-work reporting | none yet | not-covered | none | active spec | yes | Pending. |
| Cold/stale/degraded/blocked fixtures | none yet | not-covered | none | active spec | yes | Pending. |
| Durable docs promotion | package only | partial-blocking | implementation docs pending | active spec | yes | Pending. |

## Agent Readiness Evidence

| Field | Evidence | Residual risk |
|-------|----------|---------------|
| Scope and out-of-scope files | Scope spans first-read use cases, contracts, runtime/graph/docs helpers, and durable docs. Out of scope: command execution and fallback parser/semantic paths. | First slice must be narrowed before coding. |
| Must-read and optional context | Must read `requirements.md`, `design.md`, `traceability.md`, `change-impact.md`, and relevant durable docs before implementation. | Current code may narrow the selected first slice. |
| Permissions and approval points | Local repo edits and tests are normal. Network/publishing not needed. | Daemon/socket tests may require unrestricted environment. |
| Validation commands and expected signals | Focused Vitest slices, `pnpm typecheck`, full `pnpm test`, docs metadata/link tests. | Native/sandbox constraints must be recorded if encountered. |
| Review needs | Contract and MCP output behavior should be reviewed before broad rollout. | Golden output churn risk. |
| Durable-doc or closure impact | Durable promotion required before closure. | Active spec must not be removed until promoted. |
| Optional repo-evidence provider caveats | MCP index can be stale for removed spec packages; direct filesystem verification is required. | Record stale MCP evidence as caveat, not blocker. |

## Task Evidence

| Task ID | Status | Evidence | Notes |
|---------|--------|----------|-------|
| T001 | complete | Spec package scaffolded on 2026-07-09. | Validation pending. |
| T002 | pending | | |
| T003 | pending | | |
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

## Manual Or External Verification

None yet.

## Residual Risks

- The existing response-state vocabulary may be sufficient but must be
  confirmed before introducing new enum values.
- Fixture design may need adapter fakes to avoid flaky timing or daemon-state
  tests.
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
change response envelopes or agent decision-making broadly. The risk remains
medium until the first implementation slice is narrowed and fixture-backed.

## Readiness Decision

- **Ready for promotion:** no
- **Ready for release:** no
- **Ready for closure:** no

## Related Artifacts

- Requirements: `requirements.md`
- Canonical Context: `canonical-context.md`
- Change Impact: `change-impact.md`
- Design: `design.md`
- Tasks: `tasks.md`
- Traceability: `traceability.md`
