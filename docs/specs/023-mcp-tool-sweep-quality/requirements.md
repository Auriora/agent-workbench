---
title: MCP tool sweep quality requirements
doc_type: spec
artifact_type: requirements
status: active
owner: platform
last_reviewed: 2026-06-06
---

# Requirements

## Introduction

Cross-repo dogfood of Agent Workbench MCP resources and tools showed that the
runtime can return structured output across varied repositories, but several
surfaces produce invalid-looking, blocked, partial, or degraded envelopes in
cases that need clearer semantics, better readiness evidence, or a permanent
validation harness. This spec turns those findings into a methodical delivery
plan without requiring target repositories to compile or run tests.

## Durable Source Baseline

- [MCP surface design](../../design/mcp-surface-design.md)
- [Observability and debugging design](../../design/observability-debugging-design.md)
- [Runtime contracts](../../reference/runtime-contracts.md)
- [Agent Workbench executable backlog](../../requirements/agent-workbench-executable-backlog.md)

## Field Evidence

On 2026-06-06, a temporary local MCP sweep called every registered Agent
Workbench resource and tool across eight target repositories. It did not run
target repository build or test commands. The sweep covered 176 surface calls:

- 154 calls returned MCP output.
- 22 calls were classified failed or invalid.
- Quality classification was 52 full, 39 partial, 60 degraded, 3 blocked, and
  22 invalid.
- `apply_workspace_edit` succeeded on all eight repositories in a targeted
  rerun when called with a real preview token and identical replacement text.
- `docs_search` frequently returned blocked invalid envelopes while docs FTS
  evidence depended on a cold or refreshing graph snapshot.
- Graph-backed tools frequently returned degraded output because fixed query
  terms did not resolve to indexed symbols.
- Some document tools returned blocked or partial output because the selected
  Markdown path was missing, had no headings, or could not supply a heading id.
- `repo:///status` returned invalid without explicit errors for two repos that
  had zero adapter coverage.

The temporary report paths were under `.tmp/agent-workbench-tool-sweep/` and
are local evidence, not durable source of truth.

## Goals

- Add a permanent repo-owned MCP tool sweep harness.
- Classify full, partial, degraded, blocked, and invalid outputs consistently.
- Separate positive and negative workspace-edit validation cases.
- Make cold or refreshing graph and docs FTS states explicit and actionable.
- Improve document-tool validation so missing files, no-heading documents, and
  valid headings are tested separately.
- Improve graph-backed smoke evidence so degraded symbol/reference/impact
  outputs are caused by real runtime limitations, not weak test inputs.
- Reduce noisy skipped-path warnings where they are expected catalog policy.

## Non-Goals

- Do not compile, build, test, or execute target repositories as part of the
  MCP tool sweep.
- Do not add parser, semantic, validation, or command-execution fallbacks to
  hide unavailable evidence.
- Do not make public MCP tools depend on debug-only harness behavior.
- Do not change contract enum meanings without updating durable contract docs.
- Do not treat empty symbol or docs results as proof of semantic correctness.

## Requirements

### Requirement 1: Permanent MCP Tool Sweep Harness

**User Story:** As an Agent Workbench maintainer, I want a repo-owned harness
that calls every MCP resource and tool against representative external repos,
so that I can see which surfaces return full, partial, degraded, blocked, or
invalid output without executing target repo commands.

#### Acceptance Criteria

1. GIVEN a list of target repository roots, WHEN the harness runs, THEN the
   system SHALL call every registered MCP resource and tool with bounded,
   read-only or safe arguments.
2. WHERE a tool is workspace-write capable, THE SYSTEM SHALL test a positive
   preview-and-apply flow using identical replacement text and a negative
   invalid-token flow without changing file content.
3. WHEN a target repository lacks a safe input for a tool, THEN the harness
   SHALL record the skipped prerequisite as degraded harness coverage instead
   of silently omitting the tool.
4. WHEN a call returns an MCP envelope, THEN the harness SHALL preserve raw
   envelope output in a local report and summarize validity, verification
   status, truncation, errors, warnings, and data shape.
5. WHEN a call times out, THEN the harness SHALL record the timeout as a tool
   finding with the surface name, repo root, elapsed time, and no target-repo
   command execution.

### Requirement 2: Readiness And Metadata Semantics

**User Story:** As a coding agent, I want invalid, blocked, degraded, partial,
and full results to mean distinct things, so that I can decide whether to wait,
read source directly, call another tool, or report a blocker.

#### Acceptance Criteria

1. GIVEN a cold or refreshing docs FTS index, WHEN `docs_search` runs, THEN the
   system SHALL return a structured blocked response that names the missing
   evidence and does not look like an unhandled tool failure.
2. GIVEN a repository with no useful adapter coverage, WHEN `repo:///status`
   runs, THEN the system SHALL report unsupported or degraded coverage with an
   explicit reason instead of `invalid` with no errors.
3. WHERE a result is intentionally blocked, THE SYSTEM SHALL include a
   next-action or explanation that distinguishes waiting for warmup, inspecting
   status, changing the query, or selecting a different input.
