---
title: Per-repo runtime daemon and shared cache design
doc_type: spec
artifact_type: design
status: active
owner: platform
last_reviewed: 2026-06-18
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Design

## Overview

Split the MCP stdio launcher from the per-repo runtime owner. The first client
for a repo starts a daemon that owns the graph store, warmup scheduler, and
snapshot transitions. Later clients connect to the daemon through a repo-scoped
local socket and proxy MCP requests instead of opening their own graph store.

## High-Level Design

```text
MCP stdio launcher
  -> resolve launch repo root
  -> locate repo daemon socket
  -> start daemon if absent/stale
  -> connect client session
  -> proxy MCP request/response frames

Per-repo daemon
  -> owns SQLite graph store
  -> owns warmup scheduler and writer queue
  -> tracks connected clients
  -> publishes status/freshness/diagnostics
  -> exits after last disconnect + idle grace
```

## Low-Level Design

### Socket And Identity

- Socket paths are derived from canonical repo root and schema/runtime version.
- Socket metadata includes repo root, daemon PID, runtime version, graph schema,
  started time, last heartbeat, connected client count, and last failure.
- Stale sockets are cleaned only when heartbeat/PID evidence indicates no live
  owner.

### Request Routing

- The daemon hosts the existing `createAgentWorkbenchServer` runtime once.
- Stdio clients proxy MCP messages to the daemon.
- Normal request `repo_root` overrides are governed by Spec 029; the daemon
  remains bound to its launch repo.

### Graph Store Ownership

- The daemon opens `.cache/agent-workbench/graph.sqlite`.
- Warmup and refresh writes run through one queue.
- Reads resolve to the latest valid snapshot when current refresh is still
  running.
- Writer failures update runtime state before returning structured blocked or
  invalid environment envelopes.

### Doctor State

Doctor/debug output should include:

- daemon PID
- socket path
- repo root
- connected clients
- warmup state
- graph snapshot id and freshness
- last refresh start/end
- last failure

## Operational Considerations

- No TCP listener; use local OS IPC only.
- The daemon must not hide startup failures behind client retries.
- Keep package install cleanup aware of stale sockets/cache only through doctor
  or explicit debug cleanup, not automatic destructive removal.

## Open Questions

- Which local IPC implementation should be used on each supported platform?
- Should daemon debug state surface first through runtime MCP health, the
  developer CLI doctor command, or both?
