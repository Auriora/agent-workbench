---
title: Nested project-unit validation evidence tasks
doc_type: spec
artifact_type: tasks
status: draft
owner: platform
last_reviewed: 2026-08-04
---

# Tasks

**Input**: `requirements.md`, `design.md`, `change-impact.md`, and
`verification.md` from this package.

**Implementation constraint**: Every task is planning-only with respect to a
target repository. No test or implementation task may execute target commands,
build scripts, package managers, Git commands, containers, environment probes,
or submodule operations.

## Task Dependency Graph

```text
T001 -> T002
T002 -> T003
T002 -> T004
T003 + T004 -> T005
T005 -> T006
T005 -> T007
T006 + T007 -> T008
T008 -> T009
T009 -> T010
T010 -> T011
T011 -> T012
T012 -> T013
```

## Phase 1: Contract and fixture foundation

- [x] T001 Define the additive project-unit evidence contract and create the
  bounded mixed-language fixture skeleton.
  - Depends on: none
  - Requirements: Requirement 2, Requirement 3, Requirement 4, Requirement 7, Requirement 8
  - Properties: CP-004
  - Files: `src/contracts/runtime-validation-edit-contracts.ts`, contract
    exports, `tests/contracts/validation-status-evidence.test.ts`,
    `tests/fixtures/fixture-mixed-project-units/`
  - Acceptance: The public or internal contract decision is documented in
    code and tests; unit roots, marker provenance, readiness, blockers, and
    non-executed candidates are representable; the fixture contains sibling
    `.csproj`, `pom.xml`, `Cargo.toml`, evidenced extensionless-script, unknown
    environment, broken-Git scenario, and declared-submodule evidence without
    requiring any target command execution.
  - Validation: Run the focused contract test and fixture-structure assertions.
  - Evidence mode: contract
  - Evidence: Added optional bounded project_units under contract 0.1 without changing flat planned_commands; created inert mixed-language fixture; 33 focused/runtime contract tests, pnpm typecheck, and git diff --check passed; independent findings resolved.
  - [x] T001.1 Decide and implement the smallest additive contract shape that
    preserves existing `planned_commands` compatibility.
    - Evidence: Optional bounded `project_units` was added under contract `0.1`;
      the existing flat `plannedValidationCommandSchema` remains unchanged.
  - [x] T001.2 Add contract parsing, strictness, boundedness, and
    `not_executed` tests.
    - Evidence: Focused and runtime contract suites passed 33 tests, including
      strictness, bounds, path, blocker, compatibility, and execution-state cases.
  - [x] T001.3 Create the inert mixed-language fixture structure and assert its
    evidence files without invoking anything inside it.
    - Evidence: The bounded fixture contains .NET, Maven, Cargo, evidenced
      extensionless-script, unknown-environment, broken-Git, and submodule-boundary
      evidence; catalog visibility assertions passed without target execution.

- [x] T002 Implement the bounded project-unit discovery model and deterministic
  selection primitives.
  - Depends on: T001
  - Requirements: Requirement 1, Requirement 3
  - Properties: CP-001, CP-002, CP-003
  - Files: `src/application/use-cases/project-unit-discovery.ts` or the
    architecture-approved equivalent, focused application tests
  - Acceptance: File and subtree anchors, nearest containing roots,
    explicit aggregators, ordering, caps, and unrelated-sibling isolation are
    test-driven and do not depend on filesystem enumeration order. A broad
    request with no selection reuses a coherent evidenced root unit when one
    exists; otherwise it returns bounded per-unit evidence with a
    collection-level limitation and never merges the collection into one build.
  - Validation: Run focused discovery and order-permutation tests.
  - Evidence mode: implementation
  - Evidence: Added pure bounded deterministic project-unit discovery with nearest file selection, subtree intersection, explicit aggregators, broad-request coherent-root/collection behavior, caps, and path safety; 7 focused tests, pnpm typecheck, and git diff --check passed.

## Phase 2: Marker and readiness evidence

- [x] T003 Implement explicit manifest and extensionless-script recognizers.
  - Depends on: T002
  - Requirements: Requirement 2
  - Properties: CP-001, CP-004
  - Files: `src/application/use-cases/project-unit-markers.ts` or equivalent,
    focused recognizer tests
  - Acceptance: `.csproj`, `pom.xml`, and `Cargo.toml` retain marker
    provenance; extensionless scripts require positive guidance that names the
    path and validation purpose; executable bit, basename, or shebang alone are
    rejected; unreadable/oversized/conflicting evidence is structured and
    bounded.
  - Validation: Run positive and negative recognizer tests.
  - Evidence mode: implementation
  - Evidence: Added explicit bounded manifest and positively evidenced extensionless-script recognition with deterministic limitations; 9 recognizer tests passed within the 33-test T002-T004 focused set, pnpm typecheck and git diff --check passed.

- [x] T004 Implement per-unit dependency and environment readiness.
  - Depends on: T002
  - Requirements: Requirement 4, Requirement 8
  - Properties: CP-004
  - Files: `src/application/use-cases/validation-environment.ts`, project-unit
    discovery/planning helpers, focused readiness tests
  - Acceptance: Unknown or conflicting prerequisites produce unit-specific
    blockers with bounded evidence and no generic host command, installation,
    retry, alternate tool, or environment probe. A safe known read-only action
    uses the canonical `NextAction` shape and is projected to
    top-level `next_actions` with the unit named in its reason.
  - Validation: Run ready, blocked, and mixed-unit readiness tests.
  - Evidence mode: implementation
  - Evidence: Added pure per-unit readiness assessment and canonical blocker next-action projection; ready, blocked, limited, and mixed-unit cases passed with existing validation protocol coverage (17 tests total), pnpm typecheck passed.

- [x] T005 Checkpoint - Validate project-unit foundation.
  - Depends on: T003, T004
  - Requirements: Requirement 1, Requirement 2, Requirement 3, Requirement 4,
    Requirement 7, Requirement 8
  - Files: implementation and focused test files from T001-T004,
    `verification.md`
  - Acceptance: Contract, fixture, discovery, marker, readiness, locality,
    isolation, determinism, and non-execution evidence is recorded before Git
    and planner integration begins.
  - Validation: Run the focused T001-T004 test set and `pnpm typecheck`.
  - Evidence mode: validation
  - Evidence: Foundation checkpoint passed: project-unit contract, discovery, marker recognition, readiness, locality/isolation/determinism/non-execution tests passed (4 files, 33 tests); pnpm typecheck and git diff --check passed.

## Phase 3: Repository claim and boundary handling

- [x] T006 Separate readable-source evidence from unavailable Git claims.
  - Depends on: T005
  - Requirements: Requirement 5
  - Properties: CP-005
  - Files: repository-status/workspace port or adapter selected by design,
    planner use case, workspace/repository tests
  - Acceptance: Missing, malformed, or unresolved Git metadata preserves
    bounded source/unit discovery while blocking cleanliness,
    unchanged-worktree, diff-completeness, and before/after claims; no Git CLI
    or shell fallback is introduced.
  - Validation: Run broken-`HEAD`, missing-metadata, and readable-source tests.
  - Evidence mode: implementation
  - Evidence: Added bounded workspace-only HEAD/ref inspection and claim-specific git_claim_unavailable projection that retains readable source markers and planned commands; five HEAD-state tests passed without Git CLI or writes.

- [x] T007 Add Git submodule and embedded-repository boundary awareness.
  - Depends on: T005
  - Requirements: Requirement 6, Requirement 8
  - Properties: CP-004, CP-006
  - Files: project-unit boundary helper, existing safe config/workspace ports,
    fixture and focused boundary tests
  - Acceptance: Bounded `.gitmodules` path evidence creates a boundary;
    uninitialized, initialized, and incomplete boundaries are reported without
    traversal; URLs are not emitted or followed; no initialization, fetch,
    clone, Git command, cross-boundary candidate, or combined cleanliness claim
    occurs. Initialized boundaries state that recursive handling is unavailable;
    they do not emit a fictional runtime action for a future capability.
  - Validation: Run declared, unavailable, initialized, and incomplete-boundary
    tests with process/network/write spies.
  - Evidence mode: implementation
  - Evidence: `tests/application/project-unit-boundaries.test.ts` passed four
    declared, initialized, metadata-gap, malformed, and oversized boundary cases;
    `pnpm typecheck` and `git diff --check` passed, with no Git/process/network
    or write operation introduced.

## Phase 4: Planner and MCP integration

