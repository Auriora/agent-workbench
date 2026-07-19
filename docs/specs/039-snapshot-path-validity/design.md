---
title: Snapshot path validity design
doc_type: spec
artifact_type: design
status: draft
owner: platform
last_reviewed: 2026-07-19
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Technical Design

## Overview

Introduce one snapshot-validity decision at the application boundary and make
status, orientation, task context, docs queries, and graph queries consume it.
Infrastructure supplies bounded path/catalog evidence; it does not decide
public freshness. A material deletion transitions the snapshot through the
existing stale/refresh coordinator. SQLite removal deletes file, graph, docs,
heading, FTS, and coverage records consistently.

## Requirement Coverage

| Requirement | Design coverage | Validation |
| --- | --- | --- |
| Requirement 1 | Shared validity receipt and coordinated stale transition | Index-then-delete fixtures and budget tests |
| Requirement 2 | One freshness derivation consumed by public use cases | Cross-surface contract/golden tests |
| Requirement 3 | Query preflight plus shared envelope classification | Deleted-node graph-tool tests |
| Requirement 4 | Transactional document-record pruning | Graph-store and docs-search regressions |
| Requirement 5 | Snapshot-keyed bounded evidence and existing refresh path | Budget, compatibility, and architecture tests |

## Correctness Property Coverage

| Property | Design behavior | Validation direction |
| --- | --- | --- |
| CP-001 | Missing required path forces non-fresh validity. | Deterministic deletion fixture. |
| CP-002 | Public surfaces consume the same receipt. | Same-snapshot golden comparison. |
| CP-003 | Query preflight prevents stale reads; envelope wrapper handles unexpected errors. | ENOENT regression and provider-error tests. |
| CP-004 | One removal transaction prunes every docs/search representation. | SQLite row/count/search assertions. |
| CP-005 | Budget exhaustion yields unknown/degraded. | Low-budget fixture. |

## High-Level Design

### Shared Snapshot Validity

Add an application-owned snapshot validity service returning a bounded receipt
with snapshot ID, state (`valid`, `stale`, or `degraded`), missing or unverifiable
path evidence, completeness, and refresh requirement. Reuse canonical freshness
and limitation vocabulary at the presentation boundary; do not add competing
public enums when existing contracts suffice.

The service consumes graph/catalog snapshot evidence and a narrow workspace
path-validation port. The port reports path existence and access outcomes; it
does not classify runtime trust. Validation may be cached by snapshot identity
plus the existing material change generation. A cache entry is reusable only
when complete and no material deletion/catalog event has invalidated it.

### Coordinated Invalidation

When validity detects deletion, it marks the current snapshot stale through the
existing change-queue/warm-up coordinator and schedules at most one bounded
refresh for that transition. Reads do not perform an inline rebuild. Watcher
evidence remains useful when enabled, but absence of a watcher event cannot
prove that a snapshot predating the watcher is valid.

### Cross-Surface Freshness

`get-repo-status` composes persisted snapshot state, watcher state, and snapshot
validity. `get-repo-orientation` derives reuse/blockers from that composed
status. `get-task-context`, docs use cases, and graph query helpers consume the
same snapshot freshness/validity evidence rather than manufacturing separate
defaults. Scanner coverage remains a separate metadata dimension.

### Graph Query Guard

Graph query helpers resolve the snapshot and validate paths needed for the
selected node/traversal before reading source. Missing paths produce a normal
stale/degraded use-case result with missing-evidence limitations and one
refresh-oriented next action. `find_references` and `impact` also adopt the
shared MCP envelope classifier used by equivalent graph tools, but that wrapper
is defense-in-depth rather than the deletion fix.

### Transactional Documentation Removal

The graph-store removal coordinator deletes or invalidates the file catalog,
symbols/edges, docs documents, headings, FTS rows, and affected coverage state
inside the existing store ownership boundary. Queries must not count or return
orphan docs while pruning is incomplete; failure makes docs evidence non-fresh.

## Data Flow

```text
persisted snapshot + catalog manifest + bounded workspace path evidence
  -> application snapshot-validity receipt
  -> existing stale/refresh coordinator when invalid
  -> status/orientation/task/docs/graph use cases
  -> thin presenters and MCP adapters

file deletion
  -> graph-store removal coordinator
  -> file + graph + docs + headings + FTS + coverage pruning
```

## Low-Level Design

The implementation should introduce one interface equivalent to:

```text
SnapshotValidityPort.validate(snapshotId, indexedPaths, budget)
  -> { state, complete, checkedCount, missingEvidence, refreshRequired }
```

The application use case maps infrastructure outcomes into canonical runtime
freshness and trust metadata. Consumers receive the resulting receipt through
composition; they do not call the filesystem port themselves. The selected
catalog generation/cache key must be resolved in T001 before T002 begins.

## Error Handling And Trust

- Missing paths are expected stale evidence, not exceptional success.
- Permission denial or incomplete validation is degraded/unknown and cannot
  claim fresh.
- Unexpected provider exceptions use the shared MCP failure envelope.
- No retry, alternate scanner, partial-timeout result, or catch-and-continue
  path is introduced.

## Migration And Compatibility

No public resource or tool is removed. Existing persisted databases may contain
orphan rows; the first accepted validity/pruning path must classify them stale
and repair them through the explicit coordinator. A schema migration is added
only if implementation evidence shows current tables cannot support consistent
removal; it must not be assumed in advance.

## Slice Boundary And Residual Architecture

| Design target | In this slice | Out of this slice | Destination | Blocks closure? |
| --- | --- | --- | --- | --- |
| Snapshot path validity | Bounded receipt and reuse decision | General content hashing redesign | EB014 if evidenced | no |
| Refresh coordination | Existing queue/warm-up transition | Parallel indexer or inline rebuild | rejected | no |
| Graph failures | Stale/degraded envelopes and shared classifier | Alternate source scan | rejected | no |
| Docs consistency | File/docs/headings/FTS/coverage pruning | New search backend | none | no |
| Watcher behavior | Material deletion invalidation | Watcher-required runtime | none | no |

## Validation Strategy

Use temporary fixture repositories and SQLite stores that index content, delete
files/directories, and then exercise the public use cases and MCP registries.
Include low-budget, permission-limited, orphan-row, provider-error, and normal
unchanged-snapshot controls. Run focused graph/docs/runtime/MCP suites before
the full test suite.

## Operational Considerations

Validity work must be observable and bounded. Record checked-path counts,
completeness, and why refresh is required without exposing absolute paths or
secret content. Repeated reads of the same complete valid snapshot should reuse
the receipt; repeated reads of an invalid snapshot must not enqueue duplicate
refresh work.

## Open Questions

- Which existing catalog identity/change-generation signal is sufficient for
  safe validity-receipt reuse without adding a new persisted schema field?

## Related Artifacts

- Requirements: `requirements.md`
- Change impact: `change-impact.md`
- Tasks: `tasks.md`
- Traceability: `traceability.md`
- Verification: `verification.md`
