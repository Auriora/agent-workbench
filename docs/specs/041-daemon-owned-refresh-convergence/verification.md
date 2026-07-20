---
title: Daemon-owned refresh convergence verification
doc_type: spec
artifact_type: verification
status: draft
owner: platform
last_reviewed: 2026-07-20
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Verification

## Scope

Phase 1 through Phase 5 checks are recorded below. Phase 5 promotes the verified
behavior, remediates compatibility and startup-lock gaps discovered during
closure review, and establishes closure readiness.

This record covers Requirements 1-6, CP-001-CP-009, and T001-T009 for the
daemon-owned refresh convergence slice.

## Quality Gates

| Gate | Required? | Status | Evidence |
| --- | --- | --- | --- |
| Requirements and correctness properties reviewed | yes | done | Phase 5 review found and remediated the downgrade-isolation and startup-lock gaps; all AC/CP rows have executable evidence. |
| Parent and child task acceptance and evidence complete | yes | done | T001-T009.4 acceptance is recorded below and in `tasks.md`. |
| Focused and full automated tests pass | yes | done | Final focused compatibility/daemon suites and the 80-file/749-test full suite pass without expected failures. |
| Package/plugin/skill gates pass | yes | done | Installed smoke, plugin, skill, 0.6.0 package dry-run, and launch gates pass. |
| Durable documentation promoted | yes | done | All 15 promotion candidates changed; no reasoned no-op was required. |
| Lifecycle reconciliation and closure risk complete | yes | done | Independent review has no implementation blocker; closure/archive checks are recorded in the Phase 5 receipt. |

## Focused Verification

| ID | Check | Proves | Status |
| --- | --- | --- | --- |
| V001 | focused controller/runtime tests | one planned/running execution and no automatic retry | done |
| V002 | two provider-labelled clients through an actually packed-and-installed npm bin | non-startup trigger, one daemon PID, one execution identity, one worker invocation, and shared fresh convergence | done |
| V003 | deterministic concurrent and sequential stale status/watcher requests | idempotent request, duplicate invalidation reuse, and one writer | done |
| V004 | requester disconnect, zero-client active refresh, and idle-lease race cases | execution survives socket loss; reconnect cannot create a second owner; idle grace starts only after terminal state | done |
| V005 | daemon-launch/integration-health success and exact failure transitions | identical execution/snapshot IDs, legal state combinations, bounded structured last failure, and correct top-level trust | done |
| V006 | health schema, presenter, and resource tests | canonical warm-up/freshness enums and state matrix; no terminal `scheduled/unknown` or false-success envelope | done |
| V007 | status replacement-snapshot tests across two clients | identity advances once, both clients become fresh, and invalidation during running is not lost | done |
| V008 | barrier-controlled graph-store migration, publication, interruption, concurrent-reader, downgrade-block, and reopen tests | existing rows migrate transactionally, older runtimes block, incomplete generations are never selected, and deleted rows disappear only on completed publication | done |
| V009 | query-tool and docs-surface tests with known surviving evidence | `find_references` and `docs_search` return exact expected hits from the replacement snapshot | done |
| V010 | worker hang, timeout, zero-exit, invalid-result, SQLite, permission, and publication-failure fixtures | exact structured failure, non-fresh evidence, no raw output, worker/store cleanup, and deterministic recovery | done |
| V011 | daemon/standalone/cross-process architecture and negative assertions | one controller/executor path, one cross-process owner, no manual tool, provider branch, retry loop, or fallback | done |

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

