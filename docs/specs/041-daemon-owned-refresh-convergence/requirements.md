---
title: Daemon-owned refresh convergence requirements
doc_type: spec
artifact_type: requirements
status: draft
owner: platform
last_reviewed: 2026-07-19
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Requirements

## Introduction

Agent Workbench detects persisted snapshots whose indexed paths have been
deleted, but a refresh requested by a non-startup daemon client can remain
planned forever. The daemon shares the graph store while each connection owns
a private in-memory warm-up coordinator, and only the startup connection can
execute warm-up work. Daemon health consequently reports synthetic
`scheduled`/`unknown` values rather than the real execution and snapshot state.

This spec makes refresh coordination, execution, and diagnostics daemon-owned
so every client observes one convergent repository lifecycle.

## Goals

- Own startup and later snapshot refreshes in one daemon-scoped service.
- Make stale-path reads schedule exactly one executable refresh.
- Preserve refresh execution when the requesting client disconnects.
- Expose authoritative execution, freshness, and bounded failure evidence.
- Restore graph and docs query usability after successful refresh.
- Keep snapshot publication independent from freshness and evidence-class
  coverage so partial-but-complete evidence can be published safely.
- Coalesce invalidations that arrive during refresh without losing the newest
  workspace generation or introducing concurrent writers.

## Non-Goals

- Add a manual refresh tool, polling contract, retry loop, second executor, or
  partial-result fallback.
- Add provider-specific refresh behavior.
- Implement incremental per-file indexing or solve large-repository warm-up
  scale tracked by EB014.
- Change snapshot-validity detection delivered by Spec 039.
- Solve EB014 large-repository throughput, incremental indexing, or remove the
  finite refresh deadline required for operational convergence.

## Durable Source Baseline

| Source | Authority used by this spec |
| --- | --- |
| `docs/design/runtime-operations-design.md` | Daemon, refresh, queue, concurrency, and idle-lifetime ownership |
| `docs/design/graph-store-design.md` | Snapshot publication, graph-store ownership, and reader atomicity |
| `docs/reference/runtime-contracts.md` | Warm-up, freshness, health, failure, and trust vocabulary |
| `docs/design/mcp-surface-design.md` | Public status, health, and query behavior |
| `docs/requirements/runtime-requirements.md` | Enduring runtime requirements |
| `docs/backlog/README.md` EB052 | Defect evidence, priority, and acceptance baseline |
| closed Specs 039 and 040 | Accepted snapshot-validity and provider-health prerequisites |

## Requirements

### Requirement 1: One Daemon-Owned Refresh Lifecycle

**Priority:** must-have

#### Acceptance Criteria

1. **AC1.1:** GIVEN one repository daemon, WHEN startup or any connected client
   requests refresh, THEN one daemon-scoped coordinator and executor SHALL own
   that work.
2. **AC1.2:** Repeated requests while an execution is planned or running SHALL
   reuse that execution and SHALL NOT start another writer.
3. **AC1.3:** Standalone non-daemon composition SHALL use the same controller
   contract locally rather than a separate refresh implementation.
4. **AC1.4:** First-read path validity and watcher invalidation SHALL request
   refresh through the same boundary. One daemon-owned watcher and change queue
   SHALL serve all daemon clients; standalone SHALL own one local equivalent;
   connection-local watchers SHALL NOT independently schedule refreshes.
5. **AC1.5:** The controller SHALL linearize request admission and SHALL expose
   exactly `idle`, `planned`, `running`, `complete`, or `failed` as execution
   states. `cancelled` and `scheduled` SHALL NOT be canonical execution states:
   ordinary shutdown waits for terminal state, while daemon crash is reconciled
   as failed orphan recovery by the replacement owner.
6. **AC1.6:** Each accepted invalidation SHALL advance or join a monotonic
   repository invalidation generation. An invalidation newer than the active
   pass SHALL be retained as coalesced catch-up work under the same controller
   and SHALL NOT be lost when that pass finishes.

### Requirement 2: Multi-Client Convergence

**Priority:** must-have

#### Acceptance Criteria

1. **AC2.1:** GIVEN two clients on one daemon and a deleted indexed path, WHEN
   the non-startup client reads status, THEN exactly one executable refresh
   SHALL be scheduled.
2. **AC2.2:** Both clients SHALL observe the same execution transition and the
   replacement snapshot SHALL become fresh without a second client request to
   trigger work or an alternate trigger contract. Ordinary bounded reads MAY
   observe progress and completion.
3. **AC2.3:** Disconnecting the requesting client SHALL NOT cancel or strand
   daemon-owned refresh work.
4. **AC2.4:** The daemon SHALL suppress idle shutdown while refresh is active
   and start the ordinary idle grace period only after terminal execution.
