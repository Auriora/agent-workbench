---
title: Graph store design
doc_type: design
status: draft
owner: platform
last_reviewed: 2026-05-07
---

# Graph Store Design

## Purpose

Define the SQLite-backed graph evidence store for the Agent IDE runtime.

## Scope

This design covers persisted records, indexes, freshness, provenance, rebuild
behavior, and performance constraints for graph-backed runtime queries.

## Design Summary

The graph store is an acceleration and evidence store. It supports fast MCP
tools, context building, impact analysis, validation routing, knowledge reports,
and attention items. It is not the canonical source of truth; source files, repo
config, parser/LSP/tool output, and executed tests remain authoritative.

SQLite with FTS is the initial storage substrate because it supports local-first
deployment, transactional updates, predictable query plans, and simple
distribution.

## Components And Responsibilities

| Component | Responsibility | Owned Inputs | Owned Outputs |
| --- | --- | --- | --- |
| Schema manager | Create, migrate, validate, and atomically replace databases | schema version, migrations | validated SQLite database |
| File indexer | Track file identity, hashes, mtimes, language, and indexing errors | workspace files, watcher events | `files` rows and freshness signals |
| Node writer | Persist symbols, docs, tests, resources, and infra nodes | adapter output | `nodes` rows |
| Edge writer | Persist relationships with confidence and provenance | resolver output | `edges` rows |
| Reference store | Retain unresolved references for later resolution and caveats | adapter output | `unresolved_refs` rows |
| Snapshot manager | Track repo/config identity and freshness | sync events, config | `snapshots` rows |
| FTS indexer | Index names, qualified names, signatures, docstrings, and docs text | selected graph rows | FTS tables and search results |

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
| Graph schema | `docs/design/graph-store-design.md` until implementation adds migrations | Runtime | Graph queries, context, validation, reports | Schema changes require migrations and fixture updates |
| Adapter output | [language-adapter-design.md](language-adapter-design.md) | Adapters | Graph writer, resolver | Must include provenance and capability metadata |
| MCP query responses | [mcp-surface-design.md](mcp-surface-design.md) | Graph-backed tools | Agents | Must expose trust and freshness labels |

## Core Tables

- `files`: repo-relative path, language, content hash, size, mtime, indexed_at,
  node count, and indexing errors.
- `nodes`: stable id, kind, name, qualified name, file path, language, source
  range, signature, docstring, visibility, and metadata.
- `edges`: source node, target node, kind, source range, provenance,
  confidence, and metadata.
- `unresolved_refs`: source node, reference name, reference kind, file, range,
  and candidate metadata.
- `snapshots`: repo/config identity, created_at, freshness, and schema version.
- `docs`: markdown/doc paths, headings, links, path mentions, and source
  identity.
- `tests`: test files, test cases, nearest-code links, and command hints.
- `attention_items`: severity, kind, source, scope, evidence, next action, and
  lifecycle state.
- `usage_events`: tool/resource usage, fallback reasons, and validation gaps.

## Indexes

The initial schema must support:

- exact lookup
- lower-name lookup
- qualified-name lookup
- file/range lookup
- incoming and outgoing edge traversal
- FTS over names, qualified names, signatures, docstrings, docs headings, and
  selected text

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
- Watcher-clean snapshots are the freshness authority for hot reads.
- Stale rows must be labeled in downstream MCP responses.

## Security And Access

The graph store is local runtime state. It must not write into tracked source
paths unless explicitly configured for generated reports. Generated caches under
`.cache/` must remain untracked.

## Observability And Operations

The runtime should expose graph size, schema version, freshness, indexing
errors, adapter coverage, skipped roots, rebuild status, and query budget
violations.

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
