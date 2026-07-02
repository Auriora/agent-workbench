---
title: Doc currency routing tasks
doc_type: spec
artifact_type: tasks
status: active
owner: platform
last_reviewed: 2026-07-02
---

# Tasks

## Task Dependency Graph

```text
T001 -> T002 -> T003 -> T004
T003 -> T005
T002 -> T006
T004,T005 -> T007
T006,T007 -> T008 -> T009
T005,T009 -> T010
```

## Phase 1: Model And Classification

- [x] T001 Add document currency model.
  - Files: `src/domain/policies/document-authority.ts` or sibling policy,
    `src/contracts/` if public fields are added
  - Acceptance: Model represents current, stale, superseded, historical, and
    unknown task-currency states without using `ctime`.
  - Evidence: Added `MarkdownDocCurrencySignal`,
    `MarkdownDocCurrencyState`, and `classifyMarkdownDocCurrency` in
    `src/domain/policies/document-authority.ts`; focused tests in
    `tests/docs/document-currency.test.ts`; `pnpm typecheck` and targeted
    Vitest docs/workspace suite passed.

- [x] T002 Add frontmatter signal extraction.
  - Depends on: T001
  - Files: `src/application/use-cases/markdown-docs.ts`,
    `src/domain/policies/`
  - Acceptance: Shared parser extracts supported first-block frontmatter keys
    for routing input and leaves unknown keys ignored.
  - Evidence: Added `extractMarkdownFrontmatterSignals` in
    `src/application/use-cases/markdown-docs.ts` for supported first-block
    routing keys only; covered by `tests/docs/document-currency.test.ts`;
    `pnpm typecheck` and targeted Vitest docs/workspace suite passed.

- [x] T003 Add documentation-map owner lookup.
  - Depends on: T001
  - Files: `src/application/use-cases/`, `src/domain/policies/`,
    `docs/reference/documentation-map.md` fixtures or tests
  - Acceptance: Currency classification can use documentation-map ownership as
    stronger evidence than incidental text or frontmatter when identifying the
    current source for a task.
  - Evidence: Added `extractDocumentationMapOwners` and
    `findDocumentationMapOwner` in
    `src/application/use-cases/markdown-docs.ts`; currency classifier accepts
    `documentation_map_owner`; covered by
    `tests/docs/document-currency.test.ts`; `pnpm typecheck` and targeted
    Vitest docs/workspace suite passed.

- [x] T004 Add optional Git history evidence port.
  - Depends on: T001
  - Files: `src/ports/`, `src/infrastructure/commands/` or appropriate
    infrastructure location
  - Acceptance: Port can report latest touch and first-introduced evidence for
    tracked files, and structured unavailable states for non-Git or untracked
    files. No filesystem `ctime` usage.
  - Evidence: Added `GitHistoryPort` / `GitFileHistoryResult` in
    `src/ports/index.ts` and `GitHistoryAdapter` in
    `src/infrastructure/commands/index.ts`; adapter uses structured `git -C`
    argv, reports unavailable states for missing Git, non-repo, untracked, no
    history, and command failure, and does not use filesystem `ctime` or
    `birthtime`; covered by `tests/workspace/git-history.test.ts`; `rg -n
    "ctime|birthtime" src tests` returned no matches; `pnpm typecheck` and
    targeted Vitest docs/workspace suite passed.

## Phase 2: Runtime Surfaces

- [x] T005 Apply currency ranking to `context_for_task`.
  - Depends on: T002, T003
  - Files: `src/application/use-cases/get-task-context.ts`,
    `tests/mcp/context-for-task-tool.test.ts`
  - Acceptance: Governing docs use frontmatter-aware currency classification;
    implementation prompts prefer current canonical/supporting docs and caveat
    stale or non-authoritative docs.
  - Evidence: `src/application/use-cases/get-task-context.ts` now reads
    bounded Markdown candidates, applies frontmatter-aware currency
    classification with documentation-map owner evidence, and ranks current
    docs ahead of superseded/non-authoritative docs; covered by
    `tests/mcp/context-for-task-tool.test.ts`; `pnpm typecheck` and targeted
    docs/MCP Vitest suite passed.

