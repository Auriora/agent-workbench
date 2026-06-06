---
title: Diagnostics and post-edit feedback verification
doc_type: spec
artifact_type: verification
status: active
owner: platform
last_reviewed: 2026-06-05
---

# Verification

## Quality Gates

- `pnpm typecheck`
- Focused diagnostics, MCP, presenter, and hook tests introduced by this spec
- `pnpm test` before closure if shared presentation or hook behavior changes
- `python3 /home/bcherrington/.codex/skills/spec-lifecycle-manager/scripts/spec_runtime.py lint docs/specs/011-diagnostics-post-edit-feedback`
- `git diff --check`

## Evidence Log

| Date | Activity | Result |
| --- | --- | --- |
| 2026-06-05 | Spec created from Spec 010 T005 follow-up planning | Pending implementation |
| 2026-06-05 | T001-T003 diagnostics contracts, fixtures, use case, and presenter | `pnpm exec vitest run tests/diagnostics/diagnose-changed-files.test.ts` passed with 6 tests; `pnpm exec vitest run tests/contracts/runtime-contracts.test.ts tests/diagnostics/diagnose-changed-files.test.ts` passed with 17 tests; `pnpm typecheck`, `pnpm test`, `spec_runtime.py lint docs/specs/011-diagnostics-post-edit-feedback`, `pnpm exec vitest run tests/docs/docs-links-metadata.test.ts`, and `git diff --check` passed |
| 2026-06-05 | T004 public MCP diagnostics surface | `diagnostics_for_files` wired through MCP registry, stdio composition, profile metadata, and malformed-input handling. `pnpm exec vitest run tests/mcp/diagnostics-for-files-tool.test.ts tests/mcp/registry-metadata.test.ts tests/mcp/malformed-input.test.ts tests/mcp/query-tools.test.ts tests/mcp/verification-plan-tool.test.ts tests/mcp/workspace-edit-tools.test.ts tests/integration/common-integration-profile.test.ts tests/integration/usage-informed-mvp.test.ts` passed with 70 tests; `pnpm exec vitest run tests/mcp/stdio-entrypoint.test.ts` passed with 7 tests; `pnpm typecheck` passed |

## Residual Risks

- Adding both diagnostics and post-edit feedback as public tools could expand
  the MCP surface too far. The implementation must prefer one compact workflow
  unless both tools prove distinct value.
- Provider contracts may expose too much backend-specific detail if presenter
  tests are weak.
