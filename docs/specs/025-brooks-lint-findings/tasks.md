---
title: Brooks-Lint findings tracker tasks
doc_type: spec
artifact_type: tasks
status: active
owner: platform
last_reviewed: 2026-06-06
---

# Tasks

## Task Dependency Graph

```text
T001 -> T002
T002 -> T003
T002 -> T004
T002 -> T005
T003,T004,T005 -> T006 -> T007
T001 -> T008
T008 -> T009
T009 -> T010
T009 -> T011
T009 -> T012
T013 -> T014
T015 -> T016
T016 -> T017
T016 -> T018
```

## Phase 1: Intake And Triage

- [x] T001 Capture the initial `$brooks-audit` findings.
  - Files: `docs/specs/025-brooks-lint-findings/findings.md`,
    `docs/specs/025-brooks-lint-findings/requirements.md`
  - Acceptance: The architecture audit report includes scope, health score,
    module graph, findings, evidence, and Symptom/Source/Consequence/Remedy
    fields.
  - Evidence: Captured in `findings.md` on 2026-06-06.

- [x] T002 Triage and accept, defer, or dismiss current architecture findings.
  - Depends on: T001
  - Files: `docs/specs/025-brooks-lint-findings/findings.md`,
    `docs/specs/025-brooks-lint-findings/tasks.md`
  - Acceptance: `BL-ARCH-001`, `BL-ARCH-002`, and `BL-ARCH-003` each have a
    status beyond `new`, with a rationale and linked remediation tasks if
    accepted.
  - Evidence: 2026-06-11 triage accepted `BL-ARCH-001`, `BL-ARCH-002`, and
    `BL-ARCH-003` in `findings.md`, with remediation linked to `T003`, `T004`,
    and `T005`.

## Phase 2: Architecture Remediation

- [x] T003 Strengthen architecture boundary import extraction.
  - Depends on: T002
  - Findings: `BL-ARCH-001`
  - Files: `tests/architecture/layer-boundaries.test.ts`
  - Acceptance: Boundary tests detect single-line and multiline static
    imports/exports using one explicit parser path, and fail on
    application-to-infrastructure imports.
  - Evidence: 2026-06-11 replaced line-oriented import regexes with TypeScript
    AST module-specifier extraction, added multiline static import/export
    coverage, moved pure Markdown document helpers inward to
    `src/application/use-cases/markdown-docs.ts`, and passed
    `pnpm exec vitest run tests/architecture/layer-boundaries.test.ts`,
    `pnpm exec vitest run tests/docs/query-docs.test.ts tests/docs/fts-docs-search-fixtures.test.ts tests/mcp/docs-surfaces.test.ts tests/graph/query-tools.test.ts`,
    `pnpm typecheck`, and `pnpm test`.
  - [x] T003.1 Add fixture coverage for multiline static imports.
  - [x] T003.2 Verify current application-to-infrastructure imports are
    detected before remediation.
  - [x] T003.3 Keep the rule implementation scoped to architecture boundary
    checks.

- [x] T004 Remove application-to-presentation dependency cycle.
  - Depends on: T002, T003
  - Findings: `BL-ARCH-002`
  - Files: `src/application/use-cases/`, `src/presentation/`,
    `src/contracts/` or `src/application/`
  - Acceptance: Application use cases no longer import `src/presentation`;
    presenters continue to build response envelopes and metadata; boundary
    tests prevent the cycle from returning.
  - Evidence: 2026-06-11 selected application-owned response metadata policy,
    moved `src/presentation/metadata.ts` to
    `src/application/use-cases/response-metadata.ts`, updated application and
    presentation imports without changing response contracts, added an
    application boundary rule forbidding `src/presentation` imports, and passed
    `pnpm exec vitest run tests/architecture/layer-boundaries.test.ts tests/contracts/response-metadata.test.ts`,
    `pnpm typecheck`, and `pnpm test`.
  - [x] T004.1 Decide ownership for next-action and metadata primitives.
  - [x] T004.2 Move shared helpers to the selected inward layer.
  - [x] T004.3 Update imports without changing response contracts.
  - [x] T004.4 Add or update boundary assertions for
    application-to-presentation imports.

