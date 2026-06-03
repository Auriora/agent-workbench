---
title: Use a local-first repo runtime
doc_type: adr
status: accepted
owner: platform
last_reviewed: 2026-05-08
decision_date: 2026-05-08
deciders:
  - platform
supersedes:
superseded_by:
---

# ADR: Use A Local-First Repo Runtime

## Status

Accepted

## Context

The restart targets an agent-first IDE backend. The existing proof of concept
shows value in a long-lived repo-scoped runtime with warm cache state, compact
MCP resources, graph-backed tools, and post-edit validation support.

The first implementation must optimize for deterministic local evidence,
workspace safety, and low-latency agent workflows.

## Decision

Use a local-first runtime that binds to one analyzed repository, watches source
and config changes, maintains local graph/index state, and exposes MCP
resources and tools to coding agents.

Cloud-hosted multi-user orchestration and a graphical IDE UI are out of scope
for the first implementation.

## Alternatives Considered

### Cloud-Hosted Runtime

- Pros:
  centralized orchestration, easier fleet visibility.
- Cons:
  harder workspace trust model, more latency, more setup, and premature
  multi-user complexity.

### Stateless CLI Tools

- Pros:
  simple installation and execution model.
- Cons:
  repeated cold scans, weaker freshness tracking, and less useful edit-loop
  continuity.

## Consequences

The runtime needs explicit repo binding, freshness semantics, local storage
management, watcher recovery, and clear sandbox/process execution boundaries.
It can provide fast hot-path tools and compact MCP resources without requiring
remote infrastructure.

## Related Artifacts

- Related architecture docs: [System architecture](../architecture/system-architecture.md)
- Related specs: [MVP requirements](../specs/001-agent-ide-runtime/requirements.md)
- Related code or config:
