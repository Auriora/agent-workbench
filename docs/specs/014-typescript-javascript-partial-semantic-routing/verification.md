---
title: TypeScript JavaScript partial semantic routing verification
doc_type: spec
artifact_type: verification
status: active
owner: platform
last_reviewed: 2026-06-06
---

# Verification

## Quality Gates

- `pnpm typecheck`
- Focused JS/TS fixture, extraction, graph, MCP, and validation-planning tests
- `pnpm test` before closure
- Read-only dogfood against at least one JS/TS-heavy sample repository
- Spec lifecycle lint or scan
- `git diff --check`

## Evidence Log

| Date | Activity | Result |
| --- | --- | --- |
| 2026-06-06 | Spec created from durable JS/TS language-adapter backlog | Pending implementation |
| 2026-06-06 | T001-T003 fixtures, parser-path decision, and project-shape extraction | Added JS/TS monorepo fixture coverage, parser grammar package mapping, resource-backed JS/TS capability labels, overview/context project-shape routing, and package-local validation hints. `pnpm rebuild:native`, `pnpm typecheck`, `pnpm exec vitest run tests/language/js-ts-parser-path.test.ts tests/workspace/js-ts-project-shape.test.ts`, and focused overview/context/extraction/scanner tests passed. |
| 2026-06-06 | T004 parser-backed declaration, import, and export extraction | Added JS/TS tree-sitter extractor registration, parser-backed partial-semantic capability labels, declaration nodes, and unresolved import/export references with provenance and confidence metadata. `pnpm typecheck`, `pnpm exec vitest run tests/graph/extraction-pipeline.test.ts`, and focused affected MCP/runtime/integration tests passed. |
| 2026-06-06 | T005 JS/TS query and context surfaces | Proved JS/TS parser-backed symbols, resolved import references, bounded impact, and graph-ranked task context through shared query surfaces. Corrected impact caveats for low-confidence parser-backed graph edges. `pnpm exec vitest run tests/graph/query-tools.test.ts` passed. |
| 2026-06-06 | T006 JS/TS validation planning evidence review | Confirmed existing planner coverage for package-local JS/TS scripts, workspace/lockfile/tsconfig evidence, repo-local validation policy commands, host-command blocking, and advisory Docker/devcontainer evidence. `pnpm test` passed after T005, covering the relevant verification-plan cases. |

## Residual Risks

- Framework-specific route and component semantics can be over-inferred; keep
  them routing-only until fixtures justify promotion.
- Package-manager conventions differ across repos; validation planning must
  honor repo policy before generic command templates.
- JS/TS monorepos can exceed context budgets quickly; ranking and truncation
  tests are required before closure.
