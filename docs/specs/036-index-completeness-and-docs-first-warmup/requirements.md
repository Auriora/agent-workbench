---
title: Index completeness and docs-first warmup requirements
doc_type: spec
artifact_type: requirements
status: draft
owner: platform
last_reviewed: 2026-07-07
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Requirements

## Introduction

Agent Workbench startup warmup currently builds graph and docs-search evidence
from one bounded repository scan. In large repositories, that scan can complete
before reaching durable `docs/` content, while the resulting snapshot is still
published as fresh. The observed aws-datalake failure was that `docs_search`
could only return front-door Markdown files even though detailed analytics
documentation existed under `docs/`.

This spec defines the target behavior for indexing completeness, docs-first
warmup, and trust metadata so agents can distinguish complete evidence from
partial warmup evidence.

## Goals

- Ensure `docs_search` can find durable repository docs even when source graph
  warmup remains bounded.
- Prevent truncated startup warmups from being reported as fully fresh evidence.
- Separate docs-index completeness from graph-index completeness in public
  metadata.
- Preserve fast startup and bounded parser work without silently dropping the
  tail of large repositories.
- Add regression coverage that emulates large repositories where `docs/` is
  reached after the current startup warmup cap.

## Non-Goals

- Do not add alternate parser, LSP, Pyright, Ruff, pytest, or semantic fallback
  routes.
- Do not make `docs_search` scan arbitrary files ad hoc as a hidden fallback for
  every query.
- Do not remove all budgets from background work without an explicit resource
  and cancellation design.
- Do not change root-authority or workspace-safety policy.
- Do not close the spec until accepted behavior is promoted to durable docs.

## Glossary

| Term | Definition |
| --- | --- |
| Graph index | SQLite-backed file, symbol, reference, and resource evidence produced by repository warmup. |
| Docs index | SQLite-backed Markdown document and FTS evidence used by `docs_search`. |
| Startup warmup | Background indexing work scheduled after the MCP server starts. |
| Partial evidence | Evidence produced from a bounded or truncated scan that does not cover the full intended index scope. |
| Docs-first warmup | A warmup phase that prioritizes `AGENTS.md`, `README.md`, durable `docs/**`, and spec docs before broad source graph indexing. |
| Completion pass | Resumable background work that indexes files not covered by the initial bounded phase. |

## Durable Source Baseline

| Source | Current behavior relied on | Confidence | Notes |
| --- | --- | --- | --- |
| `docs/design/runtime-operations-design.md` | Owns cache, warmup, concurrency, work queues, async snapshot rules, and runtime signals. | high | Promotion target for accepted warmup and completion behavior. |
| `docs/design/graph-store-design.md` | Owns SQLite graph storage, FTS, rebuilds, and query budgets. | high | Promotion target for docs/graph index completeness semantics. |
| `docs/design/mcp-surface-design.md` | Owns public MCP tool behavior, docs surfaces, and direct-read requirements. | high | Promotion target for `docs_search` degraded/partial metadata behavior. |
| `docs/reference/runtime-contracts.md` | Owns freshness, trust, evidence, status, and response metadata vocabulary. | high | Promotion target for any new or clarified metadata fields. |
| `docs/reference/documentation-map.md` | Names canonical durable owners for runtime operations, graph store, MCP surface, and runtime contracts. | high | Must be updated if ownership changes or new durable owner docs are added. |
| `src/server.ts` | Schedules startup warmup with the default startup file budget. | high | Current default startup warmup cap is implementation evidence, not accepted target behavior. |
| `src/application/use-cases/index-repository-graph.ts` | Builds graph and docs index evidence from the same scanned file list and marks snapshot freshness. | high | Root implementation surface for the failure. |
| `src/infrastructure/filesystem/file-catalog-scanner.ts` | Applies traversal priority and stops when `max_files` is reached. | high | Current traversal reaches `docs/` late for large repositories. |
| `src/infrastructure/sqlite/graph-store.ts` | Provides docs FTS search and snapshot freshness selection. | high | Current docs search cannot report docs-index coverage depth. |

## Durable Impact

See `change-impact.md` for the full durable-doc mapping. The accepted behavior
must be promoted at minimum to runtime operations, graph store, MCP surface, and
runtime contract documentation before closure.

## Staged Readiness

- **Current stage:** requirements
- **Next stage:** design review
- **Ready to implement when:** requirements, design, tasks, verification gates,
  and large-repo regression fixtures are coherent enough for a bounded worker.
- **Design-first exception:** no
- **Optional artifacts recommended:** `change-impact.md`, `verification.md`
- **Downstream review needed:** implementation review and durable-doc promotion

## Requirements

### Requirement 1: Truncated Warmup Must Not Publish Complete Freshness

**User Story:** As a coding agent, I want Workbench to label truncated warmup
evidence as partial, so that I do not treat missing docs or symbols as proof of
absence.

**Priority:** must-have

#### Acceptance Criteria

1. GIVEN startup warmup reaches a configured scan budget before covering its
   intended scope, WHEN the snapshot or tool metadata is published, THEN THE
   SYSTEM SHALL expose partial or truncated evidence state rather than complete
   freshness.
2. GIVEN a tool reads graph-backed or docs-backed evidence from a partial
   snapshot, WHEN the response is returned, THEN THE SYSTEM SHALL include trust
   metadata that names the missing or incomplete evidence class.
3. GIVEN a partial warmup still has useful evidence, WHEN a tool returns that
   evidence, THEN THE SYSTEM SHALL preserve the result while clearly marking
   what it is and is not safe to infer.

