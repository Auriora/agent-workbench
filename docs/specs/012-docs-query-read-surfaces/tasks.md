---
title: Docs query and read surfaces tasks
doc_type: spec
artifact_type: tasks
status: archived
owner: platform
last_reviewed: 2026-06-06
---

# Tasks

Spec 012 closed on 2026-06-06. All tasks are complete and accepted behavior was
promoted to durable design/reference docs.

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

- [x] T002 Implement docs index/query application contracts.
  - Depends on: T001
  - Files: `src/application/`, `src/contracts/`, `src/ports/`
  - Acceptance: Overview, map, search, outline, and read-section results share
    envelope metadata and docs evidence labels.
  - Evidence: Completed on 2026-06-06. Added docs request/result schemas for
    overview, map, search, outline, and read-section in
    `src/contracts/runtime-contracts.ts`; added `DocsIndexPort` in
    `src/ports/index.ts`; added `src/application/use-cases/query-docs.ts`
    with bounded Markdown indexing, heading IDs, link resolution, direct-read
    caveats, skipped-doc warnings, search hits, outlines, and section reads.
    Validation:
    `pnpm exec vitest run tests/docs/query-docs.test.ts tests/docs/docs-query-fixtures.test.ts tests/contracts/presentation-metadata.test.ts`
    passed with 11 tests; `pnpm typecheck` passed.

- [x] T003 Implement docs presenters.
  - Depends on: T002
  - Files: `src/presentation/`, `tests/docs/`
  - Acceptance: Presenters include direct-read caveats, truncation metadata,
    relative paths, and stable ordering.
  - Evidence: Completed on 2026-06-06. Added
    `src/presentation/docs-presenter.ts` with envelopes for docs overview, map,
    search, outline, and read-section results plus invalid-input envelopes for
    future MCP handlers. Added `tests/docs/docs-presenter.test.ts` covering
    direct-read caveats, truncation metadata, relative path normalization, and
    stable ordering. Validation:
    `pnpm exec vitest run tests/docs/docs-presenter.test.ts tests/docs/query-docs.test.ts tests/docs/docs-query-fixtures.test.ts`
    passed with 9 tests; `pnpm typecheck` passed.

- [x] T004 Wire MCP resources and tools/templates.
  - Depends on: T003
  - Files: `src/interface-adapters/mcp/`, `src/mcp/`, `tests/mcp/`
  - Acceptance: Public docs surfaces are discoverable, schema-validated, and
    covered by golden MCP tests.
  - Evidence: Completed on 2026-06-06. Added MCP resources for
    `repo:///docs/overview` and `repo:///docs/map`; added `docs_search`,
    `docs_outline`, and `docs_read_section` tools; wired production providers
    through `src/server.ts`; updated Codex integration profile and public
    registry metadata. Added `tests/mcp/docs-surfaces.test.ts` for injected
    providers, default repo-root behavior, invalid-input blocking, and envelope
    shape. Validation:
    `pnpm exec vitest run tests/mcp/docs-surfaces.test.ts tests/mcp/registry-metadata.test.ts tests/mcp/malformed-input.test.ts tests/mcp/query-tools.test.ts tests/mcp/workspace-edit-tools.test.ts tests/mcp/verification-plan-tool.test.ts tests/mcp/stdio-entrypoint.test.ts tests/integration/codex-integration-profile.test.ts tests/integration/common-integration-profile.test.ts`
    passed with 83 tests; `pnpm typecheck` passed.

- [x] T005 Promote accepted behavior to durable docs.
  - Depends on: T004
  - Files: `docs/design/mcp-surface-design.md`,
    `docs/design/markdown-document-quality-design.md`,
    `docs/reference/documentation-map.md`
  - Acceptance: Durable docs describe resources/tools, budgets, direct-read
    caveats, and deferred crosslink/report work.
  - Evidence: Completed on 2026-06-06. Promoted docs resources/tools, budgets,
    direct-read caveats, relative-path/truncation requirements, and deferred
    crosslink/report criteria to `docs/design/mcp-surface-design.md`; clarified
    the boundary between docs query/read surfaces and future Markdown quality
    tools in `docs/design/markdown-document-quality-design.md`; updated
    `docs/reference/documentation-map.md` to treat Spec 012 as an archived
    delivery record.

- [x] T006 Validate and close the spec.
  - Depends on: T005
  - Files: `docs/specs/012-docs-query-read-surfaces/`
  - Acceptance: Focused tests, `pnpm typecheck`, relevant docs checks, and spec
    lint pass before archival.
  - Evidence: Completed on 2026-06-06. Archived the Spec 012 package after
    durable promotion. Final validation is recorded in `verification.md`.
