---
title: MCP error envelope consistency verification
doc_type: spec
artifact_type: verification
status: active
owner: platform
last_reviewed: 2026-07-04
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Verification

## Scope

This record covers the Spec 030 representative-tool implementation slice:
shared MCP handler wrapping and failure classification for `context_for_task`,
`preview_workspace_edit`, `apply_workspace_edit`, `docs_search`,
`symbol_search`, and `verification_plan`.

## Quality Gates

| Gate | Required? | Status | Evidence |
| --- | --- | --- | --- |
| Requirements acceptance criteria reviewed | yes | passed | Requirements R1-R3 mapped below. |
| Task evidence complete | yes | passed | T001-T006 are checked in `tasks.md`. |
| Automated tests pass or alternate verification recorded | yes | passed | Focused and broader MCP test commands passed. |
| Durable documentation updates identified | yes | passed | Runtime contracts and MCP surface design are durable owners. |
| Durable documentation promoted or explicitly deferred | yes | passed | Failure classes and wrapper expectations promoted. |
| Spec cleanup decision recorded | yes | passed | Cleanup action is to keep active until a cleanup/removal request. |
| Governance or policy conflicts resolved | yes | passed | Wrapper preserves layered boundary: MCP adapter calls use cases and presenters. |

## Validation Commands

| Command | Purpose | Result | Evidence |
| --- | --- | --- | --- |
| `pnpm exec vitest run tests/mcp/error-envelope-consistency.test.ts` | Prove representative registry failure classes. | passed | 1 file, 6 tests passed. |
| `pnpm exec vitest run tests/mcp/error-envelope-consistency.test.ts tests/mcp/workspace-edit-tools.test.ts tests/mcp/query-tools.test.ts tests/mcp/context-for-task-tool.test.ts tests/mcp/docs-surfaces.test.ts tests/mcp/verification-plan-tool.test.ts` | Prove migrated handlers and adjacent MCP behavior. | passed | 6 files, 99 tests passed. |
| `pnpm typecheck` | Prove TypeScript contracts and imports. | passed | `tsc --noEmit` passed. |
| `pnpm test` | Prove full Vitest suite. | passed | 68 files, 494 tests passed. |
| `pnpm run validate:plugin` | Prove packaged plugin and MCP manifest shape. | passed | Agent Workbench plugin/package validation passed. |
| `spec_runtime.py lint docs/specs/030-mcp-error-envelope-consistency` | Prove spec package lint health. | passed | 0 diagnostics. |
| `spec_runtime.py scan .` | Prove active spec inventory health. | passed | 4 active specs, 4 pass, 0 warnings, 0 errors. |
| `spec_runtime.py closure-check docs/specs/030-mcp-error-envelope-consistency` | Prove closure readiness after promotion. | passed | Ready true, 0 blockers, 0 lint diagnostics. |

## Requirement Coverage

| Requirement | Acceptance criteria covered | Evidence | Residual risk |
| --- | --- | --- | --- |
| R1 Shared Handler Wrapper | AC1-AC5 | `registerMcpToolWithEnvelope` wraps parse, provider, invoke, present, and classified exceptions for six representative tools. | Non-representative registries keep current handlers until selected for a later wrapper expansion. |
| R2 Failure Classes Stay Distinct | AC1-AC4 | Tests cover stale apply preview, workspace safety refusal, missing provider, malformed args, graph environment failure, and internal verification failure. | Additional domain-specific classifications may be added when more registries migrate. |
| R3 Tests Cover Registry Consistency | AC1-AC3 | `tests/mcp/error-envelope-consistency.test.ts` asserts JSON envelopes and metadata for read-only, planning, and workspace-write tools. | Transport-level throw cases remain outside this slice. |

## Correctness Property Coverage

| Property | Covered by | Evidence | Residual risk |
| --- | --- | --- | --- |
| P1 Envelope completeness | Registry consistency tests | Every tested recoverable failure parses as a response envelope with `errors`. | Full registry sweep remains future maintenance. |
| P2 Recovery classification | Registry consistency tests | Failure codes distinguish invalid input, provider unavailable, workspace safety blocked, stale state, environment unavailable, and internal error. | Domain-specific classification can be refined as more handlers migrate. |
| P3 No fallback masking | Code review and tests | Wrapper catches and classifies; it does not retry, alternate, or return partial success. | None for representative tools. |

## Task Evidence

| Task ID | Status | Evidence | Notes |
| --- | --- | --- | --- |
| T001 | complete | Inventory recorded in `tasks.md`. | Representative handler failure paths identified. |
| T002 | complete | `src/interface-adapters/mcp/envelope.ts`. | Shared wrapper and classification model added. |
| T003 | complete | Six representative tool registries migrated. | Success presenters preserved. |
| T004 | complete | `tests/mcp/error-envelope-consistency.test.ts`. | Registry consistency coverage added. |
| T005 | complete | Runtime contracts and MCP surface design updated. | Durable behavior promoted. |
| T006 | complete | Typecheck and targeted MCP tests passed. | Non-representative registry expansion is outside this slice. |

## Evidence Log

| Date | Evidence | Result | Notes |
| --- | --- | --- | --- |
| 2026-07-04 | Focused Vitest: `tests/mcp/error-envelope-consistency.test.ts` | passed | 6 tests passed. |
| 2026-07-04 | Broader MCP Vitest slice | passed | 99 tests passed across 6 files. |
| 2026-07-04 | `pnpm typecheck` | passed | `tsc --noEmit` passed. |
| 2026-07-04 | `pnpm test` | passed | 494 tests passed across 68 files. |
| 2026-07-04 | `pnpm run validate:plugin` | passed | Plugin/package validation passed. |
| 2026-07-04 | `spec_runtime.py lint docs/specs/030-mcp-error-envelope-consistency` | passed | 0 diagnostics. |
| 2026-07-04 | `spec_runtime.py scan .` | passed | Active spec inventory passed. |
| 2026-07-04 | `spec_runtime.py closure-check docs/specs/030-mcp-error-envelope-consistency` | passed | Ready true. |

## Manual Or External Verification

No external verification was required. Manual review checked that migrated tools
preserve existing success presenters and public MCP tool names.

## Residual Risks

- Non-representative tools and resources still use their existing handlers.
  This is accepted for the representative first slice and should be handled by
  a later wrapper expansion task after this helper shape remains stable.
- Failure classification is intentionally conservative. More precise
  domain-specific classes can be added as additional handlers migrate.

## Durable Promotion And Cleanup

| Spec content | Durable destination or deferral | Status | Evidence |
| --- | --- | --- | --- |
| Requirements and accepted behavior | `docs/reference/runtime-contracts.md` | promoted | Failure classes and recovery metadata documented. |
| Technical design or architecture | `docs/design/mcp-surface-design.md` | promoted | Shared handler wrapper expectation documented. |
| Contracts, schemas, data flow, or integration behavior | `docs/reference/runtime-contracts.md` | promoted | `errors[0].code` vocabulary documented. |
| Operational steps, rollout, validation, or recovery | This verification record | active | Commands recorded above. |
| Decisions and rationale | `design.md` open-question resolutions | active | Public error codes are strings, not new enums. |
| Follow-up work | Maintenance/backlog after closure | deferred | Wrapper expansion for non-representative registries remains outside this slice. |

### Spec Cleanup Decision

- **Cleanup action:** keep active
- **Reason:** Implementation, validation, and durable promotion are complete;
  removal is deferred until cleanup is requested.
- **Final spec commit:** pending
- **Closure log path:** pending
- **Closure log entry updated:** no
- **Closure cleanup commit:** pending
- **Active indexes updated:** no
- **Durable docs linked back to evidence where useful:** yes
- **Residual spec-only content:** listed below

Residual spec-only content:

- Verification command evidence and closure decision stay in this spec until
  cleanup.

## Ship Or Closure Risk

- **Risk level:** low
- **Breaking change:** no
- **Blast radius checked:** yes
- **Rollback path:** revert the wrapper migration commit
- **Requires human review:** no
- **Release notes needed:** no
- **Follow-up issue or spec needed:** no

### Risk Rationale

The change is low risk because success presenters and public tool names remain
unchanged, and the migrated behavior affects recoverable failure envelopes for
representative tools. Focused and broader MCP tests cover the modified paths.

## Readiness Decision

- **Ready for promotion:** yes
- **Ready for release:** yes
- **Ready for closure:** yes

## Related Artifacts

- Requirements: `docs/specs/030-mcp-error-envelope-consistency/requirements.md`
- Design: `docs/specs/030-mcp-error-envelope-consistency/design.md`
- Tasks: `docs/specs/030-mcp-error-envelope-consistency/tasks.md`
- Traceability: `docs/specs/030-mcp-error-envelope-consistency/traceability.md`
