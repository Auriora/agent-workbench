---
title: Daemon-owned refresh convergence design
doc_type: spec
artifact_type: design
status: draft
owner: platform
last_reviewed: 2026-07-19
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Technical Design

## Overview

Introduce one daemon-scoped refresh controller that owns a shared warm-up
coordinator and the sole graph-refresh executor. Every connection-specific MCP
server receives the controller's narrow request and state boundaries. The
standalone server composes the same controller locally. Snapshot validation and
watcher invalidation therefore request work from one lifecycle rather than
creating connection-local plans.

## Confirmed Root Cause

`startAgentWorkbenchDaemon` shares `sharedGraphStore`, but every accepted
socket calls `createAgentWorkbenchServer`, which constructs a private
`InMemoryRuntimeOperationsAdapter`. Only the first connection receives
`startGraphWarmup: true`. A later connection can call
`coordinateSnapshotRefresh` and create private `planned` state, but its server
cannot execute that plan. Daemon diagnostics independently reduce state to a
startup boolean and hard-coded `graph_freshness: unknown`.

## Requirement Coverage

| Requirement | Design coverage | Validation |
| --- | --- | --- |
| Requirement 1 | Shared controller, coordinator, executor, and request port | Controller and daemon lifecycle tests |
| Requirement 2 | Every connection uses one daemon service; active work pins daemon lifetime | Two-client and disconnect package tests |
| Requirement 3 | Awaited authoritative diagnostic receipt and canonical enums | Contract, presenter, and health tests |
| Requirement 4 | Existing worker publication through one owner | Snapshot, status, graph, and docs tests |
| Requirement 5 | Terminal failure state and bounded diagnostics | Worker/lock/failure tests |
| Requirement 6 | Narrow port and provider-neutral composition | Architecture and compatibility tests |

## High-Level Design

### Daemon-Scoped Refresh Controller

The daemon constructs one controller beside its shared graph-store factory.
The controller owns:

- one `WarmupCoordinatorPort` implementation for the repository;
- one executor that invokes the existing startup graph warm-up worker;
- idempotent request-to-execution scheduling;
- terminal state and bounded last-failure evidence;
- an authoritative asynchronous diagnostics receipt.

Startup calls the same request path as first-read deletion and watcher
invalidation. A request while state is `planned` or `running` returns the
existing execution identity. A request after `complete` or `failed` may create
one new execution when the snapshot is still stale.

### Connection Composition

Connection-specific MCP servers retain provider identity and session state,
but receive the daemon controller's narrow ports. They do not instantiate or
own warm-up lifecycle state. Standalone composition creates one local
controller and injects the same boundaries, preserving one implementation
path.

The conceptual contract is:

```text
SnapshotRefreshPort.request({ repoRoot, reason })
  -> { executionId, snapshotId, state, reused }

SnapshotRefreshPort.getState({ repoRoot })
  -> canonical execution state

SnapshotRefreshPort.getDiagnostics({ repoRoot })
  -> awaited { warmupState, graphFreshness, lastFailure? }
```

The concrete port may separate request, warm-up-state, and diagnostics reads,
but must not expose the raw in-memory adapter.

## Low-Level Design

- `startAgentWorkbenchDaemon` creates one controller with the shared graph-store
  factory before accepting clients.
- `acceptDaemonClient` injects the same request/state/diagnostics ports into
  each connection-specific server while keeping integration identity local.
- `createAgentWorkbenchServer` creates a local controller only when one is not
  injected, so daemon and standalone use the same behavior.
- The controller serializes request-to-worker launch and owns execution state;
  the existing worker remains responsible for bounded indexing/publication.
- Integration health awaits a diagnostic receipt that reads controller state
  and the selected shared snapshot under one composition boundary.

### Authoritative Diagnostics

Integration health awaits diagnostics from the daemon controller. The receipt
combines shared coordinator state with the selected graph snapshot. Warm-up
state is constrained to canonical execution states; graph freshness is
constrained to canonical snapshot freshness. `scheduled/unknown` cannot pass as
a terminal healthy fixture once snapshot evidence exists.

`last_failure` is bounded and redacted, retained for the daemon lifetime after
a failed execution, and cleared only by successful refresh. The public health
schema and presenter enforce these values.

