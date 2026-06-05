---
title: Infrastructure template routing tasks
doc_type: spec
artifact_type: tasks
status: archived
owner: platform
last_reviewed: 2026-06-05
---

# Tasks

## Task Dependency Graph

```text
T001 -> T002 -> T003
T002 -> T004
T003 -> T004
T004 -> T005
T005 -> T006
```

- [x] T001 Add infrastructure routing fixtures.
  - Files: `tests/fixtures/fixture-sam-lambda-repo/`, `tests/graph/`,
    `tests/mcp/`
  - Acceptance: Fixtures cover templates, logical IDs, Python handlers,
    unresolved handlers, and nearby infrastructure tests.
  - Evidence: Expanded `tests/fixtures/fixture-sam-lambda-repo/` with a
    resolved Python handler and an unresolved handler candidate; focused graph,
    context, and validation-plan tests passed.

- [x] T002 Add template-to-handler resource-backed extraction.
  - Depends on: T001
  - Files: `src/infrastructure/tree-sitter/` or resource extractor area,
    `tests/graph/extraction-pipeline.test.ts`
  - Acceptance: Template-to-handler relationships are emitted with
    resource-backed confidence and unresolved evidence when needed.
  - Evidence: Graph indexing now adds `lambda_handler_file` anchors,
    `routes_to_handler_file` edges, and unresolved `lambda_handler_file`
    references; `pnpm exec vitest run tests/graph/query-tools.test.ts
    tests/mcp/context-for-task-tool.test.ts tests/mcp/verification-plan-tool.test.ts
    tests/graph/extraction-pipeline.test.ts` passed.

- [x] T003 Improve context and impact routing for templates.
  - Depends on: T001, T002
  - Files: `src/application/use-cases/get-task-context.ts`,
    `src/application/use-cases/compute-impact.ts`, `tests/mcp/`
  - Acceptance: Template tasks rank handler/test evidence and impact labels
    remain low-confidence/resource-backed.
  - Evidence: Context coverage proves explicit SAM templates route to handler
    and infrastructure test files; impact coverage proves low-confidence
    resource-backed handler-file routing.

- [x] T004 Deepen infrastructure validation planning.
  - Depends on: T002, T003
  - Files: `src/application/use-cases/plan-verification.ts`,
    `tests/mcp/verification-plan-tool.test.ts`
  - Acceptance: Repo-approved commands and nearby infra tests rank before broad
    checks; unsafe/deploy-like commands are not guessed.
  - Evidence: Verification-plan coverage proves repo-approved infrastructure
    commands are planned before generic template checks and remain
    non-executed.

- [x] T005 Promote accepted behavior to durable docs.
  - Depends on: T004
  - Files: `docs/design/mcp-surface-design.md`,
    `docs/design/language-adapter-design.md`
  - Acceptance: Durable docs describe current resource-backed template routing
    and future semantic limits.
  - Evidence: Updated `docs/design/mcp-surface-design.md`,
    `docs/design/language-adapter-design.md`, and
    `docs/reference/documentation-map.md` with current resource-backed
    template routing behavior and semantic limits.

- [x] T006 Validate and close the spec.
  - Depends on: T005
  - Files: `docs/specs/006-infra-template-routing/verification.md`
  - Acceptance: Verification records focused tests, full-suite decision, and
    promotion evidence.
  - Evidence: Verification recorded focused tests, full `pnpm test`,
    `pnpm typecheck`, `git diff --check`, and active-spec lint; spec archived
    on 2026-06-05.
