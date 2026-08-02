---
title: Production documentation corpus isolation and governing-owner priority tasks
doc_type: spec
artifact_type: tasks
status: draft
owner: platform
last_reviewed: 2026-08-02
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Tasks

**Input:** All artifacts in this Spec 052 package.

**Prerequisites:** Requirements, design, research, canonical context, change
impact, traceability, and verification plan must be read together.

## Task Dependency Graph

```text
T001 -> T002 -> T003 -> T004
T004 -> T005 -> T006
T006 -> T007 -> T008 -> T009
```

## Phase 1: Readiness And Contract Baseline

- [x] T001 Reconcile and review the package for implementation readiness.
  - Depends on: none
  - Requirements: Requirement 1, Requirement 2, Requirement 3, Requirement 4,
    Requirement 5, Requirement 6
  - Files: this Spec 052 package, EB064, current source/contracts/tests
  - Acceptance: lifecycle lint, requirements/design trace review, task-state
    audit, and architecture/migration review have no unresolved blocker.
  - Evidence mode: validation
  - Evidence: 2026-08-02 `lint_spec_package` returned 0 errors and 0 warnings; `reconcile_spec` returned no findings or blind spots after the requirements/QA, architecture, and persistence/operations MoE review findings were incorporated.

  - Status: Readiness review completed before implementation; downstream tasks are now implemented and validated.
- [x] T002 Confirm the exact corpus receipt and migration seam.
  - Depends on: T001
  - Requirements: Requirement 1, Requirement 2, Requirement 4
  - Properties: CP-003, CP-006, CP-007
  - Files: `src/contracts/runtime-docs-contracts.ts`,
    `src/contracts/runtime-response-contracts.ts`, `src/ports/index.ts`,
    `src/infrastructure/sqlite/graph-store.ts`, `design.md`
  - Acceptance: the existing docs `IndexCoverage` row additively carries
    `documentation_corpus_policy_version`, `policy_excluded_files`, and bounded
    `policy_exclusions`; public receipts expose discovered/eligible/excluded
    conservation; `documentation_concern_owners` is rebuilt transactionally for
    `excluded` plus `exclusion_reason` and no document identity; readiness reads
    snapshot-bound docs coverage before candidate work; v1 universes are
    removed by the same migration; the existing public `ranking_unavailable`
    result carries a ranking-readiness receipt with `recovery: refresh`; no
    EB059 capacity decision, distinct fallback, or alternate blocker is added.
  - Evidence mode: validation
  - Evidence: `pnpm typecheck` passed; `tests/contracts/docs-ranking-contracts.test.ts`, `tests/graph/docs-ranked-universe-store.test.ts`, `tests/mcp/docs-status-recovery.test.ts`, and `tests/runtime/status.test.ts` passed in the focused and full runs.

  - Status: Implemented and validated.
## Phase 2: Corpus Policy And Admission

- [x] T003 Implement the shared repository-relative documentation corpus policy
  and its invariant tests.
  - Depends on: T002
  - Requirements: Requirement 1
  - Properties: CP-001, CP-002, CP-007
  - Files: `src/domain/policies/documentation-corpus.ts`,
    `src/domain/policies/index.ts`, `tests/docs/documentation-corpus-policy.test.ts`
  - Acceptance: stable `embedded_fixture` exclusion, root relativity, invalid
    path handling, excluded-owner decision, and deterministic partition/count
    behavior pass without reading content or using absolute paths.
  - Evidence mode: validation
  - Evidence: `tests/docs/documentation-corpus-policy.test.ts` passed, covering `production-docs-v1`, deterministic `embedded_fixture` exclusion, root relativity, invalid paths, and count conservation.

  - Status: Implemented and validated.
- [x] T004 Apply the shared policy to snapshot indexing and
  `docs_current_for_task` before content reads or scoring.
  - Depends on: T003
  - Requirements: Requirement 1, Requirement 2, Requirement 5
  - Properties: CP-002, CP-003, CP-007
  - Files: `src/application/use-cases/index-repository-graph.ts`,
    `src/application/use-cases/document-currency-routing.ts`,
    `src/application/use-cases/current-docs-for-task.ts`,
    `src/application/use-cases/query-docs.ts`, selected docs fixtures,
    `tests/graph/extraction-pipeline.test.ts`,
    `tests/docs/current-docs-for-task.test.ts`,
    `tests/docs/query-docs.test.ts`, documentation-concern, and MCP surface tests
  - Acceptance: embedded fixture docs are absent in the containing repo, an
    exact mapped excluded owner records state/reason without document identity,
    the same fixture is present when selected as root, snapshot/live task/live
    overview-map surfaces agree, and an excluded-content read trap is never
    invoked.
  - Evidence mode: validation
  - Evidence: `tests/graph/extraction-pipeline.test.ts`, `tests/docs/current-docs-for-task.test.ts`, `tests/docs/query-docs.test.ts`, and `tests/mcp/docs-surfaces.test.ts` passed, including containing-root, selected-root, excluded-owner, and read-trap assertions.

  - Status: Implemented and validated.
## Phase 3: Contracts, Store, Readiness, And Ranking

