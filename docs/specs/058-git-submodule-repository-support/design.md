---
title: Git submodule repository support design
doc_type: spec
artifact_type: design
status: draft
owner: platform
last_reviewed: 2026-08-04
---

# Technical Design

## Overview

Add a repository-composition layer ahead of catalog, graph, documentation, and
validation discovery. The layer reconciles working-tree `.gitmodules` path
declarations with superproject `HEAD` and index gitlinks through one bounded
read-only Git metadata port. A declared, gitlink-backed, initialized submodule
becomes a child repository unit inside the selected parent's read scope without
a separate permission interaction. Unrelated nested Git checkouts retain the
existing refusal.

Each child repository is scanned through the same catalog policy under its own
canonical root, then its file paths are prefixed into the superproject-relative
namespace. A snapshot composition receipt records repository lineage, path
prefixes, pinned and observed revisions, state, cleanliness availability, and
limits. Graph and documentation records keep their unique parent-relative
paths; query and presenter layers resolve repository identity through the
longest matching composition prefix. This avoids duplicating repository columns
across every stored evidence table while making provenance explicit publicly.

Submodule metadata inspection may invoke only a fixed local read-only Git
operation set through a hardened shared command runner. It uses structured
arguments, no shell, optional-lock suppression, defined environment, timeout,
output cap, and cancellation. Git absence or failure produces structured
blocked evidence; there is no filesystem-only, binary-index, library, shell, or
partial-success fallback.

## Requirement Coverage

| Requirement | Acceptance Criteria | Design Coverage | Validation Approach |
|-------------|---------------------|-----------------|---------------------|
| Requirement 1 | AC1-AC4 | Composition admission policy and declared-submodule exception | Declared versus unrelated nested-repo fixtures |
| Requirement 2 | AC1-AC5 | Declaration/gitlink reconciliation and state machine | Git metadata adapter and state-table tests |
| Requirement 3 | AC1-AC5 | Recursive composition traversal and shared budgets | Depth/count/deadline/cycle property tests |
| Requirement 4 | AC1-AC5 | Repository key, composition receipt, claim lattice, prefix resolution | Contract, storage, query, presenter, and mixed-state tests |
| Requirement 5 | AC1-AC5 | Repository-scoped Spec 057 project units and command projection | Validation planner and MCP goldens |
| Requirement 6 | AC1-AC5 | Read-only Git port and hardened command runner | Exact argv and prohibited-operation spies |
| Requirement 7 | AC1-AC5 | Unavailable/inconsistent state handling | Uninitialized, orphan, declaration-only, mismatch, and broken Git tests |
| Requirement 8 | AC1-AC5 | Fixture matrix and cross-surface regression gates | Focused and full suite |

## Correctness Property Coverage

| Property | Design Behavior | Validation Direction | Notes |
|----------|-----------------|----------------------|-------|
| CP-001 | Admission requires declaration, gitlink, initialization, and containment | Truth-table property test | Unrelated `.git` directories remain refused. |
| CP-002 | All public evidence resolves one repository key from composition lineage | Cross-surface identity assertions | Longest prefix is deterministic. |
| CP-003 | Sort all declarations, gitlinks, children, states, and blockers before budgeting | Permuted evidence property test | Budget accounting is order-independent. |
| CP-004 | Canonicalize worktree and Git-dir paths before admission | Escape, symlink, and malformed Git-dir fixtures | Approved Git metadata roots remain bounded. |
| CP-005 | Fixed read-only operation enum and hardened runner | Process/network/write/hook spies | No target validation command is invoked. |
| CP-006 | Aggregate claim uses per-claim all-requested-repositories reduction | Mixed clean/dirty/unknown tests | Unknown never becomes clean. |
| CP-007 | Selected-repository result is computed before aggregate completeness | Add/break unrelated sibling metamorphic test | Aggregate caveat may change; selected evidence may not. |

## High-Level Design

### System Architecture

