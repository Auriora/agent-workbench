---
title: Git submodule repository support requirements
doc_type: spec
artifact_type: requirements
status: draft
owner: platform
last_reviewed: 2026-08-04
---

# Requirements

## Introduction

Agent Workbench currently treats every nested Git repository as foreign and
skips it. That is correct for unrelated embedded checkouts, but too restrictive
for Git submodules declared by the selected parent repository. A declared
submodule is part of that project's pinned source composition, so selecting the
parent repository authorizes bounded read-only discovery of initialized
submodules without a separate permission prompt for each submodule.

This spec adds submodule-aware repository evidence, recursive initialized
submodule traversal, per-repository identity and claim separation, and
submodule-scoped validation planning. It does not initialize or update
submodules, contact remotes, mutate Git state, or execute target build and test
commands.

## Goals

- Treat declared Git submodules as parent-authorized read-only project scope,
  while continuing to block unrelated nested checkouts.
- Inventory declared, pinned, initialized, uninitialized, mismatched, broken,
  and recursively nested submodule states from bounded repository evidence.
- Traverse initialized submodule source trees under deterministic depth, unit,
  file, byte, and time limits.
- Keep repository identity, revision, cleanliness, freshness, skipped work,
  validation candidates, and blockers separate for the superproject and every
  submodule.
- Integrate initialized submodule project units with Spec 057 without merging
  independent builds or Git claims.
- Return structured blocked or limited evidence when Git or submodule metadata
  is unavailable or inconsistent.

## Non-Goals

- Asking for separate permission before reading each declared, initialized
  submodule within the selected parent repository.
- Initializing, cloning, fetching, updating, synchronizing, deinitializing, or
  deleting submodules.
- Following or contacting submodule URLs.
- Checking whether remote branches or tags are newer than pinned gitlinks.
- Changing gitlinks, branches, detached-HEAD state, worktrees, indexes, config,
  remotes, or `.gitmodules`.
- Executing build, test, package-manager, container, or other validation target
  commands.
- Treating arbitrary nested Git repositories as submodules without matching
  superproject evidence.
- Combining repository cleanliness or validation readiness into an unqualified
  success claim.
- Supporting Git worktrees, subtrees, vendor copies, or multi-repository
  workspaces unless separately specified.

## Glossary

| Term | Definition |
|------|------------|
| Superproject | The selected parent Git repository whose recorded tree contains submodule gitlinks. |
| Declared submodule | A repo-relative path with consistent `.gitmodules` and superproject gitlink evidence. |
| Gitlink | A mode `160000` tree/index entry pinning a submodule commit. |
| Initialized submodule | A declared submodule with a readable local worktree and resolvable Git directory. |
| Uninitialized submodule | A declared and pinned submodule whose local worktree is absent or not initialized. |
| Orphan gitlink | A gitlink without a corresponding valid `.gitmodules` path declaration. |
| Repository identity | Stable evidence distinguishing the superproject and each submodule by parent-relative path, repository root, and observed revision. |
| Aggregate status | A parent response that summarizes per-repository states without erasing blockers or claiming all repositories share one state. |

## Durable Source Baseline

| Source | Current behavior relied on | Confidence | Notes |
|--------|----------------------------|------------|-------|
| `docs/reference/workspace-safety-contract.md` | Nested Git repositories are skipped for reads and refused for writes by default. | high | Spec 058 defines the narrow declared-submodule read exception; unrelated nested checkouts remain blocked. |
| `docs/security/threat-model.md` | Repository containment, command execution, network access, and untrusted workspace evidence require explicit controls. | high | The implementation must preserve no-network and no-mutation behavior. |
| `src/infrastructure/filesystem/file-catalog-scanner.ts` | Any directory containing `.git` below the launched root is currently classified as `nested_git_repository` and skipped. | high | Direct source evidence. |
| `src/infrastructure/commands/index.ts` | Git evidence already uses a structured `CommandPort`, but the current command adapter does not itself expose all timeout, output-cap, environment, and cancellation controls required for broader Git metadata collection. | high | T001 must settle the safe bounded adapter seam before new Git invocations. |
| `docs/specs/057-nested-project-unit-validation-evidence/` | Spec 057 defines project-unit selection and treats submodules as non-traversed boundaries. | high | T009 requires Spec 057 T001-T009 complete and verified. Spec 058 supersedes only the initialized-submodule traversal residual after implementation proof and T013 reconciliation. |
| `docs/backlog/README.md` | EB004 owns evidence-backed validation planning and structured blocked outcomes. | high | Submodule-scoped validation planning remains non-executing. |

