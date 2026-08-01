---
title: Ruby and Rails resource discovery tasks
doc_type: spec
artifact_type: tasks
status: draft
owner: platform
last_reviewed: 2026-08-01
---

# Tasks

**Input:** All artifacts in `docs/specs/047-ruby-rails-resource-discovery/`

## Task Dependency Graph

```text
T001 -> T002 -> T003 -> T004 -> T005 -> T006 -> T007 -> T008
```

## Phase 1: Reconciliation and fixtures

- [x] T001 Reconcile Ruby/Rails scope with current adapters and public contracts.
  - Depends on: none
  - Requirements: Requirement 1, Requirement 2, Requirement 3, Requirement 4
  - Files: `docs/specs/047-ruby-rails-resource-discovery/design.md`,
    `docs/specs/047-ruby-rails-resource-discovery/traceability.md`,
    `docs/specs/047-ruby-rails-resource-discovery/verification.md`
  - Inspect: `src/infrastructure/filesystem/file-identity.ts`,
    `src/domain/policies/path-policy.ts`,
    `src/domain/policies/command-safety.ts`,
    `src/domain/policies/adapter-capabilities.ts`,
    `src/application/use-cases/file-catalog-entry.ts`,
    the proposed `src/application/use-cases/rails-project-shape.ts` location,
    `src/application/use-cases/get-task-context.ts`,
    `src/application/use-cases/get-repo-overview.ts`,
    `src/application/use-cases/index-repository-graph.ts`,
    `src/application/use-cases/validation-environment.ts`,
    `src/application/use-cases/validation-ecosystems.ts`,
    `src/application/use-cases/plan-verification.ts`,
    `src/infrastructure/extraction/resource-extractor.ts`,
    `src/infrastructure/extraction/resource-shared.ts`,
    `src/infrastructure/extraction/extractor-registry.ts`,
    `src/infrastructure/extraction/index.ts`,
    `src/infrastructure/filesystem/workspace-safety.ts`,
    `src/presentation/redaction.ts`,
    `src/presentation/repo-overview-presenter.ts`,
    `src/presentation/task-context-presenter.ts`,
    `src/interface-adapters/mcp/instrumentation.ts`,
    `src/infrastructure/telemetry/index.ts`,
    `tests/application/validation-planner-rules.test.ts`,
    `tests/graph/extraction-pipeline.test.ts`,
    `tests/graph/resource-extractor-rules.test.ts`,
    `tests/mcp/context-for-task-tool.test.ts`,
    `tests/mcp/repo-scope-overview-resource.test.ts`,
    `tests/mcp/telemetry-instrumentation.test.ts`,
    `tests/mcp/verification-plan-tool.test.ts`,
    `tests/workspace/command.test.ts`,
    `tests/workspace/path-policy-consistency.test.ts`,
    and `tests/telemetry/boundary-instrumentation.test.ts` without modifying
    source or tests.
  - Acceptance: Exact catalog-backed project-shape ownership, file-local
    extraction seams, generic metadata, affected tests, and any graph-schema
    decision are verified against live source before implementation. The exact
    response and telemetry attribute construction seams are identified, with
    the existing approved fields and suppression boundary recorded. T001
    updates design, traceability, and verification only if reconciliation finds
    drift; its evidence names inspected seams and the result before T002. This
    inspection does not count as telemetry-suppression proof.
  - Evidence: Direct reads of the T001 source/test inventory confirmed: proposed `src/application/use-cases/rails-project-shape.ts` is the pure application-policy owner; each owning flow reuses its existing bounded catalog scan; `resource-extractor.ts` and `GraphNodeWriteModel.metadata` support the existing generic `resource` node without schema change; shared identity, safety, presentation, telemetry, and structured `planCommand` seams and their pending Ruby/Rails gaps are recorded in `design.md`, `traceability.md`, and `verification.md`. `lint_spec_package` completed with 0 diagnostics.
  - Design constraint: shape is repository-wide, catalog-driven, and consumed by
    `index-repository-graph`, `get-repo-overview`, `get-task-context`, and
    validation planning.

  - Status: Reconciled; no source or tests changed. T002 may begin.
  - Evidence mode: artifact
