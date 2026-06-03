---
title: Agent IDE runtime MVP requirements
doc_type: spec
status: archived
owner: platform
last_reviewed: 2026-06-03
---

# Requirements

## Introduction

Build the first useful Agent IDE runtime: a local-first MCP backend that binds
to one repository, keeps a minimal SQLite graph/index, exposes scoped context
and symbol/reference tools, supports bounded preview/apply edits, and produces
validation plans without executing commands by default.

The runtime replaces broad shell search, broad file reads, and ad hoc
validation with fast local evidence that is explicit about freshness,
capability, uncertainty, skipped work, and unsafe operations.

Python is the first fixture-backed partial-semantic adapter for comparison with
the predecessor proof of concept. The core graph model, use cases,
presentation, validation planner, edit safety, runtime operations, and MCP
contracts must remain language-, framework-, and platform-neutral.

## Goals

- Provide repo-scoped status, scope, overview, task context, graph query, edit,
  and validation-planning surfaces through MCP.
- Persist minimal graph evidence in SQLite with FTS while keeping SQLite behind
  infrastructure ports.
- Support Markdown/config routing and one canonical `tree-sitter` Python
  extraction path.
- Preserve useful predecessor workflows: first-pass context, docs/config
  routing, validation planning, test planning, and post-edit static feedback.
- Enforce workspace safety for paths, generated/vendor writes, secret-like
  content, command planning, and stale edits.
- Keep agent-facing MCP schemas quiet, stable, and owned by presenters rather
  than backend provider payloads.
- Support disabled-by-default OpenTelemetry tracing, low-impact performance
  signals, repo-local debug harnesses, and host-level Codex live-checkout
  launch.

## Non-Goals

- Full graphical IDE UI.
- Cloud-hosted multi-user orchestration.
- Full semantic support for any language before promotion fixtures pass.
- C# or CloudFormation/SAM semantic support in the MVP.
- Graph reports, communities, broad orientation reports, vector search, durable
  usage analytics, or standalone diagnostics execution in the MVP.
- Safe rename, change signature, safe delete, move symbol, or broad refactors.
- Required Codex plugin installation for local development.
- Command execution by default.

## Glossary

- **Adapter Evidence**: Language, framework, config, infrastructure,
  documentation, test, or tooling evidence emitted through common adapter
  contracts with capability, provenance, confidence, and namespaced metadata.
- **Preview Token**: Bounded edit proposal with file identity and base hashes.
- **RuntimeContext**: Per-call context containing repository identity,
  snapshot/freshness, budget/deadline, cancellation, OTEL trace context, and
  optional usage context.
- **Snapshot**: Repository/config identity and freshness state for indexed
  evidence.
- **Static Feedback**: Optional `verification_plan` section for actionable
  touched-file findings that stays silent for clean files and non-blocking
  optional analyzer failures.
- **Schema Translation Boundary**: MCP contract boundary that maps backend
  provider output into public schemas and prevents raw backend payloads from
  leaking to agents.

## Requirements

### Requirement 1: Repository Orientation

**User Story:** As a coding agent, I want trustworthy repository status, scope,
and overview before reading files, so that I can choose a narrow implementation
path.

#### Acceptance Criteria

1. GIVEN a bound repository, WHEN `repo:///status` is requested, THEN it reports
   scope, freshness, adapter coverage, skipped roots, budgets, and degraded
   runtime state.
2. GIVEN a mixed-language or mixed-platform repository, WHEN status, scope, or
   overview is requested, THEN unsupported and resource-backed areas are
   reported explicitly instead of ignored or coerced into Python semantics.
3. WHERE compact/default orientation responses are produced, THE SYSTEM SHALL
   stay within row, traversal, source-byte, and time budgets and SHALL NOT hide
   broad source reads or full topology work.

### Requirement 2: Language-Neutral Graph Evidence

**User Story:** As a runtime maintainer, I want graph evidence stored and
queried through language-neutral contracts, so that new adapters can be added
without changing shared MCP schemas.

#### Acceptance Criteria

1. GIVEN repository files, WHEN graph indexing runs, THEN files, nodes, edges,
   unresolved references, snapshots, and FTS rows are persisted through graph
   ports rather than application code depending on SQLite rows.
