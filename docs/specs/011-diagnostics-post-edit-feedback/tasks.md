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

- [x] T001 Add diagnostics and feedback fixtures.
  - Files: `tests/fixtures/`, `tests/diagnostics/`, `tests/hooks/`
  - Acceptance: Fixtures cover clean files, syntax/config findings,
    unsupported files, optional provider failures, and hook quiet behavior.
  - Evidence: Completed on 2026-06-05. Added
    `tests/fixtures/fixture-diagnostics-feedback/` and
    `tests/diagnostics/diagnose-changed-files.test.ts` covering clean Markdown,
    provider-simulated config syntax findings, unsupported Java files, optional
    provider failures, invalid-input envelopes, and refused unsafe paths.

- [x] T002 Define diagnostics provider contracts.
  - Depends on: T001
  - Files: `src/ports/`, `src/contracts/`, `src/application/`
  - Acceptance: Provider result and status types are language-neutral and do
    not expose backend-specific raw output.
  - Evidence: Completed on 2026-06-05. Added diagnostics request/result,
    finding, category, and provider-status schemas in
    `src/contracts/runtime-contracts.ts`, plus `DiagnosticsProviderPort` and
    `DiagnosticsProviderResult` in `src/ports/index.ts`.

- [x] T003 Implement changed-file diagnostics use case and presenter.
  - Depends on: T002
  - Files: `src/application/use-cases/`, `src/presentation/`, `tests/`
  - Acceptance: Diagnostics are bounded, relative-path-only, quiet when clean,
    and explicit when unsupported or blocked.
  - Evidence: Completed on 2026-06-05. Added
    `diagnoseChangedFiles` and `diagnostics-presenter` with provider-backed
    findings, quiet clean responses, unsupported-provider statuses, optional
    provider failure suppression, relative-path sanitization, and
    `verification_plan` next actions. Validation:
    `pnpm exec vitest run tests/diagnostics/diagnose-changed-files.test.ts`
    passed with 6 tests; `pnpm typecheck` passed.

- [x] T004 Decide and wire MCP surface.
  - Depends on: T003
  - Files: `src/interface-adapters/mcp/`, `src/mcp/`, `tests/mcp/`
  - Acceptance: Either `diagnostics_for_files` is exposed with schema and tests,
    or the deferral is documented with equivalent workflow support.
  - Evidence: Completed on 2026-06-05. Exposed
    `diagnostics_for_files` through the MCP registry, stdio server, registry
    metadata, malformed-input handling, Codex integration profile, and common
    integration profile. Added a focused MCP tool test and a real JSON syntax
    diagnostics provider for the composed server. Validation:
    `pnpm exec vitest run tests/mcp/diagnostics-for-files-tool.test.ts tests/mcp/registry-metadata.test.ts tests/mcp/malformed-input.test.ts tests/mcp/query-tools.test.ts tests/mcp/verification-plan-tool.test.ts tests/mcp/workspace-edit-tools.test.ts tests/integration/common-integration-profile.test.ts tests/integration/usage-informed-mvp.test.ts`
    passed with 70 tests; `pnpm exec vitest run tests/mcp/stdio-entrypoint.test.ts`
    passed with 7 tests; `pnpm typecheck` passed.

- [x] T005 Implement post-edit feedback use case and hook integration.
  - Depends on: T003
  - Files: `src/application/use-cases/`, `src/presentation/`,
    `scripts/`, `.codex/`, `tests/hooks/`
  - Acceptance: Feedback combines diagnostics, edit risk, validation status,
    and next actions while hooks stay silent for clean/error-only optional
    cases.
  - Evidence: Completed on 2026-06-06. Added internal
    `buildPostEditFeedback` use case and `post-edit-feedback-presenter` for
    combining diagnostics, edit risks, validation status, quiet hook messages,
    and MCP next actions without exposing a new public MCP tool. Updated the
    Codex post-edit hook wrapper to build structured feedback while preserving
    silence for clean edits and tool failures. Validation:
    `pnpm exec vitest run tests/feedback/post-edit-feedback.test.ts tests/integration/codex-integration-profile.test.ts`
    passed with 12 tests; `pnpm typecheck` passed.

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
