---
title: Ruby and Rails resource discovery verification
doc_type: spec
artifact_type: verification
status: draft
owner: platform
last_reviewed: 2026-08-01
---

# Verification

## Scope

Validate Spec 047 Requirement 1 through Requirement 4 and tasks T001-T008. This
record covers resource-backed discovery and validation planning only, not
parser-backed Ruby semantics.

## Quality Gates

| Gate | Required? | Status | Evidence |
|------|-----------|--------|----------|
| G0 Lifecycle package lint and structural checks | yes | passed | `scan_specs` and lint pass returned zero diagnostics |
| G1 Requirements, design, task and traceability review | yes | passed | The implementation plan is internally consistent after remediation. This gate does not assert runtime or security proof; telemetry-suppression evidence remains required by G5. |
| G2 Ruby identity/capability fixtures | yes | passed | Ruby, Bundler, Rake, Ruby-version and Rack/Rails anchors are resource-backed; shared secret policy excludes nested Rails credentials. |
| G3 Rails overview/context/resource and non-complete coverage fixtures | yes | passed | Conventional, engine, non-standard, oversized, permission-denied, truncated, generated/vendor and embedded-fixture-negative cases pass without fabricated roots. |
| G4 RSpec/Minitest, precedence and environment-policy validation fixtures | yes | passed | Policy commands take precedence; required Docker remains blocking; host evidence is advisory; selected Rails config files and nearest matching tests plan structured commands without execution. |
| G5 Static diagnostics, architecture boundaries, and telemetry suppression | yes | passed | Response redaction covers secret-like planned-command content; Rails-specific telemetry tests prove paths, bodies, arguments and repository identifiers are not copied into telemetry attributes. |
| G6 Typecheck and full Vitest suite | yes | passed | `pnpm typecheck` passed; final full Vitest passed 103 files and 1148 tests with no expected failures. |
| G7 Plugin/package gates selected by current verification plan | yes | passed | `pnpm validate:plugin` and `pnpm pack:dry-run` passed; package contained the new runtime source and synchronized hooks. |
| G8 Durable promotion, review, closure and archive checks | yes | passed before cleanup | Durable owners updated; independent review findings resolved; lint and task-state audit passed; `closure_check` returned ready with zero blockers. Archive validation follows cleanup. |

## Validation Commands

| Command | Purpose | Result | Evidence |
|---------|---------|--------|----------|
| focused Vitest files identified by Agent Workbench verification planning | Ruby/Rails fixtures and regressions | passed | Ten primary T007 files passed 163 tests; eight review-remediation/safety files passed 132 tests. |
| `pnpm typecheck` | TypeScript contract and boundary correctness | passed | `tsc --noEmit` completed successfully after implementation and review remediation. |
| `pnpm test` | Full runtime regression suite | passed | Final run passed 103 test files and 1148 tests. |
| `pnpm validate:plugin` | Packaged integration consistency when affected | passed | Plugin/package validation passed with synchronized Codex/Claude hooks. |
| `pnpm pack:dry-run` | Package inclusion when new runtime files are added | passed | Dry-run produced the 0.6.7 package manifest including Rails discovery source; no publication occurred. |
| `scan_specs` (spec-lifecycle-manager) | Spec structure checks | passed | `scan_specs` completed with active package recognized |
| closure checks | Promotion and closure readiness | passed before cleanup | `closure_check` ready=true, zero blockers; `task_state_audit` zero findings. |

## Requirement Coverage

| Requirement | Acceptance criteria covered | Evidence | Residual risk |
|-------------|-----------------------------|----------|---------------|
| Requirement 1 | AC1-AC4 | passed | Novel secret names and unseen Ruby layouts remain possible; shared policy is the extension point. |
| Requirement 2 | AC1-AC6 | passed | Resource-backed path/config evidence is not parser or runtime Rails semantics. |
| Requirement 3 | AC1-AC6 | passed | Custom wrappers outside catalog/policy evidence remain blocked or needed rather than guessed. |
| Requirement 4 | AC1-AC3 | passed pending G8 closure receipt | One dogfood solution is bounded evidence, not universal framework proof. |