- [x] T008 Integrate unit-scoped planning and compatibility projection.
  - Depends on: T006, T007
  - Requirements: Requirement 1, Requirement 2, Requirement 3, Requirement 4,
    Requirement 5, Requirement 6, Requirement 8
  - Properties: CP-001-CP-006
  - Files: `src/application/use-cases/plan-verification.ts`,
    `src/application/use-cases/validation-ecosystems.ts`, related validation
    helpers, presenter and contract files as required
  - Acceptance: Ecosystem producers receive only unit-local evidence; no
    first-project or sibling fallback remains for the selected-unit path;
    structured units preserve readiness/blockers; the flat command list is a
    stable projection of ready selected units; aggregate status remains blocked
    when a requested unit is blocked; safe blocker actions are deduplicated into
    top-level `next_actions` with unit-specific reasons; every command remains
    `not_executed`.
  - Validation: Run planner rules, contract, presenter, and TypeScript checks.
  - Evidence mode: implementation
  - Evidence: Integrated selected-scope marker discovery, unit-local command planning, readiness, Git-claim separation, boundary confinement, stable flat projection, blocker actions, and presenter preservation; focused planner/contract/application suite passed 108 tests, typecheck and diff check passed.

- [x] T009 Prove mixed-language behavior through application and MCP goldens.
  - Depends on: T008
  - Requirements: Requirement 1, Requirement 2, Requirement 3, Requirement 4,
    Requirement 5, Requirement 6, Requirement 7, Requirement 8
  - Properties: CP-001-CP-006
  - Files: `tests/application/validation-planner-rules.test.ts`,
    `tests/mcp/verification-plan-tool.test.ts`, mixed-language fixture, related
    snapshots or goldens
  - Acceptance: File and subtree selection isolate .NET, Maven, Cargo, and
    evidenced-script units; unrelated siblings do not change results; unknown
    environments block without invented commands; broken Git preserves source
    evidence but blocks cleanliness; submodule paths do not traverse; catalog
    permutations are deterministic; a no-selection request proves coherent-root
    reuse or a bounded collection limitation without synthetic aggregation;
    blocker actions stay unit-specific; no target operation is called.
  - Validation: Run focused application and MCP suites twice with alternate
    catalog ordering where the test harness supports it.
  - Evidence mode: validation
  - Evidence: Mixed fixture proves .NET, Maven, Cargo, evidenced-script and declared-boundary unit isolation, unknown environment blocking, Git-claim separation, broad collection limitation, presenter preservation, deterministic pure discovery permutations, and not_executed commands; 8 files and 108 tests passed.

## Phase 5: Review, validation, promotion, and closure readiness

- [x] T010 Resolve independent implementation-review findings.
  - Depends on: T009
  - Requirements: Requirement 1, Requirement 2, Requirement 3, Requirement 4,
    Requirement 5, Requirement 6, Requirement 7, Requirement 8
  - Files: all task-owned source, tests, fixture, contracts, and presenter files
  - Acceptance: Findings are fixed, rejected with evidence-backed rationale, or
    routed to one explicit destination; no blocking correctness, safety,
    compatibility, or test-coverage finding remains.
  - Validation: Rerun focused tests affected by review fixes.
  - Evidence mode: validation
  - Evidence: Independent re-review found no remaining blocker. Both warnings were resolved: unit-specific blocked plans no longer emit the generic no-command/context fallback, and verification/count records were synchronized. The affected 4-file suite passed 83 tests; typecheck and diff check passed.

- [x] T011 Run full repository and packaging validation.
  - Depends on: T010
  - Requirements: Requirement 1, Requirement 2, Requirement 3, Requirement 4,
    Requirement 5, Requirement 6, Requirement 7, Requirement 8
  - Properties: CP-001-CP-006
  - Files: all task-owned source, tests, fixture, contracts, presenters, and
    package integration files
  - Acceptance: Focused tests, `pnpm typecheck`, `pnpm test`, plugin validation,
    skills validation, package dry-run, and `git diff --check` pass or an exact
    blocking root cause is recorded; no target-repository command or fallback
    execution was performed.
  - Validation: Run every required command in `verification.md` and record exact
    results.
  - Evidence mode: validation
  - Evidence: Full repository and packaging validation passed: pnpm test ran 116 files and 1,288 tests; typecheck passed; plugin validation passed; skills validation checked 6 files with 0 findings; package dry-run contained 264 entries; git diff --check passed. No target-repository or fixture command was executed.

