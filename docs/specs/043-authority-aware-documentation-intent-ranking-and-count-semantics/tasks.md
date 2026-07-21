---
title: Authority-aware documentation intent ranking and count semantics tasks
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
T001 -> T002 -> T003 -> T004 -> T005 -> T006 -> T007 -> T008 -> T009 -> T010
```

Phase 1 contract and failing-proof tasks are complete. Each remaining task is
one reviewable implementation or lifecycle boundary; do not combine them into
one ranking change.

## Phase 1: Contracts And Failing Proof

- [x] T001 Lock concern, rank, cursor, count, trust, and compatibility contracts.
  - Depends on: none
  - Requirements: Requirement 1, Requirement 2, Requirement 3, Requirement 4;
    CP-001-CP-008
  - Acceptance criteria: AC1.1, AC1.2, AC1.3, AC1.4, AC1.5, AC1.6,
    AC1.7, AC1.8, AC1.9, AC2.1, AC2.2, AC2.3, AC2.4, AC2.5, AC2.6,
    AC3.1, AC3.2, AC3.3, AC3.4, AC3.5, AC3.6, AC4.1, AC4.2, AC4.3,
    AC4.4, AC4.5, AC4.6, AC4.7, AC4.8
  - Files: `src/contracts/runtime-docs-contracts.ts`, `src/ports/index.ts`,
    `tests/contracts/docs-ranking-contracts.test.ts`
  - Acceptance: Contracts fix normalization/match evidence, exact tuple and
    versions, 500/501 behavior, cursor identity, exact count/filter names,
    legacy aggregate `score`, optional `lexical_score`, candidate-source union,
    strict per-count `query_filter_basis`, page filter basis, exact-versus-501
    overflow receipts, blocker invariants, and trust states. Consumer tests prove
    response order/tuple is authoritative and legacy `score` meaning is stable.
  - Evidence mode: command
  - Evidence: Implemented additive versioned ranking, concern, owner, tuple, cursor, count/filter, overflow, unavailable-trust, candidate-query, cursor-codec, and frozen-universe contracts without changing legacy DocsIndexPort/public requirements. V001 passed 11 tests; runtime contract barrel passed 17 tests; pnpm typecheck and git diff --check passed. Parent review corrected query-level concern matches versus hit-specific ownership, and regressions prove unrelated owners cannot alter the hit tier.

- [x] T002 Add stable fixtures and failing example/property proofs.
  - Depends on: T001
  - Requirements: Requirement 1, Requirement 2, Requirement 3, Requirement 4;
    CP-001-CP-008
  - Acceptance criteria: AC1.1, AC1.2, AC1.3, AC1.4, AC1.5, AC1.6,
    AC1.7, AC1.8, AC1.9, AC2.1, AC2.2, AC2.3, AC2.4, AC2.5, AC2.6,
    AC3.1, AC3.2, AC3.3, AC3.4, AC3.5, AC3.6, AC4.1, AC4.2, AC4.3,
    AC4.4, AC4.5, AC4.6, AC4.7, AC4.8
  - Files: `tests/fixtures/fixture-docs-authority-ranking/`,
    `tests/docs/documentation-concern-routing.test.ts`,
    `tests/docs/docs-ranking-policy.test.ts`, and
    `tests/docs/docs-ranking-pagination.test.ts`
  - Acceptance: Fixtures contain SessionStart owner/supporting documents,
    explicit terms, multi/no-match/tie cases, draft/archived/missing/conflicting
    and one-to-many owners, out-of-priority Markdown, partial priority scan,
    and deterministic 0/499/500/501 distinct candidate unions. Boundary sets
    cover both an owner at FTS row 501 and an owner-only document that becomes
    distinct union row 501; both expect blockers, not incomplete results.
  - Evidence mode: command
  - Evidence: Phase 1 fixture and red-proof delivery complete: compact 13-document authority fixture; normalization, concern-routing, ranking, count/filter, 0/499/500/501 and cursor/expiry oracles; 15 ordinary fixture tests plus 9 expected-failure proofs passed. Combined Phase 1 focused suite passed 43 ordinary tests plus 9 expected failures; pnpm typecheck and git diff --check passed. Independent review blockers were corrected by scenario-specific candidate identities and complete source preconditions.

  - Status: Phase 1 complete; Phase 2 is recorded below.
## Phase 2: Snapshot Ownership

- [x] T003 Extract and publish documentation-map ownership with graph snapshots.
  - Depends on: T002
  - Requirements: Requirement 1, Requirement 2; CP-002
  - Acceptance criteria: AC1.1, AC2.1, AC2.4, AC2.5
  - Files: `src/application/use-cases/index-repository-graph.ts`,
    `src/application/use-cases/document-currency-routing.ts`,
    `src/debug/mcp-tool-sweep.ts`,
    `src/domain/policies/document-concern.ts`,
    `src/domain/policies/index.ts`,
    `src/infrastructure/filesystem/workspace-file.ts`,
    `src/infrastructure/sqlite/graph-store.ts`,
    `src/infrastructure/sqlite/graph-store-location.ts`,
    `src/infrastructure/workers/startup-graph-warmup-worker.ts`,
    `src/ports/index.ts`,
    `tests/docs/documentation-concern-routing.test.ts`,
    `tests/graph/extraction-pipeline.test.ts`,
    `tests/graph/documentation-map-indexing.test.ts`,
    `tests/graph/documentation-owner-publication.test.ts`,
    `tests/graph/store.test.ts`, `tests/mcp/debug-harness.test.ts`,
    `tests/mcp/repo-status-resource.test.ts`, and
    `tests/mcp/stdio-entrypoint.test.ts`
  - Acceptance: Shared normalization and exact term extraction populate
    concern/term/owner relations; one-to-many ownership is lossless; schema
    v2-to-v3 store migration, incompatible-old-snapshot handling, coordinated
    current-snapshot rebuild, atomic publication, failed-build isolation, and
    exhaustive extracted and persisted owner-state classification pass.
    Query-time broad map reads are absent; ranking-tier and caveat mapping
    remains owned by T004.
  - Evidence mode: command
  - Evidence: Delivered graph identity/schema v3, migration-before-publication with rollback-safe failure cleanup, bounded exact documentation-map and owner extraction, snapshot-scoped concern/term/owner state, production startup/debug wiring, and resolved independent review findings. V002 passed 11 tests; V006 passed 50 tests; V007 passed 6 tests; production-path integration passed 51 tests; pnpm typecheck passed; full suite passed 94 files with 933 tests plus 8 expected failures; git diff --check passed.

  - Status: Phase 2 complete; T004-T005 completed in Phase 3.
## Phase 3: Pure Ranking And Frozen Pagination

- [x] T004 Implement pure concern resolution and deterministic ranking policy.
  - Depends on: T003
  - Requirements: Requirement 1, Requirement 2, Requirement 4; CP-001-CP-003,
    CP-007-CP-008
  - Acceptance criteria: AC1.2, AC1.3, AC1.4, AC1.5, AC1.6, AC1.7,
    AC1.8, AC1.9, AC2.1, AC2.2, AC2.3, AC2.4, AC2.6, AC4.1, AC4.2,
    AC4.8
  - Files: `src/domain/policies/document-concern.ts`,
    `src/domain/policies/docs-ranking.ts`,
    `tests/docs/documentation-concern-routing.test.ts`,
    `tests/docs/docs-ranking-policy.test.ts`
  - Acceptance: Exact phrase/token, multi/no-match/tie, FTS/owner candidate
    source, `intent_owner_match` band, exhaustive owner tiers/caveats, tuple,
    legacy aggregate score compatibility, optional FTS-only lexical score, and
    reasons are deterministic; modules are pure and have no SQLite, workspace,
    or presenter dependency.
  - Evidence mode: command
  - Evidence: Pure exact concern resolution and deterministic authority-aware ranking implemented, including ordinal Unicode-safe identity ordering and exhaustive production tuple coverage. V002 passed 14/14; V003 passed 12/12; V007 passed 6/6; typecheck, full suite 95 files/966 tests, and git diff --check passed. Independent Phase 3 review found no remaining T004 blocker.

  - Status: T004 complete and independently reviewed; T005 is complete.
- [x] T005 Persist complete ranked universes and page only frozen order.
  - Depends on: T004
  - Requirements: Requirement 3; CP-004-CP-005
  - Acceptance criteria: AC1.9, AC3.1, AC3.2, AC3.3, AC3.4, AC3.5,
    AC3.6, AC4.3, AC4.5
  - Files: `src/application/use-cases/query-docs.ts`, `src/ports/index.ts`,
    `src/infrastructure/sqlite/graph-store.ts`,
    `tests/docs/docs-ranking-pagination.test.ts`,
    `tests/graph/docs-ranked-universe-store.test.ts`
  - Acceptance: SQLite retrieves at most 501 FTS rows and at most 501 distinct
    matched-owner document IDs once, without page offset; exact matched owners
    load from the same snapshot; stable-ID deduplication precedes the
    cap; 0-500 distinct union results freeze before first output; union row 501
    blocks with zero hits/cursor; continuation reads the stored universe only.
    Example and property tests vary source overlap, owner-only candidates, page
    size, cursor position, equal rank components, and insertion order and prove
    stable total order, concatenation equivalence, no duplicates/omissions,
    expiry, identity rejection, and 499/500/501 boundaries.
  - Evidence mode: command
  - Evidence: Implemented internal ranked-search orchestration, complete concern evidence retrieval, separately bounded 501-row FTS/owner candidate sources, stable-ID union, immutable snapshot/query/scope/policy-bound SQLite universes, literal scope filtering, canonical expiry, cardinality validation, and continuation from persisted state only. V001 passed 11/11; V005 passed 31/31; V006 passed 50/50; V007 passed 6/6; V008 selected and passed 6/6; typecheck and full suite 95 files/966 tests passed; git diff --check passed. Independent Phase 3 review found no remaining T005 code or architecture blocker.

  - Status: Phase 3 complete; T006 public presentation and production wiring is next.
## Phase 4: Presentation And Trust

- [ ] T006 Present rank, compatibility, counts, filters, and trust receipts.
  - Depends on: T005
  - Requirements: Requirement 2, Requirement 4; CP-002, CP-006-CP-008
  - Acceptance criteria: AC2.1, AC2.2, AC2.3, AC2.4, AC2.6, AC4.1,
    AC4.2, AC4.3, AC4.4, AC4.5, AC4.6, AC4.7, AC4.8
  - Files: `src/presentation/docs-presenter.ts`,
    `src/application/use-cases/query-docs.ts`,
    `src/contracts/runtime-docs-contracts.ts`,
    `src/interface-adapters/mcp/registries/tools/docs-search.ts`,
    `tests/presentation/docs-ranking-presenter.test.ts`,
    `tests/mcp/docs-ranking-tool.test.ts`
  - Acceptance: Presenter preserves final order, legacy aggregate `score`, and
    `lexical_score`; emits exact tuple/reasons/source-count/page-filter names and
    compatibility aliases; compresses caveats; and returns structured
    overflow/expired/unavailable trust without ranking logic in presenter or
    thin MCP adapter.
  - Evidence mode: command
  - Evidence: Pending.

## Phase 5: Verification, Installation, And Lifecycle

- [ ] T007 Run focused, property, full, architecture, and budget validation.
  - Depends on: T006
  - Requirements: Requirement 1, Requirement 2, Requirement 3, Requirement 4;
    CP-001-CP-008
  - Acceptance criteria: AC1.1, AC1.2, AC1.3, AC1.4, AC1.5, AC1.6,
    AC1.7, AC1.8, AC1.9, AC2.1, AC2.2, AC2.3, AC2.4, AC2.5, AC2.6,
    AC3.1, AC3.2, AC3.3, AC3.4, AC3.5, AC3.6, AC4.1, AC4.2, AC4.3,
    AC4.4, AC4.5, AC4.6, AC4.7, AC4.8
  - Files: `verification.md`
  - Acceptance: V001-V010 pass and evidence records seeds/runs for property
    tests, 499/500/501 budgets, architecture boundaries, typecheck, full suite,
    plugin/skill validation, and package dry-run.
  - Evidence mode: command
  - Evidence: Pending.

- [ ] T008 Prove the exact packed artifact through installed-package smoke.
  - Depends on: T007
  - Requirements: Requirement 1, Requirement 2, Requirement 3, Requirement 4;
    SC-001-SC-004
  - Acceptance criteria: AC1.1, AC1.2, AC1.3, AC1.4, AC1.5, AC1.6,
    AC1.7, AC1.8, AC1.9, AC2.1, AC2.2, AC2.3, AC2.4, AC2.5, AC2.6,
    AC3.1, AC3.2, AC3.3, AC3.4, AC3.5, AC3.6, AC4.1, AC4.2, AC4.3,
    AC4.4, AC4.5, AC4.6, AC4.7, AC4.8
  - Files: `scripts/ci/installed-package-mcp-smoke.mjs`, `verification.md`
  - Acceptance: V011 packs the current checkout, installs that tarball into an
    isolated prefix/cache/home, launches only its resolved installed bin, and
    exercises SessionStart rank, candidate union, tuple/legacy score/lexical
    score, counts, page filter, cursor equivalence, and both provider identities.
    The JSON receipt records tarball/package hashes,
    version, installed realpath, snapshot/universe/policy IDs, stable hit paths,
    counts, provider identities, and cleanup. It proves clients closed, daemon
    stopped, socket/metadata removed, and all temp roots removed on pass/fail.
  - Evidence mode: command
  - Evidence: Pending.

- [ ] T009 Promote durable contracts and pass documentation/expert gates.
  - Depends on: T008
  - Requirements: Requirement 1, Requirement 2, Requirement 3, Requirement 4;
    SC-004
  - Acceptance criteria: AC1.1, AC1.2, AC1.3, AC1.4, AC1.5, AC1.6,
    AC1.7, AC1.8, AC1.9, AC2.1, AC2.2, AC2.3, AC2.4, AC2.5, AC2.6,
    AC3.1, AC3.2, AC3.3, AC3.4, AC3.5, AC3.6, AC4.1, AC4.2, AC4.3,
    AC4.4, AC4.5, AC4.6, AC4.7, AC4.8
  - Files: all durable promotion targets, `verification.md`, `traceability.md`
  - Acceptance: V012-V016 pass separately: lifecycle package lint, bounded
    Markdown set/link check, promotion-plan review, architecture/code review,
    documentation-governance/lifecycle review, and review disposition. Lasting
    concern schema, ranking, cursor, count, trust, and compatibility behavior is
    promoted; no current behavior remains spec-only.
  - Evidence mode: artifact
  - Evidence: Pending.

- [ ] T010 Reconcile closure and archive metadata.
  - Depends on: T009
  - Requirements: Requirement 1, Requirement 2, Requirement 3, Requirement 4;
    SC-004
  - Acceptance criteria: AC1.1, AC1.2, AC1.3, AC1.4, AC1.5, AC1.6,
    AC1.7, AC1.8, AC1.9, AC2.1, AC2.2, AC2.3, AC2.4, AC2.5, AC2.6,
    AC3.1, AC3.2, AC3.3, AC3.4, AC3.5, AC3.6, AC4.1, AC4.2, AC4.3,
    AC4.4, AC4.5, AC4.6, AC4.7, AC4.8
  - Files: EB054, agent-readable changelog, closure log, archive index,
    `traceability.md`, `verification.md`
  - Acceptance: V017-V019 separately prove closure check, archive-index/closure
    consistency, and final lifecycle readiness. Every criterion and finding has
    evidence or an owned non-blocking destination; implementation and cleanup
    commit identities are truthful before the package is archived/removed.
  - Evidence mode: artifact
  - Evidence: Pending.

## Execution Rules

- Read the complete package and canonical context before implementation.
- Keep SQLite retrieval/storage, pure policy, orchestration, presentation, and
  MCP adapter responsibilities in their declared layers.
- Do not add embeddings, broad per-query map reads, unbounded scans, hidden
  fallbacks, partial results after overflow, status promotion, or cursor rebuild.
- Do not change fixed contract decisions inside an implementation task; revise
  and re-review this package first if evidence makes one infeasible.
- Update traceability and verification with every scope or evidence change.

## Related Artifacts

- Requirements: `requirements.md`
- Design: `design.md`
- Traceability: `traceability.md`
- Verification: `verification.md`
