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

- [ ] T001 Add Markdown quality fixtures and rule cases.
  - Files: `tests/fixtures/`, `tests/docs/`
  - Acceptance: Fixtures cover skipped headings, duplicates, frontmatter,
    broken links, ordered-list numbering, table readability, fenced-code
    immunity, skipped paths, clean documents, and budgets.
  - Evidence: Pending.

- [ ] T002 Decide and wire the approved Markdown parser/checker ports.
  - Depends on: T001
  - Files: `src/ports/`, `src/contracts/`, `src/infrastructure/markdown/`,
    `tests/docs/`
  - Acceptance: One parser-aware read-only checker path exists without
    regex-only fallback or external linter execution.
  - Evidence: Pending.

- [ ] T003 Implement `check_markdown_document`.
  - Depends on: T002
  - Files: `src/application/`, `src/presentation/`, `src/mcp/`, `tests/mcp/`,
    `tests/docs/`
  - Acceptance: Tool returns compact findings, clean success, skipped/blocked
    states, caveats, and budgets with repo-relative paths.
  - Evidence: Pending.

- [ ] T004 Implement `check_markdown_set`.
  - Depends on: T003
  - Files: `src/application/`, `src/presentation/`, `src/mcp/`, `tests/mcp/`,
    `tests/docs/`
  - Acceptance: Tool checks bounded explicit or scoped doc sets and aggregates
    findings without unsafe broad reads.
  - Evidence: Pending.

- [ ] T005 Integrate Markdown quality into validation planning.
  - Depends on: T003
  - Files: `src/application/use-cases/`, `tests/validation/`, `tests/mcp/`
  - Acceptance: `verification_plan` plans Markdown quality checks for docs
    changes and stays quiet/manual when evidence is unavailable.
  - Evidence: Pending.

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
