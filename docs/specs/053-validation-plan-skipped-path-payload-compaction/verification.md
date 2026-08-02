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
| Population and no-extraction-limit invariants pass | yes | pending | policy and scanner tests |
| Validation-plan/context/presenter parity passes | yes | pending | focused MCP/presentation tests |
| Five-gate payload acceptance passes | yes | pending | generated/vendor-heavy fixture |
| Typecheck and full suite pass | yes | pending | commands below |
| Plugin/skill/package validation passes | yes | pending | commands below |
| Bounded dogfood records identity and receipts | yes | pending | installed or checkout-source MCP evidence |
| Durable documentation promoted | yes | pending | change-impact destinations |
| Final multi-discipline review addressed | yes | pending | findings disposition |
| Closure check and cleanup decision recorded | yes | pending | lifecycle closure evidence |

## Validation Commands

| Command | Purpose | Result | Evidence |
| --- | --- | --- | --- |
| lifecycle lint, traceability, task-state, evidence, and closure tools | package integrity/readiness | pending | structured lifecycle results |
| `pnpm exec vitest run tests/application/skipped-path-summary.test.ts tests/workspace/file-catalog-scanner.test.ts --maxWorkers=4` | population/count/sample invariants | pending | focused result |
| `pnpm exec vitest run tests/contracts/runtime-contracts.test.ts tests/mcp/verification-plan-tool.test.ts tests/mcp/context-for-task-tool.test.ts tests/presentation/session-aware-presenters.test.ts tests/mcp/translation-boundary.test.ts --maxWorkers=4` | public contract and cross-surface parity | pending | focused result |
| `pnpm exec vitest run tests/mcp/stdio-entrypoint.test.ts --maxWorkers=4` | packaged MCP boundary and five-gate response | pending | focused result |
| `pnpm typecheck` | TypeScript correctness | pending | command result |
| `pnpm exec vitest run --maxWorkers=4` | full regression suite | pending | file/test counts |
| `pnpm validate:plugin` | plugin/package binding consistency | pending | command result |
| `pnpm validate:skills` | packaged skill consistency | pending or not applicable | record exact disposition |
| `pnpm pack:dry-run` | package includes changed runtime files | pending | command result |
| `git diff --check` | patch integrity | pending | command result |

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
| Requirement 1 | AC1-AC6 | G2-G4 pending | population beyond raw sample must be proven |
| Requirement 2 | AC1-AC5 | G2, G3, G5 pending | sample utility requires dogfood confirmation |
| Requirement 3 | AC1-AC5 | G3, G4 pending | existing upstream scanner truncation remains |
| Requirement 4 | AC1-AC5 | G4, G5 pending | request scope bounds actionable evidence |
| Requirement 5 | AC1-AC5 | G2, G5 pending | old clients may ignore additive receipt |
| Requirement 6 | AC1-AC5 | G6-G10 pending | installed environment may block dogfood |

## Correctness Property Coverage

| Property | Covered by | Evidence | Residual risk |
| --- | --- | --- | --- |
| CP-001 | T002-T005, T007; G3/G4 | pending | none expected |
| CP-002 | T002, T003, T005-T007; G2/G3/G5 | pending | none expected |
| CP-003 | T003, T005-T007; G3/G5 | pending | none expected |
| CP-004 | T003-T005, T007; G3/G4 | pending | existing scanner invocation bound remains explicit |
| CP-005 | T004-T007; G4/G5 | pending | none expected |
| CP-006 | T002, T004-T007; G2/G4/G5 | pending | none expected |

## Scope Reconciliation Before Closure

| Broad requirement, design target, or review finding | Implemented in this spec | Coverage state | Deferred or rejected work | Destination | Blocks closure? | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| Requirements 1-5 population and public behavior | none yet | not-covered | implementation pending | active Spec 053 | yes | T002-T007 |
| Requirement 6 validation and promotion | none yet | not-covered | validation/promotion pending | active Spec 053 | yes | T007-T009 |
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
| T002 | pending | none | exact contract seam |
| T003 | pending | none | shared accumulator |
| T004 | pending | none | scanner population |
| T005 | pending | none | validation-plan projection |
| T006 | pending | none | context/presenter parity |
| T007 | pending | none | five-gate fixture acceptance |
| T008 | pending | none | validation/dogfood |
| T009 | pending | none | promotion/review |

## Evidence Log

| Date | Evidence | Result | Notes |
| --- | --- | --- | --- |
| 2026-08-02 | Spec creation plan, Agent Workbench context, direct source reads, and read-only seam review | planned | confirmed EB065 and exposed the scanner's independent 100-record raw evidence cap; not implementation proof |
| 2026-08-02 | T001 requirements/QA, architecture/contract, and scanner-accounting review | passed after findings addressed | widened required-result producer/double scope; made planner/presenter emission atomic; removed ambiguous five-reason parity; fixed policy-test path, actionable bound, and exact-count memory evidence |

## Manual Or External Verification

No implementation or dogfood evidence exists at spec creation. Future dogfood
must distinguish scanner-source truncation, sample truncation, and executed
validation; a planned command is not proof that it ran.

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
| accepted requirements | `docs/requirements/runtime-requirements.md` | pending | T009 |
| validation and context surface behavior | `docs/design/mcp-surface-design.md` | pending | T009 |
| public schemas/count/truncation semantics | `docs/reference/runtime-contracts.md` | pending | T009 |
| proof obligations | `docs/reference/mvp-proof-matrix.md` | pending | T009 |
| backlog delivery/residual routes | `docs/backlog/README.md` | pending | T009 |
| agent-visible behavior | `docs/reference/agent-readable-changelog.md` | pending | T009 |
| dogfood evidence | `docs/reference/dogfood-evidence-ledger.md` | pending if executed | T008/T009 |

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
- **Blast radius checked:** no
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

- **Ready to implement:** yes for the dependency-safe T002 contract-baseline
  task; requirements remain `not-covered` until executable implementation and
  validation evidence exists
- **Ready for promotion:** no
- **Ready for release:** no
- **Ready for closure:** no

## Related Artifacts

- Requirements: `requirements.md`
- Change Impact: `change-impact.md`
- Design: `design.md`
- Tasks: `tasks.md`
