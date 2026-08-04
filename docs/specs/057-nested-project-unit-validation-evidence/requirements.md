---
title: Nested project-unit validation evidence requirements
doc_type: spec
artifact_type: requirements
status: draft
owner: platform
last_reviewed: 2026-08-04
---

# Requirements

## Introduction

Agent Workbench currently discovers validation evidence across an entire
checkout. In large example collections and polyglot repositories, this can
combine unrelated ecosystems into one apparent build or select a project that
is unrelated to the requested file. This spec defines planning-only discovery
of bounded project units around the caller's requested file or subtree.

The first slice recognizes `.csproj`, `pom.xml`, `Cargo.toml`, and positively
evidenced extensionless build scripts. It preserves useful source evidence when
Git metadata is broken, while withholding worktree-cleanliness claims. Git
submodules are recognized as repository boundaries, but active submodule
initialization, traversal, and cross-repository planning are not part of this
spec.

## Goals

- Discover the project units most relevant to explicitly selected files or a
  selected subtree.
- Produce validation candidates per project unit instead of treating every
  ecosystem in a large collection as one build.
- Recognize the initial manifest set and extensionless build scripts only from
  bounded, positive repository evidence.
- Return structured blocked evidence when dependencies, execution environments,
  repository boundaries, or cleanliness claims cannot be established.
- Keep all output planning-only: no target command, build script, Git command,
  package manager, or environment is executed.
- Make project-unit recognition extensible without adding a generic fallback
  that guesses commands from file extensions.

## Non-Goals

- Executing planned validation commands or extensionless scripts.
- Inventing commands when a project unit has no repository-backed validation
  evidence.
- Treating all languages or manifests in a repository as one validation unit.
- Initializing, updating, fetching, cloning, or recursively traversing Git
  submodules.
- Following `.gitmodules` URLs or reading repositories outside the selected
  checkout.
- Combining parent-repository and submodule validation or cleanliness into one
  success claim.
- Adding Java, Rust, or C# semantic extraction; this spec concerns validation
  evidence and routing only.
- Adding a fallback parser, language toolchain, shell probe, or Git CLI route.

## Glossary

| Term | Definition |
|------|------------|
| Project unit | A bounded subtree with repository evidence that it is independently buildable or testable. |
| Selected scope | The normalized repo-relative files or subtree explicitly supplied by the caller. |
| Unit marker | A recognized manifest or positively evidenced build script associated with a project-unit root. |
| Candidate | A non-executed validation proposal whose reason and project-unit provenance are explicit. |
| Repository boundary | A path that belongs to a different Git repository, including a declared submodule. |
| Cleanliness claim | A statement that the worktree is clean, unchanged, or safely comparable through Git metadata. |

## Durable Source Baseline

| Source | Current behavior relied on | Confidence | Notes |
|--------|----------------------------|------------|-------|
| `docs/backlog/README.md` | EB004 requires repository-backed, policy-aware validation planning and structured blocked or low-confidence plans. | high | This spec is a focused EB004 promotion. |
| `docs/reference/runtime-contracts.md` | Validation status and plan output distinguish planned, blocked, and executed evidence. | high | Public contract changes must remain canonical here after implementation. |
| `docs/design/language-adapter-design.md` | Language and ecosystem support levels are separate from semantic proof. | high | Project-unit routing must not promote semantic capability labels. |
| `docs/design/layered-runtime-architecture.md` | Use cases coordinate ports and domain policies; transport adapters remain thin. | high | Discovery and selection belong below the MCP adapter. |
| `src/application/use-cases/plan-verification.ts` | The current implementation scans the checkout and plans commands from aggregate repository evidence. | high | Direct source evidence; several ecosystems still rely on root or first-match selection. |

## Durable Impact

| Durable area | Action | Target | Notes |
|--------------|--------|--------|-------|
| requirements | modify | `docs/backlog/README.md` | Promote the accepted nested-project-unit behavior under EB004 and route full submodule support separately. |
| design | modify | `docs/design/edit-and-validation-loop-design.md` | Describe selected-scope project-unit discovery and structured blocking. |
| API/contract | modify if required | `docs/reference/runtime-contracts.md` | Document any new public unit provenance or blocker fields; do not duplicate enums. |
| reference | clarify | `docs/reference/language-capability-matrix.md` | State that validation routing does not change semantic capability levels. |
| security | clarify if required | `docs/security/threat-model.md` | Record untrusted build scripts and cross-repository boundary handling if the implementation changes the existing trust model. |

## Staged Readiness

- **Current stage:** implementation planning complete
- **Next stage:** implementation task T001
- **Ready to implement when:** lifecycle lint, acceptance-criterion
  traceability, downstream artifact freshness, and independent spec review have
  no unresolved blockers.
- **Design-first exception:** no
- **Optional artifacts recommended:** `change-impact.md`
- **Downstream review needed:** design, tasks, traceability, verification

## Requirements

### Requirement 1: Selected-scope project-unit discovery

**User Story:** As a coding agent, I want validation evidence scoped to the
project containing my requested file or subtree, so that unrelated examples do
not distort the plan.

**Priority:** must-have

#### Acceptance Criteria

1. GIVEN one or more selected repo-relative files, WHEN project units are
   discovered, THEN THE SYSTEM SHALL associate each selected file with the
   nearest containing recognized project unit using deterministic path rules.
2. GIVEN a selected repo-relative directory or a request whose selected files
   span multiple units, WHEN discovery runs, THEN THE SYSTEM SHALL return only
   units intersecting that selected scope, subject to explicit bounded limits.
3. GIVEN nested and ancestor project markers, WHEN both contain a selected
   path, THEN THE SYSTEM SHALL prefer the nearest nested unit unless explicit
   repository evidence declares an ancestor aggregator for that unit.
4. GIVEN no selected files or subtree, WHEN discovery runs, THEN THE SYSTEM
   SHALL preserve the existing broad-request behavior only where repository
   evidence identifies a coherent root unit; it SHALL NOT merge unrelated
   nested units into one build.
5. THE SYSTEM SHALL order units and candidates deterministically independent of
   filesystem enumeration order.

### Requirement 2: Evidence-backed project markers

**User Story:** As a coding agent, I want recognized unit markers to carry
their evidence, so that a planned validation route is explainable.

**Priority:** must-have

#### Acceptance Criteria

1. THE SYSTEM SHALL recognize `.csproj`, `pom.xml`, and `Cargo.toml` as initial
   project-unit markers and retain the marker path and ecosystem in evidence.
2. GIVEN an extensionless file, WHEN it is considered as a build-script marker,
   THEN THE SYSTEM SHALL require positive repository evidence such as an
   explicit durable instruction or configured validation protocol that
   identifies both the script and its validation purpose.
3. Executable permission, a generic filename such as `build`, or a shebang by
   itself SHALL NOT be sufficient to admit an extensionless build script.
4. GIVEN unreadable, oversized, malformed, or contradictory marker evidence,
   THEN THE SYSTEM SHALL report a bounded structured limitation and SHALL NOT
   infer a replacement marker or command.
5. Adding another marker kind later SHALL require an explicit recognizer and
   fixture-backed behavior, not a generic file-extension fallback.

### Requirement 3: Per-unit validation candidates

**User Story:** As a coding agent, I want candidates grouped by project unit,
so that I can validate the relevant example without running a repository-wide
polyglot build.

**Priority:** must-have

#### Acceptance Criteria

1. GIVEN multiple relevant project units, WHEN a plan is produced, THEN THE
   SYSTEM SHALL retain project-root and marker provenance for each candidate.
2. A candidate for one project unit SHALL NOT rely on a manifest, toolchain, or
   script found only in an unrelated sibling unit.
3. An ancestor aggregator MAY cover multiple nested units only when explicit
   repository evidence names that aggregation relationship.
4. The planner SHALL apply its existing command-safety policy to every
   candidate and SHALL keep `execution` equal to `not_executed`.
5. The public plan SHALL make the selected unit or unit-specific reason visible
   without requiring the caller to infer it from command text.

### Requirement 4: Structured dependency and environment blocking

**User Story:** As a coding agent, I want unknown prerequisites represented as
blocked evidence, so that an apparently plausible command is not mistaken for
an executable validation route.

**Priority:** must-have

#### Acceptance Criteria

1. GIVEN a recognized unit whose required dependencies or execution
   environment cannot be established from repository evidence, THEN THE SYSTEM
   SHALL return a structured blocked outcome for that unit and SHALL NOT emit a
   generic host command as a fallback.
2. GIVEN a request spanning ready and blocked units, THEN THE SYSTEM SHALL
   preserve the per-unit distinction and SHALL NOT present the aggregate plan
   as fully ready.
3. Every blocker SHALL identify the affected unit and the missing or
   conflicting evidence class. Where a safe callable follow-up is known, THE
   SYSTEM SHALL project it through the existing bounded top-level
   `next_actions` contract with a reason that identifies the affected unit.
4. Missing tool installation SHALL NOT trigger installation, network access,
   retry, target command execution, or alternate-tool fallback.

### Requirement 5: Broken Git metadata and claim separation

**User Story:** As a coding agent, I want source-based planning to remain useful
when Git metadata is damaged, without receiving false cleanliness assurances.

**Priority:** must-have

#### Acceptance Criteria

1. GIVEN files remain readable but Git metadata is missing, malformed, or
   cannot resolve `HEAD`, WHEN project-unit discovery runs, THEN THE SYSTEM
   SHALL continue using bounded file and documentation evidence.
2. Under the same condition, THE SYSTEM SHALL mark worktree-cleanliness,
   unchanged-worktree, diff-completeness, and before/after comparison claims as
   unavailable or blocked.
3. A Git metadata failure SHALL NOT erase independently obtained source or unit
   evidence, and successful source discovery SHALL NOT be used to imply Git
   cleanliness.
4. THE SYSTEM SHALL NOT invoke Git through a shell fallback to repair or bypass
   the failed metadata path.

### Requirement 6: Git submodule boundary awareness

**User Story:** As a coding agent, I want declared submodules recognized as
separate repository boundaries, so that parent-repository planning does not
silently cross authority or cleanliness scopes.

**Priority:** must-have

#### Acceptance Criteria

1. GIVEN bounded `.gitmodules` evidence declares a path, WHEN project units are
   discovered, THEN THE SYSTEM SHALL classify that path as a repository
   boundary rather than an ordinary nested project unit.
2. GIVEN a selected path falls within an unavailable or uninitialized declared
   submodule, THEN THE SYSTEM SHALL return a structured boundary blocker and
   SHALL NOT initialize, fetch, clone, or follow the submodule URL.
3. GIVEN an initialized submodule is present, this spec SHALL NOT recursively
   plan its commands or combine its Git state with the parent; the response
   SHALL state that full submodule handling is unavailable in this capability,
   while durable product planning SHALL route that work to a separate backlog
   item or spec.
4. GIVEN an embedded repository boundary is observed without sufficient
   `.gitmodules` evidence, THEN THE SYSTEM SHALL report the boundary evidence
   as incomplete and avoid traversal rather than assuming ownership.
5. Parent-repository source evidence outside the boundary SHALL remain usable
   when submodule evidence is blocked.

### Requirement 7: Mixed-language regression fixture

**User Story:** As a maintainer, I want a representative fixture for a large
example collection, so that unit selection and blocked planning remain proven.

**Priority:** must-have

#### Acceptance Criteria

1. THE TEST SUITE SHALL include a bounded mixed-language fixture containing at
   least sibling `.csproj`, `pom.xml`, and `Cargo.toml` units plus an
   extensionless-script unit with positive evidence.
2. The fixture SHALL include unrelated sibling languages and SHALL prove that a
   selected file or subtree yields only its relevant unit candidates.
3. The fixture SHALL cover an unknown dependency or environment and prove a
   structured unit-specific blocked outcome with no invented command.
4. The fixture SHALL cover broken Git metadata while proving source discovery
   remains usable and cleanliness claims remain blocked.
5. The fixture SHALL include a declared submodule boundary and prove there is
   no initialization, traversal, URL access, cross-boundary command candidate,
   or combined cleanliness claim.

### Requirement 8: Planning-only trust boundary

**User Story:** As a repository owner, I want discovery to remain read-only and
non-executing, so that asking for a plan cannot alter or build the target.

**Priority:** must-have

#### Acceptance Criteria

1. Project-unit discovery SHALL use bounded catalog, workspace-stat,
   workspace-read, policy, and already-provided repository-status evidence
   only.
2. The implementation SHALL NOT execute target commands, build scripts,
   package managers, language toolchains, Git commands, containers, or
   environment probes.
3. The implementation SHALL NOT mutate the target workspace, dependency cache,
   Git metadata, submodule state, generated outputs, or runtime environment.
4. Unknown or unsupported evidence SHALL produce a structured limitation or
   blocker, never a fallback execution route or partial success claim.

## Correctness Properties

- **CP-001 Unit locality:** Every emitted candidate's evidence paths are inside
  its unit or belong to an explicitly evidenced ancestor aggregator.
- **CP-002 Selection isolation:** Adding an unrelated sibling unit cannot
  change the selected unit or candidates for an unchanged file-scoped request.
- **CP-003 Determinism:** Permuting catalog enumeration order does not change
  project-unit identity, ordering, candidate ordering, or blockers.
- **CP-004 Non-execution:** Discovery and planning cause no process, network,
  workspace-write, dependency-install, Git-mutation, or submodule action.
- **CP-005 Claim separation:** Source-evidence availability never implies Git
  cleanliness availability.
- **CP-006 Boundary confinement:** No evidence path or candidate crosses a
  detected repository boundary unless a future explicitly authorized design
  owns that behavior.

## Technical Context

- **Language/Version:** TypeScript ESM on the repository-supported Node runtime.
- **Primary Dependencies:** Existing file catalog, workspace ports, validation
  planner, command-safety policy, runtime contracts, and Vitest fixtures.
- **Target Platform:** Local Agent Workbench MCP runtime.
- **Constraints:** Bounded, local-first, read-only, non-executing, deterministic,
  no fallback routes, and no semantic capability promotion.
- **Performance Goals:** Discover relevant units within existing bounded scan
  limits; public output remains bounded when many units or blockers exist.

## Success Criteria

- **SC-001:** Selecting a file in each initial manifest ecosystem yields only
  the nearest relevant unit and unit-specific candidate or blocker.
- **SC-002:** The mixed-language fixture never produces one synthetic
  repository-wide multi-language build.
- **SC-003:** Unknown environment/dependency evidence produces zero invented
  commands for the affected unit.
- **SC-004:** Broken Git metadata preserves source-backed unit results while
  explicitly withholding every cleanliness claim.
- **SC-005:** Submodule fixture coverage proves boundary detection without any
  initialization, traversal, URL access, command planning, or state mutation.
- **SC-006:** Existing validation-planning contract tests and full repository
  typecheck/tests pass after implementation.

## Related Artifacts

- Change Impact: `change-impact.md`
- Design: `design.md`
- Tasks: `tasks.md`
- Verification: `verification.md`
