---
title: Index completeness and docs-first warmup tasks
doc_type: spec
artifact_type: tasks
status: draft
owner: platform
last_reviewed: 2026-07-07
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Tasks

**Input**: `requirements.md`, `design.md`, `change-impact.md`
**Prerequisites**: Requirements and design review for open completion-scope
questions.

## Task Dependency Graph

```text
T001 -> T002 -> T003
T003 -> T004
T003 -> T005
T004 + T005 -> T006
T006 -> T007
T007 -> T008
T008 -> T009
T009 -> T010
```

## Phase 1: Spec And Regression Baseline

**Purpose**: Lock the failure mode before implementation.

- [x] T001 Create the active spec package.
  - Depends on: none
  - Requirement: all
  - Files: `docs/specs/036-index-completeness-and-docs-first-warmup/`
  - Acceptance: Package contains requirements, design, change impact, tasks,
    and verification artifacts.
  - Evidence: Package files exist under
    `docs/specs/036-index-completeness-and-docs-first-warmup/` with
    requirements, design, change-impact, tasks, traceability, and verification
    artifacts.

- [x] T002 Add a large-repo fixture that reproduces docs omission under the
  current warmup cap.
  - Depends on: T001
  - Requirement: Requirement 5
  - Files: `tests/fixtures/...`, `tests/docs/...` or `tests/graph/...`
  - Acceptance: Test fixture places enough source/config files before `docs/`
    that current source-graph warmup omits durable docs.
  - Evidence: `tests/graph/extraction-pipeline.test.ts` creates a temporary
    `src/`-first repository with five Python files, a `max_files: 3` warmup
    cap, and a durable Markdown document under `docs/data-flow/processed/`.
  - [x] T002.1 Create fixture files that exceed the graph seed budget before
    `docs/` is reached.
    - Evidence mode: implementation
    - Evidence: Dynamic fixture creates `src/file_0.py` through
      `src/file_4.py` and runs warmup with `max_files: 3`.
  - [x] T002.2 Add a durable Markdown document containing a unique search term
    under `docs/`.
    - Evidence mode: implementation
    - Evidence: Dynamic fixture writes
      `docs/data-flow/processed/analytics-serving-boundary.md` with
      `unique-docs-first-warmup-needle`.
  - [x] T002.3 Document fixture intent in the test name or helper comments so
    future maintainers understand the warmup-cap regression.
    - Evidence mode: validation
    - Evidence: Test name is
      `indexes docs when startup graph scan truncates before the docs root`.

- [x] T003 Add failing or characterization tests for current unsafe semantics.
  - Depends on: T002
  - Requirement: Requirements 1, 2, 4, 5
  - Files: `tests/docs`, `tests/graph`, `tests/runtime`, `tests/mcp`
  - Acceptance: Tests prove either docs are found despite graph budget or
    partial coverage is reported. Current behavior should fail or be explicitly
    characterized before implementation.
  - Evidence: Phase 1 commit `7ee7f0b` characterized the unsafe baseline:
    truncated warmup reported `fresh`, the durable docs file was absent from
    catalog evidence, docs index state was `cold`, and `docs_search` returned
    zero hits for the unique durable-doc term. Existing
    `tests/runtime/process-workspace-change-queue.test.ts` covers bounded
    rescan scheduling without executing completion work.
  - [x] T003.1 Cover `docs_search` behavior when durable docs exist outside the
    graph seed scan.
    - Evidence mode: validation
    - Evidence: Phase 1 commit `7ee7f0b` recorded `docs_search` behavior for
      `unique-docs-first-warmup-needle`: the search returned no hits and named
      that no Markdown documents were indexed.
  - [x] T003.2 Cover truncated warmup metadata and ensure it cannot be reported
    as complete freshness.
    - Evidence mode: validation
    - Evidence: Phase 1 commit `7ee7f0b` asserted
      `result.truncated === true` while the snapshot still reported `fresh`,
      documenting the unsafe semantic that Phase 2 changed.
  - [x] T003.3 Cover separate docs-index and graph-index coverage states.
    - Evidence mode: validation
    - Evidence: Phase 1 commit `7ee7f0b` recorded the mismatch: the graph
      snapshot was `fresh` while docs-index state was `cold` with
      `document_count: 0`.
  - [x] T003.4 Cover watcher/completion planning behavior or prove explicit
    partial state remains when no executor exists.
    - Evidence mode: validation
    - Evidence: Existing `tests/runtime/process-workspace-change-queue.test.ts`
      covers `stale_rescan_scheduled` and planned warmup reuse; no production
      completion executor is added in Phase 1.

## Phase 2: Docs-First And Partial Coverage Foundation

**Purpose**: Make durable docs searchable early and prevent overclaiming.

