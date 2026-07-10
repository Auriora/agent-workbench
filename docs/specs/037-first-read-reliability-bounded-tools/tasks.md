---
title: First-read reliability and bounded tools tasks
doc_type: spec
artifact_type: tasks
status: draft
owner: platform
last_reviewed: 2026-07-10
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Tasks

**Input**: `docs/specs/037-first-read-reliability-bounded-tools/`
**Prerequisites**: `requirements.md`, `design.md`, `traceability.md`,
`verification.md`

## Task Dependency Graph

```text
T001 -> T002 -> T003
T003 -> T004
T004 -> T005
T004 -> T006
T004 -> T007
T005 + T006 + T007 -> T008
T008 -> T009 -> T010
```

## Phase 1: Spec Setup And Baseline

**Purpose**: Create the active package and reconcile it against durable docs.

- [x] T001 Create Spec 037 package from EB003.
  - Depends on: none
  - Requirement: Requirement 5
  - Files: `docs/specs/037-first-read-reliability-bounded-tools/`
  - Acceptance: Package contains requirements, design, tasks, traceability,
    verification, change-impact, and canonical-context artifacts.
  - Evidence: Package scaffolded from EB003 on 2026-07-09.

- [x] T002 Reconcile current runtime-contract and first-read behavior.
  - Depends on: T001
  - Requirement: Requirement 1; Requirement 2; Requirement 3
  - Files: `src/contracts/`, `src/application/use-cases/response-metadata.ts`,
    `src/application/use-cases/get-repo-status.ts`,
    `src/application/use-cases/get-repo-scope.ts`,
    `src/application/use-cases/get-repo-overview.ts`,
    `src/application/use-cases/get-task-context.ts`,
    `src/application/use-cases/query-docs.ts`,
    `src/application/use-cases/diagnose-changed-files.ts`,
    `src/application/use-cases/plan-verification.ts`
  - Acceptance: `design.md` and `traceability.md` are updated if current code
    proves a narrower or different first slice is safer.
  - Evidence: Completed on 2026-07-10. Current contracts expose
    `freshness`, `analysis_validity`, `verification_status`, caveats, trust
    calibration, skipped/budget metadata, and bounded evidence surfaces.
    `response-metadata.ts` centralizes runtime trust classification across
    first-read evidence states. Phase 1 selected the existing public response
    fields plus additive helper semantics for the first slice.

- [x] T003 Define the first implementation slice and minimum-evidence contract.
  - Depends on: T002
  - Requirement: Requirement 1; Requirement 2; Requirement 3
  - Files: `docs/specs/037-first-read-reliability-bounded-tools/design.md`,
    `docs/specs/037-first-read-reliability-bounded-tools/traceability.md`,
    `docs/specs/037-first-read-reliability-bounded-tools/open-decisions.md`
  - Acceptance: One coherent first slice is selected with affected files,
    minimum evidence, validation commands, and residual risks. The selected
    slice must apply approved D001-D003 decisions from `open-decisions.md`.
  - Evidence: Completed on 2026-07-10. Phase 2 starts with T004 as the first
    implementation slice: shared response metadata/helper behavior in
    `src/application/use-cases/response-metadata.ts` and
    `tests/contracts/response-metadata.test.ts`. Minimum evidence uses existing
    response fields and trust metadata. The detailed stale, degraded, and
    unavailable-state mapping is recorded in `design.md`.

## Phase 2: Contract And Fixture Foundation

**Purpose**: Establish shared behavior before changing individual surfaces.

- [x] T004 Add or confirm shared first-read state and trust classification.
  - Depends on: T003
  - Requirement: Requirement 1; Requirement 3
  - Files: `src/contracts/`, `src/application/use-cases/response-metadata.ts`,
    `tests/contracts/`
  - Acceptance: Contract/helper behavior maps first-read stale, degraded, and
    blocked states onto existing response metadata fields through additive
    helper semantics; any proven field-level gap is routed to EB024.
  - Evidence: Completed on 2026-07-10. Added focused
    `response-metadata.test.ts` coverage that proves stale, degraded, cold, and
    unavailable first-read states use existing metadata fields and trust
    boundaries. No public enum migration was selected.
  - [x] T004.1 Add focused contract/helper tests for CP-001 and CP-002.
    - Evidence: `tests/contracts/response-metadata.test.ts` covers state
      metadata mapping and proof-like trust restrictions.
  - [x] T004.2 Implement or document the shared application-level
    classification helper with per-use-case evidence inputs.
    - Evidence: Existing `response-metadata.ts` helper ownership is confirmed by
      direct tests for `buildRuntimeResponseMeta`, `classifyRuntimeTrust`, and
      `buildTrustCalibration`.
  - [x] T004.3 Route any proven field-level enum migration to EB024 before
    broad changes.
    - Evidence: No public enum migration was selected for Phase 2.

