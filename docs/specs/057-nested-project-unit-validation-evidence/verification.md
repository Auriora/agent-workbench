---
title: Nested project-unit validation evidence verification
doc_type: spec
artifact_type: verification
status: draft
owner: platform
last_reviewed: 2026-08-04
---

# Verification

## Scope

This record covers future implementation of T001-T013: additive unit evidence,
selected-scope discovery, explicit marker recognition, unit-specific readiness,
broken-Git claim separation, submodule boundary detection, planner/MCP
integration, the mixed-language fixture, durable promotion, and closure review.
It never authorizes execution of commands in fixture or target repositories.

## Quality Gates

| Gate | Required? | Status | Evidence |
|------|-----------|--------|----------|
| G1 Contract and compatibility | yes | passed | T001 additive schema remains compatible; T008 presenter and parser integration passed focused contract/MCP tests |
| G2 Unit discovery, markers, readiness, and determinism | yes | passed | T002-T005 focused suite passed 33 tests; typecheck and diff check passed |
| G3 Broken Git claim separation | yes | passed | T006 workspace-only Git metadata tests preserve source evidence and block unavailable claims |
| G4 Repository-boundary confinement | yes | passed | T007 tests prove no traversal, URL access, or submodule action |
| G5 Mixed-language application and MCP regression | yes | passed | T008/T009 focused planner, contract, presenter, and fixture suite passed 108 tests across 8 files |
| G6 Independent implementation review | yes | passed | Blocking policy-command finding and both re-review warnings resolved; 83 affected tests, typecheck, and diff check passed |
| G7 Full repository and package regression | yes | passed | 116 files/1,288 tests, typecheck, plugin/skills validation, package dry-run, and diff check passed |
| G8 Durable documentation and follow-up routing | yes | passed | T012 promoted five durable owners; docs tests passed 10 tests; existing Spec 058 is the one residual destination |
| G9 Closure-scope reconciliation | yes | in progress | T013 task/evidence/package audits have no error; final closure check follows task completion |

## Validation Commands

These commands validate Agent Workbench implementation. They do not execute
anything inside the mixed-language fixture or an external target repository.
Exact focused test paths may be refined by T001-T009 when new test files are
created.

| Command | Purpose | Result | Evidence |
|---------|---------|--------|----------|
| `pnpm exec vitest run tests/contracts/validation-status-evidence.test.ts` | Validate additive contract and compatibility behavior. | passed | G1 |
| `pnpm exec vitest run tests/application/validation-planner-rules.test.ts tests/mcp/verification-plan-tool.test.ts` | Validate project-unit planning and MCP presentation. | passed within focused 108-test set | G2, G5 |
| `pnpm typecheck` | Validate TypeScript contracts and layer integration. | passed after review fix | G1, G2, G5 |
| `pnpm test` | Run the complete regression suite. | passed, 116 files and 1,288 tests | G7 |
| `pnpm validate:plugin` | Validate packaged MCP/plugin declarations. | passed | G7 |
| `pnpm validate:skills` | Validate packaged Agent Workbench skill guidance. | passed, 6 files and 0 warnings/errors | G7 |
| `pnpm pack:dry-run` | Validate the packaged runtime payload without publishing. | passed, 264 entries | G7 |
| Agent Workbench bounded Markdown check over explicit changed docs | Validate frontmatter and Markdown quality. | pending | G8 |
| `git diff --check` | Detect whitespace errors in task-owned changes. | passed | G7 |

## Requirement Coverage

| Requirement | Acceptance criteria covered | Evidence | Residual risk |
|-------------|-----------------------------|----------|---------------|
| Requirement 1 Selected-scope discovery | AC1-AC5 | T002/T005 pure discovery and T008/T009 selected/broad integration proof | Broad no-selection scopes may remain limited but cannot merge unrelated units. |
| Requirement 2 Evidence-backed markers | AC1-AC5 | T001/T003/T005 contract/recognizer proof and T009 MCP projection | Initial marker catalog is intentionally finite. |
| Requirement 3 Per-unit candidates | AC1-AC5 | T001/T002/T008/T009 structured units and compatibility projection tests | Compatibility projection loses grouping for old clients. |
| Requirement 4 Structured blocking | AC1-AC4 | T001/T004/T008/T009 unit blockers, aggregate status, and action projection tests | Unknown prerequisites remain blocked by design. |
| Requirement 5 Broken Git metadata | AC1-AC4 | T006/T008/T009 source-preservation and unavailable-claim tests | Git-dependent claims remain unavailable. |
| Requirement 6 Submodule awareness | AC1-AC5 | T007/T009 bounded boundary and non-traversal tests; T012 promotion remains | Full submodule planning is a routed residual. |
| Requirement 7 Mixed-language fixture | AC1-AC5 | T001/T009 inert fixture and application/MCP proof | Fixture does not prove every real repository convention. |
| Requirement 8 Planning-only boundary | AC1-AC4 | T001-T009 `not_executed`, workspace-only, and non-traversal proof | Target execution is intentionally unavailable. |

