---
title: Runtime operations design
doc_type: design
status: draft
owner: platform
last_reviewed: 2026-08-01
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Runtime Operations Design

## Purpose

Define caching, warm-up, background work, and concurrency for the Agent IDE
runtime. These concerns are architectural primitives, not incidental
optimizations.

## Scope

This design covers cache ownership, invalidation, startup warm-up, async job
coordination, worker isolation, SQLite concurrency, runtime ownership, and the
runtime signals that observability should report. OpenTelemetry configuration,
Jaeger export, repo-local debug harnesses, and profiling guidance are owned by
[Observability and debugging design](observability-debugging-design.md).

## Distributed Runtime Artifacts

The TypeScript source tree under `src/` remains implementation authority and
the place for developer-time wrappers, tests, and direct source execution.
Distributed launches from npm packages, plugin installations, containers, and
repo-local materialization use compiled ESM artifacts under `dist/mcp/`.

The build and install lifecycle validates a deterministic receipt over the
runtime source inputs, build-contract inputs, package version, esbuild version,
entrypoints, and build options. Packaging and installation boundaries must fail
closed if the compiled artifacts are missing, stale, or targeted at the wrong
path. There is no source-wrapper fallback in a distributed launch path.

On POSIX, the repo-local installer builds the runtime before it materializes
the plugin/package payload. A failed build or receipt check stops registration
before the local install is updated. Rollback and rematerialization therefore
reinstall the package payload and refresh the materialized pointers together so
cached launch data does not keep targeting stale output.

Runtime-root pointers and explicit overrides resolve the installed package root
that exposes the compiled entrypoints. A checkout override is a snapshot of the
last successful repo-local build: rerun the repo-local installer after source
changes so it rebuilds and validates the receipt before refreshing
registration. Launch itself checks that the compiled entrypoint exists; it does
not rehash the checkout on every stdio connection.

## Cache Architecture

The runtime uses explicit cache tiers with clear owners and invalidation rules.

| Cache | Owner | Backing | Invalidated By |
| --- | --- | --- | --- |
| File identity cache | file catalog infrastructure | memory plus SQLite `files` rows | file add, modify, delete, rename, scope/config change |
| Graph evidence cache | SQLite graph adapter | SQLite tables and FTS | extraction changes, resolver changes, schema migration, scope/config change |
| Query result cache | application cache port | memory or compact row store | snapshot change, budget change, query parameter change |
| Source section cache | presentation/source-section presenter | memory with byte caps | file hash change, source-byte budget change |
| Validation discovery cache | validation infrastructure | memory or SQLite when needed | tool config change, dependency/config file change |
| Report cache | post-MVP reporting infrastructure | generated cache root or SQLite | graph snapshot change, report config change |

Cache rules:

- source files and repo config remain canonical
- SQLite graph rows are derived evidence, not source truth
- in-memory caches must be scoped to a snapshot id or file content hash
- hot-path tools may read caches but must expose freshness and truncation
- cache misses must not trigger hidden broad scans inside presentation or MCP
  handlers
- generated cache files must live under approved generated-cache roots

## Warm-Up Process

Warm-up is a background application flow that prepares the runtime for cheap
MCP reads.

```text
bind repo
-> load runtime config and scope
-> open or migrate SQLite graph store
-> validate latest snapshot
-> scan docs/config priority set and compute document identities
-> refresh docs FTS for Markdown path/title/headings/selected text
-> extract and validate the documentation concern index
-> scan scoped graph seed files and compute identities
-> enqueue changed files for extraction
-> run tree-sitter extraction workers
-> ingest extraction batches through graph ports
-> resolve references
-> refresh FTS
-> persist concern state, terms, and owner evidence for the target snapshot
-> publish watcher-clean snapshot
-> expose fresh status
```

The docs/config seed is separate from the graph seed. It must use normal scope,
ignore, and workspace-safety policy, but it is not limited to the first page of
source files selected for parser extraction. The graph seed may remain bounded
for startup responsiveness; when that seed truncates before covering the
eligible graph scope, public graph evidence remains non-complete and reports
`refreshing` freshness or coverage metadata until completion work exists.

The daemon-owned refresh controller is the sole admission and execution
authority for this flow. Startup, bounded first-read path validity, and the
daemon watcher/change queue all submit invalidation generations through the
same `SnapshotRefreshPort`. The controller linearizes admission, reuses a
planned or running execution, and retains at most one sequential catch-up for
the newest generation. It never starts parallel writers or treats catch-up as
failure retry.

