---
title: Nested project-unit validation evidence design
doc_type: spec
artifact_type: design
status: draft
owner: platform
last_reviewed: 2026-08-04
---

# Technical Design

## Overview

Introduce a bounded project-unit discovery stage between catalog collection and
validation candidate planning. Discovery starts from the caller's normalized
selected files or subtree, identifies containing unit markers, ranks the
nearest applicable unit, and passes each admitted unit to ecosystem-specific
candidate producers. This replaces repository-wide ecosystem mixing with
per-unit evidence while preserving existing command-safety and non-execution
contracts.

The initial marker recognizers cover `.csproj`, `pom.xml`, `Cargo.toml`, and
extensionless scripts admitted only by positive repository guidance. A small
internal unit model carries the root, marker provenance, selection relationship,
boundary state, environment readiness, candidates, and blockers. The public
verification plan gains a bounded optional project-unit projection; the
existing flat `planned_commands` list remains a deterministic compatibility
projection and all commands remain `not_executed`.

Git repository health is treated as a claim-specific evidence source rather
than a prerequisite for reading source. Broken Git metadata therefore blocks
cleanliness and diff-completeness claims, not catalog-based unit discovery.
Declared submodules are boundary evidence only in this slice. Their URLs are
never followed and their repositories are never initialized or traversed.

## Requirement Coverage

| Requirement | Acceptance Criteria | Design Coverage | Validation Approach |
|-------------|---------------------|-----------------|---------------------|
| Requirement 1 Selected-scope discovery | AC1-AC5 | Selection anchors, unit ranking, deterministic caps | Unit-selection fixture and order-permutation tests |
| Requirement 2 Evidence-backed markers | AC1-AC5 | Explicit marker recognizers and script admission policy | Recognizer contract tests and negative script cases |
| Requirement 3 Per-unit candidates | AC1-AC5 | Unit-scoped candidate producers and public projection | Mixed-language golden plan and compatibility tests |
| Requirement 4 Structured blocking | AC1-AC4 | Unit readiness and blocker model | Unknown dependency/environment fixture tests |
| Requirement 5 Broken Git metadata | AC1-AC4 | Claim-separation policy | Broken-HEAD adapter fixture and golden caveats |
| Requirement 6 Submodule awareness | AC1-AC5 | Repository-boundary catalog and traversal guard | Declared, unavailable, initialized, and incomplete-boundary cases |
| Requirement 7 Regression fixture | AC1-AC5 | Bounded polyglot example collection | MCP and application-layer golden tests |
| Requirement 8 Planning-only boundary | AC1-AC4 | Read/stat-only ports and no process/network adapter | Port-spy and command execution-state assertions |

## Correctness Property Coverage

| Property | Design Behavior | Validation Direction | Notes |
|----------|-----------------|----------------------|-------|
| CP-001 Unit locality | Candidate producers receive one unit-scoped evidence view | Assert every evidence path is local or an admitted aggregator | Boundary paths are never candidate evidence. |
| CP-002 Selection isolation | Selection precedes ecosystem planning | Add unrelated sibling units and compare selected plan | Compare normalized structured output. |
| CP-003 Determinism | Normalize, deduplicate, then sort roots, markers, candidates, and blockers | Property-style permutation test using existing Vitest | No new property-test dependency. |
| CP-004 Non-execution | Discovery depends only on catalog/status/workspace read ports | Spies fail on process, network, or write calls | Planned command objects are data only. |
| CP-005 Claim separation | Git health is recorded independently from source evidence | Broken Git fixture preserves units but blocks claim states | Do not downgrade all source evidence. |
| CP-006 Boundary confinement | Boundary catalog filters candidate evidence before recognizers run | Submodule and embedded-repository fixtures | No boundary-crossing fallback. |

## High-Level Design

### System Architecture

```text
request files/subtree
        |
        v
bounded file catalog ---- repository-boundary evidence
        |                           |
        +------> selection anchors <-+
                         |
                         v
              project-unit discovery
              - explicit markers
              - evidenced scripts
              - nearest containing unit
                         |
                         v
              per-unit readiness check
              - policy/environment/dependencies
              - Git claim availability
                         |
                         v
              per-unit candidate planning
                         |
                         v
        structured units + compatible flat command projection
```

The MCP registry continues to validate inputs and present results. It does not
discover manifests, inspect Git, or execute commands. The application use case
coordinates discovery and planning. Pure ranking, admission, and boundary
rules live in domain policies or application-local pure helpers. Filesystem and
repository evidence enter through ports.

### Components and Changes

- `src/application/use-cases/project-unit-discovery.ts`:
  Discover and rank project units from bounded catalog entries, selected scope,
  explicit marker recognizers, script evidence, and repository boundaries.
- `src/application/use-cases/project-unit-markers.ts`:
  Recognize the initial manifest kinds and parse only the bounded metadata
  necessary to identify unit type and validation evidence.
- `src/application/use-cases/plan-verification.ts`:
  Coordinate project-unit discovery before ecosystem planning, retain
  unit-specific blockers, and create the compatibility command projection.
- `src/application/use-cases/validation-ecosystems.ts` and related helpers:
  Accept a unit-scoped evidence view. Producers may no longer select the first
  project or borrow sibling evidence.
- Repository evidence boundary:
  Consume existing repository-status or bounded workspace evidence where
  available. Add a narrow port only if current ports cannot distinguish Git
  claim availability without invoking a command from the planner.
- `src/contracts/runtime-validation-edit-contracts.ts` and presenter:
  Add optional bounded structured project-unit evidence while retaining the
  existing flat planned-command shape for compatibility.
- `tests/fixtures/fixture-mixed-project-units/`:
  Model a large example collection with sibling .NET, Maven, Rust, and
  positively evidenced extensionless-script units, unrelated languages,
  unknown environment evidence, broken Git metadata scenarios, and a declared
  submodule boundary.

### Data Models

The exact names may be refined during T001 contract-first work, but the
semantics are fixed:

```text
ProjectUnitEvidence
  root: repo-relative directory
  kind: dotnet | maven | cargo | repository_script
  markers: one or more marker paths and evidence kinds
  selection: containing | intersects_subtree | explicit_aggregator
  boundary: same_repository | declared_submodule | repository_boundary_unknown
  readiness: ready | blocked | limited
  blockers: bounded structured blocker list
  planned_commands: non-executed candidates local to this unit

ProjectUnitBlocker
  kind: dependency_unknown | environment_unknown | marker_unreadable |
        marker_conflict | git_claim_unavailable | submodule_unavailable |
        repository_boundary_unknown | unsupported_unit
  unit_root: repo-relative directory
  evidence_paths: bounded repo-relative paths
  message: redacted bounded explanation
  blocked_claims: validation_candidate | worktree_cleanliness |
                  diff_completeness | repository_traversal
  next_action: optional existing NextAction for a safe callable read-only step
```

`git_claim_unavailable` can coexist with `readiness: ready` for source-backed
planning when only cleanliness claims are blocked. A unit is `blocked` for
validation candidate purposes only when its dependency, environment, marker,
or repository boundary evidence is insufficient. This avoids turning a broken
`HEAD` into a false loss of readable source evidence.

Blocker-local `next_action` uses the canonical existing `NextAction` shape and
is optional. Presentation deduplicates those actions into the existing
top-level `VerificationPlan.next_actions` array; each projected reason names
the affected unit. A missing safe callable action remains an explicit blocker,
not an invitation to invent a tool. Submodule traversal has no runtime next
action in this slice because the capability does not exist; its product
follow-up is the durable backlog route required before closure.

### Data Flow

1. Normalize selected files and directory-like scope without shell expansion.
2. Scan within existing catalog bounds and merge only safe direct evidence.
3. Build a boundary catalog before unit discovery. Parse `.gitmodules` as
   bounded local configuration; do not resolve URLs or touch declared paths.
4. Find explicit markers and positively admitted extensionless script markers.
5. Associate selected paths with containing or intersecting units. Prefer the
   deepest containing root; admit an ancestor aggregator only with explicit
   evidence naming the relationship.
