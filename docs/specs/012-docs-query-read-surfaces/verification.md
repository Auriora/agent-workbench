---
title: Docs query and read surfaces verification
doc_type: spec
artifact_type: verification
status: archived
owner: platform
last_reviewed: 2026-06-06
---

# Verification

## Closure Record

Spec 012 closed on 2026-06-06. Accepted behavior was promoted to
[MCP surface design](../../design/mcp-surface-design.md),
[Markdown document quality design](../../design/markdown-document-quality-design.md),
and [Documentation map](../../reference/documentation-map.md).

The public docs surfaces are `repo:///docs/overview`, `repo:///docs/map`,
`docs_search`, `docs_outline`, and `docs_read_section`. Crosslink graphs and
generated documentation reports remain deferred until usage evidence and
fixture-backed budget tests justify promotion.

## Quality Gates

- `pnpm typecheck`
- Focused docs query, presenter, and MCP tests introduced by this spec
- `pnpm test` before closure if shared docs indexing or MCP presentation
  changes
- `python3 /home/bcherrington/.codex/skills/spec-lifecycle-manager/scripts/spec_runtime.py lint docs/specs/012-docs-query-read-surfaces`
- `git diff --check`

## Evidence Log

| Date | Activity | Result |
| --- | --- | --- |
| 2026-06-05 | Spec created from Spec 010 T005 follow-up planning | Implementation completed and spec archived on 2026-06-06 |
| 2026-06-06 | T001 docs query fixtures | Added `tests/fixtures/fixture-docs-query-repo/` and `tests/docs/docs-query-fixtures.test.ts`; focused fixture test and `pnpm typecheck` passed |
| 2026-06-06 | T002 docs index/query application contracts | Added shared docs contracts, `DocsIndexPort`, and docs query use cases for overview, map, search, outline, and read-section. `pnpm exec vitest run tests/docs/query-docs.test.ts tests/docs/docs-query-fixtures.test.ts tests/contracts/presentation-metadata.test.ts` passed with 11 tests; `pnpm typecheck` passed |
| 2026-06-06 | T003 docs presenters | Added docs overview, map, search, outline, and read-section presenters plus invalid-input envelopes. `pnpm exec vitest run tests/docs/docs-presenter.test.ts tests/docs/query-docs.test.ts tests/docs/docs-query-fixtures.test.ts` passed with 9 tests; `pnpm typecheck` passed. |
| 2026-06-06 | T004 MCP docs resources and tools | Added `repo:///docs/overview`, `repo:///docs/map`, `docs_search`, `docs_outline`, and `docs_read_section`; wired production providers and Codex integration metadata. `pnpm exec vitest run tests/mcp/docs-surfaces.test.ts tests/mcp/registry-metadata.test.ts tests/mcp/malformed-input.test.ts tests/mcp/query-tools.test.ts tests/mcp/workspace-edit-tools.test.ts tests/mcp/verification-plan-tool.test.ts tests/mcp/stdio-entrypoint.test.ts tests/integration/codex-integration-profile.test.ts tests/integration/common-integration-profile.test.ts` passed with 83 tests; `pnpm typecheck` passed. |
| 2026-06-06 | T005 durable documentation promotion | Promoted docs-query MCP behavior to `docs/design/mcp-surface-design.md`, documented Markdown quality boundaries in `docs/design/markdown-document-quality-design.md`, and updated `docs/reference/documentation-map.md`. Final validation captured under T006. |
| 2026-06-06 | T006 final validation and archival | Archived the package after durable promotion. `pnpm typecheck`, focused docs/MCP tests, `pnpm test`, docs metadata checks, spec MCP lint, and `git diff --check` passed. |

## Residual Risks

- Docs search could become another broad orientation surface if it returns too
  much content. Keep caps and direct-read caveats strict.
- Crosslink/report pressure should remain deferred until core query/read
  workflows prove useful and bounded.