```text
launched superproject root
          |
          v
GitRepositoryCompositionPort
  - .gitmodules path declarations
  - HEAD/index gitlinks
  - local HEAD and cleanliness
  - no URL use, network, or mutation
          |
          v
RepositoryCompositionDiscovery
  - reconcile states
  - contain paths/Git dirs
  - recurse initialized children
  - apply shared budgets/cycle guard
          |
          +------------------------------+
          |                              |
          v                              v
federated catalog scan            composition receipt
per repository root               lineage/state/claims
          |                              |
          +---------------+--------------+
                          v
            one parent snapshot namespace
            paths prefixed from superproject
                          |
          +---------------+----------------+
          |               |                |
          v               v                v
      graph/docs       context/query     validation plan
      indexing         provenance        per repo/unit
```

### Authority Model

Selecting the launched superproject authorizes local read-only evidence from
its declared initialized submodule lineage. No per-child prompt or request flag
is introduced. Authority is inherited only for read-only surfaces and only
while declaration, gitlink, containment, and initialization evidence remain
consistent.

Recursive composition discovery is always enabled for admitted initialized
descendants and terminates only through evidence state, containment, cycle, or
the explicit shared bounds. There is no shallow/recursive mode flag and no
second traversal path.

The authority does not inherit to:

- unrelated nested checkouts;
- remote URLs or remote state;
- submodule initialization or update;
- writes inside submodules;
- Git config, index, worktree, gitlink, branch, or detached-HEAD changes;
- target build/test command execution.

### Components and Changes

- `src/ports/index.ts`:
  Add `GitRepositoryCompositionPort`, bounded request/result types, and extend
  the shared command contract with required timeout, output, environment, and
  cancellation controls if no equivalent canonical port exists at T001.
- `src/infrastructure/commands/`:
  Implement the fixed read-only Git metadata adapter through the single shared
  command runner; harden existing Git history use onto the same bounded path
  rather than adding a second runner.
- `src/application/use-cases/discover-repository-composition.ts`:
  Reconcile declarations, committed/index gitlinks, initialization, revisions,
  cleanliness, lineage, bounds, cycles, and blockers.
- `src/domain/policies/path-policy.ts`:
  Replace the binary nested-repository decision with an evidence-aware result:
  declared initialized submodule read, declared unavailable boundary, or
  unrelated nested repository refusal. Write behavior remains refused.
- `src/infrastructure/filesystem/file-catalog-scanner.ts`:
  Consume the composition receipt and federate bounded scans across admitted
  child roots. The scanner does not invoke Git or infer submodules itself.
- Snapshot and SQLite store:
  Persist a bounded `snapshot_repository_units` composition table keyed by
  snapshot and stable response-local repository key. Include parent key, path
  prefix, state, revisions, claim availability, counts, and composition
  fingerprint.
- Snapshot validity and refresh:
  Incorporate a composition fingerprint into validity checks so submodule HEAD,
  gitlink, declaration, or availability changes cannot remain falsely fresh
  merely because watcher events were skipped.
- Graph/docs/context presenters:
  Resolve provenance by longest repository path prefix and expose a compact
  repository reference for submodule-origin evidence.
- Spec 057 validation integration:
  Pass repository-scoped catalog views into project-unit discovery and retain
  both repository and project-unit identities in planned candidates/blockers.
- MCP adapters:
  Remain thin; they parse inputs, call use cases, and present bounded results.

### Data Models

```text
RepositoryKey
  "superproject" | "submodule:<normalized parent-relative lineage>"

RepositoryUnitEvidence
  repository_key
  parent_repository_key?: RepositoryKey
  path_prefix
  depth
  state
  declaration_path?: repo-relative .gitmodules path
  head_gitlink_oid?: object id committed at parent HEAD
  index_gitlink_oid?: object id currently staged
  worktree_head_oid?: object id observed locally
  pinned_revision_matches: true | false | unknown
  cleanliness: clean | dirty | unknown | unavailable
  claim_blockers[]
  source_available
  limits

RepositoryCompositionReceipt
  superproject_key
  repositories[]
  aggregate_claims
  skipped_or_blocked[]
  source_complete
  truncated
  composition_fingerprint
```

Required state vocabulary is additive and explicit:

- `superproject`
- `initialized`
- `uninitialized`
- `worktree_revision_mismatch`
- `metadata_unavailable`
- `declaration_without_gitlink`
- `orphan_gitlink`
- `path_blocked`
- `cycle_blocked`
- `limit_blocked`

