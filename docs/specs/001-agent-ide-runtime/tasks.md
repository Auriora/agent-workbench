---
title: Agent IDE runtime MVP tasks
doc_type: spec
status: draft
owner: platform
last_reviewed: 2026-05-07
---

# Tasks

**Input**: Design documents from `docs/specs/001-agent-ide-runtime/`

**Prerequisites**: `spec.md`, `plan.md`, [Runtime contracts](../../reference/runtime-contracts.md),
[Workspace safety contract](../../reference/workspace-safety-contract.md), and
[MVP proof matrix](../../reference/mvp-proof-matrix.md).

**Tests**: Add contract and fixture tests for every MVP surface before expanding
adapters or graph features.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel because it touches different files and has no
  dependency on another task.
- **[Story]**: User story label such as US1, US2, or US3.
- Include exact file paths once implementation paths exist.

## Phase 1: Contracts And Fixtures

- [ ] T001 Define source directory and test directory structure.
- [ ] T002 Define shared response envelope and enum schemas from
  `docs/reference/runtime-contracts.md`.
- [ ] T003 Define workspace safety policy fixtures for paths, symlinks,
  generated roots, command refusal, and redaction.
- [ ] T004 Define `fixture-basic-python`, `fixture-markdown-config`,
  `fixture-degraded-tools`, and `fixture-workspace-safety`.
- [ ] T005 Add golden response snapshots for MVP resources and tools.

## Phase 2: Graph Store Foundation

- [ ] T006 Define SQLite schema for files, nodes, edges, unresolved refs,
  snapshots, and FTS rows.
- [ ] T007 Add migration and schema validation harness.
- [ ] T008 Add stale/cold/refreshing/fresh snapshot state tests.
- [ ] T009 Add add/modify/delete/rename cleanup tests.
- [ ] T010 Add query-budget trace tests for MVP hot paths.

**Checkpoint**: graph schema and fixture proof gates are executable.

## Phase 3: Runtime Binding And Adapters

- [ ] T011 Implement repo binding, path canonicalization, scope detection, and
  skipped-root reporting.
- [ ] T012 Implement Markdown/config resource-backed extraction.
- [ ] T013 Implement one partial-semantic language adapter for the first fixture.
- [ ] T014 Implement degraded-mode behavior for missing parser, LSP, and test
  tooling.

**Checkpoint**: runtime can bind to fixture repos and report status/scope.

## Phase 4: MVP MCP Resources And Read Tools

- [ ] T015 [P] [US1] Implement `repo:///status`.
- [ ] T016 [P] [US1] Implement `repo:///scope`.
- [ ] T017 [P] [US1] Implement `repo:///overview`.
- [ ] T018 [US1] Implement `context_for_task`.
- [ ] T019 [P] [US2] Implement `symbol_search`.
- [ ] T020 [P] [US2] Implement `find_references`.
- [ ] T021 [US2] Implement bounded `impact`.

**Checkpoint**: MVP read surfaces match golden responses and budgets.

## Phase 5: Bounded Edit And Validation Planning

- [ ] T022 [US3] Implement `preview_workspace_edit` token generation with base
  hashes.
- [ ] T023 [US3] Implement `apply_workspace_edit` with path containment and
  stale-preview rejection.
- [ ] T024 [US3] Implement blocker/warning metadata for stale preview, unsafe
  path, low confidence, missing tool, and blocked validation.
- [ ] T025 [US3] Implement `verification_plan` without command execution.

**Checkpoint**: bounded edit and validation-plan fixtures pass.

## Phase 6: Cross-Cutting Validation

- [ ] T026 Add workspace safety negative tests for traversal, symlink escape,
  generated/vendor mutation, shell injection, env handling, output caps, and
  redaction.
- [ ] T027 Add degraded-mode tests for missing parser/LSP/test runner.
- [ ] T028 Add query budget tests for status, scope, context, symbol search,
  references, impact, preview/apply, and verification plan.
- [ ] T029 Validate docs links and metadata.

## Deferred Work

- C# semantic support.
- CloudFormation/SAM relationship extraction.
- TypeScript/JavaScript semantic promotion if not selected as the first
  language path.
- Graph reports, communities, god nodes, surprising connections, and generated
  docs/wiki export.
- Usage-gap analytics.
- `run_nearest_tests` execution.
- Rollback, safe rename, change signature, safe delete, move symbol, and import
  mutation.