- [x] T004 Implement docs-first or docs-dedicated indexing input.
  - Depends on: T003
  - Requirement: Requirement 2
  - Files: `src/application/use-cases/index-repository-graph.ts`,
    `src/application/use-cases/markdown-docs.ts`,
    `src/infrastructure/filesystem/file-catalog-scanner.ts` if needed,
    `src/infrastructure/sqlite/graph-store.ts`
  - Acceptance: Docs FTS indexing no longer depends only on the first source
    graph seed scan; durable `docs/**` content is indexed in the large-repo
    fixture.
  - Evidence: `indexRepositoryGraph` now performs a docs-priority scan over
    `docs`, `doc`, and `documentation` roots separately from the bounded graph
    seed scan, merges those Markdown files into docs FTS input, and the
    large-repo fixture now finds
    `docs/data-flow/processed/analytics-serving-boundary.md` while graph
    coverage is labeled non-complete.
  - Evidence mode: implementation
  - [x] T004.1 Define the docs-index input selection path.
    - Evidence mode: implementation
    - Evidence: Added docs-priority scan and Markdown merge path in
      `src/application/use-cases/index-repository-graph.ts`.
  - [x] T004.2 Reuse existing skip/path policies for docs-index input.
    - Evidence mode: implementation
    - Evidence: Docs-priority input uses the existing `FileCatalogScanPort`
      and scanner skip policy instead of custom path walking.
  - [x] T004.3 Keep docs indexing independent from parser/semantic extraction
    fallback behavior.
    - Evidence mode: implementation
    - Evidence: `src/application/use-cases/index-repository-graph.ts` builds
      docs FTS input from Markdown `FileCatalogEntry` values; no parser,
      semantic, LSP, or command-execution fallback path was added.

- [x] T005 Add partial/truncated coverage metadata.
  - Depends on: T003
  - Requirement: Requirements 1, 3, 4
  - Files: `src/contracts`, `src/application/use-cases/response-metadata.ts`,
    `src/application/use-cases/index-repository-graph.ts`,
    `src/infrastructure/sqlite/graph-store.ts`, `src/presentation`,
    `src/interface-adapters/mcp/registries`
  - Acceptance: Truncated warmup and incomplete docs/graph coverage are exposed
    as partial or equivalent degraded evidence, not complete freshness.
  - Evidence: Added additive `IndexCoverage` and docs-search coverage fields,
    return coverage from graph indexing, mark truncated graph seed snapshots as
    `refreshing`, and expose usable docs FTS from refreshing graph snapshots as
    routing evidence with non-complete coverage labels.
  - [x] T005.1 Add additive contract/schema fields for docs and graph coverage
    or record the selected metadata shape.
    - Evidence mode: contract
    - Evidence: Added `EvidenceCoverageState`, `IndexCoverage`,
      `ResponseMetadata.index_coverage`, and docs-search coverage fields in
      `src/contracts`.
  - [x] T005.2 Thread coverage state through warmup, use cases, presenters, and
    MCP envelopes.
    - Evidence mode: implementation
    - Evidence: Coverage flows through
      `src/application/use-cases/index-repository-graph.ts`,
      `src/infrastructure/sqlite/graph-store.ts`,
      `src/application/use-cases/query-docs.ts`, and
      `src/presentation/docs-presenter.ts`.
  - [x] T005.3 Update trust metadata so agents know what partial evidence is
    safe and not safe to infer.
    - Evidence mode: implementation
    - Evidence: Docs search metadata for non-complete coverage now uses
      refreshing freshness and `index_coverage` so envelope trust calibration
      treats it as routing evidence rather than completion proof.

- [x] T006 Clarify `docs_search` result counts, pagination, and next actions.
  - Depends on: T004, T005
  - Requirement: Requirement 4
  - Files: `src/infrastructure/sqlite/graph-store.ts`,
    `src/application/use-cases/query-docs.ts`, `src/contracts`,
    `tests/docs/query-docs.test.ts`, `tests/docs/fts-docs-search-fixtures.test.ts`
  - Acceptance: Search output no longer implies total docs coverage when only a
    page or partial indexed subset is returned; direct-read or refresh guidance
    is available when coverage is partial.
  - Evidence: `docs_search` now returns `result_count_basis: page`,
    docs-index coverage fields, indexed docs count, coverage notes, and a
    `docs_map` next action for non-complete docs coverage.
  - [x] T006.1 Clarify whether `result_count` means page count, indexed match
    count, or total available match count.
    - Evidence mode: contract
    - Evidence: Added optional `result_count_basis` field and set it to
      `page` for docs FTS search results.
  - [x] T006.2 Add docs-search next actions for partial docs coverage.
    - Evidence mode: implementation
    - Evidence: Added non-complete docs coverage next action to `docs_map` and
      allowlisted `docs_map` as a public next-action tool.
  - [x] T006.3 Update docs-search tests for count and coverage semantics.
    - Evidence mode: validation
    - Evidence: `tests/docs/query-docs.test.ts` covers page-count semantics,
      non-complete docs coverage metadata, and next actions.