- [x] T002 Add representative Ruby/Rails fixture repositories and expected
  route/config evidence and validation outcomes.
  - Depends on: T001
  - Requirements: Requirement 1, Requirement 2, Requirement 3, Requirement 4
  - Properties: CP-001, CP-002, CP-003, CP-004, CP-005, CP-006
  - Files: `tests/fixtures/fixture-rails-standard-repo` (intended),
    `tests/fixtures/fixture-rails-engine-repo` (intended),
    `tests/fixtures/fixture-rails-nonstandard-repo` (intended),
    `tests/fixtures/fixture-rails-rspec-suite` (intended),
    `tests/fixtures/fixture-rails-minitest-suite` (intended),
    `tests/application/validation-planner-rules.test.ts`,
    `tests/graph/extraction-pipeline.test.ts`,
    `tests/graph/resource-extractor-rules.test.ts`,
    `tests/mcp/context-for-task-tool.test.ts`,
    `tests/mcp/repo-scope-overview-resource.test.ts`,
    `tests/mcp/verification-plan-tool.test.ts`,
    `tests/workspace/path-policy-consistency.test.ts`
  - Acceptance: Fixtures cover conventional Rails, an engine, a non-standard
    layout, RSpec, Minitest, constrained environment policy, secret-bearing
    negatives (`config/master.key`, `config/credentials/**`, encrypted Rails
    credentials, `.env*`) plus safe examples, missing optional files,
    unreadable/oversized/budget-truncated cases, and generated/vendor
    exclusions. Each fixture asserts its expected resource, overview, context,
    coverage, exclusion, or validation outcome.
  - Evidence: Added five representative Rails fixture repositories and explicit fixture-first assertions across seven focused suites. Conventional, engine, non-standard, RSpec, Minitest, Docker-constrained policy, secret, generated/vendor, oversized, permission-denied, truncated, and absent-optional-file cases are covered. Focused Vitest completed with 131 passing assertions and 8 deliberate expected failures defining T003-T006; full Vitest completed with 103 files and 1124 passing tests plus the same 8 expected failures; pnpm typecheck, fixture JSON, bounded secret-pattern, and git visibility checks passed. No production source changed.
  - Prerequisite: T001 reconciliation must be complete with recorded evidence.

  - Status: Phase 1 fixtures complete; T003 Ruby identity and capability implementation is next.
  - Evidence mode: artifact
## Phase 2: Resource-backed implementation

- [x] T003 Implement Ruby file identity and resource-backed capability.
  - Depends on: T002
  - Requirements: Requirement 1
  - Properties: CP-004, CP-005, CP-006
  - Files: `src/infrastructure/filesystem/file-identity.ts`,
    `src/application/use-cases/file-catalog-entry.ts`,
    `src/domain/policies/adapter-capabilities.ts`,
    `src/domain/policies/path-policy.ts`,
    `tests/workspace/file-catalog-scanner.test.ts`,
    `tests/workspace/path-policy-consistency.test.ts`,
    `tests/graph/resource-extractor-rules.test.ts`
  - Acceptance: Ruby and Ruby/Rails metadata are classified accurately without
    changing existing adapter capability levels.
  - Evidence: Implemented Ruby identity in both file-identity paths, resource-backed Ruby capability, Gemfile/Gemfile.lock package evidence, Rails route framework evidence, and shared config/credentials path exclusion. pnpm typecheck passed; focused T003 tests passed 21/21; all seven Rails suites passed with 134 assertions and 5 remaining expected failures owned by T004-T005.

  - Status: T003 complete; T004 may begin.
  - Evidence mode: command
- [x] T004 Implement bounded Rails project-shape and resource extraction.
  - Depends on: T003
  - Requirements: Requirement 2, Requirement 4
  - Properties: CP-001, CP-002, CP-004, CP-006
  - Files: `src/application/use-cases/index-repository-graph.ts`,
    `src/application/use-cases/rails-project-shape.ts` (intended),
    `src/infrastructure/extraction/index.ts`,
    `src/infrastructure/extraction/extractor-registry.ts`,
    `src/infrastructure/extraction/resource-extractor.ts`,
    `src/infrastructure/extraction/resource-shared.ts`,
    `tests/graph/extraction-pipeline.test.ts`,
    `tests/graph/resource-extractor-rules.test.ts`,
    `tests/fixtures/fixture-rails-standard-repo` (intended),
    `tests/fixtures/fixture-rails-engine-repo` (intended),
    `tests/fixtures/fixture-rails-nonstandard-repo` (intended)
  - Acceptance: `index-repository-graph` computes repository-wide shape from the
    existing bounded catalog exactly once before admitting Rails-specific graph
    associations. File-local extraction emits only candidate role,
    configuration, test, and route-file path metadata and does not decide that
    the repository is Rails. Unreadable, oversized,
    unavailable, or truncated evidence remains visibly non-complete; no Ruby DSL
    is parsed and no runtime semantics are claimed. Engine and non-standard
    layouts use their observed roots without fabricating a conventional `app/`
    layout.
  - Evidence: Added pure application-owned rails-project-shape.ts, computed once from the existing bounded graph scan, plus file-local Rails candidate metadata on generic resource nodes and catalog-gated admission. Conventional, engine, nonstandard, generic-Ruby negative, oversized, generated-downrank/vendor-exclusion fixtures pass. No new graph kind/schema, traversal, parser, or runtime semantics. pnpm typecheck passed; graph focused tests passed 36/36.

  - Status: T004 complete; T005 may begin.
  - Evidence mode: command
