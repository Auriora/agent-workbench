---
title: Daemon admission budget tasks
doc_type: spec
artifact_type: tasks
status: active
owner: platform
last_reviewed: 2026-11-06
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Tasks

Requirements and design define shared APIs before implementation. T001 and T002
may proceed concurrently with disjoint ownership after that API agreement;
T003 depends on both. This is an explicit exception to one active task.

- [x] T001 Implement admission accounting and SDK work lifetime.
  - Depends on: shared API agreement in design.md.
  - Requirements: Requirement 1, Requirement 2 AC1, Requirement 3; CP-001-CP-004.
  - Files: admission contracts/port, infrastructure admission module, MCP server
    handler wrapper, server options, focused accounting/SDK tests.
  - Acceptance: finite fair counters, retained work after close/cancel, exactly
    once cleanup and no queued post-close work.
  - Evidence: pnpm exec vitest run tests/infrastructure/runtime/daemon-admission.test.ts tests/mcp/daemon-admission-sdk.test.ts tests/mcp/daemon-admission-transport.test.ts tests/mcp/socket-transport.test.ts tests/mcp/daemon-launch.test.ts --maxWorkers=1 passed 5 files/108 tests. pnpm typecheck passed after test-only narrowing corrections. Actual SDK handler cancellation/close, unclaimed responses, abort registration race, exact input quotas and quiescence verified.

  - Evidence mode: command
- [x] T002 Integrate daemon socket and frame admission.
  - Depends on: shared API agreement; final validation requires T001.
  - Requirements: Requirement 1, Requirement 2, Requirement 3; CP-001-CP-004.
  - Files: daemon.ts, socket-transport.ts, transport and daemon fixtures.
  - Acceptance: accept-time limit, handshake/input accounting, inactivity,
    finite dispatch/output and healthy-client isolation.
  - Evidence: Focused 5-file suite passed 108 tests: accept-time 64 ready/handshaking cap, established healthy ping amid saturation, byte/work/control/output bounds, initial remainder/partial cleanup and inactivity reset. Real delayed tool blocks shutdown/resources and successor; late cleanup remains fenced. pnpm typecheck passed. Full regression/promotion continues in T003.

  - Evidence mode: command
- [x] T003 Verify, independently review and promote delivery.
  - Depends on: T001, T002.
  - Requirements: Requirement 4 and all acceptance criteria.
  - Files: durable owners, backlog, package evidence/review.
  - Acceptance: targeted/full checks pass, reviews resolved, durable docs and
    B006 accurately reflect source delivery and remaining limits.
  - Evidence: Final sequential source-frozen checks passed: pnpm typecheck, check:contracts, build-runtime, build-runtime:check, compiled MCP smoke, and pnpm test --maxWorkers=1 (145 files;1526 passed;1 existing installed-only skip). Plugin/package validation passed; independent security and senior correctness review have no blockers, including final serialization settlement fixture. Durable threat model/operations/contracts/runbook promoted; B006 done and B007-B009 separately owned. verification.md retains earlier failed/interrupted checkpoints and explicit source-only limits. No commit/install/release claim.
  - Evidence mode: command
