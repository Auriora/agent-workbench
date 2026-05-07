---
title: Agent IDE runtime MVP design
doc_type: spec
status: draft
owner: platform
last_reviewed: 2026-05-07
---

# Design

## Overview

The MVP is a thin vertical runtime slice across graph storage, one adapter path,
MCP read tools, bounded edits, validation planning, and workspace safety. It
should prove the durable contracts without pretending any language backend is
semantic before promotion fixtures pass.

## Components And Changes

- Repo runtime:
  explicit repo binding, scope, watcher state, and MCP lifecycle.
- Graph store:
  SQLite schema, FTS indexes, migrations, snapshots, freshness, and query APIs.
- Adapter registry:
  adapter discovery, capability levels, extraction output, and degraded modes.
- MCP surface:
  status, scope, overview, context, symbol search, references, bounded impact,
  preview/apply, and validation plan.
- Workflow service:
  task context packing, confidence labels, direct-read prompts, blockers,
  warnings, and validation hints.
- Edit manager:
  preview, apply, drift check, and path containment.
- Validation planner:
  diagnostics, formatting, lint, and test planning without command execution by
  default.
- Workspace safety:
  path containment, command planning gates, redaction, and generated-write
  policy.

## Data And Contract Impact

- SQLite schema for files, nodes, edges, unresolved refs, snapshots, and FTS.
- MCP schemas for MVP resources and tools.
- Adapter output schema with capability, provenance, confidence, source ranges,
  diagnostics hints, and test hints.
- Shared response envelope, attention item shape, and edit token shape from
  [Runtime contracts](../../reference/runtime-contracts.md).

## Operational Considerations

- Generated runtime caches must stay outside tracked source.
- Rebuilds must use temporary databases and atomic replace.
- Missing parser/LSP/tooling must degrade explicitly.
- Broad graph reports are post-MVP.
- Validation command execution is post-MVP unless explicitly allowlisted.
- Workspace safety must reject unsafe paths and redact secret-like values.
- Runtime status should expose freshness and indexing health.

## Open Questions

- Should tree-sitter or LSP be primary where both are available?
- What minimum MCP/client surface is needed for the first supported agents?
- Which language path should be the first partial-semantic fixture?
