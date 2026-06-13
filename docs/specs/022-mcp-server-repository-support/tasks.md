---
title: MCP server repository support tasks
doc_type: spec
artifact_type: tasks
status: active
owner: platform
last_reviewed: 2026-06-13
---

# Tasks

## Task Dependency Graph

```text
T001 -> T002 -> T003 -> T004 -> T005
```

- [x] T001 Add MCP server fixture repositories.
  - Files: `tests/fixtures/`, `tests/mcp/`, `tests/workspace/`
  - Acceptance: Fixtures cover stdio, HTTP/SSE, streamable HTTP, Docker, and
    ambiguous MCP evidence.
  - Evidence: Added stdio, HTTP/SSE, streamable HTTP, Docker/devcontainer, and
    ambiguous MCP fixture repositories under `tests/fixtures/`; focused MCP
    tests passed on 2026-06-13.

- [x] T002 Implement MCP project-shape detection.
  - Depends on: T001
  - Files: `src/application/use-cases/`, `src/infrastructure/filesystem/`,
    `tests/workspace/`
  - Acceptance: Detector labels entrypoints, transports, tool registry
    evidence, docs, and confidence without executing commands.
  - Evidence: Added `src/application/use-cases/mcp-server-shape.ts` with
    entrypoint, transport, tool registry, protocol-doc, config, environment,
    confidence, and ignored-path classification; focused MCP tests passed on
    2026-06-13.

- [x] T003 Surface MCP context in overview/task context.
  - Depends on: T002
  - Files: `src/application/use-cases/get-repo-overview.ts`,
    `src/application/use-cases/get-task-context.ts`,
    `src/presentation/`, `tests/mcp/`
  - Acceptance: MCP-server repos surface useful entrypoints, transport hints,
    and docs without generated/vendor noise.
  - Evidence: Updated `get-repo-overview.ts` and `get-task-context.ts`; focused
    overview/context tests passed on 2026-06-13 and assert generated MCP-looking
    noise is excluded.

- [x] T004 Add MCP validation planning.
  - Depends on: T002
  - Files: `src/application/use-cases/plan-verification.ts`,
    `tests/mcp/verification-plan-tool.test.ts`
  - Acceptance: Plans repo-evidence-based initialize/tools-list/call-tool smoke
    checks or blocked/manual evidence as planned/not_executed commands.
  - Evidence: Updated `plan-verification.ts`; focused verification-plan tests
    passed on 2026-06-13 and cover script-backed, manual, ambiguous, and
    host-blocked planning paths with planned/not_executed command status.

- [x] T005 Promote docs, validate, and close.
  - Depends on: T003, T004
  - Files: `docs/design/mcp-surface-design.md`,
    `docs/design/coding-agent-integration-design.md`,
    `docs/reference/documentation-map.md`,
    `docs/specs/022-mcp-server-repository-support/`
  - Acceptance: Durable docs describe MCP-server repo support and validation
    passes.
  - Evidence: Durable design docs updated; traceability added; `pnpm
    typecheck` and focused MCP tests passed on 2026-06-13. Final lifecycle
    lint, closure check, full test, and diff checks recorded in
    `verification.md`.
