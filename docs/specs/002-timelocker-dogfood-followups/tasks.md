---
title: TimeLocker dogfood follow-up tasks
doc_type: spec
status: draft
owner: platform
last_reviewed: 2026-06-03
---

# Tasks

**Input**: [Requirements](requirements.md), [Technical design](design.md), and
[Verification](verification.md).

**Dogfood evidence**:
`/home/bcherrington/Projects/Auriora/TimeLocker/docs/updates/2026-06-03-095911-agent-workbench-python-agent-ide-evaluation.md`

## Task Dependency Graph

```text
T001 -> T002 -> T003
T002 -> T004
T004 -> T005
T003 -> T006
T004 -> T006
T002 -> T007
T001..T007 -> T008
```

## Phase 1: Reliability And Trust

### Task T001: Make `repo:///status` Fast And Bounded

- **ID:** T001
- **Status:** pending
- **Depends on:** []
- **Parallel:** no
- **Story:** Requirement 1
- **Files:** `src/application/use-cases/get-repo-status.ts`, `src/server.ts`, `src/presentation/status-presenter.ts`, `tests/runtime/`, `tests/mcp/`
- **Description:** Refactor status so it reads lightweight snapshot/warmup
  metadata and bounded summaries without listing broad catalog rows.
- **Acceptance:** `repo:///status` returns cold, refreshing, fresh, stale, or
  degraded state quickly while warmup is active; budget tests prove no broad
  catalog enumeration is required for the hot path.
- **Evidence:** Pending.

### Task T002: Standardize Trust Labels Across MVP Results

- **ID:** T002
- **Status:** pending
- **Depends on:** [T001]
- **Parallel:** no
- **Story:** Requirement 2
- **Files:** `src/contracts/`, `src/presentation/`, `src/application/use-cases/`, `tests/contracts/`, `tests/mcp/`
- **Description:** Ensure all MVP resources/tools consistently report
  freshness, capability level, evidence kinds, verification status, caveats,
  and any required intended-use label.
- **Acceptance:** Contract and presenter tests prove useful-but-partial results
  are labeled as routing-only or degraded and mixed evidence does not overstate
  confidence.
- **Evidence:** Pending.

## Phase 2: Validation Planning

### Task T003: Add Nearest-Test Planning

- **ID:** T003
- **Status:** pending
- **Depends on:** [T002]
- **Parallel:** yes
- **Story:** Requirement 3
- **Files:** `src/application/use-cases/plan-verification.ts`, `src/infrastructure/filesystem/`, `tests/mcp/verification-plan-tool.test.ts`, `tests/integration/`
- **Description:** Plan direct and inferred nearest pytest targets before broad
  `python3 -m pytest` commands.
- **Acceptance:** Fixture-backed tests prove explicit test files, sibling
  `test_*.py` files, and same-package tests are planned before broad suite
  commands with confidence labels.
- **Evidence:** Pending.

## Phase 3: Symbol And Graph Evidence

### Task T004: Improve Exact Symbol Discovery

- **ID:** T004
- **Status:** pending
- **Depends on:** [T002]
- **Parallel:** yes
- **Story:** Requirement 4
- **Files:** `src/application/use-cases/search-symbols.ts`, `src/infrastructure/sqlite/graph-store.ts`, `src/infrastructure/tree-sitter/`, `tests/graph/`, `tests/mcp/query-tools.test.ts`
- **Description:** Improve exact lookup across `name` and `qualified_name`,
  add TimeLocker-shaped fixtures, and explain fallback or miss behavior.
- **Acceptance:** `RepositoryResolver`, `RepositoryResolver.resolve_repository`,
  and `ConfigValidationService` style fixtures resolve through exact
  parser-backed symbol search when present.
- **Evidence:** Pending.

### Task T005: Improve Reference And Impact Evidence

- **ID:** T005
- **Status:** pending
- **Depends on:** [T004]
- **Parallel:** no
- **Story:** Requirement 5
- **Files:** `src/application/use-cases/find-references.ts`, `src/application/use-cases/compute-impact.ts`, `src/application/use-cases/query-helpers.ts`, `src/infrastructure/sqlite/graph-store.ts`, `tests/graph/`
- **Description:** Include bounded cross-file parser references, unresolved
  candidate evidence, and clearly labeled lexical reference evidence where
  parser edges are incomplete.
- **Acceptance:** Reference and impact tests prove cross-file hits are surfaced
  within budgets and local-only impact reports insufficient blast-radius
  confidence.
- **Evidence:** Pending.

## Phase 4: Guidance Quality

### Task T006: Rank And Cap Next Actions

- **ID:** T006
- **Status:** pending
- **Depends on:** [T003, T004]
- **Parallel:** yes
- **Story:** Requirement 6
- **Files:** `src/application/use-cases/get-task-context.ts`, `src/application/use-cases/search-symbols.ts`, `src/application/use-cases/find-references.ts`, `src/application/use-cases/compute-impact.ts`, `tests/mcp/`, `tests/integration/`
- **Description:** Add a shared next-action ranking policy for context and graph
  tools with a default cap of three high-value actions.
- **Acceptance:** Tests prove next actions prioritize direct verification,
  nearest validation, exact symbol search, references, and impact only when
  appropriate, without large source or edit payloads.
- **Evidence:** Pending.

### Task T007: Improve Overview Key-Doc Ranking

- **ID:** T007
- **Status:** pending
- **Depends on:** [T002]
- **Parallel:** yes
- **Story:** Requirement 7
- **Files:** `src/application/use-cases/get-repo-overview.ts`, `tests/runtime/orientation-golden.test.ts`, `tests/mcp/repo-scope-overview-resource.test.ts`
- **Description:** Rank repo guidance and operational docs ahead of incidental
  templates, archived specs, and update logs in `repo:///overview`.
- **Acceptance:** Fixture tests prove `AGENTS.md`, `README.md`, and guidance
  docs outrank templates and update logs unless task evidence justifies
  otherwise.
- **Evidence:** Pending.

## Phase 5: Verification And Promotion

### Task T008: Retest Against TimeLocker And Promote Durable Docs

- **ID:** T008
- **Status:** pending
- **Depends on:** [T001, T002, T003, T004, T005, T006, T007]
- **Parallel:** no
- **Story:** All requirements
- **Files:** `docs/design/`, `docs/reference/`, `docs/specs/002-timelocker-dogfood-followups/verification.md`
- **Description:** Run targeted automated validation, retest live Agent
  Workbench against TimeLocker, and promote accepted behavior into durable docs.
- **Acceptance:** Verification evidence records automated tests, manual
  TimeLocker dogfood results, residual gaps, and durable-doc promotion targets.
- **Evidence:** Pending.
