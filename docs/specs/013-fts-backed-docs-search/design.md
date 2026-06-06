---
title: FTS-backed docs search design
doc_type: spec
artifact_type: design
status: archived
owner: platform
last_reviewed: 2026-06-06
---

# Technical Design

## Overview

Move `docs_search` from per-call Markdown scanning and string scoring to a
SQLite FTS-backed docs index. Keep overview/map/outline/read-section public
contracts intact. Search becomes warm-index routing evidence; outline and
read-section remain direct-read evidence.

## High-Level Design

Components:

- Docs index storage: SQLite table(s) plus FTS5 virtual table for docs search
  fields.
- Docs index writer: receives Markdown file identity, title, headings, heading
  ids, selected body text, and skip/freshness evidence during graph/catalog
  warmup.
- Docs index query port: searches FTS with bounded result count, cursor
  support, snippets, and match metadata.
- Docs search use case: calls the query port, builds existing
  `DocsSearchResult`, and returns degraded/blocked state when the index is not
  usable.
- Docs presenters and MCP adapters: preserve current response envelopes and
  public tool schema.

## Data Model

First-slice storage should be explicit and schema-versioned:

- `docs_documents`
  - `snapshot_id`
  - `path`
  - `title`
  - `heading_count`
  - `content_hash`
  - `byte_count`
  - `indexed_at`
  - `skip_state`
- `docs_headings`
  - `snapshot_id`
  - `path`
  - `heading_id`
  - `heading_text`
  - `depth`
  - `line`
- `docs_fts`
  - path, title, headings text, selected body text

The exact table names can align with the existing SQLite adapter conventions,
but the public contracts must not expose raw table names.

## Low-Level Design

### Indexing

The writer should reuse catalog policy and Markdown parsing from Spec 012. It
must not index generated/vendor/hidden/secret paths. Oversized documents should
be indexed with bounded selected text and recorded truncation evidence.

Index updates should occur with the graph snapshot or a docs-index snapshot
identity so `docs_search` can report freshness. Deletes and renames remove stale
rows in the same transaction or mark the index stale.

### Querying

`docs_search` should:

- parse and validate the public request schema
- query FTS with `max_results + 1` to determine truncation
- rank phrase, title, path, heading, and body matches in a deterministic order
- return heading ids when a heading match is the strongest evidence
- return bounded snippets without exposing raw backend diagnostics
- return a cursor or continuation token when more results exist

Ranking should downrank template/example docs and broad AI-agent guide matches
when a stronger phrase, path, title, or heading match exists elsewhere. This
must be generic path/category scoring, not repository-specific special casing.

### Degraded State

If the FTS index is missing, stale, invalid, or schema-incompatible,
`docs_search` returns a structured degraded or blocked envelope with a next
action naming the public recovery path that exists. It must not silently run the
old scanner/string search path as a fallback.

### Surface Compatibility

`repo:///docs/overview`, `repo:///docs/map`, `docs_outline`, and
`docs_read_section` can continue to use direct scanner/read behavior until a
later spec promotes indexed overview/map. This spec only replaces the
`docs_search` hot path.

## Operational Considerations

- Use SQLite FTS5 because `better-sqlite3` and SQLite are already approved
  infrastructure dependencies.
- Keep query budgets explicit and testable.
- Do not create files in external dogfood repositories during comparison.
- Keep telemetry attributes high level: surface name, index freshness,
  result/truncation counts, latency, and degraded reason.

## Open Questions

Resolved for this implementation slice:

- OD-001: Docs FTS lives in the existing graph SQLite database, using dedicated
  `docs_documents`, `docs_headings`, and `docs_fts` tables. Public contracts
  expose docs index state and hits, not raw table names or rows.
- OD-002: `docs_search` uses an opaque cursor that encodes snapshot identity,
  query, and offset. Cursor internals are not contract-stable; clients only
  treat the value as an opaque continuation token.
- OD-003: `repo:///docs/overview`, `repo:///docs/map`, `docs_outline`, and
  `docs_read_section` stay on the direct scanner/read path for this spec.
  Indexed overview/map can be planned later if dogfood evidence shows that is
  worth doing.
