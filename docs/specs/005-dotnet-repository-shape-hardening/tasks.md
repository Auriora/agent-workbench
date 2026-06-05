---
title: .NET repository shape hardening tasks
doc_type: spec
artifact_type: tasks
status: archived
owner: platform
last_reviewed: 2026-06-05
---

# Tasks

## Task Dependency Graph

```text
T001 -> T002 -> T003
T001 -> T004
T002 -> T005
T003 -> T005
T004 -> T005
T005 -> T006
```

- [x] T001 Add .NET hardening fixtures.
  - Files: `tests/fixtures/fixture-dotnet-web-repo/`, `tests/workspace/`,
    `tests/graph/`, `tests/mcp/`
  - Acceptance: Fixtures include generated outputs, publish artifacts,
    solution/project files, app projects, and test projects.
  - Evidence: Expanded `tests/fixtures/fixture-dotnet-web-repo/` with publish,
    compressed asset, source-map, NuGet package, project-reference, package
    reference, output-type, and test-project metadata fixtures.

- [x] T002 Deepen generated-output skipping.
  - Depends on: T001
  - Files: `src/domain/policies/`, `src/infrastructure/filesystem/`,
    `tests/workspace/file-catalog-scanner.test.ts`
  - Acceptance: .NET generated outputs are skipped or downranked with modeled
    skipped evidence.
  - Evidence: `pnpm exec vitest run tests/workspace/file-catalog-scanner.test.ts
    tests/graph/extraction-pipeline.test.ts
    tests/mcp/repo-scope-overview-resource.test.ts
    tests/mcp/verification-plan-tool.test.ts` passed.

- [x] T003 Extract resource-backed .NET project metadata.
  - Depends on: T001
  - Files: `src/infrastructure/tree-sitter/` or resource extractor area,
    `src/infrastructure/sqlite/graph-store.ts`, `tests/graph/`
  - Acceptance: `.sln`/project metadata appears as resource-backed graph
    evidence with confidence/provenance.
  - Evidence: `ResourceExtractorAdapter` now emits `dotnet_solution_project`
    and `dotnet_project` nodes; graph extraction coverage validates SDK, target
    frameworks, output type, package references, project references, and
    test-project markers.

- [x] T004 Improve .NET validation planning.
  - Depends on: T001
  - Files: `src/application/use-cases/plan-verification.ts`,
    `tests/mcp/verification-plan-tool.test.ts`
  - Acceptance: Nearest project and relevant test projects rank before broad
    solution commands; host-blocking policy is respected.
  - Evidence: Verification-plan coverage proves nearest project builds rank
    before solution builds, unrelated test projects are omitted, and repo-local
    host-blocking policy suppresses generic `dotnet` commands.

- [x] T005 Promote accepted behavior to durable docs.
  - Depends on: T002, T003, T004
  - Files: `docs/design/mcp-surface-design.md`,
    `docs/design/language-adapter-design.md`,
    `docs/reference/language-capability-matrix.md`
  - Acceptance: Durable docs describe .NET resource-backed behavior and
    remaining semantic gaps.
  - Evidence: Updated `docs/design/mcp-surface-design.md`,
    `docs/design/language-adapter-design.md`, and
    `docs/reference/language-capability-matrix.md` with current .NET
    resource-backed behavior and remaining semantic gaps.

- [x] T006 Validate and close the spec.
  - Depends on: T005
  - Files: `docs/specs/005-dotnet-repository-shape-hardening/verification.md`
  - Acceptance: Verification records focused tests, full-suite decision, and
    promotion evidence.
  - Evidence: Verification recorded focused tests, full `pnpm test`,
    `pnpm typecheck`, `git diff --check`, and active-spec lint; spec archived
    on 2026-06-05.