### Requirement 2: Docs Search Must Not Depend On Source-Graph Warmup Order

**User Story:** As a coding agent investigating repository behavior, I want
`docs_search` to index durable docs independently of source-graph traversal
order, so that important documentation remains discoverable in large repos.

**Priority:** must-have

#### Acceptance Criteria

1. GIVEN a repository has more files than the initial source graph warmup budget
   and durable Markdown under `docs/`, WHEN docs indexing runs, THEN THE SYSTEM
   SHALL prioritize or separately scan durable Markdown so `docs_search` can
   find it.
2. GIVEN `docs_search` runs before full graph completion, WHEN the docs index
   has completed its docs-first phase, THEN THE SYSTEM SHALL return docs hits
   without requiring the full source graph index to be complete.
3. GIVEN the docs index is incomplete, WHEN `docs_search` runs, THEN THE SYSTEM
   SHALL report docs-index coverage state rather than silently returning only
   the indexed subset.

### Requirement 3: Graph Warmup May Be Bounded But Must Be Resumable Or Explicitly Partial

**User Story:** As an operator of Agent Workbench, I want bounded parser work to
avoid runaway background load while still knowing whether the graph index is
complete, so that startup remains responsive without misleading agents.

**Priority:** must-have

#### Acceptance Criteria

1. GIVEN startup graph warmup uses a first-pass budget, WHEN it stops before
   covering all eligible files, THEN THE SYSTEM SHALL either schedule persisted
   completion work or expose that graph evidence is partial.
2. GIVEN completion work is scheduled, WHEN status or trust metadata is
   requested, THEN THE SYSTEM SHALL distinguish planned, running, complete,
   partial, stale, and blocked states.
3. GIVEN no completion executor exists for a planned rescan, WHEN the
   implementation is validated, THEN THE SYSTEM SHALL fail the relevant
   regression test or mark the behavior explicitly out of scope with a durable
   follow-up.

### Requirement 4: Coverage Metadata Must Be Diagnosable

**User Story:** As a coding agent, I want docs and graph search responses to
include coverage counts and truncation signals, so that I can choose direct
   reads or refresh actions when indexed evidence is incomplete.

**Priority:** should-have

#### Acceptance Criteria

1. WHEN `docs_search` returns results, THEN THE SYSTEM SHALL expose enough
   metadata to tell whether durable docs were indexed, whether the scan was
   truncated, and whether a cursor indicates pagination or incomplete coverage.
2. WHEN a docs or graph index is partial, THEN THE SYSTEM SHALL provide an
   actionable next step, such as direct-read routing, refresh, or bounded
   completion guidance.
3. WHEN `result_count` is returned for docs search, THEN THE SYSTEM SHALL avoid
   implying total repository docs coverage when it only represents the current
   page or indexed subset.

### Requirement 5: Large-Repo Regression Must Be Fixture-Backed

**User Story:** As a maintainer, I want deterministic tests that emulate large
repository indexing pressure, so that the aws-datalake class of failure does
not regress.

**Priority:** must-have

#### Acceptance Criteria

1. GIVEN a fixture with more files than the first-pass graph budget before
   `docs/`, WHEN warmup runs, THEN tests SHALL prove durable docs are found or
   partial docs coverage is reported.
2. GIVEN a fixture where docs indexing completes before graph indexing, WHEN
   `docs_search` runs, THEN tests SHALL prove docs search is usable while graph
   evidence may remain partial.
3. GIVEN a watcher schedules bounded rescan or completion work, WHEN the runtime
   is exercised in tests, THEN tests SHALL prove the planned work is executed or
   the status remains explicitly partial/blocked.

## Correctness Properties

- **CP-001**: A truncated scan must never produce public metadata that implies
  full index completeness for the affected evidence class.
- **CP-002**: Docs-index completeness and graph-index completeness must be
  independently representable.
- **CP-003**: `docs_search` must not silently narrow its universe to the first
  source-graph warmup budget when durable Markdown exists outside that budget.
- **CP-004**: Any resumable completion state must be monotonic unless the
  repository changes; completion may move from planned to running to complete,
  stale, or blocked, but not to fresh-complete without coverage evidence.

## Technical Context

- **Language/Version:** TypeScript ESM on Node 24.
- **Primary Dependencies:** better-sqlite3, MCP SDK, Vitest, tree-sitter native
  bindings.
- **Target Platform:** Local MCP server, Codex/Claude/Kiro plugin launchers,
  per-repo SQLite cache.
- **Constraints:** Keep MCP adapters thin; do not add parser or semantic
  fallbacks; keep generated `.cache/` artifacts out of Git.
- **Performance Goals:** Preserve responsive MCP startup while making partial
  index state explicit and making durable docs discoverable early.

## Success Criteria

- **SC-001**: A large-repo fixture reproduces the current docs-missing failure
  before implementation and passes after implementation.
- **SC-002**: Truncated warmup no longer reports complete freshness for docs or
  graph evidence.
- **SC-003**: `docs_search` can find durable `docs/**` content in the large-repo
  fixture before full graph completion.
- **SC-004**: Public metadata documents docs and graph coverage state well
  enough for an agent to pick direct reads, refresh, or bounded follow-up.
- **SC-005**: Accepted behavior is promoted to durable docs and validated with
  focused tests, `pnpm typecheck`, and targeted/full `pnpm test` as appropriate.

## Related Artifacts

- Change Impact: `change-impact.md`
- Design: `design.md`
- Tasks: `tasks.md`
- Verification: `verification.md`
