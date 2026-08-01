---
title: Ruby and Rails partial-semantic tasks
doc_type: spec
artifact_type: tasks
status: draft
owner: platform
last_reviewed: 2026-08-01
---

# Tasks

**Input:** All artifacts in `docs/specs/048-ruby-rails-partial-semantic/`

## Task Dependency Graph

```text
Spec 047 -> T001 -> T002 -> T003 -> T004 -> T005 -> T006 -> T007 -> T008 -> T009 -> T010
```

## Phase 1: Dependency and parser foundation

- [!] T001 Reconcile delivered Spec 047 behavior and freeze the Ruby parser
  promotion boundary.
  - Depends on: Spec 047 implementation and reconciliation
  - Upstream specs: `docs/specs/047-ruby-rails-resource-discovery`
  - Requirements: Requirement 1, Requirement 5
  - Files: Spec 047 evidence, delivered Ruby/Rails source/tests, this package
  - Acceptance: Resource-backed behavior, fixtures, validation policy, exact
    supported Ruby/Rails forms, and residual gaps are reconciled before coding.
  - Status: blocked - Spec 047 implementation and reconciliation are not yet complete.
  - Evidence: Pending.

- [ ] T002 Add and validate the tree-sitter Ruby native dependency and package
  integration.
  - Depends on: T001
  - Requirements: Requirement 1
  - Properties: CP-004
  - Files: `package.json`, lockfile, package manifest, native rebuild/install
    scripts and tests
  - Acceptance: Supported Node/platform paths can load the grammar; failures
    produce explicit native/parser errors without fallback.
  - Evidence: Pending.

- [ ] T003 Implement the Ruby parser adapter and structured failure boundary.
  - Depends on: T002
  - Requirements: Requirement 1
  - Properties: CP-001, CP-004
  - Files: `src/infrastructure/tree-sitter/ruby-*`, exports, focused parser tests
  - Acceptance: One parse path produces valid ranges or a structured complete
    failure; no partial extraction or alternate parser exists.
  - Evidence: Pending.

## Phase 2: Ruby graph evidence

- [ ] T004 Implement Ruby declaration extraction and stable identity rules.
  - Depends on: T003
  - Requirements: Requirement 2
  - Properties: CP-001, CP-002
  - Files: Ruby extractor and graph extraction fixtures
  - Acceptance: Supported declarations, nesting, inheritance metadata,
    reopened/duplicate ambiguity, and unsupported forms match fixtures.
  - Evidence: Pending.

- [ ] T005 Implement bounded Ruby reference extraction.
  - Depends on: T004
  - Requirements: Requirement 3 AC1
  - Properties: CP-001, CP-003
  - Files: Ruby extractor, reference fixtures
  - Acceptance: Approved loading, constant, inheritance, and call forms carry
    exact source ranges, form metadata, provenance, and confidence.
  - Evidence: Pending.

- [ ] T006 Integrate conservative Ruby resolution, reference queries, impact,
  and coverage-domain disclosure.
  - Depends on: T005
  - Requirements: Requirement 3 AC2-AC3, Requirement 5 AC2
  - Properties: CP-002, CP-003
  - Files: graph resolution, query/context presentation, generic contracts if
    required, query and MCP golden tests
  - Acceptance: Only unique targets resolve; ambiguity persists; all Ruby
    reference results disclose parser-route scope without whole-program claims.
  - Evidence: Pending.

## Phase 3: Rails framework evidence

- [ ] T007 Freeze and test the initial Rails DSL form matrix.
  - Depends on: T006
  - Requirements: Requirement 4, Requirement 5
  - Properties: CP-005
  - Files: Rails fixture sources and expected extraction/query records
  - Acceptance: Each included static route/model/concern form has a positive,
    ambiguous, and dynamic/unsupported counterpart with expected confidence.
  - Evidence: Pending.

- [ ] T008 Implement bounded Rails route and model DSL extraction.
  - Depends on: T007
  - Requirements: Requirement 4
  - Properties: CP-001, CP-002, CP-005
  - Files: Ruby extractor Rails visitors, graph/query/context tests
  - Acceptance: Fixture-approved DSL forms improve navigation while dynamic or
    environment-dependent behavior remains unresolved or unsupported.
  - Evidence: Pending.

## Phase 4: Verification, dogfood, and closure

- [ ] T009 Run freshness, failure, focused/full validation, installed-package
  smoke, and bounded Rails dogfood review.
  - Depends on: T008
  - Requirements: Requirement 1, Requirement 2, Requirement 3, Requirement 4, Requirement 5
  - Properties: CP-001-CP-005
  - Files: `verification.md`, runtime/workspace/package tests, dogfood ledger
  - Acceptance: Add/modify/delete/rename, parser failure, native packaging,
    query trust, full regressions, and one real Rails solution are evidenced
    with limitations and no fallback behavior.
  - Evidence: Pending.

- [ ] T010 Complete expert review, durable promotion, residual routing, and
  lifecycle closure preparation.
  - Depends on: T009
  - Requirements: Requirement 5
  - Files: language adapter design, capability matrix, runtime contracts if
    changed, graph design if changed, backlog, changelog, ledger, history
  - Acceptance: Architecture and implementation findings are resolved or
    routed; `partial_semantic` limits are durable; deeper Ruby/Rails work has
    one owner; closure checks pass.
  - Evidence: Pending.

## Execution Rules

- Do not start T002 until T001 verifies Spec 047 is delivered and current.
- Read the full package and durable sources before each implementation slice.
- Mark only one implementation task `[~]` at a time.
- Tree-sitter Ruby is the only primary parser. Do not add AST, LSP, Sorbet,
  RuboCop, Solargraph, Ruby LSP, Rails runner, lexical, shell, or retry fallback.
- Return structured failure rather than partial results after parser failure.
- Keep MCP adapters thin and public contracts language-neutral.
- Record exact commands, results, skipped checks, limitations, expert review,
  and promotion evidence before task completion.

## Related Artifacts

- Requirements: `requirements.md`
- Change Impact: `change-impact.md`
- Design: `design.md`
- Traceability: `traceability.md`
- Verification: `verification.md`
