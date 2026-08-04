---
title: MCP tool-sweep production extractor parity verification
doc_type: spec
artifact_type: verification
status: active
owner: platform
last_reviewed: 2026-08-04
---

# Verification

## Scope

Requirements 1-4, tasks T001-T005, canonical registry composition, sweep
ecosystem selection, fixture-backed graph probes, durable promotion, and
read-only real-repository dogfood.

## Requirement Evidence

| Requirement | Required evidence |
| --- | --- |
| Requirement 1 | Exact canonical language set, both consumers using its factory, and no duplicate production registrations. |
| Requirement 2 | Go and C/C++ fixtures selecting indexed declarations for symbol, reference, impact, and context probes. |
| Requirement 3 | Go parser/partial-semantic and C/C++ heuristic/resource-backed assertions plus fail-closed sweep-quality behavior. |
| Requirement 4 | Drift regression, focused/full validation, architecture checks, and unchanged dogfood target worktrees. |

## Quality Gates

| Gate | Required | Status | Evidence |
| --- | --- | --- | --- |
| Package readiness and traceability | yes | pass | creation-plan revalidation, zero-error package lint, and ready T001 packet |
| Registry and debug-harness focused tests | yes | pass | 63 tests across debug harness and graph/MCP query suites |
| Architecture boundaries | yes | pass | 9 tests across both focused architecture suites |
| Typecheck | yes | pass | `pnpm typecheck` |
| Full regression | yes | pass | 111 files and 1,249 tests with four workers |
| Real-repository dogfood | yes | pass | read-only Go and C++ sweeps; 45 full, 5 partial, 4 intentional degraded, no blocked/invalid; target status unchanged |
| Durable documentation | yes | pass | 10 focused Markdown/link tests and `git diff --check` |
| Independent correctness review | yes | pass | no implementation blocker; provider-smoke advisory isolated and passed 37/37 |

## Planned Commands

```text
pnpm exec vitest run tests/mcp/debug-harness.test.ts
pnpm exec vitest run tests/architecture/layer-boundaries.test.ts tests/architecture/stdio-bridge-import-boundary.test.ts
pnpm typecheck
pnpm exec vitest run --maxWorkers=4
pnpm exec vitest run tests/docs/docs-links-metadata.test.ts tests/docs/markdown-quality.test.ts
git diff --check
```

Target-repository commands are deliberately absent. Dogfood uses only the
checkout sweep against read-only source inputs.

## Residual Risks

- Regex candidate discovery is bounded routing support, not semantic parsing;
  the indexed graph remains authoritative before a symbol is selected.
- C/C++ remains heuristic and resource-backed even when the sweep can now prove
  that production extraction ran.
- Real repositories cannot cover every supported declaration form; fixtures
  remain the acceptance authority.

## Evidence Log

| Date | Evidence | Result | Notes |
|---|---|---|---|
| 2026-08-04 | `spec_creation_plan` fingerprint revalidation and `lint_spec_package` | pass | Spec 056 was the next available ID; zero lint errors; the historical duplicate-034 warning was unrelated. |
| 2026-08-04 | focused graph/MCP regressions and typecheck | pass | 63 tests passed; TypeScript typecheck passed. |
| 2026-08-04 | focused architecture boundaries | pass | 9 tests passed. |
| 2026-08-04 | bounded full Vitest suite | pass | 111 files and 1,249 tests passed with four workers. |
| 2026-08-04 | `.tmp/spec056-dogfood/mcp-tool-sweep-2026-08-04T10-59-00-274Z.json` | pass | 45 full, 5 bounded partial, 4 intentional degraded, no blocked/invalid; Go and C++ capability/provenance remained truthful and target Git status was unchanged. |
| 2026-08-04 | independent implementation review | pass | No implementation blocker. Two concurrent provider-smoke failures were absent from the 1,249-test bounded run and the isolated file passed 37/37. |
| 2026-08-04 | documentation and diff gates | pass | 10 focused docs tests passed and `git diff --check` was clean. |

## Canonical Context Advisory

The advisory is explicitly waived. The four cited durable sources were read
directly, agree on the composition, capability, and EB010 ownership boundaries,
and were updated in place where behavior changed. There is no conflicting or
fragmented authority that warrants duplicating their content into a
`canonical-context.md` artifact.

## Durable Promotion And Cleanup

| Content | Destination | Status |
| --- | --- | --- |
| canonical registry parity rule | `docs/design/observability-debugging-design.md` | promoted |
| EB010 delivery boundary | `docs/backlog/README.md` | promoted |
| bounded dogfood evidence | `docs/reference/dogfood-evidence-ledger.md` | promoted |

### Spec Cleanup Decision

- **Cleanup action:** remove after verified closure
- **Reason:** accepted behavior and evidence are promoted to durable docs, code,
  tests, backlog ownership, and the dogfood ledger; no current truth remains
  owned only by this package.
- **Final spec commit:** pending
- **Closure log path:** `docs/history/spec-closure-log.md`
- **Closure log entry updated:** no
- **Closure cleanup commit:** pending
- **Active indexes updated:** no
- **Durable docs linked back to evidence where useful:** yes
- **Residual spec-only content:** none

## Readiness Decision

- Ready to implement: yes; package checks passed before T002.
- Ready to validate: yes; implementation, fixtures, durable promotion, and
  dogfood evidence are present.
- Ready to close: yes, subject to the separately authorized closure workflow.