2. GIVEN Python files, WHEN extraction runs, THEN canonical `tree-sitter`
   extraction emits partial-semantic symbols, imports, calls, ranges,
   signatures, docstrings, hints, and unresolved references.
3. GIVEN Markdown/config or unsupported files, WHEN extraction runs, THEN they
   are represented as `resource_backed` or `unsupported` capability evidence
   without Python-specific shared fields.
4. IF the parser, grammar, provider, or future optional enrichment is missing
   or fails, THEN THE SYSTEM SHALL return structured degraded or blocked state
   and SHALL NOT use parser or semantic fallbacks.

### Requirement 3: Task Context And Query Tools

**User Story:** As a coding agent, I want bounded task context and targeted
symbol/reference/impact tools, so that I can avoid scanning the whole repo.

#### Acceptance Criteria

1. GIVEN a task prompt, WHEN `context_for_task` runs, THEN it returns ranked
   files, ranked symbols, docs/config routing evidence, direct-read caveats,
   complete-enough markers, skipped-work metadata, and exact next actions.
2. GIVEN known fixture symbols or references, WHEN `symbol_search`,
   `find_references`, or `impact` runs, THEN responses are stable, bounded,
   confidence-labeled, provenance-labeled, and grouped by affected evidence.
3. WHERE evidence is partial, ambiguous, signatures-only, routing-only, or low
   confidence, THE SYSTEM SHALL route the agent to direct reads,
   `symbol_search`, `find_references`, `impact`, or validation follow-up.

### Requirement 4: Edit Safety

**User Story:** As a coding agent, I want previewed edits and safe apply
behavior, so that workspace mutations are bounded and reject drift.

#### Acceptance Criteria

1. GIVEN a bounded edit, WHEN `preview_workspace_edit` runs, THEN no files are
   mutated and the response includes a preview token with file identity and base
   hashes.
2. GIVEN a valid preview token, WHEN `apply_workspace_edit` runs, THEN the edit
   applies atomically only if path containment, generated/vendor policy,
   secret-like content policy, single-use token policy, and base-hash checks
   pass.
3. IF a preview is stale or unsafe, THEN THE SYSTEM SHALL reject apply with a
   structured blocker.

### Requirement 5: Validation Planning And Quiet Feedback

**User Story:** As a coding agent, I want validation plans without implicit
command execution, so that I can decide how to verify changes safely.

#### Acceptance Criteria

1. GIVEN changed files or a task target, WHEN `verification_plan` runs, THEN it
   plans diagnostics, formatting, lint, and test commands without executing
   them by default.
2. WHERE validation discovery is missing, unsafe, too broad, or low confidence,
   THE SYSTEM SHALL distinguish planned checks from proven runnable checks and
   include exact next actions.
3. GIVEN touched files with no actionable findings or non-blocking optional
   analyzer failures, WHEN static feedback is presented, THEN it is silent or
   minimal and does not expose backend tool names or raw diagnostic output.

### Requirement 6: MCP Schema Ownership

**User Story:** As an MCP client, I want public resources and tools described
by stable schemas, so that backend implementation details do not leak into
agent workflows.

#### Acceptance Criteria

1. GIVEN any public MCP surface, WHEN it is registered, THEN its name,
   description, parameter descriptions, expected return structure, capability
   class, mutation class, and budget policy are schema-owned.
2. GIVEN raw parser, diagnostic, validation, test-discovery, worker, or backend
   provider output, WHEN an MCP response is produced, THEN only fields modeled
   by public schemas cross the presentation boundary.
3. GIVEN malformed MCP arguments, WHEN a handler is called, THEN shared typed
   argument parsing returns structured invalid-input responses before use cases
   execute.

### Requirement 7: Runtime Operations And Observability

**User Story:** As a runtime maintainer, I want explicit warm-up, cache,
concurrency, degraded-mode, and telemetry behavior, so that runtime health is
debuggable without broad hidden work.

#### Acceptance Criteria

1. GIVEN a cold or changing repository, WHEN warm-up or refresh runs, THEN the
   runtime reports cold, refreshing, fresh, stale, partial, invalid, and
   invalid-due-to-environment states through snapshot/runtime ports.
2. WHILE refresh work is running, THE SYSTEM SHALL allow bounded reads against
   the last valid snapshot or report stale/refreshing metadata, and SHALL
   serialize graph writes per repository.
