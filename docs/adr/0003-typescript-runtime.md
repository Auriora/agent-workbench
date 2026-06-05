---
title: Start with a TypeScript runtime
doc_type: adr
status: accepted
owner: platform
last_reviewed: 2026-06-05
decision_date: 2026-05-08
deciders:
  - platform
supersedes:
superseded_by:
---

# ADR: Start With A TypeScript Runtime

## Status

Accepted

## Context

The restart needs to iterate quickly on MCP contracts, graph indexing, watcher
behavior, context ranking, attention items, validation loops, and agent
ergonomics. TypeScript on Node.js gives the runtime practical access to
tree-sitter extraction, SQLite, MCP packaging, filesystem watching, worker
threads, and cross-platform distribution.

## Decision

Start with a TypeScript runtime on Node.js while keeping graph schema, adapter
contracts, MCP contracts, and persisted data model language-neutral.

Python remains an important adapter and validation ecosystem. Rust remains a
future option for hot-path parsing, graph indexing, or reference resolution
after profiling.

## Alternatives Considered

### Python Core Runtime

- Pros:
  strong Python ecosystem and existing proof-of-concept knowledge.
- Cons:
  repeats Python-first assumptions, environment coupling, and broad-scan
  performance pressure from the existing proof of concept.

### Rust Core Runtime

- Pros:
  strong performance and memory control.
- Cons:
  slower early iteration while the product contracts are still fluid.

## Consequences

The runtime can use Node.js filesystem watching, worker threads, subprocess
orchestration, npm distribution, and MCP packaging. Durable contracts must avoid
Node-specific assumptions so a future hot-path core can be introduced without
breaking clients.

## Related Artifacts

- Related architecture docs: [System architecture](../architecture/system-architecture.md)
- Related specs: [MVP design](../specs/001-agent-ide-runtime/design.md)
- Related code or config:
