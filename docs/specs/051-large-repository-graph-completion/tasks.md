---
title: Large-repository graph completion tasks
doc_type: spec
artifact_type: tasks
status: draft
owner: platform
last_reviewed: 2026-08-02
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Tasks

**Input:** `requirements.md`, `design.md`, `research.md`, `change-impact.md`

## Task Dependency Graph

```text
T001 -> T002 -> T003 -> T004 -> T005 -> T006 -> T007
```

## Phase 1: Planning and setup

- [x] T001 Reconcile EB014 requirements with scoped evidence
  - Depends on: none
  - Requirement: Requirement 1, Requirement 2, Requirement 3, Requirement 4, Requirement 5, Requirement 6
  - Files: `requirements.md`, `research.md`, `design.md`, `canonical-context.md`
  - Acceptance: No conflicting goals on bounded completion semantics.
  - Evidence: Confirmed run evidence includes debug hard cap 500, scan-only completion
    reporting, warmup partial behavior with no completion executor, and non-reordering
    of `priority_paths`.
- [x] T002 Define traceability and promotion gates for EB014 before implementation
  - Depends on: T001
  - Requirement: Requirement 7, Requirement 3, Requirement 5
  - Files: `traceability.md`, `verification.md`, `change-impact.md`
  - Acceptance: Verification sections are defined for each requirement and
    implementation evidence.
  - Evidence: Matrixed mapping and evidence placeholders prepared from user-confirmed
    findings.

## Phase 2: Implementation slice

- [x] T003 Implement truthful bounded coverage accounting and deterministic admission ordering
  - Depends on: T002
  - Requirement: Requirement 1 (AC1-AC4), Requirement 2
  - Files: `src/application/use-cases/index-repository-graph.ts` (assigned downstream)
  - Acceptance: Run output coverage is computed from scan/admission/extraction counters;
    priority files are reordered deterministically.
  - Evidence: Coverage counters and pre-cap explicit/pattern priority ordering are covered by
    extraction and scanner tests, including engine routes and route fragments across continuation.
- [x] T004 Implement durable continuation with owner/generation semantics and atomic publication
  - Depends on: T003
  - Requirement: Requirement 1 (AC5-AC6), Requirement 3, Requirement 4
  - Files: production graph run and continuation persistence layer
  - Acceptance: Stale/cancel/restart semantics are explicit and requirement 1 cursor
    and completion publication behavior are explicit.
  - Evidence: SQLite ledger persists owner, status, generations, cursor and completion target;
    store and continuation tests cover hidden targets, cross-slice resolution, wrong-owner,
    cancelled and stale rejection.
- [x] T005 Implement downstream trust propagation for partial coverage
  - Depends on: T004
  - Requirement: Requirement 5
  - Files: graph contract responses and affected query pathways
  - Acceptance: Partial results are visible and never misrepresented as complete.
  - Evidence: Additive coverage metadata distinguishes admitted/extracted counts, truncation and
    callable continuation; the queryable seed remains partial until stable completion publishes.
- [x] T006 Align debug sweep completion path with bounded run-to-extend
  - Depends on: T004
  - Requirement: Requirement 1 (AC5), Requirement 6
  - Files: debug sweep tool path and coverage reporting
  - Acceptance: debug sweeps emit continuation-capable bounded runs and complete
    through the same model.
  - Evidence: Debug warmup loops the production slice function until completion; no hard total
    extraction cap remains.
- [x] T007 Add regression tests for EB014, including gerald and priority-path behavior
  - Depends on: T003-T006
  - Requirement: Requirement 7
  - Files: `tests/**` (assigned downstream)
  - Acceptance: Focused and adjacent regression tests cover scan/admit/extract
    correctness, continuation safety, and partial trust visibility.
  - Evidence: Typecheck, focused suites and full Vitest suite pass. Rails sweeps at 100 files per
    slice completed 265/265 and 194/194 files with no blocked or invalid surface.

## Phase 3: Closure readiness

- [x] T008 Close findings in architecture, QA, and lifecycle reviews; complete
  implementation evidence
  - Depends on: T007
  - Requirement: all
  - Files: complete package
  - Acceptance: No unresolved blocker across review streams.
  - Evidence: Final senior review found and repaired the continuation-time engine
    shape gap; typecheck, 153 focused tests, the full suite and both Rails sweeps pass.