## Correctness Property Coverage

| Property | Covered by | Evidence | Residual risk |
|----------|------------|----------|---------------|
| CP-001 Unit locality | T002/T003/T008/T009 path-provenance assertions | passed | Explicit aggregators remain evidence-gated. |
| CP-002 Selection isolation | T002/T009 unrelated-sibling metamorphic test | passed | none |
| CP-003 Determinism | T002/T009 catalog-order permutation tests | passed | none |
| CP-004 Non-execution | T001/T003/T004/T007/T009 workspace seams and `not_executed` assertions | passed | Process/network API review is completed by T010. |
| CP-005 Claim separation | T006/T009 broken-Git tests | passed | Git-dependent claims intentionally remain unavailable. |
| CP-006 Boundary confinement | T007/T009 declared and incomplete boundary tests | passed | Full submodule behavior stays unavailable. |

## Scope Reconciliation Before Closure

| Broad requirement, design target, or review finding | Implemented in this spec | Coverage state | Deferred or rejected work | Destination | Blocks closure? | Evidence |
|-----------------------------------------------------|--------------------------|----------------|---------------------------|-------------|-----------------|----------|
| Initial nested project-unit discovery | bounded selected/broad unit discovery and planning | covered | none | T001-T009 | no | 108 focused tests |
| Extensionless script admission | positive repository-guidance/protocol evidence and negative recognizer cases | covered | additional evidence classes require a separate fixture-backed change | T003/T009 | no | marker and MCP tests |
| Broken Git claim separation | readable source retained; unavailable Git claims blocked | covered | Git-dependent claims remain unavailable by design | T006/T009 | no | Git-claim and MCP tests |
| Submodule boundary detection | bounded path-only detection and non-traversal | covered | initialized traversal remains Spec 058 | T007/T009 | no | boundary and MCP tests |
| Full initialized submodule traversal and cross-repository planning | boundary detection only | out-of-scope | Explicit scope, identity, recursion, network/credential, per-repo policy and cleanliness design | Spec 058 | no | existing active Spec 058 package |
| Java, Rust, and C# semantic promotion | none | out-of-scope | Language semantic work | EB010/EB014 | no | requirements non-goals |
| Target command execution and fallback execution | none | out-of-scope | Rejected by trust boundary | none; intentionally rejected | no | Requirement 8 and design security boundary |

## Agent Readiness Evidence

| Field | Evidence | Residual risk |
|-------|----------|---------------|
| Scope and out-of-scope files | `tasks.md`, design slice-boundary table | Exact implementation filenames may change with T001 architecture review. |
| Must-read and optional context | requirements, design, traceability, change impact, EB004 and runtime contracts | Direct source must be reread before each task. |
| Permissions and approval points | Read-only planning in target repos; ordinary task-owned source/test/doc edits in this repo; no command/Git/submodule operations in targets | Full submodule work requires a separate spec and authority. |
| Validation commands and expected signals | Validation Commands above | Focused test list may expand as files are added. |
| Review needs | Contract, workspace safety, architecture, and final independent review | Any public schema change raises review importance. |
| Durable-doc or closure impact | T012/T013 and change-impact promotion table | D003 must be assigned before closure. |
| Optional repo-evidence provider caveats | Agent Workbench routing must be direct-read and test verified | Routing output alone is not implementation proof. |

## Task Evidence

