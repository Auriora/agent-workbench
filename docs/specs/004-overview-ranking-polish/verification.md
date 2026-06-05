---
title: Overview ranking polish verification
doc_type: spec
artifact_type: verification
status: active
owner: platform
last_reviewed: 2026-06-05
---

# Verification

## Quality Gates

- `pnpm typecheck`
- `pnpm exec vitest run tests/mcp/repo-scope-overview-resource.test.ts`
- `pnpm test` when implementation changes shared ranking or contracts
- `git diff --check`

## Evidence Log

| Date | Check | Result |
| --- | --- | --- |
| 2026-06-05 | Spec created from durable MCP surface backlog | Pending implementation |

## Residual Risks

- Overview heuristics can improve routing but must not be treated as edit-proof
  evidence.
- Large external repositories may expose new ranking edge cases; those should
  become fixtures before implementation special-casing.
