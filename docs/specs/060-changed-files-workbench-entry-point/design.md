---
title: Changed-files Workbench entry point design
doc_type: spec
artifact_type: design
status: draft
owner: platform
last_reviewed: 2026-08-06
---

# Technical Design

## Overview

Add a `changed_files_context` MCP tool backed by one application use case. The
use case obtains bounded Git change evidence through the existing command port,
then composes the existing repository-status, diagnostics, and verification
planning use cases. A presenter produces one envelope whose component states
make incomplete evidence explicit. The MCP adapter remains a thin validator and
dispatcher.

## Requirement Coverage

| Requirement | Acceptance Criteria | Design Coverage | Validation Approach |
| --- | --- | --- | --- |
| Requirement 1 | AC1-AC3 | Add additive Git status categories to `GitCleanlinessInspectionResult`. | Command-adapter and use-case tests. |
| Requirement 2 | AC1-AC4 | Application orchestration plus component-state presenter. | Application, presenter, and MCP tests. |
| Requirement 3 | AC1-AC2 | Caller-supplied lifecycle summary copied into an observational field only. | Contract and no-write fixture tests. |
| Requirement 4 | AC1-AC3 | Registry, trust policy, common profile, and packaged guidance updates. | Registry and integration tests. |

## Correctness Property Coverage

| Property | Design Behavior | Validation Direction | Notes |
| --- | --- | --- | --- |
| CP-001 | Normalize, deduplicate, sort, and classify Git paths once. | Table-driven adapter tests. | Categories may overlap for partially staged files. |
| CP-002 | Derive overall state from required component states. | Golden presenter tests. | Blocked outranks degraded; degraded outranks ready. |
| CP-003 | Reuse validation-plan status vocabulary unchanged. | Contract and MCP tests. | No command runner is invoked. |
| CP-004 | Lifecycle context has no writer dependency. | Dependency and behavior tests. | No spec lifecycle tool is called. |

## High-Level Design

### System Architecture

```text
changed_files_context MCP adapter
  -> changed-files application use case
     -> GitRepositoryCompositionPort.inspectRepositoryCleanliness
     -> getRepoStatus provider
     -> diagnoseChangedFiles provider
     -> planVerification provider
  -> changed-files presenter
  -> standard response envelope
```

### Components and Changes

- Contracts: add request, Git change-category receipt, component state, result,
  and lifecycle companion summary schemas.
- Git adapter: preserve current cleanliness behavior while returning staged,
  unstaged, and untracked path sets from bounded non-mutating Git commands.
- Application: orchestrate existing providers; never perform presentation or
  MCP registration.
- Presentation: derive overall state and trust metadata without hiding missing
  component evidence.
- MCP registry: validate input, enforce launch-root authority, and dispatch.
- Integration guidance: name `changed_files_context` as the post-edit entry
  point while retaining focused tools for follow-up.

### Data Models

```text
ChangedFilesContextRequest {
  task?: string
  files?: string[]
  lifecycle_context?: { source?: string; state: provided|unavailable|unknown; summary: string }
  max_files: number
  max_commands: number
}

ChangedFilesContextResult {
  repo_root: string
  state: ready|no_changes|degraded|blocked
  changes: { state; cleanliness?; staged[]; unstaged[]; untracked[]; changed_files[]; reason? }
  repository_status: { state; value?; reason? }
  diagnostics: { state; value?; reason? }
  verification: { state; value?; reason? }
  lifecycle_context?: observational summary
  next_actions: bounded existing-tool calls
}
```

### Data Flow

Git evidence selects the changed-file scope. Explicit request files are merged
with discovered paths, normalized, deduplicated, and bounded. The same bounded
scope is passed to diagnostics and verification planning. Repository status is
read independently. Each provider result is retained with its own state; an
exception or missing provider becomes a structured component failure. The
presenter derives the overall state without converting partial evidence into
success.

## Low-Level Design

### Algorithms and Logic

```text
inspect Git status
if blocked: retain blocker and merge only safe explicit paths
normalize + sort + bound changed paths
read repository status
if paths exist: diagnose paths and plan verification
else: mark diagnostics and verification not_applicable
copy caller lifecycle summary as observational evidence
derive blocked > degraded > ready/no_changes
```

### Function Signatures and Interfaces

```text
getChangedFilesContext(input: {
  request: ChangedFilesContextRequest
  git: GitRepositoryCompositionPort
  getRepoStatus: RepoStatusProvider
  diagnoseChangedFiles: DiagnosticsProvider
  planVerification: VerificationProvider
  default_repo_root: string
}): Promise<ChangedFilesContextUseCaseResult>
```

### Error Handling

Provider absence, timeout, output overflow, parse failure, invalid path, stale
status, diagnostics failure, and planner failure remain typed component states.
No retry or alternate route is introduced. Invalid MCP input returns the shared
invalid-input envelope. Unexpected adapter failure uses the shared redacted MCP
failure boundary.

### Security, Trust, and Access

Git commands retain fixed safe configuration, disabled hooks, disabled network
protocols, output limits, and timeouts. Inputs remain launch-root authoritative
and repo-relative. The tool is read-only and never executes validation commands
or lifecycle mutations.

### Migration and Compatibility

All contracts and Git result fields are additive. Existing diagnostics,
verification, status resources, and integrations remain registered. Clients
that ignore the new tool continue to work.

### Slice Boundary And Residual Architecture

| Design target | In this slice | Out of this slice | Follow-up destination | Blocks closure? |
| --- | --- | --- | --- | --- |
| One changed-files packet | Public read-only MCP tool and installed guidance | Automated use by every client event | EB016 | no |
| Git change evidence | Staged, unstaged, untracked bounded paths | Rename lineage and diff contents | EB008 | no |
| Lifecycle context | Caller-supplied observational summary | Lifecycle discovery or mutation | spec-lifecycle-manager | no |
| Review/proof packet | Status, diagnostics, validation planning | Acceptance, proof export, review verdict | EB025/EB030 | no |

## Validation Strategy

| Validation | Covers | Evidence Location | Residual Risk |
| --- | --- | --- | --- |
| Git adapter tests | Requirement 1, CP-001 | `verification.md` | Platform Git variation. |
| Application/presenter tests | Requirements 2-3, CP-002-CP-004 | `verification.md` | Provider timing combinations. |
| MCP and registry tests | Requirement 4 | `verification.md` | Client display variation. |
| Integration/plugin validation | Discoverability and packaging | `verification.md` | Manual client adoption remains dogfood evidence. |

## Downstream Task Guidance

- Add contract and Git evidence before orchestration.
- Keep shared registry metadata and central trust policy parent-owned.
- Run focused tests after each task and full required gates before promotion.
- Security/operations and correctness review are required before closure.

## Operational Considerations

The tool performs one bounded Git inventory and delegates to existing bounded
providers. It records no telemetry content beyond existing safe surface
metadata and never logs diff contents or lifecycle body text.

## Open Questions

- None blocking. The accepted name is `changed_files_context` for this slice.

## Related Artifacts

- Requirements: `requirements.md`
- Tasks: `tasks.md`
- Traceability: `traceability.md`
- Verification: `verification.md`
