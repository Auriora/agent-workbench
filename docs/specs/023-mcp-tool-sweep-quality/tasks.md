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
T004,T005,T006,T007,T008 -> T009 -> T010 -> T013
T004 -> T011 -> T013
T009 -> T012 -> T013
T013 -> T014
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

- [x] T004 Correct status and readiness metadata semantics.
  - Depends on: T003
  - Files: `src/application/use-cases/get-repo-status.ts`,
    `src/presentation/status-presenter.ts`,
    `src/presentation/docs-presenter.ts`,
    `tests/runtime/`, `tests/docs/`, `tests/mcp/`
  - Acceptance: Unsupported/no-coverage status has explicit degraded or
    unsupported evidence; cold/refreshing docs FTS is structured blocked and
    actionable, not unexplained invalid. Routine attention items do not
    downgrade otherwise complete orientation responses.
  - Evidence: Docs FTS blocked metadata corrected on 2026-06-11 in
    `src/application/use-cases/query-docs.ts`; `pnpm test
    tests/docs/query-docs.test.ts tests/mcp/docs-surfaces.test.ts
    tests/mcp/debug-harness.test.ts`, `pnpm typecheck`, and the eight-repo
    committed-tree sandbox sweep passed with 0 invalid results. Sweep quality
    classification now treats `verification_status: needed` as an action state
    instead of degraded transport quality; `pnpm test
    tests/mcp/debug-harness.test.ts`, `pnpm typecheck`, and the eight-repo
    committed-tree sandbox sweep passed with 126 full, 46 partial, 2 degraded,
    2 blocked, and 0 invalid results. Catalog scan and docs/context request
    budgets were then raised for large committed-tree sandbox repositories;
    the focused orientation/docs/debug-harness test set, `pnpm typecheck`, and
    the eight-repo sweep passed with 161 full, 13 partial, 0 degraded, 2
    blocked, and 0 invalid results. The fresh T010 eight-repo committed-tree
    sandbox sweep then passed with 176 full, 0 partial, 0 degraded, 0 blocked,
    and 0 invalid results, proving current dogfood status/readiness metadata is
    not causing non-full rows. Status no-coverage fixture semantics were then
    completed with explicit `no_adapter_coverage` and
    `unsupported_language_or_platform` caveats; cold graph metadata was
    corrected to valid blocked evidence. Focused status/docs/graph tests,
    `pnpm typecheck`, `pnpm test`, and the final committed-sandbox sweep
    `.tmp/agent-workbench-tool-sweep-t015-full/mcp-tool-sweep-2026-06-11T14-00-18-411Z.json`
    passed with 176 full, 0 partial, 0 degraded, 0 blocked, and 0 invalid
    results.
  - [x] T004.1 Write failing tests for no adapter coverage status.
    - Evidence: Added no-adapter and unsupported-language status coverage in
      `tests/runtime/status.test.ts` and MCP resource caveat coverage in
      `tests/mcp/repo-status-resource.test.ts`.
  - [x] T004.2 Write failing tests for cold and refreshing docs FTS output.
    - Evidence: Updated docs search blocked-index expectations in
      `tests/docs/query-docs.test.ts` to require `analysis_validity: valid`
      with `verification_status: blocked`.
  - [x] T004.3 Implement metadata and presenter corrections.
    - Evidence: Docs search metadata correction and sweep `needed` classifier
      correction complete. Catalog scan budgets now cover the current dogfood
      repos without routine degraded orientation metadata. Status no-coverage
      and unsupported-language corrections are complete without reintroducing
      routine optional-enrichment warning noise.
  - [x] T004.4 Run focused status/docs tests.
    - Evidence: `pnpm test tests/runtime/status.test.ts
      tests/runtime/orientation-golden.test.ts
      tests/mcp/repo-status-resource.test.ts`, `pnpm test
      tests/docs/query-docs.test.ts tests/mcp/docs-surfaces.test.ts`, and
      graph-focused query/harness tests passed on 2026-06-11.