## Durable Impact

| Durable area | Action | Target | Notes |
|--------------|--------|--------|-------|
| requirements | modify | `docs/backlog/README.md` | Add and later mark the Git submodule support slice delivered. |
| design | modify | `docs/design/edit-and-validation-loop-design.md` | Describe per-repository validation planning and aggregate truthfulness. |
| architecture | clarify | `docs/design/layered-runtime-architecture.md` | Document repository-composition discovery and the Git metadata port if required. |
| API/contract | modify | `docs/reference/runtime-contracts.md` | Add bounded repository/submodule identity, state, claims, blockers, and provenance. |
| safety | modify | `docs/reference/workspace-safety-contract.md` | Admit declared initialized submodules for read-only evidence while keeping writes and unrelated nested repos refused. |
| security | modify | `docs/security/threat-model.md` | Record `.gitmodules`, gitlink, nested metadata, recursion, URL, command, and mutation boundaries. |

## Staged Readiness

- **Current stage:** implementation readiness
- **Next stage:** T001 contract and bounded-runner foundation
- **Ready to implement when:** lifecycle lint, traceability coverage, T001 task
  context, and independent spec review have no unresolved blocker.
- **Design-first exception:** no
- **Optional artifacts recommended:** `canonical-context.md`,
  `change-impact.md`
- **Downstream review needed:** design, tasks, traceability, verification

## Requirements

### Requirement 1: Parent-authorized read-only submodule scope

**User Story:** As a coding agent working in a repository, I want its declared
submodules included in read-only evidence automatically, so that I can
understand the complete project without repeated permission prompts.

**Priority:** must-have

#### Acceptance Criteria

1. GIVEN the launched superproject records a valid submodule at a contained
   repo-relative path, WHEN a read-only evidence request includes the parent or
   that path, THEN THE SYSTEM SHALL treat the initialized submodule as within
   the selected parent repository's read scope without requesting separate
   per-submodule permission.
2. THE SYSTEM SHALL distinguish parent-authorized submodules from unrelated
   nested Git repositories using consistent superproject declaration and
   gitlink evidence.
3. A directory containing `.git` without matching submodule evidence SHALL
   retain the existing `nested_git_repository` refusal behavior.
4. Parent-derived read scope SHALL NOT grant write, process-execution, network,
   credential, remote-management, or Git-mutation authority.

### Requirement 2: Bounded submodule inventory and state

**User Story:** As a coding agent, I want exact local submodule state, so that I
can tell which evidence is available and why other evidence is blocked.

**Priority:** must-have

#### Acceptance Criteria

1. THE SYSTEM SHALL inventory bounded repo-relative submodule paths from
   `.gitmodules` and superproject gitlink evidence without emitting or following
   submodule URLs.
2. Each inventory entry SHALL distinguish at least `initialized`,
   `uninitialized`, `worktree_revision_mismatch`, `metadata_unavailable`,
   `declaration_without_gitlink`, and `orphan_gitlink` states.
3. For an initialized submodule, THE SYSTEM SHALL retain its parent-relative
   path, pinned gitlink revision, observed worktree `HEAD` revision, and whether
   those revisions match when the evidence is available.
4. Detached `HEAD` at the pinned revision SHALL be represented as a normal
   submodule state, not as a superproject branch failure.
5. Malformed, duplicate, escaping, absolute, symlink-escaping, or conflicting
   paths SHALL be blocked with bounded evidence and SHALL NOT be traversed.

### Requirement 3: Recursive initialized-submodule discovery

**User Story:** As a coding agent, I want initialized nested submodules
discovered recursively, so that deeply composed projects remain navigable.

**Priority:** must-have

#### Acceptance Criteria

1. GIVEN an initialized declared submodule contains its own declared initialized
   submodules, WHEN repository composition is discovered, THEN THE SYSTEM SHALL
   traverse admitted descendants automatically under the shared bounds and
   without an additional permission prompt or recursion mode switch.
2. Recursive discovery SHALL enforce deterministic maximum depth, repository
   count, file count, byte, deadline, and output limits and SHALL report which
   limit stopped further work.
3. THE SYSTEM SHALL detect repeated canonical repository roots or identities
   and stop cycles without returning partial success as complete evidence.
4. A blocked descendant SHALL NOT erase usable ancestor or sibling evidence,
   and the aggregate response SHALL retain the descendant blocker.
5. Traversal SHALL preserve parent-child repository lineage and repo-relative
   path provenance at every level.

### Requirement 4: Repository identity and claim separation

**User Story:** As a coding agent, I want evidence and status attributed to the
correct repository, so that one clean or fresh repository does not mask another
repository's state.

**Priority:** must-have

#### Acceptance Criteria

1. Every source, graph, documentation, validation, skipped-path, revision,
   freshness, and cleanliness result originating in a submodule SHALL identify
   its repository identity and parent-relative path.
2. Worktree cleanliness SHALL be evaluated and reported independently for the
   superproject and each initialized submodule when bounded Git evidence is
   available.
3. A clean superproject SHALL NOT imply clean submodules, and clean submodules
   SHALL NOT imply a clean superproject or clean aggregate.
4. When Git metadata is broken or unavailable for one repository, THE SYSTEM
   SHALL preserve its readable source evidence while blocking only the claims
   that depend on missing Git evidence.
5. Aggregate status SHALL be derived from named per-repository states and SHALL
   not use an unqualified `clean`, `fresh`, `planned`, or `ready` label when any
   requested repository is blocked or unknown for that claim.

### Requirement 5: Submodule-scoped project and validation planning

**User Story:** As a coding agent, I want validation candidates scoped to the
submodule containing my requested file, so that the parent and sibling
repositories are not treated as one build.

**Priority:** must-have

#### Acceptance Criteria

1. GIVEN a selected file lies in an initialized submodule, WHEN Spec 057
   project-unit discovery is available, THEN THE SYSTEM SHALL discover project
   units within that submodule using its repository-local evidence.
2. A submodule validation candidate SHALL retain both project-unit identity and
   repository identity and SHALL NOT borrow manifests, environments, scripts,
   or policies from unrelated parent or sibling repositories.
3. A superproject aggregator MAY plan across submodules only when explicit
   repository evidence names that aggregation and every involved repository's
   prerequisites are independently established.
4. An uninitialized, mismatched, or metadata-blocked submodule SHALL return a
   repository-specific blocked or limited plan and SHALL NOT trigger a generic
   command fallback.
5. All validation candidates SHALL remain `not_executed`; this spec SHALL NOT
   run target build or test commands.

### Requirement 6: Safe bounded Git metadata evidence

**User Story:** As a repository owner, I want submodule state discovered
without hidden mutation or network activity, so that read-only analysis remains
predictable.

**Priority:** must-have

#### Acceptance Criteria

1. Git-backed submodule evidence SHALL use one explicit injected read-only port
   and one implementation path; the file scanner and MCP adapter SHALL NOT
   invoke Git directly.
2. Any Git process invocation SHALL use structured argv without a shell, a
   fixed server-owned repository root, optional-lock suppression, a scrubbed or
   defined environment, timeout, output-byte cap, cancellation, and redacted
   structured failure.
3. The allowed Git operation set SHALL be fixed to local read-only metadata
   inspection required by this spec and SHALL reject arbitrary caller-provided
   arguments.
4. Discovery SHALL NOT contact remotes, follow `.gitmodules` URLs, run hooks,
   acquire optional locks, refresh or write indexes, modify config, or change
   worktrees.
5. If bounded Git evidence is unavailable, THE SYSTEM SHALL return a structured
   blocked or limited state and SHALL NOT fall back to shell commands, direct
   binary Git parsing, alternate libraries, or success-shaped filesystem
   inference.

### Requirement 7: Uninitialized and inconsistent submodules

**User Story:** As a coding agent, I want unavailable and inconsistent
submodules explained precisely, so that I do not mistake missing source for an
empty project.

**Priority:** must-have

#### Acceptance Criteria

1. An uninitialized submodule SHALL identify its declared path and pinned
   revision when available, report source evidence as unavailable, and preserve
   parent evidence.
2. A declaration without a gitlink and an orphan gitlink without a declaration
   SHALL be distinct structured states and SHALL block traversal and
   completeness claims for the affected path.
3. A worktree revision that differs from the pinned gitlink SHALL retain
   readable local evidence but SHALL block any claim that the evidence
   represents the superproject's pinned composition.
