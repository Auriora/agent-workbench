---
title: Spec task traceability lookup tasks
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

- [ ] T001 Decide Agent Workbench/spec-lifecycle-manager boundary.
  - Files: `docs/specs/021-spec-task-traceability-lookup/design.md`,
    `docs/design/mcp-surface-design.md`
  - Acceptance: Design states whether this is a dedicated tool,
    `context_for_task` integration, or both, and how authoritative lifecycle
    checks remain external.
  - Evidence: Pending.

- [ ] T002 Add spec fixture packages.
  - Depends on: T001
  - Files: `tests/fixtures/`, `tests/docs/`
  - Acceptance: Fixtures cover active, archived, malformed, and
    traceability-rich specs.
  - Evidence: Pending.

- [ ] T003 Implement bounded spec traceability reader.
  - Depends on: T002
  - Files: `src/application/`, `src/infrastructure/markdown/`,
    `src/contracts/`, `tests/docs/`
  - Acceptance: Reader returns task, requirement, design, file, validation,
    status, and missing-evidence summaries without mutating specs.
  - Evidence: Pending.

- [ ] T004 Integrate with task context and/or MCP surface.
  - Depends on: T003
  - Files: `src/application/use-cases/get-task-context.ts`,
    `src/interface-adapters/mcp/`, `src/presentation/`, `tests/mcp/`
  - Acceptance: Spec/task prompts route to relevant spec artifacts and label
    archived specs.
  - Evidence: Pending.

- [ ] T005 Promote docs, validate, and close.
  - Depends on: T004
  - Files: `docs/design/mcp-surface-design.md`,
    `docs/design/coding-agent-integration-design.md`,
    `docs/reference/documentation-map.md`,
    `docs/specs/021-spec-task-traceability-lookup/`
  - Acceptance: Durable docs describe traceability behavior and validation
    passes.
  - Evidence: Pending.
