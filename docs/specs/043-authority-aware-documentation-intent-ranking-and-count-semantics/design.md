---
title: Authority-aware documentation intent ranking and count semantics design
doc_type: spec
artifact_type: design
status: draft
owner: platform
last_reviewed: 2026-07-20
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Technical Design

## Overview

SQLite remains the one bounded FTS candidate source. Coordinated indexing also
extracts documentation-map concern ownership into the same graph snapshot. A
pure application/domain policy resolves exact concern terms, unions every
repository-present matched owner with the FTS candidates, and ranks the
complete distinct candidate universe. A snapshot/query/scope/policy-bound ranked
universe is persisted before the presenter emits any page. Public receipts name
ranking components, compatibility score semantics, count universes, and
filters explicitly.

## Current And Intended Ownership

| Responsibility | Current owner | Intended Spec 043 owner |
| --- | --- | --- |
| bounded docs FTS candidate retrieval | `src/infrastructure/sqlite/graph-store.ts` through `DocsIndexPort` | unchanged; retrieve up to 501 rows |
| docs-search orchestration | `src/application/use-cases/query-docs.ts`, delegating search to `DocsIndexPort` | coordinate resolution, freeze, lookup, and presentation inputs |
| documentation-map routing | `src/application/use-cases/document-currency-routing.ts` | indexing extraction delegates to a deterministic concern contract |
| authority classification | `src/domain/policies/document-authority.ts` | unchanged input to ranking policy |
| concern and final-rank policy | not currently present | pure application/domain modules; no SQLite or presenter policy |
| frozen ranked universe | not currently present | a port with SQLite implementation bound to graph snapshot lifetime |
| public docs result | contracts and `query-docs.ts`; MCP adapter remains thin | presenter/contract mapping only; no recomputation |

The pure ranking policy is target state, not a claim about the shipped code.

## Confirmed Root Cause

Current docs ranking adds FTS, path, field, authority, and currency scores.
Canonical/current status contributes only a small increment, so a lexical score
in the hundreds can dominate it. `docs_search` does not consume the
documentation-map owner signal used by current-document routing. SQLite
applies an offset and a bounded candidate limit before application handling,
so the current cursor does not identify a frozen final order.

`indexed_docs_count` describes merged searchable documents, while
`index_coverage.docs.indexed_files` describes the dedicated priority scan. Both
may be truthful, but their labels omit universe and filter basis.

## Requirement Coverage

| Requirement | Design coverage | Validation |
| --- | --- | --- |
| Requirement 1 | concern normalization/resolution; relevance bands; rank tuple and reasons | concern and ranking policy tests |
| Requirement 2 | extraction, schema, migration/backfill, publication, one-to-many ownership | graph publication and ownership fixtures |
| Requirement 3 | 500+sentinel retrieval; persisted complete universe; bound cursor | boundary and property tests |
| Requirement 4 | preserved aggregate score; lexical score; tuple; exact count/filter fields | contract, consumer, and presentation tests |

## High-Level Design

Coordinated indexing publishes explicit documentation concerns and owner rows
with the graph snapshot. Query orchestration resolves exact concerns, requests
one bounded FTS set, loads matched owners from the same snapshot, forms a
stable-ID-distinct union, applies a pure total-order policy, freezes the complete
ranked universe, and then presents page slices and trust receipts. The component
flow below fixes the dependency direction.

## Concern Ownership Index

### Documentation-Map Source Shape

The documentation map remains canonical. Its owner registry is extended with an
explicit `Intent terms` column (or an equivalently structured field selected in
the durable promotion). Each cell is a semicolon-delimited list. The concern
label itself is always an indexed phrase; intent terms add exact aliases. Empty
terms, normalized duplicates, and owner links escaping the repository are
rejected during publication. No synonym generation is allowed.

The owner relation is one-to-many in both directions:

```text
documentation_concern(concern_key, label, normalized_label)
documentation_concern_term(concern_key, normalized_term, token_count)
documentation_concern_owner(concern_key, document_id, owner_state)
```

Primary/foreign keys and deterministic sorted insertion make duplicate rows
impossible. Public status remains independently derived from document metadata.
The exhaustive owner-state behavior is:

| Owner state | Governing-owner tier | Required caveat/status behavior |
| --- | --- | --- |
| `valid` | `valid_owner` | no ownership caveat; truthful document status still applies |
| `draft` | `valid_owner` | retain `doc_status: draft` and direct-read caveat |
| `missing` | `invalid_owner` | missing-owner governance inconsistency; no candidate document is admitted |
| `archived` | `invalid_owner` | archived-owner caveat; retain archived document status if the document remains indexed |
| `superseded` | `invalid_owner` | superseded-owner caveat and `superseded_by` evidence |
| `conflicting` | `invalid_conflicting_owner` | bounded conflicting-owner evidence naming all conflicting rows |

A document not related to any matched concern is `non_owner`. One document with
several matched relations receives the best tier only when at least one relation
is `valid` or `draft`; every invalid/conflicting relation remains in its reasons.

### Normalization

The indexer and query resolver share one pure function:

1. apply Unicode NFKC;
2. lowercase without locale-specific expansion;
3. replace every character in Unicode general categories Punctuation, Symbol,
   or Separator (`P*`, `S*`, or `Z*`) run with one ASCII space;
4. collapse ASCII whitespace and trim;
5. split tokens on the remaining ASCII spaces.

Normalized empty strings do not index or match. `SessionStart`, `sessionstart`,
and `SESSIONSTART` normalize to `sessionstart`; `session-start` normalizes to
`session start` and is therefore a different two-token phrase unless both forms
are explicitly registered.

### Exact Resolver

- A multi-token term matches only a contiguous equal token subsequence of the
  normalized query.
- A single-token term matches only an equal query token.
- All matching concerns are returned.
- Match evidence contains normalized term, query token span, token count,
  concern key, owner document IDs, and owner states.
- Matches sort by descending term token count, normalized concern key, and
  normalized owner path. Duplicate evidence for the same concern/term/span is
  collapsed.
- No match returns `concern_match_state: no_match`, an empty evidence list, and
  no owner tier. The runtime does not guess from paths or broad-read the map.

For `What rule governs SessionStart behavior?`, the explicitly registered
`SessionStart` term maps to `Coding-agent integrations`; the mapped coding agent
integration design is therefore eligible for the owner tier. `Session startup
diagnostics` does not match that term. A query matching `runtime contracts` and
`graph schema` retains both concerns and both valid owners.

## Ranking Model

### Relevance Bands

Each distinct FTS-plus-owner candidate enters exactly one band, computed without
authority:

1. `exact_document_phrase`: the normalized query phrase occurs in indexed
   title or heading evidence;
2. `all_query_tokens_title_or_heading`: every normalized query token is present
   in indexed title/heading evidence;
3. `all_query_tokens_body`: every normalized query token is present in indexed
   body evidence;
4. `intent_owner_match`: the document is a repository-present owner of an exact
   matched concern but is not in an all-token FTS band;
5. `partial_fts_match`: SQLite FTS matched fewer than all query tokens and the
   candidate has no exact matched-owner relation.

The resolver records `candidate_source: fts`, `matched_owner`, or
`fts_and_matched_owner`. Exact concern evidence establishes only the explicit
`intent_owner_match` relevance band; governing-owner tier remains the next tuple
component. An FTS candidate that is also an owner keeps its stronger all-token
band, or uses `intent_owner_match` instead of `partial_fts_match`. Empty queries
remain invalid under the existing request contract. A relevance-band tie never
depends on ownership or authority.

### Deterministic Final Tuple

The pure rank policy produces, in comparison order:

1. relevance-band ordinal;
2. governing-owner tier (`valid owner`, `non-owner`, `invalid/conflicting owner`);
3. truthful authority tier;
4. truthful currency tier;
5. optional `lexical_score`, the raw SQLite lexical score, present before absent
   and descending when present;
6. normalized repo-relative path, ascending;
7. stable document ID, ascending.

This is the public `final_rank_components`; there is no aggregate numeric final
score. The existing `score` field retains its shipped aggregate
lexical/path/field/authority/currency calculation as a deprecated compatibility
field. The new optional `lexical_score` exposes the raw SQLite lexical value for
FTS candidates and is absent for owner-only candidates; it is the only numeric
score in the tuple. An owner-only hit computes legacy `score` through the shipped
aggregate formula with a zero lexical contribution, because that result shape
did not previously exist. Results also expose `ranking_policy_version`,
matched-concern evidence, candidate source, and concise reasons. Consumer tests
prove that resorting by either numeric field is unsupported and that legacy
`score` meaning did not change.

Draft valid owners retain draft status/caveats. Missing, archived, superseded,
or conflicting owner relations receive no valid-owner tier and emit a bounded
governance inconsistency.

## Complete Frozen Pagination

### Candidate Boundary

SQLite executes one normalized query/scope retrieval ordered by its stable FTS
ordering with `LIMIT 501` and no page offset. Query orchestration separately
loads at most 501 distinct owner document IDs for the exact matched concerns,
in stable document-ID order, from the selected snapshot. It resolves only those
bounded repository-present documents within the selected scope and unions both
sources by stable document ID. No broad workspace read occurs. Outcomes after
distinct union are:

- `0..499`: complete and eligible to freeze;
- `500`: complete and eligible to freeze;
- `501` or more: overflow is proved, so return
  `candidate_universe_exceeds_limit`, zero hits, no cursor, and a narrowing
  action. Candidate 501 is a sentinel and is never ranked or presented.

An FTS or owner-query sentinel proves overflow immediately because that source
alone has more than 500 distinct documents. When neither sentinel exists, both
source sets are completely known and the distinct union size is exact. The 501
behavior therefore also applies when an owner added outside FTS becomes
distinct union row 501. The runtime does not incorrectly present 500 supporting
documents as complete. This intentionally chooses correctness over partial
search results.

### Frozen Universe Repository

Before the first page, `query-docs.ts` asks the pure policy to rank the complete
set and persists an immutable ordered list of stable document IDs plus final
rank components. Its identity hashes:

- snapshot ID;
- normalized query;
- normalized scope path;
- retrieval bound (`500`);
- ranking schema and policy versions.

The record lives no longer than its graph snapshot and has a bounded expiry for
abandoned queries. The first response and every cursor reference the universe
ID and next position. Later pages load this record; they do not re-query FTS or
rerank. Missing/expired records return structured stale evidence. A changed
identity returns invalid input. A large page and concatenated small pages slice
the same stored list and must therefore be identical.

## Count And Filter Receipt

| Field | Universe | Filter basis |
| --- | --- | --- |
| `searchable_snapshot_documents_count` | all searchable Markdown in selected snapshot | `searchable_filter_basis: merged_graph_and_priority_markdown` |
| `searchable_scope_documents_count` | searchable snapshot documents under selected scope | `scope_filter_basis: repo_root` or `normalized_scope_path` |
| `fts_candidate_documents_count` | distinct FTS rows admitted before union | `query_filter_basis: normalized_fts_match_within_scope` |
| `matched_owner_candidate_documents_count` | repository-present exact matched-owner documents admitted before union | `query_filter_basis: exact_matched_concern_owners_within_scope` |
| `candidate_union_documents_count` | distinct stable document IDs across both candidate sources | `query_filter_basis: distinct_fts_and_exact_owner_union_within_scope` |
| `ranked_candidate_universe_count` | complete frozen candidate union after ranking | `query_filter_basis: distinct_fts_and_exact_owner_union_within_scope` |
| `returned_page_documents_count` | current frozen-universe page slice | `page_filter_basis: frozen_universe_position_and_requested_page_size` |
| `priority_scan_eligible_markdown_files_count` | Markdown seen by dedicated priority scan | `priority_scan_filter_basis: configured_priority_roots` |
| `priority_scan_indexed_markdown_files_count` | eligible priority files indexed | same priority filter basis |
| `priority_scan_skipped_markdown_files_count` | eligible priority files skipped | same priority filter basis plus bounded reason summary |

On overflow, `ranked_candidate_universe_count` is absent because no complete
universe exists. The other source/union counts are exact when FTS returned at
most 500 rows; when the FTS sentinel is present, the blocker instead records
`fts_candidate_count_lower_bound: 501` and
`candidate_union_count_lower_bound: 501`.
Priority coverage state remains independent. Existing ambiguous fields remain
temporary additive aliases and their documented legacy meanings do not change.

## Component Flow

```text
index-repository-graph
  -> parse documentation map and owner documents
  -> migrate/backfill concern/term/owner rows
  -> publish graph snapshot atomically

query-docs
  -> normalize query and resolve exact concerns from snapshot rows
  -> DocsIndexPort retrieves 500 + overflow sentinel from SQLite FTS
  -> load repository-present matched-owner documents from the same snapshot
  -> union both sources by stable document ID and enforce the distinct cap
  -> pure ranking policy orders the complete candidate universe
  -> RankedDocsUniversePort persists immutable ordered IDs/tuples
  -> page slice and docs presenter expose contract/trust receipt
```

The MCP adapter validates input and delegates. SQLite does not assign authority
or concern tiers. The presenter does not reorder or recompute counts.

## Low-Level Design

The concern tables, normalization algorithm, candidate-source union,
owner-state mapping, rank tuple, `LIMIT 501` overflow sentinel, frozen-universe
identity, exact count/filter names, schema migration, and failure states above
are the implementation contract. T001 may choose TypeScript type layout and SQL
names only where those choices do not change this behavior.

## Schema, Migration, And Publication

The graph schema version increments. Migration creates the three concern tables
and frozen-universe tables/indexes. Existing snapshots are backfilled only by a
coordinated rebuild; a snapshot lacking the new schema is incompatible with the
new ranking policy and returns structured unavailable evidence. Publication
tests prove documents, FTS rows, concern ownership, and schema version become
visible atomically. Failed extraction/build never publishes a mixed snapshot.

## Failure And Trust Behavior

- Missing map evidence yields `no_match`/uncertainty, not a guessed owner.
- Invalid owner evidence remains visible as governance inconsistency.
- Distinct FTS-plus-owner candidate overflow blocks with no hits/cursor.
- Missing/expired frozen universe rejects continuation without rebuilding.
- Snapshot/path validity remains governed by existing freshness checks.
- Ranking and count receipts flow through trust metadata; a response never
  claims complete rank when no complete universe was frozen.
- No alternate search, broad per-query map read, hidden retry, or partial result
  fallback is introduced.

## Operational Considerations

- Index extraction and ranked-universe persistence are bounded and observable.
- Metrics record FTS, owner, and distinct-union candidate counts, overflow,
  concern matches, freeze duration, page reads, expiry, and invalid cursors
  without storing raw sensitive query text in logs.
- Ranking-policy changes invalidate old cursors intentionally.
- Query-budget tests cover 0, 499, 500, and 501 candidates.

## Durable Promotion Targets

- `docs/design/mcp-surface-design.md`
- `docs/design/graph-store-design.md`
- `docs/reference/runtime-contracts.md`
- `docs/reference/documentation-map.md`
- `docs/reference/agent-readable-changelog.md`
- `docs/backlog/README.md` EB054

## Decisions

- Candidate cap applies after a stable-ID-distinct union of FTS and exact
  matched-owner documents; incomplete universes never yield pages.
- Existing numeric `score` retains its aggregate compatibility meaning;
  `lexical_score` supplies the tuple's numeric lexical component and final order
  has no aggregate final score.
- Concern aliases are explicit documentation-map data, not inferred synonyms.
- Frozen universes are persisted and snapshot-bound before first-page output.

No product decision remains delegated to implementation tasks.

## Open Questions

None. If implementation evidence makes the 500-candidate bound, exact intent
term source shape, compatibility score, or frozen persistence model infeasible,
the package must return to requirements/design review rather than introduce an
alternate or partial route inside an implementation task.

## Related Artifacts

- Requirements: `requirements.md`
- Change impact: `change-impact.md`
- Tasks: `tasks.md`
- Verification: `verification.md`
