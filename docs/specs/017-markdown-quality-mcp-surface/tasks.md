---
title: Markdown quality MCP surface tasks
doc_type: spec
artifact_type: tasks
status: active
owner: platform
last_reviewed: 2026-06-06
---

# Tasks

## Task Dependency Graph

```text
T001 -> T002 -> T003 -> T004 -> T005 -> T006
```

- [x] T001 Add Markdown quality fixtures and rule cases.
  - Files: `tests/fixtures/`, `tests/docs/`
  - Acceptance: Fixtures cover skipped headings, duplicates, frontmatter,
    broken links, ordered-list numbering, table readability, fenced-code
    immunity, skipped paths, clean documents, and budgets.
  - Evidence: Completed on 2026-06-06. Added
    `tests/fixtures/fixture-markdown-quality-repo/` and
    `tests/docs/markdown-quality.test.ts` coverage for skipped headings,
    duplicate headings, frontmatter, broken links, ordered-list numbering,
    table readability, fenced-code immunity, skipped generated paths, clean
    documents, and finding budgets.

- [x] T002 Decide and wire the approved Markdown parser/checker ports.
  - Depends on: T001
  - Files: `src/ports/`, `src/contracts/`, `src/infrastructure/markdown/`,
    `tests/docs/`
  - Acceptance: One parser-aware read-only checker path exists without
    regex-only fallback or external linter execution.
  - Evidence: Completed on 2026-06-06. Added Markdown quality contracts,
    parser/checker ports, `MarkdownParserAdapter`, and
    `MarkdownStructureCheckerAdapter` as the single parser-aware read-only
    implementation path without external linter execution.

- [x] T003 Implement `check_markdown_document`.
  - Depends on: T002
  - Files: `src/application/`, `src/presentation/`, `src/mcp/`, `tests/mcp/`,
    `tests/docs/`
  - Acceptance: Tool returns compact findings, clean success, skipped/blocked
    states, caveats, and budgets with repo-relative paths.
  - Evidence: Completed on 2026-06-06. Added the document check use case,
    presenter, MCP tool, server provider, integration-profile entry, and MCP
    tests. Focused validation passed with `pnpm typecheck` and
    `pnpm exec vitest run tests/docs/markdown-quality.test.ts
    tests/mcp/docs-surfaces.test.ts tests/mcp/registry-metadata.test.ts`.

- [x] T004 Implement `check_markdown_set`.
  - Depends on: T003
  - Files: `src/application/`, `src/presentation/`, `src/mcp/`, `tests/mcp/`,
    `tests/docs/`
  - Acceptance: Tool checks bounded explicit or scoped doc sets and aggregates
    findings without unsafe broad reads.
  - Evidence: Completed on 2026-06-06. Added the set check use case, presenter,
    MCP tool, server provider, integration-profile entry, and tests for
    explicit paths, scoped bounded checks, and blocked unbounded calls.

- [x] T005 Integrate Markdown quality into validation planning.
  - Depends on: T003
  - Files: `src/application/use-cases/`, `tests/validation/`, `tests/mcp/`
  - Acceptance: `verification_plan` plans Markdown quality checks for docs
    changes and stays quiet/manual when evidence is unavailable.
  - Evidence: Completed on 2026-06-06. `verification_plan` now plans
    `check_markdown_document` for selected Markdown changes and
    `check_markdown_set` for include-all Markdown evidence, while retaining
    manual docs/config review for non-Markdown config evidence. Focused
    validation passed with `pnpm typecheck` and
    `pnpm exec vitest run tests/docs/markdown-quality.test.ts
    tests/mcp/docs-surfaces.test.ts tests/mcp/verification-plan-tool.test.ts
    tests/mcp/registry-metadata.test.ts`.

- [ ] T006 Promote docs, validate, and close.
  - Depends on: T004, T005
  - Files: `docs/design/markdown-document-quality-design.md`,
    `docs/design/mcp-surface-design.md`,
    `docs/design/edit-and-validation-loop-design.md`,
    `docs/reference/documentation-map.md`,
    `docs/specs/017-markdown-quality-mcp-surface/`
  - Acceptance: Durable docs describe accepted checker behavior and explicitly
    defer formatter/report work; full relevant validation passes before
    archival.
  - Evidence: Pending.