5. **AC2.5:** Entering `planned` SHALL acquire a daemon activity lease before
   request admission returns. The lease SHALL remain held through every
   coalesced catch-up pass and SHALL be released exactly once after `complete`
   or `failed`; the requester socket SHALL NOT own that lease.
6. **AC2.6:** Idle shutdown SHALL revalidate both zero connected clients and no
   active controller lease when the timer fires. A new active lease SHALL cancel
   an armed idle timer, and a terminal completion notification SHALL start the
   normal idle grace only when no client remains.

### Requirement 3: Authoritative Health And Completion Evidence

**Priority:** must-have

#### Acceptance Criteria

1. **AC3.1:** Integration health SHALL derive daemon warm-up state and graph
   freshness from the shared refresh/snapshot authority through the single
   awaited diagnostics operation, not from connection-local state, synthetic
   booleans, or a separately joined snapshot read.
2. **AC3.2:** Healthy daemon warm-up state SHALL use canonical execution states
   such as `idle`, `planned`, `running`, `complete`, or `failed`; synthetic
   `scheduled` SHALL not satisfy the contract.
3. **AC3.3:** Graph freshness SHALL use canonical snapshot freshness and SHALL
   not remain `unknown` after authoritative snapshot evidence is available.
4. **AC3.4:** `last_failure` SHALL contain a stable category, safe message capped
   at 512 UTF-8 bytes, execution id, optional target snapshot id, and occurrence
   time. It SHALL redact raw SQLite, filesystem, worker stderr, stack,
   absolute-path, control-character, and secret-bearing text; remain visible
   during a later attempt; and clear atomically only after successful
   publication.
5. **AC3.5:** One diagnostics receipt SHALL identify the daemon/controller
   generation, diagnostic revision, execution id, started and requested
   invalidation generations, target snapshot id, visible published snapshot id,
   execution state, publication state, graph freshness, active-lease state, and
   structured `last_failure` when present. Optional ids SHALL be absent only
   when the corresponding execution or snapshot does not exist.
6. **AC3.6:** Valid diagnostics combinations SHALL follow this matrix:
   `idle` has no active execution or lease; `planned` and `running` hold the
   lease and keep the previous published snapshot visible; `complete` names a
   published target matching the visible snapshot and has no lease; `failed`
   has no lease, keeps the prior published snapshot visible, and includes
   `last_failure`. A published snapshot MAY be watcher-clean with partial
   evidence-class coverage; coverage SHALL NOT be inferred from publication or
   execution state. Diagnostics failure or an invalid combination SHALL change
   top-level trust/verification metadata rather than appear as healthy success.

### Requirement 4: Atomic Snapshot Replacement And Query Recovery

**Priority:** must-have

#### Acceptance Criteria

1. **AC4.1:** Readers SHALL observe either the prior non-fresh snapshot or the
   fully published replacement, never partially indexed replacement state.
2. **AC4.2:** Successful refresh SHALL advance snapshot identity and exclude
   deleted file, graph, docs, heading, FTS, and coverage records.
3. **AC4.3:** After refresh, `find_references` and `docs_search` SHALL execute
   against the replacement snapshot without stale-path blocking from removed
   entries.
4. **AC4.4:** A failed refresh SHALL leave evidence non-fresh and SHALL not
   present partial query results as successful proof.
5. **AC4.5:** Snapshot publication SHALL have a lifecycle distinct from
   freshness and coverage, with exactly `building`, `published`, `superseded`,
   or `failed` states. Ordinary latest-snapshot selection SHALL select only
   `published` snapshots. Explicit snapshot-id reads SHALL return structured
   blocked evidence for `building`, `superseded`, or `failed` snapshots rather
   than exposing their rows. A completed bounded scan MAY publish a
   watcher-clean `fresh` snapshot with partial evidence-class coverage;
   `refreshing` SHALL describe active work, not completed partial coverage. The
   forward migration SHALL transactionally classify existing non-refreshing
   rows as published and existing refreshing rows as failed, increment schema
   version, and make older runtimes block; rollback SHALL use pre-migration
   restore or the documented derived-store rebuild path, not in-place downgrade.
6. **AC4.6:** The final publication transition SHALL atomically make the target
   snapshot visible only after required file, graph, unresolved-reference,
   docs, heading, FTS, and coverage writes complete. Failure before that
   transition SHALL leave the prior published snapshot selected. A newer
   invalidation before publication SHALL make the active build `superseded` and
   invisible, and the controller SHALL run the coalesced newest generation
   sequentially before reporting `complete`.

### Requirement 5: Failure Ownership And Operational Bounds

**Priority:** must-have

#### Acceptance Criteria