| Task ID | Status | Evidence | Notes |
|---------|--------|----------|-------|
| T001 | complete | Additive optional `project_units` contract; inert mixed-language fixture; 33 focused/runtime contract tests and `pnpm typecheck` passed; independent findings resolved. | Contract and fixture foundation only; production discovery/emission remains downstream. |
| T002 | complete | Pure bounded discovery passed nearest-selection, subtree, aggregator, broad-request, cap, and permutation tests. | Planner integration remains T008. |
| T003 | complete | Explicit manifest and evidenced extensionless-script recognizers passed positive, negative, conflict, and bound tests. | Planner integration remains T008. |
| T004 | complete | Per-unit ready, blocked, limited, and next-action projection tests passed without execution fallbacks. | Planner integration remains T008. |
| T005 | complete | Four focused files passed 33 tests; `pnpm typecheck` and `git diff --check` passed. | Foundation checkpoint complete. |
| T006 | complete | Workspace-only missing, malformed, detached, loose-ref, and packed-ref tests preserve source evidence while blocking unavailable Git claims. | No Git CLI or shell fallback. |
| T007 | complete | Bounded `.gitmodules` and embedded-boundary tests cover declared, initialized, incomplete, malformed, and oversized evidence without traversal or URL emission. | Full recursive submodule support remains Spec 058. |
| T008 | complete | Unit-local planning, stable flat projection, blocker actions, policy-command preservation, and presenter compatibility pass focused tests. | Existing planners are reused with unit-local catalogs. |
| T009 | complete | Mixed-language application/MCP fixture suite passed 108 tests across 8 files. | All target commands remain planned and `not_executed`. |
| T010 | complete | Review blocker fixed by preserving repo-approved commands and suppressing generic host/manual-review and no-command fallbacks; both record warnings resolved. | Independent focused re-review has no remaining blocker. |
| T011 | complete | Full suite passed 116 files/1,288 tests; typecheck, plugin/skills validation, 264-entry package dry-run, and diff check passed. | No target-repository or fixture command executed. |
| T012 | complete | EB004, validation design, runtime contracts, capability matrix, and threat model updated; focused docs suite passed 10 tests. | Existing Spec 058 is the single full-submodule destination. |
| T013 | in progress | Lifecycle task/evidence/risk/lint checks run; closure evidence is being reconciled. | Final closure check follows task completion. |

## Evidence Log

| Date | Evidence | Result | Notes |
|------|----------|--------|-------|
| 2026-08-04 | Spec 057 authoring sources | direct-read file evidence | `docs/backlog/README.md`, `docs/reference/runtime-contracts.md`, `docs/reference/language-capability-matrix.md`, and representative repository shape were read before implementation. |
| 2026-08-04 | Focused docs tests: `docs-links-metadata` and `markdown-quality` | passed, 10 tests | Spec-authoring validation only. |
| 2026-08-04 | Independent requirements/design/tasks review | spec docs tests passed 10 tests after fixes | `requirements.md`, `design.md`, `tasks.md`, and `traceability.md` record script evidence, action projection, broad-request proof, and separate review/validation/promotion/closure gates. |
| 2026-08-04 | Canonical-context advisory review | waived | Durable authorities are explicit, current, non-conflicting, and mapped in requirements/change impact; duplicating them into a context artifact would add no authority clarification. |
| 2026-08-04 | T001 additive project-unit contract and inert mixed-language fixture | passed | Contract `0.1` keeps flat `planned_commands` compatible and adds optional bounded `project_units`; fixture markers are catalog-visible, while `.gitmodules` parsing remains explicitly owned by T007. |
| 2026-08-04 | `pnpm exec vitest run tests/contracts/validation-status-evidence.test.ts tests/contracts/runtime-contracts.test.ts` | passed, 33 tests | Covers compatibility, strictness, bounds, path normalization, blocker invariants, `not_executed`, and fixture structure/catalog visibility. |
| 2026-08-04 | `pnpm typecheck` and `git diff --check` | passed | Type and whitespace validation for the T001 slice. |
| 2026-08-04 | Independent T001 implementation review and focused re-review | contract tests passed 33 tests after fixes | Renamed the extensionless script so catalog policy admits it and required non-empty blocked claims. |
| 2026-08-04 | Agent Workbench verification planning before T008 | safely blocked planning evidence | The pre-change planner exposed the aggregate mixed-ecosystem defect; all proposed target commands remained `not_executed`. |
| 2026-08-04 | T002-T005 project-unit foundation focused suite | passed, 4 files and 33 tests | Covers deterministic discovery, selected-scope isolation, broad requests, explicit markers, evidenced scripts, readiness, blockers, and non-executing action projection. |
| 2026-08-04 | `pnpm typecheck` and `git diff --check` after T002-T005 | passed | Foundation types and whitespace are clean before repository-claim and planner integration. |
| 2026-08-04 | T006/T007 repository-claim and boundary suites | passed | Workspace-only Git evidence retains readable source; submodule and embedded-repository boundaries remain confined without Git, process, network, or write actions. |
| 2026-08-04 | T008/T009 focused contract, application, and MCP suite | passed, 8 files and 108 tests | Covers selected .NET/Maven/Cargo/script units, broad collection limits, readiness, broken Git, boundaries, deterministic ordering, presenter compatibility, and planning-only commands. |
| 2026-08-04 | Independent implementation review fix | passed, 4 files and 83 tests plus typecheck and diff check | Restored unit-local use of existing planners, preserved explicit Docker policy commands, suppressed generic host commands and manual-review fallbacks, and added an exact nested .NET Docker-policy regression. |
| 2026-08-04 | Full repository and package gate | passed | `pnpm test` passed 116 files/1,288 tests; typecheck, plugin validation, skills validation (6 files, 0 findings), package dry-run (264 entries), and diff check passed. |
| 2026-08-04 | T012 durable promotion | passed, 2 files and 10 docs tests | EB004, validation design, runtime contracts, capability matrix, and threat model updated; Markdown set had only pre-existing table-readability advisories. |
| 2026-08-04 | T013 lifecycle reconciliation | no task-audit error; 30 concrete evidence records | Package lint has one waived canonical-context advisory; Spec 058 is the sole routed residual and all open decisions are resolved. |

