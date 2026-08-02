---
title: Production documentation corpus isolation and governing-owner priority design
doc_type: spec
artifact_type: design
status: draft
owner: platform
last_reviewed: 2026-08-02
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Technical Design

## Overview

Add one pure, repository-relative documentation corpus policy in the domain
layer. Snapshot indexing and `docs_current_for_task` apply it before reading or
scoring Markdown. Snapshot docs coverage records the policy version and bounded
exclusion aggregates. Ranked search accepts only a snapshot built with the
current corpus policy. Exact concern resolution makes a valid matched owner the
strongest intent evidence, with authority/currency and deterministic ties
ordering owners. The ranking policy advances and old transient universes are
removed explicitly.

## Requirement Coverage

| Requirement | Acceptance criteria | Design coverage | Validation approach |
| --- | --- | --- | --- |
| Requirement 1 | AC1-AC6 | shared corpus classifier, two admission integrations, and excluded-owner evidence | unit, extraction, current-doc tests |
| Requirement 2 | AC1-AC6 | versioned docs coverage, exclusion receipt, readiness gate, and map-less compatibility | contract/store/query tests |
| Requirement 3 | AC1-AC6 | explicit owner-priority component and deterministic ranking | policy, pagination, MCP golden tests |
| Requirement 4 | AC1-AC4 | v2 ranking identity and transient migration | schema migration and cursor tests |
| Requirement 5 | AC1-AC4 | containing-product and selected-fixture-root fixture | integration and leakage assertions |
| Requirement 6 | AC1-AC3 | durable promotion map and explicit residual boundaries | docs checks and closure review |

## Correctness Property Coverage

| Property | Design behavior | Validation direction | Notes |
| --- | --- | --- | --- |
| CP-001 | classifier receives only selected-root-relative POSIX paths | table-driven unit tests over both root shapes | no absolute path input |
| CP-002 | both surfaces import the same domain function | parity test over identical catalog entries | no duplicate predicates |
| CP-003 | corpus selection returns eligible/excluded partitions and aggregates | property/table tests plus count contracts | no excluded content reads |
| CP-004 | matched valid owner gets owner-intent precedence | generated candidate permutations | use existing Vitest, no new dependency |
| CP-005 | stable sort and version-bound universe identity | pagination/permutation tests | exact reproducibility |
| CP-006 | missing/mismatched corpus version blocks | store/readiness/MCP tests | refresh action only |
| CP-007 | excluded mapped owner has reason but no document/candidate identity | concern-index and ranking tests | additive owner state |

## High-Level Design

### System Architecture

```text
catalog Markdown paths
        |
        v
shared documentation corpus policy
   | eligible                 | excluded(reason,count)
   v                          v
snapshot docs admission       bounded coverage receipt
   |                          |
   +--> docs index + concern index + corpus policy version
   |
   +--> docs_search readiness -> exact concern candidate union -> owner-first ranking

catalog Markdown paths -> same policy -> docs_current_for_task scoring/classification
```

The classifier belongs in `src/domain/policies/`; application use cases consume
it, and interface adapters remain thin.

### Components And Changes

- `src/domain/policies/documentation-corpus.ts` (new): normalize a
  repo-relative path, classify embedded fixture structure, return a stable
  eligible/excluded result, and partition/count Markdown entries.
- `src/domain/policies/index.ts`: export the policy.
- `src/application/use-cases/index-repository-graph.ts`: apply the policy to
  merged docs files before any content read or concern-owner admission; build
  exact coverage from the partition.
- `src/application/use-cases/document-currency-routing.ts`: receive the same
  corpus decisions during concern indexing; represent a mapped excluded owner
  without direct-reading it or assigning a document identity.
- `src/application/use-cases/current-docs-for-task.ts`: apply the same policy
  before scoring, owner loading, and reading candidates; expose bounded
  exclusion evidence.
- `src/application/use-cases/query-docs.ts`: apply the same policy to the live
  `docs_overview`/`docs_map` inventory loader before content reads, so all live
  documentation inventory surfaces use the production corpus.
- `src/application/use-cases/documentation-ranking-readiness.ts` and
  `query-docs.ts`: require the current corpus-policy identity before success.
- `src/domain/policies/docs-ranking.ts`: treat valid exact matched-owner intent
  as stronger than non-owner lexical bands; preserve authority, currency,
  lexical, path, and ID ordering within the appropriate tier.
- `src/contracts/runtime-docs-contracts.ts` and
  `runtime-response-contracts.ts`: own corpus version, bounded exclusion/count
  fields, and advanced ranking-policy version.
- `src/infrastructure/sqlite/graph-store.ts`: persist/read corpus policy identity
  and exclusion counts; migrate ranked-universe constraints and clear v1
  transient universes.
- Existing MCP registries remain adapters over application results.

