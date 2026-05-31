---
title: Agent IDE runtime MVP plan
doc_type: spec
status: draft
owner: platform
last_reviewed: 2026-05-31
---

# Implementation Plan

## Summary

Build a narrow TypeScript MCP runtime slice: repo binding, minimal SQLite graph
store, Markdown/config routing, one partial-semantic language adapter, a small
MCP contract, bounded preview/apply edits, and validation planning.

The core runtime is language-, framework-, and platform-neutral. Python is the
first partial-semantic adapter because it gives a direct comparison to the
predecessor PoC, but the implementation must avoid Python-shaped graph rows,
context results, validation assumptions, and MCP contracts.

The implementation order is informed by the predecessor `agent-ide` usage and
performance review: agents most frequently used first-pass context, docs/search
style routing, diagnostics/lint/validation planning, and post-edit feedback,
while symbol/reference tools were underused unless the workflow routed agents
toward them. The MVP therefore optimizes status/scope, `context_for_task`,
docs/config routing evidence, validation planning, and edit safety metadata
first, then uses structured next actions to drive targeted symbol/reference/
impact calls.

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
- **Future Enrichment Dependencies**: AST, LSP, formatter, linter, and test
  tooling may be added only as fixture-backed enrichers or validation planners.
  They are not parser or semantic fallbacks for the canonical `tree-sitter`
  path.
- **Single-Path Failure Policy**: Capabilities use one explicit implementation
  path. Primary-plus-fallback routes, timeout-guard partial results, and
  workaround branches are not allowed unless the spec and fixture-backed tests
  explicitly require them. Failures should drive root-cause fixes or structured
  degraded/blocked state that names the missing evidence.
- **Adapter Model**: Language, framework, config, infrastructure,
  documentation, test, and tooling providers feed a common extraction and
  validation-provider contract.
- **Storage**: Local SQLite database and generated runtime cache.
- **Observability**: OpenTelemetry for traces and low-impact performance
  signals. Metrics and structured operational log events may start as OTEL span
  attributes or stable instrumentation events until a dedicated metrics/logging
  pipeline is promoted. Durable usage records are optional and only for
  queryable workflow history.
- **Testing**: Contract, fixture, schema migration, degraded-mode, workspace
  safety, and query-budget tests.
- **Target Platform**: Local developer workstations and agent workspaces.
- **Project Type**: Local-first MCP runtime.
- **Agent Integration**: MCP is the authoritative executable surface; skills,
  instructions, hooks, commands, plugins, extensions, and ACP-aware artifacts
  are generated or configured around common integration specs.
- **Codex MVP Features**: Codex uses `AGENTS.md` for repository guidance,
  host-level MCP config for executable runtime access, stdio live-checkout
  launch for update-with-restart behavior, and repo-local debug CLI commands for
  profiling and MCP-use-case testing.
- **Codex Future Wrappers**: Skills, plugin packaging, and hooks are considered
  after the MCP surface is stable. They must wrap the MCP contract rather than
  duplicate runtime logic or backend provider output.
- **Host Codex Launch**: Codex can be configured at host level to run the stdio
  MCP entrypoint from this repository checkout with absolute paths. Restarting
  Codex picks up source changes; dependency changes require `pnpm install`.
- **Documentation Quality**: Markdown structure checks, compliance linting, and
  readability formatting are architecture-defined post-MVP executable
  capabilities; contracts and fixture shape are defined now, and formatter
  mutation must use preview/apply when implemented.
- **Performance Goals**: Hot-path tools use targeted indexed queries with
  explicit row, traversal, source-byte, and timeout budgets.
- **Usage-Informed Priority**: First-pass status/scope, context, docs/config
  routing, validation planning, and edit safety paths get budget and golden
  coverage before broad orientation, diagnostics execution, hooks, or usage
  analytics.
- **Constraints**: Source files and repo config remain canonical; commands are
  plan-only by default; workspace safety is enforced; dependencies point inward
  through ports and presenters; graph writes are serialized per repo while reads
  use the last valid snapshot.
