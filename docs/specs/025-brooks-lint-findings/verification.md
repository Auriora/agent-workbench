---
title: Brooks-Lint findings tracker verification
doc_type: spec
artifact_type: verification
status: active
owner: platform
last_reviewed: 2026-06-06
---

# Verification

## Validation Plan

This package has two validation levels:

- spec validation for the tracking artifacts
- implementation validation for accepted remediation tasks

Creating the tracker only requires spec lifecycle lint and evidence capture.
Resolving findings requires code, tests, and durable documentation validation.

## Quality Gates

- Spec lifecycle lint passes for the package.
- Each accepted finding has at least one linked task before implementation
  starts.
- Each resolved finding has recorded validation evidence.
- Boundary remediation runs targeted architecture tests.
- Shared contract, presenter, port, or use-case remediation runs
  `pnpm typecheck` and relevant Vitest suites.
- Durable documentation is updated before closing resolved architecture work.

## Evidence Log

| Date | Command | Result | Notes |
| --- | --- | --- | --- |
| 2026-06-06 | `pnpm exec vitest run tests/architecture/layer-boundaries.test.ts` | Passed | 1 test file and 5 tests passed. The pass is evidence that current checks do not catch the multiline application-to-infrastructure imports recorded in `BL-ARCH-001`. |
| 2026-06-06 | Static Brooks-Lint tech debt scan | Completed | Captured `BL-DEBT-001`, `BL-DEBT-002`, and `BL-DEBT-003` in `findings.md`. |
| 2026-06-06 | Static Brooks-Lint health dashboard scan | Completed | Captured composite score `82/100`, dimension scores, test suite map, and `BL-HEALTH-001` in `findings.md`. |
| 2026-06-06 | `pnpm test` | Passed | 57 test files and 360 tests passed in 12.93 seconds. Evidence captured for `$brooks-test`. |
| 2026-06-11 | Architecture findings triage | Completed | `BL-ARCH-001`, `BL-ARCH-002`, and `BL-ARCH-003` accepted with rationale and linked remediation tasks `T003`, `T004`, and `T005`. No runtime code changed in this triage slice. |
| 2026-06-11 | `pnpm exec vitest run tests/architecture/layer-boundaries.test.ts` | Passed | 1 test file and 6 tests passed. The architecture boundary extractor now uses the TypeScript AST and covers multiline static imports/exports. |
| 2026-06-11 | `pnpm exec vitest run tests/docs/query-docs.test.ts tests/docs/fts-docs-search-fixtures.test.ts tests/mcp/docs-surfaces.test.ts tests/graph/query-tools.test.ts` | Passed | 4 test files and 53 tests passed after moving pure Markdown document helpers from infrastructure to application-owned code. |
| 2026-06-11 | `pnpm typecheck` | Passed | TypeScript compile check passed after the helper move and architecture test update. |
| 2026-06-11 | `pnpm test` | Passed | Full Vitest suite passed in the unrestricted runtime: 59 test files and 396 tests. |
| 2026-06-11 | `pnpm exec vitest run tests/architecture/layer-boundaries.test.ts tests/contracts/response-metadata.test.ts` | Passed | 2 test files and 14 tests passed after moving response metadata policy inward and adding the application-to-presentation boundary rule. |
| 2026-06-11 | `pnpm typecheck` | Passed | TypeScript compile check passed after the response metadata move and presenter import updates. |
| 2026-06-11 | `pnpm test` | Passed | Full Vitest suite passed after `T004`: 59 test files and 396 tests. |
| 2026-06-11 | `pnpm exec vitest run tests/architecture/layer-boundaries.test.ts tests/mcp/telemetry-instrumentation.test.ts tests/telemetry/boundary-instrumentation.test.ts tests/telemetry/config.test.ts` | Passed | 4 test files and 20 tests passed after moving MCP telemetry dependency to `TelemetryRecorderPort`. |
| 2026-06-11 | `pnpm typecheck` | Passed | TypeScript compile check passed after the telemetry port ownership change. |
| 2026-06-11 | `pnpm test` | Passed | Full Vitest suite passed after `T005`: 59 test files and 396 tests. |

## Required Gates For Remediation

### Boundary Test Changes

- `pnpm exec vitest run tests/architecture/layer-boundaries.test.ts`
- Evidence that multiline imports are detected by the test helper.
- Evidence that application-to-presentation imports are forbidden.
- Evidence that the selected MCP adapter telemetry rule is encoded.

### Runtime Code Changes

- `pnpm typecheck`
- Targeted Vitest suites for changed use cases, presenters, and MCP adapters.
- Full `pnpm test` when the change touches shared contracts, presenters,
  ports, or architecture tests.

### Tech Debt Remediation

- Validation-planning extraction requires
  `pnpm exec vitest run tests/mcp/verification-plan-tool.test.ts` and focused
  tests for any newly extracted planner modules.
- Resource-extractor extraction requires targeted graph extraction tests that
  cover the moved resource domain.
- Contract splitting requires
  `pnpm exec vitest run tests/contracts/runtime-contracts.test.ts` and export
  compatibility checks through `src/contracts/index.ts`.

### Test Quality Remediation

- MCP harness cleanup requires targeted tests for every updated MCP file.
- Test helper extraction must preserve behavior assertions and avoid hiding
  contract details that each test is meant to verify.
- Integration-to-unit redistribution should be added opportunistically during
  validation planner and resource extractor refactors, not by deleting existing
  integration fixtures.
- Representative validation commands include
  `pnpm exec vitest run tests/mcp/query-tools.test.ts`,
  `pnpm exec vitest run tests/mcp/verification-plan-tool.test.ts`,
  `pnpm exec vitest run tests/mcp/context-for-task-tool.test.ts`, and
  `pnpm typecheck`.

### Documentation Changes

- Durable docs updated when layer ownership changes.
- Spec findings updated from `new` or `accepted` to `resolved` only after
  validation evidence is recorded.
- Documentation links and paths checked manually when docs are edited.

## Residual Risks

- Later Brooks-Lint modes may identify overlapping risks that should merge with
  existing findings instead of creating parallel tasks.
- Some current presentation imports of application result types may remain
  acceptable if the project treats use-case result types as application
  contracts; this should be documented if retained.
- Boundary tests based on import scanning may still miss runtime dependency
  creation unless future tests cover dynamic import or composition-root
  behavior intentionally.
