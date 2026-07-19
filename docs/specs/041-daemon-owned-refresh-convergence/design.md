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
coordinator, repository watcher/change queue, repository execution lease,
daemon activity lease, and the sole graph-refresh executor. Every
connection-specific MCP server receives the controller's narrow request and
awaited diagnostics boundaries. The standalone server composes the same
controller only after acquiring the same repository authority. Snapshot
validation and watcher invalidation therefore request work from one linearized
lifecycle rather than creating connection-local plans.

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
| Requirement 1 | Shared controller, invalidation generations, watcher ownership, executor, and canonical state machine | Controller, coalescing, and daemon lifecycle tests |
| Requirement 2 | Shared controller activity lease and terminal notification pin daemon lifetime independently of sockets | Two-client, disconnect, and idle-race package tests |
| Requirement 3 | One awaited versioned diagnostic receipt with exact identities, state matrix, and structured failure | Contract, presenter, transition, and health tests |
| Requirement 4 | Separate publication lifecycle and one atomic visibility transition | Snapshot, explicit-id, status, graph, and docs tests |
| Requirement 5 | Repository ownership lease, finite worker deadline, deterministic post-failure admission, and orphan reconciliation | Worker, lock, timeout, crash, and recovery tests |
| Requirement 6 | Narrow ports, provider-neutral composition, exact durable promotion, and EB014 boundary | Architecture, compatibility, packaging, and documentation tests |

## High-Level Design

### Daemon-Scoped Refresh Controller

The daemon constructs one controller beside its shared graph-store factory.
The controller owns:

- one `WarmupCoordinatorPort` implementation for the repository;
- one repository-scoped watcher and change queue;
- one monotonic invalidation generation and coalesced catch-up latch;
- one repository execution lease shared with standalone composition;
- one daemon activity lease and terminal transition notification;
- one executor that invokes the existing startup graph warm-up worker;
- one finite worker deadline and one-result completion protocol;
- linearized request-to-execution scheduling;
- terminal state and bounded last-failure evidence;
- one authoritative awaited diagnostics receipt.

Startup calls the same request path as first-read deletion and watcher
invalidation. Request admission runs in one controller critical section. A
request while state is `planned` or `running` returns the existing execution
identity and records the newest requested invalidation generation. If that
generation is newer than the pass already running, the controller retains one
coalesced catch-up latch. It executes the newest generation sequentially before
reporting `complete`; intermediate builds become `superseded` and are never
reader-visible.

After `failed`, only a later ordinary stale request can enter the admission
critical section and create a successor. The first such request wins and all
concurrent requests reuse it. Timers, failure callbacks, terminal
notifications, diagnostics reads, and health reads cannot request a successor.
This is the deterministic distinction between request-driven recovery and an
automatic retry loop.

### Canonical Execution State Machine

The only execution states are:

```text
idle -> planned -> running -> complete
                   |    |
                   |    -> running (coalesced next-generation pass)
                   -> failed
planned -> failed
complete -> planned (later stale request only)
failed -> planned (later stale request only)
```

`scheduled` is a presentation bug, not a state. `cancelled` is deliberately not
canonical: ordinary shutdown is refused while the activity lease is held, and
process loss is reconciled by the replacement owner as a failed orphaned build.
No state transition may skip the controller admission/transition critical
section.

Each execution records one immutable `execution_id` and may allocate a new
`target_snapshot_id` for each sequential pass. It also records
`started_generation` and `requested_generation`. `complete` is legal only when
the published target includes `requested_generation` and no catch-up latch
remains.

### Publication Lifecycle

Publication is independent from snapshot freshness and evidence-class coverage.
The canonical publication states are:

- `building`: isolated rows may be written but no ordinary or explicit-id
  reader may use them;
- `published`: all required snapshot-local writes completed and one atomic
  visibility transition made the snapshot selectable;
- `superseded`: a newer invalidation generation arrived before publication;
  the rows remain invisible and are eligible for bounded cleanup;
- `failed`: construction or publication failed, including dead-owner recovery;
  the rows remain invisible and are eligible for bounded cleanup.

A published snapshot can have `freshness: fresh` and partial graph or docs
coverage. Publication means internally complete and visible; freshness means it
matches the watcher-clean workspace generation; coverage states describe the
bounded evidence classes. A completed partial scan is therefore
partial-but-published, not permanently `refreshing`. `refreshing` is reserved
for active work presented through runtime status.

### Connection Composition

Connection-specific MCP servers retain provider identity and session state,
but receive the daemon controller's narrow ports. They do not instantiate or
own warm-up lifecycle, watcher, queue, timer, lock, or diagnostics state. The
daemon owns one watcher/change queue, so the same filesystem event cannot be
drained independently by multiple clients. First-read validation and the shared
queue both advance the controller's invalidation generation.