### Data Models

Provisional internal vocabulary, subject to T002 schema confirmation:

```text
DocumentationCorpusDecision =
  | { eligible: true }
  | { eligible: false; reason: "embedded_fixture" }

DocumentationCorpusReceipt = {
  policy_version: "production-docs-v1",
  discovered_markdown_files: number,
  eligible_markdown_files: number,
  excluded_markdown_files: number,
  exclusions: [{ reason: "embedded_fixture", count: number }]
}

DocumentationConcernOwnerEvidence +=
  | { state: "excluded", exclusion_reason: "embedded_fixture", document_id: absent }

DocsGoverningOwnerPriority =
  | "current_canonical_owner"
  | "other_valid_owner"
  | "non_owner"
  | "invalid_owner"
  | "invalid_conflicting_owner"
```

The public shape remains bounded: stable reason plus aggregate count, with no
unbounded path list or content. T002 selects an additive `IndexCoverage` form
on the existing same-snapshot docs row: `documentation_corpus_policy_version`,
`policy_excluded_files`, and `policy_exclusions`. Existing
`eligible_files_seen` becomes the exact policy-eligible Markdown count for docs
coverage, and `indexed_files` remains the persisted searchable document count.
The public `DocumentationCorpusReceipt` is projected from those fields and is
also returned by `docs_current_for_task`; it includes `discovered_markdown_files`
so `discovered = eligible + excluded` is directly auditable.

### Data Flow

1. Scanner returns repository-relative entries under the selected root.
2. Existing path policy removes secrets/generated/vendor content.
3. The corpus policy partitions Markdown paths structurally.
4. Excluded entries contribute only stable aggregate evidence; their content is
   not read and no document/FTS row is written. If the documentation map names
   one, its concern-owner row records `excluded` plus `embedded_fixture` without
   `document_id`.
5. Eligible entries follow the existing single docs index and concern-index
   path. Exact mapped owners consult the same corpus decision before any bounded
   direct owner read; excluded owners write only state/reason evidence.
6. The published snapshot records `production-docs-v1` and exact counts.
7. `docs_search` verifies the selected snapshot's corpus identity, unions FTS
   and exact owner candidates, and orders them under the new ranking policy.
8. `docs_current_for_task` uses the same step-3 decision on its live catalog.

## Low-Level Design

### Corpus Classification

The minimum required excluded structure is a repo-relative path below
`tests/fixtures/<fixture-root>/`. Matching is segment-based, case-normalized
where existing path policy does so, and POSIX-normalized. The classifier never
receives or inspects the absolute repository path. Selecting
`tests/fixtures/<fixture-root>` as repo root changes the catalog path to
`README.md` or `docs/...`, so it remains eligible without a special fixture-mode
switch.

```text
classifyDocumentationCorpusPath(relativePath):
    normalize canonical repo-relative segments
    if segments start with ["tests", "fixtures"] and contain a descendant:
        return excluded("embedded_fixture")
    return eligible
```

Broader structural forms may be added only when fixture-backed evidence proves
them; basename/content guesses are forbidden.

### Count Semantics

The corpus partition is calculated once per surface. For snapshot indexing:

```text
discovered = eligible + policy_excluded
eligible = indexed + truthfully_skipped_eligible
searchable = persisted eligible documents within snapshot/scope
```

The complete ranked-universe receipt derives searchable counts from persisted
eligible documents. Priority scan counts use the same eligibility definition.
Exclusions are reported separately and cannot inflate searchable or candidate
counts.

### Ranking Algorithm

Exact concern resolution is proof of intent. Ranking v2 adds a public
`governing_owner_priority` component derived from matched owner state plus the
candidate's truthful authority/currency evidence. Its order is:

1. `current_canonical_owner`;
2. `other_valid_owner`;
3. `non_owner`;
4. `invalid_owner`;
5. `invalid_conflicting_owner`.

The final v2 tuple is governing-owner priority, relevance band, existing
governing-owner tier, authority, currency, optional lexical score, normalized
path, then stable document ID. This makes the current canonical owner precede
draft/supporting owners and every non-owner mention without a hidden comparator.
Policy-excluded owners have no candidate identity and never enter the tuple.
Unmatched queries give every candidate `non_owner`, so their existing relevance,
authority, currency, score, path, and ID order is unchanged. Ranking components
and reasons expose the same tuple. Deprecated aggregate `score` remains
compatibility-only.

### Policy Versions And Migration

- Add `DOCUMENTATION_CORPUS_POLICY_VERSION = "production-docs-v1"`.
- Advance `DOCS_RANKING_POLICY_VERSION` from `authority-aware-v1` to
  `authority-aware-v2`.
