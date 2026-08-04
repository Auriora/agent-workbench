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

- [ ] T001 Define the additive project-unit evidence contract and create the
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
  - Evidence: Pending.
  - [ ] T001.1 Decide and implement the smallest additive contract shape that
    preserves existing `planned_commands` compatibility.
  - [ ] T001.2 Add contract parsing, strictness, boundedness, and
    `not_executed` tests.
  - [ ] T001.3 Create the inert mixed-language fixture structure and assert its
    evidence files without invoking anything inside it.

- [ ] T002 Implement the bounded project-unit discovery model and deterministic
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
  - Evidence: Pending.

## Phase 2: Marker and readiness evidence

- [ ] T003 Implement explicit manifest and extensionless-script recognizers.
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
  - Evidence: Pending.

- [ ] T004 Implement per-unit dependency and environment readiness.
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
  - Evidence: Pending.

- [ ] T005 Checkpoint - Validate project-unit foundation.
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
  - Evidence: Pending.

## Phase 3: Repository claim and boundary handling

- [ ] T006 Separate readable-source evidence from unavailable Git claims.
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
  - Evidence: Pending.

- [ ] T007 Add Git submodule and embedded-repository boundary awareness.
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
  - Evidence: Pending.

## Phase 4: Planner and MCP integration

- [ ] T008 Integrate unit-scoped planning and compatibility projection.
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
  - Evidence: Pending.

- [ ] T009 Prove mixed-language behavior through application and MCP goldens.
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
  - Evidence: Pending.

## Phase 5: Review, validation, promotion, and closure readiness

- [ ] T010 Resolve independent implementation-review findings.
  - Depends on: T009
  - Requirements: Requirement 1, Requirement 2, Requirement 3, Requirement 4,
    Requirement 5, Requirement 6, Requirement 7, Requirement 8
  - Files: all task-owned source, tests, fixture, contracts, and presenter files
  - Acceptance: Findings are fixed, rejected with evidence-backed rationale, or
    routed to one explicit destination; no blocking correctness, safety,
    compatibility, or test-coverage finding remains.
  - Validation: Rerun focused tests affected by review fixes.
  - Evidence mode: validation
  - Evidence: Pending.

- [ ] T011 Run full repository and packaging validation.
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
  - Evidence: Pending.

- [ ] T012 Promote accepted behavior and route full submodule support.
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
  - Destination: `docs/backlog/README.md` new focused item.
  - Evidence: Pending.
  - [ ] T012.1 Promote the implemented validation behavior and exact public
    contract to their canonical owners.
  - [ ] T012.2 Add one backlog item for full submodule repository-boundary
    planning, covering explicit authority, identity, recursion, remote and
    credential rules, per-repository policy, and cleanliness claims.
  - [ ] T012.3 Review the threat model and either update it or record why its
    existing untrusted-script and repository-boundary coverage is sufficient.

- [ ] T013 Reconcile scope and prepare closure evidence.
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
  - Evidence: Pending.

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
