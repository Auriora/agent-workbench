---
title: Repo-root authority verification
doc_type: spec
artifact_type: verification
status: active
owner: platform
last_reviewed: 2026-07-04
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Verification

## Quality Gates

- `pnpm typecheck`
- Focused MCP and contract Vitest slice:
  - `tests/contracts/response-metadata.test.ts`
  - `tests/contracts/runtime-contracts.test.ts`
  - `tests/mcp/registry-metadata.test.ts`
  - `tests/mcp/repo-status-resource.test.ts`
  - `tests/mcp/repo-scope-overview-resource.test.ts`
  - `tests/mcp/integration-health-resource.test.ts`
  - `tests/mcp/docs-surfaces.test.ts`
  - `tests/mcp/query-tools.test.ts`
  - `tests/mcp/workspace-edit-tools.test.ts`
  - `tests/mcp/stdio-entrypoint.test.ts`
- `spec-lifecycle-manager.lint_spec_package` for
  `docs/specs/029-repo-root-authority`
- `git diff --check`

## Evidence Log

### 2026-07-04

- `pnpm typecheck` passed.
- Focused MCP and contract Vitest slice passed: 10 files / 102 tests.
- Full `pnpm test` passed: 66 files / 486 tests.
- Normal-mode explicit `repo_root` requests are blocked before provider
  execution.
- Debug-mode explicit `repo_root` requests are allowed only when
  `AGENT_WORKBENCH_DEBUG_REPO_ROOT_OVERRIDE=1` or the equivalent test policy is
  supplied.
- Public registry metadata omits `repo_root`.
- Public next actions strip `repo_root` from arguments.
- Durable docs updated in workspace safety, MCP surface design, runtime
  contracts, and threat model.

## Residual Risks

- No known residual implementation risk after full suite validation.

## Closure Readiness

Ready for closure review after lifecycle lint and `git diff --check`.
