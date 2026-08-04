---
title: Public failure redaction vocabulary expansion tasks
doc_type: spec
artifact_type: tasks
status: active
owner: platform
last_reviewed: 2026-08-04
---

# Tasks

## Task Dependency Graph

```text
T001 -> T002 -> T003 -> T004 -> T005
```

## Implementation

- [x] T001 Create and reconcile the implementation-ready package.
  - Depends on: none
  - Requirements: Requirement 1, Requirement 2, Requirement 3, Requirement 4
  - Files: `docs/specs/055-public-failure-redaction-vocabulary-expansion/`
  - Acceptance: requirements, design, tasks, traceability, change impact, and
    verification identify the complete bounded slice and durable owners.
  - Evidence mode: validation
  - Evidence: Lifecycle preflight status ready; package lint reported zero errors and only the reviewed non-blocking canonical-context advisory after all required artifacts and durable owners were reconciled.

- [x] T002 Expand canonical redaction vocabulary and boundary tests.
  - Depends on: T001
  - Requirements: Requirement 1, Requirement 2, Requirement 3; CP-001 to CP-003
  - Files: `src/presentation/redaction.ts`,
    `tests/presentation/redaction-boundary.test.ts`
  - Acceptance: all hostile fixtures redact, safe counterexamples remain
    unchanged, sanitization is idempotent, and the byte bound remains valid.
  - Evidence mode: validation
  - Evidence: Canonical redactor and boundary tests cover tilde, srv/data, UNC, extended Windows, JSON/YAML assignments, authorization credentials, idempotence, marker fallback, safe routes/URLs/repo paths/prose, and the existing UTF-8 bound; the final focused regression passed 30 tests and the bounded full suite passed 1,246 tests.

- [x] T003 Repair diagnostics provider failure classification.
  - Depends on: T002
  - Requirements: Requirement 4; CP-004
  - Files: `src/presentation/diagnostics-presenter.ts`,
    `src/interface-adapters/mcp/registries/tools/diagnostics-for-files.ts`,
    `tests/mcp/diagnostics-for-files-tool.test.ts`
  - Acceptance: invalid input, provider unavailable, and internal failure have
    distinct, contract-consistent envelopes and sanitized messages.
  - Evidence mode: validation
  - Evidence: Missing provider now returns non-retryable provider_unavailable; unexpected throws return retryable internal_error; both use environment-invalid metadata, empty evidence/actions, diagnostics trust, and sanitized messages. Diagnostics and shared envelope tests passed within the final 30-test focused run and the bounded 1,246-test full suite.

- [x] T004 Promote durable behavior and reconcile backlog routing.
  - Depends on: T003
  - Requirements: Requirement 1, Requirement 2, Requirement 3, Requirement 4
  - Files: `docs/reference/workspace-safety-contract.md`,
    `docs/reference/runtime-contracts.md`, `docs/backlog/README.md`
  - Acceptance: durable docs describe current behavior, a new backlog owner
    records Spec 055, and the stale EB063 scheduling instruction is removed.
  - Evidence mode: validation
  - Evidence: Workspace-safety and runtime contracts now describe the expanded vocabulary and diagnostics classification; EB066 owns Spec 055 and the stale EB063 scheduling instruction is removed. Markdown set check examined all nine changed documents with no errors; warnings were non-blocking table-readability advisories.

- [x] T005 Verify, review, and reconcile closure readiness.
  - Depends on: T004
  - Requirements: Requirement 1, Requirement 2, Requirement 3, Requirement 4;
    CP-001 to CP-004
  - Files: implementation, tests, durable docs, and this package
  - Acceptance: focused and full validation pass; security and correctness
    findings are fixed or explicitly routed; lifecycle gates have no blocking
    gaps.
  - Evidence mode: validation
  - Evidence: Focused Vitest passed 3 files and 30 tests; isolated reruns passed all 93 tests implicated by default-concurrency load/order failures; bounded full Vitest with maxWorkers=4 passed 241 files and 1,246 tests; typecheck, plugin validation, package dry run, and diff hygiene passed; independent correctness and security findings were fixed and revalidated.

## Execution Rules

- Read requirements and design with this task index.
- Keep only one implementation task in progress.
- Do not add per-tool redactors, retry behavior, partial output, or alternate
  implementations.
- Record exact commands and outcomes before marking a task complete.