4. THE SYSTEM SHALL NOT initialize, clone, fetch, update, sync, repair, remove,
   or otherwise change an unavailable or inconsistent submodule.
5. A safe next action MAY explain a user-operated repository repair or
   initialization step, but it SHALL be non-executing, SHALL NOT expose a
   submodule URL, and SHALL NOT claim the action is required when the submodule
   is irrelevant to the selected scope.

### Requirement 8: Fixture-backed compatibility and regression proof

**User Story:** As a maintainer, I want representative submodule fixtures and
contract tests, so that the parent-scope exception does not weaken nested-repo
safety.

**Priority:** must-have

#### Acceptance Criteria

1. THE TEST SUITE SHALL include fixtures for initialized, uninitialized,
   revision-mismatched, recursively nested, cycle-reported, malformed-path,
   declaration-without-gitlink, orphan-gitlink, broken-metadata, and unrelated
   nested-repository cases.
2. Fixtures SHALL prove that declared initialized submodules are traversed
   read-only without separate permission while unrelated nested repositories
   remain skipped and write-refused.
3. Fixtures SHALL prove independent repository identity, revision,
   cleanliness, freshness, skipped-work, blocker, and validation-plan
   presentation.
4. Process, network, hook, filesystem-write, Git-mutation, and target-command
   spies SHALL prove that prohibited operations are never attempted.
5. Existing non-submodule scanner, workspace-safety, validation-planning, graph,
   docs, and public-contract tests SHALL remain compatible or receive explicit
   additive updates.

## Correctness Properties

- **CP-001 Declared-scope admission:** A nested Git repository is traversable
  if and only if bounded evidence identifies it as a declared gitlink-backed
  submodule of the selected repository lineage and its local state is readable.
- **CP-002 Repository isolation:** Evidence or claims from one repository never
  acquire another repository's identity, cleanliness, freshness, revision,
  skipped work, policy, or validation candidates.
- **CP-003 Recursive determinism:** Permuting filesystem or Git evidence order
  does not change repository lineage, ordering, states, blockers, or limit
  accounting.
- **CP-004 Bound confinement:** No traversal crosses the selected superproject,
  a declared submodule worktree, or their approved Git metadata roots through
  path, symlink, Git-dir, or recursion manipulation.
- **CP-005 Non-mutation and no network:** Discovery causes no workspace, index,
  config, worktree, gitlink, cache, submodule, remote, hook, or network change.
- **CP-006 Claim truthfulness:** An aggregate claim is successful only when
  every requested repository has sufficient successful evidence for that exact
  claim.
- **CP-007 Selection isolation:** Adding or breaking an unrelated sibling
  submodule cannot change the selected repository's source or project-unit
  results, except for explicitly labeled aggregate completeness.

## Technical Context

- **Language/Version:** TypeScript ESM on the repository-supported Node runtime.
- **Primary Dependencies:** Existing catalog and workspace ports, shared path
  policy, command abstraction, runtime contracts, validation planner, Spec 057
  project-unit model, and Vitest.
- **Target Platform:** Local Agent Workbench MCP runtime.
- **Constraints:** Local-first, bounded, read-only, no per-submodule read
  permission prompts, no network, no mutation, no target-command execution, no
  primary-plus-fallback routes.
- **Performance Goals:** Deterministic bounded traversal with explicit counts
  and continuation/blocked evidence rather than silent extraction budgets.

## Success Criteria

- **SC-001:** A selected parent request discovers readable source in declared
  initialized submodules without a separate permission interaction.
- **SC-002:** The same request continues to skip an unrelated nested checkout.
- **SC-003:** Recursive fixtures preserve repository lineage and stop at exact
  bounds or cycles with structured evidence.
- **SC-004:** Per-repository revision and cleanliness results never collapse
  into a false aggregate success.
- **SC-005:** Uninitialized, orphaned, mismatched, and broken states produce no
  network, mutation, initialization, fallback, or target command execution.
- **SC-006:** Spec 057 validation planning can select a submodule project unit
  without borrowing sibling or parent build evidence.
- **SC-007:** Focused, full, plugin, skill, and package validation gates pass
  after implementation.

## Related Artifacts

- Canonical Context: `canonical-context.md`
- Change Impact: `change-impact.md`
- Design: `design.md`
- Tasks: `tasks.md`
- Verification: `verification.md`
