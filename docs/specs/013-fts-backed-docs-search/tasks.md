---
title: FTS-backed docs search tasks
doc_type: spec
artifact_type: tasks
status: archived
owner: platform
last_reviewed: 2026-06-06
---

# Tasks

Spec 013 closed on 2026-06-06. All tasks are complete and accepted behavior
was promoted to durable design/reference docs.

## Task Dependency Graph

```text
T001 -> T002 -> T003 -> T004 -> T005 -> T006 -> T007 -> T008 -> T009 -> T010 -> T011
```

- [x] T001 Add FTS docs search fixtures and parity cases.
  - Files: `tests/fixtures/`, `tests/docs/`
  - Acceptance: Fixtures cover multi-term queries, phrase matches, heading
    matches, generic term overmatch, template downranking, pagination,
    skipped/generated docs, and stale/degraded index states.
  - Evidence: Completed on 2026-06-06. Added
    `tests/fixtures/fixture-fts-docs-search-repo/` with governing docs,
    generic AI-agent guide overmatch docs, a Python Agent IDE comparison note,
    heading-match docs, pagination docs, generated/vendor docs, and modeled
    cold/stale/invalid/unavailable index states. Added
    `tests/docs/fts-docs-search-fixtures.test.ts` to prove fixture coverage and
    scanner skip behavior. Validation:
    `pnpm exec vitest run tests/docs/fts-docs-search-fixtures.test.ts` passed.

- [x] T002 Decide docs FTS storage, cursor, and overview/map scope.
  - Depends on: T001
  - Files: `docs/specs/013-fts-backed-docs-search/design.md`,
    `docs/specs/013-fts-backed-docs-search/traceability.md`
  - Acceptance: OD-001 through OD-003 are resolved or explicitly deferred with
    implementation consequences before contracts are added.
  - Evidence: Completed on 2026-06-06. `design.md#open-questions` records the
    decisions: docs FTS uses dedicated tables in the existing graph SQLite
    database, `docs_search` uses an opaque snapshot/query/offset cursor, and
    overview/map/outline/read-section remain direct scanner/read surfaces for
    this spec.

- [x] T003 Define docs index ports and result contracts.
  - Depends on: T001
  - Files: `src/ports/`, `src/contracts/`, `src/application/`
  - Acceptance: Contracts model indexed docs, search hits, match metadata,
    cursor/truncation, index freshness, and degraded reasons without exposing
    raw SQLite rows.
  - Evidence: Completed on 2026-06-06. Expanded `DocsIndexPort` in
    `src/ports/index.ts` with `replaceSnapshotDocs`, `search`, and `getState`;
    added backend-neutral docs index document, search, state, freshness,
    cursor, and degraded result contracts. Extended docs search request/result
    contracts with optional `cursor` and `result_count`.

- [x] T004 Add SQLite schema migration for docs FTS.
  - Depends on: T002, T003
  - Files: `src/infrastructure/sqlite/`, `tests/docs/`
  - Acceptance: Schema creates docs document, heading, and FTS tables with
    schema-versioned migration tests and no raw table leakage into contracts.
  - Evidence: Completed on 2026-06-06. Added `docs_documents`,
    `docs_headings`, `docs_fts`, and docs indexes to
    `src/infrastructure/sqlite/graph-store.ts` migration and schema
    validation. Validation: `pnpm exec vitest run tests/graph/store.test.ts`
    passed.

- [x] T005 Implement docs FTS index writer.
  - Depends on: T004
  - Files: `src/infrastructure/sqlite/`, `src/application/`, `tests/docs/`
  - Acceptance: Writer upserts/removes docs rows, excludes generated/vendor
    paths, records selected-text truncation, and associates rows with snapshot
    or docs-index freshness identity.
  - Evidence: Completed on 2026-06-06. Implemented
    `replaceSnapshotDocs` in the SQLite graph store, shared Markdown heading
    and selected-text helpers in `src/infrastructure/markdown/docs.ts`, and
    bounded selected-text indexing with snapshot identity.

- [x] T006 Implement docs FTS query adapter and ranking.
  - Depends on: T005
  - Files: `src/infrastructure/sqlite/`, `tests/docs/`, `tests/graph/`
  - Acceptance: Adapter returns deterministic ranked hits, heading match
    metadata, snippets, result count, truncation, and cursor/continuation
    evidence while downranking generic/template overmatch.
  - Evidence: Completed on 2026-06-06. Implemented SQLite FTS query, opaque
    cursor generation, snippets, final deterministic score ordering, heading
    evidence, phrase/title/path/heading/body boosts, and generic template/AI
    guide downranking. Validation:
    `pnpm exec vitest run tests/docs/fts-docs-search-fixtures.test.ts` passed.

