---
title: Changed-files Workbench entry point requirements
doc_type: spec
artifact_type: requirements
status: draft
owner: platform
last_reviewed: 2026-08-06
---

# Requirements

## Introduction

Agents need one read-only entry point after edits or before handoff. Today they
must separately discover repository status, changed paths, diagnostics, and
validation planning, which encourages shell-only fallback and weak evidence
packets. This specification promotes EB044 into a bounded MCP workflow.

## Goals

- Provide one read-only changed-files packet with explicit component states.
- Discover bounded Git change evidence without relying on caller-maintained lists.
- Reuse repository status, diagnostics, and verification-planning contracts.
- Keep lifecycle evidence caller-supplied, read-only, and non-authoritative.

## Non-Goals

- Execute validation commands, mutate files, stage changes, or repair Git.
- Update lifecycle task state, accept work, or claim completion or closure.
- Add fallback parsers, alternate diagnostics, retries, or partial-success masking.
- Replace the existing focused status, diagnostics, or verification surfaces.

## Durable Source Baseline

| Source | Current behavior relied on | Confidence | Notes |
| --- | --- | --- | --- |
| `docs/backlog/README.md` | EB044 owns the changed-files entry-point signal and acceptance boundary. | high | Product backlog authority. |
| `docs/design/edit-and-validation-loop-design.md` | Diagnostics and validation planning remain distinct evidence stages. | high | Durable design owner. |
| `docs/design/mcp-surface-design.md` | Public MCP tools use bounded envelopes and structured degraded states. | high | Public surface owner. |
| `docs/reference/runtime-contracts.md` | Response metadata and validation status constrain public claims. | high | Contract owner. |
| `docs/reference/lifecycle-bridge-contract.md` | Lifecycle context is consumed evidence, not Agent Workbench authority. | high | Companion boundary. |

## Durable Impact

| Durable area | Action | Target | Notes |
| --- | --- | --- | --- |
| requirements | modify | `docs/requirements/runtime-requirements.md` | Add changed-files packet behavior. |
| design | modify | `docs/design/edit-and-validation-loop-design.md` | Document aggregation flow and component states. |
| API/contract | modify | `docs/reference/runtime-contracts.md` | Add request/result contracts. |
| integration | modify | `docs/design/coding-agent-integration-design.md` | Make the workflow discoverable across providers. |
| backlog | modify | `docs/backlog/README.md` | Record EB044 delivery or residuals. |

## Staged Readiness

- **Current stage:** implementation
- **Next stage:** verification
- **Ready to implement when:** requirements, design, tasks, traceability, and
  validation gates agree on the bounded read-only packet.
- **Design-first exception:** no
- **Optional artifacts recommended:** `traceability.md`, `verification.md`
- **Downstream review needed:** implementation, security/operations, lifecycle

## Requirements

### Requirement 1: Bounded Git change inventory

**User Story:** As a coding agent, I want Workbench to identify changed files,
so that I do not need an ad hoc shell status pass before using repository tools.

**Priority:** must-have

#### Acceptance Criteria

1. GIVEN a Git worktree, WHEN the entry point runs, THEN THE SYSTEM SHALL return
   deterministic bounded staged, unstaged, and untracked repo-relative paths.
2. IF Git evidence is unavailable, malformed, timed out, cancelled, or exceeds
   its bound, THEN THE SYSTEM SHALL return a structured blocked Git component
   and SHALL NOT claim worktree cleanliness or diff completeness.
3. THE SYSTEM SHALL NOT mutate the Git index, worktree, configuration, hooks, or
   repository metadata.

### Requirement 2: One evidence packet

**User Story:** As a coding agent, I want status, diagnostics, and validation
planning in one packet, so that I can choose the next safe action efficiently.

**Priority:** must-have

#### Acceptance Criteria

1. GIVEN discovered or explicitly supplied changed paths, WHEN the tool runs,
   THEN THE SYSTEM SHALL include repository freshness, bounded diagnostics, and
   planned validation evidence with separate component states.
2. IF any required component is unavailable or blocked, THEN THE SYSTEM SHALL
   expose an overall degraded or blocked state and name the missing evidence;
   it SHALL NOT return success-shaped partial evidence.
3. THE SYSTEM SHALL distinguish planned validation from executed validation and
   SHALL never execute a planned command.
4. WHERE no changed paths exist, THE SYSTEM SHALL return a clean/no-change
   packet without inventing diagnostics or validation completion.

### Requirement 3: Lifecycle companion boundary

**User Story:** As an agent working from a spec, I want lifecycle context carried
into the packet without changing lifecycle state.

**Priority:** must-have

#### Acceptance Criteria

1. IF caller-supplied lifecycle context is present, THEN THE SYSTEM SHALL label
   it as consumed companion evidence and preserve its stated availability.
2. THE SYSTEM SHALL NOT select tasks, update task state, accept requirements,
   promote documentation, or close a spec.

### Requirement 4: Discoverability and compatibility

**User Story:** As an integration user, I want the changed-files workflow named
by the installed agent guidance, so that it is a natural post-edit action.

**Priority:** must-have

#### Acceptance Criteria

1. THE SYSTEM SHALL register one public read-only MCP tool with bounded input
   and output metadata and a canonical trust policy.
2. Codex, Claude Code, and Kiro integration guidance SHALL name the exact tool
   as the first post-edit or pre-handoff Workbench action where supported.
3. Existing focused tools and additive contract consumers SHALL remain
   compatible.

## Correctness Properties

- **CP-001:** Every reported changed path is repo-relative, unique, sorted, and
  classified into at least one evidenced Git category.
- **CP-002:** The overall packet cannot be `ready` when any required component
  is blocked or unavailable.
- **CP-003:** No packet field can represent planned validation as executed or
  passed validation.
- **CP-004:** Lifecycle companion input is observational only and cannot cause a
  write or lifecycle-state transition.

## Technical Context

- **Language/Version:** TypeScript ESM on supported Node versions.
- **Primary Dependencies:** existing MCP SDK, Zod contracts, Git command port,
  diagnostics providers, verification planner, and response metadata policy.
- **Target Platform:** packaged Agent Workbench MCP runtime.
- **Constraints:** read-only, bounded, redacted, fail-closed, no hidden fallback.
- **Performance Goals:** one bounded Git inventory and no unbounded result list.

## Success Criteria

- **SC-001:** Fixture-backed clean, dirty, staged, untracked, blocked-Git,
  unavailable-diagnostics, stale-status, and lifecycle-context scenarios pass.
- **SC-002:** Registry, integration-profile, plugin, typecheck, and full Vitest
  gates pass without removing or weakening existing focused surfaces.

## Related Artifacts

- Design: `design.md`
- Tasks: `tasks.md`
- Traceability: `traceability.md`
- Verification: `verification.md`
