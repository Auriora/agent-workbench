---
title: Reference completeness and bounded-scan truthfulness tasks
doc_type: spec
artifact_type: tasks
status: draft
owner: platform
last_reviewed: 2026-07-20
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Tasks

## Task Dependency Graph

```text
T001 -> T002 -> T003 -> T004 -> T005 -> T006 -> T007 -> T008
                                                T007 -> T009 -> T010
T008 + T010 -> T011 -> T012 -> T013
```

## Phase 1: Contract And Reproduction

- [ ] T001 Lock route completeness, evidence-universe, accounting, cursor, and
  trust contracts before implementation.
  - Depends on: none
  - Requirements: Requirement 1, Requirement 2, Requirement 3; CP-001, CP-002,
    CP-003, CP-004, CP-005, CP-006, CP-007, CP-008, CP-009, CP-010, CP-011
  - Files: `src/contracts/runtime-graph-contracts.ts`,
    `src/contracts/runtime-response-contracts.ts`, daemon cursor-key lifecycle
    and shared authenticated cursor module, `tests/contracts/`,
    `tests/contracts/reference-completeness.test.ts`
  - Acceptance: Tests reject a false-complete bounded scan, invalid cursor
    identity, unresolved searchable candidates, contradictory page/sequence
    accounting, incomplete language metadata, and complete trust without route
    exhaustion. Contracts distinguish scan, result, and composite parser
    cursors, authenticate every payload and accumulated counter, expire cursors
    after daemon key rotation, distinguish policy exclusions from fully
    classified unresolved candidates, and define every stop reason.
  - Evidence mode: contract
  - Evidence: Pending.

- [ ] T002 Add reference-completeness boundary fixtures.
  - Depends on: T001
  - Requirements: Requirement 4; CP-001, CP-002, CP-003, CP-006, CP-007,
    CP-008, CP-009, CP-011
  - Files: `tests/fixtures/fixture-reference-completeness/`,
    `tests/integration/reference-session-start.test.ts`,
    `tests/graph/reference-completeness.test.ts`
  - Acceptance: The fixture includes Claude and Codex hook twins plus three
    TypeScript integration-test consumers beyond the first catalog window; the
    current implementation fails for the intended completeness seam. Named
    cases cover two same-line occurrences, a missing indexed candidate after
    row 100, oversized, unreadable, missing, changed, and policy-excluded paths.
  - Evidence mode: contract
  - Evidence: Pending.

## Phase 2: Route And Scanner Implementation

- [ ] T003 Make parser-route completeness explicit.
  - Depends on: T002
  - Requirements: Requirement 1, Requirement 3, Requirement 4; CP-001, CP-003,
    CP-005, CP-010
  - Files: `src/application/use-cases/find-references.ts`,
    `src/contracts/runtime-graph-contracts.ts`,
    `tests/graph/reference-completeness.test.ts`
  - Acceptance: Incoming, outgoing, and unresolved routes use a limit-plus-one
    probe and one authenticated composite continuation. Zero, exact-limit,
    limit-plus-one, and multi-page cases have unambiguous complete/partial state;
    mixed routes drain outgoing, incoming, then unresolved with disjoint
    ownership and stable cross-page transitions. Complete requires all routes
    exhausted, and lexical scanning never follows non-empty parser evidence.
  - Evidence mode: implementation
  - Evidence: Pending.

- [ ] T004 Implement file-atomic lexical scanning and evidence classification.
  - Depends on: T003
  - Requirements: Requirement 1, Requirement 2, Requirement 3, Requirement 4;
    CP-001, CP-003, CP-004, CP-005, CP-006, CP-009, CP-011
  - Files: `src/application/use-cases/find-references.ts`, `src/ports/index.ts`,
    `tests/graph/reference-completeness.test.ts`
  - Acceptance: The scanner paginates the ordered catalog, classifies policy
    exclusions outside scope, retains searchable failures inside scope,
    prechecks declared size before a whole-file read, admits no new file after
    the monotonic deadline, and advances scan progress only after a fully
    inspected file or fully classified unresolved entry. Oversized, missing,
    unreadable, and changed entries advance exactly once, increment unresolved
    classification but not unique inspection, and missing row 101 cannot yield
    valid absence.
  - Evidence mode: implementation
  - Evidence: Pending.

