---
title: Workspace watcher ignore sync requirements
doc_type: spec
artifact_type: requirements
status: active
owner: platform
last_reviewed: 2026-06-14
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
- Keep file edit and delete events reflected in graph, docs, FTS, and file
  catalog evidence.
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

### Requirement 4: Incremental Evidence Maintenance

**User Story:** As an agent using graph and docs tools, I want changed and
deleted files reflected without rebuilding stale historical rows.

#### Acceptance Criteria

1. GIVEN a deleted included file, WHEN its event is processed, THEN the system
   SHALL remove its file catalog row and related nodes, edges, unresolved
   references, FTS rows, and docs rows for the active snapshot.
2. GIVEN a modified included file with supported language identity, WHEN its
   event is processed, THEN the system SHALL refresh that file's file catalog,
   graph, docs, and FTS evidence in the active snapshot.
3. IF a modified file cannot be refreshed because parser or indexing evidence
   is unavailable, THEN the system SHALL mark freshness stale or degraded with
   a structured caveat.

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
- A deleted included file leaves no active-snapshot graph, docs, or FTS rows.
- Watcher overflow cannot produce a `fresh` snapshot claim.
- `.gitignore` and `.aiignore` changes invalidate prior inclusion decisions.
- Hooks and filesystem watchers converge through one event handling path.

## Success Criteria

- A concrete watcher adapter implements `WorkspaceWatcherPort`.
- Watcher setup derives roots from included scope.
- File create, modify, delete, and rename paths are covered by tests.
- Ignore-file changes trigger stale state and bounded rescan behavior.
- Runtime status and MCP responses expose watcher freshness accurately.
