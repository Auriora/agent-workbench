---
title: Production documentation corpus isolation and governing-owner priority requirements
doc_type: spec
artifact_type: requirements
status: draft
owner: platform
last_reviewed: 2026-08-02
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Requirements

## Introduction

Documentation routing currently has authority and currency evidence but does
not consistently isolate production documentation from embedded test fixtures.
Its ranking tuple can also place a supporting lexical mention ahead of the
exact concern's governing owner. This spec defines one corpus-admission policy
and one exact-intent owner-priority rule shared by the affected read surfaces.

## Goals

- Exclude embedded fixture documentation from a containing product
  repository's documentation corpus before indexing or task classification.
- Preserve normal documentation behavior when a fixture is itself the selected
  repository root.
- Rank the current canonical owner of an exactly matched concern before
  non-owner supporting or draft mention evidence.
- Keep corpus counts, coverage, trust, and upgrade behavior truthful.

## Non-Goals

- Choosing or changing EB059 ranked-universe capacity, population, eviction,
  or cursor-retention policy.
- Compacting EB065 validation-plan skipped-path payloads.
- Adding query-time fixture-name filtering, a second search route, fallback
  ranking, or success-shaped partial output.
- Excluding all documents whose basename contains `fixture`, `sample`, or
  `example`.
- Changing general workspace source-file inclusion or deleting fixture files.

## Glossary

| Term | Definition |
| --- | --- |
| Production documentation corpus | Markdown documents eligible for documentation routing relative to the selected repository root. |
| Embedded fixture documentation | Markdown below a repository-relative test-fixture root in a containing repository. |
| Selected fixture root | A fixture directory opened as the repository root, making its contents ordinary root-relative repository content. |
| Governing owner | A documentation-map owner for an exactly matched concern whose owner state is valid for routing. |
| Corpus policy version | Persisted identity proving a snapshot was built with the current production-document eligibility policy. |

## Durable Source Baseline

| Source | Current behavior relied on | Confidence | Notes |
| --- | --- | --- | --- |
| `docs/backlog/README.md` | EB064 problem, acceptance, sequencing, and exclusions | high | Backlog is authoritative until this spec is accepted. |
| `docs/reference/documentation-map.md` | Concern terms and canonical owners | high | Owns the SessionStart concern mapping. |
| `docs/design/mcp-surface-design.md` | Ranked documentation query and frozen-universe behavior | high | Current policy is relevance before owner. |
| `docs/design/graph-store-design.md` | Snapshot docs index, concern index, counts, and persisted ranked universes | high | Storage and migration owner. |
| `docs/reference/runtime-contracts.md` | Public ranking fields, count receipts, trust, and failure semantics | high | Contract owner. |
| `docs/reference/dogfood-evidence-ledger.md` | Installed-runtime reproduction | high | Dated evidence, not current behavior authority. |

## Durable Impact

See `change-impact.md`. Accepted behavior must be promoted to the documentation
map, MCP surface design, graph-store design, runtime contracts, runtime
requirements, MVP proof matrix, backlog, dogfood ledger, and agent-readable
changelog as applicable before closure.

## Staged Readiness

- **Current stage:** source implementation, validation, and durable-documentation
  promotion complete; the package remains active
- **Next stage:** installed-runtime acceptance, evidence reconciliation, and an
  explicit closure decision
- **Implementation entry evidence:** lifecycle lint, requirements/design trace
  review, task readiness, and corpus-version migration review had no blocking
  finding before implementation
- **Design-first exception:** no
- **Optional artifacts included:** `research.md`, `canonical-context.md`,
  `change-impact.md`, `traceability.md`, `verification.md`
- **Downstream review needed:** requirements, design, tasks, traceability,
  implementation, migration, and documentation-authority review

## Requirements

### Requirement 1: One Root-Relative Production Corpus Policy

**User Story:** As a coding agent, I want documentation routing to use product
documentation rather than embedded test fixtures, so that first-page evidence
represents the selected repository.

**Priority:** must-have

#### Acceptance Criteria

