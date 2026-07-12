---
title: Agent Workbench adoption flow tasks
doc_type: spec
artifact_type: tasks
status: draft
owner: platform
last_reviewed: 2026-07-12
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Tasks

**Input:** `docs/specs/038-agent-workbench-adoption-flow/`

## Dependency Graph

```text
T001 + T002 -> T003
T002 -> T005
T001 + T003 + T004 + T005 -> T006 -> T007
```

## Phase 1: Baselines And Guardrails

- [x] T001 Record current output budgets and specify the compact orientation
  receipt contract.
  - Requirement: Requirement 2; Properties: CP-001, CP-005
  - Files: orientation contracts/resources, representative golden fixtures,
    `verification.md`
  - Acceptance: Existing startup, status, scope, overview, and task-context
    byte/latency baselines are recorded; the additive receipt contains only
    snapshot identity, freshness/trust summary, material blockers, and detail
    links; material invalidation is distinguished from ordinary content edits.
  - Evidence: Compact receipt budgets and watcher reuse policy are verified; synchronized content refresh avoids repeated orientation while material watcher/scope failures block reuse.
  - [x] T001.1 Define material watcher-state reuse behavior and add degraded,
    failed, unavailable, refreshing, and pending fixtures.
    - Review finding: AWB-038-REV-005
    - Files: orientation use case and resource tests
    - Acceptance: The receipt never claims reusable orientation while watcher
      evidence needed for safe orientation is failed, unavailable, or materially
      refreshing.
    - Evidence: Watcher materiality fixtures cover degraded, overflowed, failed, unavailable, refreshing/pending, and changed/unknown scope; 9 orientation tests pass.

- [x] T002 Add controlled usefulness and no-noise fixtures for existing
  continuation and navigation.
  - Requirements: Requirements 3 and 4; Properties: CP-002, CP-005
  - Files: context, query, and adjudicated workflow fixtures; `verification.md`
  - Acceptance: Fixtures cover no-action, one-action, capped multi-action,
    definition-only, references-only, impact-needed, unsupported, paraphrased,
    and already-satisfied cases with expected evidence and decision counts.
  - Evidence: Controlled usefulness/no-noise fixtures now cover schema callability, relevance, intent, collision priority, repeat guidance, and bounded response cost.
  - [x] T002.1 Add normal-client schema, unrelated-symbol, definition-only,
    unknown/conflicting-intent, and action-cap collision fixtures.
    - Review findings: AWB-038-REV-001 through AWB-038-REV-004
    - Files: context, registry, graph, and integration tests
    - Acceptance: Every returned action parses against its exposed normal-client
      schema and every negative fixture omits irrelevant actions.
    - Evidence: Normal-client schema, hostile lifecycle action, unrelated/definition-only symbol, unknown/negated intent, and action-cap collision fixtures pass in context-for-task-tool.test.ts.
  - [x] T002.2 Add comparative CP-005 evidence for actions, caller decisions,
    round trips, and default response bytes.
    - Review finding: AWB-038-REV-006
    - Files: controlled workflow integration fixtures; `verification.md`
    - Acceptance: Baseline and proposed outputs are measured on the same
      adjudicated cases and any regression has an explicit accepted benefit.
    - Evidence: Controlled fixtures reduce irrelevant/repeated actions to zero, cap decisions at three, and bound the accepted public explanation-field increase to <=512 bytes.

## Phase 2: Runtime And Provider Behavior

- [x] T003 Implement orientation, continuation, and navigation contracts.
  - Depends on: T001, T002
  - Requirements: Requirements 2, 3, and 4
  - Files: `src/application/use-cases/`, `src/contracts/`,
    `src/interface-adapters/mcp/`, matching `tests/`
  - Acceptance: Selected contracts return bounded, callable, trust-calibrated
    evidence with no parser, semantic, validation, or command fallback.
  - Evidence: Orientation, continuation, and navigation contracts now return bounded, callable, relevance-gated, trust-calibrated evidence with no fallback route.
  - [x] T003.1 Add failing contract and golden fixtures.
    - Evidence: Contract fixtures cover public schema parsing, action explanations, intent negatives, watcher materiality, and provider behavior; focused suites pass.
  - [x] T003.2 Implement application policy and thin presenters.
    - Evidence: `get-repo-orientation.ts`, `repo-orientation-presenter.ts`, and
      `registries/resources/repo-orientation.ts` pass typecheck.
  - [x] T003.3 Add budget, degraded, blocked, and unsupported fixtures.
    - Evidence: Orientation fixtures cover ordinary stale/pending content and degraded, overflowed, failed, unavailable, changed, and unknown material states.
  - [x] T003.4 Cover CP-001 and CP-002 with deterministic tests.
    - Evidence: CP-001 and CP-002 are covered by deterministic orientation equivalence and public continuation schema/relevance tests.
  - [x] T003.5 Build continuations from exposed normal-client action schemas.
    - Review finding: AWB-038-REV-001
    - Acceptance: Normal-client actions omit hidden root-override arguments.
    - Evidence: Generated and lifecycle continuations omit server-owned roots; lifecycle candidates are allowlisted and parsed through canonical request schemas.
  - [x] T003.6 Gate graph actions on an explicit symbol or named unresolved
    uncertainty and preserve safety-critical action priority.
    - Review findings: AWB-038-REV-002, AWB-038-REV-004
    - Acceptance: Definition-only or unrelated-ranked-symbol tasks do not
      receive references/impact, and explicit edit validation survives the cap.
    - Evidence: Graph actions require exact requested-symbol relevance; explicit edit/closure validation remains first under the three-action cap.