- **Scale/Scope**: One repository per runtime instance.
- **Portability Goal**: Mixed-language and mixed-platform repositories are
  first-class. Unsupported areas are reported explicitly with capability and
  degraded-mode metadata rather than ignored.

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
- [ ] Predecessor `agent-ide` usage evidence is mapped to MVP priority:
  first-pass context, docs/config routing, validation planning, and edit safety
  before broader or lower-adoption surfaces.
- [ ] Architecture boundary tests prevent forbidden dependencies.
- [ ] Runtime operation model defined for cache tiers, warm-up, queues, workers,
  cancellation, and snapshot publication.
- [ ] Runtime context, MCP registries, typed argument parsing, state store, and
  OTEL boundaries are defined.
- [ ] Shared contracts are checked for language neutrality; Python-specific
  evidence is limited to adapter metadata.
- [ ] Coding-agent integration specs and emitter boundaries are defined before
  vendor-specific plugin, hook, command, skill, or extension packaging.
- [ ] Codex feature mapping is explicit: `AGENTS.md`, host MCP config, stdio
  live-checkout launch, and repo-local debug CLI are MVP; skill, plugin, and
  hook artifacts are wrappers around MCP and remain optional until promoted.
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

```text
src/
|-- application/
|-- contracts/
|-- debug/
|-- domain/
|-- infrastructure/
|-- interface-adapters/
|-- mcp/
|-- ports/
|-- presentation/
|-- server.ts
`-- workspace/

tests/
|-- application/
|-- contracts/
|-- fixtures/
|-- golden/
|-- graph/
|-- mcp/
|-- runtime/
|-- telemetry/
`-- workspace/

docs/
```

**Structure Decision**: Keep MCP as a thin adapter over application use cases,
and keep presentation separate from transport. Context building, attention,
validation, impact, capability, freshness, budget, and safety behavior belong to
named use cases and policies rather than a generic coordination service.

The current scaffold is intentionally minimal and will be moved toward the
layered ownership model through Phase 0 and Phase 1 tasks before feature
implementation expands.

## Phases

1. Establish layered source layout, dependency rules, feature ownership, ports,
   presenters, policies, runtime operation ports, and architecture boundary
   tests.
2. Define runtime context, MCP registries, typed argument parsing, runtime
   contracts, application result contracts, presentation contracts, workspace
   safety, language-neutral adapter contracts, graph invariants, coding-agent
   integration contracts, and MVP proof fixtures.
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
   Context and verification must emit exact next actions for symbol/reference/
   impact or direct-read verification when evidence is partial or ambiguous.
8. Implement presentation layer for envelopes, metadata, errors, warnings,
   source sections, budgets, and truncation.
9. Implement MCP registration as a thin transport binding over use cases and
   presenters, including the stdio process entrypoint for host-level Codex
   launch from this repository checkout.
10. Define common coding-agent integration profiles and keep vendor-specific
   emitters outside core application/domain behavior. The Codex profile must
   document MVP feature usage and the future skill/plugin/hook wrapper path.
11. Define Markdown document quality ports, policies, checker result contracts,
   and formatter preview/apply behavior as post-MVP executable capability
   foundations.
12. Instrument runtime boundaries with OTEL traces and low-impact performance
   signals, then validate architecture boundaries, cache invalidation, warm-up,
   concurrency, query budgets, degraded modes, safety negatives, host-level MCP
   launch, and golden responses.

## Dependencies

- MCP server framework.
- SQLite library with FTS support.
- `tree-sitter` and grammar package for the selected first language.
- Future fixture-backed AST/LSP/tooling enrichers for the selected first
  language. These must not become fallbacks or parallel semantic paths.
- Fixture repositories defined in [MVP proof matrix](../../reference/mvp-proof-matrix.md).
- Node async runtime and worker-thread support for bounded background work.
- OpenTelemetry API/SDK for runtime traces, low-impact performance signals, and
  structured operational instrumentation events.