- [x] T006 Apply currency metadata to docs search and docs inventory.
  - Depends on: T002, T003
  - Files: `src/application/use-cases/query-docs.ts`,
    `src/infrastructure/sqlite/graph-store.ts`, docs contract tests
  - Acceptance: `docs_search`, `repo:///docs/overview`, and `repo:///docs/map`
    return consistent currency labels, caveats, documentation-map current-source
    routing, and optional recency evidence within budget.
  - Evidence: `DocsDocument`, `DocsSearchHit`, and `DocumentReference`
    contracts now expose currency labels, caveats, owner/supersession, and
    recency fields; scanner-backed `repo:///docs/overview` and
    `repo:///docs/map` populate currency metadata with `mtime_ms`-derived
    `modified_at`; SQLite-backed `docs_search` returns matching currency
    labels and caveats without broad Git execution; covered by
    `tests/docs/query-docs.test.ts`,
    `tests/docs/fts-docs-search-fixtures.test.ts`, and contract tests;
    `pnpm typecheck` and targeted docs/MCP Vitest suite passed.

- [x] T007 Add doc currency verifier workflow.
  - Depends on: T005
  - Files: packaged skill/prompt location or MCP registry/use-case files,
    depending on the chosen open decision
  - Acceptance: Agent can ask which docs are current for a task and receives
    canonical docs, supporting docs, non-authoritative docs, unknown docs,
    caveats, and next actions. A packaged skill/prompt implementation is not
    blocked by optional Git history support.
  - Evidence: Added read-only MCP tool `docs_current_for_task` with
    `getCurrentDocsForTask` use case and presenter/registry/server wiring;
    tool returns canonical, supporting, non-authoritative, and unknown docs
    with caveats and current-source next actions; covered by
    `tests/mcp/docs-surfaces.test.ts`, registry metadata tests, debug harness
    caller coverage, and Codex server-card/profile sync tests; `pnpm
    typecheck` and targeted docs/MCP Vitest suite passed.

## Phase 3: Lifecycle Feedback And Documentation

- [x] T008 Prepare spec-lifecycle-manager handoff.
  - Depends on: T007
  - Files: plugin docs or feedback artifact selected during implementation
  - Acceptance: Handoff includes frontmatter input signals, canonical-context
    guidance, Git-history optionality, and the rule that `ctime` must not be
    used for lifecycle or currency.
  - Evidence: Added
    `docs/reference/spec-lifecycle-manager-doc-currency-handoff.md` with
    frontmatter input signals, canonical-context guidance, optional Git
    recency semantics, Workbench/lifecycle boundary, and the no-`ctime` rule;
    linked it from `docs/reference/documentation-map.md`; spec lifecycle lint
    passed.

- [x] T009 Update durable Agent Workbench docs.
  - Depends on: T007, T008
  - Files: `docs/design/mcp-surface-design.md`,
    `docs/design/graph-store-design.md`,
    `docs/reference/runtime-contracts.md`,
    `docs/reference/documentation-map.md` as needed
  - Acceptance: Durable docs describe accepted docs currency routing behavior
    and preserve the Workbench/spec-lifecycle-manager boundary.
  - Evidence: Updated `docs/design/mcp-surface-design.md`,
    `docs/design/graph-store-design.md`,
    `docs/reference/runtime-contracts.md`, and
    `docs/reference/documentation-map.md` to describe accepted currency
    routing behavior, public fields, `docs_current_for_task`, optional recency
    evidence, no-`ctime` policy, and the Workbench/spec-lifecycle-manager
    boundary; durable-doc diff was checked for correct paths, headings,
    frontmatter dates, and documentation-map links; lifecycle lint passed.

- [x] T010 Validate and record closure readiness.
  - Depends on: T006, T009
  - Files: this spec package
  - Acceptance: `pnpm typecheck`, targeted docs/context tests, and any new
    skill/prompt validation pass or have documented waivers.
  - Evidence: Added `verification.md`; `pnpm typecheck` passed; targeted
    docs/MCP/contract Vitest suite passed (`tests/docs/query-docs.test.ts`,
    `tests/docs/fts-docs-search-fixtures.test.ts`,
    `tests/docs/document-currency.test.ts`,
    `tests/mcp/context-for-task-tool.test.ts`,
    `tests/mcp/docs-surfaces.test.ts`,
    `tests/mcp/registry-metadata.test.ts`,
    `tests/mcp/debug-harness.test.ts`,
    `tests/integration/codex-integration-profile.test.ts`,
    `tests/contracts/runtime-contracts.test.ts`); `git diff --check` passed;
    `rg -n "ctime|birthtime" src tests` found no matches; lifecycle lint
    passed; `closure_check` is ready with no blockers; `closure_risk_review`
    is low risk with no findings. Full `pnpm test` has one unrelated/repeated
    startup warm-up race in `tests/mcp/stdio-entrypoint.test.ts` when run with
    the whole suite, while that test file passes standalone.