- [x] T004 Implement executable Claude activation and cross-client guidance.
  - Depends on: none
  - Requirements: Requirement 1; Properties: CP-004, CP-005
  - Files: `plugins/agent-workbench/claude-plugin/`, shared packaged skills,
    plugin validation and integration tests
  - Acceptance: Claude exposes one resolvable first action while all providers
    retain the MCP runtime contract and thin-wrapper boundary; guidance is
    conditional, deduplicated, non-automatic, and within the startup budget.
  - Evidence: `claude-plugin.test.ts`, `hook-cli-compatibility.test.ts`, and
    `pnpm validate:plugin` pass; startup injection is zero bytes.

- [x] T005 Implement intent-aware validation recommendation policy.
  - Depends on: T002
  - Requirement: Requirement 5; Properties: CP-003, CP-005
  - Files: task-context and verification-planning use cases, presenters, skills,
    and matching tests
  - Acceptance: Explicit intent and task-owned changes take precedence;
    unrelated dirty files and ambiguous intent stay neutral; read-only fixtures
    remain concise; unchanged advice is not repeated; no result implies command
    execution.
  - Evidence: Intent precedence, material lifecycle evidence, validation priority, and stateless repeat-guidance suppression are implemented and fixture-proven.
  - [x] T005.1 Keep explicit unknown and conflicting or negated intent neutral.
    - Review finding: AWB-038-REV-003
    - Acceptance: Unknown/conflicting fixtures omit prominent impact and
      validation unless a later explicit caller decision changes the intent.
    - Evidence: Explicit unknown, read-only/review, conflicting, and negated edit/closure language remains neutral across parameterized fixtures.
  - [x] T005.2 Reserve prominent validation for explicit edit or closure intent
    when action candidates exceed the response cap.
    - Review finding: AWB-038-REV-004
    - Evidence: Four-candidate collision fixture proves explicit edit/closure verification_plan remains the primary action.
  - [x] T005.3 Resolve the stateless prior-guidance contract and implement or
    explicitly revise phase-level deduplication acceptance criteria.
    - Review finding: AWB-038-REV-006
    - Decision owner: platform
    - Evidence: Optional satisfied_actions tool/argument pairs provide stateless phase deduplication; repeat-call fixture omits unchanged guidance.

## Phase 3: Validation And Promotion

- [x] T006 Run focused and full validation.
  - Depends on: T005
  - Requirements: R1-R5; Properties: CP-001-CP-005
  - Files: `verification.md`
  - Acceptance: Plugin validation, typecheck, focused tests, full tests, spec
    lint, Markdown checks, compatibility checks, and controlled workflow
    non-regression gates pass or have explicit blockers and residual risk.
  - Evidence: pnpm typecheck, pnpm validate:plugin, focused suites, full 597-test suite, spec lint, docs links, Markdown checks, and fresh-context review pass.

- [x] T007 Promote accepted behavior and prepare closure.
  - Depends on: T006
  - Files: `docs/design/coding-agent-integration-design.md`,
    `docs/design/mcp-surface-design.md`,
    `docs/design/edit-and-validation-loop-design.md`, optional runtime/language
    contract owners, backlog and history records
  - Acceptance: Current behavior is durable, residual work has one destination,
    review findings are resolved, and closure checks pass before package removal.
  - Evidence: Accepted orientation, continuation, intent, action schema, and satisfied_actions behavior is promoted to durable MCP, validation-loop, and runtime-contract docs.

## Execution Rules

- Read the requirement, design, traceability, and verification row before each
  task; do not implement from this checklist alone.
- Mark a selected task `[~]` before edits and record evidence before completion.
- Keep MCP adapters thin and preserve layered architecture boundaries.
- Do not add primary-plus-fallback routes or partial timeout success.

## Related Artifacts

- Requirements: `requirements.md`
- Design: `design.md`
- Traceability: `traceability.md`
- Verification: `verification.md`
