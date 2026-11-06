---
title: Daemon lifetime evidence tasks
doc_type: spec
artifact_type: tasks
status: active
owner: platform
last_reviewed: 2026-11-06
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Tasks

Read requirements, design, traceability and verification before implementation.
T001 and T002 may run concurrently after their shared API is agreed: disjoint
store and composition ownership is an explicit parallel implementation exception.

- [x] T001 Implement bounded private receipt contracts and persistence.
  - Depends on: none.
  - Requirements: Requirement 1 AC1-AC3.
  - Files: src/contracts/daemon-lifetime-contracts.ts; runtime-contracts.ts;
    src/ports/index.ts; src/infrastructure/runtime/daemon-lifetime-evidence.ts;
    focused infrastructure tests.
  - Acceptance: strict bounded receipt, private atomic storage, retention,
    unavailable states and generation checks satisfy Requirement 1.
  - Evidence: pnpm exec vitest run tests/infrastructure/daemon-lifetime-evidence.test.ts passed 11 tests, including lock-held fatal/exit byte preservation, replacement during ESRCH probe and malformed lifecycle facts. Full suite passed 138 files and 1445 tests; pnpm typecheck passed. Private bounded store, retention and launch-aware locking implemented.

  - Evidence mode: command
- [x] T002 Observe daemon lifetime and expose health evidence.
  - Depends on: shared T001 API agreed; final validation requires T001.
  - Requirements: Requirement 2 AC1-AC3.
  - Files: src/mcp/daemon.ts; health contracts/use case/server; process hooks
    and focused real child fixtures/tests.
  - Acceptance: real child evidence without fatal suppression; health explicit;
    activation only after admission; no startup or shutdown policy change.
  - Evidence: Nine real-process receipt tests passed: normal/nonzero/fatal/rejection/SIGTERM/SIGKILL-replacement, absent parent and unavailable sink; focused hook/health/admission tests passed. Full suite passed 138 files/1445 tests, typecheck and compiled MCP smoke passed. Health preserves independent daemon_lifetime_evidence when refresh diagnostics fail; no shutdown deadline or fatal-behavior change.

  - Evidence mode: command
- [x] T003 Promote, validate and independently review delivery.
  - Depends on: T001, T002.
  - Requirements: Requirement 1, Requirement 2.
  - Files: durable targets; backlog; this package.
  - Acceptance: typecheck, full tests and relevant packaging checks pass;
    independent review has no blockers; durable docs and backlog match source.
  - Evidence: pnpm test --maxWorkers=2 passed 138 files/1445 tests on 2026-11-06; typecheck, plugin, contract drift, runtime build/receipt and isolated compiled MCP smoke all passed. Independent QA and security/operations review has no remaining findings (review.md). Durable owners/documentation map and B001 backlog promoted; B002/B006 remain accepted; Spec 065 untouched. Structural lint has zero errors and reviewed canonical-context advisory; scan found zero active errors. Package retained; validation precedes commit; no installation/release claim.
  - Evidence mode: command