An index gitlink differing from the committed `HEAD` gitlink is recorded as a
separate staged-pin claim within the repository unit. It does not silently
replace the committed composition basis. The observed child `HEAD` is compared
to both values where available, while public summaries state which basis they
mean.

Repository keys are response/snapshot-local lineage identifiers, not remote
identity. URLs are neither identifiers nor output. Parent-relative path prefix
is stable within the selected superproject and sufficient for evidence routing.

### Storage Model

Add a normalized snapshot composition table rather than copying repository
identity onto every file, node, edge, and documentation row:

```text
snapshot_repository_units
  snapshot_id
  repository_key
  parent_repository_key
  path_prefix
  depth
  state
  head_gitlink_oid
  index_gitlink_oid
  worktree_head_oid
  cleanliness
  source_available
  claim_blockers_json
  PRIMARY KEY(snapshot_id, repository_key)
  UNIQUE(snapshot_id, path_prefix)
```

The snapshot stores a composition fingerprint derived from normalized
declaration paths, committed/index gitlink object IDs, observed child HEAD IDs,
state, and relevant limits—not URLs, absolute host paths, or secret material.
Existing evidence paths are already unique because submodule files retain their
superproject-relative prefix. Query-time prefix resolution assigns repository
provenance without rewriting node identifiers.

## Low-Level Design

### Git Evidence Operation Set

The adapter accepts semantic methods, not arbitrary argv:

```text
inspectSuperprojectGitlinks(root)
  -> committed HEAD gitlinks + index gitlinks

inspectRepositoryHead(root)
  -> HEAD object id or structured unavailable reason

inspectRepositoryCleanliness(root)
  -> bounded porcelain receipt or structured unavailable reason
```

The only planned process forms are equivalent to:

```text
git --no-optional-locks -C <server-owned-root> ls-tree -rz HEAD
git --no-optional-locks -C <server-owned-root> ls-files --stage -z
git --no-optional-locks -C <server-owned-root> rev-parse --verify HEAD
git --no-optional-locks -C <server-owned-root> status --porcelain=v1 -z --untracked-files=normal
```

The adapter parses only required fields, filters gitlink mode `160000`, and
never accepts caller-supplied Git arguments. A T001 source review may reduce
this operation set if equivalent evidence is available, but may not add a
second implementation path. `.gitmodules` path declarations are read through a
single bounded parser from the workspace port; URLs are ignored before public
or telemetry construction.

### Shared Command Runner Hardening

Before expanding Git use, the existing shared command abstraction must support:

- fixed executable and structured argv;
- server-owned working root;
- timeout and cancellation;
- stdout/stderr byte caps with explicit truncation/failure state;
- defined environment including no prompts and optional-lock suppression;
- no shell and no inherited interactive stdin;
- sanitized structured errors.

`GitHistoryAdapter` is migrated to this same bounded runner when the contract
changes. No direct `execFile`, secondary submodule runner, retry runner, or
unbounded compatibility route remains.

### Discovery Algorithm

```text
discover(root, parentKey, pathPrefix, depth, sharedBudget, seenRoots):
  canonicalRoot = resolveContainedWorktree(root)
  if canonicalRoot repeats seenRoots:
    emit cycle_blocked
    return

  declarations = parseBoundedGitmodulePaths(canonicalRoot/.gitmodules)
  gitlinks = gitPort.inspectSuperprojectGitlinks(canonicalRoot)
  entries = reconcile(declarations, gitlinks.head, gitlinks.index)

  for entry in stablePathOrder(entries):
    validate path and symlink containment
    classify declaration-only and orphan-gitlink states
    inspect local initialization without following URLs
    if initialized:
      inspect child HEAD and cleanliness through gitPort
      emit child repository receipt
      if recursion budget admits:
        discover(childRoot, childKey, childPrefix, depth + 1, ...)
    else:
      emit unavailable or blocked receipt

  return deterministic bounded composition
```

The shared budget is consumption-based and never silently restarts per child.
Limit exhaustion identifies the next unvisited repository/path and exact count
basis. No automatic rerun, larger hidden budget, or partial-as-complete result
is permitted.

