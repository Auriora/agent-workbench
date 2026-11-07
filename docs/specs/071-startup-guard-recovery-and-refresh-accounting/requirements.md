---
title: Startup recovery and refresh accounting requirements
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

Deliver user-authorized B008 and B009 after the verified v0.6.11 rollout.
A crashed startup reclaimer can leave a valid dead .reclaim guard that blocks
subsequent startup. Refresh diagnostics currently count a pass before the
executor is called, so reentrant cancellation can overcount actual invocations.
These are possible failure mechanisms, not attribution of the earlier incident.

## Goals

- Recover positively dead, exactly identified startup guards without competing writers.
- Count actual executor invocations and preserve diagnostic revision visibility.
- Preserve private ownership evidence, existing deadlines and one startup election.

## Non-Goals

- Broader Spec065 endpoint relocation, graph rollback policy or production host cleanup.
- Guessing process death for legacy, foreign or unavailable kernel scope.
- Publishing or replacing the live v0.6.11 installation in this source delivery.

The existing untracked Spec065 package is preserved unchanged. B010 owns
non-Linux kernel process-scope proof.

## Durable source baseline

| Owner | Current behavior |
| --- | --- |
| docs/design/runtime-operations-design.md | Private startup reclamation guard; abandoned guards fail closed |
| docs/reference/runtime-contracts.md | Busy versus ambiguous startup ownership; worker_invocations diagnostics |
| docs/security/threat-model.md | Ownership and filesystem evidence constrain destructive actions |
| docs/design/layered-runtime-architecture.md | Infrastructure owns native/filesystem policy; MCP composition remains thin |

## Requirements

### Requirement 1: Safe abandoned guard recovery

Priority: must-have.

1. WHEN a bounded, regular private reclaim claim names a positively dead owner,
   THE SYSTEM SHALL recover through the existing startup election authority.
2. BEFORE stale-guard deletion, THE SYSTEM SHALL serialize all dead-guard
   deletions with process-death-released exclusion and revalidate device/inode,
   owner PID and token. Two recovering processes SHALL admit at most one owner.
3. IF guard evidence is live, malformed, replaced, unsafe or process-unknown,
   THE SYSTEM SHALL retain it and return existing busy or ambiguous results.
4. IF recovery exclusion is busy, THE SYSTEM SHALL return existing known-busy
   without waiting inside the synchronous transaction or extending deadlines.
5. A process death during recovery SHALL release kernel exclusion; a successor
   SHALL recover valid dead evidence without recursive guard files or retries.
6. Recovery SHALL preserve a concurrently published canonical owner, including
   older supported hard-link claimants, and SHALL never signal a process.
7. Unsafe, corrupt or unverifiable exclusion storage SHALL block; missing native
   bindings SHALL retain existing installation-failure reporting.

### Requirement 2: Actual executor invocation diagnostics

Priority: must-have.

1. WHEN executor.run is actually invoked, THE SYSTEM SHALL increment
   worker_invocations exactly once, including a synchronous executor throw.
2. IF cancellation or shutdown prevents the call, THE SYSTEM SHALL keep the
   count unchanged, including reentrant running-transition and deadline hooks.
3. Diagnostic revision SHALL expose the updated count without opening a
   callback/await gap between the final cancellation check and invocation.
4. Cancellation, worker termination, publication and ownership semantics SHALL
   remain governed by their existing authorities and receipts.

### Requirement 3: Evidence and promotion

Priority: must-have.

1. Fixtures SHALL cover simultaneous reclaimers, replacement during inspection,
   exact positive death, live/unknown/malformed evidence and recovery-owner death.
2. Tests SHALL prove zero for cancelled pre-run attempts and one for each real
   call, including synchronous throw and ordinary pass completion.
3. Typecheck, focused safety tests, architecture checks and full regression SHALL
   pass; compiled/installed acceptance SHALL exercise the changed startup path.
4. Durable operations/contracts and backlog dispositions SHALL describe delivered
   behavior and residual limitations without rewriting historical release notes.

## Correctness properties

- CP-001: At most one startup owner; an older/recovering claimant cannot remove a successor.
- CP-002: No missing, malformed or uncertain evidence grants destructive authority.
- CP-003: A dead process cannot retain kernel recovery exclusion.
- CP-004: worker_invocations equals actual executor.run calls.
- CP-005: No new retries, fallback, timeout extension, process killing or partial-success path.

## Readiness

Current stage: verified source and isolated installed-package delivery.
User purpose is confirmed by the request to continue B008/B009. Template authority
is the skill fallback because docs/templates/spec-package is absent. Requirements
precede implementation. D001 narrow helper/scope safety was independently reviewed before T001. Legacy
and unprovable non-Linux process scope remain blocked and routed to B010.

## Success Criteria

T001-T003 acceptance and executed evidence pass; independent architecture and
security findings are resolved; existing durable owners and backlog dispositions
match delivered source. Legacy/non-Linux evidence limits remain explicit and
owned. Passing source/isolated-install checks does not claim a new public release.
