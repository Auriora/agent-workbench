---
title: Snapshot path validity requirements
doc_type: spec
artifact_type: requirements
status: draft
owner: platform
last_reviewed: 2026-07-19
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Requirements

## Introduction

Agent Workbench currently trusts persisted snapshot freshness even when indexed
files have been deleted from the workspace. Dogfooding on 2026-07-19 showed one
snapshot reported as fresh and reusable while it retained seven removed Spec
035 paths, returned inconsistent freshness across first-read surfaces, exposed
a raw `ENOENT` from graph traversal, and counted deleted documentation rows.
This spec makes path validity part of snapshot trust rather than repairing each
presenter independently.

## Goals

- Establish one application-owned validity decision for persisted snapshots.
- Make freshness consistent across orientation, status, task context, docs, and
  graph-query surfaces for the same snapshot.
- Return structured stale or degraded evidence when indexed paths disappear.
- Remove documentation, headings, FTS rows, and coverage state consistently
  when their owning file is removed.
- Preserve bounded first-read and graph-query behavior.

## Non-Goals

- Add retries, alternate scanners, parser fallbacks, or catch-and-continue
  suppression.
- Treat every ordinary content edit as material orientation invalidation.
- Rebuild the complete graph synchronously inside a resource or tool read.
- Change repository-root authority, ignore policy, or secret classification.
- Restore deleted historical spec packages.

## Durable Source Baseline

| Source | Current behavior relied on | Confidence | Notes |
| --- | --- | --- | --- |
| `docs/design/graph-store-design.md` | Owns persisted graph, docs, FTS, snapshot, and query invariants. | high | Must describe path-removal consistency after promotion. |
| `docs/design/runtime-operations-design.md` | Owns freshness, invalidation, watcher, warm-up, and refresh coordination. | high | Watcher absence cannot prove an old snapshot valid. |
| `docs/design/mcp-surface-design.md` | Owns public resource/tool stale, degraded, and error behavior. | high | Graph tools must not leak filesystem errors. |
| `docs/reference/runtime-contracts.md` | Owns freshness, trust, and response-envelope vocabulary. | high | Reuse existing enums where possible. |
| `docs/backlog/README.md` | EB051 owns the observed defect and acceptance baseline. | high | Promote delivery status here. |
| commit `c90769b` | Deleted the seven stale Spec 035 files named by snapshot `1783312125057`. | high | Repository evidence; the deleted package is historical only. |

## Durable Impact

| Durable area | Action | Target | Notes |
| --- | --- | --- | --- |
| graph persistence | modify | `docs/design/graph-store-design.md` | Define file/docs/FTS removal consistency and path-validity evidence. |
| runtime freshness | modify | `docs/design/runtime-operations-design.md` | Define material deletion and coordinated refresh behavior. |
| MCP behavior | modify | `docs/design/mcp-surface-design.md` | Define stale/degraded graph-query envelopes. |
| contracts | modify | `docs/reference/runtime-contracts.md` | Define shared snapshot-validity/freshness semantics. |
| backlog/changelog | modify | `docs/backlog/README.md`, `docs/reference/agent-readable-changelog.md` | Record delivery and agent-visible behavior. |

## Requirements

### Requirement 1: Authoritative Snapshot Validity

**User Story:** As a coding agent, I want snapshot freshness to include current
path validity, so that persisted evidence is not presented as fresh after files
are deleted.

**Priority:** must-have

#### Acceptance Criteria

1. GIVEN a persisted snapshot, WHEN an indexed file or directory no longer
   exists, THEN the system SHALL classify that snapshot as stale or degraded
   and SHALL NOT report it as fresh or reusable.
2. THE SYSTEM SHALL derive snapshot path validity in an application-owned
   component using an explicit workspace/filesystem port; presenters and MCP
   registries SHALL NOT independently scan the workspace.
3. IF validity cannot be completed within its declared bound, THEN the system
   SHALL report unknown or degraded evidence and SHALL NOT infer validity.
4. A detected material deletion SHALL enter one existing coordinated
   stale/refresh path and SHALL NOT trigger hidden retry loops or parallel
   rebuild implementations.

### Requirement 2: Cross-Surface Freshness Agreement

**User Story:** As a coding agent, I want the same snapshot to carry compatible
freshness everywhere, so that I can trust first-read and task evidence.