Phase 1 centralizes the deliberately failing deadline, catch-up, and idle
lifetime behavior in `tests/helpers/spec041-refresh-reproductions.ts`. This is a
temporary contract factory, not an alternate runtime path. T002, T004, and T005
must replace its returned reproductions with the corresponding production
controller or lifetime policy and convert the associated `it.fails` cases to
ordinary passing tests. Leaving the reproduction implementation in place is a
blocking validation failure for those tasks.

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
| V012 | `pnpm typecheck` | passed for final Phase 5 tree at 0.6.0 |
| V013 | `pnpm test` | passed: 80 files, 749 tests, no expected failures |
| V014 | `pnpm run validate:plugin` | passed; released/install and unreleased/runtime identities are consistent |
| V015 | `pnpm run validate:skills` | passed: 6 skills, 0 errors, 0 warnings |
| V016 | `pnpm pack:dry-run` | passed: unreleased 0.6.0, 240 entries |
| V017 | spec lifecycle authoring lint/readiness for Spec 041 | passed: package lint, task audit, stage readiness, closure risk, and closure check recorded in Phase 5 receipt |
| V018 | Markdown checks and `git diff --check` | passed; only non-blocking table-readability findings remain |
| V019 | `node scripts/ci/install-smoke.mjs` | passed on Linux |
| V020 | `node scripts/ci/mcp-launch-smoke.mjs` | passed against an isolated repository root; initial current-repo run correctly blocked on the live v0.5.2 daemon identity |
| V021 | real `npm pack`, isolated install, and installed-bin two-client acceptance | passed for unreleased 0.6.0 with exact query, identity, convergence, and cleanup receipts |

## Requirement Coverage

| Requirement | Criteria | Evidence | Residual risk |
| --- | --- | --- | --- |
| Requirement 1 | AC1.1-AC1.6 | Phase 1-5 controller, daemon, trigger, startup-lock, and installed-convergence receipts | none |
| Requirement 2 | AC2.1-AC2.6 | Phase 1-5 lifetime, disconnect, watcher, crash, startup concurrency, and installed receipts | none |
| Requirement 3 | AC3.1-AC3.6 | Phase 1-5 diagnostics, state-matrix, redaction, recovery, and installed receipts | none |
| Requirement 4 | AC4.1-AC4.6 | Phase 1-5 publication, schema identity, tagged-v0.5.2 block, crash-barrier, and exact-query receipts | none |
| Requirement 5 | AC5.1-AC5.6 | Phase 1-5 deadline, ownership, owner-gated retirement, startup-lock, crash, and cleanup receipts | none |
| Requirement 6 | AC6.1-AC6.6 | Phase 1-5 layering, composition, recovery, 0.6.0 package identity, and CI receipts | none |

## Correctness Property Coverage

| Property | Covered by | Evidence | Residual risk |
| --- | --- | --- | --- |
| CP-001 | T001-T002, T004-T005, T008; V001-V003, V011, V021 | Phase 2-4 controller, ownership, trigger, and installed evidence | none |
| CP-002 | T001-T002, T004-T005, T008; V002-V004, V007, V021 | Phase 3-4 daemon lifetime, trigger, disconnect, and installed evidence | none |
| CP-003 | T001, T004, T007-T008; V004, V010, V021 | Phase 3-4 disconnect, shutdown, crash, and installed evidence | none |
| CP-004 | T001-T003, T007-T008; V007-V010, V021 | Phase 2-4 atomic publication, crash, and exact-query evidence | none |
| CP-005 | T001, T006, T008; V005-V006, V021 | Phase 3-4 authoritative diagnostics and installed evidence | none |
| CP-006 | T001-T003, T006-T008; V001, V003, V005-V006, V010-V011, V021 | Phase 2-4 terminal, recovery, redaction, and installed evidence | none |
| CP-007 | T001-T002, T005, T008; V001, V003, V007, V021 | Phase 2-4 monotonic catch-up and installed evidence | none |
| CP-008 | T001, T003, T007-T008; V007-V010, V021 | Phase 2-4 publication/freshness, crash, and installed evidence | none |
| CP-009 | T001-T002, T004-T008; V001-V011, V021 | Phase 2-4 execution, ownership, publication, diagnostics, and installed identity evidence | none |

## Task Evidence

