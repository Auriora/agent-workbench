---
title: Multi-file post-edit repair verification
doc_type: spec
artifact_type: verification
status: active
owner: platform
last_reviewed: 2026-06-13
---

# Verification

## Quality Gates

- `pnpm typecheck`
- Focused feedback, hook, diagnostics, and telemetry tests
- `pnpm test` before closure
- `git diff --check`
- Spec lifecycle scan

## Validation Plan

- Prove clean hooks are silent.
- Prove actionable findings are concise and repo-relative.
- Prove too-many-files and unavailable providers are logged/telemetried without
  user-facing hook noise.

## Evidence Log

| Date | Activity | Result |
| --- | --- | --- |
| 2026-06-06 | Spec created from EB005 | Pending implementation |
| 2026-06-13 | T001 fixture coverage | `pnpm exec vitest run tests/feedback/post-edit-feedback.test.ts tests/feedback/post-edit-hook-fixtures.test.ts` passed. |
| 2026-06-13 | T002 structured outcome and deferred-check model | `pnpm exec vitest run tests/feedback/post-edit-feedback.test.ts tests/feedback/post-edit-hook-fixtures.test.ts` and `pnpm typecheck` passed. |
| 2026-06-13 | T003 hook-facing presenter and scripts | `pnpm exec vitest run tests/feedback/post-edit-feedback.test.ts tests/feedback/post-edit-hook-fixtures.test.ts tests/integration/kiro-power.test.ts` and `pnpm typecheck` passed. |
| 2026-06-13 | T004 telemetry/logger coverage | `pnpm exec vitest run tests/feedback/post-edit-feedback.test.ts tests/feedback/post-edit-hook-fixtures.test.ts tests/integration/kiro-power.test.ts tests/mcp/telemetry-instrumentation.test.ts tests/telemetry/boundary-instrumentation.test.ts` and `pnpm typecheck` passed. |
| 2026-06-13 | T005 durable promotion and final validation | `pnpm typecheck`, `mcp__spec_lifecycle_manager.lint_spec_package`, `git diff --check`, and unsandboxed `pnpm exec vitest run` passed. Sandboxed full `pnpm test` timed out only in spawned stdio initialize tests; isolated and full unsandboxed Vitest passed. |

## Closure Readiness

- Durable docs promoted: edit and validation loop design, coding-agent
  integration design, runtime contracts, and documentation map.
- Spec package removal is not performed until a final pre-removal spec commit
  exists, per repository closure practice.

## Residual Risks

- Hook payload shapes can change across Codex versions.
- Queued diagnostics may need runtime state not currently persisted.
