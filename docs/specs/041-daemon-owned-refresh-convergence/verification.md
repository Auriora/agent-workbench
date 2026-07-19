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
live package-entrypoint convergence.

This record covers Requirements 1-6, CP-001-CP-006, and T001-T007 for the
daemon-owned refresh convergence slice.

## Quality Gates

| Gate | Required? | Status | Evidence |
| --- | --- | --- | --- |
| Requirements and correctness properties reviewed | yes | pending | |
| Task acceptance and evidence complete | yes | pending | |
| Focused and full automated tests pass | yes | pending | |
| Package/plugin/skill gates pass | yes | pending | |
| Durable documentation promoted | yes | pending | |
| Lifecycle reconciliation and closure risk complete | yes | pending | |

## Focused Verification

| ID | Check | Proves | Status |
| --- | --- | --- | --- |
| V001 | focused controller/runtime tests | one planned/running execution and no automatic retry | pending |
| V002 | `tests/mcp/daemon-entrypoint-integration.test.ts` two-client deletion case | non-startup trigger, one worker, shared fresh convergence | pending |
| V003 | repeated concurrent stale status reads | idempotent request and single writer | pending |
| V004 | requester disconnect plus idle-grace case | execution survives socket loss and daemon remains owner | pending |
| V005 | daemon-launch/integration-health failure transitions | real planned/running/complete/failed and bounded last failure | pending |
| V006 | health schema, presenter, and resource tests | canonical warm-up/freshness enums; no terminal scheduled/unknown | pending |
| V007 | status replacement-snapshot tests | identity advances and both clients become fresh | pending |
| V008 | graph-store publication/removal tests | deleted rows removed atomically | pending |
| V009 | query-tool and docs-surface tests | `find_references` and `docs_search` usable after replacement | pending |
| V010 | worker/SQLite/permission failure fixtures | structured failed state, non-fresh evidence, no raw output | pending |
| V011 | architecture/negative assertions | no manual tool, second executor, provider branch, or fallback | pending |

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

## Requirement Coverage

| Requirement | Criteria | Evidence | Residual risk |
| --- | --- | --- | --- |
| Requirement 1 | AC1.1-AC1.4 | pending | not covered |
| Requirement 2 | AC2.1-AC2.4 | pending | not covered |
| Requirement 3 | AC3.1-AC3.4 | pending | not covered |
| Requirement 4 | AC4.1-AC4.4 | pending | not covered |
| Requirement 5 | AC5.1-AC5.4 | pending | not covered |
| Requirement 6 | AC6.1-AC6.4 | pending | not covered |

## Correctness Property Coverage

| Property | Covered by | Evidence | Residual risk |
| --- | --- | --- | --- |
| CP-001 | T001-T003; V001-V003 | pending | not covered |
| CP-002 | T001, T003, T006; V002, V004 | pending | not covered |
| CP-003 | T001, T003, T006; V004 | pending | not covered |
| CP-004 | T002, T006; V007-V009 | pending | not covered |
| CP-005 | T001, T005-T006; V005-V006 | pending | not covered |
| CP-006 | T001-T002, T005-T006; V003, V010-V011 | pending | not covered |

## Task Evidence

| Task | Status | Evidence | Notes |
| --- | --- | --- | --- |
| T001-T007 | pending | | Update each task separately during implementation. |

## Evidence Log

| Date | Evidence | Result | Notes |
| --- | --- | --- | --- |
| 2026-07-19 | Spec intake and repository architecture inspection | pending | Defines the plan; does not prove implementation. |
| 2026-07-19 | Independent spec review and lifecycle readiness reconciliation | done | Made incomplete replacement publication explicit implementation work and separated complete planning traceability from pending implementation evidence. |

## Residual Risks

- Package-entrypoint refresh convergence is not implemented or verified yet.
- Async authoritative diagnostics may require additive composition changes;
  compatibility must be proven by schema and presenter fixtures.
- Daemon crash during active publication relies on existing atomic store and
  positive-evidence replacement rules; T006 must verify no ownership split.
- EB014 large-repository warm-up duration remains outside this slice.

## Runtime Acceptance Receipt

Before closure, capture bounded package-entrypoint evidence containing:

- daemon PID and two distinct client/provider sessions;
- old and replacement snapshot identities;
- deleted path absent from replacement inventory;
- one execution identity and its state transitions;
- health graph freshness and failure field transitions;
- fresh status observed by both clients;
- successful post-refresh `find_references` and `docs_search` envelopes;
- requester disconnect outcome;
- confirmation that no raw SQLite/worker output escaped.

## Closure Conditions

- Every requirements criterion and correctness property has reproducible
  evidence.
- Traceability contains no `not-covered` row.
- Durable promotions are complete and current.
- Deferred EB014 work remains explicitly separate.
- Backlog, changelog, and closure history identify implementation and closure
  commits truthfully.