| Task | Status | Evidence | Notes |
| --- | --- | --- | --- |
| T001 and child slices | done | Phase 1 contract receipt below | Contract/reproduction evidence only. |
| T002 and child slices | done | Phase 2 implementation receipt below | Shared controller/executor slice implemented and independently re-reviewed. |
| T003 and child slices | done | Phase 2 implementation receipt below | Atomic publication/selection slice implemented and independently re-reviewed. |
| T004-T006 and child slices | done | Phase 3 implementation receipt below | Daemon ownership, public triggers, and authoritative diagnostics implemented. |
| T007-T008 and child slices | done | Phase 4 implementation and installed acceptance receipt below | Crash recovery, exact installed queries, and cleanup are complete. |
| T009 and T009.1-T009.3 | done | Phase 5 promotion and closure receipt below | All gates, 15 promotion candidates, EB052/EB014 reconciliation, review, and lifecycle records complete. |
| T009.4 | done | Phase 5 compatibility and startup-ownership receipt below | Tagged v0.5.2 blocks, v2 retirement and rollback are owner-gated/atomic, startup-lock publication is atomic, and 0.6.0 identity is explicit. |

## Evidence Log

| Date | Evidence | Result | Notes |
| --- | --- | --- | --- |
| 2026-07-19 | Spec intake and repository architecture inspection | pending | Defines the plan; does not prove implementation. |
| 2026-07-19 | Independent spec review and lifecycle readiness reconciliation | done | Made incomplete replacement publication explicit implementation work and separated complete planning traceability from pending implementation evidence. |
| 2026-07-19 | MoE findings reconciliation | done | Resolved four blockers and sixteen additional findings, including D013 migration/rollback and parser-visible CP mapping, across requirements, design, bounded child tasks, verification, traceability, impact, and canonical context; this is planning/review evidence, not implementation proof. |
| 2026-07-19 | Phase 1 T001 contract and reproduction receipt | done | `pnpm typecheck` passed; focused runtime/store/contracts reported 39 pass and 12 expected failures; focused daemon/source-entrypoint reported 19 pass and 4 expected failures; full `pnpm test` reported 80 files, 640 pass, and 16 expected failures. Independent re-review found no remaining blockers or advisories. |
| 2026-07-20 | Phase 2 T002-T003 implementation receipt | done | `pnpm typecheck` passed; the 12-file controller/publication/query focused suite reported 207 pass and 4 expected later-phase failures; full `pnpm test` reported 80 files, 690 pass, and 9 expected later-phase failures. Independent remediation re-review found no remaining Phase 2 blocker. |
| 2026-07-20 | Phase 3 T004-T006 implementation receipt | done | `pnpm typecheck` passed; the ownership/trigger/diagnostics/status suite reported 130 ordinary passes across 8 in-process files plus 9 isolated daemon-entrypoint passes; full `pnpm test` reported 80 files, 722 pass, and the single expected T007 orphan-recovery failure. Plugin, skill, and package dry-run gates passed. |
| 2026-07-20 | Phase 4 T007-T008 recovery and installed acceptance receipt | done | Crash/recovery suites, five real daemon crash barriers, exact source queries, checkout smokes, and installed-package two-client convergence pass; full `pnpm test` reports 80 files and 741 passes with no expected failures. |
| 2026-07-20 | Phase 5 promotion, compatibility remediation, and closure receipt | done | Independent review found an older-runtime overclaim and startup-lock publication race. Both root causes were implemented and re-reviewed; all durable targets changed; full tests report 80 files/749 tests; 0.6.0 package, installed-bin, lifecycle, Markdown, and diff gates pass. |

## Phase 1 Contract Receipt

Phase 1 intentionally uses Vitest `it.fails` for production behavior that later
phases must implement. The suite staying green proves that each guarded setup
reaches its named missing-behavior assertion; it does not claim the behavior is
implemented. T002, T003, T004, T005, T006, and T007 must convert the relevant
expected failures to ordinary passing tests as their production seams land.