1. **AC5.1:** Worker, SQLite, permission, and daemon execution failures SHALL
   terminate the shared execution as failed and use structured envelopes rather
   than raw process or lock output.
2. **AC5.2:** After failure, the first later ordinary stale request SHALL request
   one successor through the same controller when the visible published
   snapshot remains non-fresh. Failure callbacks, timers, and diagnostics reads
   SHALL NOT request a successor or introduce an automatic retry loop.
3. **AC5.3:** Refresh work SHALL retain existing file, extraction,
   snapshot-retention, and single-writer bounds; the controller-owned lifecycle
   deadline is governed separately by AC5.5.
4. **AC5.4:** One repository ownership lease SHALL govern daemon and standalone
   execution. Standalone SHALL create a local controller only after proving no
   healthy daemon owner exists; otherwise it SHALL return structured
   `owner_active` evidence without entering `planned`. Under positive
   dead-owner evidence, a replacement daemon SHALL fail and hide orphaned
   `building` snapshots, recover the writer lease, retain bounded recovery
   evidence, and request ordinary startup convergence. Ambiguous evidence SHALL
   block cleanup and execution.
5. **AC5.5:** Refresh execution SHALL have one finite controller-owned deadline.
   Deadline expiry, worker error, and worker exit without one valid completion
   message, including exit code zero, SHALL terminate the worker, fail the
   execution, mark its unpublished target `failed`, release the writer and
   activity leases, and record structured failure without automatic retry.
6. **AC5.6:** Success, failure, timeout, disconnect, idle shutdown, explicit
   shutdown, and crash replacement SHALL release or reconcile worker, writer,
   activity-lease, graph-store, socket, metadata, WAL/SHM, and child-process
   resources exactly once according to the defined drain-or-dead-owner path.

### Requirement 6: Compatibility And Layering

**Priority:** must-have

#### Acceptance Criteria

1. **AC6.1:** Existing MCP resource and tool names and provider-neutral runtime
   behavior SHALL remain compatible.
2. **AC6.2:** MCP adapters and provider launchers SHALL remain thin; refresh
   lifecycle decisions SHALL live behind an application/runtime port.
3. **AC6.3:** The controller SHALL expose a narrow service contract rather than
   leaking `InMemoryRuntimeOperationsAdapter` into daemon or presentation
   consumers.
4. **AC6.4:** No manual refresh surface, provider branch, hidden fallback,
   partial-success guard, or alternate executor SHALL be added.
5. **AC6.5:** The daemon composition root SHALL own the controller, repository
   watcher/change queue, ownership lease, activity lease integration, worker
   deadline, and awaited diagnostics binding. Application use cases SHALL
   depend on narrow ports; SQLite, filesystem watcher, worker, timer, and lock
   mechanics SHALL remain infrastructure details.
6. **AC6.6:** Spec 041 SHALL preserve current file-count, extraction, retention,
   and query bounds while adding only the finite lifecycle deadline needed for
   convergence. Throughput changes, incremental indexing, deadline tuning for
   very large repositories, and completion beyond those bounds remain EB014.

## Correctness Properties

- CP-001: At most one planned or running refresh exists per repository
  ownership lease, whether composed by the daemon or standalone runtime.
- CP-002: A refresh requested by any client reaches a terminal state that
  every connected client can observe.
- CP-003: Client disconnect cannot terminate daemon-owned refresh work.
- CP-004: Successful refresh atomically replaces stale evidence and makes
  graph/docs queries usable on the new snapshot.
- CP-005: Health never reports synthetic healthy state in place of
  authoritative execution, freshness, or failure evidence.
- CP-006: Failure never becomes useful partial success or an automatic
  alternate execution path.
- CP-007: Every accepted invalidation generation is either included in the
  published replacement or causes a sequential coalesced catch-up before the
  controller reports complete.
- CP-008: Only a published snapshot is selectable, and publication is
  independent from freshness and evidence-class coverage.
- CP-009: Active work, writer ownership, daemon lifetime, and diagnostics
  refer to the same execution/controller generation.

## Success Criteria

- A packed-and-installed-bin two-client deletion fixture proves one refresh and
  shared fresh convergence; checkout/source entrypoint evidence remains
  separately labelled.
- A requester-disconnect fixture proves daemon ownership through completion.
- Health contract fixtures prove canonical state, freshness, and failure
  transitions.
- Query fixtures prove removed paths no longer block `find_references` or
  `docs_search` after refresh.
- Barrier fixtures prove invalidation-during-refresh catch-up, atomic
  publication, deadline and zero-exit-no-message failure, idle/disconnect
  races, standalone-versus-daemon ownership, and crash/orphan recovery.
- Focused, full, plugin, skill, package, lifecycle, and Markdown checks pass.