## Agent Readiness Evidence

| Field | Evidence | Residual risk |
|-------|----------|---------------|
| Scope and out-of-scope files | requirements, design and T001 inspect/write boundaries | Source may drift before T001 reconciliation. |
| Must-read context | full package plus canonical-context durable sources | Source may drift before implementation. |
| Permissions and approval points | user authorised committing and completing Spec 047 | Push, release, install and publication remain outside this task. |
| Validation commands | Agent Workbench planned typecheck, full test, and documentation review; plugin/package gates were added from repository policy | Product validation commands were executed; Rails dogfood commands remained planned/not-executed. |
| Review needs | independent architecture, QA, lifecycle and security review completed; blockers were remediated with focused tests | Closure recheck remains required after promotion. |
| Durable-doc or closure impact | lifecycle promotion plan plus canonical documentation map | Promotion is performed by T008 before cleanup. |

## Task Evidence

| Task ID | Status | Evidence | Notes |
|---------|--------|----------|-------|
| T001 | complete | Direct read of the source, tests, and durable contracts named by T001; reconciliation recorded in `design.md` and `traceability.md`. | Exact application-policy ownership, generic-node transport, identity/capability gaps, shared safety, response redaction, telemetry attributes, and validation planning seams were identified. No source or test was modified. |
| T002 | complete | Five fixture repositories and seven focused suites establish conventional, engine, non-standard, RSpec, Minitest, constrained policy, secret, exclusion, oversized, permission-denied, truncated, and missing-optional-file cases. Focused run: 131 passed, 8 expected failures; typecheck passed. | Expected failures are the deliberate Phase 2 contracts for Ruby identity, Rails extraction/shape/ranking, generated/vendor handling, and nested credentials. No production source changed. |
| T003-T006 | complete | Production implementation and focused command evidence recorded in `tasks.md`; review remediation added complete anchor classification, config-only validation planning, fixture isolation and response redaction. | No parser, schema or runtime-execution path was added. |
| T007 | complete | Focused/full/typecheck/plugin/package gates passed; bounded Rails dogfood found and verified a nearest-test ranking repair; independent implementation/security review findings were addressed. | Real Rails validation commands were planned only and never executed. |
| T008 | in progress | Durable promotion plan resolves exact owners. | Closure checks and cleanup follow the final implementation commit. |

## Evidence Log

| Date | Evidence | Result | Notes |
|------|----------|--------|-------|
| 2026-08-01 | Spec package authoring and lifecycle lint | passed | Lifecycle lint and package structure checks reported zero diagnostics. |
| 2026-08-01 | Requirement identifier and AC traceability reconciliation | advisory pass | Current-session MCP `stage_readiness` for this spec mapped 19 of 19 acceptance criteria with zero acceptance/context gaps; rerun before T001 because no durable payload is stored. |
| 2026-08-01 | Manual `review-work-products` design review of `design.md`, package traceability, and current source seams | blocked | Five scoped findings: project-shape ownership/transport, stat-backed identity, Rails credential policy, validation ranking/safety, and evidence state. |
| 2026-08-01 | Focused manual re-review of `design.md`, `requirements.md`, `tasks.md`, and `traceability.md` | plan passed | Plan-structure warnings were corrected. Runtime and security evidence remains pending at G2-G8; this result is not implementation or security sign-off. |
| 2026-08-01 | T001 direct live-source reconciliation | passed | Confirmed pure application-policy ownership, once-per-flow catalog use, generic `resource` transport, shared safety/redaction seams, structured non-executed command planning, and the exact MCP telemetry attribute boundary. Ruby/Rails behavior and suppression proof remain pending. |
| 2026-08-01 | T002 fixture-first focused Vitest run | passed for Phase 1 | Seven suites completed with 131 passing assertions and 8 explicit expected failures. The expected failures preserve honest pending state for T003-T006 rather than claiming product support. |
| 2026-08-01 | T002 TypeScript typecheck and fixture validation | passed | `pnpm typecheck` passed; all fixture JSON parsed; a bounded secret-pattern scan found no credential-shaped fixture content. |
| 2026-08-01 | T002 full Vitest regression suite | passed for Phase 1 | 103 test files passed; 1124 tests passed; 8 expected failures remain intentionally red for T003-T006. |
| 2026-08-01 | T003-T006 focused implementation validation | passed | Ruby/Rails identity, shape, extraction, overview, context, path safety and validation-planning suites passed; all deliberate Phase 1 expected failures became ordinary passing contracts. |
| 2026-08-01 | T007 Rails dogfood before/after comparison | passed after repair | The first run chose a lexical config test for a model selection; basename-aware ranking fixed the defect and the identical rerun planned `test/models/user_test.rb`, without execution. |
| 2026-08-01 | Independent code, QA, lifecycle and security review plus remediation | passed | Findings were addressed, then `pnpm typecheck` and 8 focused files/132 tests passed; lifecycle lint and task-state audit returned zero findings. |
| 2026-08-01 | Final product validation before promotion | passed | Focused 163-test and 132-test slices, typecheck, final full 103-file/1148-test suite, plugin validation and package dry-run passed. |

