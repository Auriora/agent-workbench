---
title: Ranked documentation readiness and first-read trust tasks
doc_type: spec
artifact_type: tasks
status: draft
owner: platform
last_reviewed: 2026-07-21
---

# Tasks

**Input:** All artifacts in this package; do not implement from this file alone.

## Task Dependency Graph

```text
T001 -> T002 -> T003 -> T004 -> T005 -> T006 -> T007
```

## Phase 1: Immediate Recovery And Regression Guard

- [x] T001 Repair and prove the repository documentation concern map.
  - Depends on: none
  - Requirements: Requirement 1 AC1-AC3
  - Files: `docs/reference/documentation-map.md`,
    `docs/reference/dogfood-evidence-ledger.md`
  - Acceptance: The ADR collection remains navigable but no directory is
    declared as a canonical owner; the oversized backlog owner is explicitly
    navigation-only pending T002; production extraction is complete.
  - Evidence mode: implementation
  - Evidence: Map and ledger edits are present; production extraction returned
    `state: complete` with 58 concerns, 72 terms, and 60 owners. The daemon's
    inability to republish this worktree is recorded in T001.3; installed live
    acceptance is intentionally assigned to T006 after implementation.
  - [x] T001.1 Move the ADR directory out of the canonical-owner table while
    preserving its navigation link and file-only authoring rule.
    - Evidence: `docs/reference/documentation-map.md` now treats `docs/adr/` as
      a navigation collection rather than one owner document.
  - [x] T001.2 Run the production concern extractor against the worktree map.
    - Evidence: The exact command and worktree identity are recorded under
      `verification.md#production-extractor-command`; it returned
      `state: complete`, 58 concerns, 72 terms, and 60 owners. The first run
      also discovered the oversized backlog owner blocker assigned to T002.
  - [x] T001.3 Record the current daemon as awaiting reload; live publication
    and query acceptance belong to T006 after the contract repair.
    - Evidence: Current daemon retained startup snapshot `1784657587477` and
      exposes no workspace watcher, so direct worktree extraction is the
      bounded Phase 1 proof.

- [x] T002 Add the repository-real concern-map regression and phase checkpoint.
  - Depends on: T001
  - Requirements: Requirement 1 AC1-AC6, SC-001
  - Files: `tests/docs/documentation-concern-routing.test.ts` or one focused
    repository-contract test and `docs/reference/mvp-proof-matrix.md`
  - Acceptance: The repository-real map candidate is passed through the
    production extractor; a directory-owner fixture fails with the exact
    bounded reason.
  - Validation: focused Vitest, Markdown checks, `git diff --check`.
  - Evidence mode: command
  - Evidence: Phase 1 complete: production extraction of the restored
    repository-real worktree candidate returned complete with 59 concerns, 73
    terms, and 61 owners, including the backlog as draft. Focused concern
    routing passed 26/26; typecheck, docs metadata, Markdown non-table checks,
    and diff check passed. One earlier full run had an intermittent daemon
    freshness failure whose exact suite passed 15/15 without establishing root
    cause; the final full rerun passed all 1006 tests.
  - [x] T002.1 Add a test that extracts the repository-real map through the
    production use case.
    - Evidence: Production extractor regression against the repository-real
      worktree candidate returned complete with 59 concerns, 73 terms, 61
      owners, no failure reason, and `docs/backlog/README.md` classified draft.
    - Evidence mode: command
  - [x] T002.2 Add a fixture proving directory owners fail with the bounded
    `Mapped owner is not a file` reason.
    - Evidence: Focused Vitest proves a directory owner returns the exact
      bounded reason `Mapped owner is not a file: docs/reference/owner.md.`
    - Evidence mode: command
  - [x] T002.3 Implement bounded metadata classification for already-indexed
    large owners with the normative 16,384-byte protocol, without raising the
    whole-file limit or adding a second read route.
    - Evidence: `src/application/use-cases/document-currency-routing.ts` admits
      only `MAX_DOCUMENTATION_OWNER_METADATA_BYTES` (16,384) through
      `utf8Prefix` before classification; focused Vitest passed 26/26 boundary
      and large-owner tests.
    - Evidence mode: command
  - [x] T002.4 Restore the product backlog canonical-owner row and prove both
    its owner state and the complete concern index.
    - Evidence: `docs/reference/documentation-map.md` restores Product backlog
      as a canonical owner; production extraction classified
      `docs/backlog/README.md` as draft within a complete concern index.
    - Evidence mode: command
  - [x] T002.5 Run and record focused validation.
    - Evidence: Focused Vitest passed 26/26; `pnpm typecheck` passed; docs link
      metadata passed 2/2; Markdown checks had no non-table findings; and
      `git diff --check` passed. An earlier full run reached 1004/1005 with one
      intermittent daemon freshness failure; its exact suite passed 15/15, and
      the final full `pnpm test` rerun passed 1006/1006.
    - Evidence mode: command
  - [x] T002.6 Promote the repository-real proof gate to
    `docs/reference/mvp-proof-matrix.md`.
    - Evidence: `docs/reference/mvp-proof-matrix.md` now records the
      repository-real map fixture and documentation concern extraction pass gate, including
      large-owner and metadata-boundary evidence.
    - Evidence mode: artifact

