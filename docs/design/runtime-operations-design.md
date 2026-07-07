---
title: Runtime operations design
doc_type: design
status: draft
owner: platform
last_reviewed: 2026-05-08
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
-> scan scoped graph seed files and compute identities
-> enqueue changed files for extraction
-> run tree-sitter extraction workers
-> ingest extraction batches through graph ports
-> resolve references
-> refresh FTS
-> publish watcher-clean snapshot
-> expose fresh status
```

The docs/config seed is separate from the graph seed. It must use normal scope,
ignore, and workspace-safety policy, but it is not limited to the first page of
source files selected for parser extraction. The graph seed may remain bounded
for startup responsiveness; when that seed truncates before covering the
eligible graph scope, public graph evidence remains non-complete and reports
`refreshing` freshness or coverage metadata until completion work exists.

Warm-up states:

- `cold`: no usable graph exists
- `refreshing`: warm-up or incremental update is running
- `fresh`: current watcher queue is drained and snapshot matches scope/config
- `stale`: changes are known but not yet incorporated
- `degraded`: required parser, database, or filesystem capability is missing

MVP warm-up should be explicit and observable. `repo:///status` must report
warm-up phase, snapshot freshness, queued work counts, extraction errors, and
degraded blockers.

Spec 036 accepted the docs-first seed plus explicit non-complete graph coverage
as the current behavior. A persisted graph completion executor is deferred to
EB014 in `docs/backlog/README.md`; until that follow-up ships, truncated graph
seed coverage must not be presented as complete freshness.

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

Only one runtime should own expensive warm-up and refresh work for a repo
fingerprint at a time. The accepted implementation direction is a per-repo
daemon: the first MCP stdio launcher for a canonical repo root starts the
daemon when no healthy owner exists, and later launchers connect to it instead
of opening their own graph store or starting their own warm-up writer.

Ownership states:

- `owner`: this process owns warm-up and refresh work
- `observer`: another active owner exists, so this process uses current caches
  and reports owner state
- `stale_owner`: an owner heartbeat is old enough to require caution
- `dead_owner`: the previous owner is gone and ownership may be reclaimed
- `isolated_worker`: explicit debugging mode that does not replace the owner
  record

The owner record lives in generated runtime cache state and includes repo
fingerprint, process identity, heartbeat time, schema version, and snapshot id.
Manual refresh follows the same ownership rule and reports `owner_active` when
another process owns the repo.

Daemon identity is derived from canonical repo root, runtime version, graph
schema version, and daemon protocol version. The IPC endpoint is local-only:
Unix domain sockets on POSIX and named pipes on Windows. Repo-local metadata
under `.cache/agent-workbench/daemon/` records PID, socket or pipe path, and
identity evidence; live daemon health reports connected client count, warm-up
state, graph freshness, and last failure when available. Socket paths use a
short identity hash under an owner-only OS temp directory on POSIX to avoid
path-length failures; Windows named pipes use the same identity hash in the
pipe name.

Cold daemon startup is serialized with a repo-local startup lock so parallel
agent clients and same-session sub-agents elect one daemon starter. Stale owner
cleanup requires positive evidence. The launcher may remove stale socket
metadata only when PID and socket evidence prove the owner is gone. Ambiguous
evidence must produce a structured blocked state rather than destructive
cleanup.

## Async And Concurrency Model

The runtime is async-first and uses bounded queues. It must support concurrent
agent reads while background indexing proceeds.

Concurrency components:

- `WorkQueuePort`: schedules scan, extraction, resolution, FTS, validation
  discovery, and report-generation jobs.
- `WorkerPoolPort`: executes CPU-heavy parser work in isolated workers with
  timeouts and recycling.
- `SnapshotCoordinator`: serializes snapshot transitions and publishes fresh,
  stale, cold, or refreshing state.
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
- The daemon exits only after the last client disconnects plus a 30-second idle
  grace period. A reconnect during the grace period cancels shutdown.

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

## Related Docs

- [Layered runtime architecture](layered-runtime-architecture.md)
- [Graph store design](graph-store-design.md)
- [MCP surface design](mcp-surface-design.md)
- [Workspace safety contract](../reference/workspace-safety-contract.md)
- [Runtime requirements](../requirements/runtime-requirements.md)
