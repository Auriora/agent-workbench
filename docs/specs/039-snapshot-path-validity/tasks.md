---
title: Snapshot path validity tasks
doc_type: spec
artifact_type: tasks
status: draft
owner: platform
last_reviewed: 2026-07-19
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Tasks

## Task Dependency Graph

```text
T001 -> T002 -> T003
T002 -> T004
T002 -> T005
T003 + T004 + T005 -> T006 -> T007
```

## Phase 1: Contract And Validity Boundary

- [ ] T001 Lock failing index-then-delete fixtures and the shared validity
  contract.
  - Depends on: none
  - Requirements: Requirement 1, Requirement 2, Requirement 3, Requirement 4,
    Requirement 5; Properties: CP-001-CP-005
  - Files: runtime/orientation/response/graph/docs contracts; fixture helpers;
    focused contract and MCP tests
  - Acceptance: Failing tests reproduce freshness disagreement, raw graph
    `ENOENT`, stale docs counts/search hits, and incomplete-budget behavior
    without depending on the live repository cache.
  - Evidence mode: contract
  - Evidence: Pending.
  - [ ] T001.1 Reproduce same-snapshot freshness disagreement.
  - [ ] T001.2 Reproduce deleted-node graph failure as a contract fixture.
  - [ ] T001.3 Reproduce stale docs count/FTS rows and low-budget validity.

- [ ] T002 Implement the application-owned snapshot-validity receipt and
  existing stale/refresh transition.
  - Depends on: T001
  - Requirements: Requirement 1, Requirement 5; Properties: CP-001, CP-005
  - Files: `src/application/use-cases/`, `src/domain/models/runtime.ts`,
    `src/ports/`, workspace/catalog infrastructure, server composition
  - Acceptance: Complete validation may prove valid; missing, inaccessible, or
    incomplete evidence cannot. Material deletion schedules one existing
    refresh path without an inline rebuild or parallel indexer.
  - Evidence mode: implementation
  - Evidence: Pending.
  - [ ] T002.1 Define the receipt, port, and bounded cache key.
  - [ ] T002.2 Implement valid, missing, inaccessible, and incomplete outcomes.
  - [ ] T002.3 Connect material invalidity to one existing refresh coordinator.

## Phase 2: Consumers And Persistence

- [ ] T003 Make status, orientation, task context, docs, and graph helpers
  consume the same snapshot validity/freshness decision.
  - Depends on: T002
  - Requirements: Requirement 2; Property: CP-002
  - Files: `get-repo-status.ts`, `get-repo-orientation.ts`,
    `get-task-context.ts`, `query-docs.ts`, `query-helpers.ts`, presenters and
    resource registries
  - Acceptance: Public surfaces agree for the same snapshot or name a separate
    scan/watcher dimension; `context_for_task` no longer hardcodes conflicting
    freshness.
  - Evidence mode: implementation
  - Evidence: Pending.
  - [ ] T003.1 Compose validity into status and orientation.
  - [ ] T003.2 Compose the same evidence into task, docs, and graph helpers.
  - [ ] T003.3 Prove scan/watcher dimensions remain separately explained.

- [ ] T004 Gate graph traversal on relevant path validity and use the shared
  MCP failure envelope.
  - Depends on: T002
  - Requirements: Requirement 3; Property: CP-003
  - Files: `find-references.ts`, `compute-impact.ts`, `search-symbols.ts`, graph
    query helpers, presenters, `find_references` and `impact` registries
  - Acceptance: Deleted-node queries return bounded stale/degraded evidence;
    unexpected errors use the common classifier; no raw `ENOENT`, retry, or
    alternate scan appears.
  - Evidence mode: implementation
  - Evidence: Pending.
  - [ ] T004.1 Add relevant-path preflight and stale/degraded use-case results.
  - [ ] T004.2 Adopt the shared MCP classifier for unexpected provider errors.
  - [ ] T004.3 Add deleted-node and negative failure-mode tests.

- [ ] T005 Make graph-store file removal prune docs, headings, FTS, graph, and
  coverage state consistently.
  - Depends on: T002
  - Requirements: Requirement 4; Property: CP-004
  - Files: SQLite graph store, docs query adapters, extraction/removal tests
  - Acceptance: Removal transaction leaves no searchable/countable orphan docs;
    incomplete pruning makes affected evidence non-fresh.
  - Evidence mode: implementation
  - Evidence: Pending.
  - [ ] T005.1 Prune file, graph, docs, headings, FTS, and coverage rows.
  - [ ] T005.2 Prove counts, inventory, and search exclude removed paths.

## Phase 3: Validation And Promotion

- [ ] T006 Run focused, budget, compatibility, architecture, and full
  validation.
  - Depends on: T003, T004, T005
  - Requirements: Requirement 1, Requirement 2, Requirement 3, Requirement 4,
    Requirement 5; Properties: CP-001-CP-005
  - Files: `verification.md`, relevant tests
  - Acceptance: Targeted Vitest suites, typecheck, plugin validation, full
    tests, lifecycle lint, and diff checks pass or retain explicit blockers.
  - Evidence mode: validation
  - Evidence: Pending.
  - [ ] T006.1 Run focused contract, runtime, graph, docs, and MCP suites.
  - [ ] T006.2 Run typecheck, plugin validation, and the full suite.
  - [ ] T006.3 Run lifecycle, architecture, Markdown, and diff checks.

- [ ] T007 Promote accepted validity, freshness, graph failure, and docs-removal
  behavior and prepare closure.
  - Depends on: T006
  - Requirements: Requirement 1, Requirement 2, Requirement 3, Requirement 4,
    Requirement 5
  - Files: graph-store, runtime-operations, MCP-surface, runtime-contract,
    changelog, backlog, and history docs
  - Acceptance: Durable current-state docs match verified behavior, every
    residual has one destination, and lifecycle closure checks pass before the
    package is removed.
  - Evidence mode: validation
  - Evidence: Pending.
  - [ ] T007.1 Promote accepted behavior to durable owners and changelog.
  - [ ] T007.2 Reconcile residuals, reviews, and closure evidence.

## Execution Rules

- Read requirements, design, traceability, change impact, and verification
  before selecting a task.
- Mark only one implementation task `[~]` at a time and record concrete evidence
  before completion.
- Keep MCP adapters thin and filesystem decisions behind ports.
- Do not add parser, scanner, retry, partial-timeout, or command fallbacks.

## Initial Reconciliation

The final initial design was reviewed against this task split on 2026-07-19.
T001 must resolve D001 and lock the explicit acceptance fixtures before T002
starts; no implementation task is currently in progress.

## Related Artifacts

- Requirements: `requirements.md`
- Change impact: `change-impact.md`
- Design: `design.md`
- Traceability: `traceability.md`
- Verification: `verification.md`
