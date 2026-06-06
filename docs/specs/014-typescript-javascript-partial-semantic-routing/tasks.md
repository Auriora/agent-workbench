---
title: TypeScript JavaScript partial semantic routing tasks
doc_type: spec
artifact_type: tasks
status: active
owner: platform
last_reviewed: 2026-06-06
---

# Tasks

## Task Dependency Graph

```text
T001 -> T002 -> T003 -> T004 -> T005 -> T006 -> T007
```

- [x] T001 Add JS/TS fixtures and dogfood query cases.
  - Files: `tests/fixtures/`, `tests/language/`, `docs/specs/014-typescript-javascript-partial-semantic-routing/verification.md`
  - Acceptance: Fixtures cover workspaces, package roots, `tsconfig`, JS, TS,
    JSX/TSX, imports, exports, route/controller/component/service files,
    generated/dependency skips, and nearest tests.
  - Evidence: Completed on 2026-06-06. Expanded
    `tests/fixtures/fixture-js-ts-monorepo/` with workspace package roots,
    package-local `tsconfig` files, TS/TSX source, imports, exports, a route
    file, component files, package-local tests, an e2e spec, generated source,
    and a skipped `node_modules` dependency path. Added
    `tests/workspace/js-ts-project-shape.test.ts` coverage for fixture shape,
    dependency skips, generated-file identification, and nearest tests.

- [x] T002 Decide and add the approved JS/TS parser path.
  - Depends on: T001
  - Files: `package.json`, `src/infrastructure/language/`, `tests/language/`
  - Acceptance: One parser-backed extraction path is wired without compiler,
    LSP, or scanner fallbacks.
  - Evidence: Completed on 2026-06-06. Added `tree-sitter-javascript` and
    `tree-sitter-typescript` dependencies, included both in
    `pnpm rebuild:native`, and added
    `src/infrastructure/tree-sitter/javascript-parser.ts` plus
    `tests/language/js-ts-parser-path.test.ts` to record the approved grammar
    mapping. This does not implement declaration/import extraction; T004 owns
    the parser-backed extractor. Validation: `pnpm rebuild:native`,
    `pnpm exec vitest run tests/language/js-ts-parser-path.test.ts
    tests/workspace/js-ts-project-shape.test.ts`, and `pnpm typecheck` passed.

- [x] T003 Implement JS/TS project-shape extraction.
  - Depends on: T001
  - Files: `src/workspace/`, `src/infrastructure/`, `tests/workspace/`
  - Acceptance: Scope, overview, and context evidence identify JS/TS-heavy and
    mixed-language repositories from package, workspace, source, test, and
    config evidence.
  - Evidence: Completed on 2026-06-06. Added shared JS/TS project-shape
    detection in `src/application/use-cases/js-ts-project-shape.ts`, promoted
    JS/TS files to resource-backed routing evidence, surfaced Node/TypeScript
    platform and validation-planning hints from package/workspace/tsconfig
    evidence, and made `context_for_task` route seeded JS/TS files to
    package-local config and tests. Validation:
    `pnpm exec vitest run tests/workspace/js-ts-project-shape.test.ts` passed;
    `pnpm exec vitest run tests/mcp/repo-scope-overview-resource.test.ts
    tests/mcp/context-for-task-tool.test.ts tests/graph/extraction-pipeline.test.ts
    tests/workspace/file-catalog-scanner.test.ts` passed.

- [ ] T004 Implement declaration, import, and export extraction.
  - Depends on: T002
  - Files: `src/infrastructure/language/`, `tests/language/`, `tests/graph/`
  - Acceptance: Graph extraction persists declarations and unresolved
    references with confidence and provenance.
  - Evidence: Pending.

- [ ] T005 Wire JS/TS evidence into query and context surfaces.
  - Depends on: T003, T004
  - Files: `src/application/`, `src/presentation/`, `tests/mcp/`, `tests/graph/`
  - Acceptance: `symbol_search`, `find_references`, `impact`, and
    `context_for_task` return compact JS/TS results with correct caveats.
  - Evidence: Pending.

- [ ] T006 Improve JS/TS validation planning.
  - Depends on: T003
  - Files: `src/application/use-cases/`, `tests/validation/`, `tests/mcp/`
  - Acceptance: Plans repo-policy and package-local checks without executing
    package managers or ignoring host-blocking evidence.
  - Evidence: Pending.

- [ ] T007 Promote docs, validate, and close.
  - Depends on: T005, T006
  - Files: `docs/design/language-adapter-design.md`,
    `docs/reference/language-capability-matrix.md`,
    `docs/design/mcp-surface-design.md`,
    `docs/reference/documentation-map.md`,
    `docs/specs/014-typescript-javascript-partial-semantic-routing/`
  - Acceptance: Durable docs describe accepted behavior and remaining JS/TS
    semantic gaps; full relevant validation passes before archival.
  - Evidence: Pending.
