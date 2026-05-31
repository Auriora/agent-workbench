---
title: Agent IDE runtime MVP design
doc_type: spec
status: draft
owner: platform
last_reviewed: 2026-05-31
---

# Design

## Overview

The MVP is a thin vertical runtime slice across graph storage, one adapter path,
MCP read tools, bounded edits, validation planning, and workspace safety. It
should prove the durable contracts without pretending any language backend is
semantic before promotion fixtures pass.

The MVP must establish the long-term layered architecture from the first
implementation tasks. It is not acceptable to combine presentation,
application, domain policy, and infrastructure behavior in temporary services.

The runtime core must stay language-, framework-, and platform-neutral. Python
is the first proof adapter, but adapter output, graph storage, context ranking,
validation planning, edit safety, and MCP presentation must be reusable for
TypeScript/JavaScript, C#, Go, Rust, C/C++, infrastructure, CI, containers,
documentation, and other platform evidence.

The MVP is usage-informed by the predecessor `agent-ide` traces. First-pass
context, docs/config routing, validation planning, and edit safety need to be
fast and trusted before the runtime adds broader diagnostics, hooks, usage
analytics, or graph orientation surfaces. Symbol/reference/impact remain MVP
tools, but context and validation responses should route agents to them through
exact next actions.

## Components And Changes

- Architecture rails:
  layered source layout, dependency rules, feature ownership, use-case
  interfaces, ports, presenters, policies, and boundary tests.
- Runtime operations:
  cache tiers, invalidation, warm-up coordination, async work queues, parser
  workers, cancellation, and snapshot publication.
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
  preview/apply, and verification planning.
- Presentation layer:
  response envelopes, metadata, warnings/errors, source sections, truncation,
  budgets, and stable output ordering.
- MCP surface:
  transport registration and schema binding for resources and tools.
- Codex integration profile:
  `AGENTS.md` guidance, host-level MCP configuration, stdio live-checkout
  launch, repo-local debug CLI commands, optional skill guidance, optional
  plugin packaging, and optional quiet hooks mapped from common integration
  contracts.
- Observability and profiling:
  disabled-by-default OpenTelemetry setup, configurable OTLP HTTP export for
  Jaeger or collectors, debug harnesses, profiling hooks, and low-overhead
  performance counters.
- Domain services and policies:
  task context packing, confidence labels, direct-read prompts, blockers,
  warnings, freshness, capability, budget, validation, skipped-work reporting,
  exact next-action routing, and safety gates.
- Edit manager:
  preview, apply, drift check, and path containment.
- Validation planner:
  diagnostics, formatting, lint, and test planning without command execution by
  default. Touched-file static feedback is an optional `verification_plan`
  section and must stay silent for clean files or non-blocking optional analyzer
  failures.
- Workspace safety:
  path containment, command planning gates, redaction, and generated-write
  policy.

## Data And Contract Impact

- SQLite schema for files, nodes, edges, unresolved refs, snapshots, and FTS.
- Adapter evidence schema for language, framework, config, infrastructure,
  documentation, test, and tooling domains.
- MCP schemas for MVP resources and tools.
- Adapter output schema with capability, provenance, confidence, source ranges,
  diagnostics hints, and test hints.
- Application result schemas separate from MCP response envelopes.
- Presentation contracts for envelope assembly, metadata, errors, warnings,
  source sections, and budget reporting.
- Shared response envelope, attention item shape, and edit token shape from
  [Runtime contracts](../../reference/runtime-contracts.md).

## Operational Considerations

- Generated runtime caches must stay outside tracked source.
- Rebuilds must use temporary databases and atomic replace.
- Missing `tree-sitter` parser/grammar, parser failure, missing optional
  enrichment, and missing validation tooling must degrade explicitly.
- Broad graph reports are post-MVP.
- Validation command execution is post-MVP unless explicitly allowlisted.
- Workspace safety must reject unsafe paths and redact secret-like values.
- Runtime status should expose freshness and indexing health.
- Runtime status should expose warm-up phase, queued work, active workers,
  degraded background work, and cache/indexing health.
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
- Profiling should rely on debug harnesses, OTEL spans, query budgets, row
  counts, traversal depth, source-byte caps, cache hit/miss counters, and
  degraded-mode counters before adding heavier product analytics.
- Host-level Codex configuration should launch the stdio MCP entrypoint from
  this repository checkout with absolute paths. Normal source changes are picked
  up by restarting Codex; dependency changes require `pnpm install`, not
  reinstalling a copied plugin/runtime package.
- `AGENTS.md` remains the MVP repository-guidance mechanism for Codex. It should
  tell agents how to work in this repo, while MCP remains the executable runtime
  surface.
- Codex skills are implemented as workflow guidance. A skill teaches the
  preferred workflow, such as status -> context -> targeted symbol/reference or
  verification planning, but it must not restate schemas or execute hidden
  behavior.
- Codex plugin packaging is implemented as a wrapper around the live-checkout
  path. The plugin bundles config, skills, hook declarations, and setup
  metadata, but local development keeps this repository checkout as the runtime
  source of truth.
- Codex hooks are implemented as optional quiet wrappers. They default to
  silence and, when basic feedback is explicitly enabled, emit only concise MCP
  follow-up guidance for session start or changed-file/post-edit events. They do
  not run analysis or produce timeout/failure partial results.

## Resolved Decisions

- `tree-sitter` is the mandatory primary extraction path. AST, LSP, Pyright,
  Ruff, pytest, and other language tools are future fixture-backed enrichers or
  validation planners only; they are not parser/semantic fallbacks and must not
  create alternate implementation paths.
- Failure handling must not use partial results as guards for timeouts, crashes,
  or provider failures. The runtime either fixes the root cause or reports
  structured degraded/blocked state with explicit missing evidence; primary and
  fallback routes require a spec-backed, fixture-tested exception.
- MVP MCP/client surface is the status, scope, overview, context, symbol,
  reference, impact, preview/apply, and verification planning set from the MVP
  spec.
- File-change static feedback is represented by `verification_plan`
  `static_feedback`; it is not a separate public MCP resource/tool in MVP.
- Python is the first partial-semantic fixture path.
- Multi-language and multi-platform support is a core runtime requirement, not
  a post-MVP redesign. The MVP proves this through language-neutral contracts
  and explicit unsupported/resource-backed coverage for non-Python files.
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
  debug CLI commands; skills, plugin packaging, and hooks are implemented
  wrappers around MCP rather than parallel runtime paths.
