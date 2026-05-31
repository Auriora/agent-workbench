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
- Domain services and policies:
  task context packing, confidence labels, direct-read prompts, blockers,
  warnings, freshness, capability, budget, validation, skipped-work reporting,
  exact next-action routing, and safety gates.
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

## Resolved Decisions

- `tree-sitter` is the mandatory primary extraction path; AST and LSP are optional
  enrichers only.
- MVP MCP/client surface is the status, scope, overview, context, symbol,
  reference, impact, preview/apply, and verification planning set from the MVP
  spec.
- Python is the first partial-semantic fixture path.
- Multi-language and multi-platform support is a core runtime requirement, not
  a post-MVP redesign. The MVP proves this through language-neutral contracts
  and explicit unsupported/resource-backed coverage for non-Python files.
- Predecessor usage evidence prioritizes status/scope, context, docs/config
  routing, validation planning, and edit safety metadata before broad
  diagnostics execution, hooks, usage analytics, or graph reports.
