---
title: Per-repo runtime daemon and shared cache design
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

- Use Node local IPC through `node:net`: Unix domain sockets on POSIX and named
  pipes on Windows. No TCP listener is introduced.
- The daemon identity is derived from canonical repo root, runtime version,
  graph schema version, and protocol version.
- POSIX socket paths live under an owner-only Agent Workbench directory in
  `os.tmpdir()` with a short hash of the identity to avoid Unix socket
  path-length failures. Windows named pipes use the same identity hash under
  `\\.\pipe\auriora-agent-workbench-<hash>`.
- Repo-local metadata lives under `.cache/agent-workbench/daemon/` and records
  canonical repo root, daemon PID, runtime version, graph schema version,
  protocol version, socket path or named pipe, and started time. Live daemon
  health reports connected client count, warmup state, graph freshness, and last
  failure when available.
- The daemon metadata and POSIX IPC directories are created with owner-only
  permissions where the platform supports POSIX modes. Windows named pipes stay
  local to the host. Malformed or cross-repo clients are rejected during
  handshake before MCP frames are proxied.
- Stale socket state is cleaned only when metadata and OS process evidence agree
  that no live owner exists: dead PID, missing socket plus dead PID, or identity
  mismatch with no live owner. Ambiguous evidence produces a structured blocked
  state and does not remove files.

### Handshake And Proxy Framing

- A client opens the socket or named pipe and sends a single JSON handshake
  frame before any MCP traffic.
- The handshake includes protocol version, canonical repo root, runtime version,
  and graph schema version through the daemon identity.
- The daemon accepts only matching repo/runtime/schema/protocol identities.
  Mismatches return a structured rejection and the client reports
  `invalid_due_to_environment`.
- After handshake acceptance, the launcher proxies MCP JSON-RPC messages between
  stdio and daemon IPC without interpreting tool-specific payloads.
- The daemon owns MCP session registration and decrements the connected client
  count when the IPC stream closes.

### Request Routing

- The daemon hosts the existing `createAgentWorkbenchServer` runtime once.
- Stdio clients proxy MCP messages to the daemon.
- Normal request `repo_root` overrides are governed by Spec 029; the daemon
  remains bound to its launch repo.
- A request with a `repo_root` outside the daemon launch root follows the
  existing launch-root authority policy and is rejected unless the debug override
  is explicitly enabled for maintainer diagnostics.

### Lifecycle And Cleanup

- The first launcher for a repo starts the daemon when no healthy owner exists.
- Concurrent cold launchers for the same repo acquire a repo-local startup lock;
  one launcher spawns the daemon and the rest wait for the shared socket. This
  covers same-session parallel sub-agents that start MCP clients together.
- Later launchers reuse the healthy daemon for the same identity.
- The daemon exits after the last client disconnects plus a 30-second idle grace
  period. Tests may inject a shorter grace through daemon construction, but
  production behavior uses one explicit default.
- A client restart during the idle grace cancels shutdown and reuses warm state.
- A daemon crash leaves metadata behind; the next launcher classifies it as
  stale only after PID and socket evidence prove the owner is gone.

### Graph Store Ownership

- The daemon opens `.cache/agent-workbench/graph.sqlite`.
- Warmup and refresh writes run through one queue.
- Reads resolve to the latest valid snapshot when current refresh is still
  running.
- Writer failures update runtime state before returning structured blocked or
  invalid environment envelopes.
- MCP client processes do not open the graph store after the daemon is active.
  They request graph-backed work through the daemon-owned runtime.

### Failure Envelope Mapping

- Healthy daemon and refreshing graph state maps to `runtime_state: refreshing`
  and `freshness: refreshing` when a request can continue against a known
  in-progress refresh.
- Missing, rejected, or incompatible daemon/socket identity maps to
  `analysis_validity: invalid_due_to_environment` and
  `verification_status: blocked`.
- Ambiguous stale-owner evidence, blocked graph-store startup, malformed socket
  handshake, or unavailable graph evidence maps to `verification_status:
  blocked` with a diagnostic that names the missing or unsafe evidence.
- Raw SQLite lock messages are never returned as non-JSON tool output. Lock
  failures are captured as daemon last-failure state and surfaced through the
  structured envelope vocabulary.

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

Runtime MCP health/debug state is the authoritative first diagnostic surface.
The developer CLI may expose the same state as a thin client in T005, but the
runtime surface owns the contract.

## Operational Considerations

- No TCP listener; use local OS IPC only.
- The daemon must not hide startup failures behind client retries.
- Keep package install cleanup aware of stale sockets/cache only through doctor
  or explicit debug cleanup, not automatic destructive removal.
- Keep daemon startup single-path. Do not add alternate graph-store fallbacks,
  parser fallbacks, or client-side retry loops that mask root causes.

## Open Questions

No T001-blocking open questions remain. The local IPC implementation is Node
local IPC through Unix domain sockets on POSIX and named pipes on Windows. The
first diagnostic surface is runtime MCP health/debug state, with a dev CLI
wrapper allowed only as a thin client if T005 ships it.
