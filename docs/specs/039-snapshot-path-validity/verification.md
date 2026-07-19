---
title: Snapshot path validity verification
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

Verify Spec 039 Requirement 1, Requirement 2, Requirement 3, Requirement 4,
Requirement 5, and tasks T001-T007 using isolated
index-then-delete fixtures. Live stale snapshot evidence establishes the defect
but is not sufficient implementation or closure proof.

## Quality Gates

| Gate | Required? | Status | Evidence |
| --- | --- | --- | --- |
| Failing defect fixtures captured | yes | passed | Four initial regressions failed at the intended seams before implementation. |
| Shared validity/freshness contract reviewed | yes | passed | Contract, first-read, and independent reviewer evidence. |
| Graph tools return bounded stale/degraded envelopes | yes | passed | Shared receipt gates plus query-specific race preflight and classifier coverage. |
| Docs removal is transactionally consistent | yes | passed | File/graph/docs/headings/FTS/coverage, idempotence, and orphan tests. |
| Budget and no-fallback boundaries pass | yes | passed | Valid/missing/inaccessible/budget fixtures; bounded concurrency; no retry/fallback. |
| Focused and full automated tests pass | yes | passed | Nine focused files / 109 tests and final 80-file / 610-test run passed. |
| Durable documentation promoted | yes | passed | Graph store, runtime operations, MCP surface, runtime contracts, changelog. |
| Lifecycle review and closure checks pass | yes | passed | Task audit passed; lifecycle lint has no errors and one waived authoring warning was resolved. |

## Validation Commands

| Command | Purpose | Result |
| --- | --- | --- |
| `pnpm exec vitest run tests/runtime/snapshot-path-validity.test.ts tests/runtime/process-workspace-change-queue.test.ts tests/contracts/runtime-contracts.test.ts tests/mcp/repo-status-resource.test.ts tests/graph/query-tools.test.ts tests/graph/store.test.ts tests/graph/extraction-pipeline.test.ts tests/docs/fts-docs-search-fixtures.test.ts tests/mcp/query-tools.test.ts` | Focused validity, persistence, docs, and public-surface coverage | passed: 9 files / 109 tests |
| `pnpm typecheck` | Contract and implementation types | passed |
| `pnpm validate:plugin` | Packaged integration regression | passed |
| `pnpm test` | Full regression suite | passed: 80 files / 610 tests |
| Spec Lifecycle Manager `lint_spec_package` | Package structure and traceability | passed: 0 errors after adding the explicit Open Questions disposition |
| `git diff --check` | Diff hygiene | passed |

## Requirement And Property Coverage

| Requirement/property | Planned evidence | Residual risk |
| --- | --- | --- |
| Requirement 1 / CP-001 / CP-005 | Valid, deleted, inaccessible, and budget-exhausted receipts | Choice of reusable catalog generation signal remains to be proven. |
| Requirement 2 / CP-002 | Same-snapshot orientation/status/context/docs/graph comparison | Scan completeness must stay separate. |
| Requirement 3 / CP-003 | Deleted-node and unexpected-provider golden envelopes | Whole-program semantic completeness remains out of scope. |
| Requirement 4 / CP-004 | SQLite removal transaction, counts, inventory, and FTS results | Migration need is evidence-dependent. |
| Requirement 5 | Budget/cache/compatibility/architecture tests | Large-repo cost must remain bounded. |

## Agent Readiness Evidence

| Field | Evidence | Residual risk |
| --- | --- | --- |
| Scope | Snapshot validity, public freshness, graph stale behavior, docs pruning | Implemented and validated. |
| Out of scope | Parser/scanner fallbacks, inline rebuild, root policy, restoring specs | none |
| Permissions | Repository code/tests/docs only | Installed runtime changes need separate authority. |
| Validation | Commands above plus task-specific fixtures | Exact focused filenames may evolve with implementation. |
| Review | Architecture and data-consistency review required | Cross-layer change. |
| Closure impact | Promote to graph/runtime/MCP/contracts/backlog/changelog/history | durable owners promoted; history cleanup follows final spec commit |

## Evidence Log

| Date | Evidence | Result | Notes |
| --- | --- | --- | --- |
| 2026-07-19 | Live orientation/status/context and Git deletion evidence | defect confirmed | Snapshot `1783312125057` retained seven files deleted by `c90769b`. |
| 2026-07-19 | Direct source mapping | root causes bounded | Persisted freshness trust, separate task-context default, stale path reads, and incomplete docs pruning identified. |
| 2026-07-19 | Requirements/design/task/traceability review | package reconciled | Verification gates reflect the final initial design and task split. |
| 2026-07-19 | Focused validity/status/graph/store/docs/MCP tests | passed | Nine files / 109 tests cover receipt, replacement refresh, shared graph gating, docs-first inventory, idempotent coverage, and extraction compatibility. |
| 2026-07-19 | Independent architecture/data review | findings corrected | Snapshot-specific receipt selection and absolute-path redaction were added to the earlier graph, refresh, concurrency, and orphan corrections. |
| 2026-07-19 | Final full regression | passed | `pnpm test`: 80 files / 610 tests. |

## Residual Risks

- Bounded validation remains O(N) up to 2,000 indexed paths and uses concurrency
  32. Valid-receipt caching remains prohibited until a material generation can
  detect pre-watcher deletions.
- Read paths must not mutate historical snapshots through several coordinators.
- Graph coverage completeness and filesystem freshness must remain distinct.

## Durable Promotion And Cleanup

| Spec content | Durable destination | Status |
| --- | --- | --- |
| snapshot validity and refresh semantics | runtime operations; runtime contracts | promoted |
| persistence/removal invariants | graph store design | promoted |
| graph stale/degraded behavior | MCP surface design; runtime contracts | promoted |
| agent-visible behavior | agent-readable changelog | promoted |
| completion/residual routing | backlog and history records | ready for closure cleanup |

## Readiness Decision

- **Ready for implementation:** implementation complete
- **Ready for promotion:** yes; promoted
- **Ready for closure:** yes; final spec commit and closure cleanup remain

## Related Artifacts

- Requirements: `requirements.md`
- Change impact: `change-impact.md`
- Design: `design.md`
- Tasks: `tasks.md`
- Traceability: `traceability.md`
