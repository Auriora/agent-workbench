---
title: Daemon lifetime evidence requirements
doc_type: spec
artifact_type: requirements
status: active
owner: platform
last_reviewed: 2026-11-06
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Requirements

User-authorized purpose: deliver backlog B001 after Spec 066 verification.
Template authority: lifecycle skill fallback; no repository spec-package override.

## Goals

Preserve attributable post-ready failure evidence after a client disappears.

## Durable Source Baseline

Existing daemon.ts publishes endpoint metadata, removed on shutdown; daemon-client.ts
observes child startup only. Runtime operations and runtime contracts own daemon
behavior; observability-debugging-design.md owns telemetry boundaries. Spec 065
is proposed endpoint work and is not a delivered dependency.

## Requirements

### Requirement 1: Retain bounded private lifetime evidence

Priority: must-have. Operators need evidence after the launching client leaves.

#### Acceptance Criteria

1. WHEN daemon admission succeeds and the sink is available, THE SYSTEM SHALL
  persist its identity, launch token, pid,
  version, timestamps, lifecycle phase and fixed classified cause independently
  of endpoint metadata. Keep current and at most one previous launch, at most
  4096 serialized bytes, private directory/file permissions and atomic writes.
2. IF a store is malformed, oversized, unsafe or unwritable, THE SYSTEM SHALL
  reject it explicitly;
  stale launch observations cannot overwrite a replacement launch, including
  concurrent exit/admission writes. One nonblocking evidence lock attempt may
  report unavailable evidence on contention; no hook waits or retries. No raw errors,
  stack traces, tool payloads, environment values or repository paths are stored.
3. WHEN a new launch is admitted, THE SYSTEM SHALL classify a prior nonterminal record as unknown
  prior-owner loss, without inventing exit code or signal.

### Requirement 2: Preserve process behavior and expose evidence

Priority: must-have. Evidence must not change fatal exception behavior.

#### Acceptance Criteria

1. WHEN a post-ready process event occurs, THE SYSTEM SHALL observe uncaught
  exceptions, default-fatal unhandled rejections,
  SIGTERM requests and actual exit codes synchronously. Preserve the strongest
  fatal cause. Do not install exception/rejection handlers that suppress exit.
2. WHEN the launching parent exits, THE SYSTEM SHALL retain daemon-local evidence;
  sink failure cannot
  suppress fatal exit or prevent normal runtime operation. Health exposes typed
  available/unavailable evidence; unavailable evidence is explicitly unverified.
3. THE SYSTEM SHALL have real child tests covering normal/nonzero exit, exception,
  rejection, SIGTERM,
  SIGKILL followed by replacement, unavailable parent and unwritable sink.

## Non-Goals

Only post-ready daemon observations are canonical. SIGKILL, native abort and
pre-ready/import failures may leave no terminal evidence; report unknown, never
infer an observed cause. Existing launcher observations remain startup-only.
Spec 065 owns startup/endpoint policy. B002 owns shutdown settling and deadlines;
B006 owns aggregate budgets. No new retries, fallback stores or shutdown modes.

## Correctness Properties

- CP-001: A stale launch never overwrites a replacement launch's receipt.
- CP-002: Observation never changes default fatal termination behavior.
- CP-003: Missing observations remain unknown; unavailable stores stay explicit.

## Success Criteria

All acceptance criteria have passing concrete evidence and durable promotion;
independent review has no unresolved blockers. No installed-runtime claim.
