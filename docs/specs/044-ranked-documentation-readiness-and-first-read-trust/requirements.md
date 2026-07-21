---
title: Ranked documentation readiness and first-read trust requirements
doc_type: spec
artifact_type: requirements
status: draft
owner: platform
last_reviewed: 2026-07-21
---

# Requirements

## Introduction

A published fresh graph snapshot can contain an invalid documentation concern
index. Runtime `0.6.1` then blocks every authority-aware `docs_search`, while
status and orientation report healthy reusable evidence and the recovery action
cannot explain the blocker. Spec 044 makes ranked-documentation readiness a
bounded, visible part of first-read trust and prevents invalid checked-in maps
from passing repository validation.

## Goals

- Validate the real documentation map with the production concern extractor.
- Classify large mapped owners through bounded metadata rather than whole-file admission.
- Expose ranked-documentation readiness and safe failure evidence in status.
- Make orientation and `docs_search` recovery consistent with that readiness.
- Prove the repaired repository returns usable authority-aware search results.

## Non-Goals

- Changing relevance, authority, pagination, count, or cursor semantics from Spec 043.
- Choosing EB059 universe capacity or eviction policy.
- Implementing EB061 dynamic-import reference support.
- Adding a fallback search route or automatic retry loop.

## Glossary

| Term | Definition |
| --- | --- |
| Concern index | Snapshot-bound normalized documentation concerns, intent terms, and owner evidence. |
| Ranking readiness | Whether the selected snapshot has compatible concern evidence required by authority-aware `docs_search`. |
| First-read trust | The bounded orientation/status evidence used before deeper repository work. |
| Source repair | Correcting invalid repository-authored policy or documentation rather than refreshing unchanged invalid input. |
| Environment repair | Repairing runtime, store, permission, or schema infrastructure that coordinated refresh cannot correct. |
| Request repair | Selecting an existing published snapshot rather than retrying an impossible snapshot identity. |

## Durable Source Baseline

| Source | Current behavior relied on | Confidence | Notes |
| --- | --- | --- | --- |
| `docs/design/mcp-surface-design.md` | `docs_search` blocks without a compatible concern/ranking index and orientation is the default compact entry receipt. | high | Recovery currently points to status. |
| `docs/reference/runtime-contracts.md` | Defines `ranking_unavailable`, status/trust vocabulary, and orientation fields. | high | Needs readiness propagation clarification. |
| `docs/design/runtime-operations-design.md` | Persisted fresh state is necessary but not sufficient for first-read reuse. | high | Currently applies bounded path validity, not concern readiness. |
| `docs/design/graph-store-design.md` | Owns concern-index persistence and snapshot publication. | high | Invalid concern state is already persisted. |
| `docs/reference/documentation-map.md` | Owns canonical concern/owner declarations. | high | Directory owner was repaired as immediate recovery. |

## Durable Impact

| Durable area | Action | Target | Notes |
| --- | --- | --- | --- |
| public contract | modify | `docs/reference/runtime-contracts.md` | Add readiness and recovery semantics. |
| MCP behavior | modify | `docs/design/mcp-surface-design.md` | Align status, orientation, and docs search. |
| operations | modify | `docs/design/runtime-operations-design.md` | Distinguish refreshable from source-authored invalidity. |
| persistence | clarify | `docs/design/graph-store-design.md` | State how concern readiness joins visible publication evidence. |
| authoring | clarify | `docs/reference/documentation-map.md` | File-only canonical owner rule. |

## Staged Readiness

- **Current stage:** requirements, design, and tasks drafted
- **Next stage:** implementation
- **Ready to implement when:** lifecycle lint, traceability, task-state audit,
  and independent design review have no blocking findings.
- **Design-first exception:** no
- **Optional artifacts included:** `canonical-context.md`, `change-impact.md`,
  `traceability.md`, `verification.md`
- **Downstream review needed:** implementation and contract review

## Requirements

### Requirement 1: Repository-Real Concern Validation

**User Story:** As a maintainer, I want the checked-in documentation map tested
through the production concern extractor, so invalid canonical owners cannot
silently disable ranked search after promotion.

**Priority:** must-have

#### Acceptance Criteria

1. GIVEN the repository documentation map, WHEN focused validation runs, THEN
   the production concern extractor SHALL return `complete` with no failure reason.
2. IF a canonical-owner destination resolves to a directory, unsafe path,
   malformed document, or otherwise invalid mapped owner, THEN validation SHALL
   fail and name the bounded reason.
3. The implementation SHALL reuse the production extractor rather than add a
   separate map validator.
