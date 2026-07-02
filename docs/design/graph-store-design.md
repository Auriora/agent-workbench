---
title: Graph store design
doc_type: design
status: draft
owner: platform
last_reviewed: 2026-07-02
---

# Graph Store Design

## Purpose

Define the SQLite-backed graph evidence store for the Agent IDE runtime.

## Scope

This design covers persisted records, indexes, freshness, provenance, rebuild
behavior, and performance constraints for graph-backed runtime queries.

## Design Summary

The graph store is an acceleration and evidence store. In the MVP, it supports
status, scope, context, symbol search, references, bounded impact, and
validation planning. It is not the canonical source of truth; source files and
repo config are canonical, while `tree-sitter` extraction, optional enrichment
output, and executed tests are derived evidence tied to a snapshot.

SQLite with FTS is the initial storage substrate because it supports local-first
deployment, transactional updates, predictable query plans, and simple
distribution.

The graph store is an infrastructure adapter behind graph ports. Application
use cases depend on graph read/write ports and graph read models, not SQLite
tables, SQL, or FTS implementation details. Language extractors never write
SQLite rows directly; they emit extraction batches that ingestion use cases
validate and persist through graph ports.

## Components And Responsibilities

| Component | Responsibility | Owned Inputs | Owned Outputs |
| --- | --- | --- | --- |
| Schema manager | Create, migrate, validate, and atomically replace databases | schema version, migrations | validated SQLite database |
| File indexer | Track file identity, hashes, mtimes, language, and indexing errors | workspace files, watcher events | `files` rows and freshness signals |
| Node writer | Persist symbols, file outlines, and resource-backed nodes | adapter output | `nodes` rows |
| Edge writer | Persist relationships with confidence and provenance | resolver output | `edges` rows |
| Reference store | Retain unresolved references for later resolution and caveats | adapter output | `unresolved_refs` rows |
| Snapshot manager | Track repo/config identity and freshness | sync events, config | `snapshots` rows |
| FTS indexer | Index names, qualified names, signatures, and selected non-secret text | selected graph rows | FTS tables and search results |
| Docs FTS indexer | Index Markdown path, title, headings, and bounded selected body text | cataloged Markdown docs | `docs_documents`, `docs_headings`, and `docs_fts` rows |

## Ports And Read Models

MVP graph ports:

- `GraphWritePort`: persists files, nodes, edges, unresolved refs, and FTS
  content through transactional updates.
- `GraphQueryPort`: supports exact lookup, FTS lookup, file/range lookup,
  incoming/outgoing edges, and bounded traversal.
- `SnapshotPort`: reports and updates cold, refreshing, stale, and fresh
  snapshot state.
- `GraphTransactionPort`: commits stale cleanup, extraction writes, reference
  resolution writes, FTS refresh, and snapshot updates atomically.

Application-facing read models must use domain vocabulary such as file identity,
source range, node, edge, evidence, confidence, and freshness. They must not
expose SQL row shapes.

## Data And Control Flow

```text
watcher or scan event
-> file identity and language detection
-> adapter extraction
-> unresolved reference storage
-> reference resolution
-> node and edge writes
-> FTS refresh
-> snapshot/freshness update
-> MCP query reads
```

## Contracts And Schemas

| Contract | Location | Producer | Consumer | Compatibility Notes |
| --- | --- | --- | --- | --- |
| Graph schema | `docs/design/graph-store-design.md` until implementation adds migrations | Runtime | Graph queries, context, validation planning | Schema changes require migrations and fixture updates |
| Adapter output | [language-adapter-design.md](language-adapter-design.md) | Adapters | Graph writer, resolver | Must include provenance and capability metadata |
| MCP query responses | [mcp-surface-design.md](mcp-surface-design.md) | Graph-backed tools | Agents | Must expose trust and freshness labels |

## MVP Core Tables

- `files`: repo-relative path, language, content hash, size, mtime, indexed_at,
  node count, indexing errors, and snapshot id.
- `nodes`: stable id, kind, name, qualified name, file path, language, source
  range, signature, docstring, visibility, and metadata.
- `edges`: source node, target node, kind, source range, provenance,
  confidence, and metadata.
- `unresolved_refs`: source node, reference name, reference kind, file, range,
  and candidate metadata.
- `snapshots`: repo/config identity, created_at, freshness, and schema version.
- `docs_documents`: snapshot id, repo-relative Markdown path, title, content
  hash, byte count, indexed-at timestamp, and selected-text truncation flag.
- `docs_headings`: document id, stable heading id, heading text, depth, and
  line number.
- `docs_fts`: SQLite FTS5 virtual table over docs path, title, headings text,
  and bounded selected body text.

Post-MVP tables such as `tests`, `attention_items`, `usage_events`, and report
caches should be added only when a concrete query requires relational storage.

## Schema Invariants

- Every table has an integer primary key or stable text id.
- Stable node ids are derived from repo identity, file path, node kind,
  qualified name, and source range where available.
- `files.path` is unique within a snapshot.
- `docs_documents.path` is unique within a snapshot.
- `nodes.file_id` references `files`.
- `docs_headings.document_id` references `docs_documents`.
- `edges.source_node_id` and `edges.target_node_id` reference `nodes` when both
  endpoints are resolved.
