---
title: Refresh-safe daemon shutdown requirements
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

User-authorized continuation: deliver backlog B002 after committed B001/Spec 067
(84ea8ca). Template authority: lifecycle skill fallback; no repository override.
This addresses a possible orphaned-build mechanism, not attribution of the earlier
incident.

## Goals

Stop refresh admission and settle the exact worker and publication before clean
shutdown. Make bounded failure explicit and preserve positive-death recovery.

## Durable Source Baseline

Runtime operations and runtime contracts own shutdown, publication and ownership.
Codex operator runbook owns upgrade guidance. At intake daemon.ts waits for startup
refresh before controller safety, while an outer unreferenced one-second race
forces process exit. Refresh controller has exact-worker termination support but
no public shutdown request. Existing authority deliberately retains unsafe leases.
Spec 065 endpoint policy remains proposed and is not a dependency.

## Requirements

### Requirement 1: Stop and settle refresh

**Priority:** must-have

#### Acceptance Criteria

1. WHEN shutdown begins, THE SYSTEM SHALL synchronously stop new refresh admission
   and continuations and initiate one controller_shutdown termination request for
   the exact active worker without waiting for its normal refresh deadline.
2. WHEN termination and publication settle, THE SYSTEM SHALL retain the last
   published snapshot and make an interrupted building target terminal before
   declaring shutdown safe. No late worker result may publish after cancellation.
3. IF worker termination or publication is unconfirmed, THE SYSTEM SHALL retain
   unsafe activity/ownership evidence and never report clean settlement.

### Requirement 2: Drain under one finite protocol

**Priority:** must-have

#### Acceptance Criteria

1. WHEN daemon close begins, THE SYSTEM SHALL gate admission before any await,
   publish exact-launch canonical draining metadata before retained sockets close,
   reject new sockets deliberately and cancel scheduled refresh triggers. Live
   draining metadata permits only bounded waiting, never admission or signalling. Closing calls reuse one shutdown operation.
2. THE SYSTEM SHALL use one referenced absolute one-second shutdown budget. It
   SHALL initiate worker shutdown before waiting for startup refresh, client or
   watcher disposal. The budget SHALL NOT be extended, reset or retried.
3. WHEN refresh and all required disposal settle within budget and startup
   exclusion is held, THE SYSTEM SHALL close the store, release repository
   authority and perform launch-aware endpoint cleanup before reporting settled.
4. IF startup exclusion is unavailable, shutdown fails or the budget expires,
   THE SYSTEM SHALL report structured blocked evidence and exit nonzero on
   SIGTERM. It SHALL fence late cleanup and retain unresolved authority for
   existing positive-death recovery; it SHALL NOT start a competing writer.

### Requirement 3: Preserve safe shutdown evidence

**Priority:** must-have

#### Acceptance Criteria

1. WHEN shutdown advances or blocks, THE SYSTEM SHALL record bounded fixed-enum
   phase/cause, worker termination and publication evidence in the B001 lifetime
   receipt without raw errors, repository paths or client payloads.
2. WHEN process exit is observed, THE SYSTEM SHALL preserve the shutdown evidence
   and stronger fatal classification. Sink failure SHALL NOT suppress termination.
3. WHEN a prior blocked launch is replaced, THE SYSTEM SHALL preserve observed
   shutdown facts while keeping missing terminal observations explicitly unknown.

### Requirement 4: Prove and promote delivery

**Priority:** must-have

#### Acceptance Criteria

1. THE SYSTEM SHALL have deterministic controller/daemon tests and real child
   coverage for extraction/publication shutdown, unconfirmed termination, last
   client closure, drain rejection, exact-owner replacement and concurrent
   launchers. An isolated installed-package child gate SHALL exercise these
   boundaries; source and compiled-fixture evidence alone SHALL NOT satisfy this
   gate. Evidence tiers SHALL be labeled accurately, and local fixture installation
   SHALL NOT change the user's runtime.
2. THE SYSTEM SHALL pass typecheck, focused/full tests and relevant build/package
   checks, independent correctness/security review and durable promotion before
   B002 is marked done.

## Non-Goals

Endpoint relocation, migration or general startup-election redesign (Spec 065),
aggregate admission
budgets (B006), global installation/publishing, SIGKILL suppression, timeout
extensions, retries, alternate workers or partial-success responses. Byte and
process budget guarantees do not promise hard real-time behavior during blocked
native/filesystem calls.

## Correctness Properties

- CP-001: No release or publication based on unconfirmed worker death.
- CP-002: No callback performs destructive cleanup after a blocked terminal state.
- CP-003: One exact owner and worker; duplicate close/signal does not duplicate work.
- CP-004: A referenced fence keeps Node alive to record the selected outcome.

## Success Criteria

Requirements have concrete tests, promoted durable owners and no unresolved
review blocker. Package may be retained after delivery; commit/install/release
claims require separate evidence.
