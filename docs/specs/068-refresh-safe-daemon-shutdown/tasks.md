---
title: Refresh-safe daemon shutdown tasks
doc_type: spec
artifact_type: tasks
status: active
owner: platform
last_reviewed: 2026-11-06
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Tasks

Read all package artifacts before implementation. Shared shutdown/evidence APIs
must be fixed before starting T001/T002. Once fixed, these tasks have disjoint
controller and daemon ownership and may run concurrently (explicit exception).
T003 fixture authoring may also proceed independently after API agreement; final
validation and completion require both implementation tasks.

- [x] T001 Implement refresh cancellation and settlement.
  - Depends on: none; shared APIs fixed in design.md.
  - Requirements: Requirement 1 AC1-AC3; CP-001, CP-003.
  - Files: refresh-controller.ts; repository-ownership.ts; controller port and
    failure contracts; focused controller/ownership tests.
  - Acceptance: exact-worker cancellation, no post-shutdown admission/publication,
    safe settlement or retained quarantine, including initialization races.
  - Evidence: pnpm exec vitest run tests/runtime/operations.test.ts tests/runtime/repository-ownership-shutdown.test.ts passed 66 cases, including allocation/registration races, delayed termination, previous termination settlement and deferred replacement allocation preserving the published graph. pnpm typecheck passed. Final pnpm test --maxWorkers=1 passed 142 files/1491 tests with the installed-only case covered in a separate 23/23 installed run. Independent correctness review closed all four blockers.

  - Evidence mode: command
- [x] T002 Implement finite daemon drain and lifetime evidence.
  - Depends on: shared API agreement with T001; final validation requires T001.
  - Requirements: Requirement 2, Requirement 3; CP-002, CP-003, CP-004.
  - Files: daemon composition and shutdown coordinator; narrow startup-lock
    reclamation authority and canonical draining/client handoff in daemon-client.ts;
    lifecycle contracts; lifetime contracts/store;
    focused daemon/receipt tests and child fixtures.
  - Acceptance: one referenced budget, immediate cancellation, explicit drain
    rejection, guarded cleanup, truthful durable outcome and positive-death safety.
  - Evidence: D002 exact-owner canonical draining and strict probe rechecks implemented. Nine deterministic draining tests passed; source pnpm test --maxWorkers=1 passed 142 files/1491 tests with only installed-gate skip. The rebuilt pnpm-installed entrypoint suite passed 23/23 with no skips and BOTH concurrent successor clients required. pnpm typecheck, plugin/contracts, build receipt and compiled MCP smoke passed. Independent source review and deterministic-test warning closed; B008/B009 residuals explicitly owned.

  - Evidence mode: command
- [x] T003 Verify integration, review and promote delivery.
  - Depends on: shared APIs fixed for fixture authoring; T001, T002 for final validation.
  - Requirements: Requirement 4 AC1-AC2; all correctness properties.
  - Files: real entrypoint/compiled fixture tests; durable owners; backlog; package.
  - Acceptance: focused/full tests, typecheck, package/build checks and independent
    review have no blockers; B002 status and durable contracts match evidence.
  - Evidence: pnpm test --maxWorkers=1 passed 142 files: 1491 passed, 1 deliberate installed-only skip; separate actual installed suite passed 23/23 including both concurrent successor clients. Typecheck, plugin validation, contract drift, build receipt, compiled MCP smoke and git diff --check passed. review.md records closed correctness/security/QA findings; verification.md records tarball hash, fixture preparation and failed checkpoints. Durable owners promoted; B002 done, B006-B009 owned, Spec065 files untouched. Validation precedes implementation commit; no host installation or release claim.
  - Evidence mode: command