- [ ] T005 Implement deterministic scan and result pagination.
  - Depends on: T004
  - Requirements: Requirement 2, Requirement 3, Requirement 4; CP-002, CP-003, CP-004,
    CP-006, CP-007, CP-008, CP-011
  - Files: `src/application/use-cases/find-references.ts`, shared cursor helper
    if needed, `tests/graph/reference-pagination.property.test.ts`
  - Acceptance: Scan cursors bind the last fully inspected or fully classified
    unresolved entry and contain no line/column progress. Result cursors replay
    one atomic file without
    advancing catalog progress or unique coverage. Seeded property cases prove
    concatenation equals a complete scan, stable ordering, no duplicates, and
    deterministic replay; identity, ordinal, counter, route-state, and tag
    tampering are rejected, and a prior-daemon key epoch returns
    `cursor_expired` without restarting.
  - Evidence mode: implementation
  - Evidence: Pending.

- [ ] T006 Integrate canonical accounting and MCP presentation.
  - Depends on: T005
  - Requirements: Requirement 1, Requirement 2, Requirement 3; CP-001,
    CP-003, CP-004, CP-005, CP-009, CP-010, CP-011
  - Files: `src/presentation/find-references-presenter.ts`, canonical contract
    and response metadata modules, `tests/mcp/reference-completeness.test.ts`,
    `tests/mcp/trust-golden.test.ts`
  - Acceptance: Public count, cursor, truncation, coverage, trust, and language
    fields agree for complete, partial, failed-candidate, replay, and invalid
    cases. Page/sequence bytes, unique files, attempts, replay reads,
    occurrences, exclusions, classified searchable candidates, and unresolved
    candidates reconcile exactly. Actual bytes are observed accounting rather
    than a claimed pre-read admission bound.
  - Evidence mode: implementation
  - Evidence: Pending.

- [ ] T007 Calibrate complete, partial, blocked, stale, and invalid trust.
  - Depends on: T006
  - Requirements: Requirement 1, Requirement 3; CP-001, CP-003, CP-005, CP-009
  - Files: canonical response metadata policy, presenter trust mapper,
    `tests/mcp/trust-golden.test.ts`,
    `tests/mcp/reference-completeness.test.ts`
  - Acceptance: Valid absence is possible only after route exhaustion with zero
    unresolved searchable candidates. Partial/blocked, stale, invalid-cursor,
    parser-pagination, and policy-exclusion envelopes have non-contradictory
    trust, caveat, truncation, and callable-next-action fields.
  - Evidence mode: implementation
  - Evidence: Pending.

## Phase 3: Verification

- [ ] T008 Run focused contract, route, scanner, property, and MCP validation.
  - Depends on: T007
  - Requirements: Requirement 1, Requirement 2, Requirement 3, Requirement 4;
    CP-001, CP-002, CP-003, CP-004, CP-005, CP-006, CP-007, CP-008, CP-009,
    CP-010, CP-011
  - Files: `verification.md`
  - Acceptance: V001-V006 and V008 pass and evidence records exact commands and
    results; query-budget evidence proves file-admission time, file,
    declared-byte, and result limits while checking actual-byte observation and
    classified-failure progress without a hidden retry or fallback.
  - Evidence mode: validation
  - Evidence: Pending.