| Command | Result | Contract evidence |
| --- | --- | --- |
| `pnpm typecheck` | passed | Provider-neutral publication, execution, deadline, generation, admission, ownership, activity, diagnostics, and structured-failure contracts compose without type errors. |
| `pnpm exec vitest run tests/runtime/operations.test.ts tests/runtime/workspace-change-queue.test.ts tests/graph/store.test.ts tests/mcp/integration-health-contract.test.ts` | 39 passed; 12 expected failures | Locks deadline settlement, later-request retry admission, generation catch-up, publication selection, prior-schema migration, newer-schema refusal, orphan recovery, authoritative diagnostics, false-success trust, and safe failure messages. |
| `pnpm exec vitest run tests/mcp/daemon-launch.test.ts tests/mcp/daemon-entrypoint-integration.test.ts` | 19 passed; 4 expected failures | Locks shared diagnostic identity, the real ordered non-startup deleted-path request, synthetic daemon health, and the disconnect/idle activity-lease decision. |
| `pnpm test` | 80 files passed; 640 passed; 16 expected failures | Proves the contract-first fixtures introduce no unexpected repository regression while retaining all intended missing-production seams. |
| Independent Phase 1 re-review | no blockers or advisories | Confirmed the true prior-schema fixture, supported-schema orphan seam, separate newer-schema refusal, closed safe-message vocabulary, production-backed second-client reproduction, and mandatory shared-factory replacement in T002/T004/T005. |

## Phase 2 Implementation Receipt

Phase 2 implements the shared execution and publication foundations only. The
four expected failures in the focused receipt remain owned by T004-T007: daemon
ownership/admission, bounded diagnostics, trigger-level catch-up, and orphan
reconciliation. They are not Phase 2 regressions.

| Command/check | Result | Implementation evidence |
| --- | --- | --- |
| `pnpm typecheck` | passed | Controller, generation-fenced publication, build-only worker, structured unpublished selection, and building-only write contracts compose without type errors. |
| `pnpm exec vitest run tests/runtime/operations.test.ts tests/runtime/workspace-change-queue.test.ts tests/graph/store.test.ts tests/graph/extraction-pipeline.test.ts tests/graph/query-tools.test.ts tests/docs/fts-docs-search-fixtures.test.ts tests/docs/query-docs.test.ts tests/mcp/docs-surfaces.test.ts tests/mcp/query-tools.test.ts tests/mcp/repo-status-resource.test.ts tests/mcp/stdio-entrypoint.test.ts tests/architecture/layer-boundaries.test.ts` | 12 files passed; 207 passed; 4 expected failures | Proves linearized admission, numeric allocation, finite one-result execution, generation catch-up, termination quarantine, atomic publication, migration/rollback, CAS refusal, published-only public reads, building-only writes, production-worker generation propagation, reopen/barrier behavior, and partial-but-fresh coverage. |
| `pnpm test` | 80 files passed; 690 passed; 9 expected failures | Proves the Phase 2 implementation and fixture lifecycle migration introduce no unexpected repository regression while retaining later-phase contract failures. |
| `pnpm run validate:plugin` | passed | Packaged plugin and package bindings remain valid. |
| `pnpm run validate:skills` | passed; 6 owned skills, 0 errors, 0 warnings | Skill packaging remains valid. |
| `pnpm pack:dry-run` | passed; 237 entries | Distribution still includes the changed runtime, worker, and contract files. |

## Phase 3 Implementation Receipt

Phase 3 composes the Phase 2 controller and publication authority at daemon
scope, routes startup, first-read, and watcher invalidations through one
serialized trigger coordinator, and publishes one awaited diagnostics receipt.
The sole remaining expected failure is the T007 positive-orphan recovery case;
it is not counted as Phase 3 acceptance.