- [x] T007 Wire docs indexing into warmup/snapshot flow.
  - Depends on: T005
  - Files: `src/application/use-cases/index-repository-graph.ts`,
    `src/server.ts`, `tests/runtime/`, `tests/integration/`
  - Acceptance: Warmup builds docs FTS evidence without broad search-time file
    reads and status/freshness metadata reflects usable docs index state.
  - Evidence: Completed on 2026-06-06. Added optional `docs_index` wiring to
    `indexRepositoryGraph` and `warmupRepositoryGraph`; server startup passes
    the graph store as the docs index so initial warmup populates docs FTS.
    Validation:
    `pnpm exec vitest run tests/graph/extraction-pipeline.test.ts` passed.

- [x] T008 Replace `docs_search` with FTS-backed query path.
  - Depends on: T006, T007
  - Files: `src/application/use-cases/query-docs.ts`, `src/presentation/`,
    `tests/docs/`, `tests/mcp/`
  - Acceptance: `docs_search` uses the docs index port, preserves public
    envelope shape, supports pagination/truncation, and returns structured
    degraded/blocked states instead of scanner fallback.
  - Evidence: Completed on 2026-06-06. `searchDocs` now requires
    `DocsIndexPort` and no longer accepts scanner/workspace inputs, preserving
    the public docs search envelope while returning blocked state for cold FTS
    evidence instead of scanning Markdown. Presenter sanitization preserves
    `cursor` and `result_count`. Validation:
    `pnpm exec vitest run tests/docs/query-docs.test.ts tests/docs/docs-presenter.test.ts tests/mcp/docs-surfaces.test.ts`
    passed.

- [x] T009 Add degraded-state and telemetry coverage.
  - Depends on: T008
  - Files: `tests/docs/`, `tests/mcp/`, `tests/telemetry/`
  - Acceptance: Cold, stale, invalid, unavailable, and optional telemetry
    states are tested without hidden scanner fallback or user-facing noisy
    errors.
  - Evidence: Completed on 2026-06-06. Added docs search coverage for cold,
    stale, invalid, and unavailable FTS index states. `searchDocs` returns
    compact blocked envelopes with no scanner fallback and no user-facing noisy
    backend diagnostics. Telemetry remains optional for this slice; no new hook
    or command telemetry behavior was required. Validation:
    `pnpm exec vitest run tests/docs/query-docs.test.ts tests/docs/docs-presenter.test.ts tests/docs/fts-docs-search-fixtures.test.ts`
    passed.

- [x] T010 Retest parity against Python Agent IDE and sample repos.
  - Depends on: T009
  - Files: `.tmp/`, `docs/specs/013-fts-backed-docs-search/verification.md`
  - Acceptance: Read-only comparisons cover this repo plus at least two sample
    repos; evidence records where Agent Workbench is same, better, or still
    weaker.
  - Evidence: Completed on 2026-06-06. Python Agent IDE `docs_search` was
    called for this repo and returned the expected FTS fixture doc as the top
    hit. A read-only Agent Workbench parity runner indexed this repo,
    `../TimeLocker`, and `../OneMount` into temporary SQLite databases under
    `.tmp/fts-docs-parity/` and wrote `.tmp/fts-docs-parity/report.json`.
    Verification evidence records successful FTS results and remaining ranking
    caveats for broad external-repo queries.

- [x] T011 Promote durable docs and close the spec.
  - Depends on: T010
  - Files: `docs/design/mcp-surface-design.md`,
    `docs/design/graph-store-design.md`,
    `docs/design/runtime-operations-design.md`,
    `docs/reference/documentation-map.md`,
    `docs/specs/013-fts-backed-docs-search/`
  - Acceptance: Durable docs describe FTS docs index/search behavior, budgets,
    freshness, degraded states, pagination, caveats, and deferred
    crosslink/report work; closure checks pass.
  - Evidence: Completed on 2026-06-06. Promoted current behavior to
    `docs/design/mcp-surface-design.md`, `docs/design/graph-store-design.md`,
    `docs/design/runtime-operations-design.md`, and
    `docs/reference/documentation-map.md`; archived the Spec 013 package.
    Validation: `pnpm typecheck`, `pnpm test`, spec package lint, and
    `git diff --check` passed.
