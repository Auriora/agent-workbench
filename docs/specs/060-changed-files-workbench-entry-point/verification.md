---
title: Changed-files Workbench entry point verification
doc_type: spec
artifact_type: verification
status: active
owner: platform
last_reviewed: 2026-08-06
---

# Verification

## Scope

Requirements 1-4 and tasks T001-T006 for the read-only
`changed_files_context` packet.

## Quality Gates

| Gate | Required? | Status | Evidence |
| --- | --- | --- | --- |
| Requirements and design reviewed | yes | pass | Lifecycle lint has no errors; one waivable canonical-context advisory remains. |
| Task evidence complete | yes | pass | T001-T006 have concrete implementation, validation, and promotion evidence. |
| Focused and full automated tests pass | yes | pass | Focused suites passed; `pnpm vitest run --maxWorkers=2` passed 1,338 tests in 123 files. |
| Typecheck passes | yes | pass | `pnpm typecheck` passed. |
| Plugin, skill, and package checks pass | yes | pass | `validate:plugin`, `validate:skills`, and `pack:dry-run` passed. |
| Correctness and security/operations review complete | yes | pass | Initial findings fixed; targeted reviewer follow-ups found no remaining blocker. |
| Durable documentation promoted | yes | pass | Runtime requirements, edit/validation design, runtime contracts, integration design, and backlog updated. |
| Lifecycle closure checks pass | yes | pending | |

## Validation Commands

| Command | Purpose | Result | Evidence |
| --- | --- | --- | --- |
| `pnpm vitest run <focused files>` | Contract, Git, application, presenter, MCP, and integration behavior | pass | 46 focused application, MCP, Codex, and stdio tests passed in the final focused run. |
| `pnpm typecheck` | TypeScript contract and dependency integrity | pass | No TypeScript errors. |
| `pnpm test` | Full regression suite | scheduler-sensitive | Unbounded run passed 1,322 and timed out/raced in 14 unrelated tests; bounded rerun passed all 1,338. |
| `pnpm vitest run --maxWorkers=2` | Full suite with bounded scheduler pressure | pass | 123 files and 1,338 tests passed. |
| `pnpm validate:plugin` | Packaged integration metadata | pass | Plugin/package validation passed. |
| `pnpm validate:skills` | Packaged skill consistency | pass | Six owned skills checked with zero errors and warnings. |
| `pnpm pack:dry-run` | Package payload | pass | Package dry-run produced the 0.6.7 payload including the new source files. |

## Requirement Coverage

| Requirement | Acceptance criteria covered | Evidence | Residual risk |
| --- | --- | --- | --- |
| Requirement 1 | AC1-AC3 | Git adapter and malformed/overflow path tests | platform Git variation |
| Requirement 2 | AC1-AC4 | application state matrix, presenter, MCP, and full suite | provider combinations |
| Requirement 3 | AC1-AC2 | observational input contract and no lifecycle writer dependency | caller-supplied context truthfulness |
| Requirement 4 | AC1-AC3 | registry, server card, Codex/Claude/Kiro guidance, and plugin tests | client display variation |

## Correctness Property Coverage

| Property | Covered by | Evidence | Residual risk |
| --- | --- | --- | --- |
| CP-001 | T001 tests | sorted category, malformed path, and Git-first bound tests pass | platform Git variation |
| CP-002 | T002 state matrix | ready, no-change, degraded, and blocked outcomes tested | provider timing combinations |
| CP-003 | contract and MCP tests | planned commands remain unexecuted | none known |
| CP-004 | dependency and behavior tests | lifecycle input is copied observationally with no writer dependency | external caller truthfulness |

## Scope Reconciliation Before Closure

| Broad requirement, design target, or review finding | Implemented in this spec | Coverage state | Deferred or rejected work | Destination | Blocks closure? | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| Public changed-files entry point | yes | covered | none | none | no | focused and full validation |
| Automatic client hook invocation | no | out-of-scope | portable hook intent remains separate | EB016 | no | design boundary |
| Review and acceptance verdicts | no | out-of-scope | proof/review workflow remains separate | EB025/EB030 | no | design boundary |