- [x] T005 Remove or document MCP adapter telemetry infrastructure coupling.
  - Depends on: T002, T003
  - Findings: `BL-ARCH-003`
  - Files: `src/interface-adapters/mcp/`, `src/infrastructure/telemetry/`,
    `src/ports/`, `docs/design/layered-runtime-architecture.md`
  - Acceptance: MCP adapters depend on a telemetry port abstraction, or the
    concrete telemetry dependency is documented as an intentional exception
    with a matching boundary test.
  - Evidence: 2026-06-11 selected a port abstraction, added
    `TelemetryRecorderPort` to `src/ports/index.ts`, kept concrete telemetry in
    `src/infrastructure/telemetry/index.ts`, updated MCP server and
    instrumentation imports to the port, broadened the MCP architecture rule to
    forbid concrete infrastructure imports, and passed
    `pnpm exec vitest run tests/architecture/layer-boundaries.test.ts tests/mcp/telemetry-instrumentation.test.ts tests/telemetry/boundary-instrumentation.test.ts tests/telemetry/config.test.ts`,
    `pnpm typecheck`, and `pnpm test`.
  - [x] T005.1 Decide whether telemetry belongs behind `src/ports`.
  - [x] T005.2 Move or document the type ownership.
  - [x] T005.3 Update boundary tests for the selected rule.

## Phase 3: Validation And Documentation

- [x] T006 Run validation for accepted remediations.
  - Depends on: T003, T004, T005
  - Files: `tests/architecture/layer-boundaries.test.ts`, `src/`
  - Acceptance: `pnpm typecheck`, targeted architecture tests, and relevant
    Vitest suites pass after remediation.
  - Evidence: 2026-06-11 aggregate validation passed after `T003`, `T004`,
    and `T005`: `pnpm exec vitest run tests/architecture/layer-boundaries.test.ts`
    passed 1 test file and 6 tests, `pnpm typecheck` passed, and `pnpm test`
    passed 59 test files and 396 tests.

- [x] T007 Promote resolved architecture decisions into durable docs.
  - Depends on: T006
  - Files: `docs/design/layered-runtime-architecture.md`,
    `docs/architecture/system-architecture.md`,
    `docs/reference/documentation-map.md`
  - Acceptance: Durable docs describe the final boundary ownership for
    metadata helpers, Markdown document helpers, telemetry abstraction, and any
    intentional exceptions.
  - Evidence: 2026-06-11 promoted current boundary ownership to
    `docs/design/layered-runtime-architecture.md`, summarized the dependency
    direction in `docs/architecture/system-architecture.md`, and updated
    `docs/reference/documentation-map.md` to keep layered runtime architecture
    as the canonical owner. No intentional exceptions remain for the remediated
    architecture rules.

## Phase 4: Later Brooks-Lint Runs

- [x] T008 Append findings from the next Brooks-Lint skill run.
  - Depends on: T001
  - Files: `docs/specs/025-brooks-lint-findings/findings.md`,
    `docs/specs/025-brooks-lint-findings/tasks.md`,
    `docs/specs/025-brooks-lint-findings/verification.md`
  - Acceptance: The next run is captured with mode, scope, health score,
    findings, statuses, and any task updates without overwriting the
    `$brooks-audit` evidence.
  - Evidence: Captured `$brooks-debt` Tech Debt Assessment in `findings.md`
    on 2026-06-06.

## Phase 5: Debt Triage And Remediation

- [x] T009 Triage and accept, defer, or dismiss current tech debt findings.
  - Depends on: T008
  - Files: `docs/specs/025-brooks-lint-findings/findings.md`,
    `docs/specs/025-brooks-lint-findings/tasks.md`
  - Acceptance: `BL-DEBT-001`, `BL-DEBT-002`, and `BL-DEBT-003` each have a
    status beyond `new`, with a rationale and linked remediation tasks if
    accepted.
  - Evidence: 2026-06-11 accepted `BL-DEBT-001`, `BL-DEBT-002`, and
    `BL-DEBT-003` with rationale. Existing remediation tasks remain `T010`,
    `T011`, and `T012`.

