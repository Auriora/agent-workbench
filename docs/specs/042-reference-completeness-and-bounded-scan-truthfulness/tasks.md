---
title: Reference completeness and bounded-scan truthfulness tasks
doc_type: spec
artifact_type: tasks
status: draft
owner: platform
last_reviewed: 2026-07-21
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

- [x] T001 Lock route completeness, evidence-universe, accounting, cursor, and
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
  - Evidence: V001 passed on 2026-07-21 (three contract files, 49 tests),
    `pnpm typecheck` passed, and focused daemon-launch tests remained green.
    Canonical schemas reject false completeness and contradictory accounting;
    authenticated scan/result/composite cursors reject tampering and expire
    across key epochs. Composition inspection proves the daemon constructs one
    codec in shared repository services; cross-client cursor use remains a
    Phase 2 behavioral assertion.

- [x] T002 Add reference-completeness boundary fixtures.
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
  - Evidence: V002 Phase 1 fixture portion passed with two files, 30 tests, and
    five explicit Phase 2 todos; V005 passed with three characterization tests
    and five explicit Phase 2 todos. The fixture proves 9 early plus 3 row-101
    occurrences, same-line collapse, and named missing, oversized, unreadable,
    changed, and policy-excluded boundary configuration without shell search.

## Phase 2: Route And Scanner Implementation

- [x] T003 Make parser-route completeness explicit.
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
  - Evidence: V002 passed on 2026-07-21 (two files, 35 tests). Every parser
    page asserts the limit-plus-one request, all three routes in their fixed
    order, offsets, exhaustion flags, cursor transition, and terminal
    no-cursor state. Storage tests prove identity deduplication occurs before
    deterministic `LIMIT/OFFSET` pagination.

- [x] T004 Implement file-atomic lexical scanning and evidence classification.
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
  - Evidence: V002, V005, and V008 passed on 2026-07-21 (35, 7, and 15
    tests). Named missing, stat/read failure, oversized, changed, unknown skip,
    policy exclusion, read-policy refusal, time, file, byte, and result cases
    prove atomic progress and exact failed-candidate versus exclusion accounting.

- [x] T005 Implement deterministic scan and result pagination.
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
    structurally bounded ordered-evidence, progress, and non-time-accounting
    stability without requiring elapsed-accounting or opaque-token equality;
    live time-bound replay may stop at
    a different safe file boundary while remaining truthful partial evidence.
    Identity, ordinal, counter, route-state, and tag tampering are rejected, and
    a prior-daemon key epoch returns `cursor_expired` without restarting.
  - Evidence mode: implementation
  - Evidence: V006 passed on 2026-07-21 (one file, 22 tests). Seeded and named
    cases prove concatenation, order, structural-bound evidence/progress and
    non-time-accounting stability, exact
    scan/result accounting, authenticated identity mismatch and tamper
    rejection, changed/deleted result replay blocking, and key-epoch expiry.
    V008's Phase 4 regression separately proves that scheduling-dependent live
    time stops remain partial, accounted, and non-complete.

- [x] T006 Integrate canonical accounting and MCP presentation.
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
  - Evidence: V003 passed on 2026-07-21 (three files, 38 tests). A real mixed
    scan/result sequence is presented through the public envelope and every
    page/sequence counter, count, language, cursor, truncation, and coverage
    field reconciles to independently calculated constants.

- [x] T007 Calibrate complete, partial, blocked, stale, and invalid trust.
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
  - Evidence: V004 passed on 2026-07-21 (one file, 16 tests), with V003 proving
    the exact presented continuation is callable through the registered MCP
    tool. Feature-sensitive goldens cover complete, parser partial, lexical
    partial, candidate blocked, policy excluded, stale, invalid-cursor, and
    expired-cursor envelopes.

## Phase 3: Verification

- [x] T008 Run focused contract, route, scanner, property, and MCP validation.
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
  - Evidence: Phase 3 rerun on 2026-07-21 passed V001-V006 and V008 exactly: 50, 35, 38, 16, 7, 22, and 15 tests respectively. V008 directly proves monotonic file-admission timing, file/declared-byte/result bounds, post-read actual-byte observation, and classified-failure progress without fallback.

