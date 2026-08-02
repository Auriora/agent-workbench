---
title: Validation-plan skipped-path payload compaction tasks
doc_type: spec
artifact_type: tasks
status: draft
owner: platform
last_reviewed: 2026-08-02
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Tasks

**Input:** All artifacts in this Spec 053 package.

**Prerequisites:** Read requirements, design, change impact, canonical context,
traceability, and verification together. Do not implement from this file alone.

## Task Dependency Graph

```text
T001 -> T002 -> T003 -> T004
T004 -> T005 -> T006 -> T007
T007 -> T008 -> T009
```

## Phase 1: Readiness And Contract Baseline

- [x] T001 Reconcile and review the package for implementation readiness.
  - Depends on: none
  - Requirements: Requirement 1 through Requirement 6
  - Files: this Spec 053 package, EB004, EB065, current scanner/planner/contracts/tests
  - Acceptance: lifecycle lint, requirement/design trace review, task-state
    audit, public-contract review, and scanner accounting review have no
    unresolved blocker; findings are incorporated before source changes.
  - Evidence mode: validation
  - Evidence: `lint_spec_package` returned 0 errors/warnings and
    `task_state_audit` returned 0 errors/warnings on 2026-08-02; two independent
    readiness reviews produced concrete edits incorporated before T002.

  - Status: Ready to proceed to dependency-safe T002; no implementation claim.
- [x] T002 Confirm the additive public receipt and internal population seam.
  - Depends on: T001
  - Requirements: Requirement 1, Requirement 2, Requirement 3, Requirement 5
  - Properties: CP-001, CP-002, CP-006
  - Files: `src/contracts/runtime-core-contracts.ts`,
    `src/contracts/runtime-validation-edit-contracts.ts`, `src/ports/index.ts`,
    every production producer and test double of `FileCatalogScanResult`,
    `design.md`, contract tests
  - Acceptance: sample limit 3, exact count basis, reason-group shape,
    `source_truncated`, actionable evidence, required internal scanner receipt,
    legacy validation input compatibility, and no raw current-plan emission are
    fixed and reviewed; an `rg` inventory identifies every required scanner
    result producer/double that T004 must migrate; no feature flag, optional
    internal receipt, fallback, or contract-version break is introduced.
  - Evidence mode: validation
  - Evidence: `pnpm typecheck` exited 0 after migration of 14
    `FileCatalogScanResult` doubles across eight test files; the focused contract
    suite is included in the recorded 127-test Spec 053 pass.

  - Status: Contract version remains 0.1; legacy raw input is accepted but current plans do not emit it.
## Phase 2: Shared Population Truth

- [x] T003 Implement the pure skipped-path population accumulator and invariant
  tests.
  - Depends on: T002
  - Requirements: Requirement 1, Requirement 2, Requirement 3
  - Properties: CP-001, CP-002, CP-003, CP-004
  - Files: `src/domain/policies/skipped-path-summary.ts`,
    `src/domain/policies/index.ts`,
    `tests/application/skipped-path-summary.test.ts`
  - Acceptance: unique normalized `reason:path` observations yield exact totals,
    all encountered reason groups, lexical top-three samples, exact
    `sample_truncated`, stable permutations, and an empty receipt without a new
    dependency or runtime budget.
  - Validation: `pnpm exec vitest run tests/application/skipped-path-summary.test.ts --maxWorkers=4`
  - Evidence mode: validation
  - Evidence: `pnpm exec vitest run
    tests/application/skipped-path-summary.test.ts --maxWorkers=4` exited 0 with
    2/2 tests covering deduplication, conservation, ordering, normalization,
    permutation stability, and empty input.

  - Status: Shared pure policy uses fixed sample limit 3 and no runtime budget.
