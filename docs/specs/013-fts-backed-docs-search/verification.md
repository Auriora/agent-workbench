---
title: FTS-backed docs search verification
doc_type: spec
artifact_type: verification
status: active
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

## Residual Risks

- FTS ranking can still overrank generic docs if path/category boosts are too
  broad. Use fixture-backed ranking tests rather than repository-specific
  special cases.
- Index freshness can become confusing if docs FTS state diverges from graph
  snapshot state. Expose the freshness source clearly.
- Replacing scanner search without a fallback raises failure visibility. This
  is intentional: stale/missing index states should be fixed rather than hidden.
