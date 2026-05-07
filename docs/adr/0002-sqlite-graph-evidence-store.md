---
title: Use SQLite as the graph evidence store
doc_type: adr
status: draft
owner: platform
last_reviewed: 2026-05-07
decision_date: 2026-05-07
deciders:
  - platform
supersedes:
superseded_by:
---

# ADR: Use SQLite As The Graph Evidence Store

## Status

Proposed

## Context

The runtime needs fast symbol lookup, graph traversal, FTS search, impact
analysis, docs routing, validation hints, and freshness metadata. It also needs
local-first deployment with minimal infrastructure.

## Decision

Use SQLite with FTS as the initial graph evidence store. Persist files, nodes,
edges, unresolved refs, docs, tests, snapshots, attention items, and usage
events in SQLite.

Source files, repo config, parser/LSP output, and executed tests remain
authoritative. SQLite is an acceleration and evidence store, not canonical
truth.

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

The implementation needs migrations, schema validation, query budgets, locked
rebuilds, temporary databases, and atomic replacement. The durable MCP and
adapter contracts should remain storage-neutral enough to allow future hot-path
optimization.

## Related Artifacts

- Related architecture docs: [System architecture](../architecture/system-architecture.md)
- Related design docs: [Graph store design](../design/graph-store-design.md)
- Related code or config:
