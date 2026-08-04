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
| G1 Contract and compatibility | yes | pending | T001/T008 schema, parser, presenter, and compatibility tests |
| G2 Unit discovery, markers, readiness, and determinism | yes | pending | T002-T005 focused tests and typecheck |
| G3 Broken Git claim separation | yes | pending | T006 tests preserve source evidence and block cleanliness claims |
| G4 Repository-boundary confinement | yes | pending | T007 tests prove no traversal, URL access, or submodule action |
| G5 Mixed-language application and MCP regression | yes | pending | T008/T009 planner, contract, presenter, and golden tests |
| G6 Independent implementation review | yes | pending | T010 findings and focused regression evidence |
| G7 Full repository and package regression | yes | pending | T011 complete command evidence |
| G8 Durable documentation and follow-up routing | yes | pending | T012 explicit Markdown check, docs tests, and new submodule backlog destination |
| G9 Closure-scope reconciliation | yes | pending | T013 lifecycle coverage, evidence quality, closure risk, and cleanup decision |

## Validation Commands

These commands validate Agent Workbench implementation. They do not execute
anything inside the mixed-language fixture or an external target repository.
Exact focused test paths may be refined by T001-T009 when new test files are
created.

| Command | Purpose | Result | Evidence |
|---------|---------|--------|----------|
| `pnpm exec vitest run tests/contracts/validation-status-evidence.test.ts` | Validate additive contract and compatibility behavior. | pending | G1 |
| `pnpm exec vitest run tests/application/validation-planner-rules.test.ts tests/mcp/verification-plan-tool.test.ts` | Validate project-unit planning and MCP presentation. | pending | G2, G5 |
| `pnpm typecheck` | Validate TypeScript contracts and layer integration. | pending | G1, G2, G5 |
| `pnpm test` | Run the complete regression suite. | pending | G7 |
| `pnpm validate:plugin` | Validate packaged MCP/plugin declarations. | pending | G7 |
| `pnpm validate:skills` | Validate packaged Agent Workbench skill guidance. | pending | G7 |
| `pnpm pack:dry-run` | Validate the packaged runtime payload without publishing. | pending | G7 |
| Agent Workbench bounded Markdown check over explicit changed docs | Validate frontmatter and Markdown quality. | pending | G8 |
| `git diff --check` | Detect whitespace errors in task-owned changes. | pending | G7 |

## Requirement Coverage

| Requirement | Acceptance criteria covered | Evidence | Residual risk |
|-------------|-----------------------------|----------|---------------|
| Requirement 1 Selected-scope discovery | AC1-AC5 | pending T002/T005/T008/T009, including coherent-root and bounded no-root broad requests | Broad no-selection scopes may remain limited but cannot merge unrelated units. |
| Requirement 2 Evidence-backed markers | AC1-AC5 | pending T001/T003/T005/T009 | Initial marker catalog is intentionally finite. |
| Requirement 3 Per-unit candidates | AC1-AC5 | pending T001/T002/T008/T009 | Compatibility projection loses grouping for old clients. |
| Requirement 4 Structured blocking | AC1-AC4 | pending T001/T004/T008/T009 | Unknown prerequisites remain blocked by design. |
| Requirement 5 Broken Git metadata | AC1-AC4 | pending T006/T008/T009 | Git-dependent claims remain unavailable. |
| Requirement 6 Submodule awareness | AC1-AC5 | pending T007-T12 | Full submodule planning is a routed residual. |
| Requirement 7 Mixed-language fixture | AC1-AC5 | pending T001/T009 | Fixture does not prove every real repository convention. |
| Requirement 8 Planning-only boundary | AC1-AC4 | pending port-spy evidence across T001-T9 | Target execution is intentionally unavailable. |

## Correctness Property Coverage

| Property | Covered by | Evidence | Residual risk |
|----------|------------|----------|---------------|
| CP-001 Unit locality | T002/T003/T008/T009 path-provenance assertions | pending | Explicit aggregators require careful negative cases. |
| CP-002 Selection isolation | T002/T009 unrelated-sibling metamorphic test | pending | none after proof |
| CP-003 Determinism | T002/T009 catalog-order permutation tests | pending | none after proof |
| CP-004 Non-execution | T001/T003/T004/T007/T009 port spies and `not_executed` assertions | pending | Process/network APIs outside injected seams require review. |
| CP-005 Claim separation | T006/T009 broken-Git tests | pending | Presenter wording must be reviewed. |
| CP-006 Boundary confinement | T007/T009 declared and incomplete boundary tests | pending | Full submodule behavior stays unavailable. |