- [x] T005 Correct documentation tool edge cases.
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
  - Evidence: Successful markdown-quality findings are now classified as full
    sweep quality, covered by `tests/mcp/debug-harness.test.ts`. Requested
    docs outline and section reads now use direct requested-file evidence
    instead of inheriting broad docs-map truncation; `pnpm test
    tests/docs/query-docs.test.ts tests/mcp/docs-surfaces.test.ts
    tests/mcp/debug-harness.test.ts` and `pnpm typecheck` passed. A focused
    TimeLocker/aws-datalake/OneMount committed-tree subset sweep improved from
    58 full, 8 partial, 0 degraded, 0 blocked, and 0 invalid to 60 full, 6
    partial, 0 degraded, 0 blocked, and 0 invalid after raising the harness
    docs-read byte budget; remaining subset partials are only broad
    `docs-overview` and `docs-map` list caps. Docs overview/map now expose
    cursor-backed pagination; the sweep classifier treats truncated responses
    with continuation cursors as complete pages, not partial results. Missing
    and no-heading docs behavior is now fixture-proven.
  - [x] T005.1 Write failing tests for missing Markdown path behavior.
    - Evidence: Added a missing Markdown outline regression in
      `tests/docs/query-docs.test.ts`.
  - [x] T005.2 Write failing tests for existing no-heading Markdown behavior.
    - Evidence: Added a no-heading Markdown outline regression in
      `tests/docs/query-docs.test.ts`; the chosen behavior is `done` with an
      empty heading list and no missing-path warning.
  - [x] T005.3 Write failing tests for headed Markdown outline and section
    read.
    - Evidence: Added a regression proving requested outline and section reads
      remain full when the requested Markdown file sorts beyond the broad
      docs-map budget.
  - [x] T005.4 Implement docs/query and presenter corrections.
    - Evidence: Direct requested-file outline/read-section implementation is
      complete. Cursor-backed docs overview/map pagination is complete;
      missing and no-heading behavior is now fixture-proven.
  - [x] T005.5 Run focused docs tests.
    - Evidence: `pnpm test tests/docs/query-docs.test.ts
      tests/mcp/docs-surfaces.test.ts tests/mcp/debug-harness.test.ts` passed,
      including pagination parsing/classification coverage. The final docs
      edge-case test set `pnpm test tests/docs/query-docs.test.ts
      tests/mcp/docs-surfaces.test.ts` passed on 2026-06-11.

- [x] T006 Improve graph-backed sweep inputs and degraded explanations.
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
    Remaining invalids were `docs_search` cold/missing FTS semantics for
    FreeCAD and LibreChat. Graph query metadata no longer treats bounded
    catalog language sampling as response truncation, and `find_references`
    now uses max-plus-one result evidence plus cursors before marking output
    partial. Graph warmup now scans enough files for docs FTS while bounding
    symbol extraction separately. Indexed-symbol selection and cold/no-symbol
    distinctions are now covered by focused fixture tests, and cold graph
    metadata returns valid blocked evidence instead of invalid input metadata.
  - [x] T006.1 Write failing harness test proving sweep facts are selected
    from scanner-visible files, not raw recursive filesystem listings.
    - Evidence: Added regression coverage that hidden/generated Markdown is
      ignored for sweep input selection while visible docs are selected.
  - [x] T006.2 Write failing harness test for indexed-symbol selection.
    - Evidence: Added debug-harness coverage proving `symbol_search`,
      `find_references`, and `impact` use a warmed indexed symbol node id from
      the fixture graph.
  - [x] T006.3 Write failing tests for no-symbol versus cold-graph output.
    - Evidence: Added graph query coverage distinguishing cold graph blocked
      metadata from warm exact no-symbol results that route to
      `context_for_task`.
  - [x] T006.4 Implement scanner-visible file selection, indexed-symbol
    selection, and metadata improvements.
    - Evidence: Scanner-visible file selection is complete. Exact-budget
      reference metadata, cursor-backed `find_references` pagination, and
      split scan/extraction warmup are complete. Cold graph metadata now uses
      valid blocked evidence instead of invalid input metadata.
  - [x] T006.5 Run focused graph/tool tests.
    - Evidence: `pnpm test tests/graph/query-tools.test.ts
      tests/mcp/query-tools.test.ts tests/graph/extraction-pipeline.test.ts
      tests/mcp/debug-harness.test.ts` and `pnpm typecheck` passed in focused
      runs. Direct FreeCAD and LibreChat docs-index checks showed usable docs
      FTS instead of blocked search. The final graph-focused set `pnpm test
      tests/mcp/debug-harness.test.ts tests/graph/query-tools.test.ts
      tests/mcp/query-tools.test.ts tests/mcp/context-for-task-tool.test.ts`
      passed on 2026-06-11, and the final committed-sandbox sweep is clean.

