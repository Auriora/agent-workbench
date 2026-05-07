---
title: Agent IDE runtime MVP specification
doc_type: spec
status: draft
owner: platform
last_reviewed: 2026-05-07
---

# Feature Specification

## Summary

Build the first useful Agent IDE runtime: a local-first MCP backend that binds
to one repository, maintains a SQLite graph/index, exposes targeted context and
graph tools, supports safe edit contracts, and routes validation from graph
impact.

## Problem

Coding agents fall back to broad shell search, broad file reads, and ad hoc
validation when they lack fast, trustworthy repository context. The runtime
should provide IDE-like evidence through MCP without hiding uncertainty or
performing expensive broad computation on hot paths.

## Goals

- Provide a repo-scoped local runtime with explicit status and scope.
- Persist graph/index evidence in SQLite with FTS.
- Support Markdown/config, Python, TypeScript/JavaScript, C#, and
  CloudFormation/SAM thin vertical slices.
- Expose MCP resources and tools for preflight, context, symbols, graph
  traversal, impact, diagnostics, validation, attention, and edits.
- Require trust, freshness, scope, verification, and evidence metadata on
  runtime output.
- Support preview/apply/rollback edit contracts.
- Generate an orientation graph report with communities, gaps, and caveats.

## Non-Goals

- Full graphical IDE UI.
- Cloud-hosted multi-user orchestration.
- Full semantic support for every language.
- Advanced refactors such as extract interface, pull up, push down, or broad
  safe delete.
- Vector search in the MVP.

## Requirements

### Functional Requirements

- **FR-001**: The runtime MUST bind to one repository and expose status, scope,
  and freshness.
- **FR-002**: The runtime MUST persist graph evidence in SQLite with FTS indexes.
- **FR-003**: The runtime MUST extract files, nodes, edges, unresolved refs,
  docs, tests, snapshots, attention items, and usage events.
- **FR-004**: The runtime MUST expose first-read MCP resources for overview,
  status, scope, MCP surface, graph report, docs overview, validation surface,
  attention, and usage gaps.
- **FR-005**: The runtime MUST expose targeted tools for context, symbols,
  references, callers, callees, impact, diagnostics, verification, and nearest
  tests.
- **FR-006**: The runtime MUST expose edit tools for preview, apply, concurrent
  modification checks, and rollback.
- **FR-007**: All results MUST include trust, freshness, scope, verification,
  and evidence metadata.
- **FR-008**: Each adapter MUST report a capability level.
- **FR-009**: The MVP MUST include thin vertical slices for Markdown/config,
  Python, TypeScript/JavaScript, C#, and CloudFormation/SAM.
- **FR-010**: The runtime MUST record repeated fallback as usage-gap evidence.

### Key Entities

- **File**: repo-relative path, identity, language, freshness, and indexing
  status.
- **Node**: symbol, doc section, test, resource, or infra element with source
  range and metadata.
- **Edge**: relationship between nodes with confidence and provenance.
- **Unresolved Reference**: extracted reference that could not be resolved with
  enough confidence.
- **Snapshot**: repo/config identity and freshness state.
- **Attention Item**: scoped next-action guidance with severity, evidence, and
  suggested tool call.
- **Usage Event**: tool/resource use, fallback reason, or validation gap.

## Acceptance Criteria

1. **Given** a supported repository, **When** the runtime initializes, **Then**
   `repo:///status` reports scope, freshness, indexed roots, skipped roots, and
   adapter coverage.
2. **Given** a known symbol, **When** an agent calls `symbol_search`, **Then**
   the response includes matching locations, trust metadata, and freshness.
3. **Given** a file edit, **When** the agent requests a verification plan,
   **Then** the runtime recommends diagnostics and nearest tests based on touched
   files and graph impact.
4. **Given** a stale preview, **When** an agent attempts to apply it, **Then**
   the runtime blocks the mutation and emits a stale-preview attention item.
5. **Given** missing parser or LSP tooling, **When** adapter output is requested,
   **Then** the runtime reports degraded capability instead of semantic proof.

## User Scenarios And Testing

### User Story 1 - Repository Preflight And Context (Priority: P1)

An agent starts work in a repository and needs scoped, trustworthy context
before reading files or editing.

**Why this priority**: This is the main entry point for reducing broad file
reads and shell fallback.

**Independent Test**: Initialize a fixture repo and verify preflight, scope,
overview, and context responses.

### User Story 2 - Targeted Graph Queries (Priority: P1)

An agent needs definitions, references, callers, callees, and impact for a
symbol without scanning the whole repository.

**Why this priority**: This proves the graph store and query contracts.

**Independent Test**: Query known fixture symbols and compare graph results to
expected locations and metadata.

### User Story 3 - Edit Feedback And Validation (Priority: P1)

An agent applies a bounded edit and needs syntax, diagnostics, import cleanup,
formatting, and nearest-test guidance.

**Why this priority**: This closes the coding loop.

**Independent Test**: Apply fixture edits and verify post-edit feedback,
attention items, and validation plans.

### User Story 4 - Knowledge Report (Priority: P2)

An agent explores an unfamiliar repo and needs communities, god nodes, gaps, and
suggested questions.

**Why this priority**: Broad orientation is valuable, but should stay off the
hot path.

**Independent Test**: Generate a graph report from a fixture repo and verify
coverage, caveats, and community output.

## Edge Cases

- Unsupported languages should be listed as unsupported, not silently ignored.
- Generated/vendor roots should be scoped and caveated.
- Parser crashes should produce degraded evidence and attention, not corrupt
  graph state.
- Dynamic references should remain ambiguous unless a resolver proves them.
- Validation commands may be unavailable, blocked, or too broad for the current
  scope.

## Success Criteria

- **SC-001**: Hot-path symbol and context tools avoid hidden whole-repo scans.
- **SC-002**: MCP responses consistently include trust and freshness metadata.
- **SC-003**: Thin vertical slices cover the target initial adapters.
- **SC-004**: Edit preview/apply/rollback contracts are covered by tests.
- **SC-005**: Validation planning recommends useful commands for fixture edits.

## Related Artifacts

- Design: [../../design/mcp-surface-design.md](../../design/mcp-surface-design.md)
- Plan: [plan.md](plan.md)
- Tasks: [tasks.md](tasks.md)
