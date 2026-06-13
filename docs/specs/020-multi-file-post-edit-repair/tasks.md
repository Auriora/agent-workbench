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

- [x] T001 Add hook-log and multi-file fixtures.
  - Files: `tests/feedback/`, `tests/fixtures/`
  - Acceptance: Fixtures cover clean, actionable, timeout, unavailable,
    provider-failed, too-many-files, and multi-file skipped states.
  - Evidence: `pnpm exec vitest run tests/feedback/post-edit-feedback.test.ts tests/feedback/post-edit-hook-fixtures.test.ts` passed on 2026-06-13.

- [x] T002 Add post-edit budget and skipped-state model.
  - Depends on: T001
  - Files: `src/application/use-cases/`, `src/contracts/`, `tests/feedback/`
  - Acceptance: Internal result distinguishes checked, actionable, queued,
    skipped, unavailable, errored, and silent outcomes.
  - Evidence: `pnpm exec vitest run tests/feedback/post-edit-feedback.test.ts tests/feedback/post-edit-hook-fixtures.test.ts` and `pnpm typecheck` passed on 2026-06-13.

- [x] T003 Update hook-facing presenter and scripts.
  - Depends on: T002
  - Files: `src/presentation/`, `plugins/agent-workbench/hooks/`,
    `tests/integration/`
  - Acceptance: Clean/errored/unsupported results produce no user-facing hook
    noise; actionable findings are concise and repo-relative.
  - Evidence: `pnpm exec vitest run tests/feedback/post-edit-feedback.test.ts tests/feedback/post-edit-hook-fixtures.test.ts tests/integration/kiro-power.test.ts` and `pnpm typecheck` passed on 2026-06-13.

- [x] T004 Add telemetry/logger coverage for deferred reasons.
  - Depends on: T002
  - Files: `src/infrastructure/telemetry/`, `tests/mcp/`,
    `tests/feedback/`
  - Acceptance: Deferred and skipped reasons are observable without hook noise.
  - Evidence: `pnpm exec vitest run tests/feedback/post-edit-feedback.test.ts tests/feedback/post-edit-hook-fixtures.test.ts tests/integration/kiro-power.test.ts tests/mcp/telemetry-instrumentation.test.ts tests/telemetry/boundary-instrumentation.test.ts` and `pnpm typecheck` passed on 2026-06-13.

- [x] T005 Promote docs, validate, and close.
  - Depends on: T003, T004
  - Files: `docs/design/edit-and-validation-loop-design.md`,
    `docs/design/coding-agent-integration-design.md`,
    `docs/reference/documentation-map.md`,
    `docs/specs/020-multi-file-post-edit-repair/`
  - Acceptance: Durable docs describe multi-file repair behavior and full
    relevant validation passes.
  - Evidence: Durable docs promoted. `pnpm typecheck`, focused feedback/hook/Kiro/telemetry tests, `mcp__spec_lifecycle_manager.lint_spec_package`, `git diff --check`, and unsandboxed `pnpm exec vitest run` passed on 2026-06-13. Sandboxed full `pnpm test` timed out only in spawned stdio initialize tests; isolated and full unsandboxed Vitest passed.
