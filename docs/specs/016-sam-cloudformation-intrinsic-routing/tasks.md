---
title: SAM CloudFormation intrinsic routing tasks
doc_type: spec
artifact_type: tasks
status: archived
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

- [x] T003 Implement event-source and handler context grouping.
  - Depends on: T002
  - Files: `src/application/`, `src/presentation/`, `tests/mcp/`
  - Acceptance: `context_for_task`, `symbol_search`, and template grouping show
    logical ID, handler, handler file, and related event-source evidence within
    budgets.
  - Evidence: Completed on 2026-06-06. SAM function extraction now emits
    `lambda_event_source` nodes, direct resource-backed event-source routing
    edges, and compact event summaries on Lambda function, handler binding, and
    resolved handler-file metadata. Handler grouping signatures include bounded
    event-source evidence, and exact event-source symbol lookup is covered by
    query tests. Validation: `pnpm typecheck` and `pnpm exec vitest run
    tests/graph/extraction-pipeline.test.ts tests/graph/query-tools.test.ts`
    passed.

- [x] T004 Wire template-aware impact and references.
  - Depends on: T002, T003
  - Files: `src/application/`, `tests/graph/`, `tests/mcp/`
  - Acceptance: `impact` and `find_references` return directly related
    template resources and handler files with confidence labels.
  - Evidence: Completed on 2026-06-06. `find_references` now labels
    CloudFormation-backed graph hits with `config`/`infra_parser` evidence
    instead of generic parser evidence. Handler bindings route to their
    template resource and event sources, so bounded `impact` traversals from a
    handler can reach the handler file, explicit SAM events, Lambda function,
    and directly referenced template resources with low-confidence
    resource-backed caveats. Validation: `pnpm typecheck` and
    `pnpm exec vitest run tests/graph/query-tools.test.ts
    tests/graph/extraction-pipeline.test.ts` passed.

- [x] T005 Improve IaC validation planning and dogfood.
  - Depends on: T003
  - Files: `src/application/use-cases/`, `tests/validation/`, `.tmp/`,
    `docs/specs/016-sam-cloudformation-intrinsic-routing/verification.md`
  - Acceptance: Planner prefers repo policy and records read-only dogfood
    evidence against at least one AWS IaC sample repository.
  - Evidence: Completed on 2026-06-06. Added fixture-backed validation
    planning coverage for repo-approved intrinsic SAM/CloudFormation commands
    and selected-template precedence. Fixed SAM planning to prioritize
    explicitly selected templates before broader repository templates. Ran
    read-only dogfood against
    `/home/bcherrington/Projects/Clients/Co-foundry/aws-datalake`; the selected
    `infra/sam/iiot-ot-core/template.yaml` now plans first. Report:
    `.tmp/spec-016-aws-iac-dogfood-2026-06-06.md`. Validation:
    `pnpm typecheck` and
    `pnpm exec vitest run tests/mcp/verification-plan-tool.test.ts` passed.

- [x] T006 Promote docs, validate, and close.
  - Depends on: T004, T005
  - Files: `docs/design/language-adapter-design.md`,
    `docs/design/mcp-surface-design.md`,
    `docs/reference/language-capability-matrix.md`,
    `docs/reference/documentation-map.md`,
    `docs/specs/016-sam-cloudformation-intrinsic-routing/`
  - Acceptance: Durable docs describe accepted intrinsic, event-source,
    handler, impact, and validation behavior; full relevant validation passes
    before archival.
  - Evidence: Completed on 2026-06-06. Promoted accepted
    SAM/CloudFormation intrinsic, dependency, event-source, handler impact, and
    validation-planning behavior to durable language, MCP surface,
    capability-matrix, and documentation-map docs. Full validation passed
    before archival: `pnpm typecheck`, `pnpm test`, `git diff --check`, and
    spec lifecycle scan.
