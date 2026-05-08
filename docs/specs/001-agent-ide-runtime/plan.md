---
title: Agent IDE runtime MVP plan
doc_type: spec
status: draft
owner: platform
last_reviewed: 2026-05-07
---

# Implementation Plan

## Summary

Build a narrow TypeScript MCP runtime slice: repo binding, minimal SQLite graph
store, Markdown/config routing, one partial-semantic language adapter, a small
MCP contract, bounded preview/apply edits, and validation planning.

The first implementation establishes the long-term layered architecture:
interface adapters, presentation, application use cases, domain policies, ports,
runtime operations, registries, typed argument parsing, observability,
coding-agent integration boundaries, Markdown document quality boundaries, and
infrastructure adapters. MVP scope stays narrow, but temporary blended services
are not allowed.

## Technical Context

- **Language/Version**: TypeScript on Node.js.
- **Primary Dependencies**: MCP server framework, SQLite with FTS,
  `tree-sitter`, and the selected first-language grammar.
- **Optional Enrichment Dependencies**: AST, LSP, formatter, linter, and test
  tooling for the selected first language.
- **Storage**: Local SQLite database and generated runtime cache.
- **Observability**: OpenTelemetry for traces, metrics, and logs. Durable usage
  records are optional and only for queryable workflow history.
- **Testing**: Contract, fixture, schema migration, degraded-mode, workspace
  safety, and query-budget tests.
- **Target Platform**: Local developer workstations and agent workspaces.
- **Project Type**: Local-first MCP runtime.
- **Agent Integration**: MCP is the authoritative executable surface; skills,
  instructions, hooks, commands, plugins, extensions, and ACP-aware artifacts
  are generated or configured around common integration specs.
- **Documentation Quality**: Markdown structure checks, compliance linting, and
  readability formatting are separate parser-backed capabilities; formatter
  mutation uses preview/apply.
- **Performance Goals**: Hot-path tools use targeted indexed queries with
  explicit row, traversal, source-byte, and timeout budgets.
- **Constraints**: Source files and repo config remain canonical; commands are
  plan-only by default; workspace safety is enforced; dependencies point inward
  through ports and presenters; graph writes are serialized per repo while reads
  use the last valid snapshot.
- **Scale/Scope**: One repository per runtime instance.

## Governance Check

Complete before implementation and re-check after design changes. The task list
tracks this as T000.

- [ ] Layered boundaries defined for interface adapters, presentation,
  application use cases, domain policies, ports, and infrastructure adapters.
- [ ] DRY plan defined through [Runtime contracts](../../reference/runtime-contracts.md).
- [ ] Test strategy maps fixtures to graph rows, MCP responses, edits, safety,
  degraded modes, and budgets.
- [ ] Agent workflow consistency assessed against the MVP proof matrix.
- [ ] Performance budgets defined for every MVP hot-path surface.
- [ ] Architecture boundary tests prevent forbidden dependencies.
- [ ] Runtime operation model defined for cache tiers, warm-up, queues, workers,
  cancellation, and snapshot publication.
- [ ] Runtime context, MCP registries, typed argument parsing, state store, and
  OTEL boundaries are defined.
- [ ] Coding-agent integration specs and emitter boundaries are defined before
  vendor-specific plugin, hook, command, skill, or extension packaging.
- [ ] Markdown document quality ports and policies are defined before adding
  structure checks, compliance linting, or formatter mutation.

## Project Structure

### Documentation

