---
title: Refresh-safe daemon shutdown design
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

Replace the outer non-cancelling race with one shutdown state machine. Preserve
the existing one-second policy, startup/graph ownership authorities and positive
process-death recovery. Requirements precede implementation.

## High-Level Design

Controller shutdown owns cancellation/worker/publication settlement. Daemon shutdown
owns admission, one deadline, cleanup ordering and process outcome. The existing
lifetime adapter records safe evidence. MCP composition delegates shared policy
to infrastructure services.

## Low-Level Design

### Controller shutdown (Requirement 1)

Add SnapshotRefreshControllerPort.shutdown(): Promise<void> as one idempotent shutdown request that closes admission immediately, cancels
active pass/continuation scheduling and terminates only the active execution with
controller_shutdown. Await canonical mutation/publication settlement and positive
termination confirmation. Intentional cancellation has a fixed failure category;
unconfirmed termination/publication remains quarantined. LazyOwnershipGatedRefreshAuthority.shutdown(): Promise<void> quiesces without
releasing the repository lease; close() enforces successful shutdown then releases
the owner after daemon DB closure. The synchronous controller receipt gains optional
publication_state, populated from the canonical publication authority. Initialization racing shutdown must not admit a worker afterward.

### Daemon protocol (Requirement 2)

Synchronously gate socket admission, stop scheduled startup/idle triggers and close
retained sockets. Acquire identity startup exclusion once; absent/ambiguous
exclusion is blocked, never cleanup permission. Initiate controller shutdown before
awaiting startup refresh or disposers. Use one referenced monotonic absolute budget
for all phases; repeated close returns the same result. The constructor budget
override is a focused-test seam only; production always uses the canonical 1000 ms
constant and exposes no timeout environment/configuration knob.

After controller, clients, watcher and publication are safe, close the store,
release repository authority, remove exact-launch endpoint metadata and release
startup exclusion. Before every cleanup boundary, check that the state machine is
still active. On timeout/error/unconfirmed authority, record blocked and fence late
callbacks. Do not release unsafe ownership or unlink its endpoint/startup lock.
SIGTERM maps settled to exit 0 and blocked to exit 1. Death permits the existing
serialized recovery election; no alternate daemon or forced signalling is added.

The first socket callback rejects during drain. Canonical endpoint metadata gains
one explicit ready-to-draining transition, published by its exact owner before
retained sockets close. The classifier reports blocked/draining for a live,
base-matching owner before checking socket presence. It grants wait-only progress
under the original deadline, never admission, spawning, cleanup or signalling.
Dead draining owners use ordinary positive-death election; malformed, wrong-base,
wrong-path and unknown-process evidence remains blocked/ambiguous.

D002 supersedes the initial no-new-endpoint-state assumption. Actual installed
concurrent handoff passed 22/23 cases but failed with ambiguous_process when a
second launcher probed a ready receipt after its owner closed sockets. Lifetime
receipts are best-effort diagnostics and cannot be a second admission authority;
canonical draining closes that visibility gap. Endpoint relocation/migration and
general startup election remain Spec 065; no new pre-initialize wire response is
introduced.

The no-await start order is admission fence/trigger stop, controller/authority
shutdown request, exact-launch atomic draining publication, then socket closure.
Authority admission is fenced synchronously; this is a cancellation request, not
an assertion of completed worker termination. Metadata failure blocks and retains
unresolved ownership. A failed ready-owner probe re-reads canonical state once;
only the exact old launch draining, an expected new starting/ready successor, or
positive-dead/absent progress may enter existing wait/election paths. Unchanged
ready or unexpected identity remains ambiguous. A successful probe is also
rechecked before signalling; draining or replacement progress never authorizes a
signal. Duplicate SIGTERM uses the same close promise through process exit.

### Startup exclusion reclamation (Requirements 2 and 4)

Review found a pre-existing authority race: two callers can classify the same
startup lock dead, then one can unlink the other's replacement. B002's concurrency
proof therefore includes a narrow repair inside the existing startup authority.
Serialize stale inspection/replacement with a private .reclaim claim, reuse atomic
candidate publication, and validate exact device/inode/PID/token before removal.
A caller finding a strictly validated positively live reclamation owner returns
known-busy through the existing bounded election/handoff path. A claim that
vanishes after observed contention also returns busy without granting authority.
Dead, malformed, unsafe or process-unknown guards report ambiguous/blocked.
There is no new retry mechanism, recursive guard recovery or endpoint policy.
Release only the owned guard. Ordinary confirmed-dead canonical lock recovery remains supported.

A crash inside the tiny reclamation transaction can leave the guard abandoned.
That state deliberately blocks rather than guessing cleanup authority. Recovery
policy is routed to B008/Spec 065, separate from endpoint location/migration. This
is an explicit failure boundary, not an automatic-recovery claim. Tests must cover
replacement during inspection, overlapping reclaimers, guard retention and normal
fresh/dead-owner acquisition.

### Evidence (Requirement 3)

Extend the canonical B001 receipt with an optional strict shutdown block containing
phase, cause and observed worker/publication state. Reuse its bounded two-record
store, generation fencing, private permissions and nonblocking evidence lock.
An exit update preserves this block. A later admission preserves observed shutdown
facts even if terminal exit was not observed. New fields use fixed enums and no
raw errors or arbitrary repository/client identifiers.

## Operational Considerations

Keep the shutdown timer referenced because workers are unreferenced and promises
alone cannot keep Node alive. Unsafe blocked close is terminal for that coordinator;
it cannot resume cleanup after its caller receives blocked. Positive-death recovery
is the only subsequent ownership path. Unavailable receipt storage remains explicit.

## Validation and promotion

Use deterministic deferred workers/publication plus real daemon/worker barriers.
Retain genuine crash/orphan tests using SIGKILL; SIGTERM now exercises orderly
cancellation or a structured blocked outcome. Validate same-version handoff and
concurrent launchers without signalling unrelated PIDs. Exercise an isolated locally installed package fixture explicitly and distinguish
it from the global runtime; source or compiled fixtures alone cannot discharge
the installed gate. No global installation or publication is required. The installed fixture uses the
repository-prescribed pnpm manager. An attempted npm dependency pre-provisioning
failed with ERESOLVE: tree-sitter-ruby 0.23.1 declares optional peer ^0.21.1 while
this package requires tree-sitter ^0.25.0. This does not satisfy npm installation
acceptance; the packaging metadata issue is routed to B007. No peer-constraint
bypass flags or alternate parser are used. Pnpm uses the existing repository
dependency policy, and fixture-native loading plus real worker tests must pass.
Disable automatic install scripts for this fixture, then explicitly rebuild only
approved native dependencies: package postinstall otherwise changes the host's
runtime pointer. This is deliberate test provisioning, not deployed-runtime setup.
Promote runtime operations, runtime contracts, observability and the Codex runbook.

## Open Questions

None block implementation. Shared controller/authority shutdown APIs above are
fixed. Daemon close returns Promise<DaemonShutdownReceipt>; the canonical schema
is in src/contracts/daemon-shutdown-contracts.ts. The receipt has state
(draining/settled/blocked), phase, fixed cause, worker_termination_state,
activity_lease_held and optional publication_state. DaemonLifetimeEvidencePort
adds observeShutdown(receipt); lifetime records gain optional shutdown.
Controller ownership covers refresh failure vocabulary and controller port fields;
parent owns new shutdown/lifetime schemas and store observation. Daemon ownership
covers coordinator/composition and matching tests. Existing real-worker crash
barriers and local package/entrypoint harnesses are reused; no production mode or
alternate shutdown path is added.
