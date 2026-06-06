---
title: Diagnostics and post-edit feedback verification
doc_type: spec
artifact_type: verification
status: archived
owner: platform
last_reviewed: 2026-06-06
---

# Verification

## Closure Record

Spec 011 closed on 2026-06-06. Accepted behavior was promoted to
[Edit and validation loop design](../../design/edit-and-validation-loop-design.md),
[MCP surface design](../../design/mcp-surface-design.md), and
[Coding agent integration design](../../design/coding-agent-integration-design.md).

The public diagnostics surface is `diagnostics_for_files`. Post-edit feedback
is retained as an internal/hook-facing workflow rather than a public MCP tool.

## Quality Gates

- `pnpm typecheck`
- Focused diagnostics, MCP, presenter, and hook tests introduced by this spec
- `pnpm test` before closure if shared presentation or hook behavior changes
- `python3 /home/bcherrington/.codex/skills/spec-lifecycle-manager/scripts/spec_runtime.py lint docs/specs/011-diagnostics-post-edit-feedback`
- `git diff --check`

## Evidence Log

| Date | Activity | Result |
| --- | --- | --- |
| 2026-06-05 | Spec created from Spec 010 T005 follow-up planning | Implementation completed and spec archived on 2026-06-06 |
| 2026-06-05 | T001-T003 diagnostics contracts, fixtures, use case, and presenter | `pnpm exec vitest run tests/diagnostics/diagnose-changed-files.test.ts` passed with 6 tests; `pnpm exec vitest run tests/contracts/runtime-contracts.test.ts tests/diagnostics/diagnose-changed-files.test.ts` passed with 17 tests; `pnpm typecheck`, `pnpm test`, `spec_runtime.py lint docs/specs/011-diagnostics-post-edit-feedback`, `pnpm exec vitest run tests/docs/docs-links-metadata.test.ts`, and `git diff --check` passed |
| 2026-06-05 | T004 public MCP diagnostics surface | `diagnostics_for_files` wired through MCP registry, stdio composition, profile metadata, and malformed-input handling. `pnpm exec vitest run tests/mcp/diagnostics-for-files-tool.test.ts tests/mcp/registry-metadata.test.ts tests/mcp/malformed-input.test.ts tests/mcp/query-tools.test.ts tests/mcp/verification-plan-tool.test.ts tests/mcp/workspace-edit-tools.test.ts tests/integration/common-integration-profile.test.ts tests/integration/usage-informed-mvp.test.ts` passed with 70 tests; `pnpm exec vitest run tests/mcp/stdio-entrypoint.test.ts` passed with 7 tests; `pnpm typecheck` passed |
| 2026-06-06 | T005 internal post-edit feedback use case and hook integration | `post_edit_feedback` kept internal/hook-facing rather than public MCP. `pnpm exec vitest run tests/feedback/post-edit-feedback.test.ts tests/integration/codex-integration-profile.test.ts` passed with 12 tests; `pnpm typecheck` passed |
| 2026-06-06 | T006 durable documentation promotion | Durable design docs updated for diagnostics provider contracts, `diagnostics_for_files`, internal post-edit feedback, quiet presenter behavior, and hook boundaries. Final validation captured under T007. |
| 2026-06-06 | T007 final validation and archival | Added traceability and archived the package. `pnpm typecheck` passed; `pnpm test` passed with 41 files and 283 tests; `pnpm exec vitest run tests/docs/docs-links-metadata.test.ts` passed with 2 tests; `spec_runtime.py lint docs/specs/011-diagnostics-post-edit-feedback` passed with no diagnostics; `git diff --check` passed |

## Residual Risks

- Adding both diagnostics and post-edit feedback as public tools could expand
  the MCP surface too far. T005 resolved this by keeping post-edit feedback
  internal/hook-facing.
- Provider contracts may expose too much backend-specific detail if presenter
  tests are weak. Current presenters sanitize diagnostics and post-edit
  feedback envelopes; future providers should add fixture-backed presenter
  tests.
