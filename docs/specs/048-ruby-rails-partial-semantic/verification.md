---
title: Ruby and Rails partial-semantic verification
doc_type: spec
artifact_type: verification
status: draft
owner: platform
last_reviewed: 2026-08-01
---

# Verification

## Scope

Validate Spec 048 requirements R1-R5 and tasks T001-T010 after Spec 047 is
delivered and reconciled. Planned commands below are not executed evidence.

## Quality Gates

| Gate | Required? | Status | Evidence |
|------|-----------|--------|----------|
| G1 Spec 047 dependency reconciliation and form freeze | yes | blocked by dependency | |
| G2 Native tree-sitter Ruby build/load/package checks | yes | pending | |
| G3 Parser failure and no-fallback fixtures | yes | pending | |
| G4 Declaration, identity, duplicate and dynamic-form fixtures | yes | pending | |
| G5 Reference, resolver, ambiguity and impact fixtures | yes | pending | |
| G6 Parser-route coverage and trust golden tests | yes | pending | |
| G7 Rails route/model/concern DSL fixtures | yes | pending | |
| G8 Freshness, workspace safety, diagnostics and response-budget checks | yes | pending | |
| G9 Typecheck and full Vitest suite | yes | pending | |
| G10 Plugin/package/install smoke and Rails dogfood | yes | pending | |
| G11 Architecture, implementation, security/trust and closure review | yes | pending | |

## Validation Commands

| Command | Purpose | Result | Evidence |
|---------|---------|--------|----------|
| `pnpm rebuild:native` | Build approved native parser dependencies when needed | pending | |
| focused Vitest files selected by verification planning | Ruby/Rails parser, graph, query, failure and freshness behavior | pending | |
| `pnpm typecheck` | Type and layer correctness | pending | |
| `pnpm test` | Full runtime regression suite | pending | |
| `pnpm validate:plugin` | Packaged integration consistency | pending | |
| `pnpm pack:dry-run` | Ruby grammar/runtime package contents | pending | |
| installed-package MCP smoke | Native load and public query behavior | pending | |
| lifecycle lint, review and closure checks | Package and closure integrity | pending | |

## Requirement Coverage

| Requirement | Acceptance criteria covered | Evidence | Residual risk |
|-------------|-----------------------------|----------|---------------|
| R1 | AC1-AC3 | pending | Native platform variance |
| R2 | AC1-AC3 | pending | Ruby dynamic identity |
| R3 | AC1-AC3 | pending | Dynamic dispatch and runtime constant lookup |
| R4 | AC1-AC3 | pending | Rails metaprogramming and engine behavior |
| R5 | AC1-AC4 | pending | Representative fixtures cannot prove all applications |

## Agent Readiness Evidence

| Field | Evidence | Residual risk |
|-------|----------|---------------|
| Scope and dependency | requirements, design, T001 | Blocked until Spec 047 delivery. |
| Must-read context | full Spec 047/048 packages plus canonical durable owners | Sources may drift. |
| Permissions | user authorised spec creation only; implementation needs later request | No coding authority in this turn. |
| Validation | planned gates above; refresh immediately before execution | Nothing executed yet. |
| Review needs | architecture, implementation, security/trust | Reviewers not assigned. |
| Durable-doc impact | change-impact and canonical-context promotion maps | All pending. |

## Scope Reconciliation Before Closure

| Broad target | Implemented in this spec | Coverage state | Deferred work | Destination | Blocks closure? | Evidence |
|--------------|--------------------------|----------------|---------------|-------------|-----------------|----------|
| One canonical Ruby parser path | none | not-covered | all | Spec 048 tasks | yes | pending |
| Calibrated Ruby partial semantics | none | not-covered | all | Spec 048 tasks | yes | pending |
| Rails DSL relationships | none | not-covered | all | Spec 048 tasks or explicit follow-up | yes until disposition | pending |
| Whole-program Ruby/Rails semantics | none | out-of-scope | dynamic behavior | backlog/focused follow-up | no after routing | design boundary |
| Persisted large-repo completion | none | out-of-scope | graph scale | EB014 | no | design boundary |

## Task Evidence

| Task ID | Status | Evidence | Notes |
|---------|--------|----------|-------|
| T001 | blocked | none | Awaits Spec 047 delivery and reconciliation. |
| T002-T010 | pending | none | Implementation has not started. |

## Evidence Log

| Date | Evidence | Result | Notes |
|------|----------|--------|-------|
| 2026-08-01 | Spec package authoring and lifecycle lint | pending final package validation | Spec 048 remains blocked by Spec 047; no implementation validation performed. |

## Residual Risks

- Ruby and Rails are highly dynamic; partial-semantic evidence must remain
  calibrated to supported static forms.
- Native tree-sitter packaging must be proven across supported Node/platform
  combinations.
- EB014 remains the owner for completing very large graphs beyond first-pass
  budgets.

## Durable Promotion And Cleanup

| Spec content | Durable destination or deferral | Status | Evidence |
|--------------|---------------------------------|--------|----------|
| Supported forms, architecture and limitations | `docs/design/language-adapter-design.md` | pending | |
| Current capability | `docs/reference/language-capability-matrix.md` | pending | |
| Coverage/trust contract | runtime contracts and MCP design if changed | pending | |
| Resolution/storage behavior | graph-store design if changed | pending | |
| EB010/EB061 and deeper semantics | backlog or focused follow-up | pending | |
| User-visible capability | agent-readable changelog and dogfood ledger | pending | |

### Spec Cleanup Decision

- **Cleanup action:** remove after promotion and closure evidence
- **Final spec commit:** pending
- **Closure log path:** `docs/history/spec-closure-log.md`
- **Closure cleanup commit:** pending
- **Active indexes updated:** no

## Ship Or Closure Risk

- **Risk level:** high
- **Breaking change:** no
- **Blast radius checked:** no
- **Rollback path:** remove Ruby parser registration/dependency and retain Spec
  047 resource-backed behavior
- **Requires human review:** yes
- **Release notes needed:** yes
- **Follow-up issue or spec needed:** likely for deeper dynamic semantics

## Readiness Decision

- **Ready to implement:** no, blocked by Spec 047 and required design reviews
- **Ready for promotion:** no
- **Ready for release:** no
- **Ready for closure:** no

## Related Artifacts

- Requirements: `requirements.md`
- Change Impact: `change-impact.md`
- Design: `design.md`
- Tasks: `tasks.md`
- Traceability: `traceability.md`
