---
title: Use SQLite as the graph evidence store
doc_type: adr
status: accepted
owner: platform
last_reviewed: 2026-05-08
decision_date: 2026-05-08
deciders:
  - platform
supersedes:
superseded_by:
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# ADR: Use SQLite As The Graph Evidence Store

## Status

Accepted

## Context

The runtime needs fast symbol lookup, graph traversal, FTS search, impact
analysis, docs routing, validation hints, and freshness metadata. It also needs
local-first deployment with minimal infrastructure.

## Decision

Use SQLite with FTS as the initial graph evidence store. The MVP persists files,
nodes, edges, unresolved refs, snapshots, and FTS rows. Docs, tests, attention
items, usage events, and report caches are post-MVP unless a concrete query
requires relational storage.

Source files and repo config remain canonical truth. Parser/LSP/tool output and
executed tests are derived evidence tied to a snapshot. SQLite is an
acceleration and evidence store, not canonical truth.

## Alternatives Considered

### JSON Cache Files

- Pros:
  simple to inspect and write.
- Cons:
  poor query behavior, unbounded growth risk, harder atomic updates, and weak
  relational traversal.

### External Graph Database

- Pros:
  strong graph query model.
- Cons:
  too much operational overhead for a local-first MVP.

### In-Memory Only Index

- Pros:
  fast during one process lifetime.
- Cons:
  cold start cost, weak auditability, and no durable freshness metadata.

## Consequences

The implementation needs schema invariants, migrations, schema validation,
query budgets, locked rebuilds, temporary databases, reader-safe atomic
replacement, FTS sync tests, stale-row cleanup, and freshness state tests. The
durable MCP and adapter contracts should remain storage-neutral enough to allow
future hot-path optimization.

## Related Artifacts

- Related architecture docs: [System architecture](../architecture/system-architecture.md)
- Related design docs: [Graph store design](../design/graph-store-design.md)
- Related code or config:
