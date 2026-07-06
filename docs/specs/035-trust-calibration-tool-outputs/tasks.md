---
title: Trust calibration in tool outputs tasks
doc_type: spec
artifact_type: tasks
status: active
owner: platform
last_reviewed: 2026-07-05
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Tasks

**Input**: `requirements.md`, `design.md`, `change-impact.md`,
`canonical-context.md`, `traceability.md`, and `verification.md` from
`docs/specs/035-trust-calibration-tool-outputs/`.

**Prerequisites**: Requirements and design accepted. The implementation agent
must read `traceability.md` before selecting a task.

## Agent Readiness Contract

- **Scope:** Add additive `meta.trust` calibration to public standard-envelope
  Agent Workbench responses, generated through shared contract and presenter
  helpers.
- **Out of scope:** Command execution, automatic validation, parser/semantic
  fallback broadening, full response-envelope redesign, contract-version bump,
  and broad proof-bundle export.
- **Primary files:** `src/contracts/runtime-response-contracts.ts`,
  `src/application/use-cases/response-metadata.ts`, `src/presentation/`,
  `src/interface-adapters/mcp/registries/`, `tests/contracts/`, `tests/mcp/`,
  `tests/docs/`, `docs/reference/runtime-contracts.md`, and
  `docs/design/mcp-surface-design.md`.
- **Architecture guardrails:** Keep MCP handlers thin; do not add adapter-local
  trust prose; derive trust after top-level warnings and errors are known; keep
  existing metadata vocabulary stable.
- **Validation baseline:** Run focused tests for each slice, then
  `pnpm typecheck`, relevant `pnpm exec vitest run ...` commands, spec lint,
  Markdown quality checks for changed docs, and full `pnpm test` before
  closure readiness.

## Task Dependency Graph

```text
T001 -> T002
T002 -> T003
T003 -> T004
T004 -> T005
T005 -> T006
T006 -> T011
T011 -> T007
T011 -> T008
T011 -> T009
T007 -> T010
T008 -> T010
T009 -> T010
T010 -> T012
T012 -> T013
T013 -> T014
T014 -> T015
T015 -> T016
```

## Phase 1: Spec Readiness

**Purpose**: Remove stale planning blockers before source implementation.

- [x] T001 Reconcile resolved requirements open questions.
  - Depends on: none
  - Requirements: R1, R2, R4, CP007
  - Files: `docs/specs/035-trust-calibration-tool-outputs/requirements.md`,
    `docs/specs/035-trust-calibration-tool-outputs/design.md`
  - Acceptance: Requirements no longer claim OQ001-OQ003 block design or
    implementation readiness; each question records the accepted design
    decision and destination.
  - Evidence mode: implementation
  - Evidence: Complete on 2026-07-05. Direct read confirmed
    `requirements.md` records OQ001-OQ003 under `## Resolved Design Questions`
    with implementation-planning status resolved, and `design.md` records
    D001-D003 plus the statement that those decisions resolve OQ001-OQ003.

- [x] T002 Confirm public surface inventory and explicit exclusions.
  - Depends on: T001
  - Requirements: R1, R2, R4, R5, CP005
  - Files: `src/interface-adapters/mcp/registries/index.ts`,
    `src/interface-adapters/mcp/registries/**`,
    `docs/specs/035-trust-calibration-tool-outputs/design.md`,
    `docs/specs/035-trust-calibration-tool-outputs/traceability.md`
  - Acceptance: The task evidence lists every public resource/tool in
    `mcpResources` and `mcpTools`, assigns a trust policy or explicit
    exclusion, and confirms there are no public standard-envelope exclusions
    except non-framable transport failures.
  - Evidence mode: validation
  - Evidence: Complete on 2026-07-05. Direct read of
    `src/interface-adapters/mcp/registries/index.ts` found 7 public
    `mcpResources`, 15 public `mcpTools`, and 0 public `mcpPrompts`. Every
    registered resource/tool maps to a `TrustSurfaceKind` below. There are no
    public standard-envelope exclusions; only non-framable transport startup
    failures and private/debug helpers remain excluded by design.
    Resource inventory:
    `repo:///status` -> `repository_status`; `repo:///scope` ->
    `repository_status`; `repo:///overview` -> `repository_status`;
    `repo:///docs/overview` -> `docs_routing`; `repo:///docs/map` ->
    `docs_routing`; `integration:///profiles/codex` -> `integration_profile`;
    `integration:///health/agent-workbench` -> `integration_health`.
    Tool inventory:
    `context_for_task` -> `context_routing`; `diagnostics_for_files` ->
    `diagnostics_static`; `docs_scope` -> `docs_session_scope`;
    `docs_search` -> `docs_routing`; `docs_current_for_task` ->
    `docs_routing`; `docs_outline` -> `docs_routing`;
    `docs_read_section` -> `docs_direct_read`;
    `check_markdown_document` -> `markdown_quality`;
    `check_markdown_set` -> `markdown_quality`; `symbol_search` ->
    `graph_symbol_routing`; `find_references` -> `graph_reference_routing`;
    `impact` -> `graph_impact_routing`; `preview_workspace_edit` ->
    `edit_preview`; `apply_workspace_edit` -> `edit_apply`;
    `verification_plan` -> `validation_plan`. Updated on 2026-07-06 after
    implementation review: static Codex profile metadata is not live health
    evidence, so it uses `integration_profile`.
  - [x] T002.1 Enumerated `mcpResources` and `mcpTools` from
    `src/interface-adapters/mcp/registries/index.ts`.
  - [x] T002.2 Mapped each resource/tool to one `TrustSurfaceKind`.
  - [x] T002.3 Recorded exclusion state: no public standard-envelope exclusions;
    non-framable transport startup failures and private/debug helpers remain
    excluded by design.

## Phase 2: Contract And Shared Policy

**Purpose**: Define the trust schema and derivation behavior before touching
surface presenters.

- [x] T003 Add trust calibration contract schemas and types.
  - Depends on: T002
  - Requirements: R1, R3, R5, CP004, CP007
  - Files: `src/contracts/runtime-response-contracts.ts`,
    `src/contracts/runtime-contracts.ts`, `src/contracts/index.ts`,
    `tests/contracts/runtime-contracts.test.ts`,
    `tests/contracts/response-metadata.test.ts`
  - Acceptance: `ResponseMetadata` has optional `trust`; trust use and
    verification requirement enums are exported; existing metadata fields and
    enum meanings remain unchanged; older metadata without `trust` still
    parses.
  - Evidence mode: implementation
  - Evidence: Complete on 2026-07-05. Added trust schemas and inferred types in
    `src/contracts/runtime-response-contracts.ts`, extended
    `responseMetadataSchema` with optional `trust`, and covered additive
    compatibility, invalid enum values, contradictory safe/unsafe values, and
    barrel exports in `tests/contracts/runtime-contracts.test.ts`.
  - [x] T003.1 Added `trustUseSchema`, `trustVerificationRequirementSchema`, and
    `trustCalibrationSchema`.
  - [x] T003.2 Extended `responseMetadataSchema` with optional `trust`.
  - [x] T003.3 Exported schemas and inferred types through existing contract
    barrels.
  - [x] T003.4 Added schema tests for valid values, invalid values, optional
    compatibility, and stable existing metadata semantics.

- [x] T004 Implement shared trust policy and derivation helpers.
  - Depends on: T003
  - Requirements: R1, R2, R3, R5, CP001, CP002, CP003, CP006
  - Files: `src/application/use-cases/response-metadata.ts`,
    `tests/contracts/response-metadata.test.ts`
  - Acceptance: Shared helpers derive deterministic `safe_to_use_for`,
    `not_safe_to_use_for`, and `must_verify_by` arrays from typed surface
    policy, metadata, warnings, errors, and caveats; unsafe wins on conflict;
    routing, planned validation, direct reads, executed validation, and failure
    states remain distinct.
  - Evidence mode: implementation
  - Evidence: Complete on 2026-07-05. Added `TrustSurfaceKind`,
    `TrustSurfacePolicy`, `buildTrustCalibration`, deterministic sorted output,
    unsafe-wins conflict handling, evidence strengthening, verification-status
    handling, and conservative failure-state overrides in
    `src/application/use-cases/response-metadata.ts`. Focused tests cover
    routing, planned validation, executed validation, direct-read scope,
    parser-backed scope, failure states, and CP001-CP007 behavior.
  - [x] T004.1 Added `TrustSurfaceKind` and `TrustSurfacePolicy`.
  - [x] T004.2 Added `buildTrustCalibration` and deterministic set handling.
  - [x] T004.3 Added failure-state overrides for stale, cold, refreshing,
    partial, invalid, invalid-due-to-environment, blocked, warning, error, and
    blocker-caveat responses.
  - [x] T004.4 Added tests for CP001 through CP007 using the repository's current
    Vitest test pattern.

- [x] T005 Add final trusted-envelope integration point.
  - Depends on: T004
  - Requirements: R1, R2, R5, CP006, CP007
  - Files: `src/contracts/runtime-response-contracts.ts`,
    `src/application/use-cases/response-metadata.ts`,
    `tests/contracts/response-metadata.test.ts`
  - Acceptance: Public presenters can derive `meta.trust` only after sanitized
    data, warnings, and errors are known; structured error envelopes can use
    `generic_error` trust without duplicating handler logic.
  - Evidence mode: implementation
  - Evidence: Complete on 2026-07-05. Added `makeTrustedEnvelope` in
    `src/application/use-cases/response-metadata.ts` so public presenters can
    derive `meta.trust` after data, warnings, and errors are known. Existing
    `makeEnvelope` behavior remains unchanged for private/internal call sites.
    Tests prove top-level warnings and errors affect `meta.trust` for
    structured generic-error envelopes.
  - [x] T005.1 Implemented `makeTrustedEnvelope` as the required public
    standard-envelope integration point.
  - [x] T005.2 Preserved existing `makeEnvelope` behavior for private/internal
    call sites that are not public Workbench surfaces.
  - [x] T005.3 Added tests proving top-level warnings and errors affect trust.

- [x] T006 Checkpoint - contract and policy validation.
  - Depends on: T005
  - Requirements: R1, R2, R3, R5, CP001, CP002, CP003, CP004, CP006, CP007
  - Files: `tests/contracts/runtime-contracts.test.ts`,
    `tests/contracts/response-metadata.test.ts`
  - Acceptance: Contract and helper tests pass; no presenter or registry work
    starts until the shared policy behavior is verified.
  - Validation: `pnpm exec vitest run tests/contracts/runtime-contracts.test.ts
    tests/contracts/response-metadata.test.ts`
  - Evidence mode: validation
  - Evidence: Complete on 2026-07-05. `pnpm exec vitest run
    tests/contracts/runtime-contracts.test.ts
    tests/contracts/response-metadata.test.ts` passed with 35 tests, and
    `pnpm typecheck` passed.

- [x] T011 Add public surface policy coverage tests.
  - Depends on: T006
  - Requirements: R1, R2, R5, CP005
  - Files: `src/interface-adapters/mcp/registries/index.ts`,
    `tests/mcp/registry-metadata.test.ts`
  - Acceptance: Tests fail when a public resource or tool that returns a
    standard envelope lacks a trust policy or explicit documented exclusion
    before presenter wiring begins.
  - Evidence mode: implementation
  - Evidence: Complete on 2026-07-06. Added explicit
    `publicSurfaceTrustPolicies` registry metadata in
    `src/interface-adapters/mcp/registries/index.ts`, attached policies during
    public metadata normalization, and added coverage plus negative unmapped
    surface assertions in `tests/mcp/registry-metadata.test.ts`.
  - [x] T011.1 Added trust policy metadata or a test-owned policy map for every
    current public surface.
  - [x] T011.2 Asserted registry resources and tools are fully represented.
  - [x] T011.3 Asserted no public standard-envelope surface uses an implicit
    fallback trust policy.
  - [x] T011.4 Added a negative fixture or temporary test case proving an
    unmapped public surface fails.

## Phase 3: Presenter Wiring

**Purpose**: Add `meta.trust` to every public standard-envelope surface through
shared policy inputs.

- [x] T007 Wire trust into repository and integration resource presenters.
  - Depends on: T011
  - Requirements: R1, R2, R4, R5, CP001, CP005, CP006
  - Files: `src/presentation/status-presenter.ts`,
    `src/presentation/repo-scope-presenter.ts`,
    `src/presentation/repo-overview-presenter.ts`,
    `src/presentation/integration-health-presenter.ts`,
    `src/presentation/integration-profile-presenter.ts`,
    `tests/mcp/repo-status-resource.test.ts`,
    `tests/mcp/repo-scope-overview-resource.test.ts`,
    `tests/mcp/integration-health-resource.test.ts`,
    `tests/integration/codex-integration-profile.test.ts`
  - Acceptance: Status, scope, overview, integration health, and integration
    profile envelopes include routing/runtime trust and never claim task
    completion proof.
  - Evidence mode: implementation
  - Evidence: Complete on 2026-07-06. Status, scope, overview, integration
    health, and Codex integration profile presenters now use
    `makeTrustedEnvelope` with `repository_status` or `integration_health`
    policy. Focused tests assert runtime/routing trust on normal, invalid,
    stale/degraded, and provider-unavailable paths.
  - [x] T007.1 Wired `repository_status` trust into status, scope, and overview
    presenters.
  - [x] T007.2 Wired `integration_health` trust into integration health and
    integration profile presenters.
  - [x] T007.3 Covered invalid, stale, degraded, and provider-unavailable
    resource responses.
  - [x] T007.4 Ran the focused resource and integration presenter tests.

- [x] T008 Wire trust into docs and Markdown quality presenters.
  - Depends on: T011
  - Requirements: R1, R2, R3, R4, R5, CP001, CP003, CP005, CP006
  - Files: `src/presentation/docs-presenter.ts`,
    `src/presentation/markdown-quality-presenter.ts`,
    `src/interface-adapters/mcp/registries/tools/docs-scope.ts`,
    `tests/docs/docs-presenter.test.ts`,
    `tests/docs/markdown-quality.test.ts`,
    `tests/mcp/docs-surfaces.test.ts`
  - Acceptance: Docs search, docs current, overview, map, outline, session
    scope, and Markdown quality responses distinguish routing, session state,
    static quality findings, and bounded direct section reads.
  - Evidence mode: implementation
  - Evidence: Complete on 2026-07-06. Docs overview, map, search,
    current-for-task, outline, docs session scope, docs direct-read, and
    Markdown quality surfaces now use `makeTrustedEnvelope` with the accepted
    docs, direct-read, session-scope, or Markdown policy. Focused docs tests
    assert session-state trust, direct-read trust, invalid-input trust, and
    Markdown quality trust boundaries.
  - [x] T008.1 Used `docs_routing` for docs search/current/overview/map/outline.
  - [x] T008.2 Used `docs_direct_read` with direct-read evidence for
    `docs_read_section`.
  - [x] T008.3 Used `docs_session_scope` for `docs_scope`.
  - [x] T008.4 Used `markdown_quality` for `check_markdown_document` and
    `check_markdown_set`.
  - [x] T008.5 Covered invalid-input, warning, blocked, stale, and degraded docs
    paths where fixtures already exist.

- [x] T009 Wire trust into graph, diagnostics, validation, and edit presenters.
  - Depends on: T011
  - Requirements: R1, R2, R3, R4, R5, CP001, CP002, CP003, CP005, CP006
  - Files: `src/presentation/task-context-presenter.ts`,
    `src/presentation/symbol-search-presenter.ts`,
    `src/presentation/find-references-presenter.ts`,
    `src/presentation/impact-presenter.ts`,
    `src/presentation/diagnostics-presenter.ts`,
    `src/presentation/post-edit-feedback-presenter.ts`,
    `src/presentation/verification-plan-presenter.ts`,
    `src/presentation/workspace-edit-presenter.ts`,
    `tests/mcp/context-for-task-tool.test.ts`,
    `tests/mcp/query-tools.test.ts`,
    `tests/mcp/diagnostics-for-files-tool.test.ts`,
    `tests/mcp/verification-plan-tool.test.ts`,
    `tests/mcp/workspace-edit-tools.test.ts`
  - Acceptance: Context, symbol, references, impact, diagnostics, post-edit
    feedback, verification planning, preview edit, and apply edit responses
    expose the correct trust policy and residual verification needs.
  - Evidence mode: implementation
  - Evidence: Complete on 2026-07-06. Context, symbol search, find references,
    impact, diagnostics, post-edit feedback, verification planning, preview edit,
    and apply edit presenters now use `makeTrustedEnvelope` with their accepted
    policies. Focused tests assert routing/navigation trust, planned-validation
    trust, diagnostics trust, preview-edit trust, and applied-edit policy
    separation.
  - [x] T009.1 Ensured `verification_plan` remains planned evidence unless
    explicit executed-validation evidence is added by a future approved surface.
  - [x] T009.2 Ensured preview edit and applied edit trust differ.
  - [x] T009.3 Ensured parser, heuristic, text-fallback, and confidence evidence
    do not imply whole-program impact or safe mutation.

- [x] T010 Checkpoint - presenter validation.
  - Depends on: T007, T008, T009
  - Requirements: R1, R2, R3, R4, R5, CP001, CP002, CP003, CP005, CP006
  - Files: `tests/docs/`, `tests/mcp/`, `tests/feedback/`,
    `tests/edits/`
  - Acceptance: Focused presenter and MCP tests pass; any unsupported public
    surface has a documented exclusion and traceability destination.
  - Validation: Run focused Vitest commands for changed presenter families,
    including docs, MCP query, diagnostics, verification, workspace edit, and
    integration-health tests.
  - Evidence mode: validation
  - Evidence: Complete on 2026-07-06. `pnpm typecheck` passed. Focused Phase 3
    Vitest command covering registry metadata, repo resources, integration
    resources, Codex profile, docs, context, graph query, diagnostics,
    verification plan, and workspace edit tests passed with 150 tests. Static
    search found no remaining `makeEnvelope` calls in `src/presentation` or
    `src/interface-adapters/mcp/registries`.

## Phase 4: Golden Coverage

**Purpose**: Prevent presenter changes from weakening trust semantics after
coverage is enforced.

- [x] T012 Add or update golden response tests for trust semantics.
  - Depends on: T010
  - Requirements: R3, R4, R5, CP001, CP002, CP003, CP006
  - Files: `tests/mcp/context-for-task-tool.test.ts`,
    `tests/mcp/docs-surfaces.test.ts`, `tests/mcp/query-tools.test.ts`,
    `tests/mcp/diagnostics-for-files-tool.test.ts`,
    `tests/mcp/verification-plan-tool.test.ts`,
    `tests/mcp/workspace-edit-tools.test.ts`,
    `tests/mcp/error-envelope-consistency.test.ts`,
    `tests/mcp/repo-status-resource.test.ts`,
    `tests/mcp/integration-health-resource.test.ts`
  - Acceptance: Representative golden responses assert
    `safe_to_use_for`, `not_safe_to_use_for`, and `must_verify_by` for routing,
    parser, direct-read, planned-validation, static diagnostics, edit preview,
    applied edit, runtime health, integration health, and structured error
    states.
  - Evidence mode: implementation
  - Evidence: Complete on 2026-07-06. Added
    `tests/mcp/trust-golden.test.ts` with exact `safe_to_use_for`,
    `not_safe_to_use_for`, and `must_verify_by` assertions for repository
    status, integration health, context routing, graph parser/reference routing,
    impact confidence, docs direct-read, Markdown quality, diagnostics, planned
    validation, edit preview, applied edit, invalid input, stale state, and
    environment-failure envelopes. `pnpm exec vitest run
    tests/mcp/trust-golden.test.ts` passed with 7 tests.
  - [x] T012.1 Add golden assertions for routing-only resource and context
    responses.
  - [x] T012.2 Add golden assertions for docs direct-read and Markdown quality
    responses.
  - [x] T012.3 Add golden assertions for graph parser/heuristic evidence and
    impact confidence.
  - [x] T012.4 Add golden assertions for planned validation, edit preview, and
    applied edit responses.
  - [x] T012.5 Add golden assertions for structured invalid, blocked, stale,
    degraded, warning, and error responses.

- [x] T013 Checkpoint - registry and golden validation.
  - Depends on: T011, T012
  - Requirements: R5, CP001, CP002, CP003, CP005, CP006
  - Files: `tests/mcp/`, `tests/contracts/`
  - Acceptance: Registry coverage and golden response tests pass; routing-only
    and planned-validation regressions fail when trust is overclaimed.
  - Validation: `pnpm exec vitest run tests/contracts/response-metadata.test.ts
    tests/mcp/registry-metadata.test.ts tests/mcp/error-envelope-consistency.test.ts`
    plus focused golden tests touched by T012.
  - Evidence mode: validation
  - Evidence: Complete on 2026-07-06. `pnpm typecheck` passed. `pnpm exec
    vitest run tests/contracts/response-metadata.test.ts
    tests/mcp/registry-metadata.test.ts
    tests/mcp/error-envelope-consistency.test.ts
    tests/mcp/trust-golden.test.ts` passed with 38 tests, covering shared
    policy, registry coverage, structured error envelopes, and exact golden
    trust semantics.

## Phase 5: Durable Promotion And Closure Readiness

**Purpose**: Promote accepted runtime behavior and prove the spec can close
after implementation.

- [x] T014 Promote accepted trust calibration behavior to durable docs.
  - Depends on: T013
  - Requirements: R1, R2, R3, R4, R5, CP004, CP007
  - Files: `docs/reference/runtime-contracts.md`,
    `docs/design/mcp-surface-design.md`,
    `docs/reference/documentation-map.md`, `docs/backlog/README.md`
  - Acceptance: Durable docs describe the implemented `meta.trust` contract,
    policy derivation point, covered public surfaces, exclusions, compatibility
    behavior, and EB023 status/promotion evidence.
  - Evidence mode: implementation
  - Evidence: Complete on 2026-07-06. Promoted implemented trust behavior to
    `docs/reference/runtime-contracts.md`, including optional `meta.trust`,
    vocabulary, shared derivation, evidence distinctions, failure-state
    semantics, and additive compatibility. Promoted presenter policy coverage
    and the non-framable transport exclusion to
    `docs/design/mcp-surface-design.md`, added documentation-map ownership for
    trust calibration, and updated EB023 in `docs/backlog/README.md` with
    implementation and validation evidence.
  - [x] T014.1 Update runtime contracts with schema, vocabulary, failure-state
    semantics, and additive compatibility notes.
  - [x] T014.2 Update MCP surface design with presenter derivation, covered
    surfaces, and trust policy boundaries.
  - [x] T014.3 Update documentation map if ownership routing changes.
  - [x] T014.4 Update backlog EB023 with implementation and validation
    evidence.

- [x] T015 Run full validation and implementation review.
  - Depends on: T014
  - Requirements: R1, R2, R3, R4, R5, CP001, CP002, CP003, CP004, CP005, CP006,
    CP007
  - Files: `package.json`, `tests/`, `docs/specs/035-trust-calibration-tool-outputs/`
  - Acceptance: Required validation passes or each waiver records an explicit
    residual risk; implementation review findings are fixed or routed before
    closure.
  - Validation: `pnpm typecheck`, `pnpm test`,
    `pnpm exec vitest run tests/docs/docs-links-metadata.test.ts`, spec lint,
    Markdown quality checks for changed docs, and `git diff --check`.
  - Evidence mode: validation
  - Evidence: Complete on 2026-07-06. `pnpm typecheck` passed; post-review
    full `pnpm test` passed with 78 files and 566 tests; focused
    docs/contract/MCP validation passed with 8 files and 79 tests, including
    `tests/docs/docs-links-metadata.test.ts`, `tests/mcp/trust-golden.test.ts`,
    invalid direct-read regression coverage, static profile trust coverage, and
    resource provider-failure envelope coverage.
    Spec lifecycle lint passed with 0 errors, 0 warnings, and 0 info findings;
    `git diff --check` passed. Workbench Markdown quality checked the changed
    durable/spec docs; findings were limited to pre-existing backlog table
    readability warnings outside the EB023 edited section and are waived for
    this spec with no implementation risk. Implementation review found no
    requirements, correctness-property, or durable-promotion blockers. The
    worktree contains unrelated dirty files outside this Phase 5 slice; they
    were not reviewed, staged, or modified for Spec 035.
  - [x] T015.1 Run typecheck and full Vitest suite.
  - [x] T015.2 Run spec lint, docs link/metadata tests, Markdown quality
    checks, and diff whitespace validation.
  - [x] T015.3 Perform implementation review against requirements,
    correctness properties, and durable-doc promotion targets.
  - [x] T015.4 Resolve, reject with rationale, or route every review finding.

- [>] T016 Prepare closure package and remove active spec after durable
  promotion is accepted.
  - Depends on: T015
  - Requirements: R5, CP005, CP007
  - Files: `docs/history/spec-closure-log.md`,
    `docs/history/spec-archive-index.md`,
    `docs/specs/035-trust-calibration-tool-outputs/`
  - Acceptance: Closure log and archive index preserve the implementation,
    validation, promotion, and residual-risk evidence; the active spec package
    is removed only after closure readiness passes.
  - Evidence mode: validation
  - Evidence: Routed on 2026-07-06. Durable promotion and validation are
    complete, but active spec removal requires a final spec commit hash that
    contains the complete final package. Destination: close-spec workflow after
    the Phase 5 implementation is committed. That follow-up should run closure
    check, add the closure-log/archive-index entries with the final spec commit,
    remove `docs/specs/035-trust-calibration-tool-outputs/`, and create the
    cleanup commit.
  - Destination: close Spec 035 after the final Phase 5 spec commit.