3. IF parser/indexing work becomes obsolete by snapshot id, file hash, or
   config identity, THEN THE SYSTEM SHALL reject obsolete results.
4. WHERE telemetry is enabled, THE SYSTEM SHALL emit OTEL spans, low-impact
   performance signals, and structured operational instrumentation without
   adding durable usage records to MVP.

### Requirement 8: Codex Replacement Readiness

**User Story:** As a Codex user, I want host-level MCP launch from this checkout
and workflow guidance, so that source changes are picked up by restarting Codex
without reinstalling copied runtime code.

#### Acceptance Criteria

1. GIVEN host-level Codex configuration, WHEN the stdio MCP entrypoint is
   launched with absolute paths to this checkout, THEN it exposes the MVP
   resources/tools and supports explicit `repo_root` arguments.
2. GIVEN runtime source changes, WHEN Codex is restarted, THEN the launched MCP
   process uses updated repository code; dependency changes may require
   `pnpm install` but not plugin reinstall.
3. WHERE Codex skills, plugin packaging, or hooks exist, THE SYSTEM SHALL treat
   them as MCP wrappers or workflow guidance and SHALL NOT duplicate runtime
   logic, backend output, or static-feedback behavior.

### Requirement 9: Documentation Quality Boundaries

**User Story:** As a documentation maintainer, I want Markdown quality behavior
defined before executable mutation support, so that future formatting and
linting cannot bypass workspace safety.

#### Acceptance Criteria

1. GIVEN Markdown quality contracts, WHEN architecture checks run, THEN
   findings, compliance checks, and formatter plans are modeled as read-only or
   preview/apply-safe contracts.
2. WHERE Markdown readability formatting is proposed, THE SYSTEM SHALL preserve
   rendered meaning, protect fenced code by default, require non-trivial rewrite
   rationale, and use bounded edit preview/apply safety.

## Correctness Properties

- Shared graph, context, validation, edit, and MCP contracts remain
  language-neutral; adapter-specific data is namespaced metadata.
- Every mutating path enforces path containment, base-hash drift checks, and
  generated/vendor and secret-like content policies.
- Compact/default read tools do not execute validation commands, diagnostics,
  hooks, broad orientation, full topology traversal, or hidden high-cardinality
  cache validation.
- Backend provider payloads are translated before MCP presentation.
- Failure states name missing evidence instead of returning partial results as
  successful proof.

## Technical Context

- **Language/Version:** TypeScript on Node.js with ESM.
- **Primary Dependencies:** MCP server framework, SQLite with FTS,
  `tree-sitter`, and `tree-sitter-python`.
- **Storage:** Local SQLite database and generated runtime cache.
- **Observability:** OpenTelemetry traces and low-impact performance signals,
  disabled by default.
- **Testing:** Vitest contract, fixture, golden response, degraded-mode,
  workspace-safety, query-budget, MCP, runtime, telemetry, and architecture
  boundary tests.
- **Target Platform:** Local developer workstations and agent workspaces.

## Success Criteria

- Every MVP surface has fixture-backed golden response coverage.
- Every hot path has row, traversal, source-byte, or time budget tests.
- Every mutating path has negative workspace-safety tests.
- Every public MCP surface has registry metadata and typed argument-parser
  tests.
- Degraded modes return structured metadata and next actions.
- Runtime operation tests prove cache invalidation, warm-up, obsolete work
  rejection, concurrent reads during refresh, and single-writer graph
  transactions.
- OTEL configuration is disabled by default and supports console or OTLP HTTP
  export without changing MCP responses.
- Codex readiness checks prove `AGENTS.md`, host-level MCP config, stdio
  live-checkout launch, repo-local debug CLI, skills, plugin packaging, and
  quiet hooks remain MCP-owned and do not create a copied runtime path.

## Related Artifacts

- [Technical design](design.md)
- [Task ledger](tasks.md)
- [Verification plan](verification.md)
- [Research](research.md)
- [Quickstart](quickstart.md)
- [Runtime contracts](../../reference/runtime-contracts.md)
- [Workspace safety contract](../../reference/workspace-safety-contract.md)
- [MVP proof matrix](../../reference/mvp-proof-matrix.md)