## Phase 2: Snapshot-Bound Readiness Contract

- [ ] T003 Add ranking-readiness contracts and status assembly.
  - Depends on: T002
  - Requirements: Requirement 2 AC1-AC6, CP-001
  - Files: `src/contracts/`, `src/application/use-cases/get-repo-status.ts`,
    status presenter/resource composition, store/status tests
  - Acceptance: Ready, invalid, unavailable, recovery category, bounded reason,
    and exact snapshot identity are exposed without a broad scan.
  - Evidence mode: implementation
  - Evidence: Pending.
  - [ ] T003.1 Add the canonical readiness contract and schemas.
  - [ ] T003.2 Wire the selected-snapshot concern state through status assembly
    and presentation without querying from an adapter.
  - [ ] T003.3 Add table-driven coverage for `complete`, `no_map`, every
    ready `invalid`, every unavailable reason, store failure,
    status/orientation trust projection, recovery kind, docs-search behavior,
    and cross-snapshot cases.
  - [ ] T003.4 Prove public reasons use shared presentation redaction and stay
    within 512 UTF-8 bytes for absolute-path, traversal, and secret-like input.

## Phase 3: First-Read Trust And Recovery

- [ ] T004 Make orientation consume ranking readiness truthfully.
  - Depends on: T003
  - Requirements: Requirement 3 AC1-AC2, CP-002, CP-003
  - Files: orientation use case/contracts/presenter and tests
  - Acceptance: Blocked ranking makes orientation non-reusable; source repair
    does not set refresh-only guidance; refreshable state still schedules the
    existing coordinator.
  - Evidence mode: implementation
  - Evidence: Pending.

- [ ] T005 Align `docs_search` recovery with status evidence.
  - Depends on: T004
  - Requirements: Requirement 3 AC3, SC-002, SC-003
  - Files: docs query/presenter/MCP integration tests and status resource tests
  - Acceptance: Executing the emitted status next action exposes the same
    snapshot readiness category and useful recovery boundary.
  - Evidence mode: implementation
  - Evidence: Pending.

## Phase 4: Cross-Client Acceptance

- [ ] T006 Prove published-snapshot and installed-client behavior.
  - Depends on: T005
  - Requirements: Requirement 4 AC1-AC4, CP-001, SC-004
  - Files: daemon/MCP integration tests, `verification.md`, dogfood ledger
  - Acceptance: A fresh published snapshot is ranking-ready; SessionStart
    intent search returns the governing design on page one; Codex and Claude
    Code execute the pinned request and agree on the required fields.
  - Validation: focused tests, full CI gates, repo-local package install, client reload.
  - Evidence mode: validation
  - Evidence: Pending.
  - [ ] T006.1 Prove one published-snapshot status/orientation/docs-search chain
    through daemon and MCP integration tests using the request and comparison
    contract in `verification.md#cross-client-acceptance-payload`.
  - [ ] T006.2 Install and reload the repo-local package for Codex acceptance.
  - [ ] T006.3 Install and reload the repo-local package for Claude Code acceptance.

## Phase 5: Promotion, Review, And Closure

- [ ] T007 Promote durable behavior, address review, and close the spec.
  - Depends on: T006
  - Requirements: all
  - Files: durable targets named in `change-impact.md`, `verification.md`,
    backlog and closure records
  - Acceptance: All requirements/properties have evidence; durable docs match
    behavior; EB059 and EB061 remain separately routed; lifecycle closure has
    no blockers.
  - Validation: full suite, plugin/skills/package gates, lifecycle lint,
    evidence quality, task audit, closure risk and closure check.
  - Evidence mode: validation
  - Evidence: Pending.
  - Scope boundary: Preserve EB059 and EB061 as separate backlog destinations; do
    not implement them through this task.
  - [ ] T007.1 Promote accepted contracts and operational behavior to every
    durable target in `change-impact.md`.
  - [ ] T007.2 Run independent implementation review and all required gates,
    then address or route every finding.
  - [ ] T007.3 Reconcile coverage, record closure evidence, and remove the
    active package under repository policy.

## Execution Rules

- Mark one task in progress before implementation and record exact evidence.
- Keep MCP adapters thin and inject readiness through application ports.
- Do not add broad scanning, shell search, retry loops, or alternate ranking paths.
- Do not implement EB059 or EB061 inside this package.
