---
title: CMake C++ routing and validation verification
doc_type: spec
artifact_type: verification
status: archived
owner: platform
last_reviewed: 2026-06-06
---

# Verification

Spec 009 closed on 2026-06-06. Accepted behavior was promoted to
[MCP surface design](../../design/mcp-surface-design.md),
[Language adapter design](../../design/language-adapter-design.md),
[Language capability matrix](../../reference/language-capability-matrix.md), and
[Documentation map](../../reference/documentation-map.md).

## Quality Gates

- `pnpm typecheck`
- Focused C/C++ extraction, context, impact/query, and verification-plan tests
- `pnpm test` before closure if graph extraction or planning changes shared
  behavior
- `git diff --check`

## Evidence Log

| Date | Check | Result |
| --- | --- | --- |
| 2026-06-05 | Spec created from durable CMake/C++ backlog | Implementation completed and spec archived on 2026-06-06. |
| 2026-06-06 | T001 fixture and focused graph/context/planning validation | Added CMake/C++ fixture coverage with first-party source/test/build evidence, same-file/local-call candidates, and skipped third-party/vendor noise. `pnpm exec vitest run tests/graph/cmake-cpp-routing-fixture.test.ts tests/graph/extraction-pipeline.test.ts tests/mcp/repo-scope-overview-resource.test.ts tests/mcp/context-for-task-tool.test.ts tests/mcp/verification-plan-tool.test.ts` passed. |
| 2026-06-06 | T002-T004 focused runtime validation | `pnpm exec vitest run tests/mcp/context-for-task-tool.test.ts tests/graph/extraction-pipeline.test.ts tests/mcp/verification-plan-tool.test.ts tests/graph/query-tools.test.ts` passed with 73 tests. |
| 2026-06-06 | TypeScript validation | `pnpm typecheck` passed. |
| 2026-06-06 | Full suite closure gate | `pnpm test` passed with 47 test files and 309 tests. |
| 2026-06-06 | Spec lint and diff hygiene | `spec_runtime.py lint docs/specs/009-cmake-cpp-routing-validation` passed with no diagnostics; `git diff --check` passed. |
| 2026-06-06 | Durable promotion and archival | Promoted accepted behavior to durable MCP/language/reference docs, updated the documentation map, and archived the spec package in place as historical delivery evidence. |

## Residual Risks

- Heuristic C++ routing can help agents but must remain clearly below
  compiler-backed semantic confidence.
- CMake command templates vary by repository; repo-local policy must remain the
  authority for safe validation.
- Cross-language C++/Python-stub or binding-aware symbols remain deferred until
  adapter integration contracts define provenance, identity, confidence, and
  fixture-backed promotion gates.