- Add `excluded` plus `exclusion_reason` to documentation concern-owner evidence
  and transactionally rebuild `documentation_concern_owners` so excluded rows
  require no `document_id`; matched-owner candidate reads continue to join only
  rows with document identities. Add `governing_owner_priority` to v2 final
  rank components.
- Snapshot docs readiness reads the snapshot-bound docs coverage row before
  term, owner, or candidate retrieval and requires the current corpus policy.
  Missing or mismatched identity returns the existing public
  `ranking_unavailable` blocker together with a documentation-ranking receipt
  whose recovery is `refresh` and whose bounded reason identifies the missing
  or mismatched corpus policy. `repo:///status` remains the detailed operator
  recovery surface; no second public blocker route is introduced.
- Migration removes expired/incompatible v1 ranked universes and recreates or
  relaxes the transient table constraint for v2 using the repository's normal
  transactional migration pattern.
- Existing graph/document rows are not rewritten as if they were v1-compliant;
  a normal refresh publishes a current corpus snapshot.
- There is no legacy comparator or query-time cleanup fallback.

### Error Handling

- Invalid repo-relative paths fail classification rather than being admitted.
- Missing corpus policy identity blocks ranked docs use with a refresh action.
- A current corpus with `authority_map: absent` remains non-blocking and uses
  relevance ranking without owner-intent evidence.
- Store migration failure keeps the runtime unavailable/blocked and preserves
  the prior database transactionally.
- Old/tampered cursors retain the existing `ranking_cursor_invalid` response
  and cursor-free restart action.
- Excluded document read attempts in tests are failures, proving admission
  occurs before content access.

### Security, Trust, And Access

No network, command execution, or workspace mutation is introduced. Excluded
content is not read or surfaced. Public attribution uses stable reason/count
only. Existing path containment, secret exclusion, redaction, and trust
vocabulary remain authoritative.

### Migration And Compatibility

The public ranking order intentionally changes but request shapes remain
compatible. Policy/version fields are additive except for the value of the
existing ranking policy literal. Stored frozen universes are ephemeral and may
be deleted. Published compatible graph evidence is preserved, while docs search
waits for a new policy-compliant docs snapshot rather than returning polluted
success.

### Slice Boundary And Residual Architecture

| Design target | In this slice | Out of this slice | Follow-up destination | Blocks closure? |
| --- | --- | --- | --- | --- |
| production corpus isolation | embedded `tests/fixtures/**`, both docs surfaces, fixture-root preservation | arbitrary user-configured corpus rules | EB064 follow-up only if evidence appears | yes |
| exact owner priority | exact documentation-map concern matches | fuzzy/synonym intent inference | EB054/EB064 backlog route if requested | yes |
| truthful counts/version | current corpus policy and bounded exclusion aggregates | ranked-universe capacity | EB059 | yes |
| validation-plan payloads | none | skipped-path compaction | EB065 | no |
| other ecosystems | none | language/framework semantics | EB010 | no |

## Validation Strategy

| Validation | Covers | Evidence location | Residual risk |
| --- | --- | --- | --- |
| corpus policy table/property tests | Requirement 1, CP-001, CP-002 | focused Vitest | broader fixture conventions remain evidence-gated |
| extraction/store/current-doc tests | Requirement 1, Requirement 2, Requirement 5, CP-003, CP-006, CP-007 | focused Vitest and SQLite inspection | installed refresh still needs smoke proof |
| ranking permutations and exact SessionStart regression | Requirement 3, Requirement 5, CP-004, CP-005, CP-007 | policy/MCP tests | none expected for exact concern |
| migration/cursor tests | Requirement 4, CP-005, CP-006 | graph-store tests | platform ABI covered by normal CI matrix |
| full CI gates and dogfood | Requirement 5, Requirement 6 | `verification.md` | external provider acceptance only if needed |

## Downstream Task Guidance

- Required checkpoints before implementation: lifecycle lint, design review,
  schema/migration seam confirmation, and task readiness.
- CP-001 through CP-007 need explicit test or conventional invariant coverage.
- No new property-test dependency is needed; deterministic Vitest tables and
  generated permutations are sufficient.
- Review is required for architecture layering, public contracts, SQLite
  migration, documentation authority, and closure promotion.

## Operational Considerations

After install/restart, a prior snapshot without corpus-policy identity is
truthfully blocked until refresh publishes replacement docs evidence. Progress
and failure use existing status/readiness routes. No background retry, alternate
query, or partial filtered result is introduced.

## Open Questions

No blocking product decision is open. T002 must confirm whether the current
`snapshot_index_coverage` row can carry all required identity/aggregate fields
additively or whether one same-snapshot corpus-state table is cleaner.

## Related Artifacts

- Requirements: `requirements.md`
- Change Impact: `change-impact.md`
- Tasks: `tasks.md`
- Verification: `verification.md`
