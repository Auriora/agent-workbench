---
title: Repo-root authority tasks
doc_type: spec
artifact_type: tasks
status: active
owner: platform
last_reviewed: 2026-06-18
---

# Tasks

## Task Dependency Graph

```text
T001 -> T002 -> T003 -> T004 -> T005
T003 -> T006
T005,T006 -> T007
```

## Phase 1: Policy And Boundary

- [ ] T001 Add root authority policy.
  - Files: `src/interface-adapters/mcp/`, `src/contracts/` if needed
  - Acceptance: Policy resolves launch root in normal mode and blocks
    alternate roots with a structured reason.
  - Evidence: Pending.

- [ ] T002 Gate debug root override.
  - Depends on: T001
  - Files: `src/mcp/stdio-launch.ts`, `src/server.ts`
  - Acceptance: A single hidden env var or flag enables debug overrides for
    Agent Workbench diagnostics only.
  - Evidence: Pending.

- [ ] T003 Apply policy to MCP resources and tools.
  - Depends on: T002
  - Files: `src/server.ts`, `src/interface-adapters/mcp/registries/`
  - Acceptance: Normal requests with `repo_root` are blocked; debug requests
    are validated through the policy.
  - Evidence: Pending.

## Phase 2: Metadata And Tests

- [ ] T004 Hide normal `repo_root` parameters.
  - Depends on: T003
  - Files: `src/interface-adapters/mcp/registries/`, integration profile tests
  - Acceptance: Normal tool/resource schemas and generated integration
    guidance do not advertise `repo_root`.
  - Evidence: Pending.

- [ ] T005 Add fixture and contract tests.
  - Depends on: T004
  - Files: `tests/mcp/`, `tests/contracts/`, `tests/integration/`
  - Acceptance: Tests prove normal blocking, debug allowance, metadata hiding,
    and no public next-action leakage.
  - Evidence: Pending.

- [ ] T006 Update durable docs.
  - Depends on: T003
  - Files: `docs/reference/workspace-safety-contract.md`,
    `docs/design/mcp-surface-design.md`, `docs/security/threat-model.md`
  - Acceptance: Durable docs describe launch-root authority and debug-only
    override behavior.
  - Evidence: Pending.

- [ ] T007 Validate and record closure readiness.
  - Depends on: T005, T006
  - Files: this spec package
  - Acceptance: `pnpm typecheck`, targeted MCP tests, and relevant integration
    profile tests pass or have documented waivers.
  - Evidence: Pending.