```text
docs/specs/001-agent-ide-runtime/
|-- spec.md
|-- plan.md
|-- research.md
|-- design.md
|-- quickstart.md
`-- tasks.md
```

### Source Code

Replace with concrete implementation paths when source exists.

```text
src/
tests/
docs/
```

**Structure Decision**: Keep MCP as a thin adapter over application use cases,
and keep presentation separate from transport. Context building, attention,
validation, impact, capability, freshness, budget, and safety behavior belong to
named use cases and policies rather than a generic coordination service.

## Phases

1. Establish layered source layout, dependency rules, feature ownership, ports,
   presenters, policies, runtime operation ports, and architecture boundary
   tests.
2. Define runtime context, MCP registries, typed argument parsing, runtime
   contracts, application result contracts, presentation contracts, workspace
   safety, graph invariants, coding-agent integration contracts, and MVP proof
   fixtures.
3. Implement SQLite graph persistence behind graph ports.
4. Implement file scan, identity, language detection, warm-up, watcher
   ingestion, cache invalidation, worker scheduling, and snapshot freshness
   behind infrastructure ports.
5. Implement Markdown/config routing and one `tree-sitter`-backed extractor
   behind extraction ports.
6. Implement extraction ingestion, reference resolution, graph normalization,
   and capability/confidence policies.
7. Implement application use cases for status, scope, overview, context,
   symbols, references, impact, preview/apply, and verification planning.
8. Implement presentation layer for envelopes, metadata, errors, warnings,
   source sections, budgets, and truncation.
9. Implement MCP registration as a thin transport binding over use cases and
   presenters.
10. Define common coding-agent integration profiles and keep vendor-specific
   emitters outside core application/domain behavior.
11. Define Markdown document quality ports, policies, checker result contracts,
   and formatter preview/apply behavior.
12. Instrument runtime boundaries with OTEL and validate architecture
   boundaries, cache invalidation, warm-up, concurrency, query budgets,
   degraded modes, safety negatives, and golden responses.

## Dependencies

- MCP server framework.
- SQLite library with FTS support.
- `tree-sitter` and grammar package for the selected first language.
- Optional AST/LSP/tooling enrichers for the selected first language.
- Fixture repositories defined in [MVP proof matrix](../../reference/mvp-proof-matrix.md).
- Node async runtime and worker-thread support for bounded background work.
- OpenTelemetry API/SDK for runtime traces, metrics, and structured logs.
- Coding-agent integration artifact model from
  [Coding agent integration design](../../design/coding-agent-integration-design.md).
- Markdown document quality model from
  [Markdown document quality design](../../design/markdown-document-quality-design.md).

MVP implementation does not require optional enrichment to be available. Missing
enrichment must be represented as degraded or absent enrichment evidence without
invalidating canonical `tree-sitter` extraction.

## Risks

- Primary parser and optional enrichment reliability varies; mitigate with
  capability levels and degraded-mode tests.
- Hidden broad scans can creep into compact tools; mitigate with query budgets
  and trace assertions.
- Cache invalidation or async refresh can serve stale evidence as proof;
  mitigate with snapshot-scoped cache keys, stale metadata, and obsolete-result
  rejection tests.
- Concurrent background work can corrupt graph state; mitigate with a single
  graph writer transaction path and read access to the last valid snapshot.
- Edit contracts can become unsafe; mitigate with preview tokens, path
  containment, base hashes, and stale-apply tests.
- Command execution can become unsafe; keep MVP validation plan-only.
- Contract drift can break clients; mitigate with one response envelope and
  canonical enum registry.
- Observability and usage history can overlap; keep OTEL as the default
  operational telemetry path and add durable usage records only for explicit
  queryable workflow-history features.
- Agent-specific integration formats can leak into core runtime design;
  mitigate with common integration specs, emitter boundaries, and dependency
  tests.
- Documentation formatting can become destructive or style-only churn; mitigate
  with parser-backed checks, explicit policies, formatter rationale, preview
  tokens, and stale-apply tests.

## Validation Strategy

Use the [MVP proof matrix](../../reference/mvp-proof-matrix.md) as the minimum
acceptance gate. Every MVP resource/tool needs golden responses, budget tests,
degraded-mode behavior, and safety negatives where applicable.
Architecture boundary tests from
[Layered runtime architecture](../../design/layered-runtime-architecture.md)
are also part of the minimum acceptance gate.
Runtime operation tests from
[Runtime operations design](../../design/runtime-operations-design.md) are part
of the minimum acceptance gate for cache invalidation, warm-up, and concurrency.
Integration boundary checks from
[Coding agent integration design](../../design/coding-agent-integration-design.md)
are part of the acceptance gate before vendor-specific artifacts are generated.
Markdown document quality checks from
[Markdown document quality design](../../design/markdown-document-quality-design.md)
are part of the acceptance gate before formatter mutation is enabled.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| None yet |  |  |
