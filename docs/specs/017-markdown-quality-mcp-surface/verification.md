---
title: Markdown quality MCP surface verification
doc_type: spec
artifact_type: verification
status: archived
owner: platform
last_reviewed: 2026-06-06
---

# Verification

## Quality Gates

- `pnpm typecheck`
- Focused Markdown checker, presenter, MCP, skipped-path, budget, and
  validation-planning tests
- `pnpm test` before closure
- Spec lifecycle lint or scan
- `git diff --check`

## Evidence Log

| Date | Activity | Result |
| --- | --- | --- |
| 2026-06-06 | Spec created from post-MVP Markdown quality backlog | Pending implementation |
| 2026-06-06 | T001-T005 implementation: fixtures, parser/checker ports, `check_markdown_document`, `check_markdown_set`, and verification-plan integration | Passed focused validation: `pnpm typecheck`; `pnpm exec vitest run tests/docs/markdown-quality.test.ts tests/mcp/docs-surfaces.test.ts tests/mcp/verification-plan-tool.test.ts tests/mcp/registry-metadata.test.ts`. Broader MCP/integration run passed except one shared SQLite lock under parallel load; the failing composed-server profile test passed when rerun alone. |
| 2026-06-06 | T006 closure: durable docs promoted, formatter/report work deferred, and spec archived | Passed closure validation: `pnpm typecheck`, `pnpm test`, `git diff --check`, and spec lifecycle scan. |

## Residual Risks

- Markdown parsing and formatting are easy to conflate. This spec must stay
  read-only.
- Repository documentation policies vary. The first slice should keep policy
  configurable and avoid hard-coded assumptions beyond fixture-backed defaults.
