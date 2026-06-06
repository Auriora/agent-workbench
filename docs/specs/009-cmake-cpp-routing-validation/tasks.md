---
title: CMake C++ routing and validation tasks
doc_type: spec
artifact_type: tasks
status: archived
owner: platform
last_reviewed: 2026-06-06
---

# Tasks

Spec 009 closed on 2026-06-06. All tasks are complete and accepted behavior
was promoted to durable design/reference docs.

## Task Dependency Graph

```text
T001 -> T002 -> T003
T001 -> T004
T003 -> T005
T004 -> T005
T005 -> T006
```

- [x] T001 Add CMake/C++ routing fixtures.
  - Files: `tests/fixtures/fixture-cmake-cpp-repo/`, `tests/graph/`,
    `tests/mcp/`
  - Acceptance: Fixtures include first-party source, tests, CMake targets,
    third-party/vendor noise, includes, and same-file call candidates.
  - Evidence: Completed on 2026-06-06. Extended
    `tests/fixtures/fixture-cmake-cpp-repo/` with
    `src/App/ExecutionController.cpp` same-file/local call candidates plus
    skipped `third_party/` and `vendor/` noise. Added
    `tests/graph/cmake-cpp-routing-fixture.test.ts` and updated focused graph,
    scope, context, and validation-planning tests. Validation:
    `pnpm exec vitest run tests/graph/cmake-cpp-routing-fixture.test.ts tests/graph/extraction-pipeline.test.ts tests/mcp/repo-scope-overview-resource.test.ts tests/mcp/context-for-task-tool.test.ts tests/mcp/verification-plan-tool.test.ts`
    and `pnpm typecheck` passed.

- [x] T002 Improve broad C++ context ranking.
  - Depends on: T001
  - Files: `src/application/use-cases/get-task-context.ts`,
    `tests/mcp/context-for-task-tool.test.ts`
  - Acceptance: Broad C++ prompts rank first-party source/test evidence ahead
    of third-party noise with compact reasons.
  - Evidence: Completed on 2026-06-06. Added C/C++ structure scoring and
    compact source/test/CMake reasons in
    `src/application/use-cases/get-task-context.ts`. Added fixture-backed
    broad CMake/C++ context coverage that ranks first-party source, test, and
    build metadata ahead of skipped `third_party/` and `vendor/` noise.
    Validation:
    `pnpm exec vitest run tests/mcp/context-for-task-tool.test.ts tests/graph/extraction-pipeline.test.ts tests/mcp/verification-plan-tool.test.ts tests/graph/query-tools.test.ts`
    and `pnpm typecheck` passed.

- [x] T003 Add heuristic C/C++ routing edges.
  - Depends on: T001
  - Files: `src/infrastructure/tree-sitter/cpp-extractor.ts`,
    `tests/graph/`
  - Acceptance: Include and same-file call/reference edges are emitted with
    heuristic provenance, low confidence, and no semantic promotion.
  - Evidence: Completed on 2026-06-06. Added C/C++ include and local-call
    unresolved references with `cpp-include-heuristic` and
    `cpp-local-call-heuristic` provenance, resource-backed heuristic metadata,
    and low confidence. Updated graph reference resolution to preserve
    extractor-provided provenance/confidence where present. Added fixture
    assertions for resolved low-confidence same-file call edges and ambiguous
    include references that remain unresolved instead of semantic. Validation:
    focused Spec 009 Vitest suite and `pnpm typecheck` passed.

- [x] T004 Improve CMake validation planning.
  - Depends on: T001
  - Files: `src/application/use-cases/plan-verification.ts`,
    `tests/mcp/verification-plan-tool.test.ts`
  - Acceptance: Planned CMake configure/build/test templates are returned when
    target evidence supports them and host policy allows them.
  - Evidence: Completed on 2026-06-06. Added bounded CMake target discovery
    from catalog-visible `CMakeLists.txt` files and planned non-executed
    templates for `cmake -S . -B build`, `cmake --build build --target <target>`,
    and `ctest --test-dir build` when host policy permits. Existing host-policy
    blocking remains ahead of generic CMake commands. Updated validation-plan
    tests to assert concrete templates and continued de-prioritization of
    incidental package scripts for C++ files. Validation: focused Spec 009
    Vitest suite and `pnpm typecheck` passed.

- [x] T005 Promote accepted behavior to durable docs.
  - Depends on: T003, T004
  - Files: `docs/design/mcp-surface-design.md`,
    `docs/design/language-adapter-design.md`,
    `docs/reference/language-capability-matrix.md`
  - Acceptance: Durable docs describe CMake/C++ routing, validation behavior,
    and semantic limits.
  - Evidence: Completed on 2026-06-06. Promoted current CMake/C++ behavior to
    `docs/design/language-adapter-design.md`, `docs/design/mcp-surface-design.md`,
    `docs/reference/language-capability-matrix.md`, and
    `docs/reference/documentation-map.md`. Durable docs now describe
    first-party C/C++ context ranking, low-confidence include/local-call
    heuristic edges, CMake target membership evidence, non-executed CMake
    configure/build/test templates, repo-local validation policy precedence,
    and deferred compiler-backed semantic promotion.

- [x] T006 Validate and close the spec.
  - Depends on: T005
  - Files: `docs/specs/009-cmake-cpp-routing-validation/verification.md`
  - Acceptance: Verification records focused tests, full-suite decision, and
    promotion evidence.
  - Evidence: Completed on 2026-06-06. Updated verification evidence, archived
    the Spec 009 package in place, and updated the documentation map so the
    package is retained as historical delivery evidence. Validation:
    `pnpm exec vitest run tests/mcp/context-for-task-tool.test.ts tests/graph/extraction-pipeline.test.ts tests/mcp/verification-plan-tool.test.ts tests/graph/query-tools.test.ts`
    passed; `pnpm typecheck` passed; `pnpm test` passed with 47 files and 309
    tests; Spec 009 lint passed; `git diff --check` passed.
