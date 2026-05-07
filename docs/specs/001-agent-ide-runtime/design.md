---
title: Agent IDE runtime MVP design
doc_type: spec
status: draft
owner: platform
last_reviewed: 2026-05-07
---

# Design

## Overview

The MVP is a thin vertical runtime slice across graph storage, adapters, MCP
tools, attention, edits, validation, and reporting. It should prove the durable
contracts without pretending every language backend is complete.

## Components And Changes

- Repo runtime:
  explicit repo binding, scope, watcher state, and MCP lifecycle.
- Graph store:
  SQLite schema, FTS indexes, migrations, snapshots, freshness, and query APIs.
- Adapter registry:
  adapter discovery, capability levels, extraction output, and degraded modes.
- MCP surface:
  first-read resources, workflow tools, graph tools, edit tools, and attention
  tools.
- Context engine:
  task context packing, confidence labels, direct-read prompts, and validation
  hints.
- Attention layer:
  blockers, warnings, nudges, context items, and next-action suggestions.
- Edit manager:
  preview, apply, drift check, and rollback contracts.
- Validation engine:
  diagnostics, formatting, lint, and nearest-test planning.
- Knowledge layer:
  graph report, communities, god nodes, gaps, and caveats.

## Data And Contract Impact

- SQLite schema for files, nodes, edges, unresolved refs, snapshots, docs,
  tests, attention items, and usage events.
- MCP schemas for resources and tools.
- Adapter output schema with capability, provenance, confidence, source ranges,
  diagnostics hints, and test hints.
- Attention item schema with severity, kind, scope, evidence, and next action.

## Operational Considerations

- Generated runtime caches must stay outside tracked source.
- Rebuilds must use temporary databases and atomic replace.
- Missing parser/LSP/tooling must degrade explicitly.
- Broad graph reports should be explicit, budgeted operations.
- Runtime status should expose freshness and indexing health.

## Open Questions

- Should tree-sitter or LSP be primary where both are available?
- Should generated graph reports be committed, generated on demand, or both?
- What minimum MCP/client surface is needed for the first supported agents?
- Should vector search wait until after FTS and graph traversal are proven?