Warm-up presentation states:

- `cold`: no usable graph exists
- `refreshing`: warm-up or incremental update is running
- `fresh`: current watcher queue is drained and snapshot matches scope/config
- `stale`: changes are known but not yet incorporated
- `degraded`: required parser, database, or filesystem capability is missing

These are freshness/presentation labels, not snapshot publication states. A
completed bounded scan can be published with partial graph coverage; Spec 051
defines the completion path beyond the existing seed bounds under EB014, and
partial coverage remains explicit until a complete slice publishes.

For a bounded large-repository build, the worker returns one of two validated
results per invocation: `partial` with a durable cursor and partial kind, or
`complete`. The controller arms a fresh deadline for every pass. A
`publish_seed` partial is atomically published so first-read queries can use its
truthful bounded evidence; the controller then allocates one isolated target.
Subsequent `continue_build` results reuse that target and never expose it to
ordinary queries. A newer invalidation generation supersedes the current target
before either partial publication or continuation. Only a generation-matching
`complete` result permits the final atomic publish.

Production refresh passes bound source extraction separately from the catalog
window so cross-file resolution cannot consume the whole worker deadline. The
controller automatically consumes every durable extraction continuation; the
per-pass bound never caps total repository extraction. After extraction is
exhausted, accumulated unresolved references advance through their own durable
numeric cursor in bounded pages. Resolved edges and removal of their unresolved
rows are atomic, genuinely unresolved rows remain available as evidence, and a
fresh deadline is armed for every resolution page.

Workers emit validated aggregate progress for composition, catalog,
extraction, documentation, graph-write, resolution, and finalization phases.
The controller retains the latest phase and completed-unit lower bound in its
diagnostics receipt, including after timeout or failure. Progress contains no
repository paths, source text, raw exceptions, or store details.

Persisted `fresh` state is necessary but not sufficient for first-read reuse.
The runtime performs bounded path validation against the indexed catalog. A
complete receipt may preserve freshness only when every indexed path is still
present and each available catalog identity still matches live file size and
modified time. A missing or identity-changed path marks the snapshot stale and
idempotently requests the existing warm-up coordinator; inaccessible or
budget-incomplete evidence is degraded and remains unknown. Docs-index-only
paths without a catalog identity remain existence-validated.
Snapshot-ID-only valid-receipt caching is intentionally not used because it
cannot detect deletions or offline edits that predate runtime observation.

MVP warm-up should be explicit and observable. `repo:///status` must report
warm-up phase, snapshot freshness, queued work counts, extraction errors, and
degraded blockers.

Spec 036 accepted the docs-first seed plus explicit non-complete graph coverage
as the current behavior. EB014 (Spec 051) governs the persisted completion path
beyond the first-pass graph budget; truncated graph seed coverage remains partial
until that path publishes a complete continuation slice.

First-read resources and planning tools must return bounded current-state
evidence instead of waiting for broad hidden work. Status, scope, overview,
context, docs, diagnostics, and verification planning may use the latest
available snapshot, docs index, scanner result, provider status, or validation
discovery evidence, but they must expose stale, cold, refreshing, unavailable,
provider-limited, skipped, and budget-truncated states through response
metadata. If minimum evidence for the requested claim is unavailable, the
surface returns a structured unavailable or blocked state rather than
success-shaped data with hidden omissions.

## Prewarm Entry Points

The MCP runtime starts a graph warm-up automatically when it binds to a repo.
Agent-facing MCP resources and tools must report cold, refreshing, fresh,
stale, or degraded state instead of recommending hidden worker actions.
Internal operations such as graph prewarm are not public MCP `next_action`
values unless they are exposed through a documented public tool.

Docs search depends on this warm-up path. `docs_search` reads the warm docs FTS
index and reports cold, stale, refreshing, invalid, partial, or unavailable
index state when that evidence is not fully usable; it does not trigger a broad
Markdown scan on the hot path. Docs hits from a completed docs/config seed may
be usable while graph seed coverage remains non-complete, but response metadata
must keep those coverage classes separate. Direct docs overview, map, outline,
and read-section surfaces may still perform bounded scanner/read work because
those surfaces provide direct documentation evidence rather than search
acceleration.

Ranked documentation readiness is a separate, snapshot-bound capability check.
A visible graph may be fresh while its concern index is invalid or unavailable;
status and orientation must then lower trust rather than describe the ranked
route as healthy. `complete` and `no_map` concern states are ready. Invalid
repository-authored map or owner evidence requires source repair. Missing or
incompatible unpublished evidence is refreshable, while request-identity and
store/environment failures are not. Only refreshable readiness enters the
existing coordinator; no status read, orientation read, or search failure
creates a retry loop.

A future CLI may expose an explicit prewarm entry point so clients can prepare
repo caches before interactive agent work starts.

```text
pnpm warm -- <repo-root>
```

The command should run the same warm-up flow as the runtime, write only approved
generated cache state, and record the resulting snapshot id and repo
fingerprint. A later runtime start can reuse the fresh snapshot when the repo
fingerprint, config, and file identities still match.

Automatic and future explicit prewarm paths must not bypass normal scope,
safety, parser, or cache invalidation rules.

## Runtime Ownership

Each live MCP client session owns one lightweight stdio bridge, while all
sessions for the same repository share one daemon. The bridge import graph
excludes the daemon server, SQLite graph store, tree-sitter parsers, and MCP
registries; daemon admission comes from the lightweight daemon-client module.
Bridge lifetime is transport-owned and provider-owned: it remains alive while
both controlling stdin and the daemon socket are open, and tears down
idempotently when either terminates. It must not use a timer or resumed-stdin
keepalive, and it must not infer abandonment from task completion or idle
state. Cold-start diagnostics are also lifecycle-bound. The launch owner
captures at most a bounded tail of detached-daemon stderr only until
readiness or terminal failure, maps recognized native-loader failures to fixed
rebuild guidance in startup metadata, and then closes the pipe. Concurrent
waiters use that metadata rather than opening another diagnostic or daemon
path.

Provider agent-thread concurrency and nesting settings are multiplicative
capacity inputs for bridge count. They do not change the one-daemon-per-repo
ownership model. Independent stdio connections cannot be pooled inside the
runtime without a provider-supported multiplexed transport, so resource
verification records both per-bridge cost and the configured aggregate
cardinality inputs.

Only one runtime owns expensive warm-up and refresh work for a repo fingerprint
at a time. The per-repo daemon constructs one refresh controller, one watcher
and change queue, one repository ownership lease, one activity-lease chain, and
the sole refresh executor. The first MCP stdio launcher for a canonical repo
root starts the daemon when no healthy owner exists; later launchers connect to
it instead of opening their own graph store or starting warm-up writers.

Connection-specific servers retain provider and session identity, but receive
the same narrow refresh request and awaited-diagnostics ports. A standalone
server uses the same controller implementation only after the repository lease
proves that no healthy daemon or standalone owner exists. Active or ambiguous
ownership returns structured blocked evidence and does not create local
`planned` state or choose another executor.

Ownership states:

- `owner`: this process owns warm-up and refresh work
- `observer`: another active owner exists, so this process uses current caches
  and reports owner state
- `stale_owner`: an owner heartbeat is old enough to require caution
- `dead_owner`: the previous owner is gone and ownership may be reclaimed
- `isolated_worker`: explicit debugging mode that does not replace the owner
  record

The owner record lives in generated runtime cache state and includes repo
fingerprint, process identity, heartbeat time, schema version, owner generation,
and snapshot identity. There is no public manual-refresh route. All ordinary
triggers follow the same ownership rule and report `owner_active` when another
process owns the repo.

Daemon compatibility identity is derived from canonical repo root, runtime
version, graph schema version, daemon protocol version, and the runtime build
fingerprint. Installed bundles derive it from the packaged build
receipt; checkout-backed source entrypoints derive it from current runtime
source inputs so an unrebuilt `dist/` receipt cannot hide source changes. A
missing installed receipt blocks startup. The canonical admission hash and IPC
path exclude the build fingerprint so reinstalling a different build under the
same version converges on the existing endpoint and performs one serialized
handoff instead of leaving the older process authoritative. The IPC endpoint is
local-only:
Unix domain sockets on POSIX and named pipes on Windows. Repo-local lifecycle
receipts and startup locks under `.cache/agent-workbench/daemon/` use the short
identity hash in their filenames and record PID, socket or pipe path, and
identity evidence; live daemon health reports connected client count, warm-up
state, graph freshness, and last failure when available. Socket paths use the
same short identity hash under an owner-only OS temp directory on POSIX to
avoid path-length failures; Windows named pipes use it in the pipe name.

Cold daemon startup is serialized with an identity-scoped repo-local startup
lock so parallel agent clients and same-session sub-agents using the same
runtime identity elect one daemon starter. When the base identity matches but
the packaged build fingerprint differs or is absent from legacy metadata, a
launcher verifies the canonical metadata and endpoint, asks the exact recorded
PID to shut down with `SIGTERM`, waits for launch-aware cleanup, and re-enters
the same startup election. Graceful drain is bounded so a stalled worker cannot
hold replacement indefinitely; positive dead-process recovery remains the only
cleanup route if that bound expires. Other identity mismatches remain blocked
and never authorize process signalling. During a rolling version, schema, or
protocol upgrade, an older base identity may continue serving retained bridges
while the current identity starts independently; their graph-refresh work
remains serialized by the repository ownership lease. A new identity may publish a ready observer
endpoint while the older identity retains that lease; its refresh triggers
return structured `owner_active` evidence and do not enter local `planned`
state. Legacy unsuffixed admission files remain owned
by the runtime that created them and are neither overwritten nor deleted by a
new runtime. Stale owner cleanup requires positive evidence. The launcher may
remove stale socket metadata only when PID and socket evidence prove the owner
is gone. Ambiguous evidence must produce a structured blocked state rather than
destructive cleanup.

The daemon metadata record is also the authoritative cold-start lifecycle
receipt. It moves through `starting`, `ready`, or terminal `failed` state and
identifies one launch attempt, daemon identity, process, endpoint, timestamps,
and a bounded startup phase or safe failure code. Each transition is published
atomically so concurrent launchers observe either the previous complete receipt
or the next complete receipt, never a partially written record.

The elected launcher observes its spawned process until readiness or terminal
failure. Other launchers wait on the same receipt and must not spawn a
competitor while the recorded starter is positively alive. Process exit and
terminal failure fail immediately; ordinary progress never extends the one
monotonic startup deadline. Reaching that deadline while ownership remains live
preserves the `starting` receipt and does not authorize cleanup or a second
startup path. Positive dead-process evidence permits guarded re-election within
the caller's original deadline, including when a lock owner dies before
publishing its first receipt or a previously ready daemon disappears before
connection.

`ready` is published after compatible graph-store opening, shared request
service construction, socket binding, and endpoint metadata publication
succeed. Repository ownership, orphan reconciliation, and controller
construction occur through the single lazy refresh authority when a trigger
can acquire the lease. Broad graph refresh remains asynchronous after the
endpoint is ready. Binding early and queueing MCP traffic behind incomplete
startup is not an alternate readiness route.

Shutdown takes the same startup lock before removing canonical socket or
metadata state. Cleanup is launch-token aware, so an old daemon cannot delete a
replacement launch receipt that has already become authoritative.

Positive dead-owner recovery atomically reclaims the repository lease and marks
matching orphaned `building` snapshots `failed` and invisible. Recovery retains
a bounded owner chain and structured `orphaned_build` evidence. It never unlinks
a live socket or treats an inconclusive process check as permission to clean up.
An installed runtime upgrade may reconcile a positively dead prior-runtime
owner when the repository and graph schema still match and every building
snapshot names an exact recovered owner generation. A schema mismatch remains
ambiguous and blocks startup rather than mutating the derived store.
Snapshot retention on the interactive publication path deletes only retired
snapshots and their exact FTS rows. Full-index rebuilding, FTS optimization, and
database `VACUUM` are explicit maintenance concerns because they can outlive
the worker deadline and otherwise delay status, publication, and client
recovery behind repository-wide derived-storage work. Every foreign-key child
used by retention cleanup is indexed so deleting nodes does not repeatedly scan
the unresolved-reference universe.
First insertion of a file performs no node-FTS cleanup because stale rows
cannot exist; even a file-identity predicate scans the unindexed FTS identity
column. True same-snapshot replacement retains file/snapshot-scoped cleanup,
and the removed repository-wide exclusion sweep must not return. These
constraints preserve removal correctness without repeating global work for
every newly indexed file. Duplicate same-identity node-FTS rows remain
the separate EB062 identity/storage decision.
Startup, shutdown, timeout, crash replacement, and failed publication unwind
worker, writer, activity, graph-store, socket, metadata, WAL/SHM, and child
resources exactly once along the applicable drain or dead-owner path.

## Async And Concurrency Model

The runtime is async-first and uses bounded queues. It must support concurrent
agent reads while background indexing proceeds.

Concurrency components:

- `WorkQueuePort`: schedules scan, extraction, resolution, FTS, validation
  discovery, and report-generation jobs.
- `WorkerPoolPort`: executes CPU-heavy parser work in isolated workers with
  timeouts and recycling.
- `SnapshotRefreshControllerPort`: linearizes invalidation generations,
  execution, activity leases, worker invocation, and terminal state.
- `SnapshotPublicationPort`: allocates building snapshots and atomically
  transitions them to `published`, `superseded`, or `failed`.
- `GraphTransactionPort`: commits graph writes atomically.
- `CancellationPort`: cancels obsolete work when file hashes, scope, or config
  change.

Queue priorities:

- `fast`: file identity, scoped status, changed-file extraction, reference
  cleanup, FTS updates needed for hot reads
- `medium`: validation discovery, nearest-test hints, broader impact updates,
  summary refresh
- `slow`: full diagnostics, report generation, dead-code/security scans, broad
  graph analysis

Fast jobs must remain bounded and should not wait behind slow jobs. Slow jobs
must be cancellable when scope, config, or file identities change.

Concurrency rules:

- MCP reads must not block on broad warm-up work unless the requested operation
  requires fresh evidence.
- Mutating operations require a fresh preview and current file identity.
- Only one graph writer transaction runs per repository at a time.
- Multiple read transactions may run concurrently against the last valid
  snapshot.
- Parser workers cannot mutate graph state directly.
- MCP client processes must proxy graph-backed requests to the daemon-owned
  runtime after the daemon is active; they must not open independent graph
  stores for the same repo.
- Parallel clients for the same repo must not spawn competing cold-start daemon
  owners; they wait on the same repo daemon socket after one launcher wins the
  startup lock.
- Admission to `planned` acquires a controller-owned activity lease before the
  request resolves. The lease spans every coalesced pass and is released exactly
  once at `complete` or `failed`; requester disconnect cannot release it.
- The daemon arms its configured idle grace only when the last client is gone
  and no activity lease is held. It rechecks both conditions before shutdown;
  reconnect or new activity cancels the armed timer.
- Every worker pass has a finite controller-owned deadline and must exit zero
  after emitting exactly one valid completion result. Deadline, worker error,
  missing/invalid/multiple result, or non-zero exit is terminal structured
  failure. Worker termination must be confirmed before a successor can start.
- Failure callbacks, timers, health reads, and terminal notifications never
  retry. The first later ordinary stale request may admit one successor; all
  concurrent requests reuse it.

Daemon and graph-store failures must use the runtime envelope vocabulary.
Refreshing graph state maps to `refreshing`; incompatible or missing daemon
identity maps to `invalid_due_to_environment`; ambiguous owner state, blocked
graph-store startup, malformed socket handshakes, and unavailable graph evidence
map to `blocked` with the missing evidence named. Raw `database is locked`
output must not escape as non-JSON tool output.
- Obsolete extraction results are rejected when their file hash or snapshot id
  no longer matches.
- Watcher bursts are debounced before enqueueing incremental work.
- Worker timeouts produce degraded evidence and structured attention items.

Repo-local debug sweeps are intentionally separate from runtime warm-up
ownership. A sweep may create isolated per-repo runtimes and generated report
artifacts under this repository's `.tmp` tree, but it does not become the owner
of an original external repository. If sweep execution is parallelized later,
parallelism should be bounded across independent repo runtimes. Per-repo graph
writes, workspace-write preview/apply pairs, and progress/final report
publication remain serialized so result ordering, cancellation, and RCA
evidence stay deterministic.

## Ports

MVP operation ports:

- `CachePort`
- `CacheInvalidationPort`
- `WarmupCoordinatorPort`
- `WorkQueuePort`
- `WorkerPoolPort`
- `CancellationPort`
- `SnapshotCoordinatorPort`
- `RuntimeOwnerPort`
- `SnapshotRefreshPort`
- `SnapshotRefreshControllerPort`
- `SnapshotRefreshDiagnosticsPort`
- `SnapshotRefreshAdmissionFailurePort`
- `SnapshotPublicationPort`
- `RefreshExecutorPort`
- `RefreshDeadlineSchedulerPort`
- `StateStorePort`
- `TelemetryPort`

Infrastructure implementations may use Node async tasks, worker threads,
SQLite transactions, filesystem watchers, and in-memory maps behind these
ports.

## Observability Signals

