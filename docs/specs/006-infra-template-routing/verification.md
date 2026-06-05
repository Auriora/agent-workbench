---
title: Infrastructure template routing verification
doc_type: spec
artifact_type: verification
status: archived
owner: platform
last_reviewed: 2026-06-05
---

# Verification

## Closure Record

Spec 006 closed on 2026-06-05. Accepted behavior was promoted to
[MCP surface design](../../design/mcp-surface-design.md) and
[Language adapter design](../../design/language-adapter-design.md).

## Quality Gates

- `pnpm typecheck`
- Focused graph extraction, context, impact, and verification-plan tests
- `pnpm test` before closure
- `git diff --check`

## Evidence Log

| Date | Check | Result |
| --- | --- | --- |
| 2026-06-05 | Spec created from durable infrastructure-template backlog | Implementation completed and promoted |
| 2026-06-05 | T001-T004 infrastructure routing implementation | `pnpm exec vitest run tests/graph/query-tools.test.ts tests/mcp/context-for-task-tool.test.ts tests/mcp/verification-plan-tool.test.ts tests/graph/extraction-pipeline.test.ts` passed: 4 files, 72 tests |
| 2026-06-05 | T005 durable docs promotion | Updated MCP surface, language adapter, and documentation-map docs with resource-backed template routing behavior and semantic caveats |
| 2026-06-05 | T006 closure validation | `pnpm test` passed: 38 files, 270 tests; `pnpm typecheck`, `git diff --check`, and `spec_runtime.py lint docs/specs/006-infra-template-routing` passed |

## Residual Risks

- CloudFormation/SAM semantics are broad; first implementation should remain
  routing evidence only.
- Handler string conventions vary by runtime and framework.