- [x] T007 Improve verification-plan blocked reasons.
  - Depends on: T003
  - Files: `src/application/use-cases/plan-verification.ts`,
    `src/presentation/verification-plan-presenter.ts`,
    `tests/validation/`, `tests/mcp/verification-plan-tool.test.ts`
  - Acceptance: Blocked verification plans include explicit reason and next
    action; planned commands remain non-executed and policy-aware. Harness
    changed-file inputs do not target scanner-excluded hidden/generated files
    unless the test is explicitly proving that blocked behavior.
  - Evidence: Verification plan blocked summaries now include the first
    blocker and a concrete next action, without executing commands or
    suggesting generic host commands when repo policy blocks them. `pnpm test
    tests/mcp/verification-plan-tool.test.ts` passed on 2026-06-11.
  - [x] T007.1 Write failing tests for blocked LibreChat-like and
    OneMount-like validation evidence.
    - Evidence: Added blocked missing-file and Docker-only policy summary
      assertions in `tests/mcp/verification-plan-tool.test.ts`.
  - [x] T007.2 Implement blocked reason and next-action presentation.
    - Evidence: Updated `planVerification` summaries to include the first
      blocker and either the first planned next-action tool or the blocking
      risk's own next-action guidance.
  - [x] T007.3 Run focused verification-plan tests.
    - Evidence: `pnpm test tests/mcp/verification-plan-tool.test.ts` passed.

- [x] T008 Compact routine skipped-path warnings.
  - Depends on: T003
  - Files: `src/presentation/metadata.ts`, `src/presentation/docs-presenter.ts`,
    `src/presentation/task-context-presenter.ts`, `tests/presentation/`,
    `tests/docs/`
  - Acceptance: Routine generated/vendor/gitignored path exclusions are
    summarized by reason with examples; requested-path exclusions remain
    explicit and actionable. Routine skipped paths do not by themselves turn a
    complete response into degraded quality.
  - Evidence: Existing compact skipped-path aggregation is fixture-proven in
    docs and task-context tests, and the sweep classifier keeps routine
    `verification_status: needed` attention items separate from degraded
    result quality. `pnpm test tests/docs/query-docs.test.ts
    tests/docs/docs-presenter.test.ts tests/mcp/context-for-task-tool.test.ts
    tests/mcp/debug-harness.test.ts` passed on 2026-06-11.
  - [x] T008.1 Write failing tests for noisy skipped-path summaries.
    - Evidence: `tests/docs/query-docs.test.ts` covers large
      generated/vendor skipped-path compaction; context tests cover skipped
      path grouping by reason.
  - [x] T008.2 Implement compact warning aggregation.
    - Evidence: Docs results aggregate generated/vendor skip noise and task
      context reports skipped paths by reason with a sample path.
  - [x] T008.3 Run focused presentation/docs tests.
    - Evidence: Focused docs presenter/context/debug-harness test set passed.

## Phase 3: Sweep Reliability And Runtime Follow-Ups

