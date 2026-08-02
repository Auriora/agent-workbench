---
title: Rails routing concern identity tasks
doc_type: spec
artifact_type: tasks
status: draft
owner: platform
last_reviewed: 2026-08-02
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Tasks

**Input:** `requirements.md`, `design.md`, `research.md`, and
`change-impact.md`

## Task Dependency Graph

```text
T001 -> T002 -> T003 -> T004 -> T005 -> T006
```

## Phase 1: Reviewed implementation context

- [x] T001 Reconcile requirements, official Rails behavior, repository seams,
  and the accepted source-distinct graph design.
  - Depends on: none
  - Requirement: Requirement 1, Requirement 2, Requirement 3, Requirement 4, Requirement 5
  - Files: Spec 050 requirements, research, canonical context, change impact,
    and design
  - Acceptance: Requirements and design MoE gates have no unresolved blocker.
  - Evidence mode: planner
  - Evidence: On 2026-08-02, independent requirements/QA and lifecycle reviewers
    reviewed `README.md` and `requirements.md`; B1 literal syntax, B2
    task-context acceptance, and W1 dogfood naming were amended and each was
    confirmed resolved. Independent architecture, requirements/QA, and
    lifecycle reviewers then reviewed `design.md`, `research.md`,
    `canonical-context.md`, and `change-impact.md`; the multi-hop provenance
    blocker, task-context test warning, direct-operand ambiguity, and stale
    stage wording were amended and confirmed resolved. Architecture re-review
    confirmed the pre-existing reopened class/module identity issue does not
    collide with Spec 050 source-distinct concern identities.

## Phase 2: Executable behavior

- [x] T002 Add fixture-backed parser and graph tests for routing concern
  identity, supported reuse, scope, ambiguity, dynamic forms, provenance, and
  cycles.
  - Depends on: T001
  - Requirement: Requirement 1 AC1-AC4; Requirement 2 AC1-AC5; Requirement 3 AC1-AC3; Requirement 5 AC1-AC3
  - Properties: CP-001, CP-002, CP-003, CP-004, CP-005
  - Files: `tests/adapters/ruby-parser.test.ts`,
    `tests/graph/ruby-semantic-extraction.test.ts`,
    `tests/fixtures/fixture-ruby-semantic-repo/config/routes.rb`
  - Acceptance: Tests distinguish supported symbols from unsupported forms,
    preserve duplicate nodes, prove finite provenance-rich traversal, and prove
    that adding `concerns:` does not suppress the ordinary `resource` or
    `resources` route reference.
  - Evidence mode: validation
  - Evidence: Focused Vitest passed 54/54 across parser, graph, and task-context files; broader Ruby/Rails-adjacent Vitest passed 260/260. Fixtures prove route-file domain gating, static/dynamic operands with scope, missing/duplicate outcomes, cycles, provenance, and ordinary resource-edge preservation.

  - Status: Parser, resolver, fixture, and focused test slice delegated as one tightly coupled implementation unit.
- [x] T003 Implement concern declaration/reuse extraction and unique graph
  resolution through the existing Ruby path.
  - Depends on: T002
  - Requirement: Requirement 1, Requirement 2, Requirement 3, Requirement 4, Requirement 5
  - Properties: CP-001-CP-006
  - Files: `src/infrastructure/tree-sitter/ruby-parser.ts`,
    `src/application/use-cases/index-repository-graph.ts`
  - Acceptance: Focused tests pass with no schema, executable, alternate
    parser, MCP adapter, or parallel query path.
  - Evidence mode: implementation
  - Evidence: Implemented `rails_route_concern` declarations and concern-scoped contained references in ruby-parser.ts; implemented direct, array, mixed, and resource-option reuse; graph resolver selects only exactly one matching concern node. `pnpm typecheck` and focused/broader tests pass; no schema, MCP, executable, fallback, or parallel query path changed.

- [x] T004 Validate existing reference, impact, and task-context surfaces.
  - Depends on: T003
  - Requirement: Requirement 3 AC1-AC3; Requirement 4 AC1-AC4; Requirement 5 AC1-AC3
  - Properties: CP-002, CP-003, CP-005, CP-006
  - Files: `tests/graph/ruby-semantic-extraction.test.ts`,
    `tests/mcp/context-for-task-tool.test.ts`
  - Acceptance: Existing graph traversal exposes the two-edge provenance path,
    task context ranks concern identity and routes graph follow-up, and bounded
    failure behavior remains unchanged.
  - Evidence mode: validation
  - Evidence: Graph tests prove incoming reuse-edge scope plus outgoing concern-contained route provenance, unique/missing/ambiguous resolution, finite cyclic edges, and public findReferences/computeImpact behavior. Existing task context ranks the concern node. Focused 54/54 and broader 260/260 tests pass.

## Phase 3: Promotion and final evidence

- [x] T005 Run regression and two-project read-only Rails dogfood validation,
  then promote verified durable behavior.
  - Depends on: T004
  - Requirement: SC-003, SC-004, SC-005
  - Files: Canonical durable targets named in `change-impact.md`
  - Acceptance: Typecheck, focused tests, bounded full suite, and both dogfood
    runs are recorded; target worktrees remain unchanged; durable docs make no
    universal claim.
  - Evidence mode: validation
  - Evidence: After implementation-review fixes, `pnpm typecheck`, focused 54/54, broader Ruby/Rails 260/260, full 1176/1176, and `git diff --check` passed. Final warm-graph read-only sweeps returned 47 full, 3 partial, 4 intentional degraded, zero blocked/invalid; target worktrees stayed clean. New-form proof remains fixture-backed; five durable owners contain bounded claims.

- [x] T006 Run implementation MoE review, address findings, and reconcile
  closure readiness without closing or committing unless separately requested.
  - Depends on: T005
  - Requirement: Requirement 1, Requirement 2, Requirement 3, Requirement 4, Requirement 5; SC-001-SC-005
  - Files: Complete Spec 050 worktree slice
  - Acceptance: Architecture, QA, and lifecycle/evidence reviewers have no
    unresolved blocker; verification and traceability match actual evidence.
  - Evidence mode: validation
  - Evidence: Implementation MoE completed across architecture, requirements/QA, and lifecycle/evidence. QA blocker for non-route concern capture and three test/provenance warnings were fixed and confirmed resolved; lifecycle metadata drift was fixed and confirmed resolved; architecture found no high-confidence blocker. Post-fix gates pass: 54/54 focused, 260/260 broader, typecheck, 1176/1176 full, diff check, and final two-repo warm sweeps with zero blocked/invalid.

Post-implementation reconciliation on 2026-08-02 reviewed the final requirement
and design wording against T001-T006; no task or dependency change was required.