- [x] T004 Integrate exact population accounting into the file catalog scanner.
  - Depends on: T003
  - Requirements: Requirement 1, Requirement 3, Requirement 4
  - Properties: CP-001, CP-004, CP-005, CP-006
  - Files: `src/infrastructure/filesystem/file-catalog-scanner.ts`,
    `src/ports/index.ts`, every production producer and scanner-result test
    double inventoried by T002,
    `tests/workspace/file-catalog-scanner.test.ts`
  - Acceptance: every unique skip classification updates the population after
    the 100-record raw compatibility sample fills; scanner priority-path records
    remain available when the caller supplies them; scanner `truncated` and
    continuation evidence are unchanged; every required-result producer/double
    supplies the receipt; a more-than-100 regression proves exact counts without
    changing traversal or `max_files`.
  - Validation: `pnpm typecheck && pnpm exec vitest run tests/workspace/file-catalog-scanner.test.ts --maxWorkers=4`
  - Evidence mode: validation
  - Evidence: tests/workspace/file-catalog-scanner.test.ts passes 19 tests, including exact population beyond the 100-record raw retention list; single-worker /usr/bin/time run recorded 169628 KiB peak RSS for the whole Vitest process.

  - Status: Scanner traversal, max_files, truncation, and continuation behavior are unchanged.
## Phase 3: Validation Plan And Context Projections

- [x] T005 Replace validation-plan raw skip output with the structured summary.
  - Depends on: T004
  - Requirements: Requirement 1 through Requirement 5
  - Properties: CP-001 through CP-006
  - Files: `src/application/use-cases/plan-verification.ts`,
    `src/contracts/runtime-validation-edit-contracts.ts`,
    `src/presentation/verification-plan-presenter.ts`,
    `tests/contracts/runtime-contracts.test.ts`,
    `tests/mcp/verification-plan-tool.test.ts`,
    `tests/presentation/session-aware-presenters.test.ts`,
    `tests/mcp/translation-boundary.test.ts`
  - Acceptance: plan construction consumes the exact population receipt,
    forwards safe selected paths as scanner priorities, exposes all reason
    groups and at most 50 lexically ordered actionable selected-path records,
    passes all public path/detail output through presenter redaction, preserves
    scanner truncation, commands, risks, blockers, status, and next actions, and
    emits no raw `skipped_paths` field.
  - Validation: `pnpm exec vitest run tests/contracts/runtime-contracts.test.ts tests/mcp/verification-plan-tool.test.ts tests/presentation/session-aware-presenters.test.ts tests/mcp/translation-boundary.test.ts --maxWorkers=4`
  - Evidence mode: validation
  - Evidence: The recorded focused Spec 053 command exited 0 with 127 tests;
    assertions cover the exact structured summary, actionable secret exclusion,
    `source_truncated`, presenter redaction, and absence of raw current output.

  - Status: Planner forwards safe selected paths as scanner priorities and presenter redacts samples/details.
- [x] T006 Derive task-context skipped work from the shared summary policy.
  - Depends on: T005
  - Requirements: Requirement 2, Requirement 4, Requirement 5
  - Properties: CP-002, CP-003, CP-005, CP-006
  - Files: `src/application/use-cases/get-task-context.ts`,
    `src/presentation/task-context-presenter.ts`,
    `tests/mcp/context-for-task-tool.test.ts`,
    `tests/presentation/session-aware-presenters.test.ts`
  - Acceptance: task context and verification plans use identical counts,
    ordering, samples, and every encountered reason group exactly once; task
    context uses the finite reason vocabulary to retain its bounded prose shape
    without the current five-reason slice; missing population data fails the
    adapter contract rather than
    rebuilding from raw evidence; no per-surface grouping implementation
    remains.
  - Validation: `pnpm exec vitest run tests/mcp/context-for-task-tool.test.ts tests/presentation/session-aware-presenters.test.ts --maxWorkers=4`
  - Evidence mode: validation
  - Evidence: `pnpm exec vitest run tests/mcp/context-for-task-tool.test.ts
    tests/presentation/session-aware-presenters.test.ts --maxWorkers=4` formed
    part of the 127-test focused pass; assertions cover six reason groups and
    presenter redaction.

  - Status: The former five-reason slice and local recounting implementation were removed.
## Phase 4: Cross-Surface Acceptance