1. GIVEN a product repository containing Markdown below an embedded test-fixture root, WHEN snapshot documentation admission runs, THEN THE SYSTEM SHALL exclude those documents before content indexing and concern-owner admission.
2. GIVEN the same product repository, WHEN `docs_current_for_task` classifies documentation, THEN THE SYSTEM SHALL apply the same eligibility decision before scoring or reading candidate content.
3. GIVEN a fixture directory selected as the repository root, WHEN either surface runs, THEN THE SYSTEM SHALL treat root-relative `README.md` and `docs/**` content as eligible unless another existing path policy excludes it.
4. THE SYSTEM SHALL base fixture isolation on canonical repository-relative path structure and selected-root identity, not on an absolute host path, document basename, query text, or content substring.
5. THE SYSTEM SHALL expose one shared policy implementation and stable exclusion reason; surface-specific duplicate fixture predicates are forbidden.
6. IF an exact documentation-map concern names an owner excluded by the corpus policy, THEN THE SYSTEM SHALL retain bounded owner evidence with state `excluded` and reason `embedded_fixture`, omit `document_id`, and SHALL NOT admit that owner as a ranked candidate.

### Requirement 2: Truthful Corpus Coverage And Attribution

**User Story:** As a coding agent, I want counts and trust receipts to describe
the same corpus that was actually searched, so that completeness claims remain
auditable.

**Priority:** must-have

#### Acceptance Criteria

1. WHEN documentation indexing completes, THEN THE SYSTEM SHALL persist coverage and corpus-policy identity for the exact eligible production corpus.
2. WHEN `docs_search` returns a complete ranked universe, THEN searchable counts, priority-scan counts, and filter bases SHALL describe the same policy-eligible corpus.
3. WHEN embedded fixture documents are excluded, THEN THE SYSTEM SHALL expose a bounded stable reason and exact aggregate count without reading, returning, or logging excluded document content.
4. IF a selected snapshot lacks the current corpus-policy identity, THEN THE SYSTEM SHALL return a structured refresh-required blocked state rather than query-time filtering or success over a known polluted corpus.
5. Existing indexed, eligible, skipped, and searchable count equations SHALL remain internally consistent after policy exclusions.
6. WHERE the corpus-policy identity is current and the documentation authority map is absent, THE SYSTEM SHALL preserve the existing non-blocking relevance-ranked search behavior and truthful `authority_map: absent` evidence.

### Requirement 3: Exact-Concern Governing-Owner Priority

**User Story:** As a coding agent, I want the document that governs an exact
concern to appear before documents that merely mention it, so that my first
read starts from authority.

**Priority:** must-have

#### Acceptance Criteria

1. GIVEN an exact concern match with one current canonical valid owner, WHEN ranked documentation candidates include that owner and non-owner draft or supporting lexical mentions, THEN THE SYSTEM SHALL rank the owner first.
2. GIVEN multiple valid owners for an exact concern, WHEN they are ranked, THEN THE SYSTEM SHALL prioritize a current canonical valid owner and order equal owner-priority candidates deterministically by relevance, authority, currency, lexical evidence, normalized path, and stable document identity.
3. GIVEN no exact concern match, WHEN candidates are ranked, THEN THE SYSTEM SHALL retain the existing relevance, authority, currency, and deterministic tie-break behavior.
4. Missing, archived, superseded, or conflicting mapped owners SHALL retain their existing caveats and SHALL NOT receive valid governing-owner priority.
5. Ranking reasons and final rank components SHALL explain the actual comparison order without relying on deprecated aggregate score.
6. Policy-excluded mapped owners SHALL retain their exclusion reason and SHALL NOT receive governing-owner priority or become FTS/owner-union candidates.

### Requirement 4: Ranking And Storage Compatibility

**User Story:** As an operator, I want the ranking change to invalidate
incompatible transient state explicitly, so that old cursors cannot silently
cross policy versions.

**Priority:** must-have

#### Acceptance Criteria

1. WHEN exact-owner comparison behavior changes, THEN THE SYSTEM SHALL advance the ranking-policy version used by contracts, frozen-universe identity, and cursor validation.
2. Existing frozen ranked universes from the prior policy SHALL be expired or removed through one explicit migration path; they SHALL NOT be interpreted as the new policy.
3. The migration SHALL preserve published graph and documentation evidence that remains compatible and SHALL NOT add a legacy ranking fallback.
4. Invalid old cursors SHALL return the existing structured restart action and SHALL NOT rebuild a universe implicitly.

