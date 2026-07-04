---
title: Repo-root authority tasks
doc_type: spec
artifact_type: tasks
status: active
owner: platform
last_reviewed: 2026-06-18
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Tasks

## Task Dependency Graph

```text
T001 -> T002 -> T003 -> T004 -> T005
T003 -> T006
T005,T006 -> T007
```

## Phase 1: Policy And Boundary

- [x] T001 Add root authority policy.
  - Files: `src/interface-adapters/mcp/`, `src/contracts/` if needed
  - Acceptance: Policy resolves launch root in normal mode and blocks
    alternate roots with a structured reason.
  - Evidence: Added `src/interface-adapters/mcp/registries/root-authority.ts`
    with launch-root resolution, normal-mode blocking, debug-mode resolution,
    and public metadata/schema helpers. Verified by `pnpm typecheck` and
    focused MCP Vitest slice on 2026-07-04.

- [x] T002 Gate debug root override.
  - Depends on: T001
  - Files: `src/mcp/stdio-launch.ts`, `src/server.ts`
  - Acceptance: A single hidden env var or flag enables debug overrides for
    Agent Workbench diagnostics only.
  - Evidence: Added `AGENT_WORKBENCH_DEBUG_REPO_ROOT_OVERRIDE=1` as the single
    stdio/server debug gate. `tests/mcp/stdio-entrypoint.test.ts` verifies the
    default disabled state and hidden env enablement.

- [x] T003 Apply policy to MCP resources and tools.
  - Depends on: T002
  - Files: `src/server.ts`, `src/interface-adapters/mcp/registries/`
  - Acceptance: Normal requests with `repo_root` are blocked; debug requests
    are validated through the policy.
  - Evidence: MCP tool/resource registry handlers now call
    `resolveMcpRequestRepoRoot` before use cases. Query-tool tests prove normal
    blocking and debug allowance; resource tests prove launch-root defaults.

## Phase 2: Metadata And Tests

- [x] T004 Hide normal `repo_root` parameters.
  - Depends on: T003
  - Files: `src/interface-adapters/mcp/registries/`, integration profile tests
  - Acceptance: Normal tool/resource schemas and generated integration
    guidance do not advertise `repo_root`.
  - Evidence: Tool registrations use `mcpShapeForRootAuthority` so normal
    schemas omit `repo_root`; exported registry metadata filters `repo_root`.
    `tests/mcp/registry-metadata.test.ts` verifies public metadata does not
    advertise the parameter.

- [x] T005 Add fixture and contract tests.
  - Depends on: T004
  - Files: `tests/mcp/`, `tests/contracts/`, `tests/integration/`
  - Acceptance: Tests prove normal blocking, debug allowance, metadata hiding,
    and no public next-action leakage.
  - Evidence: Added/updated MCP registry, graph-query, resource, stdio, and
    response-metadata tests. Focused validation passed: 10 files / 102 tests.

- [x] T006 Update durable docs.
  - Depends on: T003
  - Files: `docs/reference/workspace-safety-contract.md`,
    `docs/design/mcp-surface-design.md`, `docs/security/threat-model.md`
  - Acceptance: Durable docs describe launch-root authority and debug-only
    override behavior.
  - Evidence: Updated workspace safety, MCP surface design, threat model, and
    runtime contracts to document launch-root authority, debug env gate,
    integration-health `root_policy`, and public next-action `repo_root`
    removal.

- [x] T007 Validate and record closure readiness.
  - Depends on: T005, T006
  - Files: this spec package
  - Acceptance: `pnpm typecheck`, targeted MCP tests, and relevant integration
    profile tests pass or have documented waivers.
  - Evidence: `pnpm typecheck` passed. Focused MCP/contract Vitest slice passed:
    `tests/contracts/response-metadata.test.ts`,
    `tests/contracts/runtime-contracts.test.ts`,
    `tests/mcp/registry-metadata.test.ts`,
    `tests/mcp/repo-status-resource.test.ts`,
    `tests/mcp/repo-scope-overview-resource.test.ts`,
    `tests/mcp/integration-health-resource.test.ts`,
    `tests/mcp/docs-surfaces.test.ts`, `tests/mcp/query-tools.test.ts`,
    `tests/mcp/workspace-edit-tools.test.ts`, and
    `tests/mcp/stdio-entrypoint.test.ts`.