## Manual Or External Verification

The fixture shape is based on observed mixed-language example collections, but
real-repository testing after implementation must remain read-only. A broken
target `HEAD` must be reported as blocking cleanliness comparison rather than
preventing source-evidence checks. Real-repository evidence is regression
evidence only and cannot replace fixture-backed acceptance criteria.

## Residual Risks

- Positive documentation evidence for extensionless scripts can still be
  ambiguous; recognizers must be intentionally narrow and fixture-backed.
- Additive structured output increases payload size; unit, marker, blocker, and
  command caps need explicit tests.
- Existing ecosystem planners may encode root assumptions outside the first
  files identified; T008 review must remove the single path rather than add a
  parallel fallback route.
- Full Git submodule support has distinct authority and repository-identity
  risks and must remain unavailable until its follow-up is designed.

## Durable Promotion And Cleanup

| Spec content | Durable destination or deferral | Status | Evidence |
|--------------|---------------------------------|--------|----------|
| Requirements and accepted behavior | `docs/backlog/README.md` EB004 | promoted | T012; docs tests passed |
| Technical validation design | `docs/design/edit-and-validation-loop-design.md` | promoted | T012; docs tests passed |
| Public contracts and compatibility | `docs/reference/runtime-contracts.md` | promoted | T012; exact additive schema documented |
| Language capability interpretation | `docs/reference/language-capability-matrix.md` | promoted | T012; semantic levels unchanged |
| Security boundary | `docs/security/threat-model.md` | promoted | T012; script/boundary threat added |
| Full submodule support | existing Spec 058 | routed | T012/D003 resolved |

### Spec Cleanup Decision

- **Cleanup action:** remove after the final implementation/spec commit is
  recorded through the closure workflow.
- **Reason:** Implementation, validation, review, promotion, and residual
  routing are complete; durable docs retain current behavior.
- **Final spec commit:** pending
- **Closure log path:** `docs/history/spec-closure-log.md`
- **Closure log entry updated:** no
- **Closure cleanup commit:** pending
- **Active indexes updated:** pending closure apply
- **Durable docs linked back to evidence where useful:** yes, EB004 links Spec
  058 and the public behavior is promoted to canonical owners.
- **Residual spec-only content:** historical implementation detail recoverable
  from Git and the closure log after cleanup.

## Ship Or Closure Risk

- **Risk level:** medium
- **Breaking change:** no, subject to T001 compatibility decision
- **Blast radius checked:** yes, focused and full regression suites passed
- **Rollback path:** remove additive unit projection and revert unit-scoped
  planner integration; do not retain the old route as a runtime fallback
- **Requires human review:** yes
- **Release notes needed:** no separate release note for spec closure
- **Follow-up issue or spec needed:** yes, existing Spec 058

### Risk Rationale

The change affects a public planning contract and multiple ecosystem routes,
but remains read-only and non-executing. The primary risks are false candidate
association, compatibility drift, and accidental cross-repository authority;
fixture, property, port-spy, and full-suite gates directly target those risks.

## Readiness Decision

- **Ready for implementation:** implemented
- **Ready for promotion:** promoted
- **Ready for release:** yes for this scoped behavior; release publication is
  separate
- **Ready for closure:** pending final lifecycle check and cleanup record

## Related Artifacts

- Requirements: `requirements.md`
- Change Impact: `change-impact.md`
- Design: `design.md`
- Tasks: `tasks.md`