- [x] T005 Integrate Rails-aware overview and task-context ranking.
  - Depends on: T004
  - Requirements: Requirement 2
  - Properties: CP-001, CP-002, CP-005
  - Files: `src/application/use-cases/get-repo-overview.ts`,
    `src/application/use-cases/get-task-context.ts`,
    `src/presentation/repo-overview-presenter.ts`,
    `src/presentation/task-context-presenter.ts`,
    `src/interface-adapters/mcp/registries/resources/repo-overview.ts`,
    `src/interface-adapters/mcp/registries/tools/context-for-task.ts`,
    `tests/graph/extraction-pipeline.test.ts`,
    `tests/mcp/context-for-task-tool.test.ts`,
    `tests/mcp/repo-scope-overview-resource.test.ts`
  - Acceptance: Overview identifies Ruby/Rails platform evidence, promotes
    observed Rails key files and provides Rails validation hints; task context
    ranks relevant first-party Rails files and nearby tests ahead of unrelated
    resources. Both surfaces expose provenance and non-complete coverage.
  - Evidence: Integrated one bounded Rails shape computation into get-repo-overview and get-task-context. Overview reports Ruby/Rails platforms, observed key files, and verification_plan hints; task context ranks only observed Rails tests/routes/config/package/role evidence, including engine and nonstandard roots, with root '.' constrained against unrelated files. Public contracts and thin MCP adapters unchanged. pnpm typecheck passed; focused overview/context tests passed 61/61.

  - Status: T005 complete; T006 may begin.
  - Evidence mode: command
- [x] T006 Add policy-aware Rails validation planning.
  - Depends on: T005
  - Requirements: Requirement 3
  - Properties: CP-003
  - Files: `src/application/use-cases/validation-ecosystems.ts`,
    `src/application/use-cases/plan-verification.ts`,
    `src/application/use-cases/validation-environment.ts`,
    `src/application/use-cases/validation-package-scripts.ts`,
    `src/domain/policies/command-safety.ts`,
    `tests/application/validation-planner-rules.test.ts`,
    `tests/mcp/verification-plan-tool.test.ts`,
    `tests/workspace/command.test.ts`,
    `tests/workspace/path-policy-consistency.test.ts`
  - Acceptance: RSpec/Minitest and repository-approved Bundler/Rails/Rake
    candidates are planned but never executed; explicit precedence applies:
    repo policy first, required wrappers/environment next, policy-scoped
    binstubs/scripts/framework evidence next, and constrained host defaults only
    when allowed. Environment or evidence conflicts return structured
    needed/blocked evidence. Root selection uses catalog-visible ancestry,
    longest containing root, minimal selected-path distance, then lexical
    tie-break. Candidate discovery performs no traversal, and structured
    command/args values pass through `planCommand` safety as
    `planned`/`not_executed`. `planCommand` does not authorize execution or
    elevate repository-local policy commands into the trusted executable set;
    custom candidates retain explicit repository provenance.
  - Evidence: Added one catalog-only RailsProjectShape computation to verification planning, deterministic Rails-root RSpec and Minitest candidate ranking, root-correct binstub handling, nested Minitest load paths, explicit repository-policy precedence, host-environment blocking, structured planCommand safety, and planned/not_executed output. pnpm typecheck passed; focused validation-planner, verification-plan, and command-safety suites passed 48/48.

  - Status: T006 complete; T007 may begin.
  - Evidence mode: command
## Phase 3: Verification, promotion, and closure

