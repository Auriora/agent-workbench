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
T001 -> T002 -> T003 -> T004
                  |       |
                  -> T005 -> T006 -> T007
```

## Phase 1: Failing Contracts

- [ ] T001 Lock failing daemon/package-entrypoint fixtures and controller
  contracts before implementation.
  - Depends on: none
  - Requirements: Requirement 1, Requirement 2, Requirement 3, Requirement 4,
    Requirement 5, Requirement 6; Properties: CP-001-CP-006
  - Files: `tests/mcp/daemon-entrypoint-integration.test.ts`,
    `tests/mcp/daemon-launch.test.ts`, `tests/runtime/operations.test.ts`,
    `src/ports/index.ts`, `src/contracts/runtime-integration-contracts.ts`
  - Acceptance: A two-client fixture reproduces stranded non-startup refresh;
    repeated-request, disconnect, failure, and idle-lifetime fixtures fail for
    the intended reason; contracts reject terminal synthetic
    `scheduled/unknown` health.
  - Evidence mode: contract
  - Evidence: Pending.
  - [ ] T001.1 Add the two-client non-startup deletion reproduction.
    - Evidence: Pending.
  - [ ] T001.2 Lock the narrow controller port and canonical health-state
    contracts.
    - Evidence: Pending.
  - [ ] T001.3 Add failing repeated-request, disconnect, failure, and idle
    lifecycle fixtures.
    - Evidence: Pending.

## Phase 2: Shared Runtime Ownership

- [ ] T002 Implement the daemon-scoped refresh controller.
  - Depends on: T001
  - Requirements: Requirement 1, Requirement 5, Requirement 6; Properties:
    CP-001, CP-006
  - Files: `src/application/use-cases/coordinate-snapshot-refresh.ts`,
    `src/application/use-cases/index-repository-graph.ts`,
    `src/infrastructure/runtime/index.ts` or one focused controller module,
    `src/infrastructure/sqlite/graph-store.ts`, `src/ports/index.ts`,
    `tests/runtime/operations.test.ts`, relevant graph-store selection tests
  - Acceptance: One coordinator and executor reuse planned/running work;
    failure is terminal and observable; incomplete replacement snapshots are
    not selected by readers; the existing worker, bounds, and locks remain the
    sole execution path.
  - Evidence mode: implementation
  - Evidence: Pending.
  - [ ] T002.1 Implement shared request/state coordination and active-execution
    reuse.
    - Evidence: Pending.
  - [ ] T002.2 Connect the sole bounded worker executor and terminal failure
    recording.
    - Evidence: Pending.
  - [ ] T002.3 Prove controller idempotence, completion, and failure behavior
    with focused runtime tests.
    - Evidence: Pending.
  - [ ] T002.4 Make replacement publication/selection hide incomplete
    `refreshing` snapshots from ordinary latest-snapshot readers.
    - Evidence: Pending.

- [ ] T003 Move daemon and standalone composition to the controller.
  - Depends on: T002
  - Requirements: Requirement 1, Requirement 2, Requirement 6; Properties:
    CP-001-CP-003
  - Files: `src/mcp/daemon.ts`, `src/server.ts`,
    `tests/mcp/daemon-launch.test.ts`,
    `tests/mcp/daemon-entrypoint-integration.test.ts`
  - Acceptance: Every daemon connection receives one shared service;
    standalone uses the same contract locally; requester disconnect does not
    strand work; idle shutdown waits for terminal execution.
  - Evidence mode: implementation
  - Evidence: Pending.
  - [ ] T003.1 Create one controller in the daemon and inject it into every
    accepted client.
    - Evidence: Pending.
  - [ ] T003.2 Compose the same controller contract for standalone execution.
    - Evidence: Pending.
  - [ ] T003.3 Preserve refresh ownership across requester disconnect and idle
    shutdown decisions.
    - Evidence: Pending.

## Phase 3: Triggers And Diagnostics

- [ ] T004 Connect first-read and watcher invalidation to the shared request
  boundary.
  - Depends on: T003
  - Requirements: Requirement 1 AC1.4, Requirement 2, Requirement 5 AC5.2
  - Files: `src/server.ts`,
    `src/application/use-cases/process-workspace-change-queue.ts`,
    `tests/mcp/repo-status-resource.test.ts`,
    `tests/runtime/workspace-change-queue.test.ts`
  - Acceptance: Both triggers reuse active execution and status remains
    bounded/non-blocking while refresh runs.
  - Evidence mode: implementation
  - Evidence: Pending.
  - [ ] T004.1 Replace connection-local first-read refresh planning with the
    shared request boundary.
    - Evidence: Pending.
  - [ ] T004.2 Make watcher queue invalidation use the same boundary and reuse
    active execution.
    - Evidence: Pending.

- [ ] T005 Publish authoritative daemon health.
  - Depends on: T003
  - Requirements: Requirement 3, Requirement 5 AC5.1; Properties: CP-005,
    CP-006
  - Files: `src/mcp/daemon.ts`, `src/server.ts`,
    `src/contracts/runtime-integration-contracts.ts`,
    `src/application/use-cases/get-integration-health.ts`,
    `src/presentation/integration-health-presenter.ts`,
    `tests/mcp/integration-health-contract.test.ts`,
    `tests/mcp/integration-health-resource.test.ts`,
    `tests/mcp/daemon-launch.test.ts`
  - Acceptance: Awaited diagnostics, or a fixture-proven equivalent atomic
    receipt, reports canonical execution/freshness; bounded `last_failure`
    persists after failure and clears after success; schema and presenter tests
    reject invalid combinations.
  - Evidence mode: implementation
  - Evidence: Pending.
  - [ ] T005.1 Make daemon diagnostics authoritative and constrain public
    execution/freshness values.
    - Evidence: Pending.
  - [ ] T005.2 Retain bounded failure evidence and clear it only after success.
    - Evidence: Pending.
  - [ ] T005.3 Add contract, presenter, resource, and daemon diagnostic tests.
    - Evidence: Pending.

## Phase 4: End-To-End Proof

- [ ] T006 Prove atomic multi-client convergence and query recovery.
  - Depends on: T004, T005
  - Requirements: Requirement 2, Requirement 4, Requirement 5; Properties:
    CP-002-CP-006
  - Files: `tests/mcp/daemon-entrypoint-integration.test.ts`,
    `tests/mcp/repo-status-resource.test.ts`, `tests/mcp/query-tools.test.ts`,
    `tests/mcp/docs-surfaces.test.ts`, `tests/graph/store.test.ts`, and relevant
    indexing pipeline tests
  - Acceptance: A mixed Codex/Claude package fixture proves one replacement
    snapshot, removed stale rows, shared fresh status, requester-disconnect
    survival, structured failure, and usable `find_references`/`docs_search`
    without partial replacement evidence.
  - Evidence mode: validation
  - Evidence: Pending.
  - [ ] T006.1 Prove one replacement snapshot and shared fresh status across
    two clients.
    - Evidence: Pending.
  - [ ] T006.2 Prove requester disconnect survival and structured failure
    without ownership split.
    - Evidence: Pending.
  - [ ] T006.3 Prove deleted rows are absent and `find_references` plus
    `docs_search` are usable after publication.
    - Evidence: Pending.

## Phase 5: Promotion And Closure Readiness

- [ ] T007 Validate, promote durable behavior, and prepare closure.
  - Depends on: T006
  - Requirements: Requirement 1, Requirement 2, Requirement 3, Requirement 4,
    Requirement 5, Requirement 6; Properties: CP-001-CP-006
  - Files: durable targets in `design.md`, `docs/backlog/README.md`,
    `docs/reference/agent-readable-changelog.md`, and
    `docs/history/spec-closure-log.md` at closure
  - Acceptance: All criteria have reproducible evidence; focused/full/package
    gates pass; canonical docs match implementation; EB052 is reconciled; no
    unowned gap or EB014 scope absorption remains.
  - Evidence mode: validation
  - Evidence: Pending.
  - [ ] T007.1 Run focused, full, plugin, skill, package, lifecycle, Markdown,
    and diff gates.
    - Evidence: Pending.
  - [ ] T007.2 Promote verified ownership, diagnostics, publication, and proof
    behavior to every durable target.
    - Evidence: Pending.
  - [ ] T007.3 Reconcile EB052, residual scope, review findings, and closure
    metadata.
    - Evidence: Pending.

## Execution Rules

- Read all seven package artifacts before implementation; do not implement from
  this task index alone.
- Mark only the selected task `[~]` before work and mark `[x]` only after its
  declared acceptance and evidence are satisfied.
- Preserve one controller/executor path and route out-of-scope evidence to its
  durable owner.
