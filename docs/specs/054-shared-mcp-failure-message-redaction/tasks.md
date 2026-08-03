---
title: Shared MCP failure-message redaction tasks
doc_type: spec
artifact_type: tasks
status: draft
owner: platform
last_reviewed: 2026-08-03
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Tasks

**Input:** `requirements.md`, `design.md`, EB063, and current durable contract,
MCP surface, and workspace-safety documentation.

**Prerequisites:** Do not implement from this file alone. Reconcile the full
package with current source and preserve unrelated worktree changes.

## Task Dependency Graph

```text
T001 -> T002 -> T003 -> T004 -> T005
```

## Phase 1: Readiness And Failure-Sink Baseline

- [x] T001 Reconcile and review Spec 054 for implementation readiness.
  - Depends on: none
  - Requirements: Requirement 1 through Requirement 5
  - Files: this package, EB063, durable sources, current source and tests
  - Acceptance: lifecycle lint, requirement/design/task trace review, contract
    compatibility review, and security review have no unresolved blocker; any
    finding is incorporated before source changes.
  - Validation: `lint_spec_package`, `stage_readiness`, `task_state_audit`, and
    a bounded requirements/design review packet.
  - Evidence mode: validation
  - Evidence: 2026-08-03: lint_spec_package 0 findings; stage_readiness ready_to_implement=true with 0 blocking, context, downstream, acceptance, or traceability gaps; task_state_audit 0 errors/warnings and 2 informational findings; independent contract and security re-reviews found no blocker; focused Vitest baseline 14/14 passed; Markdown check examined 5 documents with 94 table-readability warnings only; git diff --check passed.

  - Status: Complete. Spec 054 is ready for T002 public failure-sink inventory.
- [ ] T002 Inventory and classify every public MCP failure-message sink.
  - Depends on: T001
  - Requirements: Requirement 1, Requirement 3, Requirement 5
  - Properties: CP-001, CP-004
  - Files: `src/interface-adapters/mcp/envelope.ts`, MCP registries/resources,
    public presenters, diagnostics adapter, representative tests
  - Acceptance: every exception-derived `errors`, warning, reason, and blocker
    sink is classified as unsafe, fixed-safe, or independently sanitized;
    debug-only paths are separated with evidence; implementation scope and
    representative tests are updated from the inventory, starting from the
    known resource/manual-adapter suites recorded in `verification.md`.
  - Validation: bounded `rg` inventory plus direct reads of every candidate.
  - Evidence mode: validation
  - Evidence: Pending.

## Phase 2: Test-First Public Redaction Contract

- [ ] T003 Add failing hostile-message and structural-invariance tests.
  - Depends on: T002
  - Requirements: Requirement 1, Requirement 2, Requirement 4, Requirement 5
  - Properties: CP-001 through CP-005
  - Files: `tests/presentation/redaction-boundary.test.ts`,
    `tests/mcp/error-envelope-consistency.test.ts`, representative docs, graph,
    diagnostics, resource, and workspace-edit test files
  - Acceptance: tests cover Unix/Windows paths, workspace escape, secret and
    private-key material, safe phrase retention, marker-only recovery fallback,
    idempotence, 512-byte multi-byte output, shared
    tool/resource/manual-adapter paths, and exact preservation of code,
    retryability, cause-code-dependent data, metadata, trust, and next actions.
  - Validation: run the selected focused Vitest files with `--maxWorkers=4` and
    record the expected pre-implementation failures.
  - Evidence mode: validation
  - Evidence: Pending.

## Phase 3: Shared Implementation

- [ ] T004 Implement one shared public failure-message sanitizer and migrate
  every unsafe public sink.
  - Depends on: T003
  - Requirements: Requirement 1 through Requirement 5
  - Properties: CP-001 through CP-005
  - Files: `src/presentation/redaction.ts`,
    `src/interface-adapters/mcp/envelope.ts`, resource provider-failure helper,
    inventoried public presenters/manual adapters, focused tests
  - Acceptance: redaction precedes a fixed 512-byte UTF-8 bound; raw evidence
    remains internal for classification/cause-code selection; all unsafe sinks
    use the same helper; no public schema/version, retryability, trust, feature
    flag, fallback, or typed safe-data behavior changes; T003 tests pass.
  - Validation: `pnpm typecheck` and the complete focused Spec 054 Vitest slice
    with `--maxWorkers=4`.
  - Evidence mode: implementation
  - Evidence: Pending.
  - [ ] T004.1 Add the canonical sanitizer and boundary tests.
  - [ ] T004.2 Apply it to the shared tool failure envelope.
  - [ ] T004.3 Apply it to shared resource-provider failure construction.
  - [ ] T004.4 Migrate inventoried presenter and manual-adapter sinks.
  - [ ] T004.5 Re-run the sink inventory and resolve every remaining candidate.

## Phase 4: Validation, Promotion, And Closure Readiness

- [ ] T005 Validate, review, and promote the accepted behavior.
  - Depends on: T004
  - Requirements: Requirement 1 through Requirement 5
  - Properties: CP-001 through CP-005
  - Files: implementation/tests; `docs/reference/runtime-contracts.md`,
    `docs/design/mcp-surface-design.md`,
    `docs/reference/workspace-safety-contract.md`,
    `docs/reference/mvp-proof-matrix.md`, `docs/backlog/README.md`, this package
  - Acceptance: focused tests, typecheck, full Vitest with four workers,
    `pnpm validate:plugin`, `pnpm validate:skills`, `pnpm pack:dry-run`, and
    `git diff --check` pass or retain truthful blocked evidence; security and
    implementation reviews are resolved; durable docs describe current
    behavior; EB063 is marked delivered; no must-have requirement or review
    finding remains partial-blocking or unowned before closure.
  - Evidence mode: validation
  - Evidence: Pending.

## Traceability

Use `traceability.md` as the bidirectional task, requirement, design,
verification, and durable-target index. Reconcile it whenever task scope or
implementation evidence changes.

## Execution Rules

- Mark exactly one implementation task `[~]` before source changes.
- Keep MCP adapters thin and use the existing presentation redaction path.
- Never parse redacted public text to classify an error or select typed data.
- Do not add a second redactor, fallback, retry, feature flag, alternate response
  shape, or public contract field.
- Inspect serialized responses for leakage; intermediate object safety is not
  sufficient evidence.
- Record exact commands and outcomes before marking tasks complete.
- Before closure, reconcile every requirement/property and promote all lasting
  behavior to the named durable owners.

## Related Artifacts

- Requirements: `requirements.md`
- Design: `design.md`
- Traceability: `traceability.md`
- Verification: `verification.md`
