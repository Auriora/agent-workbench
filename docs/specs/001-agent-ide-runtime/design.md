---
title: Agent IDE runtime MVP design
doc_type: spec
status: archived
owner: platform
last_reviewed: 2026-06-03
---

# Technical Design

## Overview

The MVP is a thin vertical runtime slice across graph storage, one adapter path,
MCP read tools, bounded edits, validation planning, runtime operations,
observability, Codex integration readiness, and workspace safety. It proves the
durable contracts without pretending any language backend is semantic before
promotion fixtures pass.

The runtime core must stay language-, framework-, and platform-neutral. Python
is the first proof adapter, but adapter output, graph storage, context ranking,
validation planning, edit safety, and MCP presentation must be reusable for
TypeScript/JavaScript, C#, Go, Rust, C/C++, infrastructure, CI, containers,
documentation, and other platform evidence.

The MVP is usage-informed by predecessor `agent-ide` traces. First-pass
context, docs/config routing, validation planning, and edit safety must be fast
and trusted before broader diagnostics, hooks, usage analytics, or graph
orientation reports are added. Symbol/reference/impact remain MVP tools, but
context and validation responses should route agents to them through exact next
actions.

## High-Level Design

### System Architecture

The runtime is organized as inward-facing layers:

- Interface adapters bind MCP resources, tools, prompts, and stdio transport.
- Presentation assembles shared response envelopes, metadata, warnings,
  blockers, source sections, budgets, truncation, static feedback, and stable
  ordering.
- Application use cases orchestrate runtime operations through ports and return
  application result contracts.
- Domain models, policies, and services own freshness, capability, confidence,
  budget, attention, validation, workspace safety, cache validity, and snapshot
  validity decisions.
- Ports define graph, file, extraction, runtime, cache, state, telemetry,
  validation, edit-preview, and clock/hash boundaries.
- Infrastructure implements SQLite, filesystem, `tree-sitter`, cache,
  telemetry, runtime coordination, command discovery, edit-preview storage, and
  worker behavior.

MCP handlers stay thin: they parse arguments, dispatch a use case, and present
the result. They do not read source files, query SQLite directly, invoke
`tree-sitter`, execute commands, or hand-build public response envelopes.

### Components And Changes

- Architecture rails:
  layered source layout, dependency rules, feature ownership, use-case
  interfaces, ports, presenters, policies, and boundary tests.
- Runtime operations:
  cache tiers, invalidation, warm-up coordination, async work queues, parser
  workers, cancellation, owner/observer state, snapshot publication, and
  obsolete-result rejection.
- Repo runtime:
  explicit repo binding, scope, watcher state, and MCP lifecycle.
- Graph store:
  SQLite schema, FTS indexes, migrations, snapshots, freshness, and query APIs
  behind graph ports.
- Adapter registry:
  adapter discovery, adapter domains, capability levels, extraction output,
  platform evidence, and degraded modes behind extraction ports.
- Application use cases:
  status, scope, overview, context, symbol search, references, impact,
  preview/apply, integration-profile description, and verification planning.
- Presentation layer:
  response envelopes, metadata, warnings/errors, source sections, truncation,
  budgets, quiet static feedback, and stable output ordering.
- MCP surface:
  transport registration and schema binding for resources and tools.
- Codex integration profile:
  `AGENTS.md` guidance, host-level MCP configuration, stdio live-checkout
  launch, repo-local debug CLI commands, optional skill guidance, optional
  plugin packaging, and optional quiet hooks mapped from common integration
  contracts.
- Observability and profiling:
  disabled-by-default OpenTelemetry setup, configurable OTLP HTTP export for
  Jaeger or collectors, debug harnesses, profiling hooks, low-impact
  performance signals, and structured operational instrumentation events.
- Workspace safety:
  path containment, command planning gates, redaction, generated-write policy,
  preview tokens, base hashes, and stale apply rejection.

### Data Models

- SQLite rows for files, nodes, edges, unresolved references, snapshots, and
  FTS indexes.
- Domain graph models and read models separate from SQLite row models.
- Adapter evidence for language, framework, config, infrastructure,
  documentation, test, and tooling domains.
- Adapter output with capability, provenance, confidence, source ranges,
  diagnostics hints, and test hints.