- [x] T009 Investigate stale sweep execution and report reliability.
  - Depends on: T002, T006
  - Files: `src/debug/mcp-tool-sweep.ts`, `tests/mcp/debug-harness.test.ts`,
    `docs/specs/023-mcp-tool-sweep-quality/verification.md`
  - Acceptance: Multi-repo warmup sweep failures are classified as one of:
    clean process exit without report, thrown error before report write,
    timeout/cancellation, process kill, or terminal/PTY observation issue.
    The harness writes enough per-repo progress or partial report evidence that
    a failed or interrupted run can still be RCA'd without guessing.
  - Evidence: Added fixed `mcp-tool-sweep-progress.json` progress reporting
    with atomic flushes around sweep, repo, warmup, discovery, resource, and
    tool phases. The progress report carries cumulative results, quality
    summary, state, events, and failure messages. `pnpm test
    tests/mcp/debug-harness.test.ts`, `pnpm typecheck`, fixture sweep
    `.tmp/agent-workbench-tool-sweep-t009-progress/`, and committed-sandbox
    subset sweep `.tmp/agent-workbench-tool-sweep-t009-committed-subset/`
    passed on 2026-06-11. The bounded committed-sandbox subset did not
    reproduce the stale PTY issue; it classified as clean process exit with a
    final report. Future interrupted/stale runs can now be classified from the
    fixed progress file.
  - [x] T009.1 Reproduce the stale PTY/missing-report behavior with a bounded
    committed-tree sandbox sweep.
    - Evidence: Reran TimeLocker and LibreChat committed-tree sandboxes with
      graph warmup on 2026-06-11. The run completed cleanly with a final
      report and progress report, so the stale PTY/missing-report behavior was
      not reproduced after reload.
  - [x] T009.2 Add deterministic report flushing or per-repo progress records
    before and after warmup and surface calls.
    - Evidence: `runMcpToolSweep` now writes
      `mcp-tool-sweep-progress.json` under the output directory before the
      final timestamped report exists, and flushes it before and after warmup,
      discovery, resource calls, and tool calls.
  - [x] T009.3 Add a harness regression for report persistence when one repo
    warmup or surface call fails.
    - Evidence: Added a debug-harness regression that creates an unreadable
      sandbox file, forces `preview_workspace_edit` to fail, and verifies the
      progress report still records the failed tool event and cumulative
      invalid summary.
  - [x] T009.4 Record process/report RCA and any remaining harness risk in
    `verification.md`.

- [x] T010 Run a fresh full eight-repo committed-sandbox sweep.
  - Depends on: T009
  - Files: `.tmp/agent-workbench-tool-sweep-*`,
    `docs/specs/023-mcp-tool-sweep-quality/verification.md`
  - Acceptance: A fresh eight-repo committed-tree sandbox report exists after
    the pagination, reference truncation, and docs FTS warmup fixes; all
    non-full rows are listed with current RCA. Workspace-write rows run only
    against sandbox copies.
  - Evidence: Created fresh committed-tree sandboxes under
    `.tmp/tool-sweep-sandboxes-committed-t010/` with `git archive HEAD` for
    all eight target repositories. Ran the full warmup sweep into
    `.tmp/agent-workbench-tool-sweep-t010-full/` on 2026-06-11; final report
    `.tmp/agent-workbench-tool-sweep-t010-full/mcp-tool-sweep-2026-06-11T10-03-36-626Z.json`
    covered 176 rows with 176 full, 0 partial, 0 degraded, 0 blocked, and 0
    invalid results. Progress report state was `complete`. Workspace-write
    rows were full/ok for all eight sandbox copies only.
  - [x] T010.1 Refresh or verify the committed-tree sandbox copies.
    - Evidence: Created new sandbox copies from each original repo's committed
      `HEAD` using `git archive HEAD`, excluding `.git`, ignored/generated
      files, dependency folders, caches, and uncommitted local changes by
      construction.
  - [x] T010.2 Run `pnpm debug:mcp-tool-sweep -- --repo ... --start-graph-warmup`
    against all eight sandbox repos.
    - Evidence: Full eight-repo warmup sweep completed with a final report and
      complete progress report under `.tmp/agent-workbench-tool-sweep-t010-full/`.
  - [x] T010.3 Extract and record the final full/partial/degraded/blocked/invalid
    counts.
    - Evidence: Extracted final summary: 176 full, 0 partial, 0 degraded, 0
      blocked, and 0 invalid. Each repo contributed 22 full rows.
  - [x] T010.4 Reconcile any remaining non-full rows into this task list or a
    follow-up spec.
    - Evidence: The fresh report has zero non-full rows, so no new runtime RCA
      or follow-up implementation task is needed from T010.

