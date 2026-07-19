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

- [x] T001 Lock failing index-then-delete fixtures and the shared validity
  contract.
  - Depends on: none
  - Requirements: Requirement 1, Requirement 2, Requirement 3, Requirement 4,
    Requirement 5; Properties: CP-001-CP-005
  - Files: runtime/orientation/response/graph/docs contracts; fixture helpers;
    focused contract and MCP tests
  - Acceptance: Failing tests reproduce freshness disagreement, raw graph
    `ENOENT`, stale docs counts/search hits, and incomplete-budget behavior
    without depending on the live repository cache.
  - Evidence mode: validation
  - Evidence: The focused 109-test run passes all index-then-delete, cross-surface freshness, docs pruning, and bounded-budget regression fixtures.
  - Status: Completed and verified on 2026-07-19.
  - [x] T001.1 Reproduce same-snapshot freshness disagreement.
  - Evidence: Fixture-backed status, orientation, and task-context tests reproduce and now prevent same-snapshot freshness disagreement.
  - Status: Completed and verified on 2026-07-19.
  - Evidence mode: validation
  - [x] T001.2 Reproduce deleted-node graph failure as a contract fixture.
  - Evidence: Deleted source and lexical-reference fixtures reproduce and now prevent raw graph path failures.
  - Status: Completed and verified on 2026-07-19.
  - Evidence mode: validation
  - [x] T001.3 Reproduce stale docs count/FTS rows and low-budget validity.

  - Evidence: Deleted docs/FTS and low-budget validity fixtures reproduce stale/degraded behavior.
  - Status: Completed and verified on 2026-07-19.
  - Evidence mode: validation
- [x] T002 Implement the application-owned snapshot-validity receipt and
  existing stale/refresh transition.
  - Depends on: T001
  - Requirements: Requirement 1, Requirement 5; Properties: CP-001, CP-005
  - Files: `src/application/use-cases/`, `src/domain/models/runtime.ts`,
    `src/ports/`, workspace/catalog infrastructure, server composition
  - Acceptance: Complete validation may prove valid; missing, inaccessible, or
    incomplete evidence cannot. Material deletion schedules one existing
    refresh path without an inline rebuild or parallel indexer.
  - Evidence mode: implementation
  - Evidence: Implemented the bounded application-owned validity service and existing refresh coordination without a parallel indexer.
  - Status: Completed and verified on 2026-07-19.
  - [x] T002.1 Define the receipt, port, and bounded cache key.
  - Evidence: Implemented SnapshotValidityReceipt contracts and application/port boundaries; validation is bounded and deliberately uncached until a material generation exists.
  - Status: Completed and verified on 2026-07-19.
  - Evidence mode: implementation
  - [x] T002.2 Implement valid, missing, inaccessible, and incomplete outcomes.
  - Evidence: Snapshot validity outcome tests pass for present, absent, access-error, and path-budget cases; public receipts contain only repository-relative or redacted path evidence.
  - Status: Completed and verified on 2026-07-19.
  - Evidence mode: validation
  - [x] T002.3 Connect material invalidity to one existing refresh coordinator.

  - Evidence: Material invalidity marks the current snapshot stale and schedules at most one existing background warm-up path.
  - Status: Completed and verified on 2026-07-19.
  - Evidence mode: implementation
## Phase 2: Consumers And Persistence

- [x] T003 Make status, orientation, task context, docs, and graph helpers
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
  - Evidence: Public consumers now agree on snapshot validity while preserving distinct scan and watcher dimensions.
  - Status: Completed and verified on 2026-07-19.
  - [x] T003.1 Compose validity into status and orientation.
  - Evidence: Status and orientation compose the shared validity receipt with persisted snapshot and watcher state.
  - Status: Completed and verified on 2026-07-19.
  - Evidence mode: implementation
  - [x] T003.2 Compose the same evidence into task, docs, and graph helpers.
  - Evidence: Task context, docs search, and graph queries consume the same snapshot-specific validity evidence.
  - Status: Completed and verified on 2026-07-19.
  - Evidence mode: implementation
  - [x] T003.3 Prove scan/watcher dimensions remain separately explained.

  - Evidence: Tests preserve scanner and watcher state as separately named evidence dimensions.
  - Status: Completed and verified on 2026-07-19.
  - Evidence mode: validation
