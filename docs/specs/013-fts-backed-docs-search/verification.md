---
title: FTS-backed docs search verification
doc_type: spec
artifact_type: verification
status: archived
owner: platform
last_reviewed: 2026-06-06
---

# Verification

## Quality Gates

- `pnpm typecheck`
- Focused docs index, SQLite adapter, docs search, MCP, and degraded-state
  tests introduced by this spec
- `pnpm test` before closure
- Spec MCP lint for `docs/specs/013-fts-backed-docs-search`
- `git diff --check`

## Parity Scenarios

- This repo:
  - `docs query read surfaces`
  - `Requirement 2 Docs Search`
  - `docs_search`
- TimeLocker or another docs-heavy repo:
  - `python agent ide evaluation`
  - `agent workbench evaluation`
  - project-specific agent guidance queries
- One large mixed-language repo:
  - docs query with common terms that should not overrank templates or
    generated docs.

## Evidence Log

| Date | Activity | Result |
| --- | --- | --- |
| 2026-06-06 | Spec created after post-reload docs search parity retest | Pending implementation |
| 2026-06-06 | Implemented FTS-backed docs search and ran full validation | `pnpm typecheck` passed; `pnpm test` passed with 46 files and 307 tests. |
| 2026-06-06 | Compared Python Agent IDE `docs_search("docs query read surfaces")` in this repo | Python Agent IDE returned `tests/fixtures/fixture-fts-docs-search-repo/docs/reference/docs-query-read-surfaces.md` as the top hit with SQLite FTS5 evidence. |
| 2026-06-06 | Ran Agent Workbench read-only FTS parity runner for this repo, `../TimeLocker`, and `../OneMount` | Report written to `.tmp/fts-docs-parity/report.json`. Agent Workbench returned the same top hit as Python Agent IDE for this repo's `docs query read surfaces` query after widening the bounded candidate window. TimeLocker and OneMount returned successful FTS results with cursors, but broad evaluation/report queries still show ranking caveats where update indexes, report summaries, or broad implementation docs can outrank the most specific evidence. |

## Residual Risks

- FTS ranking can still overrank generic docs if path/category boosts are too
  broad. Use fixture-backed ranking tests rather than repository-specific
  special cases.
- Index freshness can become confusing if docs FTS state diverges from graph
  snapshot state. Expose the freshness source clearly.
- Replacing scanner search without a fallback raises failure visibility. This
  is intentional: stale/missing index states should be fixed rather than hidden.
- External dogfood ranking still needs tuning for broad query families. The FTS
  implementation is a clear replacement for scanner fallback behavior, but
  parity evidence does not yet justify closing all ranking work as same-or-
  better for every sampled repository.
