---
title: Workspace watcher ignore sync requirements
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

Agent Workbench currently has a workspace watcher contract and durable design
language, but no concrete watcher implementation. Repository indexing also
needs one shared inclusion policy across scanner, watcher, graph refresh, docs
queries, and future hook-driven events. This spec defines the watcher behavior
needed before implementation so file edits and deletions keep SQLite evidence
fresh without watching dependency caches or generated output.

## Durable Source Baseline

- [Runtime requirements](../../requirements/runtime-requirements.md)
- [Agent IDE system architecture](../../architecture/system-architecture.md)
- [Layered runtime architecture](../../design/layered-runtime-architecture.md)
- [Runtime operations design](../../design/runtime-operations-design.md)
- [Graph store design](../../design/graph-store-design.md)
- [Runtime contracts](../../reference/runtime-contracts.md)
- [MVP proof matrix](../../reference/mvp-proof-matrix.md)

## Goals

- Implement a concrete workspace watcher that observes only included workspace
  scope.
- Reuse the same inclusion policy as catalog scans, including root `.gitignore`
  and `.aiignore` rules.
- Keep file edit and delete events from being reported as fresh before graph,
  docs, FTS, and file catalog evidence is refreshed.
- Debounce and batch filesystem events before indexing work.
- Recover safely from watcher overflow, ignored-rule changes, and runtime
  restarts.

## Non-Goals

- Do not watch dependency caches, build output, hidden generated directories,
  nested Git checkouts, or caller-configured skipped roots.
- Do not let hooks mutate SQLite directly; hooks may only signal through the
  same runtime event path.
- Do not introduce alternate parser, semantic, or indexing fallbacks.
- Do not return partial query results as a timeout guard; report stale or
  refreshing evidence when freshness cannot be proven.
- Do not make watcher behavior depend on a specific editor or Git hook.
- Do not add a single-file graph or docs indexer in this first implementation.
  Included file changes SHALL mark the active snapshot stale and schedule a
  bounded rescan until a separate fixture-backed design adds a clean per-file
  indexing and docs-maintenance entry point.

## Requirements

### Requirement 1: Shared Inclusion Policy

**User Story:** As a runtime maintainer, I want scanner and watcher inclusion
to use the same policy, so that watched files match indexed evidence.

#### Acceptance Criteria

1. GIVEN a repository with default skipped roots, configured skipped roots,
   `.gitignore`, and `.aiignore`, WHEN watcher roots and event filters are
   built, THEN the system SHALL exclude the same paths as catalog scans.
2. GIVEN an ignored path under an indexed root, WHEN a create, modify, delete,
   or rename event is received, THEN the system SHALL drop the event before it
   reaches graph or docs mutation.
3. WHEN `.gitignore`, `.aiignore`, or configured scope changes, THEN the system
   SHALL mark current freshness stale and schedule a bounded rescan.

### Requirement 2: Watch Included Roots Only

**User Story:** As a user working in large repositories, I want watchers to
avoid package and build caches, so that local runtime overhead stays bounded.

#### Acceptance Criteria

1. GIVEN `indexed_roots`, WHEN the watcher starts, THEN it SHALL watch only
   those roots that are inside the repository and not excluded by policy.
2. IF an indexed root contains generated, vendor, hidden skipped, or nested Git
   directories, THEN the watcher SHALL filter those descendants and SHALL NOT
   enqueue their events for indexing.
3. WHEN no explicit indexed root is provided, THEN the watcher SHALL treat `.`
   as the indexed root while still applying default and ignore-file exclusions.

### Requirement 3: Debounced Event Queue

**User Story:** As a query user, I want file bursts coalesced before refreshes,
so that saves and generated editor activity do not thrash indexing.

#### Acceptance Criteria

1. GIVEN repeated modify events for the same path within the debounce window,
   WHEN the queue drains, THEN the system SHALL process one effective change.
2. GIVEN a rename event, WHEN the queue drains, THEN the system SHALL process
   it as delete old path plus create or modify new path.
3. IF the queue exceeds the configured event budget or the underlying watcher
   reports overflow, THEN the system SHALL mark evidence stale and schedule a
   bounded background rescan instead of applying incomplete events.

### Requirement 4: Evidence Invalidation And Bounded Rescan

**User Story:** As an agent using graph and docs tools, I want changed and
deleted files to invalidate freshness immediately, so that stale historical rows
are never presented as current evidence.

#### Acceptance Criteria

1. GIVEN a created, modified, deleted, or renamed included file, WHEN its event
   is processed, THEN the system SHALL mark the active snapshot stale before any
   graph-backed or docs-backed tool can report fresh evidence.
2. GIVEN an included file change, WHEN the queue drains, THEN the system SHALL
   schedule one bounded background rescan through the existing repository
   indexing path rather than mutating graph, docs, or FTS tables through a
   parallel per-file indexer.
3. IF bounded rescan cannot start or complete, THEN the system SHALL keep
   watcher freshness stale or degraded with a structured caveat.

### Requirement 5: Freshness Authority

**User Story:** As a caller of MCP tools, I want query freshness to reflect
watcher state, so that results are not presented as current after missed file
changes.

#### Acceptance Criteria

1. GIVEN the watcher queue is drained and the active snapshot matches current
   scope and ignore rules, WHEN tools report freshness, THEN freshness MAY be
   `fresh`.
2. WHILE watcher processing or background rescan is active, THEN tools SHALL
   report `refreshing` or an equivalent structured caveat.
3. IF watcher startup fails, overflows, or loses synchronization, THEN tools
   SHALL report stale watcher evidence until a successful rescan completes.

## Correctness Properties

- A path excluded by catalog scan policy is never indexed because of a watcher
  event.
- Included file changes cannot be reported as fresh until a bounded rescan
  publishes a fresh snapshot.
- Watcher overflow cannot produce a `fresh` snapshot claim.
- `.gitignore` and `.aiignore` changes invalidate prior inclusion decisions.
- Hooks and filesystem watchers converge through one event handling path.

## Success Criteria

- A concrete watcher adapter implements `WorkspaceWatcherPort`.
- Watcher setup derives roots from included scope.
- File create, modify, delete, and rename paths are covered by tests that prove
  stale marking and bounded rescan scheduling.
- Ignore-file changes trigger stale state and bounded rescan behavior.
- Runtime status and MCP responses expose watcher freshness accurately.
