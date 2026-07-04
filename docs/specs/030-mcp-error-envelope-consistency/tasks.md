---
title: MCP error envelope consistency tasks
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
T001 -> T002 -> T003 -> T004 -> T005 -> T006
```

- [x] T001 Inventory current handler failure paths.
  - Files: `src/interface-adapters/mcp/registries/`, `src/presentation/`
  - Acceptance: Inventory identifies thrown use-case failures, provider gaps,
    and tool-specific envelope builders.
  - Evidence: Existing representative tool handlers duplicated parse,
    launch-root, provider, invoke, and JSON serialization paths in
    `context-for-task.ts`, `preview-workspace-edit.ts`,
    `apply-workspace-edit.ts`, `docs-search.ts`, `symbol-search.ts`, and
    `verification-plan.ts`. Preview/apply and verification already caught some
    provider failures but collapsed them into invalid-input envelopes; context,
    docs search, and symbol search could still rethrow provider exceptions.

- [x] T002 Add shared handler wrapper and classification model.
  - Depends on: T001
  - Files: `src/interface-adapters/mcp/`
  - Acceptance: Wrapper supports parse, provider, invoke, present, classify,
    and JSON text serialization.
  - Evidence: Added `src/interface-adapters/mcp/envelope.ts` with
    `registerMcpToolWithEnvelope`, failure classes for invalid input, provider
    unavailable, workspace safety blocked, stale state, environment
    unavailable, domain error, and internal error, plus JSON text serialization.

- [x] T003 Migrate representative tools.
  - Depends on: T002
  - Files: `src/interface-adapters/mcp/registries/tools/`
  - Acceptance: `context_for_task`, preview/apply edit, docs search, one
    graph-backed tool, and `verification_plan` use the wrapper.
  - Evidence: Migrated `context_for_task`, `preview_workspace_edit`,
    `apply_workspace_edit`, `docs_search`, `symbol_search`, and
    `verification_plan` to the shared wrapper while preserving their existing
    schemas, providers, success presenters, and public tool names.

- [x] T004 Add registry consistency tests.
  - Depends on: T003
  - Files: `tests/mcp/`, `tests/contracts/`
  - Acceptance: Tests cover invalid args, missing providers, domain failures,
    unknown failures, and JSON envelope output.
  - Evidence: Added `tests/mcp/error-envelope-consistency.test.ts` covering
    invalid arguments, missing providers across the representative tools, stale
    preview state, workspace safety refusal, graph/SQLite environment
    unavailability, and unexpected verification provider failures.

- [x] T005 Promote durable docs.
  - Depends on: T004
  - Files: `docs/reference/runtime-contracts.md`,
    `docs/design/mcp-surface-design.md`
  - Acceptance: Docs describe failure classes, recovery semantics, and handler
    wrapper expectations.
  - Evidence: Added MCP failure-class semantics to
    `docs/reference/runtime-contracts.md` and shared wrapper expectations to
    `docs/design/mcp-surface-design.md`.

- [x] T006 Validate and plan remaining migration.
  - Depends on: T005
  - Files: this spec package, backlog if follow-up remains
  - Acceptance: `pnpm typecheck` and targeted MCP tests pass; remaining
    unmigrated registries are routed explicitly.
  - Evidence: `pnpm typecheck` passed. `pnpm exec vitest run
    tests/mcp/error-envelope-consistency.test.ts
    tests/mcp/workspace-edit-tools.test.ts tests/mcp/query-tools.test.ts
    tests/mcp/context-for-task-tool.test.ts tests/mcp/docs-surfaces.test.ts
    tests/mcp/verification-plan-tool.test.ts` passed with 6 files and 99
    tests. Non-representative tools and resources are explicitly outside the
    representative first slice and keep their current handlers until a later
    wrapper expansion spec or maintenance task selects them.