## Agent Readiness Evidence

| Field | Evidence | Residual risk |
| --- | --- | --- |
| Scope and out-of-scope files | requirements and design slice boundary | none |
| Must-read context | full Spec 060 package plus durable baseline | stale context if not reread |
| Permissions and approval points | user authorized implementation; no external writes or release | publishing remains unauthorized |
| Validation commands | table above and repository AGENTS.md | environment-specific native failures |
| Review needs | correctness plus security/operations after runnable implementation | reviews completed; findings fixed and rechecked |
| Durable-doc or closure impact | durable impact table | promotion complete; closure pending |
| Repo-evidence caveats | Agent Workbench routing requires direct reads and executed checks | direct reads and executed checks recorded |

## Task Evidence

| Task ID | Status | Evidence | Notes |
| --- | --- | --- | --- |
| T001 | complete | additive contracts, Git category adapter, and focused tests | |
| T002 | complete | application state orchestration and presenter tests | |
| T003 | complete | public MCP registration, root authority, trust, and registry tests | |
| T004 | complete | common metadata and Codex/Claude/Kiro guidance tests | |
| T005 | complete | focused/full gates and two independent reviews | unbounded suite is scheduler-sensitive |
| T006 | complete | durable docs and backlog promoted; promotion plan has zero missing targets | package cleanup and commit-backed closure log remain unexecuted |

## Evidence Log

| Date | Evidence | Result | Notes |
| --- | --- | --- | --- |
| 2026-08-06 | lifecycle guide, scan, preflight, ID inventory, and creation plan | ready with legacy duplicate-034 warning | Spec 060 path was absent and provisional allocation was revalidated. |
| 2026-08-06 | focused tests, typecheck, plugin/skill/package checks | pass | Final focused run passed 46 tests; all packaging gates passed. |
| 2026-08-06 | full Vitest suite | pass with bounded workers | Unbounded concurrency produced 14 timeout/race failures; `--maxWorkers=2` passed 1,338/1,338. |
| 2026-08-06 | correctness and security/operations reviews plus follow-ups | pass | All reported findings were fixed and confirmed resolved. |

## Residual Risks

- Git category behavior varies across platforms and partially staged files.
- Aggregation adds latency even though every component remains bounded.
- Installed clients may not naturally adopt the new workflow until guidance is
  packaged and dogfooded.

## Durable Promotion And Cleanup

| Spec content | Durable destination or deferral | Status | Evidence |
| --- | --- | --- | --- |
| Requirements | `docs/requirements/runtime-requirements.md` | promoted | REQ-032 |
| Technical design | `docs/design/edit-and-validation-loop-design.md` | promoted | Changed-files workflow and state boundary |
| Contracts | `docs/reference/runtime-contracts.md` | promoted | Changed-Files Context section and tool class |
| Integration workflow | `docs/design/coding-agent-integration-design.md` | promoted | Provider first-action guidance |
| Follow-up work | `docs/backlog/README.md` | promoted | EB044 delivery and residual routing |

### Spec Cleanup Decision

- **Cleanup action:** remove after promotion and closure evidence
- **Reason:** temporary implementation scaffolding
- **Final spec commit:** pending
- **Closure log path:** `docs/history/spec-closure-log.md`
- **Closure log entry updated:** no
- **Closure cleanup commit:** pending
- **Active indexes updated:** no
- **Durable docs linked back to evidence where useful:** no
- **Residual spec-only content:** none expected

## Ship Or Closure Risk

- **Risk level:** medium
- **Breaking change:** no
- **Blast radius checked:** yes
- **Rollback path:** remove additive tool and contract registrations
- **Requires human review:** yes
- **Release notes needed:** yes
- **Follow-up issue or spec needed:** no known blocker

## Readiness Decision

- **Ready for promotion:** yes
- **Ready for release:** no
- **Ready for closure:** yes, subject to authorized commit and package cleanup

## Related Artifacts

- Requirements: `requirements.md`
- Design: `design.md`
- Tasks: `tasks.md`
- Traceability: `traceability.md`
