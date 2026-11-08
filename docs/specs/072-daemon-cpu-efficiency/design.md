---
title: Daemon CPU efficiency design
doc_type: spec
artifact_type: design
status: draft
owner: platform
last_reviewed: 2026-11-08
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Design

## Overview

Fix admitted file format and repeated algorithmic work inside the existing
refresh pipeline. Preserve its single executor, durable completion and atomic
publication. No implementation has started.

## Requirement Coverage

| Requirement | Criteria | Design | Tasks | Validation |
| --- | --- | --- | --- | --- |
| Requirement 1 | AC1-AC3 | D001 | T002 | V002 mixed .ts fixtures |
| Requirement 2 | AC1-AC3 | D002 | T003 | V003 matcher parity and compilation counts |
| Requirement 3 | AC1-AC4 | D003 | T004 | V004 generation and restart cases |
| Requirement 4 | AC1-AC3 | D004 | T005 | V005 graph parity and scaling |
| Requirement 5 | AC1-AC5 | D003; D005 | T004; T006 | V006 counters, deadlines and shutdown |
| Requirement 6 | AC1-AC4 | D006 | T001; T007; T008 | V001; V007; V008 |

## High-Level Design

Application orchestration owns the build sequence and candidate-index lifecycle.
Filesystem infrastructure owns bounded classification reads and catalog discovery;
SQLite infrastructure owns generation-scoped persistence and migrations. Contracts
and ports expose shared data; the worker composes adapters. Profiling remains in
src/debug with explicit worker instrumentation, outside public MCP tool surfaces.

## Low-Level Design

### D001: Explicit Qt translation admission

Add a narrow file-format discriminator for ambiguous .ts using a bounded source
prefix and positive XML/Qt root evidence. Choose and document the prefix bound and
malformed/unknown outcome in T001/T002; do not hardcode a FreeCAD path. Carry the
classification consistently through scanner identity, registry resolution and
coverage. Preserve containment, skip and read-error handling. A classifying read
is not permission to parse or scan other files. Use the existing resource route
only where supported; otherwise retain explicit unsupported evidence. No new XML
parser or alternate TypeScript parser is planned.

### D002: Compiled rule set

Prepare exact/wildcard matchers once when root or child-local ignore policy is
loaded; preserve ordered rules and last-match negation. Give the compiled set
policy-scoped ownership, not an unbounded process-global string cache. The
exploratory Map is proof of cost, not production design. Preserve pattern semantics
and discarded-set release on invalidation.

### D003: Durable catalog manifest and shape

Store the ordered admitted paths, identities, priority-order inputs and shape
receipt for a build generation, fenced by controller/invalidation generation,
policy/config identity and composition fingerprint. Reuse the same manifest across
short-lived workers instead of moving repeated discovery to another worker phase.
Derive separate source/docs views without losing independent docs priority coverage.
Use existing catalog rows where sufficient; add schema only for missing build-only
metadata. T001 records the exact ownership/schema and migration decision before
T004. Public queries remain published-only; a manifest never grants freshness.

The controller's invalidation generation and final validation fence live changes.
Tests must cover content changes as well as renamed/deleted paths. Missing or
mismatched durable evidence follows structured failure/invalidation, not an
implicit full-scan fallback inside every continuation. Keep one explicit rebuild
path through the existing controller. A worker restart cannot lose catalog
progress or silently use stale project-shape evidence.

### D004: Candidate indexes

Build name buckets once per extraction batch node set or final resolution page's
node universe. Reuse the exact candidate pool for selection and count. Add indexed
qualified names, paths, Ruby form metadata and lambda file targets where existing
rules require them. Resolve against the same authoritative node set and apply the
existing filters; never resolve an ambiguous bucket by first match. Scope indexes
to the worker/slice initially; measure complete-node loading and memory before
considering further persisted/query changes. No second semantic implementation.

### D005: Budget and accounting

Separate catalog preparation measurements from extraction's cooperative allowance,
retain the hard controller deadline and reserve necessary for resolution/write
settlement, and avoid promises of interrupting synchronous native parsing inside
a file. T006 derives the feasible allocation from measured settlement costs within
the existing hard limit. A phase that cannot fit fails explicitly. Unique counters
come from committed admitted identities or catalog state; repeated visits use
separate work counters. Define additive contract/schema changes and legacy counter
invalidation explicitly; do not infer unique totals from old cumulative windows.

### D006: Worker evidence

Create a checkout-only refresh profiling harness with one production execution
path, isolated output database and worker-isolate CPU capture. Distinguish active
core utilisation, total CPU and background duty cycle. Record phase costs and
counter definitions, profile start/stop scope, native-frame limits, source revision,
Node version and compiled source parity. Store raw outputs in ignored local
artifacts; promote sanitized summaries and stable fixture commands into verification.
No raw path/source/error export to product analytics, no external source mutation,
and no daemon restart or kernel policy change is needed by the harness.

## Migration and Compatibility

Existing schema/version and graph-build contracts stay authoritative. Any new
manifest/counter fields require an explicit schema migration or safe generation
invalidation/rebuild before use, respecting rollback policy and active ownership.
No deleting or replacing an active live cache. Coordinate additive diagnostics with
Spec 071's actual executor invocation counter, and preserve Specs 068/069 shutdown
and admission. No unrelated endpoint or install changes.

## Correctness Property Coverage

| Property | Design behavior | Verification |
| --- | --- | --- |
| CP-001 | D002 ordered matchers; D003 fenced manifest | V003; V004 |
| CP-002 | D001 positive format admission | V002 |
| CP-003 | D003 committed cursor; D005 distinct counters | V004; V006 |
| CP-004 | D004 same pools and ambiguity rules | V005 |
| CP-005 | Existing controller authority retained by D003/D005 | V004; V006; V008 |
| CP-006 | D006 actual worker and isolated stores | V001; V007 |

## Slice Boundary And Residual Architecture

| Target | In this slice | Out of this slice | Follow-up | Blocks closure? |
| --- | --- | --- | --- | --- |
| Observed wasted CPU | Requirements 1-6 | None of the measured fixes intentionally deferred | B013 promoted to this package | yes |
| Sustained resource policy | Measure utilisation and duty cycle | New throttling, priority or scheduling policy | B014, platform | no |
| Rollout | Compiled isolated acceptance | Publish/install live replacement | Separate user-authorized release work | no |

## Validation Strategy

Use conventional Vitest tests and deterministic operation-count assertions; no new
property-test dependency. Verification V001-V008 maps fixtures, profiling and
promotion to every requirement. Review architecture, manifest/storage invalidation,
parser routing, measurement validity and shutdown before closure. T001 resolves
schema/counter and discriminator details before dependent tasks; passing lint is
not permission to skip that readiness checkpoint.

## Operational Considerations

Roll out only after the isolated compiled gate. Treat schema/manifest changes as
owned derived-cache migrations, preserving current publication and rollback rules.
Inspect worker CPU, complete-generation cost, RSS and foreground request latency;
raw measurements remain local and do not become analytics payloads. This package
does not authorize installation, daemon termination or live cache replacement.

## Open Questions

T001 must settle the exact manifest schema/reuse contract, legacy counter
invalidation and Qt prefix bound before T002/T004/T006. These are explicit task
readiness decisions owned by platform, not completed design approval. Scheduling
policy is deferred to B014 and does not block algorithmic fixes.

## Related Artifacts

[Requirements](requirements.md), [tasks](tasks.md), [research](research.md),
[traceability](traceability.md), [verification](verification.md).
