---
title: Agent IDE system architecture
doc_type: architecture
status: draft
owner: platform
last_reviewed: 2026-06-11
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
- cache, warm-up, background work, and concurrency coordination
- initial language and configuration adapters
- MCP resources, tools, prompts, and workflow contracts
- coding-agent integration artifacts for common agent surfaces
- Markdown document quality checks and formatting previews
- context, validation planning, and bounded edit-loop services
- workspace safety and runtime contract enforcement
- layered runtime boundaries for presentation, application use cases, domain
  policies, ports, and infrastructure adapters

Out of scope:

- graphical IDE UI
- cloud-hosted multi-user orchestration
- LLM-generated code understanding as the default source of truth
- full semantic support for every language at launch

## System Context

The runtime owns one analyzed repository. It watches files and config, extracts
language-specific evidence into a graph store, exposes compact MCP resources and
tools, and helps agents choose source reads, bounded edits, and validation
plans.

Source files and repo config are canonical truth. `tree-sitter` extraction,
optional enrichment output, and executed tests are derived evidence tied to a
snapshot. SQLite is an acceleration and evidence store.

## Major Components

| Component | Responsibility | Boundary |
| --- | --- | --- |
| Repo runtime | Bind to one repository, coordinate indexing, watch changes, expose MCP | Owns runtime state and orchestration, not source truth |
| Graph store | Persist files, symbols, edges, unresolved refs, snapshots, and FTS rows | Stores evidence and indexes for fast reads |
| Extractor registry | Dispatch language, config, and infra adapters | Normalizes adapter outputs into graph records |
| Reference resolver | Resolve imports, symbols, framework bindings, and infra links | Produces graph edges with provenance and confidence |
| Application use cases | Orchestrate status, scope, overview, context, search, references, impact, edit, and validation operations | Depend on domain policies and ports, not MCP, SQLite, tree-sitter, or filesystem implementations |
| Presentation layer | Build response envelopes, metadata, warnings/errors, source sections, truncation, and stable ordering | Converts application results into agent-facing responses |
| Runtime operations | Coordinate cache invalidation, warm-up, work queues, parser workers, cancellation, and snapshot publication | Owns async/background execution without leaking it into presentation or MCP |
| MCP surface | Expose resources and tools to agents | Keeps client contracts stable and machine-readable |
| Agent integration layer | Define common integration profiles and emit agent-specific instruction, skill, hook, command, plugin, extension, and ACP-aware artifacts | Keeps vendor-specific formats outside core runtime behavior |
| Documentation quality | Check Markdown structure, compliance, links, and plain-text readability; plan and preview formatting | Uses parser-aware document ports and the edit preview/apply safety path |
| Edit manager | Preview, apply, and drift-check bounded edits | Owns workspace mutation contracts |
| Command runner | Plan commands in MVP and execute allowlisted commands post-MVP | Owns process execution safety |
| Knowledge layer | Produce graph reports and communities after the hot path is proven | Post-MVP orientation surface |

## Layered Runtime

Implementation must follow [Layered runtime architecture](../design/layered-runtime-architecture.md).

```text
interface adapters
-> presentation
-> application use cases
-> domain models, services, and policies
-> ports
<- infrastructure adapters
```

MCP, SQLite, tree-sitter, filesystem watching, and process execution are outer
adapters. Application and domain code depend on ports and policies, not concrete
infrastructure. MCP handlers must call one use case and one presenter; they must
not query SQLite, parse source, or hand-build response envelopes.

Shared response policy follows the same dependency direction. Application-owned
helpers handle Markdown document selection, response metadata policy, public
next-action filtering, and runtime trust classification. Presenters depend
inward on those helpers to build envelopes, while concrete telemetry remains in
infrastructure behind `TelemetryRecorderPort`.

Coding-agent integration emitters are also outer adapters. They may target
Codex, Claude Code, Kiro, Augment, Gemini, Junie, or future agents, but they
must generate artifacts from common integration specs and runtime contracts
rather than owning runtime behavior.

## Key Flows

### Index And Query

```text
scan files
-> detect language or infra type
-> extract nodes, edges, and unresolved references
-> store graph/index rows
-> resolve references
-> answer targeted MCP queries
```

### Agent Edit Loop

```text
repo status and scope
-> context_for_task
-> direct source reads for selected targets or low-confidence context
-> preview/apply edits
-> verification_plan
-> manual or future allowlisted command execution
```

### Exploration

```text
repo overview/resource reads
-> bounded symbol/reference/impact follow-up
-> exact source verification when graph confidence requires it
```

## Dependencies

- SQLite with FTS for graph and row-store persistence.
- `tree-sitter` and grammar packages for primary extraction.
- Optional AST/LSP and ecosystem tools for diagnostics, formatting, enrichment,
  and test routing.
- Filesystem watcher with debounced incremental sync.
- Runtime operation ports for cache invalidation, warm-up coordination, work
  queues, parser worker pools, cancellation, and snapshot coordination.
- MCP server runtime and generated schemas for the agent-facing surface.
- Agent integration artifact emitters for selected coding-agent targets.
- Markdown parser and documentation policy components for document quality
  checks and format planning.

## Constraints

- Hot-path tools must use targeted indexed queries.
- Broad topology and community analysis must be explicit orientation work.
- Results must use the shared runtime response envelope and enums.
- Response envelopes, warnings/errors, budgets, truncation, and source section
  packing must be assembled by presentation components, not individual tools.
- Mutating operations need preview and drift checks in MVP; rollback is
  post-MVP unless proven cheap and bounded.
- Commands are plan-only by default until allowlisted execution is designed.
- Workspace safety covers path containment, generated writes, redaction, and
  command execution.
- Primary parser and optional enrichment failures must degrade explicitly
  instead of pretending to be semantic proof.
- Concurrent reads use the last valid snapshot while background work refreshes
  derived evidence. Graph writes are serialized per repository.
- MCP is the authoritative executable integration surface. Agent-specific
  plugins, skills, hooks, commands, steering, rules, guidelines, extensions, and
  ACP packaging are generated adapters around the runtime surface.
- Markdown formatting must be previewed and applied through the same bounded
  edit safety path as code changes.

## Related ADRs

- [0001 Use a local-first repo runtime](../adr/0001-local-first-repo-runtime.md)
- [0002 Use SQLite as the graph evidence store](../adr/0002-sqlite-graph-evidence-store.md)
- [0003 Start with a TypeScript runtime](../adr/0003-typescript-runtime.md)
- [0004 Require semantic evidence before semantic capability](../adr/0004-semantic-evidence-gates.md)

## Related Docs

- [Runtime requirements](../requirements/runtime-requirements.md)
- [Runtime contracts](../reference/runtime-contracts.md)
- [Workspace safety contract](../reference/workspace-safety-contract.md)
- [Graph store design](../design/graph-store-design.md)
- [Layered runtime architecture](../design/layered-runtime-architecture.md)
- [Runtime operations design](../design/runtime-operations-design.md)
- [Language adapter design](../design/language-adapter-design.md)
- [MCP surface design](../design/mcp-surface-design.md)
- [Coding agent integration design](../design/coding-agent-integration-design.md)
- [Markdown document quality design](../design/markdown-document-quality-design.md)
- [Attention layer design](../design/attention-layer-design.md)
- [Edit and validation loop design](../design/edit-and-validation-loop-design.md)
- [Knowledge layer design](../design/knowledge-layer-design.md)
