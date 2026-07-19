---
title: Daemon-owned refresh convergence tasks
doc_type: spec
artifact_type: tasks
status: draft
owner: platform
last_reviewed: 2026-07-19
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

- [ ] T002 Implement controller-owned invalidation generations and the sole
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
  - Evidence: Pending.
  - Expected evidence: Focused controller tests must record execution IDs,
    requested/started generations, worker invocation counts, terminal state,
    deadline behavior, and absence of automatic retry.
  - [ ] T002.1 Implement linearized generation and state admission in
    `src/infrastructure/runtime/refresh-controller.ts` and `src/ports/index.ts`.
    - Acceptance: Concurrent requests reuse one execution and newer generations
      set one coalesced catch-up latch.
    - Evidence mode: implementation
    - Evidence: Pending.
  - [ ] T002.2 Implement the one-result worker protocol and finite deadline in
    `src/infrastructure/runtime/refresh-controller.ts`.
    - Acceptance: Success, timeout, error, non-zero exit, zero exit without a
      result, and invalid result each settle exactly once.
    - Evidence mode: implementation
    - Evidence: Pending.
  - [ ] T002.3 Prove controller admission, catch-up, deadline, and deterministic
    post-failure behavior in `tests/runtime/operations.test.ts`. Replace the
    Phase 1 reproduction factory in
    `tests/helpers/spec041-refresh-reproductions.ts` with the production
    controller and convert its expected failures to ordinary passing tests.
    - Acceptance: Barrier-controlled tests record one writer and no callback,
      timer, or health-read retry.
    - Evidence mode: validation
    - Evidence: Pending.

- [ ] T003 Implement atomic publication and current-snapshot selection as a
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
  - Evidence: Pending.
  - Expected evidence: Barrier, concurrent-reader, reopen, interruption, and
    retention tests must identify visible and target snapshot IDs at every
    publication phase.
  - [ ] T003.1 Add the transactional publication-state/schema migration in
    `src/infrastructure/sqlite/graph-store.ts`.
    - Acceptance: Existing non-refreshing rows become published, existing
      refreshing rows become failed, migration rollback is atomic, and the
      schema-version gate blocks older runtimes.
    - Evidence mode: implementation
    - Evidence: Pending.
  - [ ] T003.2 Implement published-only latest/explicit-id selection and final
    publication in `src/application/use-cases/index-repository-graph.ts` and
    `src/infrastructure/sqlite/graph-store.ts`.
    - Acceptance: Only the final transaction advances visibility; partial
      coverage remains independent and truthful.
    - Evidence mode: implementation
    - Evidence: Pending.
  - [ ] T003.3 Prove migration, every publication barrier, reopen, interruption,
    and retention in `tests/graph/store.test.ts` and
    `tests/graph/extraction-pipeline.test.ts`.
    - Acceptance: The previous published snapshot remains selected until one
      complete publication and across failed upgrade/refresh.
    - Evidence mode: validation
    - Evidence: Pending.

## Phase 3: Daemon Ownership And Public Triggers

- [ ] T004 Compose one daemon controller, repository ownership lease, activity
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
  - Evidence: Pending.
  - Expected evidence: Two-client, two-process, disconnect, reconnect, terminal
    notification, idle-timer race, and standalone-owner fixtures must record one
    daemon/controller identity and one activity-lease history.
  - [ ] T004.1 Compose and inject one daemon controller in `src/mcp/daemon.ts`
    and `src/server.ts`.
    - Acceptance: Every connection shares controller identity while provider
      and session identity remain connection-local.
    - Evidence mode: implementation
    - Evidence: Pending.
  - [ ] T004.2 Integrate the activity lease, terminal notification, closing
    admission, and idle-timer recheck in `src/mcp/daemon.ts`.
    - Acceptance: Disconnect, reconnect, completion, failure, and timer-fire
      races cannot close an active owner or start duplicate grace timers. The
      daemon lifetime test SHALL replace the Phase 1 reproduction factory with
      the production lifetime policy and become an ordinary passing test.
    - Evidence mode: implementation
    - Evidence: Pending.
  - [ ] T004.3 Implement standalone repository-lease admission in
    `src/server.ts` and prove daemon/standalone exclusion in daemon tests.
    - Acceptance: A healthy owner yields structured `owner_active`; ambiguous
      evidence blocks; no refused contender enters planned state.
    - Evidence mode: implementation
    - Evidence: Pending.

- [ ] T005 Move watcher/change-queue authority and all refresh triggers to the
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
  - Evidence: Pending.
  - Expected evidence: Deterministic status/watcher tests must record accepted,
    started, coalesced, and published generations plus one writer invocation at
    a time.
  - [ ] T005.1 Move watcher/change-queue ownership to `src/mcp/daemon.ts` and
    retain one local equivalent in standalone `src/server.ts` composition.
    - Acceptance: Connection creation no longer creates independent daemon
      watchers or queues.
    - Evidence mode: implementation
    - Evidence: Pending.
  - [ ] T005.2 Connect startup, first-read validity, and queue invalidation to
    the generation request port in `src/server.ts` and
    `src/application/use-cases/process-workspace-change-queue.ts`.
    - Acceptance: All triggers share one admission path and bounded reads remain
      non-blocking.
    - Evidence mode: implementation
    - Evidence: Pending.
  - [ ] T005.3 Prove concurrent/sequential duplicate events and an invalidation
    arriving during a running pass in the queue/status fixtures.
    - Acceptance: Duplicate observations do not create successor work; a truly
      newer generation causes exactly one sequential catch-up. Replace the
      Phase 1 catch-up reproduction factory with the production controller and
      convert the expected failure to an ordinary passing test.
    - Evidence mode: validation
    - Evidence: Pending.

- [ ] T006 Publish authoritative, bounded, and redacted controller diagnostics.
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
  - Evidence: Pending.
  - Expected evidence: Schema, use-case, presenter, resource, state-matrix, and
    sentinel redaction tests must record exact accepted/rejected combinations.
  - [ ] T006.1 Define exact diagnostics and structured-failure schemas in
    `src/contracts/runtime-integration-contracts.ts`.
    - Acceptance: Enums, required identities, 512-byte safe message, and legal
      state combinations are schema-enforced.
    - Evidence mode: implementation
    - Evidence: Pending.
  - [ ] T006.2 Bind the one awaited receipt through
    `get-integration-health.ts`, the presenter, daemon, and server.
    - Acceptance: No synchronous cache or presenter-side join remains, and
      diagnostic failure changes top-level trust.
    - Evidence mode: implementation
    - Evidence: Pending.
  - [ ] T006.3 Prove every state pair, identity transition, failure lifetime,
    and sentinel redaction channel in integration-health tests.
    - Acceptance: JSON, stdout, stderr, metadata, and timeout evidence contain
      stable safe codes and no sentinel material.
    - Evidence mode: validation
    - Evidence: Pending.

## Phase 4: Recovery And End-To-End Proof

- [ ] T007 Implement and prove crash, orphan, lock, worker, and resource
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
  - Evidence mode: implementation
  - Evidence: Pending.
  - Expected evidence: Publication-barrier crash/reopen tests must record owner,
    writer/activity leases, child/store/socket cleanup, orphan disposition,
    visible snapshot, structured failure, and retry admission.
  - [ ] T007.1 Implement worker/store/socket/metadata cleanup and explicit
    shutdown settlement in the controller, daemon, and server.
    - Acceptance: Every terminal and drain path releases each owned resource
      exactly once.
    - Evidence mode: implementation
    - Evidence: Pending.
  - [ ] T007.2 Implement positive-evidence orphan/lock reconciliation in the
    controller and graph store.
    - Acceptance: Dead-owner builds become failed and invisible; ambiguous
      owners block; no old worker can publish after replacement admission.
    - Evidence mode: implementation
    - Evidence: Pending.
  - [ ] T007.3 Prove timeout, worker protocol failures, SQLite/permission
    failures, active-publication crashes, reopen, cleanup, and later-request
    recovery.
    - Acceptance: Exact structured failure and resource receipts establish one
      owner, no partial selection, and no automatic retry.
    - Evidence mode: validation
    - Evidence: Pending.

- [ ] T008 Prove source-entrypoint and actually installed-package convergence
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
  - Evidence: Pending.
  - Expected evidence: Record V002, V007-V010, and V019-V021 receipts including
    tarball/install/bin provenance, daemon PID, execution/generation/snapshot
    IDs, worker count, query hits, trust metadata, cleanup, and limitations.
  - [ ] T008.1 Retain and correctly label checkout/source-entrypoint convergence
    in the MCP entrypoint fixtures.
    - Acceptance: Source composition proves shared behavior without claiming an
      installed package or real agent CLI.
    - Evidence mode: validation
    - Evidence: Pending.
  - [ ] T008.2 Add and run `scripts/ci/installed-package-mcp-smoke.mjs` through
    the CI workflow against a real isolated tarball installation.
    - Acceptance: The installed bin and its native/runtime dependencies host two
      provider-labelled sessions on one daemon.
    - Evidence mode: validation
    - Evidence: Pending.
  - [ ] T008.3 Prove exact surviving reference/doc hits, deleted-evidence
    absence, trust, cleanup, and evidence-boundary wording.
    - Acceptance: Empty non-blocked results and provider labels alone cannot
      satisfy the installed-package receipt.
    - Evidence mode: validation
    - Evidence: Pending.

## Phase 5: Promotion And Closure Readiness

- [ ] T009 Run all gates, promote verified behavior, reconcile EB052, and
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
  - Evidence: Pending.
  - Expected evidence: Record typecheck, full tests, plugin/skill/package gates,
    install and MCP-launch smokes, installed-package acceptance, lifecycle,
    Markdown, diff, promotion, review, closure, and archive-index outcomes.
  - [ ] T009.1 Run and record every focused, full, plugin, skill, pack, install,
    launcher, installed-package, lifecycle, Markdown, and diff gate.
    - Acceptance: Each command has an exact outcome and any exception has an
      owned residual destination.
    - Evidence mode: validation
    - Evidence: Pending.
  - [ ] T009.2 Promote verified behavior, migration/rollback, support, and proof
    to every exact durable target or record a reasoned no-op.
    - Acceptance: Canonical docs and runbooks match implemented behavior and do
      not overclaim source, installed-bin, provider-labelled, or real-CLI proof.
    - Evidence mode: artifact
    - Evidence: Pending.
  - [ ] T009.3 Reconcile EB052, EB014, traceability, review findings, closure
    commits, and archive metadata.
    - Acceptance: No `not-covered` row, unowned residual, or untruthful commit
      claim remains.
    - Evidence mode: artifact
    - Evidence: Pending.

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