Standalone composition uses the same controller implementation but may create
it only after acquiring the same repository execution lease and proving that no
healthy daemon owns the repository. If a daemon or standalone owner is already
active, standalone returns structured `owner_active` observer evidence and does
not create local `planned` state or fall back to another executor.

The conceptual contract is:

```text
SnapshotRefreshPort.request({ repoRoot, reason, source })
  -> { executionId, targetSnapshotId?, state, reused,
       startedGeneration, requestedGeneration }

SnapshotRefreshDiagnosticsPort.getDiagnostics({ repoRoot })
  -> Promise<SnapshotRefreshDiagnosticsReceipt>

DaemonRefreshActivityPort.onTransition(listener)
  -> unsubscribe
```

`getDiagnostics` is the one diagnostics path. Integration health, daemon health,
and tests consume that awaited receipt; they do not join a coordinator read to a
separate snapshot read or consume a synchronous cached mirror. The transition
listener is daemon-internal lifetime coordination, not a second state or
diagnostics read. The ports do not expose the raw in-memory adapter.

## Low-Level Design

- `startAgentWorkbenchDaemon` creates one controller with the shared graph-store
  factory, repository watcher/change queue, repository lease, and activity
  transition listener before accepting clients.
- `acceptDaemonClient` injects the same request and awaited-diagnostics ports
  into each connection-specific server while keeping integration identity and
  session defaults local.
- `createAgentWorkbenchServer` uses an injected controller in daemon mode. In
  standalone mode it performs repository-owner admission before creating the
  same controller locally; ownership refusal is a structured blocked outcome.
- The controller serializes admission, worker launch, catch-up, publication,
  terminal state, and failure retention. The existing graph warm-up worker
  remains the only indexing implementation.
- The graph store records controller/owner generation and publication state for
  every build. Latest and explicit-id selection enforce publication visibility.
- Integration health awaits `getDiagnostics`; no presenter or daemon callback
  reconstructs execution/snapshot state independently.

### Authoritative Diagnostics

Integration health awaits one immutable receipt assembled inside the controller
composition boundary. Each receipt contains:

- `controller_generation`, `diagnostic_revision`, and repository identity;
- `execution_id`, `started_generation`, `requested_generation`, and
  `target_snapshot_id` when an execution/pass exists;
- `visible_snapshot_id` when a published snapshot exists;
- canonical execution and publication states;
- canonical graph freshness and `activity_lease_held`;
- structured `last_failure` when retained.

The controller increments `diagnostic_revision` after every admitted request,
execution transition, catch-up decision, publication transition, lease
transition, and failure-clear transition. Snapshot publication returns its
committed publication identity to the controller before the controller can
transition to `complete`, so a receipt never pairs state from unrelated
transitions.

Valid combinations are:

| Execution | Activity lease | Target publication | Visible snapshot | Failure |
| --- | --- | --- | --- | --- |
| `idle` | no | none | optional published snapshot | optional retained startup/recovery failure |
| `planned` | yes | none or `building` | prior published snapshot, if any | optional retained prior failure |
| `running` | yes | `building` or `superseded` during catch-up | prior published snapshot, if any | optional retained prior failure |
| `complete` | no | `published` | the same target snapshot | absent |
| `failed` | no | `failed` or `superseded` | prior published snapshot, if any | required |

`last_failure` contains `code`, a redacted UTF-8 `message` capped at 512 bytes,
`execution_id`, optional `target_snapshot_id`, and `occurred_at`. Canonical codes
include `worker_timeout`, `worker_error`, `worker_exit_without_result`,
`invalid_worker_result`, `store_failure`, `permission_failure`,
`ownership_lost`, and `orphaned_build`. Adapter output, stderr, stack text,
absolute paths, control characters, and secret-like values are removed before
the receipt is stored. Failure remains visible through a later planned/running
attempt and is cleared in the same controller transition that accepts a
successful publication.

### Lifetime And Disconnects

Admission to `planned` acquires one activity lease keyed by `execution_id`
before `request` resolves. The lease spans all sequential catch-up passes and is
released exactly once on `complete` or `failed`. Disconnecting the requester
removes only its MCP server and socket; it cannot release the lease or cancel
the controller.

The daemon transition listener cancels any armed idle timer on lease
acquisition. On terminal notification it starts the normal idle grace only when
no client remains. The timer callback revalidates both zero clients and no
activity lease before closing, and shutdown admission marks the daemon closing
before that check so no new request can race in after the decision. A reconnect
or new active lease aborts closing before socket/controller teardown.

