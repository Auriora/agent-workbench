---
title: CMake C++ routing and validation tasks
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
T003 -> T005
T004 -> T005
T005 -> T006
```

- [ ] T001 Add CMake/C++ routing fixtures.
  - Files: `tests/fixtures/fixture-cmake-cpp-repo/`, `tests/graph/`,
    `tests/mcp/`
  - Acceptance: Fixtures include first-party source, tests, CMake targets,
    third-party/vendor noise, includes, and same-file call candidates.
  - Evidence: Pending.

- [ ] T002 Improve broad C++ context ranking.
  - Depends on: T001
  - Files: `src/application/use-cases/get-task-context.ts`,
    `tests/mcp/context-for-task-tool.test.ts`
  - Acceptance: Broad C++ prompts rank first-party source/test evidence ahead
    of third-party noise with compact reasons.
  - Evidence: Pending.

- [ ] T003 Add heuristic C/C++ routing edges.
  - Depends on: T001
  - Files: `src/infrastructure/tree-sitter/cpp-extractor.ts`,
    `tests/graph/`
  - Acceptance: Include and same-file call/reference edges are emitted with
    heuristic provenance, low confidence, and no semantic promotion.
  - Evidence: Pending.

- [ ] T004 Improve CMake validation planning.
  - Depends on: T001
  - Files: `src/application/use-cases/plan-verification.ts`,
    `tests/mcp/verification-plan-tool.test.ts`
  - Acceptance: Planned CMake configure/build/test templates are returned when
    target evidence supports them and host policy allows them.
  - Evidence: Pending.

- [ ] T005 Promote accepted behavior to durable docs.
  - Depends on: T003, T004
  - Files: `docs/design/mcp-surface-design.md`,
    `docs/design/language-adapter-design.md`,
    `docs/reference/language-capability-matrix.md`
  - Acceptance: Durable docs describe CMake/C++ routing, validation behavior,
    and semantic limits.
  - Evidence: Pending.

- [ ] T006 Validate and close the spec.
  - Depends on: T005
  - Files: `docs/specs/009-cmake-cpp-routing-validation/verification.md`
  - Acceptance: Verification records focused tests, full-suite decision, and
    promotion evidence.
  - Evidence: Pending.
