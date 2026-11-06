---
title: Daemon admission budget design
doc_type: spec
artifact_type: design
status: active
owner: platform
last_reviewed: 2026-11-06
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Technical design

## Overview

Implement one admission policy shared by daemon sockets and application dispatch.

### Baseline and authority

Read source at cc2102e: daemon.ts caps only its pending queue; socket-transport.ts
bounds each frame but dispatches without aggregate admission. SDK 1.29.0
Protocol._onrequest detaches handler promises, and closing aborts signals without
waiting for handler settlement. Workbench's snapshot is stale and used only for
routing; direct source and fixture evidence govern implementation claims.
Repository spec templates are absent, so the skill fallback shapes apply.
This explicit baseline and the named durable owners suffice; no separate
canonical-context file is needed.

## High-Level Design

### Policy and components

One DaemonAdmissionBudget in infrastructure/runtime owns 64 session reservations,
input counters and outstanding-message counters. Canonical limits and the session
port live in contracts and ports. No runtime configuration knobs or retry routes.
Per-session input is capped at 32 MiB. The first 64 KiB belongs to that session;
only overflow competes for the global 64 MiB pool. Eight message slots per
session reserve all 512 daemon-wide work slots by construction. A disconnected
session with running work retains its slot and charges until actual settlement.
These reservations intentionally favor isolation over borrowing idle work slots.

The daemon reserves at accept before bootstrap queueing. Session close releases
non-running charges, while running application work remains charged. Handshake
fragments reserve bytes before copying, release on terminal completion, and copy
initial remainder into bounded transport ownership. No socket data handler is
left active between handshake and transport start. Existing startup and handshake
absolute deadlines remain unchanged.

SocketServerTransport reserves incoming bytes before retaining or parsing.
Completed-frame accounting transfers to a message lease rather than disappearing
when the accumulator clears. Request IDs are unique while outstanding. SDK
unknown-request errors and builtin initialize/ping are transport-accounted until
send/cancel/close; these builtins perform no repository work. All application
request handlers are wrapped through public setRequestHandler before registry
registration, using requestId and signal to retain actual work through finally.
The wrapper refuses closed/cancelled/unclaimed requests before invoking handlers.
No SDK private-map mutation or replacement parser is introduced.

Control notifications/responses are charged until a microtask queued after the
SDK's synchronous builtin handler invocation. Current builtin notification
handlers are synchronous; there are no application notification handlers. Any
future asynchronous notification registration must extend actual-work tracking
before activation. Notifications consume the same finite message slots, preventing
a coalesced burst from creating unbounded SDK microtasks. Cancellation marks its
target cancelled but retains running work. Full response-send settlement frees a
request only after actual work settles. Socket closure does not imply settlement.

A 30-second inactivity timer exists only while a nonempty incomplete MCP frame
is buffered. Each fragment resets it; complete frames clear it. No complete
request execution deadline or ready-idle deadline is added. Output is capped at
32 MiB writable bytes and eight pending sends per session before write; existing
per-surface response budgets remain. Rejecting output never returns a truncated
successful response.

## Low-Level Design

### Shutdown quiescence

The daemon's close_clients boundary also awaits admission-budget quiescence.
SDK close alone cannot prove handler settlement. The existing Spec 068 absolute
one-second budget and terminal cleanup fence cover this wait. If disconnected
application work remains unresolved, shutdown reports blocked/resources/deadline,
retains canonical draining and ownership, and cannot admit a successor. Late
settlement cannot resume fenced cleanup. Production process exit remains the
final boundary for never-settling work; no second timeout or retry is added.

## Operational Considerations

### Bounds and limits

Accounted wire input <= 64*64 KiB + 64 MiB = 68 MiB; active/queued messages <=512;
session slots <=64 including quarantined work. Block allocation overhead,
transient socket chunks, UTF-8/JSON expansion, SDK objects, response serialization,
OS socket buffers, graph/query caches and parser workers are distinct. These
bounds are not a total-process heap or OOM guarantee. Socket queues are bounded
per session, with finite aggregate derivable from the session cap. No live
exhaustion experiment is authorized or necessary.

## Requirement and property coverage

| Requirement | Design | Validation |
| --- | --- | --- |
| Requirement 1 / CP-001 | Accept-time reservation and work quarantine | Exact cap, close and reconnect fixtures |
| Requirement 2 / CP-002 | Retained-byte pool and partial inactivity | Exact boundaries, overflow, fragmented/large frames |
| Requirement 3 / CP-003, CP-004 | Message leases and handler settlement | Deferred handlers, cancel/close/send races, healthy ping |
| Requirement 4 | Review and durable promotion | Typecheck, focused/full regression, doc checks |

## Promotion and boundaries

Update docs/security/threat-model.md, docs/design/runtime-operations-design.md,
docs/reference/runtime-contracts.md and docs/runbooks/codex-agent-workbench-plugin.md.
B006 is the only backlog item delivered. Preserve unrelated untracked Spec 065
and release drafts. No install, release, endpoint migration or pointer mutation.

## Open Questions

No blocking decision remains. SDK synchronous controls, response serialization
allocation and malformed-frame CPU-rate limitations are explicit boundaries.