- Deletes and renames remove stale file, node, edge, FTS, and unresolved-ref
  rows in the same transaction.
- Docs FTS rows are replaced transactionally for a snapshot and are treated as
  derived evidence tied to snapshot freshness.
- Metadata fields must be typed JSON with schema-versioned interpretation.
- FTS rows are refreshed in the same transaction as node writes when possible.

## Indexes

The initial schema must support:

- exact lookup
- lower-name lookup
- qualified-name lookup
- file/range lookup
- incoming and outgoing edge traversal
- FTS over names, qualified names, signatures, docstrings, docs headings, and
  selected text

## Query Budgets

MVP hot-path tools must publish and enforce draft budgets:

| Query | Warm Budget | Limits |
| --- | --- | --- |
| status/scope | 50 ms | no source scan |
| symbol search | 100 ms | max 100 rows |
| docs search | 100 ms | bounded FTS candidate window, max 50 returned hits |
| reference lookup | 150 ms | max depth 1 unless requested |
| context build | 250 ms | max 5 files and source-byte cap |
| impact | 250 ms | max depth 2 and 100 nodes |

Budget tests should use SQL tracing, query-plan assertions, row-count caps, or
traversal-depth caps.

## Configuration Model

| Config Source | Key Or Parameter | Applied By | Effect | Failure Mode |
| --- | --- | --- | --- | --- |
| Runtime config | indexed roots and skipped roots | Repo runtime | Determines file scope | Degrade with scope warning |
| Runtime config | generated/vendor patterns | File indexer | Prevents low-value or risky indexing | Warning when pattern is invalid |
| Schema version | migration version | Schema manager | Controls database compatibility | Block reads until migrated or rebuilt |

## Validation And Error Handling

- Corrupt or incompatible databases must be rebuilt from source.
- SQLite rebuilds must use locks, temporary databases, validation, and atomic
  replacement.
- Graph writes must be serialized per repository through `GraphTransactionPort`.
- Reads may continue against the last valid snapshot while warm-up or
  incremental refresh work is running.
- Watcher-clean snapshots are the freshness authority for hot reads.
- Stale rows must be labeled in downstream MCP responses.
- A watcher-clean snapshot means the event queue is drained, no refresh is in
  progress, and config scope has not changed since the snapshot began.
- Rename, delete, and config-change events invalidate affected rows before new
  evidence is considered fresh.
- Readers during rebuild must either see the previous valid database or a
  `refreshing`/`cold` state, never a partial replacement.

## Documentation Currency Evidence

SQLite-backed `docs_search` remains an FTS routing surface. It joins indexed
docs rows to file identity rows when available so search hits can expose
document currency labels, caveats, and `mtime_ms`-derived `modified_at`
metadata. Missing file identity or Git history evidence is optional enrichment
loss, not a docs-search failure.

The graph store must not persist or infer documentation creation time from
filesystem `ctime`. Local Git first/last touch evidence may be collected by a
bounded Git history port for selected final candidates, but broad docs search
must not walk Git history as hidden work.

## Security And Access

The graph store is local runtime state. It must not write into tracked source
paths unless explicitly configured for generated reports. Generated caches under
`.cache/` must remain untracked.

The graph store must apply the [Workspace safety contract](../reference/workspace-safety-contract.md):
skip or redact secret-like values, avoid indexing `.env` files by default, and
store infrastructure environment variable names rather than values.

Catalog indexing treats hidden paths as local state by default. Allowlisted
repository-shape evidence such as `.github/`, `.devcontainer/`, `.gitignore`,
`.dockerignore`, `.editorconfig`, `.env.example`, `.env.sample`, and
`.env.template` may be indexed; secret-bearing `.env` files, hidden caches, and
agent/tool runtime state must stay out of graph evidence. Root `.gitignore`
patterns are used as an additional skip signal, not as the sole safety policy.

## Observability And Operations

The runtime should expose graph size, schema version, freshness, indexing
errors, adapter coverage, skipped roots, rebuild status, warm-up phase, queue
depths, active worker counts, and query budget violations.

It should also expose cache hit/miss counters where useful, stale row cleanup
counts, watcher overflow recovery, FTS refresh failures, and blocked
query-budget violations.

## Tradeoffs And Constraints

SQLite is chosen for the initial local-first runtime. A future hot-path core can
optimize parsing or graph indexing without changing durable MCP or adapter
contracts.

## Evidence

- Code:
- Config:
- Tests:
- Runbooks:
- Requirements: [Runtime requirements](../requirements/runtime-requirements.md)

## Related Docs

- [System architecture](../architecture/system-architecture.md)
- [ADR-0002](../adr/0002-sqlite-graph-evidence-store.md)
- [Language adapter design](language-adapter-design.md)
- [MCP surface design](mcp-surface-design.md)
- [Runtime contracts](../reference/runtime-contracts.md)
- [Workspace safety contract](../reference/workspace-safety-contract.md)
- [MVP proof matrix](../reference/mvp-proof-matrix.md)