- [x] T007 Run focused and full validation plus bounded Rails dogfood.
  - Depends on: T006
  - Requirements: Requirement 1, Requirement 2, Requirement 3, Requirement 4
  - Properties: CP-001, CP-002, CP-003, CP-004, CP-005, CP-006
  - Files: `docs/specs/047-ruby-rails-resource-discovery/verification.md`,
    `tests/application/validation-planner-rules.test.ts`,
    `tests/graph/extraction-pipeline.test.ts`,
    `tests/graph/resource-extractor-rules.test.ts`,
    `tests/mcp/context-for-task-tool.test.ts`,
    `tests/mcp/repo-scope-overview-resource.test.ts`,
    `tests/mcp/verification-plan-tool.test.ts`,
    `tests/mcp/telemetry-instrumentation.test.ts`,
    `tests/telemetry/boundary-instrumentation.test.ts`,
    `tests/workspace/path-policy-consistency.test.ts`,
    `tests/workspace/command.test.ts`,
    `docs/reference/dogfood-evidence-ledger.md`
  - Acceptance: Focused fixtures, typecheck, full test suite, plugin/package
    gates selected by the verification plan, one Rails dogfood pass with durable
    evidence, regression coverage for affected current adapters, and explicit
    residual limitations. Targeted response-redaction and telemetry-attribute
    tests prove that raw Rails file paths, source bodies, command arguments,
    secret-like values, and new repository-specific identifiers are not
    emitted; generic boundary/dispatch metadata assertions alone are
    insufficient.
    Shared path-policy consistency proves Rails credential rules apply across
    scanning, validation planning, presentation redaction, and write safety.
  - Evidence: Passed Rails fixture and regression validation (10 primary files/163 tests plus 8 remediation/safety files/132 tests), pnpm typecheck, final full Vitest (103 files/1148 tests), plugin validation and package dry-run. Bounded read-only dogfood on an active Rails application found a lexical nearest-test defect; after basename-aware repair the identical request planned test/models/user_test.rb without execution. Independent architecture, QA, lifecycle and security findings were remediated with complete anchor classification, Rails config selection, embedded-fixture isolation, response redaction, telemetry negatives and hook/runtime credential-policy parity.

  - Status: T007 complete; final validation green after review remediation.
  - Evidence mode: command
- [x] T008 Promote accepted behavior and prepare lifecycle closure.
  - Depends on: T007
  - Requirements: Requirement 4
  - Files: `docs/design/language-adapter-design.md`,
    `docs/reference/language-capability-matrix.md`, `docs/backlog/README.md`,
    `docs/reference/workspace-safety-contract.md`,
    `docs/reference/dogfood-evidence-ledger.md`,
    `docs/history/spec-closure-log.md`
  - Acceptance: Durable docs describe current resource-backed support and the
    verified shared Rails credential policy, parser work remains owned by Spec
    048, review findings are resolved or routed, and closure checks pass.
  - Evidence: Promoted current behavior to docs/design/language-adapter-design.md, docs/reference/language-capability-matrix.md, docs/backlog/README.md, docs/reference/workspace-safety-contract.md and docs/reference/dogfood-evidence-ledger.md; routed parser ownership to docs/specs/048-ruby-rails-partial-semantic/tasks.md without starting T002. Post-promotion pnpm typecheck passed, 8 focused files/132 tests passed, lint_spec_package returned 0 diagnostics, task_state_audit passed with 0 findings, and closure_check returned ready=true with 0 blockers.

  - Status: T008 complete; closure_check ready with zero blockers.
  - Evidence mode: command
## Execution Rules

- T001 is a read-only source reconciliation task; it does not authorize runtime
  implementation, and T002 remains blocked until its evidence is recorded.
- Read the full package and durable sources before implementing any task.
- Mark only one implementation task `[~]` at a time.
- Do not add a Ruby AST, LSP, Sorbet, RuboCop, shell, or alternate parser path.
- Do not execute repository commands during discovery or validation planning.
- Keep MCP adapters thin and shared contracts language-neutral.
- Record commands, results, skipped checks, limitations, and durable promotion
  evidence before marking tasks complete.
- Container and devcontainer artifacts alone are advisory; explicit repository
  instructions or policy requiring them remain authoritative.

## Related Artifacts

- Requirements: `requirements.md`
- Change Impact: `change-impact.md`
- Design: `design.md`
- Traceability: `traceability.md`
- Verification: `verification.md`
