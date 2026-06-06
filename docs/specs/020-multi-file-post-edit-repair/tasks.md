---
title: Multi-file post-edit repair tasks
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

- [ ] T001 Add hook-log and multi-file fixtures.
  - Files: `tests/feedback/`, `tests/fixtures/`
  - Acceptance: Fixtures cover clean, actionable, timeout, unavailable,
    provider-failed, too-many-files, and multi-file skipped states.
  - Evidence: Pending.

- [ ] T002 Add post-edit budget and skipped-state model.
  - Depends on: T001
  - Files: `src/application/use-cases/`, `src/contracts/`, `tests/feedback/`
  - Acceptance: Internal result distinguishes checked, actionable, queued,
    skipped, unavailable, errored, and silent outcomes.
  - Evidence: Pending.

- [ ] T003 Update hook-facing presenter and scripts.
  - Depends on: T002
  - Files: `src/presentation/`, `plugins/agent-workbench/hooks/`,
    `tests/integration/`
  - Acceptance: Clean/errored/unsupported results produce no user-facing hook
    noise; actionable findings are concise and repo-relative.
  - Evidence: Pending.

- [ ] T004 Add telemetry/logger coverage for deferred reasons.
  - Depends on: T002
  - Files: `src/infrastructure/telemetry/`, `tests/mcp/`,
    `tests/feedback/`
  - Acceptance: Deferred and skipped reasons are observable without hook noise.
  - Evidence: Pending.

- [ ] T005 Promote docs, validate, and close.
  - Depends on: T003, T004
  - Files: `docs/design/edit-and-validation-loop-design.md`,
    `docs/design/coding-agent-integration-design.md`,
    `docs/reference/documentation-map.md`,
    `docs/specs/020-multi-file-post-edit-repair/`
  - Acceptance: Durable docs describe multi-file repair behavior and full
    relevant validation passes.
  - Evidence: Pending.
