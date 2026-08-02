---
title: Large-repository graph completion verification
doc_type: spec
artifact_type: verification
status: draft
owner: platform
last_reviewed: 2026-08-02
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Verification

## Scope

EB014 verification covers truthful bounded-run accounting, deterministic admission
ordering, durable continuation semantics, atomic publication safety, trust
propagation, and debug sweep completion parity.

## Quality Gates

| Gate | Required? | Status | Evidence |
| --- | --- | --- | --- |
| Requirements and design MoE | yes | passed | Prior reviews completed; implementation-review blockers were addressed in this phase. |
| Traceability and scope readiness | yes | passed | `traceability.md` maps all requirements and implementation owners. |
| Implementation evidence | yes | passed | Typecheck, focused tests, full suite and two Rails sweeps recorded below. |
| Regression coverage | yes | passed | Scanner, graph continuation, runtime, debug and Ruby/Rails suites pass. |
| Closure readiness | yes | passed | T008 final senior review and lifecycle closure checks complete. |

## Planned Validation Commands

These are planned for implementation and will be recorded as completed in a follow-up
phase:

- `pnpm test tests/application/index-repository-graph.test.ts`
- `pnpm test tests/infra/tree-sitter/**` (targeted bounded extraction slice)
- `pnpm test tests/debug/**` (debug sweep completion behavior)
- `pnpm typecheck`

## Requirement Coverage

| Requirement | Coverage plan | Status | Residual risk |
| --- | --- | --- | --- |
| Requirement 1 | run-state, coverage, generation and cross-slice resolution assertions | passed | none identified |
| Requirement 2 | exact and pattern priority ordering plus continuation stability | passed | richer glob syntax is out of scope |
| Requirement 3 | durable owner/status/generation/target ledger and replay rejection | passed | cancellation remains an internal runtime operation |
| Requirement 4 | queryable partial seed, hidden completion target and atomic seed clone | passed | none identified |
| Requirement 5 | additive partial/complete coverage metadata and published-selection tests | passed | none identified |
| Requirement 6 | debug path loops production slices through completion | passed | none identified |
| Requirement 7 | full suite, prior gerald run, and fresh two-repository Rails sweep | passed | real repositories do not cover every fixture-backed route form |

## Evidence log

| Date | Evidence | Result | Notes |
| --- | --- | --- | --- |
| 2026-08-02 | Pre-implementation evidence scan | baseline confirmed | Debug max cap, warmup partial gap, priority-path ordering bug, completion trust drift confirmed in-session. |
| 2026-08-02 | T003-T006: `pnpm typecheck` | pass | Explicit owner propagation and migrated ledger typecheck cleanly. |
| 2026-08-02 | T003, T007: focused scanner/Ruby extraction suite | 62 passed | Engine route and route-fragment admission remains stable across bounded continuation. |
| 2026-08-02 | T004-T008: focused storage/runtime/debug/Rails suite | 153 passed | Durable continuation, publication, route-shape and debug completion paths pass. |
| 2026-08-02 | T007: `pnpm test -- --maxWorkers=4` | pass | Full Vitest regression suite passed after isolated load-sensitive timeout confirmation. |
| 2026-08-02 | T006-T007: two Rails MCP sweeps, 100-file slices | pass | 47 full, 3 partial, 4 intentional degraded, 0 blocked, 0 invalid; final graphs 265/265 and 194/194 complete. |

## Promotion Targets

| Durable target | Promotion condition | Status | Evidence required |
| --- | --- | --- | --- |
| `docs/reference/runtime-contracts.md` | Update completion/trust semantics only after bounded evidence. | complete | Requirements 1 and 5 evidence |
| `docs/design/mcp-surface-design.md` | Align MCP-facing partial/complete response and presentation metadata with continuation behavior. | complete | Requirements 1 and 5 evidence |
| `docs/backlog/README.md` | Mark EB014 stage and residuals. | complete | Requirements 7 evidence and review |
| `docs/reference/dogfood-evidence-ledger.md` | Record bounded run evidence and limitations. | complete | Rails sweep receipt below |

## Residual Risks

- The spec assumes existing debug tooling can be aligned to continuation persistence
  without introducing parser or transport changes.
- Priority reordering correctness depends on stable path normalization and path-matching
  policy.
- Continuation generation checks require repository-generation markers in each run; stale
  time windows are no longer part of the design.