Each worker pass has one finite controller-owned deadline. The deadline is a
required finite runtime configuration with a repository default and injectable
short test value; there is no infinite mode. Deadline expiry terminates the
worker, and worker `error`, non-zero exit, zero exit without exactly one valid
completion message, or invalid completion all enter the same terminal failure
path. That path fails the unpublished target, releases writer and activity
leases, and emits terminal notification exactly once.

### Snapshot Publication

The existing graph warm-up worker remains the only indexing executor. It writes
snapshot-isolated rows under a `building` target. Ordinary latest selection
chooses only `published` snapshots, and explicit-id reads reject every
non-published state with a structured blocked result. Readers therefore remain
pinned to the prior published non-fresh snapshot while work proceeds.

After file, graph, unresolved-reference, docs, heading, FTS, and coverage writes
and publication validation complete, one graph-store transaction changes the
target to `published` and records its invalidation/controller generation. Only
that transaction advances visibility. A newer invalidation before the
transaction changes the build to `superseded`; the controller allocates a new
target for the coalesced generation and stays `running`. Store/worker failure
changes the unpublished build to `failed`. Neither state can replace the prior
visible snapshot.

Pruning treats `building`, `superseded`, and `failed` snapshots as unpublished
build records and never counts them toward retained published/fresh snapshot
bounds. Successful publication removes deleted graph/docs/FTS evidence through
the existing snapshot-isolated path while retaining current scan, extraction,
query, and retention limits.

### Repository Ownership And Crash Reconciliation

Daemon and standalone controllers compete for one repository execution lease
identified by canonical repo root, runtime/schema identity, owner PID, owner
generation, and heartbeat. A healthy daemon owner takes precedence. Lease
refusal never creates controller `planned` state. Ambiguous PID/socket/heartbeat
evidence produces a structured block; cleanup requires positive dead-owner
evidence.

After acquiring replacement ownership, daemon startup reconciles every prior
owner `building` snapshot before admitting refresh work. It atomically marks the
build `failed` with `orphaned_build`, keeps it invisible, reconciles the stale
writer lock only after positive owner-death proof, and records bounded recovery
failure evidence. Startup then requests normal convergence through the same
controller. It does not resume unknown worker state, publish partial rows, or
launch an alternate recovery indexer.

### Persistence Migration And Rollback

Publication state requires one forward SQLite schema migration and snapshot
schema-version increment. The migration runs transactionally before controller
admission:

- existing non-`refreshing` snapshots become `published`, preserving their
  freshness, coverage, identity, and retention order;
- existing `refreshing` snapshots become `failed` with bounded
  `orphaned_pre_publication` evidence and are never selectable;
- if no published snapshot remains, status reports no visible snapshot and
  normal startup convergence requests one build through the controller;
- migration failure rolls the transaction back to the prior schema and blocks
  daemon startup without modifying selection;
- pruning cannot remove the prior published generation merely because the
  migration or first post-migration refresh started or failed.

The migrated database is not downgrade-compatible. The schema-version gate must
make an older runtime block before reading or writing it; an older runtime must
not ignore publication state. Supported rollback is to stop all owners and
either restore a pre-migration database copy or use the documented derived-store
rebuild procedure after reinstalling the older runtime. The runbook must state
the exact positive owner-death evidence and rebuild command; ad hoc database
deletion is not a supported rollback step.

## Data Flow

```text
startup | stale first read | watcher invalidation
  -> daemon-owned queue / shared SnapshotRefreshPort.request
  -> linearized generation admission and activity lease
  -> controller reuses or creates one execution
  -> sole graph warm-up worker under finite deadline
  -> supersede and catch up if requested generation advanced
  -> atomic published-state transition
  -> one awaited diagnostics receipt
  -> status, orientation, integration health, graph/docs queries
```

## Failure Behavior

- Worker, store, permission, ownership, deadline, missing-result, and invalid
  result failures mark the shared execution `failed`, preserve the prior
  published non-fresh evidence, and record structured bounded failure.
- Raw SQLite or worker output never escapes MCP envelopes.
- The controller does not retry automatically. After failure, the first later
  ordinary stale request admitted by the controller may create one new
  execution; concurrent requests reuse it.
- Daemon crash recovery requires positive PID/socket/lease evidence, fails and
  hides orphaned builds, and creates one replacement owner before requesting
  ordinary startup convergence.
- A client connecting during refresh observes the same execution and prior
  published non-fresh snapshot until publication.

## Resolved Decisions

- **D001:** Suppress idle shutdown while refresh is planned or running; begin
  normal grace only after terminal state.
- **D002:** Introduce a narrow refresh service/port; do not leak the raw runtime
  adapter to daemon, MCP, or presentation code.
