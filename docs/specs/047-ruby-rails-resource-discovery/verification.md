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
| G2 Ruby identity/capability fixtures | yes | pending | |
| G3 Rails overview/context/resource and non-complete coverage fixtures | yes | pending | |
| G4 RSpec/Minitest, precedence and environment-policy validation fixtures | yes | pending | |
| G5 Static diagnostics, architecture boundaries, and telemetry suppression | yes | pending | Must prove that both response and telemetry paths suppress raw Rails paths, source bodies, command arguments, secret-like values, and new repository-specific identifiers. |
| G6 Typecheck and full Vitest suite | yes | pending | |
| G7 Plugin/package gates selected by current verification plan | yes | pending | |
| G8 Durable promotion, review, closure and archive checks | yes | pending | |

## Validation Commands

| Command | Purpose | Result | Evidence |
|---------|---------|--------|----------|
| focused Vitest files identified by Agent Workbench verification planning | Ruby/Rails fixtures and regressions | pending | `tests/graph/extraction-pipeline.test.ts`; `tests/graph/resource-extractor-rules.test.ts`; `tests/application/validation-planner-rules.test.ts`; `tests/mcp/context-for-task-tool.test.ts`; `tests/mcp/repo-scope-overview-resource.test.ts`; `tests/mcp/verification-plan-tool.test.ts`; `tests/workspace/path-policy-consistency.test.ts`; `tests/workspace/command.test.ts`; `tests/telemetry/boundary-instrumentation.test.ts`; `tests/mcp/telemetry-instrumentation.test.ts` |
| `pnpm typecheck` | TypeScript contract and boundary correctness | pending | |
| `pnpm test` | Full runtime regression suite | pending | |
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
| Permissions and approval points | user authorised requirements-package remediation only; runtime implementation requires a later request | No runtime implementation authority in this turn. |
| Validation commands | planned above; refresh with verification tools before execution | Commands are not yet executed. |
| Review needs | focused plan review passed; architecture review if schemas/graph kinds change; implementation and security evidence review before closure | Telemetry-suppression proof is pending and security readiness is not claimed. |
| Durable-doc or closure impact | change-impact promotion table | All promotion pending. |

## Task Evidence

| Task ID | Status | Evidence | Notes |
|---------|--------|----------|-------|
| T001-T008 | pending | none | Implementation has not started. |

## Evidence Log

| Date | Evidence | Result | Notes |
|------|----------|--------|-------|
| 2026-08-01 | Spec package authoring and lifecycle lint | passed | Lifecycle lint and package structure checks reported zero diagnostics. |
| 2026-08-01 | Requirement identifier and AC traceability reconciliation | advisory pass | Current-session MCP `stage_readiness` for this spec mapped 19 of 19 acceptance criteria with zero acceptance/context gaps; rerun before T001 because no durable payload is stored. |
| 2026-08-01 | Manual `review-work-products` design review of `design.md`, package traceability, and current source seams | blocked | Five scoped findings: project-shape ownership/transport, stat-backed identity, Rails credential policy, validation ranking/safety, and evidence state. |
| 2026-08-01 | Focused manual re-review of `design.md`, `requirements.md`, `tasks.md`, and `traceability.md` | plan passed | Plan-structure warnings were corrected. Runtime and security evidence remains pending at G2-G8; this result is not implementation or security sign-off. |

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
- **Ready for feature implementation after T001/T002:** no; reconciliation and
  failing fixtures remain required first
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