- [x] T011 Complete status no-coverage semantics.
  - Depends on: T004
  - Files: `src/application/use-cases/get-repo-status.ts`,
    `src/presentation/status-presenter.ts`, `tests/runtime/`,
    `tests/mcp/repo-status-resource.test.ts`
  - Acceptance: Repository status with no adapter coverage returns explicit
    unsupported or degraded evidence with actionable metadata, not invalid or
    unexplained partial output. The response distinguishes unsupported
    language/tool coverage from cold or failed runtime state.
  - Evidence: Status no-coverage and unsupported-language semantics are now
    explicit through `meta.caveats` and remain distinct from cold
    snapshot-null runtime state. `pnpm test tests/runtime/status.test.ts
    tests/runtime/orientation-golden.test.ts
    tests/mcp/repo-status-resource.test.ts` passed on 2026-06-11.
  - [x] T011.1 Add failing tests for no adapter coverage and unsupported
    language status.
    - Evidence: Added runtime status tests for empty scanned coverage and
      unsupported Java coverage plus MCP resource envelope caveat preservation.
  - [x] T011.2 Implement status metadata and presenter corrections.
    - Evidence: Added `no_adapter_coverage` runtime caveat kind and changed
      runtime metadata derivation so scanned/catalog no-coverage and
      unsupported-language states are explicit without changing cold snapshot
      behavior.
  - [x] T011.3 Run focused runtime/status MCP tests and update T004 evidence.
    - Evidence: Focused runtime/status MCP tests passed and T004 evidence was
      updated.

- [x] T012 Investigate bounded parallel and background processing.
  - Depends on: T009
  - Files: `src/debug/mcp-tool-sweep.ts`,
    `src/application/use-cases/index-repository-graph.ts`,
    `docs/specs/023-mcp-tool-sweep-quality/verification.md`,
    future design notes if needed.
  - Acceptance: The spec records which work is safe to run concurrently
    (repo warmups, read-only surface calls, docs indexing) and which work must
    remain serialized (shared SQLite writes per repo, workspace-write preview
    and apply pairs, report finalization). Any implementation uses bounded
    concurrency with deterministic report ordering and clear cancellation or
    failure propagation.
  - Evidence: Measured the T010 progress report. The serial full eight-repo
    sweep took 163.6s of repo elapsed time: 38.5s warmup, 42.5s resource
    calls, and 77.7s tool calls. FreeCAD accounted for 70.7s and CrealityPrint
    for 37.0s; the slowest surfaces were direct docs reads, markdown set
    checks, overview/context scans, and verification planning on the largest
    sandboxes. Decision: do not add parallel execution in this correctness
    spec. Repo-level warmups and read-only calls can be made concurrent later
    with isolated per-repo runtimes, bounded worker count, deterministic
    repo-order report assembly, and serialized progress/final report writes.
    Keep per-repo SQLite writes, workspace-write preview/apply pairs, and final
    report publication serialized.
  - [x] T012.1 Measure current serial sweep timing and identify the slow phases.
    - Evidence: Parsed `.tmp/agent-workbench-tool-sweep-t010-full/mcp-tool-sweep-progress.json`.
  - [x] T012.2 Decide whether to parallelize across repos, within repo
    read-only surfaces, docs indexing, or none for this spec.
    - Evidence: Deferred implementation for this spec. Safe future boundary is
      bounded repo-level concurrency; within-repo SQLite writes and
      workspace-write tool pairs stay serialized.
  - [x] T012.3 If accepted, implement bounded concurrency with stable output
    ordering and tests; otherwise record why serial execution remains the
    safer path.
    - Evidence: Serial execution remains the safer closure path because the
      sweep is now correctness-clean and concurrent progress/report writes
      would add new ordering and cancellation risks without a current RCA
      blocker.
  - [x] T012.4 Record the background/async design decision in `verification.md`
    or a durable design note.

## Phase 4: Verification And Promotion

