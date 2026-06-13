---
title: MCP server repository support verification
doc_type: spec
artifact_type: verification
status: active
owner: platform
last_reviewed: 2026-06-13
---

# Verification

## Quality Gates

- `pnpm typecheck`
- Focused MCP-server fixture, overview, context, and verification-plan tests
- `pnpm test` before closure
- `git diff --check`
- Spec lifecycle scan

## Validation Plan

- Validate stdio, HTTP/SSE, streamable HTTP, Docker, and ambiguous fixtures.
- Validate context and overview outputs for entrypoints, transports, and docs.
- Validate verification planning for safe smoke checks and blocked/manual
  states.

## Evidence Log

| Date | Activity | Result |
| --- | --- | --- |
| 2026-06-06 | Spec created from EB007 | Pending implementation |
| 2026-06-13 | `pnpm exec vitest run tests/mcp/repo-scope-overview-resource.test.ts tests/mcp/context-for-task-tool.test.ts tests/mcp/verification-plan-tool.test.ts` | Passed: 3 files, 74 tests. |
| 2026-06-13 | `pnpm typecheck` | Passed. |
| 2026-06-13 | `git diff --check` | Passed. |
| 2026-06-13 | `pnpm exec vitest run --maxWorkers=1` | Passed: 62 files, 426 tests. Serial run used because suite-wide parallel runs timed out in spawned stdio MCP tests, while isolated stdio tests and the serial full suite passed. |

## Residual Risks

- MCP ecosystem conventions vary heavily across languages.
- Live protocol diagnostics should wait for integration health/session routing.
- Current detection is repository-shape evidence only; agents still need direct
  source reads before making precise claims about protocol behavior.