| Command/check | Result | Implementation evidence |
| --- | --- | --- |
| `pnpm typecheck` | passed | Shared daemon services, repository ownership, trigger generation, worker executor, diagnostics port, and health presentation compose without type errors. |
| `pnpm exec vitest run tests/runtime/operations.test.ts tests/runtime/process-workspace-change-queue.test.ts tests/runtime/workspace-change-queue.test.ts tests/mcp/integration-health-contract.test.ts tests/mcp/integration-health-resource.test.ts tests/mcp/repo-status-resource.test.ts tests/mcp/daemon-launch.test.ts tests/mcp/stdio-entrypoint.test.ts` | 8 files passed; 130 passed | Proves daemon-scoped controller reuse, atomic ownership exclusion, safe shutdown draining, autonomous watcher/startup/first-read generation coalescing, sequential duplicate reuse, structured owner refusal, exact diagnostics, controller and standalone pre-admission failure visibility, and bounded failure/redaction behavior without cross-process fixture contention. |
| `pnpm exec vitest run tests/mcp/daemon-entrypoint-integration.test.ts` | 1 file passed; 9 passed | Proves source-entrypoint daemon reuse, shared diagnostic identity, non-startup convergence, provider identity isolation, reconnect, replacement, and safe lock failure through real child processes. |
| `pnpm test` | 80 files passed; 722 passed; 1 expected T007 failure | Proves Phase 3 introduces no unexpected repository regression and leaves only the explicitly owned orphan-recovery seam. |
| `pnpm run validate:plugin` | passed | Plugin manifests, MCP bindings, and packaged hook shapes remain valid. |
| `pnpm run validate:skills` | passed; 6 owned skills, 0 errors, 0 warnings | Skill packaging remains valid. |
| `pnpm pack:dry-run` | passed; 239 entries | Distribution includes the daemon-owned controller, trigger coordinator, ownership adapter, executor, diagnostics contracts, and updated entrypoint. |
| Independent Phase 3 review | done after remediation | Initial review found seven blockers and three advisories; follow-up reviews verified autonomous watcher ownership, sequential dedupe, atomic reclaim, safe shutdown, structured public ownership evidence, complete diagnostics/redaction, fresh-startup failure handling, and pre-admission failure visibility. |
| Independent implementation review and remediation re-review | six blockers found and resolved; final verdict has no Phase 2 blockers | Closed target-ID mismatch, split publication authority, termination overlap, unpublished read leakage, missing generation CAS, freshness/publication coupling, worker generation propagation, structured allocation failure, and post-publication evidence mutability. |

## Phase 4 Recovery And Installed Acceptance Receipt

Phase 4 completes T007-T008. The recovery path distinguishes a worker that
fails before creating a build from a present build whose terminal publication
cannot be committed: the former releases its activity lease immediately, while
only the latter remains quarantined for one later ordinary request to reconcile.

