---
title: MCP server repository support tasks
doc_type: spec
artifact_type: tasks
status: active
owner: platform
last_reviewed: 2026-06-06
---

# Tasks

## Task Dependency Graph

```text
T001 -> T002 -> T003 -> T004 -> T005
```

- [ ] T001 Add MCP server fixture repositories.
  - Files: `tests/fixtures/`, `tests/mcp/`, `tests/workspace/`
  - Acceptance: Fixtures cover stdio, HTTP/SSE, streamable HTTP, Docker, and
    ambiguous MCP evidence.
  - Evidence: Pending.

- [ ] T002 Implement MCP project-shape detection.
  - Depends on: T001
  - Files: `src/application/use-cases/`, `src/infrastructure/filesystem/`,
    `tests/workspace/`
  - Acceptance: Detector labels entrypoints, transports, tool registry
    evidence, docs, and confidence without executing commands.
  - Evidence: Pending.

- [ ] T003 Surface MCP context in overview/task context.
  - Depends on: T002
  - Files: `src/application/use-cases/get-repo-overview.ts`,
    `src/application/use-cases/get-task-context.ts`,
    `src/presentation/`, `tests/mcp/`
  - Acceptance: MCP-server repos surface useful entrypoints, transport hints,
    and docs without generated/vendor noise.
  - Evidence: Pending.

- [ ] T004 Add MCP validation planning.
  - Depends on: T002
  - Files: `src/application/use-cases/plan-verification.ts`,
    `tests/mcp/verification-plan-tool.test.ts`
  - Acceptance: Plans repo-evidence-based initialize/tools-list/call-tool smoke
    checks or blocked/manual evidence without execution.
  - Evidence: Pending.

- [ ] T005 Promote docs, validate, and close.
  - Depends on: T003, T004
  - Files: `docs/design/mcp-surface-design.md`,
    `docs/design/coding-agent-integration-design.md`,
    `docs/reference/documentation-map.md`,
    `docs/specs/022-mcp-server-repository-support/`
  - Acceptance: Durable docs describe MCP-server repo support and validation
    passes.
  - Evidence: Pending.
