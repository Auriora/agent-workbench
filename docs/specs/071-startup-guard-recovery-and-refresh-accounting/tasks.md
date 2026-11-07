---
title: Startup recovery and refresh accounting tasks
doc_type: spec
artifact_type: tasks
status: active
owner: platform
last_reviewed: 2026-11-06
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Tasks

- [x] T001 Implement and prove abandoned startup-guard recovery.
  - Depends on: D001 review and concrete filesystem/compatibility contract.
  - Requirements: Requirement 1; CP-001, CP-002, CP-003, CP-005.
  - Files: startup admission infrastructure, src/mcp/daemon-client.ts delegation and tests/mcp startup fixtures.
  - Acceptance: dead guards recover with one owner; busy/uncertain evidence preserved; crash-released exclusion and replacement races proved.
  - Evidence: Final canonical explicit-scope fence preserves foreign/unavailable claims before each PID probe and unlink. Daemon-launch suite 74/74 and final full source regression passed; independent architecture and security reviews report no blockers.

  - Evidence mode: executed
- [x] T002 Correct actual refresh invocation diagnostics.
  - Depends on: none; independent diagnostic slice while D001 safety review proceeds.
  - Requirements: Requirement 2; CP-004, CP-005.
  - Files: src/infrastructure/runtime/refresh-controller.ts and focused controller tests.
  - Acceptance: actual calls counted exactly once; pre-call cancellation zero; diagnostic revision and shutdown semantics preserved.
  - Evidence: workerInvocations now increments only immediately before executor.run, with a diagnostic revision bump; running-transition revision and cancellation fence retained. operations.test.ts65/65 and pnpm typecheck passed. Covers reentrant shutdown/deadline zero, synchronous throw one and normal/revision behavior. Combined full acceptance remainsT003.

  - Evidence mode: command
- [x] T003 Validate integration, review and promote delivery.
  - Depends on: T001; T002.
  - Requirements: Requirement 3; CP-001 to CP-005.
  - Files: durable operations/contracts/security/runbook/backlog and this package.
  - Acceptance: focused/full/source/isolated-installed gates pass, expert findings resolved, durable promotion and backlog disposition accurate.
  - Evidence: Final typecheck, 150-file/1575-test source regression (one installed-only skip), 74 daemon-launch tests, build/receipt/plugin/contracts/package gates, ordinary isolated npm/native smoke and actual installed 25/25 entrypoint cases passed. Independent correctness/security reviews cleared final canonical scope fence. Durable docs and B008/B009 disposition reconciled; B010/B011 retained. No publication or live upgrade.
  - Evidence mode: executed
