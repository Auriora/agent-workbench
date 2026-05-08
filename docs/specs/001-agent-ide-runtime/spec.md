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
to one repository, keeps a minimal SQLite graph/index, exposes scoped context
and symbol/reference tools, supports bounded preview/apply edits, and produces
validation plans without executing commands by default.

## Problem

Coding agents fall back to broad shell search, broad file reads, and ad hoc
validation when they lack fast, trustworthy repository context. The MVP should
prove that indexed local evidence can reduce those fallbacks without hiding
uncertainty, broad scans, or unsafe workspace behavior.

## Goals

- Provide a repo-scoped local runtime with explicit status, scope, and
  freshness.
- Persist minimal graph/index evidence in SQLite with FTS.
- Support Markdown/config routing and one fixture-backed partial-semantic
  language path.
- Expose a small MCP contract for status, scope, overview, task context, symbol
  search, references, bounded impact, preview/apply, and validation planning.
- Use the shared response envelope and canonical runtime enums.
- Enforce workspace safety for paths, generated writes, redaction, and command
  planning.
- Prove the MVP through fixtures, golden responses, budget tests, and degraded
  modes.

## Non-Goals

- Full graphical IDE UI.
- Cloud-hosted multi-user orchestration.
- Full semantic support for any language before promotion fixtures pass.
- C# or CloudFormation/SAM semantic support.
- Graph reports, communities, god nodes, surprising connections, or usage-gap
  analytics.
- Command execution by default.
- Safe rename, change signature, safe delete, move symbol, or broad refactors.
- Vector search.

## Requirements

### Functional Requirements

- **FR-001**: The runtime MUST bind to one repository and expose status, scope,
  freshness, and adapter coverage.
- **FR-002**: The runtime MUST persist MVP graph evidence in SQLite with FTS for
  files, nodes, edges, unresolved refs, and snapshots.
- **FR-003**: The runtime MUST implement Markdown/config routing and one
  fixture-backed partial-semantic language adapter.
- **FR-004**: The runtime MUST expose MVP resources: `repo:///status`,
  `repo:///scope`, and `repo:///overview`.
- **FR-005**: The runtime MUST expose MVP tools: `context_for_task`,
  `symbol_search`, `find_references`, bounded `impact`,
  `preview_workspace_edit`, `apply_workspace_edit`, and `verification_plan`.
- **FR-006**: All MCP responses MUST use the shared response envelope from
  [Runtime contracts](../../reference/runtime-contracts.md).
- **FR-007**: `preview_workspace_edit` MUST return a token with file identity
  and base hashes and MUST NOT mutate files.
- **FR-008**: `apply_workspace_edit` MUST reject stale previews and unsafe paths.
- **FR-009**: `verification_plan` MUST plan validation commands without
  executing them by default.
- **FR-010**: The runtime MUST enforce the
  [Workspace safety contract](../../reference/workspace-safety-contract.md).
- **FR-011**: The implementation MUST follow the
  [Layered runtime architecture](../../design/layered-runtime-architecture.md)
  with separate interface adapter, presentation, application, domain/policy,
  port, and infrastructure responsibilities.
- **FR-012**: MVP MCP resources and tools MUST be implemented as transport
  bindings over application use cases and presenters, not direct graph,
  parser, or filesystem operations.
- **FR-013**: The runtime MUST define cache, warm-up, work queue, worker pool,
  cancellation, and snapshot coordination ports according to
  [Runtime operations design](../../design/runtime-operations-design.md).
- **FR-014**: The runtime MUST allow bounded concurrent reads against the last
  valid snapshot while background warm-up or refresh work runs, and MUST
  serialize graph writes per repository.
- **FR-015**: The runtime MUST define `RuntimeContext`, MCP registry, shared
  argument parsing, state-store, and OTEL telemetry boundaries before MCP tools
  are implemented.
- **FR-016**: OpenTelemetry MUST be the default mechanism for traces, metrics,
  and logs. Durable usage records MUST NOT be added unless a fixture-backed
  workflow-history query requires persisted usage events.
- **FR-017**: The runtime MUST treat MCP as the authoritative executable
  integration surface for coding agents. Agent-specific plugins, hooks,
  commands, skills, rules, steering, guidelines, extensions, and ACP packaging
  MUST be generated or configured around MCP definitions, not implemented as
  parallel runtime behavior.
- **FR-018**: The implementation MUST define common coding-agent integration
  specs for instruction packs, skill packs, hook intents, command specs, MCP
  binding specs, integration manifests, and agent capability metadata before
  adding vendor-specific emitters.
