---
title: Git submodule repository support tasks
doc_type: spec
artifact_type: tasks
status: draft
owner: platform
last_reviewed: 2026-08-04
---

# Tasks

**Input:** `requirements.md`, `canonical-context.md`, `design.md`,
`change-impact.md`, `traceability.md`, and `verification.md`.

**Implementation constraint:** All target-repository behavior is bounded and
read-only. No task may initialize, update, fetch, clone, repair, mutate, or
execute build/test commands in a submodule. There is one Git metadata path and
no fallback implementation.

## Task Dependency Graph

```text
T001 -> T002 -> T003 -> T004 -> T005
T005 -> T006 -> T007
T007 -> T008
T007 -> T009
T008 + T009 -> T010 -> T011 -> T012 -> T013 -> T014
Spec 057 T001-T009 complete and verified ------------> T009
```

## Phase 1: Safe repository-composition foundation

- [ ] T001 Settle the additive repository contract and single bounded Git
  command seam.
  - Depends on: none
  - Requirements: Requirement 2, Requirement 4, Requirement 6, Requirement 7
  - Properties: CP-002, CP-005
  - Files: `src/ports/index.ts`, `src/contracts/`,
    `src/infrastructure/commands/`, focused contract and command tests
  - Acceptance: Repository keys, lineage, states, revisions, cleanliness,
    blockers, limits, aggregate claims, and optional public references are
    representable. Source review identifies and evolves one shared runner with
    timeout, cancellation, byte caps, defined environment, structured argv,
    redaction, and no shell/stdin. Existing Git history moves to that seam if
    required; no parallel or compatibility runner remains.
  - Validation: Run focused contract/runner tests and `pnpm typecheck`.
  - Evidence mode: contract
  - Evidence: Pending.
  - [ ] T001.1 Define the smallest additive repository-composition contract.
  - [ ] T001.2 Harden the canonical runner and migrate existing Git history.
  - [ ] T001.3 Prove bounds, cancellation, environment, redaction, and rejected
    arbitrary arguments.

- [ ] T002 Implement the fixed read-only Git metadata adapter.
  - Depends on: T001
  - Requirements: Requirement 2, Requirement 6, Requirement 7
  - Properties: CP-004, CP-005
  - Files: `src/infrastructure/commands/`, `src/ports/index.ts`, focused adapter
    tests
  - Acceptance: Semantic operations return bounded HEAD/index gitlinks, local
    HEAD, and cleanliness receipts using only the approved local argv set.
    Git absence, malformed output, deadline, cancellation, and output overflow
    are structured blockers. URLs, hooks, remotes, writes, arbitrary argv, and
    success-shaped inference are absent.
  - Validation: Run exact-argv, parser, failure, process, network, and write-spy
    tests.
  - Evidence mode: implementation
  - Evidence: Pending.

- [ ] T003 Implement declaration/gitlink reconciliation and the state model.
  - Depends on: T002
  - Requirements: Requirement 1, Requirement 2, Requirement 7, Requirement 8
  - Properties: CP-001, CP-003, CP-004
  - Files: repository-composition application/domain modules and fixtures,
    focused truth-table/property tests
  - Acceptance: Bounded `.gitmodules` paths reconcile deterministically with
    committed and index gitlinks into initialized, uninitialized, mismatch,
    metadata-unavailable, declaration-only, orphan, and path-blocked states.
    Detached pinned HEAD is normal. URLs are ignored. Duplicate, absolute,
    escaping, symlink-escaping, and conflicting paths never traverse.
  - Validation: Run state truth-table, evidence-permutation, containment, and
    malformed-input tests.
  - Evidence mode: implementation
  - Evidence: Pending.

- [ ] T004 Implement recursive discovery, lineage, budgets, and cycle guards.
  - Depends on: T003
  - Requirements: Requirement 1, Requirement 3, Requirement 7
  - Properties: CP-001, CP-003, CP-004, CP-007
  - Files: repository-composition use case, recursive fixtures and property
    tests
  - Acceptance: Declared initialized descendants inherit read scope without a
    prompt; stable traversal preserves parent/child identity under shared
    depth, repository, file, byte, deadline, and output budgets. Cycles and
    limits identify skipped work; blocked descendants do not erase sibling or
    ancestor evidence and never appear complete.
  - Validation: Run recursive, bound, cycle, order, and sibling-isolation tests.
  - Evidence mode: implementation
  - Evidence: Pending.

