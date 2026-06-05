---
title: .NET repository shape hardening tasks
doc_type: spec
artifact_type: tasks
status: active
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

- [ ] T001 Add .NET hardening fixtures.
  - Files: `tests/fixtures/fixture-dotnet-web-repo/`, `tests/workspace/`,
    `tests/graph/`, `tests/mcp/`
  - Acceptance: Fixtures include generated outputs, publish artifacts,
    solution/project files, app projects, and test projects.
  - Evidence: Pending.

- [ ] T002 Deepen generated-output skipping.
  - Depends on: T001
  - Files: `src/domain/policies/`, `src/infrastructure/filesystem/`,
    `tests/workspace/file-catalog-scanner.test.ts`
  - Acceptance: .NET generated outputs are skipped or downranked with modeled
    skipped evidence.
  - Evidence: Pending.

- [ ] T003 Extract resource-backed .NET project metadata.
  - Depends on: T001
  - Files: `src/infrastructure/tree-sitter/` or resource extractor area,
    `src/infrastructure/sqlite/graph-store.ts`, `tests/graph/`
  - Acceptance: `.sln`/project metadata appears as resource-backed graph
    evidence with confidence/provenance.
  - Evidence: Pending.

- [ ] T004 Improve .NET validation planning.
  - Depends on: T001
  - Files: `src/application/use-cases/plan-verification.ts`,
    `tests/mcp/verification-plan-tool.test.ts`
  - Acceptance: Nearest project and relevant test projects rank before broad
    solution commands; host-blocking policy is respected.
  - Evidence: Pending.

- [ ] T005 Promote accepted behavior to durable docs.
  - Depends on: T002, T003, T004
  - Files: `docs/design/mcp-surface-design.md`,
    `docs/design/language-adapter-design.md`,
    `docs/reference/language-capability-matrix.md`
  - Acceptance: Durable docs describe .NET resource-backed behavior and
    remaining semantic gaps.
  - Evidence: Pending.

- [ ] T006 Validate and close the spec.
  - Depends on: T005
  - Files: `docs/specs/005-dotnet-repository-shape-hardening/verification.md`
  - Acceptance: Verification records focused tests, full-suite decision, and
    promotion evidence.
  - Evidence: Pending.