### Lifetime And Disconnects

The daemon treats active refresh as ownership even with zero clients. Idle
shutdown is suppressed while execution is `planned` or `running`. On terminal
completion or failure, the normal idle grace timer starts if no client remains.
Disconnecting the requester removes only its MCP server and socket; it does not
cancel the controller.

### Snapshot Publication

The existing graph warm-up worker remains the only indexing executor, but
current replacement selection is not atomic: indexing creates a `refreshing`
snapshot before all rows are written, and latest-snapshot selection can expose
that snapshot before completion. This slice must make publication/selection an
explicit boundary. Readers remain pinned to the prior non-fresh snapshot until
the replacement reaches a completed publish state; only then may latest
selection advance. Successful publication removes deleted graph/docs/FTS
evidence through the existing graph-store path while retaining current
scan/extraction bounds, locks, snapshot retention, and transaction rules.

## Data Flow

```text
startup | stale first read | watcher invalidation
  -> shared SnapshotRefreshPort.request
  -> daemon coordinator reuses or creates one execution
  -> sole graph warm-up worker
  -> atomic replacement snapshot publication
  -> shared state + awaited snapshot diagnostics
  -> status, orientation, integration health, graph/docs queries
```

## Failure Behavior

- Worker, store, permission, and timeout failures mark the shared execution
  `failed`, preserve non-fresh graph evidence, and record bounded failure text.
- Raw SQLite or worker output never escapes MCP envelopes.
- The controller does not retry automatically. A later stale first read may
  request one new execution through the same boundary.
- Daemon crash recovery continues to require existing positive PID/socket
  evidence and creates one replacement owner.
- A client connecting during refresh observes the same execution and prior
  non-fresh snapshot until publication.

## Resolved Decisions

- **D001:** Suppress idle shutdown while refresh is planned or running; begin
  normal grace only after terminal state.
- **D002:** Introduce a narrow refresh service/port; do not leak the raw runtime
  adapter to daemon, MCP, or presentation code.
- **D003:** Retain bounded `last_failure` for the daemon lifetime and clear it
  after the next successful refresh.
- **D004:** Prefer awaited authoritative daemon diagnostics. An equivalent
  atomic receipt is acceptable only if the same controller updates it at every
  state and snapshot transition and tests prove no divergence.
- **D005:** Keep one existing graph warm-up worker as the executor; no manual
  tool, retry loop, provider branch, or alternate index path.

## Likely Implementation Surface

- `src/mcp/daemon.ts`
- `src/server.ts`
- `src/application/use-cases/coordinate-snapshot-refresh.ts`
- `src/application/use-cases/index-repository-graph.ts`
- `src/application/use-cases/process-workspace-change-queue.ts`
- `src/infrastructure/runtime/index.ts` or one focused refresh-controller module
- `src/infrastructure/sqlite/graph-store.ts`
- `src/ports/index.ts`
- `src/contracts/runtime-integration-contracts.ts`
- integration-health application/presenter composition if diagnostics become
  asynchronous

## Validation Strategy

Lock the package-entrypoint failure before implementation. Then prove
controller idempotence, two-client convergence, requester disconnect survival,
idle lifetime, structured failure, canonical diagnostics, atomic publication,
and post-refresh graph/docs query usability. Run full repository and packaging
gates only after focused tests pass.

## Operational Considerations

- Active refresh pins daemon lifetime independently of connected client count.
- Health evidence remains bounded and redacted and never exposes absolute
  deleted paths or raw worker/store errors.
- The prior snapshot remains non-fresh but readable only under existing trust
  gates until atomic replacement publication.
- Existing worker file budgets and timeout/retention configuration remain the
  operator controls for this slice.

## Durable Promotion Targets

- `docs/design/runtime-operations-design.md`
- `docs/design/graph-store-design.md`
- `docs/reference/runtime-contracts.md`
- `docs/design/mcp-surface-design.md` if presentation changes
- `docs/reference/mvp-proof-matrix.md`
- `docs/requirements/runtime-requirements.md`
- backlog, agent-readable changelog, and closure history

## Open Questions

None. Implementation naming may vary, but ownership, lifecycle, diagnostics,
and single-path constraints are resolved above.
