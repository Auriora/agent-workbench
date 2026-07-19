---
title: Daemon-owned refresh convergence verification
doc_type: spec
artifact_type: verification
status: draft
owner: platform
last_reviewed: 2026-07-19
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Verification

## Scope

Every check is pending. Record command, outcome, relevant fixture, and failure
limits when executed. Passing structure or unit tests alone does not establish
live installed-package convergence.

This record covers Requirements 1-6, CP-001-CP-009, and T001-T009 for the
daemon-owned refresh convergence slice.

## Quality Gates

| Gate | Required? | Status | Evidence |
| --- | --- | --- | --- |
| Requirements and correctness properties reviewed | yes | pending | |
| Parent and child task acceptance and evidence complete | yes | pending | |
| Focused and full automated tests pass | yes | pending | |
| Package/plugin/skill gates pass | yes | pending | |
| Durable documentation promoted | yes | pending | |
| Lifecycle reconciliation and closure risk complete | yes | pending | |

## Focused Verification

| ID | Check | Proves | Status |
| --- | --- | --- | --- |
| V001 | focused controller/runtime tests | one planned/running execution and no automatic retry | pending |
| V002 | two provider-labelled clients through an actually packed-and-installed npm bin | non-startup trigger, one daemon PID, one execution identity, one worker invocation, and shared fresh convergence | pending |
| V003 | deterministic concurrent and sequential stale status/watcher requests | idempotent request, duplicate invalidation reuse, and one writer | pending |
| V004 | requester disconnect, zero-client active refresh, and idle-lease race cases | execution survives socket loss; reconnect cannot create a second owner; idle grace starts only after terminal state | pending |
| V005 | daemon-launch/integration-health success and exact failure transitions | identical execution/snapshot IDs, legal state combinations, bounded structured last failure, and correct top-level trust | pending |
| V006 | health schema, presenter, and resource tests | canonical warm-up/freshness enums and state matrix; no terminal `scheduled/unknown` or false-success envelope | pending |
| V007 | status replacement-snapshot tests across two clients | identity advances once, both clients become fresh, and invalidation during running is not lost | pending |
| V008 | barrier-controlled graph-store migration, publication, interruption, concurrent-reader, downgrade-block, and reopen tests | existing rows migrate transactionally, older runtimes block, incomplete generations are never selected, and deleted rows disappear only on completed publication | pending |
| V009 | query-tool and docs-surface tests with known surviving evidence | `find_references` and `docs_search` return exact expected hits from the replacement snapshot | pending |
| V010 | worker hang, timeout, zero-exit, invalid-result, SQLite, permission, and publication-failure fixtures | exact structured failure, non-fresh evidence, no raw output, worker/store cleanup, and deterministic recovery | pending |
| V011 | daemon/standalone/cross-process architecture and negative assertions | one controller/executor path, one cross-process owner, no manual tool, provider branch, retry loop, or fallback | pending |

### Deterministic Lifecycle Fixtures

Concurrency tests SHALL use a controllable executor and explicit barriers for
`requested`, `worker_started`, publication phases, and `terminal`; fixed sleeps
or successful snapshot count alone do not prove ownership. Cover:

- concurrent and sequential stale first reads, duplicate watcher events, and a
  watcher invalidation arriving while refresh is already running;
- daemon-hosted clients, standalone composition, and two independent launcher
  processes competing for the same repository daemon;
- requester disconnect before worker start and during publication, zero-client
  active refresh, reconnect during the idle window, completion racing the idle
  timer, and failure racing the idle timer;
- a worker hang that reaches the explicit timeout, worker error, non-zero exit,
  zero exit without a valid completion receipt, and invalid worker output;
- worker termination, controller disposal, graph-store close exactly once, and
  socket, metadata, startup-lock, WAL/SHM, and child-process cleanup on every
  terminal and shutdown path.

Each concurrency case SHALL assert an authoritative execution ID, snapshot ID,
worker invocation count, and state history. Observing one final snapshot is not
sufficient evidence that a duplicate writer did not start.

### Publication And Crash Fixtures

