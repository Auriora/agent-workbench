---
title: MCP tool sweep quality tasks
doc_type: spec
artifact_type: tasks
status: active
owner: platform
last_reviewed: 2026-06-06
---

# Tasks

## Task Dependency Graph

```text
T001 -> T002 -> T003
T003 -> T004 -> T005
T003 -> T006
T003 -> T007
T003 -> T008
T004,T005,T006,T007,T008 -> T009 -> T010
```

## Phase 1: Harness And Baseline

- [ ] T001 Add MCP tool sweep fixtures.
  - Files: `tests/fixtures/`, `tests/mcp/`
  - Acceptance: Fixtures cover headed docs, no-heading docs, missing docs,
    unsupported/no-coverage status, cold docs FTS, graph symbol evidence,
    blocked verification, and workspace edit preview/apply.
  - Evidence: Pending.
  - [ ] T001.1 Add a headed Markdown fixture and expected heading ids.
  - [ ] T001.2 Add a no-heading Markdown fixture.
  - [ ] T001.3 Add a fixture/request case for a missing Markdown path.
  - [ ] T001.4 Add a fixture or adapter setup for unsupported/no-coverage
    status.
  - [ ] T001.5 Add a graph-backed fixture with at least one indexed symbol and
    one reference or impact edge where current extractors support it.
  - [ ] T001.6 Add verification-plan blocked evidence fixture.

- [ ] T002 Implement the permanent MCP tool sweep harness.
  - Depends on: T001
  - Files: `src/debug/mcp-tool-sweep.ts`, `package.json`,
    `tests/mcp/debug-harness.test.ts`
  - Acceptance: `pnpm debug:mcp-tool-sweep -- --repo <path>` writes a JSON
    report under `.tmp/`, calls or explicitly skips every registered surface,
    and never executes target-repo commands.
  - Evidence: Pending.
  - [ ] T002.1 Write failing tests that compare `mcpResources` and `mcpTools`
    against sweep call-plan coverage.
  - [ ] T002.2 Add safe repo fact discovery for existing Markdown, manifest,
    JSON, text, and indexed symbol inputs.
  - [ ] T002.3 Add positive preview/apply and negative invalid-token call
    planning.
  - [ ] T002.4 Add response parsing, quality classification, timeout records,
    and report writing.
  - [ ] T002.5 Add `debug:mcp-tool-sweep` package script.

- [ ] T003 Capture a reproducible baseline.
  - Depends on: T002
  - Files: `.tmp/agent-workbench-tool-sweep/`,
    `docs/specs/023-mcp-tool-sweep-quality/verification.md`
  - Acceptance: Baseline records fixture sweep results and the eight-repo
    dogfood sweep without target repo build/test execution.
  - Evidence: Pending.
  - [ ] T003.1 Run fixture-focused sweep.
  - [ ] T003.2 Run eight-repo dogfood sweep.
  - [ ] T003.3 Record summarized findings in `verification.md`.

## Phase 2: Runtime Semantics

- [ ] T004 Correct status and readiness metadata semantics.
  - Depends on: T003
  - Files: `src/application/use-cases/get-repo-status.ts`,
    `src/presentation/status-presenter.ts`,
    `src/presentation/docs-presenter.ts`,
    `tests/runtime/`, `tests/docs/`, `tests/mcp/`
  - Acceptance: Unsupported/no-coverage status has explicit degraded or
    unsupported evidence; cold/refreshing docs FTS is structured blocked and
    actionable, not unexplained invalid.
  - Evidence: Pending.
  - [ ] T004.1 Write failing tests for no adapter coverage status.
  - [ ] T004.2 Write failing tests for cold and refreshing docs FTS output.
  - [ ] T004.3 Implement metadata and presenter corrections.
  - [ ] T004.4 Run focused status/docs tests.

- [ ] T005 Correct documentation tool edge cases.
  - Depends on: T003
  - Files: `src/application/use-cases/query-docs.ts`,
    `src/presentation/docs-presenter.ts`,
    `src/application/use-cases/check-markdown-quality.ts`,
    `src/presentation/markdown-quality-presenter.ts`,
    `tests/docs/`, `tests/mcp/docs-surfaces.test.ts`
  - Acceptance: Missing docs, no-heading docs, headed docs, and section reads
    produce distinguishable envelopes with stable heading ids where applicable.
  - Evidence: Pending.
  - [ ] T005.1 Write failing tests for missing Markdown path behavior.
  - [ ] T005.2 Write failing tests for existing no-heading Markdown behavior.
  - [ ] T005.3 Write failing tests for headed Markdown outline and section
    read.
  - [ ] T005.4 Implement docs/query and presenter corrections.
  - [ ] T005.5 Run focused docs tests.

