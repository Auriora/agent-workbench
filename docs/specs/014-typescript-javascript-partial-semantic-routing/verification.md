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

## Residual Risks

- Framework-specific route and component semantics can be over-inferred; keep
  them routing-only until fixtures justify promotion.
- Package-manager conventions differ across repos; validation planning must
  honor repo policy before generic command templates.
- JS/TS monorepos can exceed context budgets quickly; ranking and truncation
  tests are required before closure.
