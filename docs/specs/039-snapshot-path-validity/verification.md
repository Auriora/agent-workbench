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
| Failing defect fixtures captured | yes | pending | T001 |
| Shared validity/freshness contract reviewed | yes | pending | T001-T003 |
| Graph tools return bounded stale/degraded envelopes | yes | pending | T004 |
| Docs removal is transactionally consistent | yes | pending | T005 |
| Budget and no-fallback boundaries pass | yes | pending | T002, T006 |
| Focused and full automated tests pass | yes | pending | T006 |
| Durable documentation promoted | yes | pending | T007 |
| Lifecycle review and closure checks pass | yes | pending | T007 |

## Validation Commands

| Command | Purpose | Result |
| --- | --- | --- |
| `pnpm exec vitest run tests/runtime tests/graph tests/docs tests/mcp/repo-status-resource.test.ts tests/mcp/repo-orientation-resource.test.ts tests/mcp/context-for-task-tool.test.ts tests/mcp/query-tools.test.ts` | Focused validity, persistence, docs, and public-surface coverage | pending |
| `pnpm typecheck` | Contract and implementation types | pending |
| `pnpm validate:plugin` | Packaged integration regression | pending |
| `pnpm test` | Full regression suite | pending |
| Spec Lifecycle Manager `lint_spec_package` | Package structure and traceability | pending |
| `git diff --check` | Diff hygiene | pending |

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
| Scope | Snapshot validity, public freshness, graph stale behavior, docs pruning | No implementation started. |
| Out of scope | Parser/scanner fallbacks, inline rebuild, root policy, restoring specs | none |
| Permissions | Repository code/tests/docs only | Installed runtime changes need separate authority. |
| Validation | Commands above plus task-specific fixtures | Exact focused filenames may evolve with implementation. |
| Review | Architecture and data-consistency review required | Cross-layer change. |
| Closure impact | Promote to graph/runtime/MCP/contracts/backlog/changelog/history | pending |

## Evidence Log

| Date | Evidence | Result | Notes |
| --- | --- | --- | --- |
| 2026-07-19 | Live orientation/status/context and Git deletion evidence | defect confirmed | Snapshot `1783312125057` retained seven files deleted by `c90769b`. |
| 2026-07-19 | Direct source mapping | root causes bounded | Persisted freshness trust, separate task-context default, stale path reads, and incomplete docs pruning identified. |
| 2026-07-19 | Requirements/design/task/traceability review | package reconciled | Verification gates reflect the final initial design and task split. |

## Residual Risks

- An O(N) validity check on every read would violate first-read goals; caching
  must remain correct under pre-watcher deletions.
- Read paths must not mutate historical snapshots through several coordinators.
- Graph coverage completeness and filesystem freshness must remain distinct.

## Durable Promotion And Cleanup

| Spec content | Durable destination | Status |
| --- | --- | --- |
| snapshot validity and refresh semantics | runtime operations; runtime contracts | pending |
| persistence/removal invariants | graph store design | pending |
| graph stale/degraded behavior | MCP surface design; runtime contracts | pending |
| agent-visible behavior | agent-readable changelog | pending |
| completion/residual routing | backlog and history records | pending |

## Readiness Decision

- **Ready for implementation:** yes, after T001 locks the failing contract
  fixtures and resolves the catalog-generation reuse question.
- **Ready for promotion:** no
- **Ready for closure:** no

## Related Artifacts

- Requirements: `requirements.md`
- Change impact: `change-impact.md`
- Design: `design.md`
- Tasks: `tasks.md`
- Traceability: `traceability.md`