### Catalog Federation

The application layer supplies the admitted composition receipt to the scanner.
For each `source_available` repository unit, the scanner uses the same path,
secret, generated/vendor, ignore, size, and file-count policies with that
repository's canonical worktree as the local containment root. Returned paths
are prefixed into the superproject namespace before deduplication and sorting.

Submodule-local `.gitignore` applies within that child repository. Parent ignore
rules do not automatically erase declared submodule source, but superproject
configured skip roots and workspace-safety exclusions still apply to the
prefixed path. Writes remain refused at submodule prefixes in this spec.

### Repository Provenance Resolution

For a superproject-relative evidence path, select the deepest composition unit
whose path prefix contains the path. The root unit is the default. Prefixes are
normalized, unique, sorted by descending segment depth, and never inferred from
unadmitted nested `.git` directories.

Public file, symbol, reference, impact, docs, context, validation, skipped-work,
and status results include a compact repository reference when the evidence is
not from the superproject. Aggregate packets include the bounded repository
receipt once and may reference its keys to avoid payload duplication.

### Snapshot Freshness

Composition identity participates in snapshot validity. Before a snapshot is
treated as fresh for a submodule-aware request, compare the current bounded
composition fingerprint with the stored fingerprint. A changed declaration,
gitlink, initialization state, child `HEAD`, or availability marks the snapshot
stale or degraded according to the exact missing evidence.

File watcher events remain useful for source changes, but watcher silence alone
cannot prove submodule freshness because child Git metadata may live under the
superproject's hidden `.git/modules` area. Refresh recomputes the composition
receipt through the same port; no watcher-specific Git fallback is added.

### Validation Planning

Spec 057 project-unit discovery receives one repository-local catalog view at a
time. Candidates carry `repository_key`, `project_unit_root`, marker evidence,
readiness, blockers, and `execution: not_executed`. An explicit parent
aggregator may reference child units only when repository evidence names it and
each child has sufficient local environment/dependency evidence.

The top-level plan is `blocked` when any requested repository is blocked for
the validation claim, while retaining ready sibling candidates as separately
labeled evidence. There is no first-project, root-command, host-command, or
submodule-initialization fallback.

### Error Handling

- Git unavailable: repository metadata and dependent claims are blocked;
  independently readable superproject source remains available.
- Broken superproject `HEAD`: index/declaration evidence may be reported as
  limited, but committed-pin, cleanliness-comparison, and completeness claims
  remain blocked.
- Uninitialized child: report declaration and pin evidence; no source scan.
- Revision mismatch: scan readable local source with explicit local revision;
  block pinned-composition claims.
- Declaration/gitlink inconsistency: report exact state and path; no traversal.
- Malformed/escaping path or Git-dir: workspace-safety blocker; no absolute path
  in public output.
- Limit/deadline/cancellation: retain bounded completed repository receipts,
  mark completeness false, and identify skipped work without success-shaped
  partial output.

### Security, Trust, and Access

Submodule declaration does not make `.gitmodules` content trusted. Only
repo-relative `path` values are decision-relevant. URLs, update strategies, and
arbitrary config keys are ignored and never emitted. Every worktree path,
symlink, and `.git` file indirection is canonicalized against the allowed child
worktree and superproject Git metadata roots before use.

Read authority comes from the launched superproject and its locally recorded
composition. No extra submodule prompt is required. Network and mutation remain
prohibited regardless of declaration. Git commands run with prompts disabled,
no optional locks, fixed local operations, and bounded output; no hooks or
submodule helper commands are invoked.

### Migration and Compatibility

The public contract adds optional repository-composition and repository-reference
fields. Existing callers can continue consuming superproject-relative paths.
The scanner's default remains skip-all nested repositories when no admitted
composition receipt is supplied, preserving current callers and unrelated-repo
safety through one explicit policy path rather than a fallback implementation.

The SQLite schema gains the composition table and fingerprint through the
normal schema migration/version mechanism. Existing snapshots without a
composition receipt remain valid only for non-submodule-aware claims; a request
requiring submodule evidence triggers a new bounded snapshot rather than
pretending older evidence is complete.

