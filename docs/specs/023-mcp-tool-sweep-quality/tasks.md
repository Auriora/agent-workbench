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

- [x] T001 Add MCP tool sweep fixtures.
  - Files: `tests/fixtures/`, `tests/mcp/`
  - Acceptance: Fixtures cover headed docs, no-heading docs, missing docs,
    unsupported/no-coverage status, cold docs FTS, graph symbol evidence,
    blocked verification, and workspace edit preview/apply.
  - Evidence: Added `tests/fixtures/fixture-mcp-tool-sweep/` and extended
    `tests/mcp/debug-harness.test.ts`; validated with
    `pnpm test tests/mcp/debug-harness.test.ts` and `pnpm typecheck` on
    2026-06-11.
  - [x] T001.1 Add a headed Markdown fixture and expected heading ids.
  - [x] T001.2 Add a no-heading Markdown fixture.
  - [x] T001.3 Add a fixture/request case for a missing Markdown path.
  - [x] T001.4 Add a fixture or adapter setup for unsupported/no-coverage
    status.
  - [x] T001.5 Add a graph-backed fixture with at least one indexed symbol and
    one reference or impact edge where current extractors support it.
  - [x] T001.6 Add verification-plan blocked evidence fixture.

- [x] T002 Implement the permanent MCP tool sweep harness.
  - Depends on: T001
  - Files: `src/debug/mcp-tool-sweep.ts`, `package.json`,
    `tests/mcp/debug-harness.test.ts`
  - Acceptance: `pnpm debug:mcp-tool-sweep -- --repo <path>` writes a JSON
    report under `.tmp/`, calls or explicitly skips every registered surface,
    and never executes target-repo commands.
  - Evidence: Added `src/debug/mcp-tool-sweep.ts`,
    `debug:mcp-tool-sweep`, and harness coverage tests; validated with
    `pnpm test tests/mcp/debug-harness.test.ts`, `pnpm typecheck`, and
    fixture sweep `pnpm debug:mcp-tool-sweep -- --repo
    tests/fixtures/fixture-mcp-tool-sweep --output-dir
    .tmp/agent-workbench-tool-sweep --start-graph-warmup` on 2026-06-11.
  - [x] T002.1 Write failing tests that compare `mcpResources` and `mcpTools`
    against sweep call-plan coverage.
  - [x] T002.2 Add safe repo fact discovery for existing Markdown, manifest,
    JSON, text, and indexed symbol inputs.
  - [x] T002.3 Add positive preview/apply and negative invalid-token call
    planning.
  - [x] T002.4 Add response parsing, quality classification, timeout records,
    and report writing.
  - [x] T002.5 Add `debug:mcp-tool-sweep` package script.

- [x] T003 Capture a reproducible baseline.
  - Depends on: T002
  - Files: `.tmp/agent-workbench-tool-sweep/`,
    `docs/specs/023-mcp-tool-sweep-quality/verification.md`
  - Acceptance: Baseline records fixture sweep results and the eight-repo
    dogfood sweep without target repo build/test execution or workspace-write
    calls against original external repositories.
  - Evidence: Fixture-focused sweep completed on 2026-06-11 with 22 planned
    calls, 14 full, 0 partial, 7 degraded, 1 blocked, and 0 invalid results.
    A sandboxed external subset sweep copied XRPPOC, LibreChat, and
    One-Register-Web-Application into `.tmp/tool-sweep-sandboxes/` and ran
    write-capable checks only against the copies; write rows passed on all
    three sandbox copies, while LibreChat still exposed two documentation
    surface invalids for later runtime-semantics work. The full eight-repo
    dogfood baseline then used `git archive HEAD` committed-tree sandboxes
    under `.tmp/tool-sweep-sandboxes-committed/`, excluding `.git`,
    uncommitted files, ignored folders, dependency folders, and generated
    runtime artifacts by construction. That run wrote
    `.tmp/agent-workbench-tool-sweep-committed-sandboxes/mcp-tool-sweep-2026-06-11T05-51-39-772Z.json`
    with 58 full, 51 partial, 57 degraded, 5 blocked, and 5 invalid results.
    `preview_workspace_edit` and `apply_workspace_edit` were full/ok for all
    eight sandbox copies. A focused test now proves workspace-write tools are
    skipped for non-sandbox external repository roots.
  - [x] T003.1 Run fixture-focused sweep.
    - Evidence: `pnpm debug:mcp-tool-sweep -- --repo
      tests/fixtures/fixture-mcp-tool-sweep --output-dir
      .tmp/agent-workbench-tool-sweep --start-graph-warmup` completed on
      2026-06-11 with 0 invalid results.
  - [x] T003.2 Run eight-repo dogfood sweep with workspace-write tools skipped
    on original target repos, or run workspace-write tools only against
    sandbox copies.
    - Evidence: Created eight committed-tree sandboxes with `git archive HEAD`
      and ran `pnpm debug:mcp-tool-sweep -- --repo ... --output-dir
      .tmp/agent-workbench-tool-sweep-committed-sandboxes
      --start-graph-warmup` on 2026-06-11. All workspace-write rows were
      full/ok against sandbox copies only; no original external repository was
      write-tested.
  - [x] T003.3 Record summarized findings in `verification.md`.
    - Evidence: Summary recorded in `verification.md` evidence log on
      2026-06-11.