- [ ] T005 Checkpoint - validate the repository-composition foundation.
  - Depends on: T004
  - Requirements: Requirement 1, Requirement 2, Requirement 3, Requirement 6,
    Requirement 7, Requirement 8
  - Properties: CP-001, CP-003, CP-004, CP-005, CP-007
  - Files: T001-T004 implementation, fixtures, tests, `verification.md`
  - Acceptance: Contract, runner, Git adapter, state, authority, recursion,
    confinement, non-mutation, no-network, determinism, and limit evidence is
    recorded before scanner and storage integration.
  - Validation: Run the T001-T004 focused suite and `pnpm typecheck`.
  - Evidence mode: validation
  - Evidence: Pending.

## Phase 2: Catalog and snapshot composition

- [ ] T006 Add the evidence-aware declared-submodule path-policy exception.
  - Depends on: T005
  - Requirements: Requirement 1, Requirement 7, Requirement 8
  - Properties: CP-001, CP-004, CP-005
  - Files: `src/domain/policies/path-policy.ts`, workspace-safety tests
  - Acceptance: Only a contained, declared, gitlink-backed, initialized child
    with an admitted composition receipt can be read. Unrelated nested repos
    keep `nested_git_repository` refusal and every nested-repo write remains
    refused. The policy performs no Git or process operation itself.
  - Validation: Run declared/unrelated/read/write/escape policy tests.
  - Evidence mode: implementation
  - Evidence: Pending.

- [ ] T007 Federate catalog scanning across admitted repository units.
  - Depends on: T006
  - Requirements: Requirement 1, Requirement 3, Requirement 4, Requirement 8
  - Properties: CP-001-CP-005, CP-007
  - Files: `src/infrastructure/filesystem/file-catalog-scanner.ts`, scanner
    fixtures and tests
  - Acceptance: Each available child is scanned under its own canonical root
    and ignore evidence, then paths are prefixed into one superproject-relative
    namespace. Shared bounds remain explicit. Scanner code does not invoke Git,
    infer submodules, cross containment, or weaken unrelated-repo/write safety.
  - Validation: Run scanner federation, regression, bound, and mutation-spy
    tests.
  - Evidence mode: implementation
  - Evidence: Pending.

- [ ] T008 Persist composition receipts and make freshness composition-aware.
  - Depends on: T007
  - Requirements: Requirement 2, Requirement 4, Requirement 7, Requirement 8
  - Properties: CP-002, CP-003, CP-006
  - Files: snapshot contracts, `src/infrastructure/sqlite/graph-store.ts`,
    migrations, refresh/validity logic, storage tests
  - Acceptance: The normalized repository-unit table and composition
    fingerprint migrate safely, preserve lineage/states/claims, resolve longest
    path prefixes deterministically, and prevent watcher silence from claiming
    stale submodule composition is fresh. Old snapshots are not used for
    submodule-complete claims.
  - Validation: Run schema migration, round-trip, prefix, compatibility, and
    freshness tests.
  - Evidence mode: implementation
  - Evidence: Pending.

## Phase 3: Public evidence and validation planning

- [ ] T009 Integrate repository-scoped Spec 057 validation planning.
  - Depends on: T007
  - Upstream spec gate: Spec 057 T001-T009 complete and verified, including the
    project-unit contract, discovery, marker/readiness, planner integration,
    compatibility projection, and MCP golden evidence
  - Requirements: Requirement 4, Requirement 5, Requirement 7, Requirement 8
  - Properties: CP-002, CP-006, CP-007
  - Files: project-unit discovery/planner modules, validation contracts and
    focused tests
  - Acceptance: A selected submodule receives only its repository-local
    manifests, scripts, environment, and policies. Candidates retain repository
    and project-unit identity and remain `not_executed`. Unavailable or
    mismatched repositories block only dependent claims; parent/sibling or
    generic-command fallback is absent. Aggregation requires explicit evidence.
  - Validation: Run selected-submodule, sibling-isolation, mixed-state,
    aggregation, blocker, and no-execution tests.
  - Evidence mode: implementation
  - Evidence: Pending.