- [x] T010 Split validation planning by concern.
  - Depends on: T009
  - Findings: `BL-DEBT-001`
  - Files: `src/application/use-cases/plan-verification.ts`,
    `src/application/`, `tests/mcp/verification-plan-tool.test.ts`,
    `tests/`
  - Acceptance: Validation planning keeps one explicit planning path and
    current response contracts, while language, environment, package-script,
    and static-feedback planning logic moves into focused modules with
    fixture-backed tests.
  - Evidence: 2026-06-11 kept `planVerification` as the single orchestration
    path, extracted shared validation utilities, static feedback,
    environment/policy discovery, package-script planning, and ecosystem target
    selection into focused application modules, and passed
    `pnpm exec vitest run tests/mcp/verification-plan-tool.test.ts`,
    `pnpm exec vitest run tests/contracts/runtime-contracts.test.ts tests/presentation/session-aware-presenters.test.ts tests/mcp/stdio-entrypoint.test.ts`,
    `pnpm typecheck`, and `pnpm test`.
  - [x] T010.1 Identify stable planner boundaries without changing behavior.
  - [x] T010.2 Extract environment policy and package-script planning.
  - [x] T010.3 Extract language and ecosystem target selection.
  - [x] T010.4 Run targeted verification-plan tests and `pnpm typecheck`.

- [x] T011 Split resource-backed extraction by resource domain.
  - Depends on: T009
  - Findings: `BL-DEBT-002`
  - Files: `src/infrastructure/extraction/resource-extractor.ts`,
    `src/infrastructure/extraction/`, `tests/graph/extraction-pipeline.test.ts`
  - Acceptance: Generic resource, .NET, CloudFormation/SAM, and CMake
    extraction concerns are separated behind the existing `ExtractorPort`
    behavior, with fixture-backed tests preserving emitted nodes, edges, and
    unresolved references.
  - Evidence: 2026-06-11 kept `ResourceExtractorAdapter` as the stable
    coordinator and split domain logic into
    `cloudformation-resource-extractor.ts`, `cmake-resource-extractor.ts`,
    `dotnet-resource-extractor.ts`, and `resource-shared.ts`. Passed
    `pnpm exec vitest run tests/graph/extraction-pipeline.test.ts tests/graph/query-tools.test.ts tests/mcp/context-for-task-tool.test.ts tests/mcp/verification-plan-tool.test.ts`,
    `pnpm exec vitest run tests/graph/cmake-cpp-routing-fixture.test.ts tests/workspace/sam-intrinsic-fixtures.test.ts tests/workspace/file-catalog-scanner.test.ts tests/mcp/repo-scope-overview-resource.test.ts`,
    `pnpm typecheck`, and `pnpm test`.
  - [x] T011.1 Identify current golden behavior for each resource domain.
  - [x] T011.2 Extract one resource domain at a time with tests.
  - [x] T011.3 Verify extraction pipeline tests and `pnpm typecheck`.

- [x] T012 Split runtime contracts into context modules behind the current barrel.
  - Depends on: T009
  - Findings: `BL-DEBT-003`
  - Files: `src/contracts/runtime-contracts.ts`, `src/contracts/`,
    `tests/contracts/runtime-contracts.test.ts`
  - Acceptance: Contract schemas are grouped by stable runtime context while
    existing public imports through `src/contracts/index.ts` remain compatible
    and contract tests prove schema behavior is unchanged.
  - Evidence: 2026-06-11 split runtime contracts into stable context modules
    for core primitives, orientation/repo overview, docs/Markdown quality,
    graph queries, validation/edit feedback, response envelopes, and
    integration profiles. Kept `src/contracts/runtime-contracts.ts` and
    `src/contracts/index.ts` as compatibility barrels, added public export
    parity coverage in `tests/contracts/runtime-contracts.test.ts`, updated
    `docs/reference/runtime-contracts.md`, and passed
    `pnpm exec vitest run tests/contracts/runtime-contracts.test.ts`,
    `pnpm typecheck`, and `pnpm test`.
  - [x] T012.1 Define contract module boundaries and public export inventory.
  - [x] T012.2 Move schemas in small groups without changing names or shapes.
  - [x] T012.3 Add or update export compatibility tests.
  - [x] T012.4 Run contract tests and `pnpm typecheck`.

