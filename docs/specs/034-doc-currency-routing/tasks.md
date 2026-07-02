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
T002 -> T005
T003,T004 -> T006
T006 -> T007 -> T008
T005,T008 -> T009
```

## Phase 1: Model And Classification

- [ ] T001 Add document currency model.
  - Files: `src/domain/policies/document-authority.ts` or sibling policy,
    `src/contracts/` if public fields are added
  - Acceptance: Model represents current, stale, superseded, historical, and
    unknown task-currency states without using `ctime`.
  - Evidence: Pending.

- [ ] T002 Add frontmatter signal extraction.
  - Depends on: T001
  - Files: `src/application/use-cases/markdown-docs.ts`,
    `src/domain/policies/`
  - Acceptance: Shared parser extracts supported first-block frontmatter keys
    for routing input and leaves unknown keys ignored.
  - Evidence: Pending.

- [ ] T003 Add optional Git history evidence port.
  - Depends on: T001
  - Files: `src/ports/`, `src/infrastructure/commands/` or appropriate
    infrastructure location
  - Acceptance: Port can report latest touch and first-introduced evidence for
    tracked files, and structured unavailable states for non-Git or untracked
    files. No filesystem `ctime` usage.
  - Evidence: Pending.

## Phase 2: Runtime Surfaces

- [ ] T004 Apply currency ranking to `context_for_task`.
  - Depends on: T002
  - Files: `src/application/use-cases/get-task-context.ts`,
    `tests/mcp/context-for-task-tool.test.ts`
  - Acceptance: Governing docs use frontmatter-aware currency classification;
    implementation prompts prefer current canonical/supporting docs and caveat
    stale or non-authoritative docs.
  - Evidence: Pending.

- [ ] T005 Apply currency metadata to docs search and docs inventory.
  - Depends on: T002, T003
  - Files: `src/application/use-cases/query-docs.ts`,
    `src/infrastructure/sqlite/graph-store.ts`, docs contract tests
  - Acceptance: `docs_search`, `repo:///docs/overview`, and `repo:///docs/map`
    return consistent currency labels, caveats, and optional recency evidence
    within budget.
  - Evidence: Pending.

- [ ] T006 Add doc currency verifier workflow.
  - Depends on: T003, T004
  - Files: packaged skill/prompt location or MCP registry/use-case files,
    depending on the chosen open decision
  - Acceptance: Agent can ask which docs are current for a task and receives
    canonical docs, supporting docs, non-authoritative docs, unknown docs,
    caveats, and next actions.
  - Evidence: Pending.

## Phase 3: Lifecycle Feedback And Documentation

- [ ] T007 Prepare spec-lifecycle-manager handoff.
  - Depends on: T006
  - Files: plugin docs or feedback artifact selected during implementation
  - Acceptance: Handoff includes frontmatter input signals, canonical-context
    guidance, Git-history optionality, and the rule that `ctime` must not be
    used for lifecycle or currency.
  - Evidence: Pending.

- [ ] T008 Update durable Agent Workbench docs.
  - Depends on: T006
  - Files: `docs/design/mcp-surface-design.md`,
    `docs/design/graph-store-design.md`,
    `docs/reference/runtime-contracts.md`,
    `docs/reference/documentation-map.md` as needed
  - Acceptance: Durable docs describe accepted docs currency routing behavior
    and preserve the Workbench/spec-lifecycle-manager boundary.
  - Evidence: Pending.

- [ ] T009 Validate and record closure readiness.
  - Depends on: T005, T008
  - Files: this spec package
  - Acceptance: `pnpm typecheck`, targeted docs/context tests, and any new
    skill/prompt validation pass or have documented waivers.
  - Evidence: Pending.