- [x] T007 Add the generated/vendor-heavy five-gate MCP regression and payload
  conservation proof.
  - Depends on: T006
  - Requirements: Requirement 6
  - Properties: CP-001 through CP-006
  - Files: a selected/new fixture under `tests/fixtures/`,
    `tests/mcp/verification-plan-tool.test.ts`,
    `tests/mcp/context-for-task-tool.test.ts`,
    `tests/mcp/stdio-entrypoint.test.ts`
  - Acceptance: at least 50 routine exclusions compact to deterministic groups
    while `pnpm typecheck`, `pnpm test`, `pnpm validate:plugin`,
    `pnpm validate:skills`, and `pnpm pack:dry-run` each remain present exactly
    once; exact counts, response size, actionable exclusion, material blocker,
    redaction, no-skip, and scanner-truncation assertions pass.
  - Evidence mode: validation
  - Evidence: Generated-heavy verification regression produces 125 exact routine exclusions with a lexical three-path sample while preserving all five Agent Workbench gates exactly once; stdio-entrypoint suite passes 16 tests.

  - Status: Existing fixture construction was extended rather than adding a duplicate fixture root.
## Phase 5: Validation, Promotion, And Review

- [x] T008 Run focused and full validation, then perform bounded installed or
  checkout-source dogfood.
  - Depends on: T007
  - Requirements: Requirement 1 through Requirement 6
  - Files: implementation/tests, `verification.md`, dogfood ledger when executed
  - Acceptance: typecheck, focused tests, full suite with four workers,
    plugin/skill/package gates, diff checks, and an exact validation-plan
    dogfood call pass or retain truthful structured blocking evidence; dogfood
    records runtime/package identity, response bytes, commands, counts, and
    truncation without claiming repository completeness from a truncated scan.
  - Evidence mode: validation
  - Evidence: pnpm typecheck passed; focused Spec 053 suite passed 127 tests; full Vitest passed 110 files/1218 tests; plugin and skills validation, runtime-build check, package dry-run, and git diff check passed. Source debug harness returned five gates, exact 84-path/four-reason summary, no raw list, and matching context counts/samples.

  - Status: Dogfood used the checkout-source debug harness; it is source behavior evidence, not installed-package or executed validation-command proof.
- [x] T009 Promote accepted behavior and address final review findings.
  - Depends on: T008
  - Requirements: Requirement 6
  - Files: all durable targets in `change-impact.md`, this package
  - Acceptance: durable docs describe current implemented behavior; EB065 is
    delivered; scanner completion, EB059, EB061, and unrelated public surfaces
    remain separately owned; review findings are fixed, rejected with rationale,
    or routed; verification has no partial-blocking/not-covered must-have row;
    closure check passes before package removal.
  - Evidence mode: validation
  - Evidence: Two independent final reviews found no code blocker after remediation. The exact-population runtime warning regression now covers 100 retained routine skips plus a later permission_denied group; actionable-path ordering/uniqueness/group membership is schema-enforced. pnpm typecheck exited 0, 63 focused tests passed, and the full rerun passed 110 files/1,218 tests. All seven durable promotion targets are updated and EB065 is marked delivered.

  - Status: Promotion and reviewer findings are complete; ready for final lifecycle closure check.
## Execution Rules

- Mark exactly one implementation task `[~]` before changing source.
- Do not introduce a scan, extraction, classification, file, byte, time, or
  group cap to obtain compact output.
- Do not treat the fixed three-path presentation sample as evidence exhaustion.
- Do not add a raw-to-summary fallback, dual emitter, feature flag, retry, or
  success-shaped partial output.
- Preserve validation command discovery and material blocker semantics.
- Keep MCP adapters thin; summarization belongs in the shared policy and use
  cases, while presenters redact and validate.
- Record concrete commands/results before marking any task complete.
- Before closure, reconcile every requirement/property and promote all lasting
  behavior to durable owners.

## Related Artifacts

- Requirements: `requirements.md`
- Change Impact: `change-impact.md`
- Design: `design.md`
- Verification: `verification.md`
