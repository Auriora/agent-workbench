---
title: SAM CloudFormation intrinsic routing tasks
doc_type: spec
artifact_type: tasks
status: active
owner: platform
last_reviewed: 2026-06-06
---

# Tasks

## Task Dependency Graph

```text
T001 -> T002 -> T003 -> T004 -> T005 -> T006
```

- [x] T001 Add SAM/CloudFormation intrinsic fixtures.
  - Files: `tests/fixtures/`, `tests/infrastructure/`, `tests/graph/`
  - Acceptance: Fixtures cover JSON/YAML templates, long/short intrinsics,
    nested expressions, `DependsOn`, Lambda events, handler bindings, redaction,
    tests, and validation-policy evidence.
  - Evidence: Completed on 2026-06-06. Added
    `tests/fixtures/fixture-sam-intrinsic-repo/` with YAML and JSON templates,
    long and short intrinsic forms, nested expressions, `DependsOn`, SAM Lambda
    events, handler source files, nearby tests, secret-like dynamic reference
    material for redaction checks, and repo-local validation policy evidence.
    Added `tests/workspace/sam-intrinsic-fixtures.test.ts`. Validation:
    `pnpm exec vitest run tests/workspace/sam-intrinsic-fixtures.test.ts`
    passed.

- [x] T002 Implement intrinsic and dependency extraction.
  - Depends on: T001
  - Files: `src/infrastructure/`, `tests/infrastructure/`, `tests/graph/`
  - Acceptance: Adapter emits resource-backed edges with expression provenance,
    confidence, and compact unsupported-intrinsic caveats.
  - Evidence: Completed on 2026-06-06. Added the `yaml` parser dependency and
    replaced SAM/CloudFormation resource detection with a structured YAML/JSON
    template walk that preserves short-form tag evidence. The resource adapter
    now emits resource-backed unresolved references for `Ref`, `Fn::GetAtt`,
    `Fn::Sub`, `Fn::Join` nested references, `Fn::ImportValue`, and
    `DependsOn`; the shared graph resolver turns unambiguous logical-resource
    references into confidence-labeled edges while leaving parameters/imports
    unresolved. Secret-like values are omitted from reference metadata.
    Validation: `pnpm typecheck` and `pnpm exec vitest run
    tests/workspace/sam-intrinsic-fixtures.test.ts
    tests/graph/extraction-pipeline.test.ts` passed.

- [ ] T003 Implement event-source and handler context grouping.
  - Depends on: T002
  - Files: `src/application/`, `src/presentation/`, `tests/mcp/`
  - Acceptance: `context_for_task`, `symbol_search`, and template grouping show
    logical ID, handler, handler file, and related event-source evidence within
    budgets.
  - Evidence: Pending.

- [ ] T004 Wire template-aware impact and references.
  - Depends on: T002, T003
  - Files: `src/application/`, `tests/graph/`, `tests/mcp/`
  - Acceptance: `impact` and `find_references` return directly related
    template resources and handler files with confidence labels.
  - Evidence: Pending.

- [ ] T005 Improve IaC validation planning and dogfood.
  - Depends on: T003
  - Files: `src/application/use-cases/`, `tests/validation/`, `.tmp/`,
    `docs/specs/016-sam-cloudformation-intrinsic-routing/verification.md`
  - Acceptance: Planner prefers repo policy and records read-only dogfood
    evidence against at least one AWS IaC sample repository.
  - Evidence: Pending.

- [ ] T006 Promote docs, validate, and close.
  - Depends on: T004, T005
  - Files: `docs/design/language-adapter-design.md`,
    `docs/design/mcp-surface-design.md`,
    `docs/reference/language-capability-matrix.md`,
    `docs/reference/documentation-map.md`,
    `docs/specs/016-sam-cloudformation-intrinsic-routing/`
  - Acceptance: Durable docs describe accepted intrinsic, event-source,
    handler, impact, and validation behavior; full relevant validation passes
    before archival.
  - Evidence: Pending.