- **FR-019**: Vendor-specific integration emitters MUST stay outside
  application/domain behavior and MUST NOT depend on concrete SQLite,
  tree-sitter, filesystem watcher, or process execution implementations.
- **FR-020**: Markdown document quality MUST distinguish parser-backed
  structure checks, repository compliance linting, and readability formatting.
  Formatting MUST be planned or previewed before mutation.
- **FR-021**: Markdown readability formatting MUST preserve rendered meaning,
  protect fenced code blocks by default, explain non-trivial rewrites, and use
  the bounded edit preview/apply safety path.

### Key Entities

- **File**: repo-relative path, content identity, language, freshness, and
  indexing status.
- **Node**: symbol, outline, or resource-backed element with source range and
  metadata.
- **Edge**: relationship between nodes with confidence and provenance.
- **Unresolved Reference**: extracted reference that could not be resolved with
  enough confidence.
- **Snapshot**: repo/config identity and freshness state.
- **Preview Token**: bounded edit proposal with file identity and base hashes.
- **Validation Plan**: planned diagnostics, formatting, lint, or test commands
  with blocked/unsafe states.
- **Presenter**: response assembler that applies envelopes, metadata,
  warnings/errors, source sections, truncation, budgets, and next actions.
- **Use Case**: application operation that orchestrates domain policies and
  ports and returns application results rather than MCP envelopes.
- **Port**: interface consumed by application/domain code and implemented by
  infrastructure adapters.
- **Warm-Up**: background process that opens/migrates the graph store, scans
  scoped files, extracts changed files, resolves references, refreshes FTS, and
  publishes a fresh snapshot.
- **Cache**: derived in-memory or persisted acceleration state scoped by
  snapshot id, file hash, query parameters, or explicit invalidation rules.
- **RuntimeContext**: per-call context containing repo/workspace identity,
  snapshot/freshness, budget/deadline, cancellation, OTEL trace context, and
  optional usage context.
- **Registry Definition**: declarative tool, resource, or prompt definition
  containing schema, argument parser, use-case binding, presenter binding,
  budget policy, and capability policy.
- **Integration Manifest**: common description of agent-facing artifacts,
  target agents, supported surfaces, provenance, runtime version, regeneration
  policy, and unsupported capabilities.
- **Instruction Pack**: generated or maintained repository guidance for
  AGENTS.md-style, Claude, Gemini, Kiro, Augment, Junie, or future instruction
  targets.
- **Skill Pack**: portable workflow package that teaches agents how to use
  runtime capabilities without duplicating runtime logic.
- **Hook Intent**: vendor-neutral lifecycle intent that can be emitted as an
  agent-specific hook only at the integration boundary.
- **Markdown Quality Finding**: structured documentation finding with source
  range, severity, check category, evidence, and suggested action.
- **Markdown Format Plan**: proposed documentation rewrite for text readability
  and renderability, including rationale, affected ranges, and preview/apply
  safety metadata.

## Acceptance Criteria

1. **Given** `fixture-basic-python`, **When** the runtime initializes, **Then**
   `repo:///status` reports repo scope, freshness, skipped roots, and
   `partial_semantic` adapter coverage.
2. **Given** a known fixture symbol, **When** `symbol_search` runs, **Then** the
   response matches the golden output and stays within the warm budget in
   [MVP proof matrix](../../reference/mvp-proof-matrix.md).
3. **Given** a known fixture reference, **When** `find_references` runs, **Then**
   resolved and ambiguous references are labeled with confidence and evidence.
4. **Given** a bounded edit, **When** `preview_workspace_edit` runs, **Then** no
   file changes and the preview token includes base hashes.
5. **Given** a stale preview, **When** `apply_workspace_edit` runs, **Then** the
   edit is rejected with a `stale_preview` blocker.
6. **Given** missing `tree-sitter` parser/grammar, parser failure, missing
   optional enrichment, or missing test tooling, **When** context or validation
   is requested, **Then** the response reports the affected capability and
   blocked validation instead of semantic proof.
7. **Given** unsafe paths, symlink escapes, generated/vendor targets, or
   secret-like content, **When** a tool attempts to index, report, or mutate
   them, **Then** the workspace safety contract is enforced.
8. **Given** the implementation source tree, **When** architecture boundary
   checks run, **Then** domain/application/presentation code do not import
   concrete MCP, SQLite, tree-sitter, filesystem watcher, or process execution
   implementations.
9. **Given** a cold repository runtime, **When** warm-up runs, **Then**
   `repo:///status` reports cold/refreshing/fresh state, queued work, and
   degraded blockers without hiding broad work inside a read tool.
