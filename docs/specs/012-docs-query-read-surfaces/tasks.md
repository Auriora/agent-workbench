---
title: Docs query and read surfaces tasks
doc_type: spec
artifact_type: tasks
status: active
owner: platform
last_reviewed: 2026-06-05
---

# Tasks

## Task Dependency Graph

```text
T001 -> T002 -> T003 -> T004 -> T005 -> T006
```

- [x] T001 Add docs query fixtures.
  - Files: `tests/fixtures/`, `tests/docs/`
  - Acceptance: Fixtures cover headings, duplicate headings, links, missing
    docs, unreadable docs, generated/vendor docs, and large docs sets.
  - Evidence: Completed on 2026-06-06. Added
    `tests/fixtures/fixture-docs-query-repo/` with nested Markdown docs,
    duplicate headings, valid and missing links, test-created unreadable docs,
    generated-output/vendor Markdown, and a 10-file reference set for row-cap
    tests. Added
    `tests/docs/docs-query-fixtures.test.ts` to prove fixture coverage and
    generated/vendor skip evidence. Validation:
    `pnpm exec vitest run tests/docs/docs-query-fixtures.test.ts` and
    `pnpm typecheck` passed.

- [ ] T002 Implement docs index/query application contracts.
  - Depends on: T001
  - Files: `src/application/`, `src/contracts/`, `src/ports/`
  - Acceptance: Overview, map, search, outline, and read-section results share
    envelope metadata and docs evidence labels.
  - Evidence: Pending.

- [ ] T003 Implement docs presenters.
  - Depends on: T002
  - Files: `src/presentation/`, `tests/docs/`
  - Acceptance: Presenters include direct-read caveats, truncation metadata,
    relative paths, and stable ordering.
  - Evidence: Pending.

- [ ] T004 Wire MCP resources and tools/templates.
  - Depends on: T003
  - Files: `src/interface-adapters/mcp/`, `src/mcp/`, `tests/mcp/`
  - Acceptance: Public docs surfaces are discoverable, schema-validated, and
    covered by golden MCP tests.
  - Evidence: Pending.

- [ ] T005 Promote accepted behavior to durable docs.
  - Depends on: T004
  - Files: `docs/design/mcp-surface-design.md`,
    `docs/design/markdown-document-quality-design.md`,
    `docs/reference/documentation-map.md`
  - Acceptance: Durable docs describe resources/tools, budgets, direct-read
    caveats, and deferred crosslink/report work.
  - Evidence: Pending.

- [ ] T006 Validate and close the spec.
  - Depends on: T005
  - Files: `docs/specs/012-docs-query-read-surfaces/`
  - Acceptance: Focused tests, `pnpm typecheck`, relevant docs checks, and spec
    lint pass before archival.
  - Evidence: Pending.
