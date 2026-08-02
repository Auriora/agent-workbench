---
title: Validation-plan skipped-path payload compaction verification
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

Plan evidence for Requirements 1-6, Tasks T001-T009, CP-001 through CP-006,
scanner population accounting beyond the raw evidence sample, the additive
validation-plan summary, task-context parity, generated/vendor-heavy command
visibility, redaction, durable promotion, and closure readiness.

## Quality Gates

| Gate | Required? | Status | Evidence |
| --- | --- | --- | --- |
| Requirements/design/task trace reviewed | yes | complete | T001 lifecycle plus independent requirements/QA and architecture/contract reviews; findings incorporated |
| Additive contract and compatibility reviewed | yes | complete for readiness | T001 review fixed required internal migration scope and coherent public-emission task boundary; executable proof remains G2 |
| Population and no-extraction-limit invariants pass | yes | complete | policy and scanner tests, including more than 100 raw skips |
| Validation-plan/context/presenter parity passes | yes | complete | focused MCP/presentation tests |
| Five-gate payload acceptance passes | yes | complete | 125-exclusion generated-heavy regression |
| Typecheck and full suite pass | yes | complete | 110 files and 1,218 tests passed |
| Plugin/skill/package validation passes | yes | complete | plugin, skills, runtime-build, and pack checks passed |
| Bounded dogfood records identity and receipts | yes | complete | checkout-source debug harness receipt |
| Durable documentation promoted | yes | complete | all change-impact destinations updated |
| Final multi-discipline review addressed | yes | complete | independent code and requirements/QA findings disposition recorded below |
| Closure check and cleanup decision recorded | yes | complete | lifecycle closure check passed before final spec commit; cleanup action is remove |

## Validation Commands

| Command | Purpose | Result | Evidence |
| --- | --- | --- | --- |
| lifecycle lint, traceability, task-state, evidence, and closure tools | package integrity/readiness | passed | lint 0 errors/warnings; task audit 0 errors/warnings; closure check passed |
| `pnpm exec vitest run tests/application/skipped-path-summary.test.ts tests/workspace/file-catalog-scanner.test.ts --maxWorkers=4` | population/count/sample invariants | passed | 21 focused tests |
| focused contracts, verification-plan, context, presenter, and translation suites | public contract and cross-surface parity | passed | 127 focused tests; final warning edge rerun 44 tests |
| `pnpm exec vitest run tests/mcp/stdio-entrypoint.test.ts --maxWorkers=4` | packaged MCP boundary and five-gate response | passed | 16 tests |
| `pnpm typecheck` | TypeScript correctness | passed | no errors, including final edge fix |
| `pnpm exec vitest run --maxWorkers=4` | full regression suite | passed | 110 files; 1,218 tests |
| `pnpm validate:plugin` | plugin/package binding consistency | passed | manifest, binding, and hook validation passed |
| `pnpm validate:skills` | packaged skill consistency | passed | 6 owned skill files; no errors or warnings |
| `pnpm build-runtime:check` | generated runtime consistency | passed | generated runtime valid |
| `pnpm pack:dry-run` | package includes changed runtime files | passed | 259 entries; 807,234-byte package; 3,984,640 bytes unpacked |
| `git diff --check` | patch integrity | passed | no whitespace errors |

## Verification Gates

### G1: Package Readiness

Lifecycle lint, requirements/design trace review, task-state audit, and
contract/scanner architecture review report no blocker before implementation.

### G2: Contract And Compatibility

Strict schemas prove `skipped_path_summary`, reason groups, count basis,
`source_truncated`, samples, sample-truncation state, and actionable records.
Current plan output omits raw `skipped_paths`; version `0.1`, other raw surfaces,
and deprecated compatibility input remain unchanged.

### G3: Exact Population And Determinism

Pure-policy tests prove normalization, `reason:path` deduplication, exact total
and group conservation, all reason groups, three-path lexical samples,
boundary truncation, empty input, stable generated permutations, and exact
accounting beyond the raw-retention bound. Large-fixture evidence records the
invocation-scoped memory observation without creating a runtime budget.

### G4: Scanner And Planner Truth

Scanner tests classify more than 100 unique skipped paths and prove aggregate
counts continue after raw compatibility retention fills. Planner tests prove
the exact receipt is consumed, selected priority exclusions remain actionable,
scanner truncation stays separate, and command/risk/blocker/status behavior is
unchanged. No sample fill changes traversal or classification calls.

### G5: Context And Presentation Parity

The same population receipt produces every encountered reason and matching
count/sample facts in structured validation output and task-context
`skipped_work`, using the finite reason vocabulary without the former
five-reason slice. Presentation
tests prove safe repository-relative paths, detail redaction, strict parsing,
and no raw-to-summary fallback.

