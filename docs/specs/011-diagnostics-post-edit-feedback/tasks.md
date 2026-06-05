---
title: Diagnostics and post-edit feedback tasks
doc_type: spec
artifact_type: tasks
status: active
owner: platform
last_reviewed: 2026-06-05
---

# Tasks

## Task Dependency Graph

```text
T001 -> T002 -> T003 -> T004 -> T005 -> T006
             \-> T007 -----------/
```

- [ ] T001 Add diagnostics and feedback fixtures.
  - Files: `tests/fixtures/`, `tests/diagnostics/`, `tests/hooks/`
  - Acceptance: Fixtures cover clean files, syntax/config findings,
    unsupported files, optional provider failures, and hook quiet behavior.
  - Evidence: Pending.

- [ ] T002 Define diagnostics provider contracts.
  - Depends on: T001
  - Files: `src/ports/`, `src/contracts/`, `src/application/`
  - Acceptance: Provider result and status types are language-neutral and do
    not expose backend-specific raw output.
  - Evidence: Pending.

- [ ] T003 Implement changed-file diagnostics use case and presenter.
  - Depends on: T002
  - Files: `src/application/use-cases/`, `src/presentation/`, `tests/`
  - Acceptance: Diagnostics are bounded, relative-path-only, quiet when clean,
    and explicit when unsupported or blocked.
  - Evidence: Pending.

- [ ] T004 Decide and wire MCP surface.
  - Depends on: T003
  - Files: `src/interface-adapters/mcp/`, `src/mcp/`, `tests/mcp/`
  - Acceptance: Either `diagnostics_for_files` is exposed with schema and tests,
    or the deferral is documented with equivalent workflow support.
  - Evidence: Pending.

- [ ] T005 Implement post-edit feedback use case and hook integration.
  - Depends on: T003
  - Files: `src/application/use-cases/`, `src/presentation/`,
    `scripts/`, `.codex/`, `tests/hooks/`
  - Acceptance: Feedback combines diagnostics, edit risk, validation status,
    and next actions while hooks stay silent for clean/error-only optional
    cases.
  - Evidence: Pending.

- [ ] T006 Promote accepted behavior to durable docs.
  - Depends on: T004, T005
  - Files: `docs/design/edit-and-validation-loop-design.md`,
    `docs/design/mcp-surface-design.md`,
    `docs/design/coding-agent-integration-design.md`
  - Acceptance: Durable docs describe provider contracts, surface decisions,
    presenter behavior, and hook boundaries.
  - Evidence: Pending.

- [ ] T007 Validate and close the spec.
  - Depends on: T006
  - Files: `docs/specs/011-diagnostics-post-edit-feedback/`
  - Acceptance: Focused tests, `pnpm typecheck`, relevant docs checks, and spec
    lint pass before archival.
  - Evidence: Pending.
