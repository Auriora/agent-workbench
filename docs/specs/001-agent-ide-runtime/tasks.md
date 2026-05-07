---
title: Agent IDE runtime MVP tasks
doc_type: spec
status: draft
owner: platform
last_reviewed: 2026-05-07
---

# Tasks

**Input**: Design documents from `docs/specs/001-agent-ide-runtime/`

**Prerequisites**: `plan.md` and `spec.md`; include `research.md`, `design.md`,
and `quickstart.md`.

**Tests**: Add contract and fixture tests for every agent-visible schema,
adapter capability level, graph query, edit contract, and validation planner
behavior.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel because it touches different files and has no
  dependency on another task.
- **[Story]**: User story label such as US1, US2, or US3.
- Include exact file paths once implementation paths exist.

## Phase 1: Setup

- [ ] T001 Create runtime source and test directory structure.
- [ ] T002 Add SQLite schema migration harness.
- [ ] T003 [P] Add MCP schema generation and contract-test harness.
- [ ] T004 [P] Add representative fixture repository strategy.

## Phase 2: Foundational Prerequisites

- [ ] T005 Define graph schema for files, nodes, edges, unresolved refs,
  snapshots, docs, tests, attention items, and usage events.
- [ ] T006 Define adapter output schema and capability metadata.
- [ ] T007 Define shared response metadata for trust, freshness, scope,
  verification, and evidence sources.
- [ ] T008 Implement repo binding, scope detection, and runtime status.
- [ ] T009 Implement file scan, watcher state, and freshness tracking.

**Checkpoint**: Runtime can bind to a repo and report scoped status.

## Phase 3: User Story 1 - Repository Preflight And Context

**Goal**: Agents can start with preflight, scope, overview, and context.

**Independent Test**: Fixture repo preflight and context contract tests pass.

- [ ] T010 [P] [US1] Implement `repo:///status`, `repo:///scope`, and
  `repo:///overview`.
- [ ] T011 [US1] Implement `repo_preflight`.
- [ ] T012 [US1] Implement `context_for_task` with source section packing and
  direct-read caveats.

## Phase 4: User Story 2 - Targeted Graph Queries

**Goal**: Agents can query symbols, references, callers, callees, and impact
without hidden broad scans.

**Independent Test**: Known fixture symbols return expected graph results.

- [ ] T013 [P] [US2] Implement graph writes and FTS indexes.
- [ ] T014 [P] [US2] Implement Markdown/config extraction.
- [ ] T015 [P] [US2] Implement Python thin slice.
- [ ] T016 [P] [US2] Implement TypeScript/JavaScript thin slice.
- [ ] T017 [P] [US2] Implement C# project/symbol thin slice.
- [ ] T018 [P] [US2] Implement CloudFormation/SAM resource thin slice.
- [ ] T019 [US2] Implement `symbol_search`, `symbol_context`,
  `find_references`, `callers`, `callees`, and `impact`.

## Phase 5: User Story 3 - Edit Feedback And Validation

**Goal**: Agents can safely preview/apply edits and get validation plans.

**Independent Test**: Fixture edits produce feedback, attention, and validation
plans.

- [ ] T020 [P] [US3] Implement edit preview tokens.
- [ ] T021 [US3] Implement apply, drift check, and rollback.
- [ ] T022 [P] [US3] Implement diagnostics and post-edit feedback.
- [ ] T023 [US3] Implement verification planning and nearest-test routing.
- [ ] T024 [US3] Implement attention items for blockers, warnings, nudges, and
  verification gaps.

## Phase 6: User Story 4 - Knowledge Report

**Goal**: Agents can orient through explicit graph report resources and tools.

**Independent Test**: Fixture report includes coverage, communities, gaps, and
caveats.

- [ ] T025 [P] [US4] Implement `repo:///graph/report`.
- [ ] T026 [P] [US4] Implement community, god node, and graph stats queries.
- [ ] T027 [US4] Implement usage-gap event capture for fallbacks.

## Phase 7: Polish And Cross-Cutting Validation

- [ ] T028 Add performance budget tests for hot-path queries.
- [ ] T029 Add degraded-mode tests for missing parser/LSP/tooling.
- [ ] T030 Add docs for runtime commands once implementation exists.
- [ ] T031 Validate all docs links and metadata.
