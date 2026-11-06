---
title: MCP transport failure containment requirements
doc_type: spec
artifact_type: requirements
status: active
owner: platform
last_reviewed: 2026-11-06
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Requirements

## Introduction

User-authorized repair of static-analysis findings following lost MCP connections.
The previous daemon death is not attributed to any one finding. Source analysis
reproduced an unhandled bridge stdout EPIPE and exposed unbounded input frames
and unsettled sends. This slice fixes those transport boundaries.

## Goals

- Contain client output failure to that bridge and settle its session.
- Bound incoming handshake and MCP frames without buffering repeated concatenations.
- Settle every backpressured send on drain, error, or closure and remove listeners.
- Route daemon lifetime diagnostics and shutdown work to owned backlog entries.

## Non-Goals

- Daemon restart/reconnect loops, parser fallbacks, endpoint relocation, publishing,
  installing into the user's active runtime, or changing graph ownership.
- Claiming the static findings prove the earlier incident's cause.
- Daemon-wide session, retained-input and request-admission budgets; MoE
  warning W1 is routed to backlog B006 and remains an explicit residual risk.
- Daemon lifetime evidence and shutdown drain redesign; see B001 and B002 in
  [the backlog](../../backlog/README.md#transport-reliability-follow-up).

## Durable Source Baseline

This table records the pre-repair intake baseline, not current source behavior.

| Source | Pre-repair behavior relied on | Confidence |
| --- | --- | --- |
| `src/mcp/stdio-launch.ts` | Owns stdin/socket teardown; stdout error is unhandled. | high |
| `src/mcp/socket-transport.ts` | SDK JSON-RPC parser; unbounded accumulation; sends await drain/error. | high |
| `docs/design/runtime-operations-design.md` | One daemon and refresh controller per repository identity. | high |
| `docs/runbooks/codex-agent-workbench-plugin.md` | Ownership-safe recovery and compiled installed runtime. | high |

## Durable Impact

Promote transport limits to `docs/reference/runtime-contracts.md`, lifecycle
behavior to `docs/design/runtime-operations-design.md`, recovery guidance to
`docs/runbooks/codex-agent-workbench-plugin.md`, and residuals to the backlog.

## Staged Readiness

Requirements and design are reconciled against the source. The bounded
transport implementation and targeted validation are complete. Full-suite
verification is complete after the frontmatter repair; verification.md records
the passing 133-file, 1417-test run. Template authority is the installed
Spec Lifecycle Manager skill fallback: no repository spec templates exist.
No canonical-context artifact is required: all authorities are local files.

## Requirements

### Requirement 1: Bridge output failure

**Priority:** must-have

#### Acceptance Criteria

1. WHEN stdout fails or closes while a bridge is active, THE SYSTEM SHALL
   settle the bridge, pause stdin, unpipe both streams and close its socket
   without an unhandled error or signalling the shared daemon.
2. WHEN stdin, socket, stdout and manual close race, THE SYSTEM SHALL tear
   down once and remove its lifecycle listeners; guards for already-admitted
   writes SHALL remain only until callback, error or stream close. Session
   completion SHALL NOT wait for those writes; normal termination stays quiet.
3. IF stderr itself is unavailable while reporting failure, THE SYSTEM SHALL
   still complete teardown without an unhandled stream error, closing the
   caller-owned output streams, or waiting for diagnostic write callbacks.

### Requirement 2: Bounded input

**Priority:** must-have

#### Acceptance Criteria

1. THE SYSTEM SHALL reject a handshake line exceeding 16 KiB and an MCP frame
   exceeding 16 MiB, measured in UTF-8 bytes excluding LF, with a fixed local
   error; only the offending socket SHALL close.
2. WHEN frames are fragmented, coalesced, CRLF-terminated or contain multibyte
   text, THE SYSTEM SHALL preserve SDK JSON-RPC parsing and byte-exact limits.
3. THE SYSTEM SHALL accumulate fragments without concatenating the whole
   pending frame on every chunk and SHALL clear retained fragments on close.
4. WHEN initial handshake remainder already contains MCP bytes, THE SYSTEM
   SHALL apply the same MCP frame limit; other sessions SHALL remain usable.

### Requirement 3: Send settlement

**Priority:** must-have

#### Acceptance Criteria

1. WHEN a send is backpressured, THE SYSTEM SHALL resolve on drain or reject
   on error, peer close or local transport close exactly once.
2. AFTER any send settles, THE SYSTEM SHALL remove that send's temporary
   listeners; repeated sends SHALL NOT accumulate error listeners.

### Requirement 4: Evidence and follow-up

**Priority:** must-have

#### Acceptance Criteria

1. THE SYSTEM SHALL have regression coverage for Requirements 1-3, pass
   typecheck and relevant/full tests, and record bounded executed evidence.
2. THE SYSTEM SHALL route persistent daemon failure evidence to B001 and
   worker-safe shutdown settlement to B002 with owner, priority and acceptance.
3. Durable docs SHALL describe implemented behavior separately from installed
   behavior; no install, release or historical root-cause claim is implied.

## Correctness Properties

- CP-001: One client transport failure never signals or restarts the shared daemon.
- CP-002: Every pending send settles once with no retained per-send listeners.
- CP-003: Input bounds apply before SDK parsing, including the handshake remainder.
- CP-004: Teardown completes even when error reporting cannot write stderr.

## Success Criteria

Requirements 1-4 have executed regression evidence, durable promotion and an
independent correctness review. Deferred daemon work has owned backlog routes.