## Phase 2: Runtime Semantics

- [ ] T004 Correct status and readiness metadata semantics.
  - Depends on: T003
  - Files: `src/application/use-cases/get-repo-status.ts`,
    `src/presentation/status-presenter.ts`,
    `src/presentation/docs-presenter.ts`,
    `tests/runtime/`, `tests/docs/`, `tests/mcp/`
  - Acceptance: Unsupported/no-coverage status has explicit degraded or
    unsupported evidence; cold/refreshing docs FTS is structured blocked and
    actionable, not unexplained invalid. Routine attention items do not
    downgrade otherwise complete orientation responses.
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
    A successful markdown-quality check with findings is reported as a full
    checker result with findings, not degraded transport quality.
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
  - Acceptance: Harness uses scanner-visible files and actual indexed symbols
    when available; graph tools distinguish cold graph, no matching symbol,
    unsupported language, and positive graph evidence.
  - Evidence: Scanner-visible sweep input selection implemented in
    `src/debug/mcp-tool-sweep.ts` and covered by
    `tests/mcp/debug-harness.test.ts`; `pnpm test
    tests/mcp/debug-harness.test.ts` and `pnpm typecheck` passed on
    2026-06-11. Eight-repo committed-tree sandbox sweep after the change wrote
    `.tmp/agent-workbench-tool-sweep-committed-sandboxes-after-input-selection-final/mcp-tool-sweep-2026-06-11T06-16-13-585Z.json`
    with 64 full, 46 partial, 64 degraded, 0 blocked, and 2 invalid results.
    Remaining invalids are `docs_search` cold/missing FTS semantics for FreeCAD
    and LibreChat.
  - [x] T006.1 Write failing harness test proving sweep facts are selected
    from scanner-visible files, not raw recursive filesystem listings.
    - Evidence: Added regression coverage that hidden/generated Markdown is
      ignored for sweep input selection while visible docs are selected.
  - [ ] T006.2 Write failing harness test for indexed-symbol selection.
  - [ ] T006.3 Write failing tests for no-symbol versus cold-graph output.
  - [ ] T006.4 Implement scanner-visible file selection, indexed-symbol
    selection, and metadata improvements.
  - [ ] T006.5 Run focused graph/tool tests.

- [ ] T007 Improve verification-plan blocked reasons.
  - Depends on: T003
  - Files: `src/application/use-cases/plan-verification.ts`,
    `src/presentation/verification-plan-presenter.ts`,
    `tests/validation/`, `tests/mcp/verification-plan-tool.test.ts`
  - Acceptance: Blocked verification plans include explicit reason and next
    action; planned commands remain non-executed and policy-aware. Harness
    changed-file inputs do not target scanner-excluded hidden/generated files
    unless the test is explicitly proving that blocked behavior.
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
    explicit and actionable. Routine skipped paths do not by themselves turn a
    complete response into degraded quality.
  - Evidence: Pending.
  - [ ] T008.1 Write failing tests for noisy skipped-path summaries.
  - [ ] T008.2 Implement compact warning aggregation.
  - [ ] T008.3 Run focused presentation/docs tests.

## Phase 3: Verification And Promotion

- [ ] T009 Run full validation and cross-repo sweep.
  - Depends on: T004, T005, T006, T007, T008
  - Files: `docs/specs/023-mcp-tool-sweep-quality/verification.md`
  - Acceptance: `pnpm typecheck`, focused tests, `pnpm test`, and the
    eight-repo read-only tool sweep complete with no unexplained invalid
    results; workspace-write behavior is proven by fixtures or sandbox copies.
  - Evidence: Pending.
  - [ ] T009.1 Run `pnpm typecheck`.
  - [ ] T009.2 Run focused tests for changed areas.
  - [ ] T009.3 Run `pnpm test`.
  - [ ] T009.4 Run eight-repo `pnpm debug:mcp-tool-sweep` without target repo
    build/test commands or workspace-write calls against original repos.
  - [ ] T009.5 Record evidence and residual risks in `verification.md`.

- [ ] T010 Promote durable docs and prepare closure.
  - Depends on: T009
  - Files: `docs/design/mcp-surface-design.md`,
    `docs/design/observability-debugging-design.md`,
    `docs/reference/runtime-contracts.md`,
    `docs/reference/documentation-map.md`,
    `docs/specs/023-mcp-tool-sweep-quality/`
  - Acceptance: Durable docs describe the sweep harness, quality labels,
    no-build/no-test/no-write original target-repo boundary, sandbox-copy path,
    and updated metadata semantics.
  - Evidence: Pending.
  - [ ] T010.1 Update durable docs.
  - [ ] T010.2 Update documentation map if required.
  - [ ] T010.3 Run `git diff --check`.
  - [ ] T010.4 Run spec lifecycle validation or manual spec artifact check.
  - [ ] T010.5 Record closure readiness in `verification.md`.
