---
title: Daemon admission budget requirements
doc_type: spec
artifact_type: requirements
status: active
owner: platform
last_reviewed: 2026-11-06
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Requirements

## Purpose and scope

Implement accepted backlog B006 at the user's request. Bound aggregate daemon
sessions, retained input and outstanding work while preserving an established
healthy client's small requests. Preserve Spec 068 shutdown and the sole refresh
writer. Endpoint relocation, npm peer metadata and abandoned guard recovery are
separately owned. No live exhaustion test or inferred OOM threshold is required.

## Goals

Bound accepted sessions and retained dispatch/work, protect an established healthy
client's reserved small-request allowance, and preserve shutdown ownership.

## Durable Source Baseline

Canonical durable owners: runtime operations, runtime contracts, threat model and
Codex operator runbook. At cc2102e only the pre-ready queue and individual frames
are capped. The SDK detaches request handlers; socket close does not settle them.
No existing durable admission policy supplies the aggregate guarantees in B006.

## Non-Goals

No endpoint relocation, dependency changes, parser replacements, rate limiter,
whole-process heap cap, OOM attribution, install or release in this slice.

## Success Criteria

All numbered criteria below have deterministic fixture evidence; required checks
and independent review pass; durable owners and B006 match the delivery.

## Requirements

### Requirement 1: Finite session admission

**Priority:** must-have

#### Acceptance Criteria

1. WHEN a socket is accepted, THE SYSTEM SHALL reserve one of 64 daemon-wide
   session slots before queuing, handshaking or creating MCP services.
2. WHEN capacity is exhausted, THEN THE SYSTEM SHALL close only the excess socket.
3. WHILE disconnected application work is unsettled, THE SYSTEM SHALL retain
   its session reservation so reconnects cannot bypass the work budget.

### Requirement 2: Retained input and slow frames

**Priority:** must-have

#### Acceptance Criteria

1. THE SYSTEM SHALL bound each session's retained input to 32 MiB, and aggregate
   shared overflow above each session's guaranteed 64 KiB allowance to 64 MiB.
   Thus accounted retained input is at most 68 MiB across 64 slots.
2. THE SYSTEM SHALL account handshake fragments, initial MCP remainder, partial
   frames, and complete frames retained by unfinished dispatch/work.
3. WHEN an incomplete MCP frame receives no bytes for 30 seconds, THE SYSTEM
   SHALL close that connection and release releasable accounting. Progress
   resets inactivity; ready idle sessions and long-running complete requests
   SHALL NOT inherit this timeout. Existing 16 KiB handshake, 16 MiB frame and
   absolute handshake/startup queue deadlines remain authoritative.
4. WHEN a byte reservation fails, THE SYSTEM SHALL reject the offending
   connection before parsing/dispatching its excess frame, without partial
   success. Memory evidence SHALL distinguish accounted wire bytes from heap.

### Requirement 3: Bounded outstanding dispatch and actual work

**Priority:** must-have

#### Acceptance Criteria

1. THE SYSTEM SHALL admit at most eight outstanding messages per session and
   512 daemon-wide, including SDK control-notification microtasks. Reserved
   per-session capacity SHALL keep another established healthy session's small
   request callable even when another session exhausts its own budget.
2. THE SYSTEM SHALL retain application request accounting until its handler
   actually settles AND its response send settles or cancellation/closure makes
   a response impossible. Disconnect/cancel SHALL NOT free running work early.
3. THE SYSTEM SHALL reject duplicate outstanding request IDs and prevent queued
   handlers from starting after their session closes. Parse/validation errors,
   send failures, cancellation, close and handler failure SHALL release once.
4. THE SYSTEM SHALL bound outbound socket queuing to 32 MiB per session and
   pending sends to eight. Saturation SHALL close the offender without daemon
   restart, retries, competing refresh writers or fabricated successful output.

### Requirement 4: Verification and promotion

**Priority:** must-have

#### Acceptance Criteria

1. Deterministic bounded fixtures SHALL prove session, byte and work saturation,
   healthy-client isolation, accounting release, slow-frame timeouts, and
   cancellation/disconnect races. Required typecheck and regression tests SHALL
   pass, and independent correctness/security review SHALL have no blockers.
2. Durable threat model, runtime operations, runtime contracts and operator
   runbook SHALL describe exact limits and recovery. Backlog disposition SHALL
   reflect measured source delivery without claiming installed/release proof.

## Correctness properties

- CP-001: Every accepted socket has exactly one finite reservation.
- CP-002: Input and work charges outlive all actual retained application work.
- CP-003: Terminal transitions release each charge exactly once.
- CP-004: One session cannot consume another session's reserved small-request share.
