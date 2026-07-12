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

- [ ] T001 Record current output budgets and specify the compact orientation
  receipt contract.
  - Requirement: Requirement 2; Properties: CP-001, CP-005
  - Files: orientation contracts/resources, representative golden fixtures,
    `verification.md`
  - Acceptance: Existing startup, status, scope, overview, and task-context
    byte/latency baselines are recorded; the additive receipt contains only
    snapshot identity, freshness/trust summary, material blockers, and detail
    links; material invalidation is distinguished from ordinary content edits.
  - Evidence: Pending.

- [ ] T002 Add controlled usefulness and no-noise fixtures for existing
  continuation and navigation.
  - Requirements: Requirements 3 and 4; Properties: CP-002, CP-005
  - Files: context, query, and adjudicated workflow fixtures; `verification.md`
  - Acceptance: Fixtures cover no-action, one-action, capped multi-action,
    definition-only, references-only, impact-needed, unsupported, paraphrased,
    and already-satisfied cases with expected evidence and decision counts.
  - Evidence: Pending.

## Phase 2: Runtime And Provider Behavior

- [ ] T003 Implement orientation, continuation, and navigation contracts.
  - Depends on: T001, T002
  - Requirements: Requirements 2, 3, and 4
  - Files: `src/application/use-cases/`, `src/contracts/`,
    `src/interface-adapters/mcp/`, matching `tests/`
  - Acceptance: Selected contracts return bounded, callable, trust-calibrated
    evidence with no parser, semantic, validation, or command fallback.
  - Evidence: Pending.
  - [ ] T003.1 Add failing contract and golden fixtures.
  - [ ] T003.2 Implement application policy and thin presenters.
  - [ ] T003.3 Add budget, degraded, blocked, and unsupported fixtures.
  - [ ] T003.4 Cover CP-001 and CP-002 with deterministic tests.

- [ ] T004 Implement executable Claude activation and cross-client guidance.
  - Depends on: none
  - Requirements: Requirement 1; Properties: CP-004, CP-005
  - Files: `plugins/agent-workbench/claude-plugin/`, shared packaged skills,
    plugin validation and integration tests
  - Acceptance: Claude exposes one resolvable first action while all providers
    retain the MCP runtime contract and thin-wrapper boundary; guidance is
    conditional, deduplicated, non-automatic, and within the startup budget.
  - Evidence: Pending.

- [ ] T005 Implement intent-aware validation recommendation policy.
  - Depends on: T002
  - Requirement: Requirement 5; Properties: CP-003, CP-005
  - Files: task-context and verification-planning use cases, presenters, skills,
    and matching tests
  - Acceptance: Explicit intent and task-owned changes take precedence;
    unrelated dirty files and ambiguous intent stay neutral; read-only fixtures
    remain concise; unchanged advice is not repeated; no result implies command
    execution.
  - Evidence: Pending.

## Phase 3: Validation And Promotion

- [ ] T006 Run focused and full validation.
  - Depends on: T005
  - Requirements: R1-R5; Properties: CP-001-CP-005
  - Files: `verification.md`
  - Acceptance: Plugin validation, typecheck, focused tests, full tests, spec
    lint, Markdown checks, compatibility checks, and controlled workflow
    non-regression gates pass or have explicit blockers and residual risk.
  - Evidence: Pending.

- [ ] T007 Promote accepted behavior and prepare closure.
  - Depends on: T006
  - Files: `docs/design/coding-agent-integration-design.md`,
    `docs/design/mcp-surface-design.md`,
    `docs/design/edit-and-validation-loop-design.md`, optional runtime/language
    contract owners, backlog and history records
  - Acceptance: Current behavior is durable, residual work has one destination,
    review findings are resolved, and closure checks pass before package removal.
  - Evidence: Pending.

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
