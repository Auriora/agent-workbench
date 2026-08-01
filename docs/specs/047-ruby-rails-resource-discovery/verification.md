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
| G2 Ruby identity/capability fixtures | yes | pending | Fixture-first assertions are installed; Ruby classification and Rails credential exclusions remain explicit expected failures for T003. |
| G3 Rails overview/context/resource and non-complete coverage fixtures | yes | pending | Conventional, engine, non-standard, oversized, permission-denied, and truncated cases are installed; Rails shape/ranking assertions remain explicit expected failures for T004-T005. |
| G4 RSpec/Minitest, precedence and environment-policy validation fixtures | yes | pending | Repository-policy RSpec and Minitest plans pass as planned/not-executed; a Docker-only engine policy remains host-blocking; automatic Rails candidate precedence remains owned by T006. |
| G5 Static diagnostics, architecture boundaries, and telemetry suppression | yes | pending | Must prove that both response and telemetry paths suppress raw Rails paths, source bodies, command arguments, secret-like values, and new repository-specific identifiers. |
| G6 Typecheck and full Vitest suite | yes | passed for Phase 1 | `pnpm typecheck` passed; full Vitest: 103 files passed, 1124 tests passed, 8 expected failures. Rerun after Phase 2 implementation. |
| G7 Plugin/package gates selected by current verification plan | yes | pending | |
| G8 Durable promotion, review, closure and archive checks | yes | pending | |

## Validation Commands

| Command | Purpose | Result | Evidence |
|---------|---------|--------|----------|
| focused Vitest files identified by Agent Workbench verification planning | Ruby/Rails fixtures and regressions | passed for Phase 1 | Seven T002 suites: 131 passed, 8 expected failures. Product gates remain pending until T003-T006 make the red contracts green. |
| `pnpm typecheck` | TypeScript contract and boundary correctness | passed for Phase 1 | `tsc --noEmit` completed successfully after fixture/test edits. |
| `pnpm test` | Full runtime regression suite | passed for Phase 1 | 103 test files passed; 1124 tests passed; 8 expected failures define T003-T006 behavior. |
| `pnpm validate:plugin` | Packaged integration consistency when affected | pending | |
| `pnpm pack:dry-run` | Package inclusion when new runtime files are added | pending | |
| `scan_specs` (spec-lifecycle-manager) | Spec structure checks | passed | `scan_specs` completed with active package recognized |
| closure checks | Promotion and closure readiness | pending | |

## Requirement Coverage

| Requirement | Acceptance criteria covered | Evidence | Residual risk |
|-------------|-----------------------------|----------|---------------|
| Requirement 1 | AC1-AC4 | pending | Unseen Ruby layouts, Rails credential paths, and catalog edge cases |
| Requirement 2 | AC1-AC6 | pending | Convention diversity, engines and non-complete coverage |
| Requirement 3 | AC1-AC6 | pending | Custom validation wrappers, root-distance tie-break, and mixed environment evidence |
| Requirement 4 | AC1-AC3 | pending (G2-G4 for AC1 fixture proof; G5-G8 for regression/promotion/closure checks) | One dogfood solution is not universal proof |

## Agent Readiness Evidence

| Field | Evidence | Residual risk |
|-------|----------|---------------|
| Scope and out-of-scope files | requirements, design and T001 inspect/write boundaries | Source may drift before T001 reconciliation. |
| Must-read context | full package plus canonical-context durable sources | Source may drift before implementation. |
| Permissions and approval points | user authorised completion of Spec 047 Phase 1 | Phase 2 production implementation is not included in this task. |
| Validation commands | planned above; refresh with verification tools before execution | Commands are not yet executed. |
| Review needs | focused plan review passed; architecture review if schemas/graph kinds change; implementation and security evidence review before closure | Telemetry-suppression proof is pending and security readiness is not claimed. |
| Durable-doc or closure impact | change-impact promotion table | All promotion pending. |

## Task Evidence

| Task ID | Status | Evidence | Notes |
|---------|--------|----------|-------|
| T001 | complete | Direct read of the source, tests, and durable contracts named by T001; reconciliation recorded in `design.md` and `traceability.md`. | Exact application-policy ownership, generic-node transport, identity/capability gaps, shared safety, response redaction, telemetry attributes, and validation planning seams were identified. No source or test was modified. |
| T002 | complete | Five fixture repositories and seven focused suites establish conventional, engine, non-standard, RSpec, Minitest, constrained policy, secret, exclusion, oversized, permission-denied, truncated, and missing-optional-file cases. Focused run: 131 passed, 8 expected failures; typecheck passed. | Expected failures are the deliberate Phase 2 contracts for Ruby identity, Rails extraction/shape/ranking, generated/vendor handling, and nested credentials. No production source changed. |
| T003-T008 | pending | none | Phase 2 implementation and Phase 3 verification/promotion have not started. |

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
| Adapter capability and limitations | `docs/design/language-adapter-design.md` | pending | |
| Priority and delivered level | `docs/reference/language-capability-matrix.md` | pending | |
| EB010 state | `docs/backlog/README.md` | pending | |
| Shared path-policy routing updates | `docs/reference/workspace-safety-contract.md` | pending | |
| Dogfood result | `docs/reference/dogfood-evidence-ledger.md` | pending | |
| Parser-backed follow-up | `docs/specs/048-ruby-rails-partial-semantic/` | planned | |

### Spec Cleanup Decision

- **Cleanup action:** remove after promotion and closure evidence
- **Final spec commit:** pending
- **Closure log path:** `docs/history/spec-closure-log.md`
- **Closure cleanup commit:** pending
- **Active indexes updated:** no

## Ship Or Closure Risk

- **Risk level:** high while implementation evidence gates G2-G8 remain pending
- **Breaking change:** no
- **Blast radius checked:** no
- **Rollback path:** remove adapter registration and additive routing changes
- **Requires human review:** yes
- **Release notes needed:** yes if included in a release
- **Follow-up spec needed:** yes, Spec 048

## Readiness Decision

- **Ready for T001 reconciliation:** yes
- **Ready for feature implementation after T001/T002:** yes; T003 is next and
  the eight expected failures define the Phase 2 implementation contract
- **Ready for security sign-off:** no; targeted response-redaction and
  telemetry-attribute suppression evidence remains pending at G5/T007
- **Ready for promotion:** no
- **Ready for release:** no
- **Ready for closure:** no

## Related Artifacts

- Requirements: `requirements.md`
- Change Impact: `change-impact.md`
- Design: `design.md`
- Tasks: `tasks.md`
- Traceability: `traceability.md`