| Command/check | Result | Acceptance evidence |
| --- | --- | --- |
| `pnpm typecheck` | passed | Recovery, ownership, worker, diagnostics, installed-smoke, and CI contracts compose without type errors. |
| `pnpm exec vitest run tests/graph/store.test.ts tests/runtime/operations.test.ts tests/mcp/daemon-launch.test.ts` | 105 passed before the final pre-build-failure regression was added | Proves atomic orphan reconciliation, bounded owner chains, worker protocol settlement, structured failures, and daemon cleanup. |
| `pnpm exec vitest run tests/runtime/operations.test.ts tests/mcp/stdio-entrypoint.test.ts` | 63 passed | Proves pre-build worker failure releases ownership, real worker-exit failure remains visible, and standalone shutdown is bounded. |
| `pnpm exec vitest run tests/mcp/daemon-entrypoint-integration.test.ts` | 15 passed | Includes five real daemon/worker crashes at generation, catalog, docs, graph, and post-prune pre-completion barriers, with prior publication visibility and one later successor. |
| `pnpm exec vitest run tests/mcp/repo-status-resource.test.ts tests/mcp/query-tools.test.ts tests/mcp/docs-surfaces.test.ts tests/mcp/integration-health-contract.test.ts tests/mcp/integration-health-resource.test.ts` | 67 passed | Proves exact query and trust behavior on the source/runtime surfaces. |
| `pnpm test` | 80 files passed; 741 passed; no expected failures | Proves all Spec 041 implementation seams are ordinary passing tests. |
| `node scripts/ci/install-smoke.mjs` and `node scripts/ci/mcp-launch-smoke.mjs` | passed | Retains explicitly checkout-scoped install and MCP launch coverage. |
| `CXXFLAGS=-std=c++20 node scripts/ci/installed-package-mcp-smoke.mjs` | passed | A real 0.5.2 tarball and installed bin hosted Codex- and Claude-labelled sessions on one daemon; worker invocation delta was one; exact parser reference and docs FTS hits survived; deleted symbol/docs evidence was absent; all clients, daemon, socket, metadata, and temporary roots were cleaned. `real_agent_cli_executed` remained false. |
| `pnpm run validate:plugin`; `pnpm run validate:skills`; `pnpm pack:dry-run` | passed; 6 skills with no findings; 239 package entries | Plugin bindings, skill packaging, and distribution contents remain valid. |
| Independent Phase 4 recovery review | no blockers after remediation | Verified atomic recovery, positive-death ownership, bounded cleanup, production-safe crash probes, and installed acceptance boundaries. |

## Phase 5 Promotion, Compatibility, And Closure Receipt

Phase 5 began as promotion-only work. Independent review reproduced two
unproven assumptions: the released v0.5.2 adapter could open the same migrated
SQLite path, and the daemon startup lock was visible before its JSON owner
record was complete. Closure paused until both root causes were implemented and
reviewed.

| Command/check | Result | Acceptance evidence |
| --- | --- | --- |
| `pnpm exec vitest run tests/runtime/operations.test.ts tests/runtime/workspace-change-queue.test.ts` | 51 passed | Final controller and queue contract remains green. |
| daemon launch/entrypoint focused suites | 46 passed after startup-lock remediation | A fully written/fsynced candidate is atomically hard-linked as the canonical lock; malformed non-owner evidence blocks; owner release is inode/token safe; persistence failures leave no candidate. |
| `pnpm exec vitest run tests/mcp/repo-status-resource.test.ts tests/mcp/query-tools.test.ts tests/mcp/docs-surfaces.test.ts` | 44 passed | Status, exact graph queries, and docs queries retain replacement-snapshot semantics. |
| `pnpm exec vitest run tests/mcp/integration-health-contract.test.ts tests/mcp/integration-health-resource.test.ts` | 23 passed | Authoritative diagnostic states and trust behavior remain valid. |
| `pnpm exec vitest run tests/graph/store.test.ts` | 36 passed | Covers v2 seed/migration, owner-gated retirement, atomic legacy guard, rollback artifact, crash re-entry, cleanup failures, bounded comparison, and external truncation. |
| actual tagged v0.5.2 adapter probe | exited 1 with `SQLITE_NOTADB` | `git archive v0.5.2` supplied the real legacy adapter; the non-SQLite guard blocks it from reading/mutating schema identity v2. |
| `pnpm test` | 80 files; 749 tests passed | Final integrated tree has no expected or ordinary failures. The first run exposed the startup-lock race and was not accepted as proof; this rerun followed the atomic fix. |
| `pnpm typecheck`; plugin/skill validation; package dry-run | passed; 6 skills/0 findings; unreleased 0.6.0/240 entries | Runtime, Codex, Claude, server-card, package manifests, and validation agree on 0.6.0 while install URLs remain latest released 0.5.2. |
| install and isolated MCP-launch smokes | passed | Checkout install shape and portable launcher remain valid. The initial current-repo launch correctly blocked on an active schema-v1 daemon; the isolated gate then passed without mutating that owner. |
| installed-package two-client smoke | passed for 0.6.0 | One daemon, one replacement worker, fresh shared identity, exact parser/docs hits, deleted evidence absent, complete cleanup, and `real_agent_cli_executed: false`. |
| independent Phase 5 review | no implementation blockers after remediation | Reviewed ownership, migration/rollback, crash states, startup locks, package identity, proof boundaries, and durable wording. |

