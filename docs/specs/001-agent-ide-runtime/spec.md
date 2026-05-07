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
6. **Given** missing parser, LSP, or test tooling, **When** context or validation
   is requested, **Then** the response reports degraded capability and blocked
   validation instead of semantic proof.
7. **Given** unsafe paths, symlink escapes, generated/vendor targets, or
   secret-like content, **When** a tool attempts to index, report, or mutate
   them, **Then** the workspace safety contract is enforced.

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
- Parser crashes should produce degraded evidence, not corrupt graph state.
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

## Related Artifacts

- Design: [../../design/mcp-surface-design.md](../../design/mcp-surface-design.md)
- Runtime contracts: [../../reference/runtime-contracts.md](../../reference/runtime-contracts.md)
- Workspace safety: [../../reference/workspace-safety-contract.md](../../reference/workspace-safety-contract.md)
- Proof matrix: [../../reference/mvp-proof-matrix.md](../../reference/mvp-proof-matrix.md)
- Plan: [plan.md](plan.md)
- Tasks: [tasks.md](tasks.md)