Pause replacement indexing after generation creation, catalog writes, graph
writes, docs/heading/FTS writes, and immediately before publication. At every
barrier, read through both the existing connection and a separately opened
connection, then close and reopen the store. Readers SHALL continue selecting
the prior non-fresh generation until completed publication; no partial
replacement may be reported as usable.

Interrupt the worker and crash the daemon at every publication barrier. Prove
that restart ignores or recovers the orphaned unpublished generation, cannot
overlap the prior owner, retains the last readable generation, and permits one
later ordinary stale request to converge. Retention and cleanup assertions must
cover abandoned generations as well as successful replacements.

Migration fixtures SHALL open a pre-Spec-041 database containing fresh, stale,
cold, and refreshing snapshots. They must prove transactional classification,
schema-version increment, preservation of the prior published generation,
rollback on migration failure, explicit older-runtime refusal, pre-migration
restore, and the documented derived-store rebuild path. In-place downgrade or
ad hoc database deletion is not acceptable evidence.

### Diagnostics And Redaction Fixtures

Schema, presenter, resource, and package tests SHALL exercise the complete legal
matrix for `idle`, `planned`, `running`, `complete`, and `failed` against graph
freshness, execution/snapshot ID presence, and `last_failure` presence. Each
client must observe identical IDs and a monotonic state history. A failed or
unavailable authoritative diagnostic must change top-level trust/verification
metadata according to the contract rather than remain a trusted fresh success.

Failure fixtures SHALL assert exact stable error code/category and bounded
structured fields. Inject sentinel absolute paths, workspace escapes, API
tokens, passwords, SQLite statements, worker stacks, control characters, and
oversized messages, then prove none escape through JSON envelopes, stdout,
stderr, timeout messages, metadata, or `last_failure`. A later successful
execution must clear prior failure evidence exactly when the contract specifies.

### Package And Query Acceptance

The package acceptance fixture SHALL create a real tarball, install it into an
isolated temporary project or prefix, and invoke the installed
`agent-workbench-mcp` bin with isolated runtime/state directories. Directly
spawning `src/mcp/stdio-entrypoint.mjs` remains a useful checkout integration
test but is not package-entrypoint evidence.

The two sessions are provider-labelled MCP clients (`codex` and `claude_code`),
not proof that the real Codex or Claude Code CLIs invoked the plugin. Record that
distinction in the receipt unless a separate CLI-level test is executed.

Post-refresh query assertions SHALL use a deleted-path sentinel plus known
surviving symbols, references, documents, headings, and search terms. Assert the
exact surviving `find_references` and `docs_search` hits, replacement snapshot
identity, fresh/trusted metadata, and deleted evidence absence; merely receiving
a non-blocked or empty successful envelope is insufficient.

Suggested focused commands:

```text
pnpm exec vitest run tests/runtime/operations.test.ts tests/runtime/workspace-change-queue.test.ts
pnpm exec vitest run tests/mcp/daemon-launch.test.ts tests/mcp/daemon-entrypoint-integration.test.ts
pnpm exec vitest run tests/mcp/repo-status-resource.test.ts tests/mcp/query-tools.test.ts tests/mcp/docs-surfaces.test.ts
pnpm exec vitest run tests/mcp/integration-health-contract.test.ts tests/mcp/integration-health-resource.test.ts
```

## Validation Commands

| ID | Command/check | Status |
| --- | --- | --- |
| V012 | `pnpm typecheck` | pending |
| V013 | `pnpm test` | pending |
| V014 | `pnpm run validate:plugin` | pending |
| V015 | `pnpm run validate:skills` | pending |
| V016 | `pnpm pack:dry-run` | pending |
| V017 | spec lifecycle authoring lint/readiness for Spec 041 | pending |
| V018 | Markdown set check and `git diff --check` | pending |
| V019 | `node scripts/ci/install-smoke.mjs` | pending |
| V020 | `node scripts/ci/mcp-launch-smoke.mjs` | pending |
| V021 | real `npm pack`, isolated install, and installed-bin two-client acceptance | pending |

## Requirement Coverage