- [x] T009 Implement installed provider-plugin smoke coverage.
  - Depends on: T007
  - Requirements: Requirement 4; CP-001, CP-005
  - Files: `scripts/ci/installed-provider-plugin-smoke.mjs`,
    `tests/integration/installed-provider-plugin-smoke.test.ts`,
    `verification.md`
  - Acceptance: Isolated Codex and Claude commands install the packed `0.6.1`
    artifact, verify provider plugin manifests, MCP launcher, skill/hook files,
    reported runtime/provider-plugin version, and a reference query, then prove
    client processes, daemon/socket metadata, install roots, and temporary
    roots were removed. The test distinguishes real CLI execution from
    provider-labelled MCP sessions.
  - Evidence mode: implementation
  - Evidence: Implemented isolated installed-provider verification with direct Codex app-server JSON-RPC evidence and Claude stream-json correlation. Focused coverage passes 37/37 plus node syntax, typecheck, and whitespace checks; it proves exact installed artifacts and versions, fresh snapshot convergence, exact 12-occurrence one-based-line/zero-based-column oracle, callable continuation handling, bounded provider discovery, credential isolation/redaction, protocol failures, and process/daemon/socket/install cleanup. Live V011 and V012 passed against Codex CLI 0.144.6 and Claude Code 2.1.216 with package/runtime/plugin 0.6.1; final gate evidence is recorded under T010.

- [x] T010 Run repository and installed-package gates.
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
  - Evidence: V007 passed typecheck and 88 files/884 tests. V009 passed plugin validation, six owned skill checks, and the 242-entry package dry-run. V010 passed installed package 0.6.1 convergence, queries, and cleanup. Final V011 and V012 passed against real Codex CLI 0.144.6 and Claude Code 2.1.216: both installed the packed 0.6.1 plugin, reported runtime/provider-plugin 0.6.1, returned the exact 12-reference one-based-line/zero-based-column occurrence oracle, and passed all nine cleanup checks. The provider harness passes 37/37 focused tests, node syntax, typecheck, and whitespace validation.

## Phase 4: Review, Promotion, And Closure

- [x] T011 Run lifecycle lint, Markdown/link validation, and expert review.
  - Depends on: T008, T010
  - Requirements: Requirement 1, Requirement 2, Requirement 3, Requirement 4;
    CP-001, CP-002, CP-003, CP-004, CP-005, CP-006, CP-007, CP-008, CP-009,
    CP-010, CP-011
  - Files: all Spec 042 artifacts, `verification.md`,
    `review-disposition.md`
  - Acceptance: Dedicated lifecycle package lint, bounded Markdown/link check,
    task-state/evidence audit, and fresh post-implementation architecture,
    contracts, QA, trust, and lifecycle/spec reviews pass. T011 reviews the
    implemented work and active spec package only; the completed promotion diff
    is reviewed later under T012/V016. The completed authoring review is retained
    as separate evidence, every new finding has an explicit resolved, accepted,
    or routed disposition, and blockers are zero before promotion.
  - Evidence mode: validation
  - Evidence: V013 lifecycle lint passed with zero diagnostics. V014 checked all eight spec artifacts individually: zero skipped/errors, 223 table-readability advisories only, none truncated. V015 fresh architecture, requirements/QA, lifecycle/evidence, and security/operations review resolved six blockers and four warnings with zero remaining. Post-remediation typecheck and full Vitest passed with 88 files and 887 tests.

- [x] T012 Promote durable behavior and review the promotion diff.
  - Depends on: T011
  - Requirements: Requirement 1, Requirement 2, Requirement 3, Requirement 4
  - Files: all durable promotion targets, `traceability.md`, `verification.md`,
    EB053
  - Acceptance: Lasting contract/design/proof text is promoted, the scoped Git
    diff between spec claims and each canonical owner receives fresh expert and
    evidence review, every resulting finding is disposed, EB053 is reconciled,
    and no current behavior remains spec-only.
  - Evidence mode: validation
  - Evidence: Promoted all nine durable owners and reconciled EB053 delivery state. V016 post-promotion architecture/contracts, QA/trust, and lifecycle/evidence reviews resolved four blockers with zero remaining blockers or warnings. pnpm typecheck, 16 focused reference-budget tests, durable-doc checks, and git diff --check passed; no current behavior remains spec-only.

- [x] T013 Close and archive with dedicated lifecycle gates.
  - Depends on: T012
  - Requirements: Requirement 1, Requirement 2, Requirement 3, Requirement 4
  - Files: `docs/history/spec-closure-log.md`,
    `docs/history/spec-archive-index.md`, Spec 042 package, `verification.md`
  - Acceptance: Closure check has no blockers, every requirement and task has
    verified evidence, closure metadata names implementation and cleanup state,
    archive-index validation passes after the chosen package disposition, and
    no unresolved partial evidence is hidden by archive status.
  - Evidence mode: validation
  - Evidence: All four must-have requirements are reconciled complete with no residual destination; T001-T012 and V001-V016 are complete; all nine durable owners are promoted. V017 then passed ready with zero blockers and zero lifecycle diagnostics. Final package lint is clean, all eight spec documents were checked with zero skips and only pre-existing table-readability advisories, and the removed-package/archive action is prepared for V018.

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