- [x] T005 Persist corpus-policy identity and truthful bounded coverage.
  - Depends on: T004
  - Requirements: Requirement 2, Requirement 4
  - Properties: CP-003, CP-006
  - Files: runtime docs/response contracts, ports,
    `src/application/use-cases/documentation-ranking-readiness.ts`,
    `src/application/use-cases/query-docs.ts`, graph store, store migrations,
    contract/store/readiness/query tests
  - Acceptance: current policy/counts round-trip, old/missing identity blocks
    with refresh, map-less current-policy repositories remain non-blocking,
    exclusions expose stable aggregate reason only, and migrations are
    transactional.
  - Evidence mode: validation
  - Evidence: `tests/graph/docs-ranked-universe-store.test.ts`, `tests/mcp/docs-status-recovery.test.ts`, `tests/mcp/repo-status-resource.test.ts`, and `tests/runtime/status.test.ts` passed, including persisted empty-corpus coverage and current/missing/mismatched/map-less policy states.

  - Status: Implemented and validated.
- [x] T006 Implement exact-concern governing-owner priority and v2 ranked
  universe identity.
  - Depends on: T005
  - Requirements: Requirement 3, Requirement 4
  - Properties: CP-004, CP-005, CP-007
  - Files: `src/domain/policies/docs-ranking.ts`, runtime docs contracts,
    `src/application/use-cases/query-docs.ts`, graph store, ranking tests
  - Acceptance: public `governing_owner_priority` makes canonical/current valid
    owner precedence inspectable; multiple/invalid/excluded owner cases remain
    truthful and deterministic; policy reasons match comparison; old
    universes/cursors cannot cross into v2.
  - Evidence mode: validation
  - Evidence: `tests/docs/docs-ranking-policy.test.ts`, `tests/docs/docs-ranking-pagination.test.ts`, `tests/mcp/docs-ranking-tool.test.ts`, and `tests/presentation/docs-ranking-presenter.test.ts` passed for `authority-aware-v2`, owner-priority permutations, v1 invalidation, pagination, cursor, and presentation behavior.

  - Status: Implemented and validated.
## Phase 4: Cross-Surface Acceptance

- [x] T007 Add the production-repository, fixture-root, SessionStart, count,
  leakage, and migration regressions.
  - Depends on: T006
  - Requirements: Requirement 5
  - Properties: CP-001 through CP-007
  - Files: selected/new docs fixture, docs policy/query/ranking tests,
    graph/store tests, MCP docs tool/surface tests
  - Acceptance: every Requirement 5 criterion has a named automated assertion;
    generated candidate permutations cover owner dominance and determinism
    without adding a new property-test dependency.
  - Evidence mode: validation
  - Evidence: Named corpus, leakage, owner, SessionStart, count, status, store, migration, MCP, and pagination regressions pass in the focused Spec 052 suite.

  - Status: Implemented and validated.
- [x] T008 Run focused and full validation, then perform bounded dogfood.
  - Depends on: T007
  - Requirements: Requirement 1 through Requirement 5
  - Files: `verification.md`, implementation and test files
  - Acceptance: typecheck, focused tests, full suite with bounded workers,
    plugin/package gates, exact SessionStart dogfood, direct count inspection,
    and target-worktree checks pass or retain truthful blocking evidence.
  - Evidence mode: validation
  - Evidence: Validation passed: pnpm typecheck; 109-file full Vitest suite with maxWorkers=4 (1211 tests); plugin validation; package dry-run; git diff --check. Checkout-copy dogfood blocked truthfully on refresh worker deadline and is recorded without acceptance overclaim.

  - Status: Implemented and validated.
## Phase 5: Promotion, Review, And Closure Readiness

- [x] T009 Promote accepted behavior and address final review findings.
  - Depends on: T008
  - Requirements: Requirement 6
  - Files: all durable targets in `change-impact.md`, this package
  - Acceptance: durable docs describe current implemented behavior; EB064 is
    delivered; EB059/EB065 remain separate; review findings are fixed, rejected
    with rationale, or routed; verification has no partial-blocking/not-covered
    requirement; closure check passes before package removal.
  - Evidence mode: validation
  - Evidence: `git diff --check`, `pnpm validate:plugin`, and `pnpm pack:dry-run` passed after the nine `change-impact.md` durable owners were updated; final architecture MoE reported no actionable defect, and the QA status-fixture plus zero-document regressions pass in the 1,211-test full suite.

  - Status: Implementation and promotion complete; package intentionally remains active and unclosed.
## Execution Rules

- Do not implement from this file alone.
- Mark exactly one implementation task `[~]` before changing source.
- Do not introduce query-time filtering, alternate ranking, parser/semantic
  fallback, partial success, arbitrary corpus cap, or automatic retry.
- Preserve unrelated work and keep MCP adapters thin.
- Record concrete commands/results before marking any task complete.
- Before closure, reconcile every requirement/property and promote all lasting
  behavior to durable owners.

## Related Artifacts

- Requirements: `requirements.md`
- Change Impact: `change-impact.md`
- Design: `design.md`
- Verification: `verification.md`