- **D003:** Retain bounded `last_failure` for the daemon lifetime and clear it
  after the next successful refresh.
- **D004:** Integration health and daemon diagnostics use the controller's one
  awaited receipt. A synchronous cache, independently joined snapshot read, or
  equivalent second path is not permitted.
- **D005:** Keep one existing graph warm-up worker as the executor; no manual
  tool, retry loop, provider branch, or alternate index path.
- **D006:** Use monotonic invalidation generations and one coalesced catch-up
  latch. Newer work observed during a pass must be included before completion;
  this is not failure retry.
- **D007:** Add publication state distinct from freshness and coverage. Only
  `published` snapshots are selectable, including by explicit id; completed
  bounded evidence may be partial-but-published.
- **D008:** Use exactly `idle`, `planned`, `running`, `complete`, and `failed`.
  Do not add `cancelled`; ordinary shutdown waits and crash recovery records
  failure under a replacement owner.
- **D009:** Use one awaited diagnostics operation with exact execution,
  generation, publication, visible-snapshot, lease, freshness, and structured
  failure identity. Remove the equivalent cached/synchronous alternative.
- **D010:** Make watcher/change-queue ownership daemon-scoped, and make
  standalone execution contingent on the same repository ownership lease.
- **D011:** Hold a daemon activity lease across all passes, notify the daemon on
  active/terminal transitions, revalidate at idle-timer fire, and impose one
  finite worker deadline including zero-exit-without-result failure.
- **D012:** Reconcile prior-owner building snapshots only under positive
  dead-owner evidence; mark them failed and invisible before normal startup
  convergence.
- **D013:** Apply one transactional publication-state migration: preserve
  existing non-refreshing snapshots as published, fail existing refreshing
  rows, increment schema version, block older runtimes, and support rollback
  only by pre-migration restore or the documented derived-store rebuild path.

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
- `src/application/use-cases/get-integration-health.ts`
- `src/presentation/integration-health-presenter.ts`

## Validation Strategy

Lock the checkout/source-entrypoint failure before implementation and retain a
separate packed-and-installed-bin acceptance boundary. Then prove
controller idempotence, invalidation-during-run catch-up, two-client convergence,
requester disconnect survival, idle-boundary races, worker deadline and
zero-exit-without-result failure, standalone/daemon lease exclusion, crash
orphan reconciliation, canonical diagnostics at every transition, explicit-id
publication blocking, partial-but-published evidence, atomic publication, and
post-refresh graph/docs query usability. Run full repository and packaging
gates only after focused tests pass.

## Correctness Property Realization

| Property | Design sections |
| --- | --- |
| CP-001 | Daemon-Scoped Refresh Controller; Repository Ownership And Crash Reconciliation |
| CP-002 | Daemon-Scoped Refresh Controller; Lifetime And Disconnects; Data Flow |
| CP-003 | Lifetime And Disconnects; Connection Composition |
| CP-004 | Publication Lifecycle; Snapshot Publication |
| CP-005 | Authoritative Diagnostics |
| CP-006 | Failure Behavior; Repository Ownership And Crash Reconciliation |
| CP-007 | Daemon-Scoped Refresh Controller; Publication Lifecycle |
| CP-008 | Publication Lifecycle; Snapshot Publication; Persistence Migration And Rollback |
| CP-009 | Canonical Execution State Machine; Authoritative Diagnostics; Lifetime And Disconnects |

## Operational Considerations

- Active refresh pins daemon lifetime independently of connected client count.
- Health evidence remains bounded and redacted and never exposes absolute
  deleted paths or raw worker/store errors.
- The prior published snapshot remains non-fresh but readable only under
  existing trust gates until atomic replacement publication.
- Existing worker file, extraction, query, and retention limits remain. Spec
  041 adds a required finite lifecycle deadline and documents timeout recovery;
  throughput, incremental indexing, and large-repository deadline tuning remain
  EB014 rather than a second execution path here.

## Durable Promotion Targets

- `docs/design/runtime-operations-design.md`
- `docs/design/graph-store-design.md`
- `docs/reference/runtime-contracts.md`
- `docs/design/mcp-surface-design.md`
- `docs/reference/mvp-proof-matrix.md`
- `docs/requirements/runtime-requirements.md`
- `docs/runbooks/install-agent-workbench.md`
- `docs/backlog/README.md`
- `docs/reference/agent-readable-changelog.md`
- `docs/history/spec-closure-log.md`

## Open Questions

None. Implementation naming may vary, but generation admission, watcher and
lease ownership, execution and publication states, activity lifetime, worker
deadline, diagnostics, failure recovery, promotion, and the EB014 boundary are
resolved above.