### Slice Boundary And Residual Architecture

| Design target | In this slice | Out of this slice | Follow-up destination | Blocks closure? |
|---------------|---------------|-------------------|-----------------------|-----------------|
| Read scope | Declared initialized submodules inherit parent read scope | Separate per-child prompts | Rejected by user direction | no |
| Git evidence | Fixed local read-only metadata operations | Remote comparison, arbitrary Git commands | Future explicit maintenance feature | no |
| Traversal | Recursive initialized submodules with bounds and cycles | Auto-initialization and repair | Future mutation workflow if justified | no |
| Repository claims | Per-repo identity, revision, freshness, cleanliness, blockers | Combined unqualified success | Rejected | no |
| Validation | Per-repo Spec 057 candidates, planning only | Target command execution | Existing process-execution backlog/policy | no |
| Writes | None inside submodules | Preview/apply edits and gitlink updates | Separate workspace-write design | no |
| Multi-repo shapes | Git submodule lineage | Worktrees, subtrees, vendor copies, arbitrary workspaces | Separate evidence-gated specs | no |

## Validation Strategy

| Validation | Covers | Evidence Location | Residual Risk |
|------------|--------|-------------------|---------------|
| Contract and state-vocabulary tests | Requirements 2, 4, 7 | Contract tests and MCP goldens | Older clients ignore additive fields. |
| Git adapter exact-argv tests | Requirement 6, CP-005 | Infrastructure command tests | Platform Git behavior remains external. |
| Composition truth-table/property tests | Requirements 1-3, 7; CP-001, CP-003, CP-004 | Application/domain tests | Synthetic metadata needs real-repo cross-check later. |
| Scanner federation tests | Requirements 1, 3, 8 | Workspace scanner fixtures | Large trees rely on bounded regression fixtures. |
| Snapshot/storage/freshness tests | Requirement 4 | SQLite and refresh tests | Migration needs compatibility proof. |
| Query/docs/graph provenance tests | Requirement 4, CP-002 | Query and presenter suites | Payload bounds may limit per-hit detail. |
| Validation planner tests | Requirement 5, CP-007 | Application and MCP validation tests | Target commands remain deliberately unexecuted. |
| Non-mutation/network spies | Requirements 6-8, CP-005 | Infrastructure/integration tests | Cannot prove external Git implementation internals beyond controlled process behavior. |
| Read-only real-repository dogfood | Success criteria | Evidence log after implementation | Dirty/broken repos require baseline caveats. |

## Downstream Task Guidance

- Required checkpoints before implementation: T001 must settle the hardened
  shared command runner and additive public repository contract. T009 may not
  start until Spec 057 T001-T009 are complete and verified, establishing its
  project-unit contract, discovery, readiness, planner integration, and goldens.
- Properties requiring explicit tests: CP-001 through CP-007.
- High-risk cases: `.gitmodules` path escapes, `.git` file indirection, orphan
  gitlinks, declaration-only paths, staged gitlink drift, detached child HEAD,
  broken parent HEAD, recursive limits, cycles, dirty child/clean parent, and
  unrelated nested checkout refusal.
- Downstream reviews: architecture, security, storage migration, public
  contracts, and workspace safety.

## Operational Considerations

Composition discovery adds bounded Git process work to snapshot creation and
freshness validation, not every query. Cache only against the composition
fingerprint and current snapshot. Telemetry records counts, durations, state
kinds, truncation, and failure classes; it excludes URLs, absolute Git-dir
paths, command output, and repository source content.

No feature flag or alternate scanner path is planned. Rollout uses the additive
composition receipt and keeps the current unrelated-nested-repository refusal
as the default classification when admission evidence is absent.

## Open Questions

- None blocking requirements/design. T001 must confirm whether the existing
  command abstraction can be evolved in place or whether an already-canonical
  bounded runner exists elsewhere; the accepted outcome remains one shared
  hardened runner and no compatibility fallback.

## Related Artifacts

- Requirements: `requirements.md`
- Canonical Context: `canonical-context.md`
- Change Impact: `change-impact.md`
- Tasks: `tasks.md`
- Verification: `verification.md`