10. **Given** file changes during background refresh, **When** concurrent read
   tools run, **Then** they read the last valid snapshot or report stale/
   refreshing metadata, while obsolete extraction results are rejected.
11. **Given** malformed MCP arguments, **When** a tool or resource handler is
   called, **Then** shared argument parsing returns a structured invalid-input
   response before any use case executes.
12. **Given** runtime operations execute, **When** traces and metrics are
   inspected, **Then** OTEL spans and metrics cover dispatch, use case,
   graph/query, worker, cache, and presentation boundaries.
13. **Given** coding-agent integration artifacts are generated or described,
   **When** the integration profile is inspected, **Then** MCP bindings are the
   executable source of truth and unsupported agent-specific surfaces are
   reported explicitly rather than silently replaced by alternate behavior.
14. **Given** Markdown fixtures with skipped heading levels, inconsistent
   numbering, wide tables, frontmatter violations, and broken links, **When**
   documentation quality checks run, **Then** findings include source ranges,
   severity, policy category, and suggested next actions without mutating files.
15. **Given** a Markdown table that is readable when rendered but poor as plain
   text, **When** format planning runs, **Then** the formatter returns a
   previewable rewrite strategy and rationale rather than silently changing the
   file.

## User Scenarios And Testing

### User Story 1 - Repository Status And Context (Priority: P1)

An agent starts work and needs scoped, trustworthy context before reading files
or editing.

**Independent Test**: `fixture-basic-python` and `fixture-markdown-config`
return golden `status`, `scope`, `overview`, and `context_for_task` responses.

### User Story 2 - Targeted Symbol And Reference Evidence (Priority: P1)

An agent needs symbol and reference evidence without scanning the whole repo.

**Independent Test**: known fixture symbols and references match golden graph
rows and stay within query budgets.

### User Story 3 - Bounded Edit And Validation Plan (Priority: P1)

An agent previews a bounded edit, applies it safely, and receives a validation
plan.

**Independent Test**: fixture edits prove preview token shape, stale apply
rejection, path refusal, and planned validation commands.

## Edge Cases

- Unsupported languages should be listed as unsupported, not silently ignored.
- Generated/vendor roots should be scoped and read-only by default.
- `tree-sitter` parser crashes should produce degraded evidence, not corrupt
  graph state.
- Dynamic references should remain ambiguous unless a resolver proves them.
- Validation commands may be unavailable, blocked, unsafe, or too broad.
- Secret-like values should be skipped or redacted.

## Success Criteria

- **SC-001**: Every MVP surface has a fixture-backed golden response.
- **SC-002**: Every enum in responses comes from [Runtime contracts](../../reference/runtime-contracts.md).
- **SC-003**: Every hot-path query has a row, traversal, source-byte, or time
  budget test.
- **SC-004**: Every mutating path has negative safety tests.
- **SC-005**: Degraded modes return structured metadata and next actions.
- **SC-006**: No MVP requirement depends on graph reports, usage analytics, C#,
  or CloudFormation/SAM semantic behavior.
- **SC-007**: Every MVP MCP surface has separate use-case and presenter tests.
- **SC-008**: Architecture boundary tests prove dependency direction for
  domain, application, presentation, interface adapter, and infrastructure
  layers.
- **SC-009**: Runtime operation tests prove cache invalidation, warm-up,
  obsolete work rejection, concurrent reads during refresh, and single-writer
  graph transactions.
- **SC-010**: Registry and argument-parser tests prove tool/resource definitions
  use shared parsing and do not hand-coerce raw MCP input.
- **SC-011**: OTEL instrumentation tests or contract checks prove runtime
  boundary spans/metrics exist without adding durable usage records to MVP.
- **SC-012**: Integration profile tests prove common integration specs can
  describe Codex, Claude Code, Kiro, Augment, Gemini, and Junie target surfaces
  without core runtime dependencies on vendor-specific emitters.
- **SC-013**: Markdown quality tests prove structure checks, compliance checks,
  and readability formatter previews against documentation fixtures without
  bypassing preview/apply safety.

## Related Artifacts

- Design: [../../design/mcp-surface-design.md](../../design/mcp-surface-design.md)
- Layered architecture: [../../design/layered-runtime-architecture.md](../../design/layered-runtime-architecture.md)
- Runtime contracts: [../../reference/runtime-contracts.md](../../reference/runtime-contracts.md)
- Workspace safety: [../../reference/workspace-safety-contract.md](../../reference/workspace-safety-contract.md)
- Proof matrix: [../../reference/mvp-proof-matrix.md](../../reference/mvp-proof-matrix.md)
- Plan: [plan.md](plan.md)
- Tasks: [tasks.md](tasks.md)
