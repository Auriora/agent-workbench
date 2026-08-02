---
title: Rails routing concern identity verification
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

Spec 050 parser-backed routing concern identity, graph relationships, query
integration, regression safety, bounded dogfood evidence, and promotion.

## Quality Gates

| Gate | Required? | Status | Evidence |
| --- | --- | --- | --- |
| Requirements and design MoE | yes | complete | Findings dispositioned in T001. |
| Implementation-plan MoE | yes | complete | Architecture ready; QA and lifecycle warnings amended and confirmed resolved. |
| Task evidence complete | yes | complete | T001-T006 complete with concrete evidence. |
| Automated validation | yes | complete | Focused, broader, full, typecheck, and patch hygiene pass. |
| Durable promotion | yes | complete | Five named owners updated in T005. |
| Implementation MoE | yes | complete | Architecture, requirements/QA, and lifecycle findings resolved. |
| Cleanup decision | yes | pending | User has not requested closure. |

## Validation Commands

| Command | Purpose | Result | Evidence |
| --- | --- | --- | --- |
| `pnpm vitest run tests/adapters/ruby-parser.test.ts tests/graph/ruby-semantic-extraction.test.ts tests/mcp/context-for-task-tool.test.ts --maxWorkers=4` | Focused parser, graph, and context behavior | pass, 54/54 | T002-T004 |
| Broader 17-file Ruby/Rails-adjacent Vitest slice with `--maxWorkers=4` | Ruby/Rails regressions | pass, 260/260 | T005 |
| `pnpm typecheck` | Type integrity | pass | T005 |
| `pnpm test -- --maxWorkers=4` | Full regression suite | pass, 1176/1176 | T005 |
| `git diff --check` | Patch hygiene | pass | T005 |
| `pnpm debug:mcp-tool-sweep -- --repo <rails-app> --repo <rails-starter> --output-dir .tmp/spec050-dogfood-warm --start-graph-warmup --include-raw` | Two read-only Rails project shapes | pass with bounded partial/degraded surfaces; zero blocked/invalid | T005 |

## Requirement Coverage

| Requirement | Acceptance criteria covered | Evidence | Residual risk |
| --- | --- | --- | --- |
| Requirement 1 | AC1-AC4 | T002-T003 parser/graph identity and unsupported-form tests | none |
| Requirement 2 | AC1-AC5 | T002-T003 unique/missing/duplicate/mixed/resource-option tests, including ordinary resource-edge preservation | unsupported runtime forms routed to EB010 |
| Requirement 3 | AC1-AC3 | T002-T004 scope metadata and two-edge provenance assertions | bounded static composition only |
| Requirement 4 | AC1-AC4 | T003-T004 existing reference, impact, and task-context path tests | no whole-program claim |
| Requirement 5 | AC1-AC3 | T002-T004 nested/cyclic finite relationships and existing parser failure regression | no runtime route expansion |

## Correctness Property Coverage

| Property | Covered by | Evidence | Residual risk |
| --- | --- | --- | --- |
| CP-001 | T002-T003 | Source-distinct qualified names and duplicate nodes | none |
| CP-002 | T002-T004 | Unique edge plus missing/duplicate unresolved cases | none |
| CP-003 | T002-T004 | Scope metadata and incoming/outgoing edge provenance | static scopes only |
| CP-004 | T002-T003 | Duplicate declarations yield candidate count two and no hard edge | none |
| CP-005 | T002-T004 | Cyclic concern fixture yields exactly two finite edges | relationships only |
| CP-006 | T003-T005 | Code diff, typecheck, and 1176-test full suite | none |

## Scope Reconciliation Before Closure

| Broad requirement, design target, or review finding | Implemented in this spec | Coverage state | Deferred or rejected work | Destination | Blocks closure? | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| Requirement 1 | T002-T003 | complete | none | none | no | Source-distinct declaration and non-route guard tests pass in the 54-test focused suite |
| Requirement 2 | T002-T003 | complete | none | none | no | Direct, array, option, mixed, missing, and duplicate cases pass in the 54-test focused suite |
| Requirement 3 | T002-T004 | complete | none | none | no | Scoped incoming reuse and outgoing declaration edge assertions pass |
| Requirement 4 | T003-T004 | complete | none | none | no | Public `findReferences`, `computeImpact`, and task-context assertions pass |
| Requirement 5 | T002-T004 | complete | none | none | no | Finite cycle assertions and unchanged parser-failure regression pass |
| Routing concern identity and static reuse | T002-T004 | complete | none | none | no | 54 focused tests and source diff |
| Callable, computed, and runtime concern semantics | none | out-of-scope | Explicitly excluded | EB010 | no | requirements/design |
| Pre-existing reopened class/module node collision | none | out-of-scope | Concern nodes use source-distinct identity | EB010 | no | design MoE |
| Pre-existing Ruby overview blocked-reason label | none | out-of-scope | Diagnostics wording is unrelated to this parser/graph slice | product backlog | no | design MoE |