**Priority:** must-have

#### Acceptance Criteria

1. GIVEN the same `snapshot_id` and validity receipt, WHEN orientation, status,
   task context, docs, or graph tools report freshness, THEN their freshness
   SHALL agree or explicitly identify a separate evidence dimension.
2. `context_for_task` SHALL NOT hardcode `unknown` when authoritative snapshot
   freshness is available, and it SHALL NOT promote a stale snapshot to fresh.
3. Scan completeness, watcher state, and snapshot filesystem validity SHALL
   remain distinguishable rather than being collapsed into one ambiguous flag.
4. Deletion of an indexed path SHALL appear in the documented
   deletion-triggered refresh conditions.

### Requirement 3: Bounded Graph Behavior For Missing Paths

**User Story:** As a coding agent, I want stale graph queries to fail with
structured evidence, so that a removed file does not escape as a raw runtime
error.

**Priority:** must-have

#### Acceptance Criteria

1. GIVEN a selected graph node whose indexed path is missing, WHEN
   `symbol_search`, `find_references`, or `impact` needs that path, THEN the
   system SHALL return a structured stale or degraded envelope naming the
   missing evidence and the bounded refresh action.
2. THE SYSTEM SHALL validate the relevant snapshot/path evidence before source
   reads used by graph traversal and SHALL NOT use exception suppression as the
   primary validity mechanism.
3. Unexpected provider errors SHALL still pass through the shared MCP envelope
   classifier without weakening the root validity check.
4. Timeout, crash, permission denial, and corrupt snapshot evidence SHALL NOT
   be returned as useful partial graph success.

### Requirement 4: Documentation Index Removal Consistency

**User Story:** As a coding agent, I want documentation counts and search hits
to reflect existing files, so that deleted documents are not recommended.

**Priority:** must-have

#### Acceptance Criteria

1. WHEN a file is removed from a snapshot/catalog, THEN its documentation row,
   headings, FTS rows, graph records, and associated coverage state SHALL be
   removed or invalidated consistently within one explicit coordinator path.
2. `indexed_docs_count`, docs inventory, and docs search SHALL exclude deleted
   paths before claiming current or complete evidence.
3. IF pruning is incomplete or fails, THEN affected docs evidence SHALL be
   stale or degraded rather than silently current.
4. Removal handling SHALL preserve transactionality appropriate to the SQLite
   graph store and SHALL NOT leave searchable orphan rows.

### Requirement 5: Bounded Validation And Compatibility

**User Story:** As an operator, I want validity checks to remain bounded and
compatible, so that correctness does not create an unbounded first-read scan.

**Priority:** must-have

#### Acceptance Criteria

1. Snapshot validity SHALL have an explicit work/query budget and observable
   incomplete state.
2. IF validity evidence is cached, THEN it SHALL be keyed by snapshot identity
   and invalidated by material workspace/catalog changes; an incomplete cache
   SHALL NOT claim fresh.
3. Existing public resource and tool names SHALL remain compatible.
4. The implementation SHALL use the existing watcher, change queue, warm-up,
   and graph-store ownership boundaries rather than adding a parallel indexer.

## Correctness Properties

- **CP-001:** A snapshot with any required indexed path missing is never
  classified as fresh or reusable.
- **CP-002:** Equal snapshot identity and validity inputs produce compatible
  freshness across all public surfaces.
- **CP-003:** A missing graph path never escapes a public MCP tool as raw
  `ENOENT` and never becomes successful partial evidence.
- **CP-004:** Deleted documentation cannot remain in counts, inventory, or FTS
  search after the removal transaction completes.
- **CP-005:** Incomplete bounded validation never upgrades evidence to fresh.

## Success Criteria

- **SC-001:** An index-then-delete fixture makes orientation, status, and task
  context agree on non-fresh state.
- **SC-002:** Golden graph-tool responses prove bounded stale/degraded envelopes
  for deleted source paths.
- **SC-003:** Docs counts and FTS results exclude deleted fixture documents.
- **SC-004:** Focused budgets, full tests, typecheck, and plugin validation pass
  without a new fallback route.

## Related Artifacts

- Canonical context: `canonical-context.md`
- Change impact: `change-impact.md`
- Design: `design.md`
- Tasks: `tasks.md`
- Traceability: `traceability.md`
- Verification: `verification.md`
