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
T001 -> T002 -> T003 -> T004 -> T005 -> T006 -> T007
```

- [ ] T001 Add FTS docs search fixtures and parity cases.
  - Files: `tests/fixtures/`, `tests/docs/`
  - Acceptance: Fixtures cover multi-term queries, phrase matches, heading
    matches, generic term overmatch, template downranking, pagination,
    skipped/generated docs, and stale/degraded index states.
  - Evidence: Pending.

- [ ] T002 Define docs index ports and result contracts.
  - Depends on: T001
  - Files: `src/ports/`, `src/contracts/`, `src/application/`
  - Acceptance: Contracts model indexed docs, search hits, match metadata,
    cursor/truncation, index freshness, and degraded reasons without exposing
    raw SQLite rows.
  - Evidence: Pending.

- [ ] T003 Implement SQLite FTS docs index adapter.
  - Depends on: T002
  - Files: `src/infrastructure/sqlite/`, `tests/docs/`, `tests/graph/`
  - Acceptance: Adapter creates schema, writes/removes docs rows, refreshes FTS
    rows, enforces budgets, and reports stale/invalid index states.
  - Evidence: Pending.

- [ ] T004 Wire docs indexing into warmup/snapshot flow.
  - Depends on: T003
  - Files: `src/application/use-cases/index-repository-graph.ts`,
    `src/server.ts`, `tests/runtime/`, `tests/integration/`
  - Acceptance: Warmup builds docs FTS evidence without broad search-time file
    reads and status/freshness metadata reflects usable docs index state.
  - Evidence: Pending.

- [ ] T005 Replace `docs_search` with FTS-backed query path.
  - Depends on: T004
  - Files: `src/application/use-cases/query-docs.ts`, `src/presentation/`,
    `tests/docs/`, `tests/mcp/`
  - Acceptance: `docs_search` uses the docs index port, preserves public
    envelope shape, supports pagination/truncation, and returns structured
    degraded/blocked states instead of scanner fallback.
  - Evidence: Pending.

- [ ] T006 Retest parity against Python Agent IDE and sample repos.
  - Depends on: T005
  - Files: `.tmp/`, `docs/specs/013-fts-backed-docs-search/verification.md`
  - Acceptance: Read-only comparisons cover this repo plus at least two sample
    repos; evidence records where Agent Workbench is same, better, or still
    weaker.
  - Evidence: Pending.

- [ ] T007 Promote durable docs and close the spec.
  - Depends on: T006
  - Files: `docs/design/mcp-surface-design.md`,
    `docs/design/graph-store-design.md`,
    `docs/design/runtime-operations-design.md`,
    `docs/reference/documentation-map.md`,
    `docs/specs/013-fts-backed-docs-search/`
  - Acceptance: Durable docs describe FTS docs index/search behavior, budgets,
    freshness, degraded states, pagination, caveats, and deferred
    crosslink/report work; closure checks pass.
  - Evidence: Pending.