## Scope Reconciliation Before Closure

| Broad requirement, design target, or review finding | Implemented in this spec | Coverage state | Deferred or rejected work | Destination | Blocks closure? | Evidence |
|-----------------------------------------------------|--------------------------|----------------|---------------------------|-------------|-----------------|----------|
| Initial nested project-unit discovery | none yet | not-covered | Implementation and proof | T001-T9 | yes | pending |
| Extensionless script admission | none yet | not-covered | Evidence-backed admission and negatives | T003/T009 | yes | pending |
| Broken Git claim separation | none yet | not-covered | Implementation and proof | T006/T009 | yes | pending |
| Submodule boundary detection | none yet | not-covered | Detection and non-traversal proof | T007/T009 | yes | pending |
| Full initialized submodule traversal and cross-repository planning | none | out-of-scope | Explicit scope, identity, recursion, network/credential, per-repo policy and cleanliness design | new backlog item assigned by T012 | no after routing | pending |
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
| T001 | pending | | Contract and fixture foundation. |
| T002 | pending | | Discovery and deterministic selection. |
| T003 | pending | | Marker recognizers. |
| T004 | pending | | Per-unit readiness. |
| T005 | pending | | Foundation checkpoint. |
| T006 | pending | | Broken Git claim separation. |
| T007 | pending | | Submodule boundary awareness. |
| T008 | pending | | Planner integration. |
| T009 | pending | | Mixed-language proof. |
| T010 | pending | | Independent implementation review. |
| T011 | pending | | Full repository and package validation. |
| T012 | pending | | Durable promotion and submodule follow-up routing. |
| T013 | pending | | Closure-scope reconciliation. |

## Evidence Log

| Date | Evidence | Result | Notes |
|------|----------|--------|-------|
| 2026-08-04 | Spec 057 authored from direct source, EB004, runtime contract, language capability, and real-repository shape evidence | planning only | No source implementation or target-repository command executed. |
| 2026-08-04 | Focused docs tests: `docs-links-metadata` and `markdown-quality` | passed, 10 tests | Spec-authoring validation only. |
| 2026-08-04 | Independent requirements/design/tasks review | findings addressed | Narrowed script evidence, defined action projection, added broad-request proof, and separated review/validation/promotion/closure gates. |
| 2026-08-04 | Canonical-context advisory review | waived | Durable authorities are explicit, current, non-conflicting, and mapped in requirements/change impact; duplicating them into a context artifact would add no authority clarification. |

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
| Requirements and accepted behavior | `docs/backlog/README.md` EB004 | pending | T012 |
| Technical validation design | `docs/design/edit-and-validation-loop-design.md` | pending | T012 |
| Public contracts and compatibility | `docs/reference/runtime-contracts.md` | pending | T012 if public fields change |
| Language capability interpretation | `docs/reference/language-capability-matrix.md` | pending | T012 |
| Security boundary | `docs/security/threat-model.md` or documented unchanged review | pending | T012 |
| Full submodule support | new backlog item | pending | T012/D003 |

### Spec Cleanup Decision

- **Cleanup action:** keep active
- **Reason:** Implementation has not started.
- **Final spec commit:** pending
- **Closure log path:** `docs/history/spec-closure-log.md`
- **Closure log entry updated:** no
- **Closure cleanup commit:** pending
- **Active indexes updated:** no
- **Durable docs linked back to evidence where useful:** no
- **Residual spec-only content:** requirements and design remain active until
  promotion and closure.

## Ship Or Closure Risk

- **Risk level:** medium
- **Breaking change:** no, subject to T001 compatibility decision
- **Blast radius checked:** no
- **Rollback path:** remove additive unit projection and revert unit-scoped
  planner integration; do not retain the old route as a runtime fallback
- **Requires human review:** yes
- **Release notes needed:** decide at closure
- **Follow-up issue or spec needed:** yes, full Git submodule support

### Risk Rationale

The change affects a public planning contract and multiple ecosystem routes,
but remains read-only and non-executing. The primary risks are false candidate
association, compatibility drift, and accidental cross-repository authority;
fixture, property, port-spy, and full-suite gates directly target those risks.

## Readiness Decision

- **Ready for implementation:** yes, subject to final lifecycle results recorded
  at handoff
- **Ready for promotion:** no
- **Ready for release:** no
- **Ready for closure:** no

## Related Artifacts

- Requirements: `requirements.md`
- Change Impact: `change-impact.md`
- Design: `design.md`
- Tasks: `tasks.md`
