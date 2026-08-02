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
  - Evidence: 2026-08-02: lifecycle package lint returned 0 errors/warnings; task_details and traceability_lookup resolved exact Requirement 1-6 context for T001 and Requirement 2/4 for T002 with no gaps; task-state audit had info-only broad-task advisories; independent senior readiness re-review confirmed B1-B3 and W1-W2 resolved with no remaining blocker or warning.

  - Status: Spec package reviewed and ready for the T002 contract/migration seam; source implementation has not started.
- [ ] T002 Confirm the exact corpus receipt and migration seam.
  - Depends on: T001
  - Requirements: Requirement 2, Requirement 4
  - Files: `src/contracts/runtime-docs-contracts.ts`,
    `src/contracts/runtime-response-contracts.ts`, `src/ports/index.ts`,
    `src/infrastructure/sqlite/graph-store.ts`, `design.md`
  - Acceptance: one additive corpus-policy identity/aggregate representation,
    exact count equations, v2 universe migration, and stale-policy blocker are
    documented with no EB059 capacity decision or fallback.
  - Evidence mode: contract
  - Evidence: Pending.

## Phase 2: Corpus Policy And Admission

- [ ] T003 Implement the shared repository-relative documentation corpus policy
  and its invariant tests.
  - Depends on: T002
  - Requirements: Requirement 1
  - Properties: CP-001, CP-002, CP-007
  - Files: `src/domain/policies/documentation-corpus.ts`,
    `src/domain/policies/index.ts`, `tests/docs/documentation-corpus-policy.test.ts`
  - Acceptance: stable `embedded_fixture` exclusion, root relativity, invalid
    path handling, excluded-owner decision, and deterministic partition/count
    behavior pass without reading content or using absolute paths.
  - Evidence mode: implementation
  - Evidence: Pending.

- [ ] T004 Apply the shared policy to snapshot indexing and
  `docs_current_for_task` before content reads or scoring.
  - Depends on: T003
  - Requirements: Requirement 1, Requirement 2, Requirement 5
  - Properties: CP-002, CP-003, CP-007
  - Files: `src/application/use-cases/index-repository-graph.ts`,
    `src/application/use-cases/document-currency-routing.ts`,
    `src/application/use-cases/current-docs-for-task.ts`, selected docs fixtures,
    `tests/graph/extraction-pipeline.test.ts`, documentation-concern,
    current-doc, and MCP surface tests
  - Acceptance: embedded fixture docs are absent in the containing repo, an
    exact mapped excluded owner records state/reason without document identity,
    the same fixture is present when selected as root, both surfaces agree, and
    an excluded-content read trap is never invoked.
  - Evidence mode: implementation
  - Evidence: Pending.

## Phase 3: Contracts, Store, Readiness, And Ranking

- [ ] T005 Persist corpus-policy identity and truthful bounded coverage.
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
  - Evidence mode: implementation
  - Evidence: Pending.

- [ ] T006 Implement exact-concern governing-owner priority and v2 ranked
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
  - Evidence mode: implementation
  - Evidence: Pending.

## Phase 4: Cross-Surface Acceptance

- [ ] T007 Add the production-repository, fixture-root, SessionStart, count,
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
  - Evidence: Pending.

- [ ] T008 Run focused and full validation, then perform bounded dogfood.
  - Depends on: T007
  - Requirements: Requirement 1 through Requirement 5
  - Files: `verification.md`, implementation and test files
  - Acceptance: typecheck, focused tests, full suite with bounded workers,
    plugin/package gates, exact SessionStart dogfood, direct count inspection,
    and target-worktree checks pass or retain truthful blocking evidence.
  - Evidence mode: validation
  - Evidence: Pending.

## Phase 5: Promotion, Review, And Closure Readiness

- [ ] T009 Promote accepted behavior and address final review findings.
  - Depends on: T008
  - Requirements: Requirement 6
  - Files: all durable targets in `change-impact.md`, this package
  - Acceptance: durable docs describe current implemented behavior; EB064 is
    delivered; EB059/EB065 remain separate; review findings are fixed, rejected
    with rationale, or routed; verification has no partial-blocking/not-covered
    requirement; closure check passes before package removal.
  - Evidence mode: validation
  - Evidence: Pending.

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