### Promotion Disposition

Every candidate changed; no reasoned no-op was required.

| Candidate | Disposition |
| --- | --- |
| `docs/design/runtime-operations-design.md` | daemon controller, generations, leases, finite settlement, recovery, and EB014 boundary promoted |
| `docs/design/graph-store-design.md` | publication plus exact v2 seed, owner-gated legacy guard, rollback, and scale boundary promoted |
| `docs/design/layered-runtime-architecture.md` | narrow refresh/publication ports and composition ownership promoted |
| `docs/reference/runtime-contracts.md` | execution/publication/failure vocabulary, v2 identity, retirement consistency, and diagnostic authority promoted |
| `docs/design/mcp-surface-design.md` | bounded status/health triggers, trust, and published-query semantics promoted |
| `docs/requirements/runtime-requirements.md` | daemon lifecycle, publication, v0.5.2 block, and rollback requirements promoted |
| `docs/reference/mvp-proof-matrix.md` | controller, publication, crash, tagged-adapter, and installed proof gates promoted |
| `docs/reference/agent-readable-changelog.md` | agent-visible behavior, migration, support, and 0.6.0 availability boundary promoted |
| `docs/runbooks/install-agent-workbench.md` | diagnosis, safe ownership checks, whole-cache rollback, evidence levels, and release boundary promoted |
| `docs/runbooks/codex-agent-workbench-plugin.md` | shared refresh diagnosis, safe recovery, evidence levels, and release boundary promoted |
| `packaging/agent-workbench/README.md` | installed ownership, publication, migration/rollback, validation, and availability promoted |
| `docs/backlog/README.md` | EB052 closed by Spec 041; EB014 remains independent |
| `docs/specs/041-daemon-owned-refresh-convergence/traceability.md` | T009/T009.4 and all implementation/promotion coverage reconciled |
| `docs/history/spec-closure-log.md` | closure entry records final implementation commit and pending cleanup truthfully |
| `docs/history/spec-archive-index.md` | removed package lookup and cleanup metadata recorded truthfully |

## Residual Risks

- Provider-labelled installed MCP sessions do not prove that real Codex or
  Claude Code CLIs loaded the plugin; the receipt states this boundary.
- EB014 independently owns large-repository warm-up duration, v1 artifact copy
  scale/progress, incremental indexing, and deadline tuning; Spec 041 does not
  claim those capabilities.

## Runtime Acceptance Receipt

The combined Phase 4 installed-package smoke and focused recovery fixtures
captured bounded evidence containing:

- installed package identity, daemon PID, and two distinct provider-labelled
  client sessions, explicitly distinguished from real agent CLI execution;
- old and replacement snapshot identities;
- deleted path absent from replacement inventory;
- one execution identity and exactly one replacement worker invocation;
- exact health state/freshness/identity/failure transitions and top-level trust;
- fresh status observed by both clients;
- exact expected surviving `find_references` and `docs_search` hits from the
  replacement snapshot;
- requester disconnect, idle-lease, crash/orphan-recovery, and cleanup outcomes;
- complete client, daemon, socket, metadata, and temporary-root cleanup.

Crash/orphan, timeout, redaction, disconnect, and idle-lease outcomes come from
the focused source/daemon fixtures. Installed-bin provenance, shared-daemon
convergence, exact queries, deleted-evidence absence, and installed resource
cleanup come from the provider-labelled installed smoke.

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