- Coding-agent integration artifact model from
  [Coding agent integration design](../../design/coding-agent-integration-design.md).
- Markdown document quality model from
  [Markdown document quality design](../../design/markdown-document-quality-design.md).

MVP implementation does not require future enrichment to be available. Missing
enrichment must be represented as absent optional evidence without invalidating
canonical `tree-sitter` extraction, and must not trigger alternate parser or
semantic fallback paths.

## Risks

- Primary parser and future enrichment reliability varies; mitigate with
  capability levels, degraded-mode tests, and a strict rule that future
  enrichers do not become parser or semantic fallbacks.
- Python-first implementation can accidentally bake Python assumptions into the
  core; mitigate with language-neutral contract tests, adapter-domain metadata,
  and unsupported/resource-backed fixture files.
- Hidden broad scans can creep into compact tools; mitigate with query budgets
  and trace assertions.
- Usage-heavy first-pass paths can become composite slow paths; mitigate by
  forbidding hidden broad orientation, full topology, diagnostics execution, and
  high-cardinality cache validation inside compact/default reads.
- Targeted symbol/reference tools can remain underused even when useful;
  mitigate by including executable next-action guidance in status/context/
  validation responses rather than adding more overlapping public tools.
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
  operational telemetry path, start low-impact performance signals as spans,
  attributes, or instrumentation events, and add durable usage records only for
  explicit queryable workflow-history features.
- Agent-specific integration formats can leak into core runtime design;
  mitigate with common integration specs, emitter boundaries, and dependency
  tests.
- Codex plugins can make local iteration slower if they copy runtime code;
  mitigate by making host-level MCP live-checkout launch the development path
  and treating plugin packaging as an optional distribution wrapper.
- Codex skills and hooks can distract agents if they duplicate schemas or emit
  noisy lifecycle state; mitigate by keeping skills workflow-only and hooks
  opt-in, quiet, and backed by existing MCP presenter semantics.
- Documentation formatting can become destructive or style-only churn; mitigate
  with parser-backed checks, explicit policies, formatter rationale, preview
  tokens, and stale-apply tests.

## Validation Strategy

Use the [MVP proof matrix](../../reference/mvp-proof-matrix.md) as the minimum
acceptance gate. Every MVP resource/tool needs golden responses, budget tests,
degraded-mode behavior, and safety negatives where applicable.
Language-neutral acceptance requires fixture evidence that non-Python files and
platform artifacts are surfaced through capability metadata even before semantic
support exists.
Usage-informed acceptance also requires golden responses for complete-enough
markers, skipped-work metadata, and exact next-action routing from first-pass
context and validation surfaces to targeted symbol/reference/impact tools.
Architecture boundary tests from
[Layered runtime architecture](../../design/layered-runtime-architecture.md)
are also part of the minimum acceptance gate.
Runtime operation tests from
[Runtime operations design](../../design/runtime-operations-design.md) are part
of the minimum acceptance gate for cache invalidation, warm-up, and concurrency.
Observability and launch checks from
[Observability and debugging design](../../design/observability-debugging-design.md)
are part of the minimum acceptance gate for OTEL configuration, debug harnesses,
profiling support, and host-level Codex stdio launch from this repository
checkout.
Integration boundary checks from
[Coding agent integration design](../../design/coding-agent-integration-design.md)
are part of the acceptance gate before vendor-specific artifacts are generated.
Codex integration acceptance must prove the MVP feature mapping and update path:
`AGENTS.md`, host-level MCP config, stdio live-checkout launch, and repo-local
debug CLI are active surfaces, while skills, plugin packaging, and hooks are
optional generated wrappers around MCP.
Markdown document quality contract checks from
[Markdown document quality design](../../design/markdown-document-quality-design.md)
are part of the acceptance gate before formatter mutation is enabled; executable
Markdown tools remain post-MVP unless explicitly promoted.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| None yet |  |  |