OpenTelemetry is the default observability mechanism for runtime operations,
but it must stay disabled by default. The canonical configuration, Jaeger/OTLP
export rules, repo-local debug harness rules, profiling guidance, and
low-impact monitoring candidates live in
[Observability and debugging design](observability-debugging-design.md).

Runtime operations should expose signals that observability can record:

- MCP dispatch, use-case, graph-query, parser-worker, and presenter spans
- latency, queue depth, cache hit/miss counts, parser timeouts, graph write
  duration, and snapshot freshness age
- structured operational errors with stable codes and redacted paths
- quiet-feedback suppression counters when they help tune agent-facing output

Usage records are not a substitute for OTEL. They are optional durable product
events for runtime features that need local query history, such as repeated
low-confidence results, validation gaps, or usage-gap reports. Do not add a
`UsageRecorderPort` in MVP unless a fixture-backed query requires persisted
workflow history.

## Boundary Rules

- Presentation and MCP layers never manage caches or queues.
- Application use cases may request cache-backed reads through ports, but they
  do not know the cache backing.
- Infrastructure owns cache mechanics, worker threads, filesystem watchers, and
  SQLite locking.
- Domain policies decide whether stale, partial, or degraded evidence is valid
  for an operation.
- OTEL instrumentation is added at infrastructure, application, and
  presentation boundaries without changing domain behavior.

## Tests And Telemetry

MVP tests should cover:

- cold-to-fresh warm-up
- stale-to-refreshing-to-fresh incremental update
- watcher burst debouncing
- obsolete extraction result rejection
- parser timeout degradation
- concurrent read during refresh
- single-writer graph transaction behavior
- cache invalidation after add, modify, delete, rename, and config change

Runtime status should expose:

- warm-up phase
- queue depths
- active worker count
- last successful snapshot id
- graph schema version
- cache hit/miss counters where useful
- stale cleanup counts
- parser timeout counts
- degraded operation reasons
- runtime owner state
- OTEL trace ids where useful for debugging

## Workspace Watcher Freshness

The workspace watcher is the runtime's local freshness signal, not a second
indexing pipeline. Filesystem events, hook signals, and future editor signals
feed the same application-level change queue. The queue applies the shared path
policy, debounces bursts, coalesces repeated events, marks included changes
stale, and schedules bounded background rescan through the existing repository
indexing path.

The first implementation is stale-rescan first:

- watcher roots are derived from `indexed_roots`, defaulting to `.`;
- default skipped roots, configured skipped roots, generated/vendor paths,
  hidden local-state paths, nested Git repositories, symlink escapes, root
  `.gitignore`, and root `.aiignore` are filtered before events reach indexing
  work;
- create, modify, delete, and rename events for included files mark the active
  snapshot stale before hot-path tools can report fresh evidence;
- repeated modify events are coalesced within the debounce window;
- rename events are handled as delete old path plus refresh new path when both
  paths are available, or as a fresh-path event plus stale snapshot marking when
  the platform watcher omits the old path;
- event-budget overflow, native watcher overflow, deleted watch roots,
  permission errors, and processing failures keep watcher freshness stale or
  degraded with structured caveats;
- hooks route through the same queue and must not write SQLite, graph, docs, or
  FTS rows directly.

The queue intentionally does not perform per-file graph/docs/FTS mutation in
this slice. A future incremental indexer must define explicit port contracts and
fixture-backed tests before changing graph, docs, node FTS, or docs FTS rows
directly from file events.

First-read path validation and watcher events call the same daemon-owned refresh
controller. Each accepted trigger advances or joins one monotonic invalidation
generation. A request reuses an already planned or running execution; a newer
generation during active work supersedes the unpublished pass and produces one
sequential newest-generation catch-up before `complete`.

The controller exposes one awaited diagnostics receipt containing controller
and diagnostic revisions, worker invocation count, execution and invalidation
identities, target and visible snapshot identities, execution/publication
states, authoritative freshness, activity and worker-termination state, and a
bounded structured last failure. Status and integration health consume this
receipt; they do not reconstruct state from connection-local booleans or a
separate snapshot read.

## Related Docs

- [Layered runtime architecture](layered-runtime-architecture.md)
- [Graph store design](graph-store-design.md)
- [MCP surface design](mcp-surface-design.md)
- [Workspace safety contract](../reference/workspace-safety-contract.md)
- [Runtime requirements](../requirements/runtime-requirements.md)