## Agent Readiness Evidence

| Field | Evidence | Residual risk |
| --- | --- | --- |
| Scope | Parser, resolver, focused fixture/tests only | No schema/query surface change. |
| Required context | Requirements, design, traceability, affected source/tests | Refreshed before T002 and implementation review. |
| Permissions | Workbench writes and read-only adjacent dogfood only | No target writes. |
| Validation | Focused tests, typecheck, full suite, diff check, dogfood | Complete; commands and counts recorded above. |
| Review | Architecture, requirements/QA, and lifecycle implementation MoE | Complete; all findings resolved or scoped. |
| Promotion | Five named durable owners | Complete in T005. |

## Task Evidence

| Task ID | Status | Evidence | Notes |
| --- | --- | --- | --- |
| T001 | complete | Requirements and design MoE dispositions | No blocker. |
| T002 | complete | 54 focused and 260 broader tests | Fixture-backed route-domain, forms, missing/ambiguity, and scope. |
| T003 | complete | Parser/resolver diff, typecheck, focused/full suites | One tree-sitter graph path. |
| T004 | complete | Graph and task-context assertions | Two-edge provenance and ranked identity. |
| T005 | complete | Full 1176 tests, two final warm sweeps, five durable docs | Real repos contain no concern syntax. |
| T006 | complete | Three-role implementation MoE and post-fix reruns | No unresolved blocker. |

## Evidence Log

| Date | Evidence | Result | Notes |
| --- | --- | --- | --- |
| 2026-08-02 | Requirements MoE over `README.md` and `requirements.md` by requirements/QA and lifecycle roles | complete | Literal syntax B1, task-context B2, and dogfood-naming W1 amended; both reviewers confirmed resolution. |
| 2026-08-02 | Design MoE over design-stage artifacts by architecture, requirements/QA, and lifecycle roles | complete | Multi-hop provenance B1, task-context seam W1, direct operands S1, and stale stage wording amended and confirmed resolved; unrelated reopened-class and overview-label warnings scoped out. |
| 2026-08-02 | Focused and broader automated validation after implementation-review fixes | pass | 54/54 focused, 260/260 broader, typecheck and diff check pass. |
| 2026-08-02 | Full Vitest suite after implementation-review fixes | pass | 106 files and 1176/1176 tests. |
| 2026-08-02 | Two-project warm-graph dogfood | pass with limits | 47 full, 3 partial, 4 intentional degraded, zero blocked/invalid; 265/265 and 194/194 graph coverage. |
| 2026-08-02 | Implementation MoE and re-review | complete | Non-route capture blocker, scope/missing/public-query warnings, and lifecycle drift fixed; reviewers confirmed resolution. |

## Manual Or External Verification

Two adjacent Rails project shapes were scanned read-only through isolated warm
graphs. They produced 592 and 362 Ruby nodes, 725 and 402 Ruby-origin edges,
and unchanged 41 and 16 resolved route edges. Neither repository contains
`concern` or `concerns` route syntax, so real-project evidence proves regression
safety only; fixture tests prove the new forms. Both target worktrees were clean
before and after, and no target project command ran.

## Residual Risks

- Static evidence cannot prove Rails runtime route availability or option
  composition; EB010 retains that work.

## Durable Promotion And Cleanup

| Spec content | Durable destination or deferral | Status | Evidence |
| --- | --- | --- | --- |
| Adapter behavior | `docs/design/language-adapter-design.md` | promoted | T005 |
| Capability | `docs/reference/language-capability-matrix.md` | promoted | T005 |
| Agent-visible change | `docs/reference/agent-readable-changelog.md` | promoted | T005 |
| Residual work | `docs/backlog/README.md` EB010 | promoted | T005 |
| Dogfood | `docs/reference/dogfood-evidence-ledger.md` | promoted | T005 |

### Spec Cleanup Decision

- **Cleanup action:** keep active
- **Reason:** implementation and user closure decision pending
- **Final spec commit:** pending
- **Closure log entry updated:** no

## Ship Or Closure Risk

- **Risk level:** medium
- **Breaking change:** no
- **Blast radius checked:** yes; broader/full suites and two Rails graphs
- **Rollback path:** revert uncommitted slice or later focused commit
- **Requires human review:** yes; implementation-plan and implementation MoE
- **Release notes needed:** no
- **Follow-up issue or spec needed:** no; EB010 owns residuals

## Readiness Decision

- **Ready to implement:** yes; implementation-plan MoE has no unresolved blocker
- **Ready for promotion:** yes; durable promotion is complete
- **Ready for release:** no
- **Ready for closure:** no; closure was not requested and commit evidence is pending

The final design reconciliation was reviewed against this evidence on
2026-08-02; no validation command, coverage disposition, or residual changed.

## Related Artifacts

- Requirements: `requirements.md`
- Change Impact: `change-impact.md`
- Design: `design.md`
- Tasks: `tasks.md`
- Traceability: `traceability.md`
