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

- [ ] T001 Add JS/TS fixtures and dogfood query cases.
  - Files: `tests/fixtures/`, `tests/language/`, `docs/specs/014-typescript-javascript-partial-semantic-routing/verification.md`
  - Acceptance: Fixtures cover workspaces, package roots, `tsconfig`, JS, TS,
    JSX/TSX, imports, exports, route/controller/component/service files,
    generated/dependency skips, and nearest tests.
  - Evidence: Pending.

- [ ] T002 Decide and add the approved JS/TS parser path.
  - Depends on: T001
  - Files: `package.json`, `src/infrastructure/language/`, `tests/language/`
  - Acceptance: One parser-backed extraction path is wired without compiler,
    LSP, or scanner fallbacks.
  - Evidence: Pending.

- [ ] T003 Implement JS/TS project-shape extraction.
  - Depends on: T001
  - Files: `src/workspace/`, `src/infrastructure/`, `tests/workspace/`
  - Acceptance: Scope, overview, and context evidence identify JS/TS-heavy and
    mixed-language repositories from package, workspace, source, test, and
    config evidence.
  - Evidence: Pending.

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