- [x] T012 Promote accepted behavior and route full submodule support.
  - Depends on: T011
  - Requirements: Requirement 1, Requirement 2, Requirement 3, Requirement 4,
    Requirement 5, Requirement 6, Requirement 7, Requirement 8
  - Files: `docs/backlog/README.md`,
    `docs/design/edit-and-validation-loop-design.md`,
    `docs/reference/runtime-contracts.md`,
    `docs/reference/language-capability-matrix.md`, and security docs only if
    implementation impact requires them
  - Acceptance: Durable docs describe current delivered behavior, contract
    fields, planning-only trust boundaries, and unchanged semantic support;
    full submodule initialization/traversal/cross-repository planning has one
    explicit backlog destination with acceptance boundaries.
  - Validation: Check the explicit Markdown set and run docs tests.
  - Evidence mode: implementation
  - Follow-up: Full submodule initialization, traversal, and cross-repository
    validation planning.
  - Destination: existing `docs/specs/058-git-submodule-repository-support/`
    package, linked from `docs/backlog/README.md` EB004.
  - Evidence: Durable promotion completed across EB004, validation-loop design, runtime contracts, language capability matrix, and threat model. Existing Spec 058 is the single full-submodule destination. Focused docs tests passed 10 tests, diff check passed; Markdown set findings were pre-existing table-readability advisories.
  - [x] T012.1 Promote the implemented validation behavior and exact public
    contract to their canonical owners.
    - Evidence: Updated `docs/backlog/README.md`,
      `docs/design/edit-and-validation-loop-design.md`,
      `docs/reference/runtime-contracts.md`, and
      `docs/reference/language-capability-matrix.md`; focused docs validation
      passed 10 tests.
    - Evidence mode: implementation
  - [x] T012.2 Add one backlog item for full submodule repository-boundary
    planning, covering explicit authority, identity, recursion, remote and
    credential rules, per-repository policy, and cleanliness claims.
    - Evidence: EB004 now links the existing
      `docs/specs/058-git-submodule-repository-support/requirements.md` package;
      repository search confirms no second follow-up item was added.
    - Evidence mode: implementation
  - [x] T012.3 Review the threat model and either update it or record why its
    existing untrusted-script and repository-boundary coverage is sufficient.
    - Evidence: Updated `docs/security/threat-model.md` with the validation
      script and repository-boundary confusion threat; focused docs validation
      passed 10 tests.
    - Evidence mode: implementation
- [x] T013 Reconcile scope and prepare closure evidence.
  - Depends on: T012
  - Requirements: Requirement 1, Requirement 2, Requirement 3, Requirement 4,
    Requirement 5, Requirement 6, Requirement 7, Requirement 8
  - Properties: CP-001-CP-006
  - Files: this spec package, promoted durable docs, and closure log/index files
    selected by lifecycle tooling
  - Acceptance: Every must-have criterion, correctness property, broad design
    target, review finding, and residual has an evidence-backed closure
    disposition; full submodule support has exactly one durable destination;
    promotion evidence is current after T011; lifecycle closure checks identify
    no unresolved blocker.
  - Validation: Run lifecycle coverage, evidence-quality, closure-risk, and
    package lint checks; record cleanup and closure decisions without closing
    until separately authorized.
  - Evidence mode: validation
  - Evidence: Lifecycle reconciliation completed: task audit has 0 errors/warnings; evidence quality records 30 concrete task/verification records before this completion update; package lint has only the previously waived non-blocking canonical-context advisory; all D001-D003 decisions are resolved; full submodule support has exactly one destination in Spec 058; docs tests passed 10 tests and diff check passed.

## Execution Rules

- Before starting a task, use lifecycle task context and read its linked
  requirements, design sections, change impact, verification gates, and
  traceability row.
- Mark one selected task `[~]` before implementation. Do not mark a parent task
  complete until its acceptance, validation, and evidence fields are satisfied.
- Keep the MCP adapter thin and preserve layered architecture.
- Do not add parser, semantic, validation, shell, Git, environment, or command
  execution fallbacks.
- Treat structured blocked output as a required result, not as a reason to
  return partial success or a generic command.
- Preserve unrelated worktree changes and do not commit generated `.cache/`
  content or target-repository artifacts.
- Full Git submodule support is not an optional branch of T007. Route it to the
  durable follow-up created in T012.