| Requirement | Criteria | Evidence | Residual risk |
| --- | --- | --- | --- |
| Requirement 1 | AC1.1-AC1.6 | pending | not covered |
| Requirement 2 | AC2.1-AC2.6 | pending | not covered |
| Requirement 3 | AC3.1-AC3.6 | pending | not covered |
| Requirement 4 | AC4.1-AC4.6 | pending | not covered |
| Requirement 5 | AC5.1-AC5.6 | pending | not covered |
| Requirement 6 | AC6.1-AC6.6 | pending | not covered |

## Correctness Property Coverage

| Property | Covered by | Evidence | Residual risk |
| --- | --- | --- | --- |
| CP-001 | T001-T002, T004-T005, T008; V001-V003, V011, V021 | pending | not covered |
| CP-002 | T001-T002, T004-T005, T008; V002-V004, V007, V021 | pending | not covered |
| CP-003 | T001, T004, T007-T008; V004, V010, V021 | pending | not covered |
| CP-004 | T001-T003, T007-T008; V007-V010, V021 | pending | not covered |
| CP-005 | T001, T006, T008; V005-V006, V021 | pending | not covered |
| CP-006 | T001-T003, T006-T008; V001, V003, V005-V006, V010-V011, V021 | pending | not covered |
| CP-007 | T001-T002, T005, T008; V001, V003, V007, V021 | pending | not covered |
| CP-008 | T001, T003, T007-T008; V007-V010, V021 | pending | not covered |
| CP-009 | T001-T002, T004-T008; V001-V011, V021 | pending | not covered |

## Task Evidence

| Task | Status | Evidence | Notes |
| --- | --- | --- | --- |
| T001-T009 and child slices | pending | | Update each parent and child separately during implementation. |

## Evidence Log

| Date | Evidence | Result | Notes |
| --- | --- | --- | --- |
| 2026-07-19 | Spec intake and repository architecture inspection | pending | Defines the plan; does not prove implementation. |
| 2026-07-19 | Independent spec review and lifecycle readiness reconciliation | done | Made incomplete replacement publication explicit implementation work and separated complete planning traceability from pending implementation evidence. |
| 2026-07-19 | MoE findings reconciliation | done | Resolved four blockers and sixteen additional findings, including D013 migration/rollback and parser-visible CP mapping, across requirements, design, bounded child tasks, verification, traceability, impact, and canonical context; this is planning/review evidence, not implementation proof. |

## Residual Risks

- Package-entrypoint refresh convergence is not implemented or verified yet.
- Async authoritative diagnostics may require additive composition changes;
  compatibility must be proven by schema and presenter fixtures.
- Daemon crash during active publication is not proven safe by the current
  store. T003 and T007 must establish publication selection, orphan recovery,
  and no ownership split through interruption and reopen fixtures.
- Cross-process ownership, explicit worker timeout, worker/store disposal, and
  idle-lease races remain unverified until the deterministic fixtures pass.
- EB014 large-repository warm-up duration remains outside this slice.

## Runtime Acceptance Receipt

Before closure, capture bounded packed-and-installed-bin evidence containing:

- installed package identity, daemon PID, and two distinct provider-labelled
  client sessions, explicitly distinguished from real agent CLI execution;
- old and replacement snapshot identities;
- deleted path absent from replacement inventory;
- one execution identity, one worker invocation, and its state transitions as
  observed identically by both clients;
- exact health state/freshness/identity/failure transitions and top-level trust;
- fresh status observed by both clients;
- exact expected surviving `find_references` and `docs_search` hits from the
  replacement snapshot;
- requester disconnect, idle-lease, crash/orphan-recovery, and cleanup outcomes;
- confirmation that no sentinel path, secret, SQLite, or worker output escaped.

## Closure Conditions

- Every requirements criterion and correctness property has reproducible
  evidence.
- Traceability contains no `not-covered` row.
- Durable promotions are complete and current.
- The support/rollback runbook covers state diagnosis, cleanup, downgrade or
  schema compatibility, orphaned publication recovery, and safe evidence
  collection.
- Deferred EB014 work remains explicitly separate.
- Backlog, changelog, and closure history identify implementation and closure
  commits truthfully.