4. IF a result is partial because budgets or skipped paths affected evidence,
   THEN the system SHALL preserve the budget or skip reason without implying
   the tool failed.

### Requirement 3: Documentation Tool Correctness

**User Story:** As a coding agent, I want docs tools to distinguish missing
documents, documents with no headings, and documents with readable sections, so
that I can trust blocked and partial results.

#### Acceptance Criteria

1. GIVEN a missing Markdown path, WHEN `docs_outline` or
   `check_markdown_document` runs, THEN the system SHALL return a blocked
   missing-path envelope.
2. GIVEN an existing Markdown document with no headings, WHEN `docs_outline`
   runs, THEN the system SHALL return an explicit no-heading result rather than
   a missing-path result.
3. GIVEN an existing Markdown document with headings, WHEN `docs_outline` runs,
   THEN the system SHALL return stable heading ids that can be passed to
   `docs_read_section`.
4. GIVEN a valid heading id from `docs_outline`, WHEN `docs_read_section` runs,
   THEN the system SHALL return a bounded section with direct-read evidence.
5. WHERE generated, vendor, hidden, or gitignored paths are excluded, THE
   SYSTEM SHALL summarize routine skipped paths compactly and preserve examples
   only when they affect requested evidence.

### Requirement 4: Graph-Backed Tool Sweep Quality

**User Story:** As an Agent Workbench maintainer, I want graph-backed tool
sweeps to use real indexed symbols where available, so that degraded
symbol/reference/impact results expose runtime limitations instead of weak
test inputs.

#### Acceptance Criteria

1. GIVEN a warm graph snapshot with indexed symbols, WHEN the harness tests
   `symbol_search`, THEN it SHALL prefer actual indexed symbol names before
   fixed generic terms such as `main`.
2. GIVEN a symbol search result with a node id, WHEN the harness tests
   `find_references` and `impact`, THEN it SHALL use that node id for positive
   graph-backed calls.
3. IF no indexed symbol is available, THEN the harness SHALL classify
   graph-backed calls as blocked or degraded because of missing graph evidence,
   not as product failure.
4. WHEN `context_for_task` cannot rank symbols, THEN the response SHALL expose
   whether the cause is cold graph evidence, no matching terms, or an
   unsupported language/platform.

### Requirement 5: Verification Planning Clarity

**User Story:** As a coding agent, I want `verification_plan` to explain why it
is planned, blocked, partial, or full without executing commands, so that I do
not confuse command recommendations with completed validation.

#### Acceptance Criteria

1. GIVEN a repo with policy or tool evidence, WHEN `verification_plan` runs,
   THEN planned commands SHALL include concise evidence and must not execute.
2. GIVEN a repo where validation is blocked, WHEN `verification_plan` runs,
   THEN the blocked output SHALL include a reason and next action.
3. WHERE the target repo has Docker-only, host-blocked, missing-tool, or
   ambiguous package-manager evidence, THE SYSTEM SHALL preserve that policy in
   the plan rather than falling back to generic host commands.
4. IF no safe validation command can be inferred, THEN the tool SHALL report
   manual or blocked evidence instead of generic command execution.

### Requirement 6: Durable Quality Gates

**User Story:** As an Agent Workbench maintainer, I want focused tests and
durable docs for the sweep and semantics, so that future tool additions are
validated against the same expectations.

#### Acceptance Criteria

1. WHEN a new MCP resource or tool is registered, THEN the sweep harness SHALL
   include it or fail a coverage test.
2. WHEN presenter metadata semantics change, THEN contract or presenter tests
   SHALL prove the intended analysis validity and verification status.
3. WHEN the sweep runs against fixtures, THEN it SHALL produce deterministic
   findings for full, partial, degraded, blocked, invalid, timeout, positive
   apply, and negative apply cases.
4. Before closure, durable docs SHALL describe the sweep harness, quality
   labels, and target-repo no-build/no-test boundary.

## Correctness Properties

- Every registered MCP surface is either called or explicitly skipped with a
  recorded prerequisite reason.
- Workspace-write positive tests must leave target file content unchanged.
- Negative apply-token tests must not mutate files and must return structured
  blocked or invalid output.
- Cold or refreshing evidence must not be hidden behind broad direct-scan
  fallbacks.
- Missing documents, no-heading documents, and headed documents must produce
  distinguishable outputs.
- Unsupported adapter coverage must be explicit and must not appear as an
  unexplained invalid result.
- Target repository build and test commands must never be executed by the
  sweep harness.

## Success Criteria

- `pnpm debug:mcp-tool-sweep -- --repo <repo>` exists and produces a JSON
  report under `.tmp/`.
- Focused tests prove all registered resources and tools are represented in
  the sweep plan.
- Fixture tests cover positive and negative workspace-edit tool sweep cases.
- Fixture tests cover cold docs FTS, no-heading docs, headed docs, unsupported
  coverage, and graph-backed no-symbol cases.
- The cross-repo sweep can be rerun on the eight dogfood repos and produces no
  unexplained invalid results.