## Phase 3: Completion Or Explicit Deferral

**Purpose**: Decide whether bounded warmup is a first phase or an explicit
partial state.

- [x] T007 Implement resumable completion or record a durable partial-state
  deferral.
  - Depends on: T006
  - Requirement: Requirement 3
  - Files: `src/server.ts`, `src/application/use-cases/process-workspace-change-queue.ts`,
    `src/application/use-cases/index-repository-graph.ts`,
    `src/infrastructure/workers/startup-graph-warmup-worker.ts`,
    `docs/backlog/README.md` if deferred
  - Acceptance: Files beyond the first-pass graph budget are either completed
    by a production execution path or the public state remains explicitly
    partial with one durable follow-up destination.
  - Evidence: Completion executor is routed to `docs/backlog/README.md`
    EB014. Phase 2 public metadata keeps bounded graph seed evidence explicitly
    non-complete via `refreshing` freshness and coverage state, so files beyond
    the first-pass graph budget are not presented as indexed.
  - Destination: `docs/backlog/README.md` EB014
  - [x] T007.1 Decide and record whether this spec implements completion or
    durable deferral.
    - Decision owner: platform
    - Evidence mode: planner
    - Evidence: `docs/backlog/README.md` EB014 is the durable destination for
      the persisted graph completion executor; this spec keeps public graph
      state non-complete via `refreshing` freshness until that EB014 work is
      implemented.
  - [x] T007.2 If implementing completion, add the production execution path and
    tests proving planned work runs.
    - Evidence mode: no_op
    - Evidence: Conditional no-op completed for this spec because completion
      executor work is routed to EB014 rather than implemented here; T007 and
      T007.3 record the durable route and metadata requirement.
  - [x] T007.3 If deferring completion, update durable backlog and ensure public
    metadata remains explicitly non-complete.
    - Evidence mode: routing
    - Evidence: EB014 now names the Spec 036 deferral and requires a production
      completion path with durable cursor, owner, cancellation, retry, and
      stale-repository semantics; Phase 2 tests verify `refreshing` state for
      truncated graph warmup.

## Phase 4: Validation And Durable Promotion

**Purpose**: Prove behavior and promote accepted semantics out of the spec.

- [x] T008 Run focused validation and update `verification.md`.
  - Depends on: T007
  - Requirement: all
  - Files: `docs/specs/036-index-completeness-and-docs-first-warmup/verification.md`
  - Acceptance: Focused tests, typecheck, and appropriate broader validation
    decisions are recorded.
  - Evidence: `pnpm typecheck` passed; focused Phase 2 Vitest run passed with
    78 files and 570 tests; Phase 4 docs/spec patch passes `git diff --check`
    and lifecycle validation as recorded in `verification.md`.

- [x] T009 Promote accepted behavior to durable docs.
  - Depends on: T008
  - Requirement: all
  - Files: `docs/design/runtime-operations-design.md`,
    `docs/design/graph-store-design.md`,
    `docs/design/mcp-surface-design.md`,
    `docs/reference/runtime-contracts.md`,
    `docs/reference/documentation-map.md`,
    `docs/reference/agent-readable-changelog.md`,
    `docs/backlog/README.md` as needed
  - Acceptance: Current accepted behavior no longer exists only in the spec.
  - Evidence: Accepted docs-first warmup, separate docs/graph coverage,
    `docs_search` non-complete coverage metadata, result-count basis, and EB014 completion
    deferral are promoted to runtime operations, graph store, MCP surface,
    runtime contract, changelog, and backlog docs. `documentation-map.md` was
    reviewed and unchanged because existing owners already cover the promoted
    behavior.

- [x] T010 Complete implementation review, closure risk, and cleanup decision.
  - Depends on: T009
  - Requirement: all
  - Files: `verification.md`, closure/history docs if closing
  - Acceptance: Review findings are fixed, rejected, or routed; closure state is
    decided according to repo policy.
  - Evidence: Reviewed Phase 4 promotion in `docs/design/*`,
    `docs/reference/*`, and `verification.md`; cleanup decision is recorded in
    `verification.md`.

## Execution Rules

- Do not implement from this task list alone. Read `requirements.md`,
  `design.md`, `change-impact.md`, and `verification.md` before changing code.
- Do not add parser, semantic, validation, or command-execution fallbacks.
- Preserve the distinction between docs-index completeness and graph-index
  completeness.
- Keep MCP adapters thin; shared behavior belongs in use cases, contracts,
  policies, or infrastructure adapters as appropriate.
- Run `pnpm typecheck` and targeted/full `pnpm test` after implementation
  slices unless explicitly waived.
