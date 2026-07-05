---
title: Workspace watcher ignore sync design
doc_type: spec
artifact_type: design
status: active
owner: platform
last_reviewed: 2026-07-05
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Design

## Overview

The watcher should become the runtime's local freshness signal, but it should
not become an alternate indexing implementation. Filesystem events, hook events,
and future editor signals should all feed a single application-level change
queue that applies catalog policy, debounces bursts, and either performs a
bounded incremental refresh or marks the snapshot stale for background rescan.

## High-Level Design

### Components

- `WorkspaceWatcherPort`: existing port for starting, stopping, polling, and
  resetting watch sessions.
- Filesystem watcher adapter: infrastructure-owned adapter that watches
  included roots and emits normalized `WorkspaceFileEvent` records.
- Inclusion policy service: shared policy used by catalog scans, watcher event
  filters, docs path checks, and file identity checks.
- Change queue use case: application layer that coalesces events, decides
  incremental refresh versus stale rescan, and records freshness state.
- Graph maintenance store: existing SQLite maintenance operations for removing
  file-scoped rows and pruning stale snapshot data.
- Background index worker: existing worker path used for bounded rescans after
  overflow, ignored-rule changes, or unsupported incremental updates.

### Data Flow

```text
filesystem watcher / hook signal
  -> normalize repo-relative event
  -> apply shared inclusion policy
  -> debounce and coalesce queue
  -> mark snapshot stale and schedule bounded rescan for included changes
  -> update snapshot freshness
  -> MCP tools expose fresh, refreshing, stale, or degraded evidence
```

### Watch Scope

Watch roots are derived from `indexed_roots`, defaulting to `.`. The adapter
must not recursively subscribe to known generated roots where platform support
allows directory-level exclusion. Because platform watcher APIs differ, event
filtering remains mandatory even when root subscription is narrow.

The policy inputs are:

- `indexed_roots`
- caller `skipped_roots`
- default skipped roots
- allowed hidden repository-shape paths
- root `.gitignore`
- root `.aiignore`
- nested Git repository detection
- workspace escape checks

## Low-Level Design

### Shared Ignore Rule Loading

Catalog scan already parses root `.gitignore` with `parseGitignoreRules`.
Root `.aiignore` should use the same parser. The shared policy should expose
one rule set for all ignore-style files while preserving enough diagnostics to
report that a path matched root ignore-file policy.

Initial `.aiignore` ingestion can remain scanner-local. Watcher implementation
should extract the rule loading into a shared policy helper before adding event
filtering.

### Event Coalescing

The queue should normalize events by repo-relative path:

- `created` followed by `modified` becomes one refresh.
- multiple `modified` events become one refresh.
- `deleted` removes pending refresh work for the same path.
- `renamed` becomes delete `old_path` and refresh `path`.
- ignored paths are dropped before coalescing.

Platform watcher adapters must normalize OS-specific behavior before events
reach the application queue:

- recursive watching is best effort; event filtering is authoritative on every
  platform even when directory-level exclusion is available
- atomic-save temp files and editor swap files are filtered by the shared path
  policy before coalescing
- rename events without an old path are treated as a fresh path event plus stale
  snapshot marking
- case-only renames are normalized through repo-relative path comparison without
  assuming case-sensitive filesystems
- symlink escapes, symlink loops, permission errors, deleted watch roots, and
  nested Git repositories produce stale or degraded watcher state instead of
  partial event application
- native overflow signals from inotify, FSEvents, ReadDirectoryChangesW, or a
  polling adapter mark the snapshot stale and request bounded rescan

The debounce interval should be configurable through runtime configuration,
with a conservative default. The queue must also have a maximum event budget.
Budget overflow marks the snapshot stale and schedules bounded rescan.

### Change Handling Strategy

The first watcher implementation is stale-rescan first. It must not add a
single-file parser/indexer path, and it must not mutate docs or graph FTS tables
directly from events. Included create, modify, delete, and rename events mark the
active snapshot stale, coalesce duplicate work, and schedule one bounded
background rescan through the existing repository indexing path.

This choice avoids a second indexing pipeline and matches the current durable
port shape: graph file cleanup has file-scoped operations, but docs indexing is
currently snapshot-scoped. A later spec may add per-file graph/docs maintenance
only after it defines a clean port contract and fixture-backed tests for docs
rows, docs FTS rows, graph nodes, edges, unresolved references, and node FTS
rows.

The queue should deduplicate rescan requests while a rescan is already pending
or running. A successful rescan publishes a new fresh snapshot; failure keeps the
previous snapshot available with stale or degraded freshness metadata.

### Freshness State

The runtime should maintain watcher freshness separately from query execution:

- `fresh`: watcher active, queue drained, active snapshot matches scope and
  ignore rules.
- `refreshing`: queue is draining or background refresh is active.
- `stale`: watcher unavailable, overflow occurred, scope changed, ignore rules
  changed, or rescan is required.
- `degraded`: event processing failed with structured caveat evidence.

MCP presenters should surface existing `stale_watcher_snapshot` caveats when
freshness is not proven.

### Hook Integration

Hooks can be useful for editors or Git operations, but they must call the same
change queue as the filesystem watcher. Hooks must not write SQLite rows and
must not bypass inclusion policy.

## Operational Considerations

- Watcher startup must not block MCP startup. It should run after or beside
  warmup work and report structured unavailable/stale state if startup fails.
- Watcher shutdown must close OS handles and stop queue drains before runtime
  disposal completes.
- Ignore-file changes should invalidate current policy and trigger bounded
  rescan rather than trying to replay old events under new rules.
- Event storms from package managers or build tools should be controlled by
  included-root selection, policy filtering, debounce, and overflow fallback.
- Platform-specific watcher behavior should be hidden inside infrastructure;
  application use cases should consume normalized `WorkspaceFileEvent` records.
- Watcher enablement, debounce interval, and queue budget should be configured
  through existing runtime/domain contract surfaces, not by adding a new
  top-level `src/config/` ownership root unless a later design promotes one.

## Open Questions

- Resolved 2026-07-05: the first implementation marks included file changes
  stale and schedules bounded rescan. It does not add single-file graph/docs
  refresh.
- Resolved 2026-07-05: watcher enablement, debounce interval, and event budget
  live in existing runtime/domain contract surfaces for this spec.
- Open: should ignore-rule diagnostics distinguish `.gitignore` and
  `.aiignore`, or keep one ignore-file skip category in tool responses?