- [ ] T009 Implement installed provider-plugin smoke coverage.
  - Depends on: T007
  - Requirements: Requirement 4; CP-001, CP-005
  - Files: `scripts/ci/installed-provider-plugin-smoke.mjs`,
    `tests/integration/installed-provider-plugin-smoke.test.ts`,
    `verification.md`
  - Acceptance: Isolated Codex and Claude commands install the packed `0.6.0`
    artifact, verify provider plugin manifests, MCP launcher, skill/hook files,
    reported runtime/provider-plugin version, and a reference query, then prove
    client processes, daemon/socket metadata, install roots, and temporary
    roots were removed. The test distinguishes real CLI execution from
    provider-labelled MCP sessions.
  - Evidence mode: implementation
  - Evidence: Pending.

- [ ] T010 Run repository and installed-package gates.
  - Depends on: T009
  - Requirements: Requirement 1, Requirement 2, Requirement 3, Requirement 4;
    CP-001, CP-002, CP-003, CP-004, CP-005, CP-006, CP-007, CP-008, CP-009,
    CP-010, CP-011
  - Files: `verification.md`
  - Acceptance: V007 and V009-V012 pass: typecheck, full tests, plugin and skill
    validation, package dry-run, package convergence smoke, and both real
    provider-plugin smokes. Any unavailable client is a blocking unrun gate,
    not a package-smoke substitute.
  - Evidence mode: validation
  - Evidence: Pending.

## Phase 4: Review, Promotion, And Closure

- [ ] T011 Run lifecycle lint, Markdown/link validation, and expert review.
  - Depends on: T008, T010
  - Requirements: Requirement 1, Requirement 2, Requirement 3, Requirement 4;
    CP-001, CP-002, CP-003, CP-004, CP-005, CP-006, CP-007, CP-008, CP-009,
    CP-010, CP-011
  - Files: all Spec 042 artifacts, `verification.md`,
    `review-disposition.md`
  - Acceptance: Dedicated lifecycle package lint, bounded Markdown/link check,
    task-state/evidence audit, and fresh post-implementation architecture,
    contracts, QA, and trust reviews pass. The completed authoring review is
    retained as separate evidence, every new finding has an explicit resolved,
    accepted, or routed disposition, and blockers are zero before promotion.
  - Evidence mode: validation
  - Evidence: Pending.

- [ ] T012 Promote durable behavior and review the promotion diff.
  - Depends on: T011
  - Requirements: Requirement 1, Requirement 2, Requirement 3, Requirement 4
  - Files: all durable promotion targets, `traceability.md`, `verification.md`,
    EB053
  - Acceptance: Lasting contract/design/proof text is promoted, the scoped Git
    diff between spec claims and each canonical owner is reviewed, EB053 is
    reconciled, and no current behavior remains spec-only.
  - Evidence mode: validation
  - Evidence: Pending.

- [ ] T013 Close and archive with dedicated lifecycle gates.
  - Depends on: T012
  - Requirements: Requirement 1, Requirement 2, Requirement 3, Requirement 4
  - Files: `docs/history/spec-closure-log.md`,
    `docs/history/spec-archive-index.md`, Spec 042 package, `verification.md`
  - Acceptance: Closure check has no blockers, every requirement and task has
    verified evidence, closure metadata names implementation and cleanup state,
    archive-index validation passes after the chosen package disposition, and
    no unresolved partial evidence is hidden by archive status.
  - Evidence mode: validation
  - Evidence: Pending.

## Execution Rules

- Read the full package and durable-source baseline before implementing a task.
- Mark only one coupled task in progress; parallel work requires disjoint file
  ownership.
- Do not satisfy acceptance with shell search, an alternate parser, an
  unbounded scan, a retry loop, or partial results presented as complete.
- Preserve the established bounded query latency target; completeness is
  delivered through honest continuation, not a larger unbounded first page.
- Update `traceability.md` and `verification.md` whenever task scope or evidence
  changes.

## Related Artifacts

- Requirements: `requirements.md`
- Change impact: `change-impact.md`
- Design: `design.md`
- Traceability: `traceability.md`
- Verification: `verification.md`
- Review disposition: `review-disposition.md`
