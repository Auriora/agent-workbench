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

## Non-Goals

- Add a manual refresh tool, polling contract, retry loop, second executor, or
  partial-result fallback.
- Add provider-specific refresh behavior.
- Implement incremental per-file indexing or solve large-repository warm-up
  scale tracked by EB014.
- Change snapshot-validity detection delivered by Spec 039.

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

1. **AC1.1:** GIVEN one repository daemon, WHEN startup or any connected client
   requests refresh, THEN one daemon-scoped coordinator and executor SHALL own
   that work.
2. **AC1.2:** Repeated requests while an execution is planned or running SHALL
   reuse that execution and SHALL NOT start another writer.
3. **AC1.3:** Standalone non-daemon composition SHALL use the same controller
   contract locally rather than a separate refresh implementation.
4. **AC1.4:** First-read path validity and watcher invalidation SHALL request
   refresh through the same boundary.

### Requirement 2: Multi-Client Convergence

**Priority:** must-have

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

### Requirement 3: Authoritative Health And Completion Evidence

**Priority:** must-have

1. **AC3.1:** Integration health SHALL derive daemon warm-up state and graph
   freshness from the shared refresh/snapshot authority, preferably through an
   awaited diagnostic read, not from connection-local or synthetic booleans.
2. **AC3.2:** Healthy daemon warm-up state SHALL use canonical execution states
   such as `idle`, `planned`, `running`, `complete`, or `failed`; synthetic
   `scheduled` SHALL not satisfy the contract.
3. **AC3.3:** Graph freshness SHALL use canonical snapshot freshness and SHALL
   not remain `unknown` after authoritative snapshot evidence is available.
4. **AC3.4:** Failure SHALL expose bounded, redacted `last_failure` evidence;
   the next successful refresh SHALL clear it.

### Requirement 4: Atomic Snapshot Replacement And Query Recovery

**Priority:** must-have

1. **AC4.1:** Readers SHALL observe either the prior non-fresh snapshot or the
   fully published replacement, never partially indexed replacement state.
2. **AC4.2:** Successful refresh SHALL advance snapshot identity and exclude
   deleted file, graph, docs, heading, FTS, and coverage records.
3. **AC4.3:** After refresh, `find_references` and `docs_search` SHALL execute
   against the replacement snapshot without stale-path blocking from removed
   entries.
4. **AC4.4:** A failed refresh SHALL leave evidence non-fresh and SHALL not
   present partial query results as successful proof.

### Requirement 5: Failure Ownership And Operational Bounds

**Priority:** must-have

1. **AC5.1:** Worker, SQLite, permission, and daemon execution failures SHALL
   terminate the shared execution as failed and use structured envelopes rather
   than raw process or lock output.
2. **AC5.2:** A later ordinary stale first read MAY request a new execution
   through the same controller after failure; automatic retry loops SHALL not
   be introduced.
3. **AC5.3:** Refresh work SHALL retain existing file, extraction, timeout,
   snapshot-retention, and single-writer bounds.
4. **AC5.4:** Daemon shutdown or crash replacement SHALL not create parallel
   ownership or weaken existing positive-evidence cleanup rules.

### Requirement 6: Compatibility And Layering

**Priority:** must-have

1. **AC6.1:** Existing MCP resource and tool names and provider-neutral runtime
   behavior SHALL remain compatible.
2. **AC6.2:** MCP adapters and provider launchers SHALL remain thin; refresh
   lifecycle decisions SHALL live behind an application/runtime port.
3. **AC6.3:** The controller SHALL expose a narrow service contract rather than
   leaking `InMemoryRuntimeOperationsAdapter` into daemon or presentation
   consumers.
4. **AC6.4:** No manual refresh surface, provider branch, hidden fallback,
   partial-success guard, or alternate executor SHALL be added.

## Correctness Properties

- **CP-001:** At most one planned or running refresh exists per repository
  daemon.
- **CP-002:** A refresh requested by any client reaches a terminal state that
  every connected client can observe.
- **CP-003:** Client disconnect cannot terminate daemon-owned refresh work.
- **CP-004:** Successful refresh atomically replaces stale evidence and makes
  graph/docs queries usable on the new snapshot.
- **CP-005:** Health never reports synthetic healthy state in place of
  authoritative execution, freshness, or failure evidence.
- **CP-006:** Failure never becomes useful partial success or an automatic
  alternate execution path.

## Success Criteria

- A package-entrypoint two-client deletion fixture proves one refresh and
  shared fresh convergence.
- A requester-disconnect fixture proves daemon ownership through completion.
- Health contract fixtures prove canonical state, freshness, and failure
  transitions.
- Query fixtures prove removed paths no longer block `find_references` or
  `docs_search` after refresh.
- Focused, full, plugin, skill, package, lifecycle, and Markdown checks pass.
