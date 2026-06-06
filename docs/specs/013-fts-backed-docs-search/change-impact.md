---
title: FTS-backed docs search change impact
doc_type: spec
artifact_type: change-impact
status: archived
owner: platform
last_reviewed: 2026-06-06
---

# Change Impact

## Durable Source Mapping

| Document | Impact | Notes |
| --- | --- | --- |
| `docs/design/mcp-surface-design.md` | Modify | Describe `docs_search` as FTS-backed, with ranking, cursor/truncation, degraded states, and direct-read caveats. |
| `docs/design/graph-store-design.md` | Modify | Add docs FTS index schema/freshness details or clarify existing FTS ownership for docs rows. |
| `docs/design/runtime-operations-design.md` | Modify | Document warmup/cache behavior for docs FTS refresh and stale index reporting. |
| `docs/design/markdown-document-quality-design.md` | Clarify | Preserve the boundary between docs search/read and future Markdown quality tools. |
| `docs/reference/documentation-map.md` | Modify | Add Spec 013 delivery record on closure and point current behavior to durable owners. |

## Proposed Changes

- Add docs index/query port contracts.
- Add or extend SQLite adapter schema for docs FTS rows.
- Replace scanner-backed `docs_search` with an indexed query path.
- Preserve existing MCP tool name and envelope shape.
- Add degraded/blocked state for cold/stale/unavailable docs index.

## Promotion Targets

| Target | Promotion Criteria |
| --- | --- |
| `docs/design/mcp-surface-design.md` | Update when `docs_search` uses FTS-backed search and public budgets/degraded states are finalized. |
| `docs/design/graph-store-design.md` | Update when storage schema and docs FTS freshness ownership are implemented. |
| `docs/design/runtime-operations-design.md` | Update when warmup/cache behavior is implemented and validated. |
| `docs/design/markdown-document-quality-design.md` | Update if implementation changes the query/read versus quality-tool boundary. |
| `docs/reference/documentation-map.md` | Update during closure to mark Spec 013 as archived delivery evidence. |

## Deferred Work

- `docs_crosslinks`
- generated docs reports
- vector search
- indexed overview/map migration unless selected during implementation