- [ ] T006 Improve graph-backed sweep inputs and degraded explanations.
  - Depends on: T003
  - Files: `src/debug/mcp-tool-sweep.ts`,
    `src/application/use-cases/get-task-context.ts`,
    `src/application/use-cases/search-symbols.ts`,
    `src/application/use-cases/find-references.ts`,
    `src/application/use-cases/compute-impact.ts`,
    `src/presentation/`, `tests/integration/`, `tests/mcp/`
  - Acceptance: Harness uses actual indexed symbols when available; graph
    tools distinguish cold graph, no matching symbol, unsupported language, and
    positive graph evidence.
  - Evidence: Pending.
  - [ ] T006.1 Write failing harness test for indexed-symbol selection.
  - [ ] T006.2 Write failing tests for no-symbol versus cold-graph output.
  - [ ] T006.3 Implement indexed-symbol selection and metadata improvements.
  - [ ] T006.4 Run focused graph/tool tests.

- [ ] T007 Improve verification-plan blocked reasons.
  - Depends on: T003
  - Files: `src/application/use-cases/plan-verification.ts`,
    `src/presentation/verification-plan-presenter.ts`,
    `tests/validation/`, `tests/mcp/verification-plan-tool.test.ts`
  - Acceptance: Blocked verification plans include explicit reason and next
    action; planned commands remain non-executed and policy-aware.
  - Evidence: Pending.
  - [ ] T007.1 Write failing tests for blocked LibreChat-like and
    OneMount-like validation evidence.
  - [ ] T007.2 Implement blocked reason and next-action presentation.
  - [ ] T007.3 Run focused verification-plan tests.

- [ ] T008 Compact routine skipped-path warnings.
  - Depends on: T003
  - Files: `src/presentation/metadata.ts`, `src/presentation/docs-presenter.ts`,
    `src/presentation/task-context-presenter.ts`, `tests/presentation/`,
    `tests/docs/`
  - Acceptance: Routine generated/vendor/gitignored path exclusions are
    summarized by reason with examples; requested-path exclusions remain
    explicit and actionable.
  - Evidence: Pending.
  - [ ] T008.1 Write failing tests for noisy skipped-path summaries.
  - [ ] T008.2 Implement compact warning aggregation.
  - [ ] T008.3 Run focused presentation/docs tests.

## Phase 3: Verification And Promotion

- [ ] T009 Run full validation and cross-repo sweep.
  - Depends on: T004, T005, T006, T007, T008
  - Files: `docs/specs/023-mcp-tool-sweep-quality/verification.md`
  - Acceptance: `pnpm typecheck`, focused tests, `pnpm test`, and the
    eight-repo tool sweep complete with no unexplained invalid results.
  - Evidence: Pending.
  - [ ] T009.1 Run `pnpm typecheck`.
  - [ ] T009.2 Run focused tests for changed areas.
  - [ ] T009.3 Run `pnpm test`.
  - [ ] T009.4 Run eight-repo `pnpm debug:mcp-tool-sweep` without target repo
    build/test commands.
  - [ ] T009.5 Record evidence and residual risks in `verification.md`.

- [ ] T010 Promote durable docs and prepare closure.
  - Depends on: T009
  - Files: `docs/design/mcp-surface-design.md`,
    `docs/design/observability-debugging-design.md`,
    `docs/reference/runtime-contracts.md`,
    `docs/reference/documentation-map.md`,
    `docs/specs/023-mcp-tool-sweep-quality/`
  - Acceptance: Durable docs describe the sweep harness, quality labels,
    no-build/no-test target-repo boundary, and updated metadata semantics.
  - Evidence: Pending.
  - [ ] T010.1 Update durable docs.
  - [ ] T010.2 Update documentation map if required.
  - [ ] T010.3 Run `git diff --check`.
  - [ ] T010.4 Run spec lifecycle validation or manual spec artifact check.
  - [ ] T010.5 Record closure readiness in `verification.md`.