### G6: Five-Gate Payload Acceptance

A generated/vendor-heavy fixture with at least 50 routine exclusions returns
typecheck, test, plugin validation, skill validation, and package dry-run
exactly once, plus exact bounded skipped-path evidence within the response
budget. No command is displaced by per-path noise.

### G7: Full Repository Gates

Typecheck, the full Vitest suite with four workers, required plugin/skill/package
checks, and diff checks pass.

### G8: Dogfood Acceptance

An installed or checkout-source runtime call records package/runtime identity,
repository/snapshot evidence where applicable, response byte size, all planned
commands, exact skip totals/groups, actionable records, scanner-source
truncation, and sample truncation. Blocked environmental evidence remains
truthful and cannot satisfy unexecuted acceptance.

### G9: Durable Promotion

Every target in `change-impact.md` describes implemented behavior or a truthful
residual route. EB065 is delivered; EB014, EB059, EB061, and other raw surfaces
retain separate ownership.

### G10: Closure Readiness

Requirement/property coverage, implementation review, evidence quality,
promotion, cleanup metadata, and archive validation have no blocker.

## Requirement Coverage

| Requirement | Acceptance criteria covered | Evidence | Residual risk |
| --- | --- | --- | --- |
| Requirement 1 | AC1-AC6 | G2-G4 complete | none; population beyond raw sample is proven |
| Requirement 2 | AC1-AC5 | G2, G3, G5 complete | older clients may ignore the additive summary |
| Requirement 3 | AC1-AC5 | G3, G4 complete | existing upstream scanner truncation remains explicit |
| Requirement 4 | AC1-AC5 | G4, G5 complete | request scope intentionally bounds actionable evidence |
| Requirement 5 | AC1-AC5 | G2, G5 complete | old clients may ignore additive receipt |
| Requirement 6 | AC1-AC5 | G6-G10 complete | dogfood is checkout-source, not installed-package proof |

## Correctness Property Coverage

| Property | Covered by | Evidence | Residual risk |
| --- | --- | --- | --- |
| CP-001 | T002-T005, T007; G3/G4 | passed | none |
| CP-002 | T002, T003, T005-T007; G2/G3/G5 | passed | none |
| CP-003 | T003, T005-T007; G3/G5 | passed | none |
| CP-004 | T003-T005, T007; G3/G4 | passed | existing scanner invocation bound remains explicit |
| CP-005 | T004-T007; G4/G5 | passed | none |
| CP-006 | T002, T004-T007; G2/G4/G5 | passed | none |

## Scope Reconciliation Before Closure

| Broad requirement, design target, or review finding | Implemented in this spec | Coverage state | Deferred or rejected work | Destination | Blocks closure? | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| Requirements 1-5 population and public behavior | exact scanner receipt, public summary, actionable exclusions, context parity, redaction | complete | none | durable requirements/design/contracts | no | T002-T007; G2-G6 |
| Requirement 6 validation and promotion | five-gate regression, full validation, dogfood, durable promotion | complete | installed-package confirmation is optional release evidence | proof matrix, changelog, ledger | no | T007-T009; G6-G10 |
| scanner traversal/max-files/continuation | population truth only | out-of-scope | completion policy unchanged | EB014 or separately evidenced scanner work | no | requirements/design boundary |
| other raw skipped-path surfaces | none | out-of-scope | compact only with surface-specific evidence | owning surface backlog | no | requirements/design boundary |
| ranked docs capacity/eviction | none | out-of-scope | normative capacity decision | EB059 | no | backlog |
| parser coverage disclosure | none | out-of-scope | capability decision | EB061 | no | backlog |

## Agent Readiness Evidence

| Field | Evidence | Residual risk |
| --- | --- | --- |
| Scope and out-of-scope files | requirements, design, change impact | exact fixture path finalized in T002/T007 |
| Must-read context | canonical context and all package artifacts | source may drift before implementation |
| Permissions and approval points | source/docs/tests only; no external writes | public contract reviewed before implementation |
| Validation commands and expected signals | G1-G10 and command table | dogfood environment may be unavailable |
| Review needs | requirements/QA, architecture/layering, contract, scanner accounting, final implementation | pending |
| Durable-doc or closure impact | change-impact promotion map | all pending |
| Repo-evidence provider caveats | Workbench routes reads; direct source/tests prove behavior | fresh evidence required on resume |

## Task Evidence