## T001 Reconciliation Prerequisites

- Reconcile the accepted repository-wide shape owner, generic-node transport,
  shared identity and path-policy seams, shared workspace-safety contract,
  bounded nearest-root command planning, validation-environment policy, and
  telemetry suppression seams against live source.
- T001 must identify the exact response and telemetry attribute construction
  seams and record that evidence before T002 proceeds. This is seam
  reconciliation only; suppression is not proved until the targeted T007 tests
  pass and G5 records their results.

## Residual Risks

- Rails conventions and metaprogramming can be over-read; all initial evidence
  remains resource-backed.
- Custom engines and test wrappers may require additional fixtures.
- EB014 in `docs/backlog/README.md` retains large-repo completion/progress.

## Durable Promotion And Cleanup

| Spec content | Durable destination or deferral | Status | Evidence |
|--------------|---------------------------------|--------|----------|
| Adapter capability and limitations | `docs/design/language-adapter-design.md` | promoted | Resource-backed behavior and parser boundary recorded. |
| Priority and delivered level | `docs/reference/language-capability-matrix.md` | promoted | Ruby/Rails is the next delivered/promoted ecosystem at priority 4. |
| EB010 state | `docs/backlog/README.md` | promoted | Spec 047 delivery and Spec 048 ownership recorded. |
| Shared path-policy routing updates | `docs/reference/workspace-safety-contract.md` | promoted | Root/nested Rails credentials and hook parity recorded. |
| Dogfood result | `docs/reference/dogfood-evidence-ledger.md` | promoted | Bounded before/after Rails dogfood result recorded without repository identity. |
| Parser-backed follow-up | `docs/specs/048-ruby-rails-partial-semantic/` | routed | T001 is ready for post-closure reconciliation; T002 remains sequenced behind it. |

### Spec Cleanup Decision

- **Cleanup action:** remove after promotion and closure evidence
- **Final spec commit:** pending
- **Closure log path:** `docs/history/spec-closure-log.md`
- **Closure cleanup commit:** pending
- **Active indexes updated:** no

## Ship Or Closure Risk

- **Risk level:** low after implementation/security review; G8 closure receipt remains
- **Breaking change:** no
- **Blast radius checked:** yes, by affected adapter regressions and the full suite
- **Rollback path:** remove adapter registration and additive routing changes
- **Requires human review:** yes
- **Release notes needed:** yes if included in a release
- **Follow-up spec needed:** yes, Spec 048

## Readiness Decision

- **Ready for T001 reconciliation:** complete
- **Ready for feature implementation after T001/T002:** complete
- **Ready for security sign-off:** yes; focused response and telemetry suppression evidence passed
- **Ready for promotion:** yes
- **Ready for release:** no
- **Ready for closure:** pending T008 durable promotion and lifecycle closure checks

## Related Artifacts

- Requirements: `requirements.md`
- Change Impact: `change-impact.md`
- Design: `design.md`
- Tasks: `tasks.md`
- Traceability: `traceability.md`