- [x] T013 Run full validation and cross-repo sweep.
  - Depends on: T004, T005, T006, T007, T008, T010, T011, T012
  - Files: `docs/specs/023-mcp-tool-sweep-quality/verification.md`
  - Acceptance: `pnpm typecheck`, focused tests, `pnpm test`, and the
    eight-repo read-only tool sweep complete with no unexplained invalid
    results; workspace-write behavior is proven by fixtures or sandbox copies.
  - Evidence: `pnpm typecheck`, focused tests, `pnpm test`, `git diff --check`,
    and the final eight-repo committed-sandbox sweep passed on 2026-06-11.
    Full suite result: 59 files and 388 tests passed. After completing the
    remaining fixture-level semantic coverage, `pnpm typecheck` passed,
    `pnpm test` passed with 59 files and 395 tests, and final sweep report
    `.tmp/agent-workbench-tool-sweep-t015-full/mcp-tool-sweep-2026-06-11T14-00-18-411Z.json`
    covered 176 rows with 176 full, 0 partial, 0 degraded, 0 blocked, and 0
    invalid results. Workspace-write rows ran only against sandbox copies and
    were full/ok. Full-suite validation also exposed a Node 24/tsx stdio launch
    issue; fixed by adding `src/mcp/stdio-entrypoint.mjs`, switching
    `package.json` `mcp` to that bootstrap, and keeping the stdio server
    resident after connect.
  - [x] T013.1 Run `pnpm typecheck`.
    - Evidence: Passed on 2026-06-11 after the final semantic coverage slice.
  - [x] T013.2 Run focused tests for changed areas.
    - Evidence: `pnpm test tests/mcp/debug-harness.test.ts
      tests/docs/query-docs.test.ts tests/mcp/docs-surfaces.test.ts
      tests/graph/query-tools.test.ts tests/mcp/query-tools.test.ts
      tests/validation/verification-plan.test.ts` passed with 70 tests, and
      `pnpm test tests/mcp/stdio-entrypoint.test.ts` passed with 12 tests after
      the stdio bootstrap fix.
  - [x] T013.3 Run `pnpm test`.
    - Evidence: Full Vitest suite passed with 59 files and 395 tests. An
      intermediate full run timed out on two spawned stdio tests under suite
      load; the stdio file passed by itself immediately after, and the full
      suite passed on rerun.
  - [x] T013.4 Run eight-repo `pnpm debug:mcp-tool-sweep` without target repo
    build/test commands or workspace-write calls against original repos.
    - Evidence: Ran against committed-tree sandbox copies under
      `.tmp/tool-sweep-sandboxes-committed-t010/`, not original external
      repositories. Final T015 summary: 176 full, 0 partial, 0 degraded, 0
      blocked, and 0 invalid.
  - [x] T013.5 Record evidence and residual risks in `verification.md`.

- [x] T014 Promote durable docs and prepare closure.
  - Depends on: T013
  - Files: `docs/design/mcp-surface-design.md`,
    `docs/design/observability-debugging-design.md`,
    `docs/reference/runtime-contracts.md`,
    `docs/reference/documentation-map.md`,
    `docs/specs/023-mcp-tool-sweep-quality/`
  - Acceptance: Durable docs describe the sweep harness, quality labels,
    no-build/no-test/no-write original target-repo boundary, sandbox-copy path,
    and updated metadata semantics.
  - Evidence: Promoted tool sweep behavior, progress-report RCA semantics,
    quality labels, original external repository read-only boundary,
    sandbox-copy write-test path, and bounded-concurrency decision into durable
    docs. `git diff --check` passed.
  - [x] T014.1 Update durable docs.
    - Evidence: Updated `docs/design/observability-debugging-design.md`,
      `docs/design/runtime-operations-design.md`, and
      `docs/reference/runtime-contracts.md`.
  - [x] T014.2 Update documentation map if required.
    - Evidence: Updated `docs/reference/documentation-map.md` to keep the
      sweep harness under the observability/debugging owner and link quality
      vocabulary to runtime contracts.
  - [x] T014.3 Run `git diff --check`.
  - [x] T014.4 Run spec lifecycle validation or manual spec artifact check.
    - Evidence: `spec_runtime.py lint
      docs/specs/023-mcp-tool-sweep-quality` passed with 0 diagnostics, and
      `spec_runtime.py closure-check docs/specs/023-mcp-tool-sweep-quality`
      returned `ready: true` with no blockers on 2026-06-11.
  - [x] T014.5 Record closure readiness in `verification.md`.
    - Evidence: Closure readiness recorded in `verification.md`.