- [x] T005 Add first-read failure fixtures.
  - Depends on: T004
  - Requirement: Requirement 4
  - Files: `tests/fixtures/`, focused test helpers
  - Acceptance: Hybrid filesystem fixtures and adapter fakes can reproduce cold,
    stale, degraded, blocked, permission-limited, unsupported, and
    budget-truncated states without relying on flaky wall-clock behavior.
  - Evidence: Completed on 2026-07-10. Added
    `tests/fixtures/fixture-first-read-failure-modes/` and scanner coverage for
    unsupported language, skipped generated/vendor content, and budget-truncated
    catalog evidence. Existing scanner coverage already reproduces
    permission-limited paths, while adapter-fake contract tests reproduce cold,
    stale, degraded, and unavailable runtime states without wall-clock behavior.

## Phase 3: First-Read Surface Hardening

**Purpose**: Apply the shared behavior to bounded runtime surfaces.

- [ ] T006 Harden repo status, scope, and overview first reads.
  - Depends on: T004, T005
  - Requirement: Requirement 1; Requirement 2; Requirement 3; Requirement 4
  - Files: `src/application/use-cases/get-repo-status.ts`,
    `src/application/use-cases/get-repo-scope.ts`,
    `src/application/use-cases/get-repo-overview.ts`,
    `tests/runtime/`, `tests/mcp/`
  - Acceptance: Resource tests prove current, stale, degraded, blocked, and
    skipped-work behavior for representative fixtures.
  - Evidence: Pending.

- [ ] T007 Harden context, docs, diagnostics, and verification planning.
  - Depends on: T004, T005
  - Requirement: Requirement 1; Requirement 2; Requirement 3; Requirement 4
  - Files: `src/application/use-cases/get-task-context.ts`,
    `src/application/use-cases/query-docs.ts`,
    `src/application/use-cases/diagnose-changed-files.ts`,
    `src/application/use-cases/plan-verification.ts`,
    `tests/mcp/`, `tests/docs/`
  - Acceptance: Tool tests prove skipped, missing, provider-limited, planned,
    and unsafe-claim boundaries without reporting partial success as complete.
  - Evidence: Pending.

- [ ] T008 Checkpoint - Focused first-read validation.
  - Depends on: T006, T007
  - Requirement: Requirement 1; Requirement 2; Requirement 3; Requirement 4
  - Files: `docs/specs/037-first-read-reliability-bounded-tools/verification.md`
  - Acceptance: Focused tests pass, validation evidence is recorded, and any
    remaining broad surface work is routed before durable promotion.
  - Validation: Run selected `pnpm exec vitest run ...` slices and
    `pnpm typecheck`.
  - Evidence: Pending.

## Phase 4: Durable Promotion And Closure Readiness

**Purpose**: Promote accepted behavior and make closure possible.

- [ ] T009 Promote accepted behavior to durable docs.
  - Depends on: T008
  - Requirement: Requirement 5
  - Files: `docs/reference/runtime-contracts.md`,
    `docs/design/runtime-operations-design.md`,
    `docs/design/mcp-surface-design.md`,
    `docs/design/graph-store-design.md`,
    `docs/backlog/README.md`,
    `docs/reference/documentation-map.md`
  - Acceptance: Durable docs describe accepted current behavior and route
    residual work to one explicit destination.
  - Evidence: Pending.

- [ ] T010 Checkpoint - Full validation and closure risk.
  - Depends on: T009
  - Requirement: Requirement 5
  - Files: `docs/specs/037-first-read-reliability-bounded-tools/verification.md`
  - Acceptance: Full validation, residual risks, promotion status, and closure
    decision are recorded.
  - Validation: `pnpm typecheck`; `pnpm test`; docs metadata/link tests;
    lifecycle/package checks if available.
  - Evidence: Pending.

## Execution Rules

- Do not implement from `tasks.md` alone. Review requirements, design,
  traceability, change impact, and verification for the selected task.
- Mark the selected task `[~]` before implementation work starts.
- Keep implementation slices small enough that response-contract changes,
  resource/tool changes, and durable-doc promotion remain reviewable.
- Do not add fallback parser, semantic, validation, or command-execution paths
  to satisfy first-read reliability.
- Record validation evidence in `verification.md` before marking a task
  complete.