### Requirement 5: Cross-Surface And Fixture-Root Regression Proof

**User Story:** As a maintainer, I want regressions at both repository-root
shapes and public documentation surfaces, so that the isolation rule cannot
erase fixtures or drift between routes.

**Priority:** must-have

#### Acceptance Criteria

1. A containing-product fixture SHALL prove embedded fixture docs are absent from the persisted docs index, `docs_search`, and `docs_current_for_task`.
2. Selecting the embedded fixture directory itself as repo root SHALL prove the same Markdown is indexed and returned normally.
3. The exact SessionStart query SHALL prove `docs/design/coding-agent-integration-design.md` ranks ahead of `docs/reference/dogfood-evidence-ledger.md` and `docs/backlog/README.md` on a complete eligible universe.
4. Regression tests SHALL prove count conservation, document and mapped-owner exclusion attribution, non-blocking map-less behavior under the current corpus policy, corpus-policy mismatch blocking, old-cursor rejection, and no excluded-content leakage.

### Requirement 6: Promotion And Scope Discipline

**User Story:** As a maintainer, I want accepted behavior promoted to canonical
documentation without absorbing adjacent backlog policy, so that the completed
spec can be removed safely.

**Priority:** must-have

#### Acceptance Criteria

1. BEFORE closure, THE SYSTEM'S accepted corpus, ranking, migration, count, trust, and failure behavior SHALL be promoted to the durable owners named in `change-impact.md`.
2. EB064 SHALL be marked delivered only after implementation and validation evidence exists.
3. EB059 capacity/eviction policy, EB065 payload compaction, and unrelated language/runtime work SHALL remain separately owned.

## Correctness Properties

- **CP-001 Root relativity:** Moving a documentation tree from an embedded
  fixture path to the selected repository root changes only the corpus-policy
  eligibility implied by its new repository-relative path.
- **CP-002 Surface parity:** For the same scanned Markdown entry and selected
  root, snapshot admission and `docs_current_for_task` produce the same corpus
  eligibility and reason.
- **CP-003 Count conservation:** Discovered production-eligible documents equal
  indexed plus truthfully skipped eligible documents; policy-excluded documents
  are counted separately and never become searchable.
- **CP-004 Owner dominance:** For an exact matched concern with a valid current
  canonical owner, every non-owner draft/supporting mention ranks after that
  owner regardless of lexical score.
- **CP-005 Determinism:** Identical eligible candidates, concern evidence,
  authority, currency, and policy versions produce identical order, counts,
  reasons, and cursors.
- **CP-006 No stale-policy success:** A snapshot without current corpus-policy
  identity cannot produce a successful ranked documentation response.
- **CP-007 Excluded-owner truth:** A policy-excluded mapped owner is represented
  as excluded with no document identity or candidate row and cannot affect rank.

## Technical Context

- **Language/Version:** TypeScript ESM on the repository-supported Node.js range
- **Primary Dependencies:** Vitest, SQLite/FTS, deterministic file catalog,
  documentation concern index
- **Target Platform:** Local Agent Workbench daemon and MCP surfaces
- **Constraints:** one implementation path; fail closed; no query-time corpus
  fallback; no arbitrary new capacity constant; no excluded-content leakage
- **Performance Goals:** corpus classification is linear over already-scanned
  Markdown paths and requires no extra content read for excluded entries

## Success Criteria

- **SC-001:** No embedded fixture document appears in production
  `docs_current_for_task` or `docs_search` results.
- **SC-002:** The same fixture is normally usable when selected as repo root.
- **SC-003:** The exact SessionStart query returns the governing design first.
- **SC-004:** Counts, exclusion reasons, policy versions, and trust state pass
  contract and fixture regressions without a new extraction cap.

## Related Artifacts

- Change Impact: `change-impact.md`
- Design: `design.md`
- Tasks: `tasks.md`
- Verification: `verification.md`
