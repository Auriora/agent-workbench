---
title: Lambda result presentation tasks
doc_type: spec
artifact_type: tasks
status: archived
owner: platform
last_reviewed: 2026-06-06
---

# Tasks

Spec 008 closed on 2026-06-06. All tasks are complete and accepted behavior
was promoted to durable design/reference docs.

## Task Dependency Graph

```text
T001 -> T002 -> T003
T002 -> T004
T003 -> T005
T004 -> T005
```

- [x] T001 Add Lambda-heavy presentation fixtures.
  - Files: `tests/fixtures/`, `tests/graph/`, `tests/mcp/`
  - Acceptance: Fixtures include multiple templates or logical IDs sharing
    generic handler names and distinct handler files.
  - Evidence: Completed on 2026-06-06. Added
    `tests/fixtures/fixture-sam-lambda-heavy-repo/` with orders and billing SAM
    templates, three Lambda logical IDs using generic `app.handler` suffixes,
    distinct handler files, and nearby handler tests. Added graph/context tests
    that index the fixture and assert grouped handler binding and handler-file
    evidence. Validation:
    `pnpm exec vitest run tests/graph/query-tools.test.ts tests/mcp/context-for-task-tool.test.ts tests/graph/extraction-pipeline.test.ts`
    and `pnpm typecheck` passed.

- [x] T002 Improve handler result ranking/grouping.
  - Depends on: T001
  - Files: `src/application/use-cases/search-symbols.ts`,
    `src/application/use-cases/query-helpers.ts`, `tests/graph/`
  - Acceptance: Generic handler searches prioritize grouped logical-ID/template
    and handler-file evidence deterministically.
  - Evidence: Completed on 2026-06-06. `symbol_search` now expands returned
    Lambda handler bindings through bounded outgoing handler-file edges and
    orders grouped results by template path, logical ID, binding, and resolved
    handler file. `toSymbolReference` annotates Lambda handler binding and
    handler-file signatures with compact logical ID, template, and handler-file
    evidence. Validation: focused graph query tests and `pnpm typecheck`
    passed.

- [x] T003 Improve context presentation for Lambda-heavy tasks.
  - Depends on: T001, T002
  - Files: `src/application/use-cases/get-task-context.ts`, `tests/mcp/`
  - Acceptance: Context results remain compact while surfacing grouped template,
    handler, and nearby test evidence.
  - Evidence: Completed on 2026-06-06. `context_for_task` ranked-symbol
    selection now groups Lambda handler bindings and handler-file anchors using
    the same bounded edge evidence, while existing related-file ranking surfaces
    template, handler, and nearby test files. Added fixture-backed MCP context
    coverage for Lambda-heavy tasks. Validation: focused context tests and
    `pnpm typecheck` passed.

- [x] T004 Promote behavior to durable docs.
  - Depends on: T002
  - Files: `docs/design/mcp-surface-design.md`,
    `docs/design/language-adapter-design.md`
  - Acceptance: Durable docs describe Lambda result presentation behavior and
    semantic limits.
  - Evidence: Completed on 2026-06-06. Promoted accepted grouping behavior and
    semantic limits to `docs/design/mcp-surface-design.md`,
    `docs/design/language-adapter-design.md`, and
    `docs/reference/documentation-map.md`.

- [x] T005 Validate and close the spec.
  - Depends on: T003, T004
  - Files: `docs/specs/008-lambda-result-presentation/verification.md`
  - Acceptance: Verification records focused tests, full-suite decision, and
    promotion evidence.
  - Evidence: Completed on 2026-06-06. Updated verification evidence, archived
    the Spec 008 package in place, and recorded durable promotion. Validation:
    focused graph/query/context tests passed; `pnpm typecheck` passed;
    `pnpm test` passed with 48 files and 316 tests; Spec 008 lint passed;
    `git diff --check` passed.