| Task ID | Status | Evidence | Notes |
| --- | --- | --- | --- |
| T001 | complete | lifecycle lint/reconciliation/task audit; independent requirements/QA and architecture/contract review; direct scanner accounting review | findings incorporated before source changes; implementation proof remains pending |
| T002 | complete | required contract seam, 14 migrated doubles, typecheck/contracts | contract `0.1` remains additive |
| T003 | complete | 2 pure invariant tests | shared accumulator has no runtime budget |
| T004 | complete | 19 scanner tests, more-than-100 count, 169,628 KiB whole-runner peak RSS | traversal unchanged |
| T005 | complete | contract/planner/presenter/translation tests | current plan emits summary only |
| T006 | complete | six-reason context parity and redaction tests | no five-reason slice remains |
| T007 | complete | 125 exclusions, five exact gates, 16 stdio tests | no command displaced |
| T008 | complete | focused/full/gate validation and source dogfood | planned commands were not executed |
| T009 | complete | two independent reviews; late-runtime-skip and actionable-schema findings fixed; 63 focused and 1,218 full tests; durable promotion | package removal follows final commit |

## Evidence Log

- 2026-08-02: the T002-T007 focused command exited 0 with 127 tests, including
  exact population, compaction, redaction, and the 125-path five-gate case.
- 2026-08-02: typecheck and all package gates exited 0; the full suite passed
  110 files and 1,218 tests.
- 2026-08-02: two final reviews had no blocker after the exact-population
  runtime-warning and actionable-path schema findings were fixed; the final
  focused rerun passed 63 tests and the full rerun passed 1,218 tests.

## Manual Or External Verification

Checkout-source dogfood distinguishes scanner-source truncation, sample
truncation, and planned command evidence. It is not installed-package proof and
none of the five planned validation commands was executed by the dogfood call.

## Residual Risks

- Counting only the retained raw scanner sample would make aggregate counts
  false; mitigate with the required population receipt and over-100 test.
- Exact unique accounting retains one invocation-scoped deduplication key per
  observed reason/path and therefore grows linearly; this is an accepted
  correctness tradeoff, to be measured on the large fixture rather than masked
  by a new cap.
- A sample bound could accidentally become a traversal bound; mitigate with a
  scanner spy and explicit no-control-flow property.
- Removing raw validation output could hide a requested exclusion; mitigate
  with priority-path retention and actionable intersection tests.
- Shared summarization could drift into a second public schema for task context;
  retain its current `skipped_work` shape and share only the source policy.
- Older clients may ignore the additive summary; no compatibility claim beyond
  the established optional-field contract is made.

## Durable Promotion And Cleanup

| Spec content | Durable destination or deferral | Status | Evidence |
| --- | --- | --- | --- |
| accepted requirements | `docs/requirements/runtime-requirements.md` | complete | REQ-031 |
| validation and context surface behavior | `docs/design/mcp-surface-design.md` | complete | exact population and bounded projections |
| public schemas/count/truncation semantics | `docs/reference/runtime-contracts.md` | complete | contract `0.1` additive summary |
| proof obligations | `docs/reference/mvp-proof-matrix.md` | complete | generated-heavy proof row |
| backlog delivery/residual routes | `docs/backlog/README.md` | complete | EB065 delivered; residual owners retained |
| agent-visible behavior | `docs/reference/agent-readable-changelog.md` | complete | 2026-08-02 entry |
| dogfood evidence | `docs/reference/dogfood-evidence-ledger.md` | complete | checkout-source bounded receipt |

### Spec Cleanup Decision

- **Cleanup action:** remove after verified promotion and closure
- **Reason:** temporary implementation scaffold; durable owners retain behavior
- **Final spec commit:** pending
- **Closure log path:** `docs/history/spec-closure-log.md`
- **Closure log entry updated:** no
- **Closure cleanup commit:** pending
- **Active indexes updated:** no
- **Durable docs linked back to evidence where useful:** no
- **Residual spec-only content:** none expected

## Ship Or Closure Risk

- **Risk level:** medium
- **Breaking change:** no; additive optional receipt with current raw emission retired
- **Blast radius checked:** yes; scanner, planner, contracts, context,
  presentation, MCP translation, stdio, and full regression suite
- **Rollback path:** revert the source change and restore prior raw plan output;
  do not retain mixed emitters
- **Requires human review:** yes
- **Release notes needed:** yes
- **Follow-up issue or spec needed:** no; existing backlog owns exclusions

### Risk Rationale

This changes a public planning response, shared scanner evidence, task-context
presentation, and strict contracts. It performs no writes, execution, database
migration, or network activity, but count/truncation mistakes could materially
mislead agents about validation coverage.

## Readiness Decision

- **Ready to implement:** complete
- **Ready for promotion:** complete
- **Ready for release:** yes as source-validated behavior; installed-package
  confirmation may accompany the next release
- **Ready for closure:** yes; remove the temporary package after committing the
  final spec state, then resolve cleanup metadata to the cleanup commit

## Related Artifacts

- Requirements: `requirements.md`
- Change Impact: `change-impact.md`
- Design: `design.md`
- Tasks: `tasks.md`