- [x] T004 Gate graph traversal on relevant path validity and use the shared
  MCP failure envelope.
  - Depends on: T002
  - Requirements: Requirement 3; Property: CP-003
  - Files: `find-references.ts`, `compute-impact.ts`, `search-symbols.ts`, graph
    query helpers, presenters, `find_references` and `impact` registries
  - Acceptance: Deleted-node queries return bounded stale/degraded evidence;
    unexpected errors use the common classifier; no raw `ENOENT`, retry, or
    alternate scan appears.
  - Evidence mode: implementation
  - Evidence: Graph traversal is validity-gated and no raw ENOENT or successful partial evidence escapes.
  - Status: Completed and verified on 2026-07-19.
  - [x] T004.1 Add relevant-path preflight and stale/degraded use-case results.
  - Evidence: Graph use cases validate the selected snapshot and relevant paths before traversal and return blocked stale/degraded results.
  - Status: Completed and verified on 2026-07-19.
  - Evidence mode: implementation
  - [x] T004.2 Adopt the shared MCP classifier for unexpected provider errors.
  - Evidence: find_references and impact use the shared MCP failure envelope; ENOENT is classified as stale evidence.
  - Status: Completed and verified on 2026-07-19.
  - Evidence mode: implementation
  - [x] T004.3 Add deleted-node and negative failure-mode tests.

  - Evidence: Deleted-node, deleted lexical-reference, provider-error, and mismatched-snapshot regressions pass.
  - Status: Completed and verified on 2026-07-19.
  - Evidence mode: validation
- [x] T005 Make graph-store file removal prune docs, headings, FTS, graph, and
  coverage state consistently.
  - Depends on: T002
  - Requirements: Requirement 4; Property: CP-004
  - Files: SQLite graph store, docs query adapters, extraction/removal tests
  - Acceptance: Removal transaction leaves no searchable/countable orphan docs;
    incomplete pruning makes affected evidence non-fresh.
  - Evidence mode: implementation
  - Evidence: SQLite removal and authoritative inventory now prevent searchable or countable orphan evidence.
  - Status: Completed and verified on 2026-07-19.
  - [x] T005.1 Prune file, graph, docs, headings, FTS, and coverage rows.
  - Evidence: GraphStore removal transaction prunes file, graph, docs, headings, FTS, and path-scoped coverage state idempotently.
  - Status: Completed and verified on 2026-07-19.
  - Evidence mode: implementation
  - [x] T005.2 Prove counts, inventory, and search exclude removed paths.

  - Evidence: Store/docs fixtures prove counts, inventory, and FTS search exclude removed paths, including docs-only inventory paths.
  - Status: Completed and verified on 2026-07-19.
  - Evidence mode: validation
## Phase 3: Validation And Promotion

- [x] T006 Run focused, budget, compatibility, architecture, and full
  validation.
  - Depends on: T003, T004, T005
  - Requirements: Requirement 1, Requirement 2, Requirement 3, Requirement 4,
    Requirement 5; Properties: CP-001-CP-005
  - Files: `verification.md`, relevant tests
  - Acceptance: Targeted Vitest suites, typecheck, plugin validation, full
    tests, lifecycle lint, and diff checks pass or retain explicit blockers.
  - Evidence mode: validation
  - Evidence: All focused, compatibility, type, plugin, diff, and full-suite validation passed.
  - Status: Completed and verified on 2026-07-19.
  - [x] T006.1 Run focused contract, runtime, graph, docs, and MCP suites.
  - Evidence: Focused contract/runtime/graph/docs/MCP validation: 9 files and 109 tests passed.
  - Status: Completed and verified on 2026-07-19.
  - Evidence mode: validation
  - [x] T006.2 Run typecheck, plugin validation, and the full suite.
  - Evidence: pnpm typecheck, pnpm validate:plugin, and full pnpm test passed; 80 files and 610 tests passed.
  - Status: Completed and verified on 2026-07-19.
  - Evidence mode: validation
  - [x] T006.3 Run lifecycle, architecture, Markdown, and diff checks.

  - Evidence: git diff --check passed; lifecycle and durable-document checks are recorded in verification and final gates.
  - Status: Completed and verified on 2026-07-19.
  - Evidence mode: validation
- [x] T007 Promote accepted validity, freshness, graph failure, and docs-removal
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
  - Evidence: docs/design/graph-store-design.md, docs/design/runtime-operations-design.md, docs/design/mcp-surface-design.md, docs/reference/runtime-contracts.md, and docs/reference/agent-readable-changelog.md contain the promoted behavior; closure_check reports ready=true.
  - Status: Completed and verified on 2026-07-19.
  - [x] T007.1 Promote accepted behavior to durable owners and changelog.
  - Evidence: Accepted behavior is promoted to graph-store, runtime-operations, MCP-surface, runtime-contract, and changelog durable owners.
  - Status: Completed and verified on 2026-07-19.
  - Evidence mode: implementation
  - [x] T007.2 Reconcile residuals, reviews, and closure evidence.

  - Evidence: Independent review corrections are covered by tests/runtime/snapshot-path-validity.test.ts and tests/graph/query-tools.test.ts; closure_check reports ready=true with zero blockers.
  - Status: Completed and verified on 2026-07-19.
  - Evidence mode: validation
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