- [ ] T010 Expose bounded repository provenance across graph, docs, context,
  status, and MCP results.
  - Depends on: T008, T009
  - Requirements: Requirement 2, Requirement 4, Requirement 5, Requirement 7,
    Requirement 8
  - Properties: CP-002, CP-006, CP-007
  - Files: graph/docs/context query and presenter modules, thin MCP adapters,
    contracts, goldens
  - Acceptance: Submodule-origin evidence references one composition receipt;
    revision, cleanliness, freshness, skipped work, validation, and blockers
    stay repository-qualified. Aggregate success requires sufficient evidence
    from every requested repository. Payload bounds and compatibility are
    tested and absolute paths/URLs never appear.
  - Validation: Run cross-surface contracts, presenter tests, and MCP goldens.
  - Evidence mode: implementation
  - Evidence: Pending.

## Phase 4: Review, regression, promotion, and closure readiness

- [ ] T011 Resolve independent implementation-review findings.
  - Depends on: T010
  - Requirements: Requirement 1, Requirement 2, Requirement 3, Requirement 4,
    Requirement 5, Requirement 6, Requirement 7, Requirement 8
  - Properties: CP-001-CP-007
  - Files: all task-owned implementation, tests, fixtures, and contracts
  - Acceptance: Every finding is fixed, rejected with evidence, or routed to
    one explicit destination; no blocking safety, correctness, compatibility,
    storage, authority, or test finding remains.
  - Validation: Rerun all focused tests affected by review.
  - Evidence mode: validation
  - Evidence: Pending.

- [ ] T012 Run full repository, plugin, skill, and package validation.
  - Depends on: T011
  - Requirements: Requirement 1, Requirement 2, Requirement 3, Requirement 4,
    Requirement 5, Requirement 6, Requirement 7, Requirement 8
  - Properties: CP-001-CP-007
  - Files: all task-owned code, tests, fixtures, packages, and `verification.md`
  - Acceptance: Every command in `verification.md` passes or records an exact
    blocking root cause; process/network/write spies prove no prohibited target
    operation occurred.
  - Validation: Run and record the complete verification set.
  - Evidence mode: validation
  - Evidence: Pending.

- [ ] T013 Promote accepted contracts, safety, architecture, storage, and
  validation behavior to durable owners.
  - Depends on: T012
  - Requirements: Requirement 1, Requirement 2, Requirement 3, Requirement 4,
    Requirement 5, Requirement 6, Requirement 7, Requirement 8
  - Files: all promotion targets in `change-impact.md` and the active Spec 057
    package reconciliation artifacts named there
  - Acceptance: Durable documents describe only delivered behavior, including
    the no-prompt read exception, unrelated/write refusal, single bounded Git
    path, repository claims, storage/freshness, planning-only integration, and
    remaining non-goals. If Spec 057 is still active, its package receives an
    explicit Spec 058 supersession annotation for the initialized-submodule
    residual; if closed, the closure record and durable owners identify Spec
    058 as the successor. No two active authorities claim opposite behavior.
  - Validation: Check the explicit Markdown set and run docs tests.
  - Evidence mode: implementation
  - Evidence: Pending.

- [ ] T014 Reconcile scope and prepare closure evidence.
  - Depends on: T013
  - Requirements: Requirement 1, Requirement 2, Requirement 3, Requirement 4,
    Requirement 5, Requirement 6, Requirement 7, Requirement 8
  - Properties: CP-001-CP-007
  - Files: this package, promoted docs, lifecycle history/index artifacts
  - Acceptance: Every must-have criterion, correctness property, broad design
    target, review finding, and residual has an evidence-backed disposition;
    lifecycle closure checks have no unresolved blocker. Do not close until
    separately authorized.
  - Validation: Run package lint, coverage, evidence-quality, closure-risk, and
    cleanup checks.
  - Evidence mode: validation
  - Evidence: Pending.

## Execution Rules

- Use lifecycle task context before starting each task and mark only one task
  `[~]` at a time.
- Preserve one explicit implementation path. A failure is blocked/degraded
  evidence, never a retry, alternate parser, shell, or partial-success fallback.
- Fixture construction may use test-owned local Git repositories, but tests
  must assert no remote access, hooks, optional locks, target commands, or
  mutation during the behavior under test.
- Record commands, outcomes, changed files, limitations, and review findings in
  `verification.md`; a checked box without current evidence is incomplete.

## Related Artifacts

- Requirements: `requirements.md`
- Canonical Context: `canonical-context.md`
- Design: `design.md`
- Traceability: `traceability.md`
- Change Impact: `change-impact.md`
- Verification: `verification.md`
