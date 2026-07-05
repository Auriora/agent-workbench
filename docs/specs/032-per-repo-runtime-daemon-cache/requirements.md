---
title: Per-repo runtime daemon and shared cache requirements
doc_type: spec
artifact_type: requirements
status: active
owner: platform
last_reviewed: 2026-07-05
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Requirements

## Introduction

Multiple agents can work in the same repository concurrently. Today, separate
Agent Workbench MCP processes can open the same repo-local graph database and
start independent warmup writers, producing `database is locked` failures. The
runtime needs one per-repo owner that coordinates shared cache/database access
for all connected agent sessions.

## Durable Source Baseline

- [Runtime operations design](../../design/runtime-operations-design.md)
- [Graph store design](../../design/graph-store-design.md)
- [MCP surface design](../../design/mcp-surface-design.md)
- [Agent Workbench backlog](../../backlog/README.md#eb036-per-repo-runtime-daemon-and-session-sharing)
- `src/server.ts`
- `src/mcp/stdio.ts`
- `src/mcp/stdio-launch.ts`
- `src/infrastructure/sqlite/graph-store.ts`
- `src/infrastructure/workers/startup-graph-warmup-worker.ts`

## Goals

- Run one runtime daemon per repository root.
- Route multiple MCP clients for the same repo to that daemon.
- Serialize graph writes and warmup ownership.
- Allow reads against the latest usable snapshot while refresh is running.
- Expose debug/doctor state for daemon PID, socket, clients, warmup, freshness,
  and failures.

## Non-Goals

- Do not introduce a network service or remote multi-user database.
- Do not add SQLite fallback databases or alternate parser/indexing paths.
- Do not return partial success when graph evidence is unavailable.
- Do not implement collaborative source-control conflict resolution.

## Requirements

### Requirement 1 (R1): One Daemon Per Repo

**User Story:** As a developer running multiple agents in one repo, I want all
Workbench clients to share one repo runtime, so that startup warmup and cache
writes do not contend.

#### Acceptance Criteria

1. GIVEN the first MCP instance for a repo starts, WHEN no daemon is active,
   THEN THE SYSTEM SHALL start one daemon for that repo.
2. GIVEN multiple MCP instances for the same repo start concurrently, including
   parallel sub-agents in the same session, THEN THE SYSTEM SHALL atomically
   elect one daemon starter and route the remaining clients to that daemon.
3. GIVEN a later MCP instance for the same repo starts, WHEN the daemon is
   healthy, THEN THE SYSTEM SHALL route the client to the existing daemon.
4. GIVEN a different repo starts, THEN THE SYSTEM SHALL use a separate daemon,
   socket, and graph store for that repo.

### Requirement 2 (R2): Shared Cache Writes Are Serialized

**User Story:** As an agent using graph-backed tools, I want cache refreshes to
be coordinated, so that I receive structured freshness states instead of SQLite
lock failures.

#### Acceptance Criteria

1. WHILE a graph refresh is running, THE SYSTEM SHALL allow compatible reads
   from the latest usable snapshot.
2. WHILE a graph refresh is running, THE SYSTEM SHALL serialize or queue later
   graph write requests for the same repo.
3. IF the graph store, daemon, or socket is unavailable, THEN THE SYSTEM SHALL
   return `refreshing`, `blocked`, or `invalid_due_to_environment` envelopes and
   SHALL NOT expose raw `database is locked` output.

### Requirement 3 (R3): Daemon Lifecycle Tracks Clients

**User Story:** As a local user, I want the daemon to stay alive while agents
are connected and stop after they leave, so that warm cache state is reused
without leaving unmanaged processes.

#### Acceptance Criteria

1. GIVEN one or more clients are connected, THEN THE SYSTEM SHALL keep the
   daemon alive.
2. WHEN the last client disconnects, THEN THE SYSTEM SHALL stop the daemon
   after a short idle grace period.
3. IF a client restarts quickly during the grace period, THEN THE SYSTEM SHALL
   reuse the daemon rather than thrashing warmup state.
4. IF a daemon crashes, THEN THE SYSTEM SHALL clean stale socket state and allow
   a new daemon to start.

### Requirement 4 (R4): Debug And Doctor Visibility

**User Story:** As a maintainer, I want daemon state visible in diagnostics, so
that shared-cache failures can be diagnosed without guessing.

#### Acceptance Criteria

1. WHEN doctor/debug state is requested, THEN THE SYSTEM SHALL report daemon
   PID, socket path, repo root, connected client count, warmup state, graph
   freshness, and last failure.
2. WHEN normal agent-facing tools run, THEN THE SYSTEM SHALL keep daemon
   internals compact and only expose freshness or blocked-state information
   needed for the next safe action.
3. IF stale socket or owner state is detected, THEN diagnostics SHALL identify
   the cleanup or restart path.

## Correctness Properties

- **P1 Single owner:** At most one daemon startup owner and one warmup writer own
  graph writes for a repo, even when clients launch concurrently.
- **P2 Shared read stability:** Concurrent clients can read the latest usable
  snapshot during refresh without raw SQLite lock errors.
- **P3 Client lifecycle:** Daemon lifetime is reference-counted by connected
  clients plus idle grace.
- **P4 Repo isolation:** Different repos never share daemon sockets or graph
  stores.

## Success Criteria

- Two MCP clients for one repo share one daemon and one graph writer.
- Concurrent graph-backed reads return structured freshness states with no raw
  `database is locked` failures.
- Daemon lifecycle, stale socket cleanup, and separate-repo isolation are
  covered by tests and dogfood evidence.
