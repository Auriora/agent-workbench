---
title: Daemon lifetime evidence design
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

One daemon-owned local receipt outlives the startup metadata and launcher.

## High-Level Design

Contracts and ports separate evidence policy from storage and MCP composition.

## Low-Level Design

### Receipt storage (Requirement 1)

A daemon-only infrastructure adapter writes a versioned JSON receipt at
`${metadataPath}.lifetime.json`, with current and optional previous records. Admission remains owned
by existing serialized daemon startup; activate and rotate evidence only after
ready metadata is written, before serving pending sockets. A new launch rotates
nonterminal prior evidence to unknown_prior_owner_loss. Terminal records retain
observed facts. A dedicated private evidence lock (at most 256 bytes of PID/token metadata) serializes reread,
generation check and atomic
replace. Every event makes one nonblocking exclusive-create acquisition attempt;
contention latches unavailable evidence for that launch. Fatal/exit hooks never
wait, reclaim or retry. Ready initialization may reclaim only a positively dead
lock owner before its single acquisition attempt. Release verifies the owned
inode/token. This lock never coordinates endpoint or graph ownership.
Generation checks under that lock reject stale writers. Bounded descriptor reads,
strict schemas, symlink rejection, private permissions and atomic replace protect
the store. No startup/graph locks are acquired in fatal hooks. The evidence lock closes a
real handoff race: old endpoint cleanup releases startup exclusion before old
process exit, so atomic rename alone is not a compare-and-swap.

### Process observation (Requirement 2)

Install uncaughtExceptionMonitor and exit listeners in the real daemon process;
origin distinguishes exception from default-fatal rejection. Observe SIGTERM
before the existing termination path. Synchronous bounded writes must not throw
through process callbacks; do not catch fatal exceptions or alter the one-second
termination deadline. Keep monitors through natural idle exit. Bootstrap failure
remains existing startup diagnostics. Bundling imports before initialization means
this feature cannot claim import-failure coverage.

## Decision: one canonical writer

Choose daemon-local observation instead of launcher-owned persistence: a detached
daemon outlives its parent and parent callbacks introduce competing writes. No
sidecar or parallel source. SIGKILL/native abort remains unknown. This explicitly
refines B001's launcher-observation wording; it does not infer missing evidence.

## Contracts and health

Canonical strict schemas live in src/contracts/daemon-lifetime-contracts.ts,
exported through runtime-contracts.ts. A DaemonLifetimeEvidencePort in src/ports
separates persistence from MCP composition. Health optionally exposes typed
daemon_lifetime_evidence independently of refresh diagnostics; unavailable evidence blocks verification of that evidence,
without changing graph freshness. Fixed enums avoid raw diagnostic data.

## Validation and promotion

Unit tests prove bounds, permissions, retention, corruption and stale generations.
Real child tests prove default fatal exits, signals and absence of a parent.
Run typecheck, focused tests, full tests, plugin validation and compiled runtime
smoke as appropriate. Independent correctness/security review required.
Promote to runtime operations, observability design, runtime contracts and Codex
operator runbook. Backlog B001 points here; B002/B006 and Spec 065 stay separate.

## Operational Considerations

Storage failure is explicit evidence loss, never a fatal-handler exception.
Synchronous writes are bounded in bytes, not in filesystem latency; this feature
cannot guarantee crash durability on a failed or stalled filesystem. POSIX mode
checks do not establish Windows ACL privacy. No installed acceptance is claimed.

## Open Questions

None block this slice. Unobservable native/OS termination and startup policy are
explicit boundaries, not inferred diagnoses. B002 owns worker settlement.
