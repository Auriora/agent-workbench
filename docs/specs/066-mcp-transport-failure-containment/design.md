---
title: MCP transport failure containment design
doc_type: spec
artifact_type: design
status: active
owner: platform
last_reviewed: 2026-11-06
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Design

## Overview

The bridge owns one client connection; the daemon owns shared repository state.
This slice contains transport failures without changing refresh ownership.

## High-Level Design

### Decisions and boundaries

Keep MCP adapters thin and use one SDK JSON-RPC deserializer. Put transport
limits in a small canonical contract module without importing the contract
barrel into the bridge. Limits are fixed: handshake 16 KiB and incoming MCP
frame 16 MiB excluding LF. These are new admission bounds, not tool payload
schema limits; requests over the frame limit must be reduced by the caller.
There are no environment switches or alternate parsers.

## Low-Level Design

### Bridge lifecycle (Requirement 1)

Own stdout error/close handling alongside stdin/socket handlers. All terminal
events converge on the existing idempotent teardown. Diagnostics use fixed
text for new pipe failures and must not throw if stderr has already failed.
Session completion follows socket closure and never waits for caller-owned
stdout or stderr. Preserve those streams. Remove lifecycle listeners at
completion; narrow guards for already-admitted writes remain until callback,
error or stream close and are then removed with Node error-event ordering
preserved. A caller Writable that never settles may retain its pending-write
guard until close; there is no polling, retry or completion dependency.
Preserve unexpected daemon-close reporting already present in the worktree.
Never kill the daemon or reconnect.

## Input framing (Requirement 2)

Check handshake line length before accumulating unbounded data, preserving
bytes after LF as MCP remainder. In SocketServerTransport, collect bounded
frame fragments and concatenate once on completed LF, then invoke the SDK
JSON-RPC deserializer. Accept multiple valid frames in one chunk even when the
chunk's aggregate size exceeds the per-frame limit. Clear fragments on close.
Oversize errors are fixed local diagnostics and destroy only the client socket.
Maintain error-listener coverage through actual socket close.

## Sending (Requirement 3)

Each pending send owns a single-settlement cleanup routine. Subscribe before
writing where needed to avoid missed synchronous terminal events; handle write
exceptions, false/backpressure, drain, error and closure. Local transport close
rejects outstanding sends rather than waiting indefinitely. Remove both the
winning and losing event listeners after settlement.

## Deferred work (Requirement 4)

B001 owns bounded, private daemon-lifetime failure/exit evidence, including the
current stderr-reader destruction after startup. It needs launch identity,
retention, permission, privacy and abnormal-exit fixture design.
B002 owns refresh-aware shutdown settlement: current SIGTERM races close
against one second and can exit before a worker settles. It needs coordinated
worker termination/publication and upgrade/handoff fixtures, not timeout tuning.
Spec 065 continues to own endpoint relocation, migration and launch cleanup.
No task in this package modifies daemon termination or refresh ownership.
MoE warning W1 additionally routes aggregate session/input/request admission to
backlog B006; per-frame limits do not imply daemon-wide resource protection.

## Validation and promotion

See verification.md. Promote implemented semantics into runtime contracts,
runtime operations design and the Codex runbook. Keep this package retained
with truthful task evidence until commit/closure metadata can be recorded;
do not invent a commit or mark deferred daemon work implemented.

## Operational Considerations

Installation is separate from source implementation. Fixed frame limits reject
oversized requests; operators reduce those requests rather than delete derived
state. B001/B002 capture unfinished process-lifecycle work. No new settings or
telemetry fields are introduced.

## Open Questions

None block the bounded transport slice. Daemon failure persistence and shutdown
protocol decisions are explicitly deferred to backlog B001/B002. No external
authority import risk was found; canonical owners are local, directly read files,
so a separate canonical-context artifact would duplicate them.