## Phase 6: Health Dashboard Follow-Up

- [x] T013 Capture the `$brooks-health` dashboard.
  - Files: `docs/specs/025-brooks-lint-findings/findings.md`,
    `docs/specs/025-brooks-lint-findings/tasks.md`,
    `docs/specs/025-brooks-lint-findings/verification.md`
  - Acceptance: The health dashboard includes composite and dimension scores,
    a module graph, top findings, recommendation, and test suite map.
  - Evidence: Captured `$brooks-health` Health Dashboard in `findings.md` on
    2026-06-06.

- [x] T014 Triage and reduce MCP test harness brittleness.
  - Depends on: T013
  - Findings: `BL-HEALTH-001`
  - Files: `tests/mcp/`, `tests/integration/`, possible `tests/helpers/`
  - Acceptance: Repeated composed-server casts, direct registry handler access,
    and invalid-input dispatch setup are either moved behind typed test harness
    helpers or kept in focused registry tests with rationale.
  - Evidence: 2026-06-11 added `tests/helpers/mcp-harness.ts` with typed
    helpers for direct tool/resource registration, composed-server tool/resource
    lookup, and MCP response parsing. Updated representative MCP and
    integration behavior tests across graph query, context, verification,
    workspace edit, malformed input, docs, repo status/scope/overview,
    diagnostics, integration health, translation boundary, and Codex
    integration profile coverage. Kept direct registration plumbing in
    `tests/mcp/telemetry-instrumentation.test.ts` because that file tests the
    instrumentation wrapper itself. Passed targeted MCP/integration tests and
    `pnpm typecheck`.
  - [x] T014.1 Inventory repeated MCP test harness access patterns.
  - [x] T014.2 Add typed helpers for composed-server resources and tool
    dispatch where behavior tests need them.
  - [x] T014.3 Update representative MCP tests without changing assertions.
  - [x] T014.4 Run targeted MCP tests and `pnpm typecheck`.

## Phase 7: Test Quality Follow-Up

- [x] T015 Capture the `$brooks-test` review.
  - Files: `docs/specs/025-brooks-lint-findings/findings.md`,
    `docs/specs/025-brooks-lint-findings/tasks.md`,
    `docs/specs/025-brooks-lint-findings/verification.md`
  - Acceptance: The test quality review includes a test suite map, health
    score, findings, summary, and evidence from `pnpm test`.
  - Evidence: Captured `$brooks-test` Test Quality Review in `findings.md` on
    2026-06-06.

- [x] T016 Triage and accept, defer, or dismiss current test quality findings.
  - Depends on: T015
  - Files: `docs/specs/025-brooks-lint-findings/findings.md`,
    `docs/specs/025-brooks-lint-findings/tasks.md`
  - Acceptance: `BL-TEST-001`, `BL-TEST-002`, and `BL-TEST-003` each have a
    status beyond `new`, with a rationale and linked remediation tasks if
    accepted.
  - Evidence: 2026-06-11 triage marked `BL-TEST-001` resolved through `T014`,
    accepted `BL-TEST-002` for focused unit/contract follow-up in `T017`, and
    accepted `BL-TEST-003` for broad fixture annotation/splitting guidance in
    `T018`. No runtime code changed in this triage slice.

- [ ] T017 Add focused unit coverage while extracting validation and resource logic.
  - Depends on: T016, T010, T011
  - Findings: `BL-TEST-002`
  - Files: `tests/`, `src/application/`, `src/infrastructure/extraction/`
  - Acceptance: Validation planner and resource extractor refactors add
    smaller unit or contract tests for extracted rules while preserving
    existing integration fixture coverage.
  - Evidence: Pending.

- [ ] T018 Split or annotate broad fixture scenarios when they expand or fail.
  - Depends on: T016
  - Findings: `BL-TEST-003`
  - Files: `tests/docs/`, `tests/graph/`, `tests/workspace/`
  - Acceptance: Broad fixture tests keep their smoke-test value, but expanded
    or failing behavior clusters gain named helpers, smaller companion tests,
    or clearer scenario comments.
  - Evidence: Pending.
