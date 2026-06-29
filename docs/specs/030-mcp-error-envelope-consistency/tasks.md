---
title: MCP error envelope consistency tasks
doc_type: spec
artifact_type: tasks
status: active
owner: platform
last_reviewed: 2026-06-18
---

# Tasks

## Task Dependency Graph

```text
T001 -> T002 -> T003 -> T004 -> T005 -> T006
```

- [ ] T001 Inventory current handler failure paths.
  - Files: `src/interface-adapters/mcp/registries/`, `src/presentation/`
  - Acceptance: Inventory identifies thrown use-case failures, provider gaps,
    and tool-specific envelope builders.
  - Evidence: Pending.

- [ ] T002 Add shared handler wrapper and classification model.
  - Depends on: T001
  - Files: `src/interface-adapters/mcp/`
  - Acceptance: Wrapper supports parse, provider, invoke, present, classify,
    telemetry, and JSON text serialization.
  - Evidence: Pending.

- [ ] T003 Migrate representative tools.
  - Depends on: T002
  - Files: `src/interface-adapters/mcp/registries/tools/`
  - Acceptance: `context_for_task`, preview/apply edit, docs search, one
    graph-backed tool, and `verification_plan` use the wrapper.
  - Evidence: Pending.

- [ ] T004 Add registry consistency tests.
  - Depends on: T003
  - Files: `tests/mcp/`, `tests/contracts/`
  - Acceptance: Tests cover invalid args, missing providers, domain failures,
    unknown failures, and JSON envelope output.
  - Evidence: Pending.

- [ ] T005 Promote durable docs.
  - Depends on: T004
  - Files: `docs/reference/runtime-contracts.md`,
    `docs/design/mcp-surface-design.md`
  - Acceptance: Docs describe failure classes, recovery semantics, and handler
    wrapper expectations.
  - Evidence: Pending.

- [ ] T006 Validate and plan remaining migration.
  - Depends on: T005
  - Files: this spec package, backlog if follow-up remains
  - Acceptance: `pnpm typecheck` and targeted MCP tests pass; remaining
    unmigrated registries are routed explicitly.
  - Evidence: Pending.

