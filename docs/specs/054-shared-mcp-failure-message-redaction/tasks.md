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
- [x] T002 Inventory and classify every public MCP failure-message sink.
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
  - Evidence: 2026-08-03: bounded rg inventory and direct reads classified shared wrapper, resource-provider helper, presenter, manual diagnostics, fixed-safe, independently sanitized, and non-public paths; verification.md records the implementation and representative test scope.

  - Status: Complete. T003 hostile-message tests are next.
## Phase 2: Test-First Public Redaction Contract

- [x] T003 Add failing hostile-message and structural-invariance tests.
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
  - Evidence: 2026-08-03 command `pnpm exec vitest run tests/presentation/redaction-boundary.test.ts tests/mcp/error-envelope-consistency.test.ts tests/mcp/diagnostics-for-files-tool.test.ts --maxWorkers=4` exited 1 before source implementation with 6 expected failures and 19 passes; failures named the missing sanitizer and unredacted wrapper, resource, and diagnostics seams.

  - Status: Complete; expected red state recorded before T004.
## Phase 3: Shared Implementation

- [x] T004 Implement one shared public failure-message sanitizer and migrate
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
  - Evidence: 2026-08-03: `src/presentation/redaction.ts` now exports `PUBLIC_MCP_FAILURE_MESSAGE_MAX_UTF8_BYTES = 512`, `sanitizePublicMcpFailureMessage`, and `sanitizePublicMcpRuntimeErrors`; `src/interface-adapters/mcp/envelope.ts`, `src/interface-adapters/mcp/registries/resources/provider-failure.ts`, `src/interface-adapters/mcp/registries/tools/diagnostics-for-files.ts`, and inventoried presenter builders now sanitize final public failure text while preserving raw internal classification/cause-code inputs. `pnpm typecheck` passed and the focused Spec 054 command passed 148/148 tests across 11 files.
  - Status: Complete; validation and durable promotion continue in T005.
  - [x] T004.1 Add the canonical sanitizer and boundary tests.
  - Evidence: `src/presentation/redaction.ts` exports the 512-byte sanitizer and validates caller fallback; `tests/presentation/redaction-boundary.test.ts` passes 9/9.
  - Status: Complete; T005 owns final reviews, promotion, and closure.
  - Evidence mode: implementation
  - [x] T004.2 Apply it to the shared tool failure envelope.
  - Evidence: `src/interface-adapters/mcp/envelope.ts` sanitizes the final `errors[0].message`; error-envelope consistency tests pass 10/10 while retaining classification and cause-code semantics.
  - Status: Complete; T005 owns final reviews, promotion, and closure.
  - Evidence mode: implementation
  - [x] T004.3 Apply it to shared resource-provider failure construction.
  - Evidence: `src/interface-adapters/mcp/registries/resources/provider-failure.ts` sanitizes the complete provider message; resource/error-envelope focused tests pass.
  - Status: Complete; T005 owns final reviews, promotion, and closure.
  - Evidence mode: implementation
  - [x] T004.4 Migrate inventoried presenter and manual-adapter sinks.
  - Evidence: Inventoried `src/presentation/*-presenter.ts` failure builders/result-error arrays and `diagnostics-for-files.ts` use the canonical sanitizer; the 11-file focused slice passes 148/148.
  - Status: Complete; T005 owns final reviews, promotion, and closure.
  - Evidence mode: implementation
  - [x] T004.5 Re-run the sink inventory and resolve every remaining candidate.

  - Evidence: Post-change `rg` for `error.message`, `String(error)`, raw `input.message`, `result.errors`, duplicated blocker/summary/reason fields was directly read; remaining hits are internal before sanitization, pass-throughs into sanitized builders, or non-failure typed content.
  - Status: Complete; T005 owns final reviews, promotion, and closure.
  - Evidence mode: implementation
## Phase 4: Validation, Promotion, And Closure Readiness

- [x] T005 Validate, review, and promote the accepted behavior.
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
  - Evidence: 2026-08-03: durable docs updated in docs/reference/runtime-contracts.md, docs/design/mcp-surface-design.md, docs/reference/workspace-safety-contract.md, docs/reference/mvp-proof-matrix.md, and docs/backlog/README.md; git diff --check, lint_spec_package, pnpm typecheck, the 11-file focused Spec 054 Vitest slice (148/148), full pnpm exec vitest run --maxWorkers=4 (111 files, 1,241 tests), pnpm validate:plugin, pnpm validate:skills, and pnpm pack:dry-run all passed; direct in-session security/privacy and correctness/regression review of the changed public seams found no blocker.

  - Status: Complete. Spec 054 is ready for closure cleanup.
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
