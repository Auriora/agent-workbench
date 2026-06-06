---
title: FTS-backed docs search tasks
doc_type: spec
artifact_type: tasks
status: active
owner: platform
last_reviewed: 2026-06-06
---

# Tasks

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

- [ ] T002 Decide docs FTS storage, cursor, and overview/map scope.
  - Depends on: T001
  - Files: `docs/specs/013-fts-backed-docs-search/design.md`,
    `docs/specs/013-fts-backed-docs-search/traceability.md`
  - Acceptance: OD-001 through OD-003 are resolved or explicitly deferred with
    implementation consequences before contracts are added.
  - Evidence: Pending.

- [ ] T003 Define docs index ports and result contracts.
  - Depends on: T001
  - Files: `src/ports/`, `src/contracts/`, `src/application/`
  - Acceptance: Contracts model indexed docs, search hits, match metadata,
    cursor/truncation, index freshness, and degraded reasons without exposing
    raw SQLite rows.
  - Evidence: Pending.

- [ ] T004 Add SQLite schema migration for docs FTS.
  - Depends on: T002, T003
  - Files: `src/infrastructure/sqlite/`, `tests/docs/`
  - Acceptance: Schema creates docs document, heading, and FTS tables with
    schema-versioned migration tests and no raw table leakage into contracts.
  - Evidence: Pending.

- [ ] T005 Implement docs FTS index writer.
  - Depends on: T004
  - Files: `src/infrastructure/sqlite/`, `src/application/`, `tests/docs/`
  - Acceptance: Writer upserts/removes docs rows, excludes generated/vendor
    paths, records selected-text truncation, and associates rows with snapshot
    or docs-index freshness identity.
  - Evidence: Pending.

- [ ] T006 Implement docs FTS query adapter and ranking.
  - Depends on: T005
  - Files: `src/infrastructure/sqlite/`, `tests/docs/`, `tests/graph/`
  - Acceptance: Adapter returns deterministic ranked hits, heading match
    metadata, snippets, result count, truncation, and cursor/continuation
    evidence while downranking generic/template overmatch.
  - Evidence: Pending.

- [ ] T007 Wire docs indexing into warmup/snapshot flow.
  - Depends on: T005
  - Files: `src/application/use-cases/index-repository-graph.ts`,
    `src/server.ts`, `tests/runtime/`, `tests/integration/`
  - Acceptance: Warmup builds docs FTS evidence without broad search-time file
    reads and status/freshness metadata reflects usable docs index state.
  - Evidence: Pending.

- [ ] T008 Replace `docs_search` with FTS-backed query path.
  - Depends on: T006, T007
  - Files: `src/application/use-cases/query-docs.ts`, `src/presentation/`,
    `tests/docs/`, `tests/mcp/`
  - Acceptance: `docs_search` uses the docs index port, preserves public
    envelope shape, supports pagination/truncation, and returns structured
    degraded/blocked states instead of scanner fallback.
  - Evidence: Pending.

- [ ] T009 Add degraded-state and telemetry coverage.
  - Depends on: T008
  - Files: `tests/docs/`, `tests/mcp/`, `tests/telemetry/`
  - Acceptance: Cold, stale, invalid, unavailable, and optional telemetry
    states are tested without hidden scanner fallback or user-facing noisy
    errors.
  - Evidence: Pending.

- [ ] T010 Retest parity against Python Agent IDE and sample repos.
  - Depends on: T009
  - Files: `.tmp/`, `docs/specs/013-fts-backed-docs-search/verification.md`
  - Acceptance: Read-only comparisons cover this repo plus at least two sample
    repos; evidence records where Agent Workbench is same, better, or still
    weaker.
  - Evidence: Pending.

- [ ] T011 Promote durable docs and close the spec.
  - Depends on: T010
  - Files: `docs/design/mcp-surface-design.md`,
    `docs/design/graph-store-design.md`,
    `docs/design/runtime-operations-design.md`,
    `docs/reference/documentation-map.md`,
    `docs/specs/013-fts-backed-docs-search/`
  - Acceptance: Durable docs describe FTS docs index/search behavior, budgets,
    freshness, degraded states, pagination, caveats, and deferred
    crosslink/report work; closure checks pass.
  - Evidence: Pending.