4. GIVEN an indexed Markdown owner larger than 120,000 bytes with valid bounded
   frontmatter, WHEN concern extraction runs, THEN owner classification SHALL
   succeed without raising an arbitrary whole-file limit.
5. The product backlog SHALL be restored as a machine-readable canonical owner
   before closure after bounded classification is implemented.
6. Owner metadata classification SHALL admit at most 16,384 UTF-8 bytes. A
   frontmatter block that begins in the first line but does not close within
   that bound SHALL fail with a bounded `frontmatter_metadata_too_large`
   reason; absent and malformed frontmatter SHALL remain distinguishable.

### Requirement 2: Snapshot-Bound Ranking Readiness

**User Story:** As a coding agent, I want status to report documentation-ranking
readiness for the visible snapshot, so a blocked search has an actionable cause.

**Priority:** must-have

#### Acceptance Criteria

1. WHERE a visible snapshot exists, status SHALL report whether its concern
   evidence is ready, invalid, or unavailable.
2. IF readiness is invalid or unavailable, THEN status SHALL expose a bounded,
   safe reason and SHALL lower trust consistently with the blocked capability.
3. Readiness evidence SHALL be read from the same snapshot selected by status;
   it SHALL NOT join state from another snapshot or connection-local cache.
4. `no_map` SHALL remain a usable, non-blocking state: relevance ranking may
   proceed without documentation-owner intent evidence and SHALL carry a
   bounded partial-trust caveat rather than `ranking_unavailable`.
5. Every persisted or unavailable concern-index state SHALL map exhaustively to
   a public readiness state, recovery kind, first-read trust projection, and
   `docs_search` outcome as defined by the design decision table.
6. Any public readiness reason SHALL pass through the shared presentation
   redactor and SHALL be capped at 512 UTF-8 bytes after redaction.

### Requirement 3: Truthful Orientation And Recovery

**User Story:** As a coding agent, I want orientation and recovery actions to
agree with actual tool readiness, so first-read health does not conceal a
deterministically blocked docs route.

**Priority:** must-have

#### Acceptance Criteria

1. WHILE required documentation-ranking evidence is invalid or unavailable,
   orientation SHALL report a material capability blocker and
   `orientation_reusable: false`.
2. `refresh_required` SHALL be true only when coordinated refresh can clear the
   blocker; invalid repository-authored concern policy SHALL instead require
   source repair.
3. WHEN `docs_search` returns `ranking_unavailable`, THEN its status recovery
   action SHALL lead to a receipt containing the same readiness category and an
   actionable repair or refresh boundary.

### Requirement 4: Healthy Ranked-Search Acceptance

**User Story:** As a maintainer, I want installed-runtime proof on the real
repository, so fixture success cannot hide an invalid promoted map.

**Priority:** must-have

#### Acceptance Criteria

1. GIVEN a repaired map and newly published snapshot, WHEN status and
   orientation are read, THEN ranking readiness SHALL be ready and no ranking
   blocker SHALL be present.
2. WHEN `docs_search` queries the rule governing SessionStart behavior, THEN it
   SHALL return a non-blocked complete ranked universe whose governing evidence
   includes the coding-agent integration design.
3. Codex and Claude Code SHALL observe compatible readiness and ranked-search
   outcomes from the shared repository runtime before closure.
4. Both clients SHALL execute the identical request payload and record the same
   selected snapshot, readiness state, trust state, first-page canonical path,
   and authority fields.

## Correctness Properties

- **CP-001:** For any selected snapshot, status, orientation, and `docs_search`
  must derive documentation-ranking readiness from that same snapshot ID.
- **CP-002:** No orientation receipt may be reusable with zero material blockers
  when the same snapshot deterministically yields `ranking_unavailable`.
- **CP-003:** Source-authored invalidity never produces a refresh-only recovery loop.

## Technical Context

- **Language/Version:** TypeScript ESM, Node.js 22/24
- **Primary Dependencies:** SQLite graph store, MCP SDK, Zod, Vitest
- **Target Platform:** Repo-local daemon shared by Codex and Claude Code
- **Constraints:** Thin MCP adapters; no fallback ranking route; bounded status hot path
- **Performance Goals:** Constant-count indexed readiness reads with no broad scan

## Success Criteria

- **SC-001:** The real map passes production concern extraction in CI.
- **SC-002:** Status explains every live `ranking_unavailable` result.
- **SC-003:** Orientation and docs search agree on ranking readiness per snapshot.
- **SC-004:** The SessionStart intent query succeeds in both installed clients.
