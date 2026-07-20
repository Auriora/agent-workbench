---
title: Daemon-owned refresh convergence tasks
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
T001 -> T002
T001 -> T003
T002 + T003 -> T004
T004 -> T005
T004 -> T006
T003 + T004 + T006 -> T007
T005 + T006 + T007 -> T008
T008 -> T009
```

Parent tasks group lifecycle sequencing; their child tasks are the exclusive
implementation handoff units with explicit files, acceptance, and evidence.
Select and delegate one child at a time unless file ownership is disjoint. Do
not combine parent tasks merely because they touch a shared composition file;
preserve dependency order and record overlap before parallel work.

## Phase 1: Contract And Reproduction

- [x] T001 Lock the failing lifecycle, publication, diagnostics, and recovery
  contracts before implementation.
  - Depends on: none
  - Requirements: Requirement 1, Requirement 2, Requirement 3, Requirement 4,
    Requirement 5, Requirement 6; Properties: CP-001-CP-009
  - Acceptance Criteria: AC1.1-AC1.6; AC2.1-AC2.6; AC3.1-AC3.6;
    AC4.1-AC4.6; AC5.1-AC5.6; AC6.1-AC6.6
  - Files: `tests/mcp/daemon-entrypoint-integration.test.ts`,
    `tests/mcp/daemon-launch.test.ts`, `tests/runtime/operations.test.ts`,
    `tests/runtime/workspace-change-queue.test.ts`, `tests/graph/store.test.ts`,
    `tests/helpers/spec041-refresh-reproductions.ts`,
    `src/ports/index.ts`, `src/contracts/runtime-integration-contracts.ts`
  - Acceptance: Deterministic barrier-controlled tests reproduce the stranded
    non-startup request, lost invalidation generation, partial replacement
    visibility, disconnect/idle race, synthetic diagnostics, bounded failure,
    and dead-owner recovery seams for the intended reason. Contract fixtures
    lock execution, publication, activity-lease, generation, diagnostics, and
    structured-failure shapes before production behavior changes.
  - Evidence mode: contract
  - Evidence: Phase 1 complete: typecheck passed; focused suites reported 58 ordinary passes and 16 intended expected failures; full suite reported 80 files, 640 passes, and 16 expected failures. Independent final review found no blockers or advisories. Detailed seams and mandatory factory replacement are recorded in `verification.md`.
  - Expected evidence: Record the focused failing commands and the intended
    failure seam for each fixture in `verification.md`.
  - Status: Phase 1 contract and reproduction gate complete. Phase 2 may begin with T002 and T003.
  - [x] T001.1 Lock controller generation, deadline, and retry-admission
    contracts in `tests/runtime/operations.test.ts`,
    `tests/helpers/spec041-refresh-reproductions.ts`, and `src/ports/index.ts`.
    - Acceptance: State, generation, worker-result, and activity-lease shapes
      fail before implementation for the intended contract mismatch.
    - Evidence mode: contract
    - Evidence: `pnpm typecheck` passed; operations and shared reproduction-factory fixtures lock canonical state, generation, finite deadline, one-result executor, activity lease, blocked ownership, retry admission, and deadline settlement. See `verification.md` Phase 1 Contract Receipt.
    - Status: Contract/reproduction complete; T002 replaces the shared deadline factory with production.
  - [x] T001.2 Lock publication, migration, and reader-visibility contracts in
    `tests/graph/store.test.ts` and `src/ports/index.ts`.
    - Acceptance: Building, published, superseded, failed, migrated, and
      explicit-id cases fail at the current non-atomic selection seam.
    - Evidence mode: command
    - Evidence: `pnpm exec vitest run tests/graph/store.test.ts` passed with guarded expected failures at publication, migration, explicit-id, future-schema, and orphan seams; see `verification.md` Phase 1 Contract Receipt.
    - Status: Contract/reproduction complete; T003 and T007 implement the locked behavior.
  - [x] T001.3 Lock diagnostics, trust, and redaction contracts in
    `tests/mcp/integration-health-contract.test.ts` and
    `src/contracts/runtime-integration-contracts.ts`.
    - Acceptance: Invalid state pairs, missing identities, false-success trust,
      and sentinel leakage are rejected by failing fixtures.
    - Evidence mode: command
    - Evidence: `pnpm exec vitest run tests/mcp/integration-health-contract.test.ts` passed the legal/illegal diagnostics matrix, code-owned safe messages, sentinel rejection, and false-success expected failure; see `verification.md` Phase 1 Contract Receipt.
    - Status: Contract/reproduction complete; T006 binds authoritative diagnostics to runtime presentation.
  - [x] T001.4 Lock daemon ownership, idle, disconnect, and crash reproductions
    in `tests/mcp/daemon-launch.test.ts` and
    `tests/mcp/daemon-entrypoint-integration.test.ts`.
    - Acceptance: Each fixture fails at its intended ownership/lifetime seam,
      not from generic provider or timing failure.
    - Evidence mode: command
    - Evidence: The focused daemon/source-entrypoint command passed with 19 ordinary tests and 4 intended expected failures, including the ordered real non-startup deleted-path request and explicit idle-lease decision; see `verification.md` Phase 1 Contract Receipt.

    - Status: Contract/reproduction complete; T004, T005, and T007 implement the locked behavior.
## Phase 2: Shared Execution And Publication

- [x] T002 Implement controller-owned invalidation generations and the sole
  bounded executor.
  - Depends on: T001
  - Requirements: Requirement 1, Requirement 4, Requirement 5, Requirement 6;
    Properties: CP-001, CP-004, CP-006-CP-007, CP-009
  - Acceptance Criteria: AC1.1-AC1.2, AC1.5-AC1.6; AC5.2-AC5.3,
    AC4.6; AC5.5-AC5.6; AC6.2-AC6.4, AC6.6
  - Files: `src/ports/index.ts`,
    `src/application/use-cases/coordinate-snapshot-refresh.ts`,
    `src/infrastructure/runtime/refresh-controller.ts`,
    `src/infrastructure/runtime/index.ts`, `tests/runtime/operations.test.ts`,
    `tests/helpers/spec041-refresh-reproductions.ts`
  - Acceptance: One controller linearizes requests, advances or joins monotonic
    invalidation generations, reuses planned/running execution, retains one
    coalesced newer generation, invokes only the existing bounded worker path,
    reaches exactly one terminal outcome, and never creates a timer- or
    callback-driven retry.
  - Evidence mode: implementation
  - Evidence: `pnpm typecheck` passed; the 12-file Phase 2 focused command reported 207 passes and 4 expected T004-T007 failures; `pnpm test` reported 80 files, 690 passes, and 9 expected later-phase failures. These fixtures exercise numeric allocation, linearized generations, reuse, sequential catch-up, finite one-result execution, generation-CAS publication, structured failures, exactly-once cleanup, and termination-unconfirmed no-overlap quarantine. Independent remediation re-review reported no Phase 2 blocker.
  - Expected evidence: Focused controller tests must record execution IDs,
    requested/started generations, worker invocation counts, terminal state,
    deadline behavior, and absence of automatic retry.
  - Status: Phase 2 T002 acceptance complete.
  - [x] T002.1 Implement linearized generation and state admission in
    `src/infrastructure/runtime/refresh-controller.ts` and `src/ports/index.ts`.
    - Acceptance: Concurrent requests reuse one execution and newer generations
      set one coalesced catch-up latch.
    - Evidence mode: implementation
    - Evidence: Implemented SnapshotRefreshController linearized admission with monotonic requested/started generations, planned/running reuse, one execution identity, and newest-generation sequential catch-up. `pnpm typecheck` and focused runtime tests passed.
  - Status: T002 child acceptance complete.
  - [x] T002.2 Implement the one-result worker protocol and finite deadline in
    `src/infrastructure/runtime/refresh-controller.ts`.
    - Acceptance: Success, timeout, error, non-zero exit, zero exit without a
      result, and invalid result each settle exactly once.
    - Evidence mode: implementation
    - Evidence: `pnpm exec vitest run tests/runtime/operations.test.ts tests/runtime/workspace-change-queue.test.ts` reported 41 passes and 3 expected later-phase failures. The passing cases cover timeout, rejection, synchronous launch failure, non-zero exit, missing/invalid/multiple/mismatched results, exactly-one termination, termination quarantine, and structured allocation/publication store failures.
  - Status: Phase 2 T002.2 acceptance complete.
  - [x] T002.3 Prove controller admission, deadline, and deterministic
    post-failure behavior in `tests/runtime/operations.test.ts`. Replace only
    the Phase 1 deadline reproduction in
    `tests/helpers/spec041-refresh-reproductions.ts` with the production
    controller and convert that expected failure to an ordinary passing test.
    The trigger-level catch-up reproduction remains owned by T005.3.
    - Acceptance: Barrier-controlled tests record one writer and no callback,
      timer, or health-read retry.
    - Evidence mode: validation
    - Evidence: `pnpm exec vitest run tests/runtime/operations.test.ts tests/runtime/workspace-change-queue.test.ts` reported 41 passes and 3 expected later-phase failures. The deadline reproduction now uses SnapshotRefreshController and proves admission, reuse, sequential catch-up, allocation/CAS classification, observer isolation, no overlapping successor, and no automatic retry; the one trigger-level catch-up expected failure remains owned by T005.3.

  - Status: Phase 2 T002.3 acceptance complete.
- [x] T003 Implement atomic publication and current-snapshot selection as a
  state distinct from freshness and coverage.
  - Depends on: T001
  - Requirements: Requirement 4, Requirement 5, Requirement 6; Properties:
    CP-004, CP-006, CP-008
  - Acceptance Criteria: AC4.1-AC4.6; AC5.3-AC5.5; AC6.4, AC6.6
  - Files: `src/ports/index.ts`,
    `src/application/use-cases/index-repository-graph.ts`,
    `src/infrastructure/sqlite/graph-store.ts`, `tests/graph/store.test.ts`,
    `tests/graph/extraction-pipeline.test.ts`
  - Acceptance: Building, published, superseded, and failed snapshot states are
    explicit. Ordinary latest selection exposes only the published snapshot;
    explicit reads of unpublished states are blocked; the publication transition
    makes all required graph/docs/FTS/coverage rows visible atomically; and
    failed or superseded builds leave the prior published snapshot selected.
    Publication does not imply complete evidence-class coverage.
  - Evidence mode: implementation
  - Evidence: `pnpm typecheck` passed; `pnpm exec vitest run tests/graph/store.test.ts tests/graph/extraction-pipeline.test.ts` reported 50 passes and 1 expected T007 orphan failure; `pnpm test` reported 80 files, 690 passes, and 9 expected later-phase failures. The passing cases cover migration, atomic build/publication, published-only lower/public reads, building-only evidence writes, generation CAS, partial coverage, cleanup, barriers, reopen, and retention. Independent remediation re-review reported no Phase 2 blocker.
  - Expected evidence: Barrier, concurrent-reader, reopen, interruption, and
    retention tests must identify visible and target snapshot IDs at every
    publication phase.
  - Status: Phase 2 T003 acceptance complete.
  - [x] T003.1 Add the transactional publication-state/schema migration in
    `src/infrastructure/sqlite/graph-store.ts`.
    - Acceptance: Existing non-refreshing rows become published, existing
      refreshing rows become failed, migration rollback is atomic, and the
      schema-version gate blocks older runtimes.
    - Evidence mode: implementation
    - Evidence: `pnpm exec vitest run tests/graph/store.test.ts tests/graph/extraction-pipeline.test.ts` reported 50 passes and 1 expected T007 orphan failure. Passing migration fixtures classify existing rows, prove trigger-induced transactional rollback, and prove newer-schema refusal without WAL, journal-mode, database-size, mtime, or marker mutation.
  - Status: Phase 2 T003.1 acceptance complete.
  - [x] T003.2 Implement published-only latest/explicit-id selection and final
    publication in `src/application/use-cases/index-repository-graph.ts` and
    `src/infrastructure/sqlite/graph-store.ts`.
    - Acceptance: Only the final transaction advances visibility; partial
      coverage remains independent and truthful.
    - Evidence mode: implementation
    - Evidence: `pnpm exec vitest run tests/graph/store.test.ts tests/graph/extraction-pipeline.test.ts` reported 50 passes and 1 expected T007 orphan failure. Passing publication fixtures prove exact atomic build creation, generation-fenced terminal transitions, published-only selection, structured snapshot_unpublished public results, building-only writes, freshness independence, and truthful partial coverage.
  - Status: Phase 2 T003.2 acceptance complete.
  - [x] T003.3 Prove migration, every publication barrier, reopen, interruption,
    and retention in `tests/graph/store.test.ts` and
    `tests/graph/extraction-pipeline.test.ts`.
    - Acceptance: The previous published snapshot remains selected until one
      complete publication and across failed upgrade/refresh.
    - Evidence mode: validation
    - Evidence: Barrier, separate-reader, reopen, interruption, retention, stale-generation CAS, production-worker generation, partial-coverage, terminal immutability, and future-schema no-storage-mutation fixtures pass. Focused Phase 2 suites and full repository suite pass; independent remediation re-review found no remaining Phase 2 blocker.

  - Status: Phase 2 publication validation acceptance complete.
## Phase 3: Daemon Ownership And Public Triggers

- [x] T004 Compose one daemon controller, repository ownership lease, activity
  lease, and equivalent standalone controller.
  - Depends on: T002, T003
  - Requirements: Requirement 1, Requirement 2, Requirement 5, Requirement 6;
    Properties: CP-001-CP-003, CP-009
  - Acceptance Criteria: AC1.1, AC1.3, AC1.5; AC2.3-AC2.6; AC5.4;
    AC6.1-AC6.5
  - Files: `src/mcp/daemon.ts`, `src/server.ts`, `src/ports/index.ts`,
    `tests/mcp/daemon-launch.test.ts`,
    `tests/mcp/daemon-entrypoint-integration.test.ts`,
    `tests/helpers/spec041-refresh-reproductions.ts`
  - Acceptance: Every daemon connection receives the same controller while
    provider/session identity remains connection-local. Entering planned state
    acquires a daemon activity lease before admission returns; disconnect cannot
    release it; terminal notification releases it exactly once and starts idle
    grace only with zero clients. Standalone uses the same controller contract
    only after acquiring repository ownership and never competes with a healthy
    daemon owner.
  - Evidence mode: implementation
  - Evidence: Phase 3 T004 complete. Parent verification: `pnpm typecheck` passed; daemon launch, daemon entrypoint, and runtime controller suites reported 3 files passed, 62 ordinary passes, and 5 expected T005-T007 failures; `git diff --check` passed. Evidence covers one injected daemon controller, sole worker/publication path, repository ownership exclusion, disconnect/reconnect lifetime, exact activity-lease release, idle recheck, and termination-unconfirmed quarantine.
  - Expected evidence: Two-client, two-process, disconnect, reconnect, terminal
    notification, idle-timer race, and standalone-owner fixtures must record one
    daemon/controller identity and one activity-lease history.
  - Status: T004 acceptance complete; T005 and T006 may proceed in dependency order.
  - Phase 2 handoff: Replace the explicitly marked legacy server post-worker
    standalone publication fence with daemon/standalone controller composition,
    and make termination-unconfirmed quarantine participate in shutdown and
    lifetime admission.
  - [x] T004.1 Compose and inject one daemon controller in `src/mcp/daemon.ts`
    and `src/server.ts`.
    - Acceptance: Every connection shares controller identity while provider
      and session identity remain connection-local.
    - Evidence mode: implementation
    - Evidence: One daemon-scoped controller, graph store, sole worker executor, and shared service bundle are injected into every connection while integration identity remains handshake-local. `pnpm typecheck` and focused daemon/entrypoint/controller suites passed.
  - Status: Shared daemon controller composition complete.
  - [x] T004.2 Integrate the activity lease, terminal notification, closing
    admission, and idle-timer recheck in `src/mcp/daemon.ts`.
    - Acceptance: Disconnect, reconnect, completion, failure, and timer-fire
      races cannot close an active owner or start duplicate grace timers. The
      daemon lifetime test SHALL replace the Phase 1 reproduction factory with
      the production lifetime policy and become an ordinary passing test.
    - Evidence mode: implementation
    - Evidence: Production DaemonRefreshLifetimeCoordinator holds daemon lifetime across disconnect, rechecks connected clients, controller activity lease, and worker termination quarantine at timer fire, and reacts to terminal/termination-confirmed transitions. Focused lifetime and daemon suites passed.
  - Status: Activity lease, idle race, and termination quarantine integration complete.
  - [x] T004.3 Implement standalone repository-lease admission in
    `src/server.ts` and prove daemon/standalone exclusion in daemon tests.
    - Acceptance: A healthy owner yields structured `owner_active`; ambiguous
      evidence blocks; no refused contender enters planned state.
    - Evidence mode: implementation
    - Evidence: File-backed repository ownership gates daemon and lazy standalone controller creation; active and ambiguous owners block without controller creation, while positive dead-owner evidence permits reclaim. Focused ownership and daemon suites passed.

  - Status: Standalone and daemon repository-lease admission complete.
- [x] T005 Move watcher/change-queue authority and all refresh triggers to the
  daemon generation boundary.
  - Depends on: T004
  - Requirements: Requirement 1, Requirement 2, Requirement 5, Requirement 6;
    Properties: CP-001-CP-002, CP-007, CP-009
  - Acceptance Criteria: AC1.4, AC1.6; AC2.1-AC2.2; AC5.2, AC5.6;
    AC6.5
  - Files: `src/mcp/daemon.ts`, `src/server.ts`,
    `src/application/use-cases/process-workspace-change-queue.ts`,
    `tests/runtime/workspace-change-queue.test.ts`,
    `tests/mcp/repo-status-resource.test.ts`,
    `tests/mcp/daemon-entrypoint-integration.test.ts`,
    `tests/helpers/spec041-refresh-reproductions.ts`
  - Acceptance: The daemon owns one watcher and change queue for all clients;
    standalone owns one local equivalent. Startup, stale-path first reads, and
    watcher invalidations call the same generation request. Concurrent duplicate
    requests reuse active work, while a newer invalidation during execution is
    retained for one sequential catch-up pass before completion.
  - Evidence mode: implementation
  - Evidence: Phase 3 T005 complete. Parent verification: `pnpm typecheck` passed; five queue/status/daemon-entrypoint/stdio files reported 45 ordinary passes and 1 expected T006 failure; `git diff --check` passed. The non-startup daemon refresh and production catch-up cases are ordinary passes. No source/test reference to coordinateSnapshotRefresh, startGraphWarmup, or startupWarmupScheduled remains.
  - Expected evidence: Deterministic status/watcher tests must record accepted,
    started, coalesced, and published generations plus one writer invocation at
    a time.
  - Status: T005 acceptance complete; T006 remains the Phase 3 dependency-ready task.
  - Phase 2 handoff: Replace the trigger-level catch-up reproduction and legacy
    `coordinateSnapshotRefresh` timestamp-derived target allocation; all
    startup, watcher, and stale-read triggers must use the controller/store
    allocator boundary.
  - [x] T005.1 Move watcher/change-queue ownership to `src/mcp/daemon.ts` and
    retain one local equivalent in standalone `src/server.ts` composition.
    - Acceptance: Connection creation no longer creates independent daemon
      watchers or queues.
    - Evidence mode: implementation
    - Evidence: One repository workspace-refresh service owns the watcher and queue for the daemon, with one local standalone equivalent. Shared polling is serialized, watcher start is lazy and single, connection close does not dispose daemon state, and daemon/local owner close stops it once. Focused queue/status/entrypoint/stdio suites passed.
  - Status: Shared watcher and queue ownership complete.
  - [x] T005.2 Connect startup, first-read validity, and queue invalidation to
    the generation request port in `src/server.ts` and
    `src/application/use-cases/process-workspace-change-queue.ts`.
    - Acceptance: All triggers share one admission path and bounded reads remain
      non-blocking.
    - Evidence mode: implementation
    - Evidence: RepositoryRefreshTriggerCoordinator serializes startup, stale-first-read, and watcher admissions through SnapshotRefreshPort, seeds from controller/published generations, marks prior publication stale on watcher work, and uses store allocation only. Legacy coordinateSnapshotRefresh and startGraphWarmup paths/options were removed. Focused suites passed.
  - Status: All refresh triggers use the shared generation boundary.
  - [x] T005.3 Prove concurrent/sequential duplicate events and an invalidation
    arriving during a running pass in the queue/status fixtures.
    - Acceptance: Duplicate observations do not create successor work; a truly
      newer generation causes exactly one sequential catch-up. Replace the
      Phase 1 catch-up reproduction factory with the production controller and
      convert the expected failure to an ordinary passing test.
    - Evidence mode: validation
    - Evidence: Production-controller barrier fixtures prove repeated dirty reads reuse one generation, one later watcher batch advances once, the active build becomes superseded, one sequential catch-up publishes the newest generation, and no overlapping or third worker starts. Parent focused run reported 45 passes and 1 expected T006 failure.

  - Status: Trigger dedupe and sequential catch-up acceptance complete.
- [x] T006 Publish authoritative, bounded, and redacted controller diagnostics.
  - Depends on: T004
  - Requirements: Requirement 3, Requirement 5, Requirement 6; Properties:
    CP-005-CP-006, CP-009
  - Acceptance Criteria: AC3.1-AC3.6; AC5.1, AC5.5; AC6.1-AC6.3, AC6.5
  - Files: `src/contracts/runtime-integration-contracts.ts`,
    `src/application/use-cases/get-integration-health.ts`,
    `src/presentation/integration-health-presenter.ts`, `src/mcp/daemon.ts`,
    `src/server.ts`, `tests/mcp/integration-health-contract.test.ts`,
    `tests/mcp/integration-health-resource.test.ts`,
    `tests/mcp/daemon-launch.test.ts`
  - Acceptance: One awaited diagnostics operation emits only legal execution,
    publication, freshness, generation, snapshot, and lease combinations.
    Structured `last_failure` is category-stable, size-bounded, redacted across
    every public/output channel, retained through a later attempt, and cleared
    only by successful publication. Diagnostics failure changes top-level trust
    instead of returning synthetic healthy evidence.
  - Evidence mode: implementation
  - Evidence: Authoritative bounded diagnostics complete. Final validation: pnpm typecheck; 8 focused files 130/130 plus daemon entrypoint 9/9; full suite 80 files, 722 pass, 1 expected T007 orphan-recovery failure; plugin, skills, and 239-entry pack dry-run passed. Independent re-review found no remaining code blocker.
  - Expected evidence: Schema, use-case, presenter, resource, state-matrix, and
    sentinel redaction tests must record exact accepted/rejected combinations.
  - Status: Phase 3 T006 acceptance complete; T007 is dependency-ready.
  - Phase 2 handoff: Expose termination-unconfirmed quarantine truth in
    authoritative diagnostics so terminal receipts cannot imply shutdown or
    replacement safety before worker termination is confirmed.
  - [x] T006.1 Define exact diagnostics and structured-failure schemas in
    `src/contracts/runtime-integration-contracts.ts`.
    - Acceptance: Enums, required identities, 512-byte safe message, and legal
      state combinations are schema-enforced.
    - Evidence mode: implementation
    - Evidence: Exact diagnostics, worker-termination, and structured failure schemas implemented; contract and controller state-matrix tests pass.
  - [x] T006.2 Bind the one awaited receipt through
    `get-integration-health.ts`, the presenter, daemon, and server.
    - Acceptance: No synchronous cache or presenter-side join remains, and
      diagnostic failure changes top-level trust.
    - Evidence mode: implementation
    - Evidence: One awaited controller diagnostics receipt is bound through integration health, presenter, MCP resource/tool, daemon, and server; invalid receipts degrade trust safely.
  - [x] T006.3 Prove every state pair, identity transition, failure lifetime,
    and sentinel redaction channel in integration-health tests.
    - Acceptance: JSON, stdout, stderr, metadata, and timeout evidence contain
      stable safe codes and no sentinel material.
    - Evidence mode: validation
    - Evidence: Phase 3 validation covers legal states, shared identities, fresh-startup and pre-admission failure, failure retention/clearing, 512-byte closed messages, JSON/metadata/stdout/stderr sentinel redaction, safe timeout evidence, and standalone failure delegation. Final focused validation: 8 files 130/130 plus daemon entrypoint 9/9.

## Phase 4: Recovery And End-To-End Proof

- [x] T007 Implement and prove crash, orphan, lock, worker, and resource
  recovery through the single ownership path.
  - Depends on: T003, T004, T006
  - Requirements: Requirement 3, Requirement 4, Requirement 5, Requirement 6;
    Properties: CP-003, CP-006, CP-008-CP-009
  - Acceptance Criteria: AC3.4-AC3.6; AC4.4-AC4.6; AC5.1-AC5.6;
    AC6.4-AC6.6
  - Files: `src/mcp/daemon.ts`, `src/server.ts`,
    `src/infrastructure/runtime/refresh-controller.ts`,
    `src/infrastructure/sqlite/graph-store.ts`,
    `tests/mcp/daemon-entrypoint-integration.test.ts`,
    `tests/graph/store.test.ts`, `tests/helpers/sqlite-lock.ts`
  - Acceptance: Timeout, worker error/exit, invalid completion, SQLite/permission
    failure, and daemon crash release resources exactly once and keep unpublished
    snapshots invisible. Positive dead-owner evidence permits one replacement
    owner to reconcile orphan builds and start ordinary convergence; ambiguous
    evidence blocks cleanup/execution. A later stale request may start one new
    execution, but failure handling itself never retries.
  - Evidence mode: validation
  - Evidence: Phase 4 recovery complete: pnpm typecheck passed; graph/runtime/daemon-launch focused suites passed 105/105; daemon-entrypoint integration passed 15/15 including five real worker/daemon crashes at generation, catalog, docs, graph, and post-prune pre-completion barriers. Independent final review found no blockers. Recovery preserves full dead-owner chains, reconciles quarantined failures only on a later ordinary request, exposes bounded orphan evidence, and cleans worker/store/socket/ownership resources.
  - Expected evidence: Publication-barrier crash/reopen tests must record owner,
    writer/activity leases, child/store/socket cleanup, orphan disposition,
    visible snapshot, structured failure, and retry admission.
  - Status: T007 acceptance complete; T008 is dependency-ready.
  - Phase 2 handoff: Reconcile termination-unconfirmed ownership across crash
    and replacement, and retain structured SQLite, permission, orphan, and
    cleanup recovery evidence.
  - [x] T007.1 Implement worker/store/socket/metadata cleanup and explicit
    shutdown settlement in the controller, daemon, and server.
    - Acceptance: Every terminal and drain path releases each owned resource
      exactly once.
    - Evidence mode: implementation
    - Evidence: Worker protocol, failed-publication quarantine, daemon startup unwind, closeable stores, socket/metadata/ownership cleanup, and later-request settlement are implemented; focused recovery suites and daemon-entrypoint cleanup assertions pass.
  - Status: Every terminal and drain path now has bounded exactly-once cleanup evidence.
  - [x] T007.2 Implement positive-evidence orphan/lock reconciliation in the
    controller and graph store.
    - Acceptance: Dead-owner builds become failed and invisible; ambiguous
      owners block; no old worker can publish after replacement admission.
    - Evidence mode: implementation
    - Evidence: Positive-death ownership reclaim preserves a bounded full recovery chain, blocks ambiguous evidence, atomically fails matching orphan builds, and survives multi-crash rollback; graph/runtime/daemon tests pass.
  - Status: Dead-owner orphan and lock reconciliation acceptance complete.
  - [x] T007.3 Prove timeout, worker protocol failures, SQLite/permission
    failures, active-publication crashes, reopen, cleanup, and later-request
    recovery.
    - Acceptance: Exact structured failure and resource receipts establish one
      owner, no partial selection, and no automatic retry.
    - Evidence mode: validation
    - Evidence: Timeout/protocol/store/permission/orphan and five real worker/daemon crash-barrier cases pass; prior publication remains visible, recovery is structured, and one later ordinary request converges.

  - Status: T007 failure and recovery proof complete.
- [x] T008 Prove source-entrypoint and actually installed-package convergence
  with exact post-refresh query evidence.
  - Depends on: T005, T006, T007
  - Requirements: Requirement 1, Requirement 2, Requirement 3, Requirement 4,
    Requirement 5, Requirement 6; Properties: CP-001-CP-009
  - Acceptance Criteria: AC1.1-AC1.6; AC2.1-AC2.6; AC3.1-AC3.6;
    AC4.1-AC4.6; AC5.1-AC5.6; AC6.1-AC6.6
  - Files: `tests/helpers/mcp-entrypoint-session.ts`,
    `tests/mcp/daemon-entrypoint-integration.test.ts`,
    `tests/mcp/repo-status-resource.test.ts`, `tests/mcp/query-tools.test.ts`,
    `tests/mcp/docs-surfaces.test.ts`, `scripts/ci/install-smoke.mjs`,
    `scripts/ci/mcp-launch-smoke.mjs`,
    `scripts/ci/installed-package-mcp-smoke.mjs`, `.github/workflows/ci.yml`
  - Acceptance: Checkout/source entrypoint tests remain explicitly labelled as
    such. A real tarball is installed into isolated runtime/state directories and
    its installed `agent-workbench-mcp` bin hosts two provider-labelled clients
    on one daemon. One non-startup stale read converges without another trigger;
    emitted IDs/generations agree; known surviving `find_references` and
    `docs_search` hits are exact; deleted evidence is absent; and provider labels
    are not misrepresented as proof that real Codex or Claude CLIs ran.
  - Evidence mode: validation
  - Evidence: Phase 4 installed acceptance complete: source/query suites passed 67/67; checkout daemon entrypoint passed 15/15; install and MCP-launch smokes passed; real packed-and-installed-bin two-client smoke passed with one daemon, worker delta 1, exact surviving reference/docs hits, deleted evidence absent, fresh replacement, and client/daemon/socket/metadata/temporary-root cleanup. Provider labels are explicitly not real CLI proof.
  - Expected evidence: Record V002, V007-V010, and V019-V021 receipts including
    tarball/install/bin provenance, daemon PID, execution/generation/snapshot
    IDs, worker count, query hits, trust metadata, cleanup, and limitations.
  - Status: T008 acceptance complete; Phase 4 is complete and T009 is dependency-ready.
  - [x] T008.1 Retain and correctly label checkout/source-entrypoint convergence
    in the MCP entrypoint fixtures.
    - Acceptance: Source composition proves shared behavior without claiming an
      installed package or real agent CLI.
    - Evidence mode: validation
    - Evidence: Checkout/source entrypoint tests are explicitly labelled and pass 15/15; helper documentation states they do not prove an installed package or real agent CLI.
  - Status: Source-entrypoint evidence retained with the correct boundary.
  - [x] T008.2 Add and run `scripts/ci/installed-package-mcp-smoke.mjs` through
    the CI workflow against a real isolated tarball installation.
    - Acceptance: The installed bin and its native/runtime dependencies host two
      provider-labelled sessions on one daemon.
    - Evidence mode: validation
    - Evidence: CI now runs scripts/ci/installed-package-mcp-smoke.mjs. A real 0.5.2 tarball installed into isolated roots and its installed agent-workbench-mcp bin hosted Codex- and Claude-labelled clients on one daemon; cleanup passed.
  - Status: Installed-package two-client acceptance complete.
  - [x] T008.3 Prove exact surviving reference/doc hits, deleted-evidence
    absence, trust, cleanup, and evidence-boundary wording.
    - Acceptance: Empty non-blocked results and provider labels alone cannot
      satisfy the installed-package receipt.
    - Evidence mode: validation
    - Evidence: Installed-bin acceptance proved worker delta 1, exact parser-backed greet-to-helper reference, exact docs/guide.md Details FTS hit, deleted symbol/docs absence, fresh replacement identity, trust metadata, and real_agent_cli_executed=false.

  - Status: Exact query and evidence-boundary acceptance complete.
## Phase 5: Promotion And Closure Readiness

- [x] T009 Run all gates, promote verified behavior, reconcile EB052, and
  prepare closure.
  - Depends on: T008
  - Requirements: Requirement 1, Requirement 2, Requirement 3, Requirement 4,
    Requirement 5, Requirement 6; Properties: CP-001-CP-009
  - Acceptance Criteria: AC1.1-AC1.6; AC2.1-AC2.6; AC3.1-AC3.6;
    AC4.1-AC4.6; AC5.1-AC5.6; AC6.1-AC6.6
  - Files: `docs/design/runtime-operations-design.md`,
    `docs/design/graph-store-design.md`,
    `docs/design/layered-runtime-architecture.md`,
    `docs/reference/runtime-contracts.md`, `docs/design/mcp-surface-design.md`,
    `docs/requirements/runtime-requirements.md`,
    `docs/reference/mvp-proof-matrix.md`,
    `docs/reference/agent-readable-changelog.md`,
    `docs/runbooks/install-agent-workbench.md`,
    `docs/runbooks/codex-agent-workbench-plugin.md`,
    `packaging/agent-workbench/README.md`, `docs/backlog/README.md`,
    `docs/history/spec-closure-log.md`, `docs/history/spec-archive-index.md`,
    `docs/specs/041-daemon-owned-refresh-convergence/verification.md`,
    `docs/specs/041-daemon-owned-refresh-convergence/traceability.md`
  - Acceptance: Focused evidence and V012-V021 pass; every AC and CP has a
    reproducible receipt; canonical docs describe only implemented behavior;
    install/support docs distinguish source, installed-bin, provider-labelled,
    and real-CLI evidence; EB052 is reconciled; EB014 remains separate; no
    `not-covered` row or unowned residual remains; and closure metadata identifies
    implementation and cleanup commits truthfully.
  - Evidence mode: validation
  - Evidence: Phase 5 acceptance complete: final focused suites and 80-file/749-test full suite pass; typecheck, plugin/skill, 0.6.0/240-entry package, install, isolated launch, installed two-client, lifecycle, Markdown, and diff gates pass; all 15 promotion targets changed; EB052 closed and EB014 remains separate; actual tagged v0.5.2 blocks on the owner-gated v2 retirement guard; startup ownership is atomic; independent review has no implementation blocker; closure plan ec942aad7aa4 will render truthful final/cleanup commit metadata after this final spec commit.
  - Expected evidence: Record typecheck, full tests, plugin/skill/package gates,
    install and MCP-launch smokes, installed-package acceptance, lifecycle,
    Markdown, diff, promotion, review, closure, and archive-index outcomes.
  - Status: Phase 5 promotion, compatibility remediation, validation, review, and closure preparation complete.
  - [x] T009.1 Run and record every focused, full, plugin, skill, pack, install,
    launcher, installed-package, lifecycle, Markdown, and diff gate.
    - Acceptance: Each command has an exact outcome and any exception has an
      owned residual destination.
    - Evidence mode: validation
    - Evidence: Final Phase 5 gates passed: four focused acceptance groups reported 51, 44, 44, and 23 tests; final graph-store and daemon suites reported 36 and 46; pnpm test reported 80 files/749 tests; typecheck, plugin, six-skill validation, 0.6.0/240-entry pack dry-run, install smoke, isolated MCP-launch smoke, and installed-package two-client smoke passed. All 15 changed Markdown docs had no non-table findings and git diff --check passed.
  - Status: All focused, full, package, installed, Markdown, and diff gates complete.
  - [x] T009.2 Promote verified behavior, migration/rollback, support, and proof
    to every exact durable target or record a reasoned no-op.
    - Acceptance: Canonical docs and runbooks match implemented behavior and do
      not overclaim source, installed-bin, provider-labelled, or real-CLI proof.
    - Evidence mode: artifact
    - Evidence: All 15 promotion candidates changed. Canonical design/contracts/requirements/proof docs and install/plugin/package support docs now match daemon-owned generations, leases, finite settlement, atomic publication, exact v2 migration/rollback/legacy guard behavior, proof boundaries, unreleased 0.6.0 availability, and the independent EB014 scale boundary. No reasoned no-op was required.
  - Status: Durable promotion complete across every planned destination.
  - [x] T009.3 Reconcile EB052, EB014, traceability, review findings, closure
    commits, and archive metadata.
    - Acceptance: No `not-covered` row, unowned residual, or untruthful commit
      claim remains.
    - Evidence mode: artifact
    - Evidence: EB052 is closed by Spec 041 and routes to durable docs; EB014 remains independently scoped. Traceability has no pending implementation row. Independent Phase 5 review has no implementation blocker after all findings were remediated. Lifecycle closure plan ec942aad7aa4 selected removed disposition with closure-log/archive rendering followed by package cleanup; the final implementation and cleanup hashes will be written by the post-commit closure actions because the package cannot truthfully contain its own removal commit.
  - Status: Backlog, review, traceability, and removed-package closure plan are reconciled; hash resolution remains the post-commit lifecycle action.
  - [x] T009.4 Remediate closure-review compatibility and startup-ownership
    gaps discovered during Phase 5.
    - Files: `src/infrastructure/sqlite/graph-store-location.ts`,
      `src/infrastructure/sqlite/graph-store.ts`, `src/server.ts`,
      `src/mcp/daemon.ts`, `tests/fixtures/legacy-v0.5.2-graph-store.ts`,
      `tests/graph/store.test.ts`, `tests/mcp/daemon-launch.test.ts`, package and
      plugin version manifests, and package validation.
    - Acceptance: Schema identity v2 is inaccessible to the actual tagged
      v0.5.2 adapter; legacy retirement is owner-gated, atomic,
      crash-recoverable, bounded-memory, and rollback-safe; startup-lock
      publication is atomic and exception-safe; 0.6.0 is explicitly unreleased
      while install links remain on released 0.5.2; and focused regressions plus
      the tagged-adapter probe pass without retry or fallback behavior.
    - Evidence mode: validation
    - Evidence: Closure review remediation passed: schema identity v2 uses graph-v2.sqlite; owner-gated retirement preserves graph-v1.sqlite.pre-v2 and atomically guards graph.sqlite; the actual tagged v0.5.2 adapter exited 1 with SQLITE_NOTADB; startup-lock publication and release are atomic/exception-safe; graph-store tests passed 36/36, daemon launch/entrypoint tests passed 46/46, typecheck passed, and unreleased 0.6.0 package/plugin identities validate while install links remain released 0.5.2.

  - Status: Compatibility, startup ownership, and release-identity remediation complete.
## Execution Rules

- Read all seven package artifacts before implementation; do not implement from
  this task index alone.
- Mark only the selected parent task `[~]`. Mark it `[x]` only after its full
  acceptance and named evidence are satisfied; do not use a later E2E task to
  retroactively hide missing focused evidence.
- Preserve one controller/executor, one daemon watcher/change queue, one
  repository owner, and one publication path. Do not add retry, fallback,
  provider-specific, or manual-refresh alternatives.
- Before parallel delegation, reserve the exact files above and coordinate the
  shared seams in `src/ports/index.ts`, `src/server.ts`, `src/mcp/daemon.ts`, and
  the spec evidence files.