- Application result schemas separate from MCP response envelopes.
- Presentation contracts for envelope assembly, metadata, errors, warnings,
  source sections, budgets, and next actions.
- Integration manifests, instruction packs, skill packs, hook intents, command
  specs, MCP binding specs, and agent capability metadata.

### Data Flow

1. Repository binding establishes a repo root, scope, generated/vendor roots,
   runtime context, and initial freshness state.
2. Warm-up opens or migrates the graph store, scans scoped files, computes file
   identities, batches extraction work, resolves references, refreshes FTS, and
   publishes a fresh snapshot.
3. Read use cases query the last valid snapshot through graph/file ports, apply
   capability and budget policies, then return application results for
   presenters.
4. Edit preview validates operations through workspace-safety and file-identity
   services, stores a preview token, and does not mutate files.
5. Edit apply reloads the preview token, validates single-use and base hashes,
   rejects drift or unsafe paths, and writes through the workspace file port.
6. Validation planning discovers candidate checks, refuses unsafe or
   low-confidence execution plans, and presents planned or blocked checks
   without running commands.
7. MCP interface adapters bind schema-owned definitions to typed argument
   parsers, use cases, presenters, and instrumentation.

## Low-Level Design

### Algorithms And Logic

- Repository orientation scans the scoped file catalog, classifies files by
  adapter capability, summarizes skipped roots, and reports freshness and
  budget metadata without reading broad source content.
- Graph extraction normalizes each file into an extraction request, routes
  Markdown/config files to resource-backed extraction, routes Python files to
  the canonical `tree-sitter` extractor, validates `ExtractionBatch` output,
  and writes graph evidence in a single transaction.
- Reference resolution matches unresolved references against graph nodes,
  records resolved, ambiguous, and unresolved evidence with confidence and
  provenance, and avoids dynamic semantic claims that are not proven.
- Task context ranking combines path, symbol, docs/config, test-planning, and
  task-term evidence, then emits complete-enough markers and exact next-action
  guidance when direct source verification or targeted graph tools are needed.
- Impact computation performs bounded traversal with max-depth and max-node
  caps, groups affected files/symbols, and reports truncation.
- Workspace edits validate path containment, generated/vendor write policy,
  secret-like content, preview-token identity, stale hashes, and atomic write
  ordering.
- Runtime refresh rejects obsolete parser/indexing work when snapshot id, file
  hash, or config identity no longer matches the published state.

### Function Signatures And Interfaces

The spec does not freeze concrete TypeScript signatures, but implementation
must preserve these boundary shapes:

- Use cases accept typed request objects and a `RuntimeContext`.
- Use cases return application result contracts, not MCP envelopes.
- Presenters accept application results and produce shared presentation
  response contracts.
- MCP registry definitions declare schemas, parsers, bindings, budget policies,
  capability classes, mutation classes, and expected return structures.
- Infrastructure adapters implement ports without being imported by domain,
  application, or presentation layers.

### Error Handling

- Invalid MCP input fails before use-case execution with a structured
  invalid-input response.
- Missing parser/grammar, parser failures, missing future optional enrichment,
  unsupported languages/platforms, missing test runners, stale watcher
  snapshots, and unsafe commands produce degraded or blocked states that name
  missing evidence.
- Timeout, crash, parser, provider, and validation failures do not return
  partial results as successful proof.
- Optional analyzer failures that do not affect the current task remain silent
  or minimal under quiet-feedback policy.
- Backend provider output is normalized before crossing the MCP schema
  translation boundary.

## Operational Considerations

- Generated runtime caches must stay outside tracked source.
- Rebuilds must use temporary databases and atomic replace.
- Missing `tree-sitter` parser/grammar, parser failure, missing optional
  enrichment, and missing validation tooling must degrade explicitly.
- Broad graph reports are post-MVP.
- Validation command execution is post-MVP unless explicitly allowlisted.
- Workspace safety must reject unsafe paths and redact secret-like values.
- Runtime status should expose freshness, indexing health, warm-up phase,
  queued work, active workers, degraded background work, and cache health.
- Compact/default read tools must not call broad orientation, full topology,
  diagnostics execution, or high-cardinality cache validation paths.
- `context_for_task` must act as a bounded router over indexed evidence, not a
  hidden work engine. It should report complete-enough state, skipped expensive
  evidence, and exact next actions for symbol/reference/impact or direct source
  reads.
