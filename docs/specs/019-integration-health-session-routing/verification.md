---
title: Integration health and session routing verification
doc_type: spec
artifact_type: verification
status: active
owner: platform
last_reviewed: 2026-06-06
---

# Verification

## Quality Gates

- `pnpm typecheck`
- Focused MCP registry, profile, presenter, and next-action tests
- `pnpm test` before closure
- `git diff --check`
- Spec lifecycle scan

## Validation Plan

- Test full, partial, missing, and unknown session capability evidence.
- Test presenter output with available and unavailable next actions.
- Test Codex integration profile alignment with registered MCP tools.
- Test contextual routing decision docs against accepted behavior.

## Evidence Log

| Date | Activity | Result |
| --- | --- | --- |
| 2026-06-06 | Spec created from EB001, EB002, and EB011 | Pending implementation |
| 2026-06-06 | T001 contextual routing decision | Chose conservative hybrid: keep explicit startup registration, add stable integration-health state, use shared session-aware next-action filtering, and defer generic dynamic invocation. |
| 2026-06-06 | T002 integration health contracts and fixtures | Added schema-owned integration health/session/surface contracts and fixture tests for full, partial, unknown, unavailable, and profile/registry alignment. `pnpm exec vitest run tests/contracts/runtime-contracts.test.ts tests/mcp/integration-health-contract.test.ts tests/mcp/registry-metadata.test.ts tests/integration/codex-integration-profile.test.ts` passed; `pnpm typecheck` passed. |
| 2026-06-06 | T003 integration health provider and MCP surface | Added read-only `integration:///health/agent-workbench` resource, provider, presenter, composed-server wiring, Codex/common profile binding updates, and MCP resource tests. `pnpm exec vitest run tests/contracts/runtime-contracts.test.ts tests/mcp/integration-health-contract.test.ts tests/mcp/integration-health-resource.test.ts tests/mcp/registry-metadata.test.ts tests/integration/codex-integration-profile.test.ts tests/integration/common-integration-profile.test.ts` passed; `pnpm typecheck` passed. |
| 2026-06-06 | T004 session-aware next-action helper | Added shared `sessionAwareNextActions` helper for callable actions, unavailable labels, and unknown-discovery assumptions while keeping existing public-tool capping behavior. `pnpm exec vitest run tests/contracts/presentation-metadata.test.ts tests/contracts/runtime-contracts.test.ts tests/mcp/integration-health-contract.test.ts tests/mcp/integration-health-resource.test.ts` passed; `pnpm typecheck` passed. |
| 2026-06-06 | T005 public presenter integration | Applied session-aware next-action filtering to public MCP presenters and added presenter-level golden tests for known and unknown discovery evidence. `pnpm exec vitest run tests/presentation/session-aware-presenters.test.ts tests/contracts/presentation-metadata.test.ts tests/docs/docs-presenter.test.ts tests/edits/workspace-edit-presenter.test.ts tests/mcp/query-tools.test.ts tests/mcp/docs-surfaces.test.ts tests/mcp/context-for-task-tool.test.ts tests/mcp/verification-plan-tool.test.ts` passed; `pnpm typecheck` passed. |
| 2026-06-06 | T006 closure validation | Promoted durable docs and backlog state. `pnpm test` passed with 57 files and 360 tests; `git diff --check` passed. |

## Residual Risks

- Client-discovered tool evidence may not be available in all Codex sessions.
- A generic router could become an unbounded fallback if not constrained.
