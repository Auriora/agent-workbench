---
title: Agent IDE system architecture
doc_type: architecture
status: draft
owner: platform
last_reviewed: 2026-05-07
---

# Agent IDE System Architecture

## Purpose

Describe the target architecture for a local-first agent IDE runtime that gives
coding agents fast, trustworthy repository context, edit support, and validation
routing.

## Scope

In scope:

- repo-scoped runtime lifecycle
- SQLite-backed graph and index storage
- language and infrastructure adapters
- MCP resources, tools, prompts, and workflow contracts
- context, attention, validation, and edit-loop services
- knowledge reporting and audit evidence

Out of scope:

- graphical IDE UI
- cloud-hosted multi-user orchestration
- LLM-generated code understanding as the default source of truth
- full semantic support for every language at launch

## System Context

The runtime owns one analyzed repository. It watches files and config, extracts
language-specific evidence into a graph store, exposes compact MCP resources and
tools, and helps agents choose source reads, edits, and validation commands.

Source files, repo config, parser/LSP/tool output, and executed tests remain
authoritative. SQLite is an acceleration and evidence store.

## Major Components

| Component | Responsibility | Boundary |
| --- | --- | --- |
| Repo runtime | Bind to one repository, coordinate indexing, watch changes, expose MCP | Owns runtime state and orchestration, not source truth |
| Graph store | Persist files, symbols, edges, unresolved refs, docs, tests, snapshots, attention, and usage events | Stores evidence and indexes for fast reads |
| Extractor registry | Dispatch language, config, and infra adapters | Normalizes adapter outputs into graph records |
| Reference resolver | Resolve imports, symbols, framework bindings, and infra links | Produces graph edges with provenance and confidence |
| Context engine | Build agent-ready task context | Ranks relevant files, symbols, docs, and validation hints |
| MCP surface | Expose resources and tools to agents | Keeps client contracts stable and machine-readable |
| Attention layer | Surface scoped facts that change the next action | Emits blockers, warnings, nudges, and context items |
| Edit manager | Preview, apply, drift-check, and roll back edits | Owns mutation contracts and rollback tokens |
| Validation engine | Plan or run diagnostics, formatting, lint, and tests | Converts touched files and impact into evidence |
| Knowledge layer | Produce onboarding, graph report, communities, gaps, and audit views | Supports orientation and broad exploration |

## Key Flows

### Index And Query

```text
scan files
-> detect language or infra type
-> extract nodes, edges, unresolved references, docs, and test hints
-> store graph/index rows
-> resolve references
-> answer targeted MCP queries
```

### Agent Edit Loop

```text
repo_preflight
-> context_for_task
-> direct source reads for selected targets or low-confidence context
-> preview/apply edits
-> post_edit_feedback
-> verification_plan
-> run_nearest_tests
```

### Exploration

```text
repo overview/resource reads
-> graph report or community lookup
-> bounded symbol/graph follow-up
-> exact source verification when graph confidence requires it
```

## Dependencies

- SQLite with FTS for graph and row-store persistence.
- Tree-sitter, language parsers, LSPs, and ecosystem tools for extraction,
  diagnostics, formatting, and test routing.
- Filesystem watcher with debounced incremental sync.
- MCP server runtime and generated schemas for the agent-facing surface.

## Constraints

- Hot-path tools must use targeted indexed queries.
- Broad topology and community analysis must be explicit orientation work.
- Results must carry freshness, scope, trust, verification, and evidence labels.
- Mutating operations need preview, drift checks, and rollback support.
- Parser and LSP failures must degrade explicitly instead of pretending to be
  semantic proof.

## Related ADRs

- [0001 Use a local-first repo runtime](../adr/0001-local-first-repo-runtime.md)
- [0002 Use SQLite as the graph evidence store](../adr/0002-sqlite-graph-evidence-store.md)
- [0003 Start with a TypeScript runtime](../adr/0003-typescript-runtime.md)
- [0004 Require semantic evidence before semantic capability](../adr/0004-semantic-evidence-gates.md)

## Related Docs

- [Runtime requirements](../requirements/runtime-requirements.md)
- [Graph store design](../design/graph-store-design.md)
- [Language adapter design](../design/language-adapter-design.md)
- [MCP surface design](../design/mcp-surface-design.md)
- [Attention layer design](../design/attention-layer-design.md)
- [Edit and validation loop design](../design/edit-and-validation-loop-design.md)
- [Knowledge layer design](../design/knowledge-layer-design.md)