- `verification_plan` must distinguish planned checks from proven runnable
  checks and must not imply test execution or nearest-test proof when discovery
  confidence is low.
- Background refresh must allow concurrent reads against the last valid
  snapshot, while graph writes remain serialized per repository.
- Boundary tests must prevent domain/application/presentation code from
  depending on concrete MCP, SQLite, tree-sitter, filesystem, or process
  implementations.
- Shared contracts must not contain Python-specific fields except in namespaced
  adapter metadata.
- Unsupported or resource-backed non-Python files must be visible in status,
  scope, and context as explicit capability coverage.
- OTEL export must be disabled by default and configurable by environment.
  Jaeger/collector destinations must be selected without changing runtime code
  or MCP schemas.
- MVP observability is trace-first but must reserve stable low-impact
  performance signals for metrics or instrumentation events. Latency, row count,
  traversal depth, source-byte caps, cache hit/miss state, degraded counts,
  invalid-input counts, and quiet-feedback suppression counts should be emitted
  without changing public MCP responses.
- Debug/profiling harnesses may run use cases against external target repos only
  from this repository. They must not be registered as public MCP tools.
- Host-level Codex configuration should launch the stdio MCP entrypoint from
  this repository checkout with absolute paths. Normal source changes are picked
  up by restarting Codex; dependency changes require `pnpm install`, not
  reinstalling a copied plugin/runtime package.
- Codex skills are implemented as workflow guidance. A skill teaches the
  preferred workflow but must not restate schemas or execute hidden behavior.
- Codex plugin packaging is implemented as a wrapper around the live-checkout
  path. The plugin bundles config, skills, hook declarations, and setup
  metadata, but local development keeps this repository checkout as the runtime
  source of truth.
- Codex hooks are implemented as optional quiet wrappers. They default to
  silence and, when explicitly enabled, emit only concise MCP follow-up guidance
  for session start or changed-file/post-edit events.

## Resolved Decisions

- `tree-sitter` is the mandatory primary extraction path. AST, LSP, Pyright,
  Ruff, pytest, and other language tools are future fixture-backed enrichers or
  validation planners only; they are not parser/semantic fallbacks and must not
  create alternate implementation paths.
- Failure handling must not use partial results as guards for timeouts, crashes,
  or provider failures. The runtime either fixes the root cause or reports
  structured degraded/blocked state with explicit missing evidence.
- MVP MCP/client surface is the status, scope, overview, context, symbol,
  reference, impact, preview/apply, and verification planning set.
- File-change static feedback is represented by `verification_plan`
  `static_feedback`; it is not a separate public MCP resource/tool in MVP.
- Python is the first partial-semantic fixture path.
- Multi-language and multi-platform support is a core runtime requirement, not
  a post-MVP redesign.
- Predecessor usage evidence prioritizes status/scope, context, docs/config
  routing, validation planning, and edit safety metadata before broad
  diagnostics execution, hooks, usage analytics, or graph reports.
- Observability is an opt-in runtime concern: OTEL is the operational telemetry
  path, durable usage records are deferred until a concrete product query
  requires them, and debug harnesses remain repo-local.
- Host-level Codex live-checkout launch is supported through the stdio MCP
  entrypoint, while vendor-specific plugin packaging remains outside MVP.
- Codex replacement readiness requires explicit feature mapping: MVP uses
  `AGENTS.md`, host-level MCP config, stdio live-checkout launch, and repo-local
  debug CLI commands; skills, plugin packaging, and hooks are wrappers around
  MCP rather than parallel runtime paths.

## Open Questions

- Which remaining T204 runtime-operation signals should be modeled as OTEL
  metrics versus span attributes or stable instrumentation events?
- What minimum repo-local debug harness coverage is required before Codex
  replacement readiness can be considered complete?
- Which post-MVP Markdown quality checks should be promoted first after MVP
  closure?

## Related Artifacts

- [Requirements](requirements.md)
- [Task ledger](tasks.md)
- [Verification plan](verification.md)
- [Research](research.md)
- [Quickstart](quickstart.md)
- [Layered runtime architecture](../../design/layered-runtime-architecture.md)
- [Runtime operations design](../../design/runtime-operations-design.md)
- [MCP surface design](../../design/mcp-surface-design.md)
- [Runtime contracts](../../reference/runtime-contracts.md)