6. Remove or block units and evidence that cross a repository boundary.
7. Evaluate dependency and environment evidence separately for each unit.
8. Invoke ecosystem planners with only that unit's evidence view.
9. Apply command-safety policy to each candidate and force
   `execution: not_executed`.
10. Present bounded structured unit evidence, blockers, and a stable flat
    command projection. Never claim full readiness if any requested unit is
    blocked.

## Low-Level Design

### Algorithms and Logic

```text
function discoverProjectUnits(files, selectedScope, boundaries, guidance):
    markers = recognizeExplicitMarkers(files)
    scripts = admitScripts(files, guidance)
    candidates = groupMarkersByRoot(markers + scripts)

    for each candidate in deterministicRootOrder(candidates):
        if crossesBoundary(candidate, boundaries):
            emit boundary blocker
            continue
        relation = relationToSelectedScope(candidate.root, selectedScope)
        if relation is unrelated:
            continue
        emit unit(candidate, relation)

    units = preferNearestContainingUnits(units)
    units += explicitlyEvidencedAggregators(units, guidance)
    return boundedDeterministic(units)
```

For file selection, a unit contains the file when the file equals its marker or
is below its root. For subtree selection, a unit is relevant when its root
contains the subtree or is contained by it. Broad requests do not automatically
select every nested unit: they use a coherent root unit when present, otherwise
return bounded per-unit evidence with an explicit collection-level limitation.

Extensionless script admission uses an allow-by-evidence rule. Evidence must
name the repo-relative script and identify a validation/build purpose in an
explicit durable repository instruction or configured validation protocol.
Permission bits,
basename, shebang, lexical task text, and source language are insufficient.

### Function Signatures and Interfaces

```text
discoverProjectUnits(input: {
  files: readonly FileCatalogEntry[]
  selected_paths: readonly string[]
  boundaries: readonly RepositoryBoundaryEvidence[]
  script_guidance: readonly ValidationGuidanceEvidence[]
  limits: ProjectUnitDiscoveryLimits
}): ProjectUnitDiscoveryResult

planUnitValidation(input: {
  unit: ProjectUnitEvidence
  files: readonly FileCatalogEntry[]
  protocol: ValidationProtocolDiscovery
  max_commands: number
}): ProjectUnitPlan
```

The public `VerificationPlan` gains an optional `project_units` array. Each
entry exposes bounded root, kind, marker evidence, readiness, blockers, and
non-executed candidates. Existing `planned_commands` remains populated from
ready unit candidates in unit order so existing clients continue to work. A
contract version change is required only if additive optional fields cannot be
represented under the existing compatibility policy; T001 must decide this
against current runtime-contract rules before implementation.

### Error Handling

- Unsafe or missing selected paths keep their existing top-level blockers.
- Unreadable or malformed marker/config evidence becomes a unit-specific
  limitation or blocker; it is not silently skipped when decision-relevant.
- Unknown dependencies or execution environments block command production for
  that unit. A safe known read-only follow-up is projected through the existing
  top-level `next_actions` contract with unit identity in its reason. Ready
  siblings remain visible, but the aggregate status is `blocked` for the
  requested multi-unit scope.
- Broken Git metadata yields claim-specific `git_claim_unavailable` evidence.
  It does not cancel bounded source reads or project-unit discovery.
- Truncation reports its count basis and can block completeness claims. It does
  not authorize partial success or a broader retry.
- No error path installs tooling, invokes Git, runs a script, retries with a
  different mechanism, or emits a guessed generic command.

### Security, Trust, and Access

All marker paths and selected paths remain normalized repo-relative paths.
Manifest and guidance reads use size limits and existing workspace safety
classification. Extensionless scripts are untrusted data and are never loaded
as modules or executed. `.gitmodules` URLs are treated as sensitive,
non-decision-relevant values: the parser needs bounded path declarations only,
and public output must not echo URLs.

Repository boundaries prevent implicit expansion of the user's authority.
Discovery does not initialize submodules, traverse initialized submodule
contents, read outside the selected checkout, contact remotes, or combine
independent Git states. Full submodule support needs a separate design covering
explicit caller scope, repository identity, per-repository policy, cleanliness,
network and credential boundaries, recursion and cycle limits, and validation
presentation.

