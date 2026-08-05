---
title: Bounded docs map payload delivery tasks
doc_type: spec
artifact_type: tasks
status: active
owner: platform
last_reviewed: 2026-08-05
---

# Tasks

## Task Dependency Graph

```text
T001 -> T002 -> T003 -> T004
```

## Phase 1: Contract and implementation

- [x] T001 Implement the compact, byte-bounded docs-map contract and callable
  cursor continuation.
  - Depends on: none
  - Requirements: Requirement 1, Requirement 2, Requirement 3
  - Properties: CP-001, CP-002, CP-003
  - Files: `src/contracts/runtime-docs-contracts.ts`,
    `src/application/use-cases/query-docs.ts`, `src/presentation/docs-presenter.ts`,
    `src/interface-adapters/mcp/registries/`
  - Acceptance: Resource and tool emit typed JSON no larger than 32 KiB,
    preserve exact paths/counts, and expose deterministic continuation without
    changing the discovery universe.
  - Evidence mode: implementation
  - Evidence: `src/presentation/docs-presenter.ts`, `src/application/use-cases/query-docs.ts`, and the MCP registries emit six current-repo pages for 66 unique paths; largest pretty page is 32,576 UTF-8 bytes.

## Phase 2: Regression proof

- [x] T002 Add fixture-backed contract, pagination, UTF-8, warning, registry,
  and transport regression tests.
  - Depends on: T001
  - Requirements: Requirement 1, Requirement 2, Requirement 3, Requirement 4
  - Properties: CP-001, CP-002, CP-003
  - Files: `tests/docs/`, `tests/mcp/`, `scripts/ci/`
  - Acceptance: Tests fail for the legacy oversized projection and pass for
    bounded resource/tool continuation.
  - Evidence mode: validation
  - Evidence: `tests/docs/docs-presenter.test.ts`, `tests/docs/query-docs.test.ts`, `tests/mcp/docs-surfaces.test.ts`, and registry/debug tests pass; latest focused map run is 4 files and 53 tests.

## Phase 3: Promotion and verification

- [x] T003 Promote the accepted surface and contract behavior to durable docs.
  - Depends on: T002
  - Requirements: Requirement 3, Requirement 4
  - Files: `docs/design/mcp-surface-design.md`,
    `docs/reference/runtime-contracts.md`,
    `docs/reference/agent-readable-changelog.md`
  - Acceptance: Durable docs describe current compact projection, byte bound,
    cursor/tool continuation, failure behavior, and detail-read route.
  - Evidence mode: validation
  - Evidence: `docs/design/mcp-surface-design.md`, `docs/reference/runtime-contracts.md`, and `docs/reference/agent-readable-changelog.md` contain the promoted contract; the earlier eight-document Markdown set check had only advisory table-readability findings before this cleanup pass.

- [x] T004 Run focused/full/package/transport validation, review the final
  implementation, and reconcile the other findings.
  - Depends on: T003
  - Requirements: Requirement 4
  - Files: `verification.md`, all changed files
  - Acceptance: Required commands pass; review findings are addressed or
    routed; unrelated advisories are explicitly classified without being
    misreported as this defect.
  - Evidence mode: validation
  - Evidence: Validation completed: typecheck; focused suites; 120 files and 1328 tests with one worker; plugin validation; dry-run package; installed-package MCP smoke; senior review findings addressed. Markdown check completed with warning-only table readability advisories.

## Execution Rules

- Read `requirements.md`, `design.md`, and `traceability.md` before changing a
  task state.
- Do not mark a task complete until its acceptance and named evidence hold.
- Do not create a scan/extraction limit as a substitute for response
  compaction; cursor continuation is mandatory.
- Preserve unrelated work and keep MCP adapters thin.