### Migration and Compatibility

The feature is additive at the public contract boundary. Current callers can
continue reading `planned_commands`; new callers can use `project_units` for
provenance and partial readiness. The flat projection must never reintroduce
sibling evidence: it contains only candidates present in selected ready units.
No stored graph schema migration is planned. Fixtures and goldens will be
updated deliberately rather than accepting broad snapshot churn.

### Slice Boundary And Residual Architecture

| Design target | In this slice | Out of this slice | Follow-up destination | Blocks closure? |
|---------------|---------------|-------------------|-----------------------|-----------------|
| Nested project-unit planning | Selected-scope discovery, initial markers, per-unit candidates and blockers | Every ecosystem and build-system marker | EB004 future focused promotions | no |
| Extensionless scripts | Positive repository-guidance admission and non-executed candidate data | Arbitrary executable/script inference and execution | EB004 | no |
| Broken Git metadata | Preserve source evidence; block cleanliness/diff claims | Git repair, CLI fallback, history reconstruction | EB003/EB008 as applicable | no |
| Git submodules | Detect declared/unknown boundaries and block traversal | Initialization, recursion, remote access, cross-repo planning and combined cleanliness | New backlog item for Git submodule repository-boundary planning | no, if routed before closure |
| Public plan provenance | Additive unit evidence plus compatible flat projection | Command execution or automated fallback | Explicitly out of scope | no |
| Language semantics | No capability-level change | Java, Rust, or C# semantic promotion | EB010/EB014 language promotions | no |

## Validation Strategy

| Validation | Covers | Evidence Location | Residual Risk |
|------------|--------|-------------------|---------------|
| Contract/schema tests | Requirement 3, Requirement 4, compatibility | `tests/contracts/validation-status-evidence.test.ts` and MCP contract tests | Older clients ignore optional unit evidence. |
| Pure discovery/ranking tests | Requirement 1, Requirement 2, CP-001 to CP-003 | New application or domain test file | Marker ecosystem remains intentionally limited. |
| Mixed-language fixture golden tests | Requirement 1, Requirement 2, Requirement 3, Requirement 4, Requirement 5, Requirement 6, Requirement 7 | `tests/fixtures/fixture-mixed-project-units/`, planner/MCP tests | Synthetic fixture cannot prove every real build convention. |
| Port-spy non-execution tests | Requirement 6, Requirement 8, CP-004, CP-006 | Application tests | Does not execute target repositories by design. |
| Broken Git claim tests | Requirement 5, CP-005 | Workspace/repository adapter and MCP golden tests | Filesystem damage beyond readable source remains blocked. |
| Existing targeted and full suite | Regression safety | `verification.md` and task evidence | Native dependencies must be built normally. |

## Downstream Task Guidance

- Required checkpoints before implementation: settle the additive public
  contract, confirm the existing repository-status seam or define one narrow
  read-only port, and record the new submodule follow-up backlog destination.
- Properties or acceptance criteria that need explicit task coverage: all six
  correctness properties, negative extensionless-script cases, mixed ready and
  blocked units, the broad no-selection request, broken `HEAD`, and no boundary
  traversal.
- Optional artifacts needed before implementation: none.
- Downstream review needed if this design changes after tasks are drafted:
  contracts, workspace safety, or architecture review.

## Operational Considerations

No rollout mode, feature flag, target command runner, or migration is expected.
Bound unit count, marker count, evidence reads, blockers, and commands using
existing response-budget mechanisms. Telemetry may record counts and blocker
kinds, but never script content, submodule URLs, or paths outside the checkout.
Any measurable regression in planner latency or payload size blocks closure
until bounded or explicitly routed.

## Open Questions

- None blocking design. T001 must choose the smallest additive public contract
  shape consistent with current compatibility rules.
- Full Git submodule support is intentionally a separate backlog/spec decision,
  not an implementation option inside Spec 057.

## Related Artifacts

- Requirements: `requirements.md`
- Change Impact: `change-impact.md`
- Tasks: `tasks.md`
- Verification: `verification.md`
