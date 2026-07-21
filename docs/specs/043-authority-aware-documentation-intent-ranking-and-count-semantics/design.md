---
title: Authority-aware documentation intent ranking and count semantics design
doc_type: spec
artifact_type: design
status: draft
owner: platform
last_reviewed: 2026-07-21
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
| Requirement 2 | extraction, schema, v2-to-v3 migration, current-snapshot rebuild, publication, one-to-many ownership | graph publication and ownership fixtures |
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
label itself is always an indexed phrase; intent terms add exact aliases. A
missing or blank intent cell is valid, while an empty element inside a non-empty
semicolon list and owner links escaping the repository invalidate concern-index
publication. Normalized duplicates collapse deterministically. No synonym
generation is allowed.

The owner relation is one-to-many in both directions:

```text
documentation_concern(snapshot_id, concern_key, label, normalized_label)
documentation_concern_term(
  snapshot_id,
  concern_key,
  normalized_term,
  token_count
)
documentation_concern_owner(
  snapshot_id,
  concern_key,
  owner_path,
  document_id?,
  owner_state,
  declared_canonical_owner?,
  superseded_by?,
  source_line
)
documentation_concern_index_state(
  snapshot_id,
  state: complete | no_map | invalid,
  source_path?,
  source_content_hash?,
  failure_reason?
)
```

`concern_key` is the normalized label tokens joined with `-`. Two source rows
that derive the same key are the same normalized concern and deterministically
merge their terms and owner rows. Contradiction is owner-document evidence, not
a duplicate-label condition: a mapped repository-present document conflicts
only when its normalized `canonical_owner` frontmatter names another path. The
concern index stores an explicit snapshot-scoped `complete`, `no_map`, or
`invalid` state so a repository without a map cannot be confused with an old
snapshot that lacks concern evidence or a map that could not be trusted.
All concern, term, and owner primary/foreign keys include `snapshot_id`.
Duplicate owner links collapse by `(snapshot_id, concern_key, owner_path)` and
retain the lowest source line as deterministic provenance.

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

Normalized empty strings do not index or match. Every remaining normalized
query token participates in all-token relevance tests; this slice applies no
stopword list or minimum token length. `SessionStart`, `sessionstart`,
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
governance inconsistency. Multiple map owners are valid and never constitute a
conflict by themselves. A mapped owner is `conflicting` only when that
repository-present document declares a different supported `canonical_owner`
path in its own frontmatter; conflict evidence names the map relation, mapped
path, and contradictory declared path.

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

For this slice, the stable document ID is the canonical normalized
repo-relative POSIX path stored with the selected snapshot. SQLite row IDs and
insertion order are never public or cursor identities.

The record lives no longer than its graph snapshot and has a bounded expiry for
abandoned queries. The first response and every cursor reference the universe
ID and next position. Later pages load this record; they do not re-query FTS or
rerank. Missing/expired records return structured stale evidence. A changed
identity returns invalid input. A large page and concatenated small pages slice
the same stored list and must therefore be identical.

The frozen hit record retains the existing bounded snippet. `include_snippets`
is a page-projection choice applied after slicing the frozen universe, so a
caller may include or omit snippets on first and continuation pages without
changing candidate admission, order, cursor identity, or stored evidence.

## Count And Filter Receipt

| Field | Universe | Filter basis |
| --- | --- | --- |
| `searchable_snapshot_documents_count` | all searchable Markdown in selected snapshot | `searchable_filter_basis: merged_graph_and_priority_markdown` |
| `searchable_scope_documents_count` | searchable snapshot documents under selected scope | `scope_filter_basis: repo_root` or `normalized_scope_path` |
| `fts_candidate_documents_count` | distinct FTS rows admitted before union | `query_filter_basis.fts_candidate_documents_count: normalized_fts_match_within_scope` |
| `matched_owner_candidate_documents_count` | repository-present exact matched-owner documents admitted before union | `query_filter_basis.matched_owner_candidate_documents_count: exact_matched_concern_owners_within_scope` |
| `candidate_union_documents_count` | distinct stable document IDs across both candidate sources | `query_filter_basis.candidate_union_documents_count: distinct_fts_and_exact_owner_union_within_scope` |
| `ranked_candidate_universe_count` | complete frozen candidate union after ranking | `query_filter_basis.ranked_candidate_universe_count: distinct_fts_and_exact_owner_union_within_scope` |
| `returned_page_documents_count` | current frozen-universe page slice | `page_filter_basis: frozen_universe_position_and_requested_page_size` |
| `priority_scan_eligible_markdown_files_count` | Markdown seen by dedicated priority scan | `priority_scan_filter_basis: configured_priority_roots` |
| `priority_scan_indexed_markdown_files_count` | eligible priority files indexed | same priority filter basis |
| `priority_scan_skipped_markdown_files_count` | eligible priority files skipped | same priority filter basis plus bounded reason summary |

`query_filter_basis` is one strict keyed object containing the four query count
keys shown above; it is not a scalar reused with conflicting meanings.

On overflow, `ranked_candidate_universe_count` is absent because no complete
universe exists. Each source and the union exposes exactly one of its exact
`*_documents_count` field or its matching literal-501 lower bound. The lower
bound fields are `fts_candidate_count_lower_bound`,
`matched_owner_candidate_count_lower_bound`, and
`candidate_union_count_lower_bound`. Any lower bound requires a blocked result,
zero hits, no cursor, and no ranked-universe count; either source sentinel also
requires the union lower bound.
Priority coverage state remains independent. Existing ambiguous fields remain
temporary additive aliases and their documented legacy meanings do not change.
Coverage state and truncation are mandatory on complete and overflow count
receipts. Success and overflow also require the deprecated page count/basis,
searchable snapshot count, and priority-scan coverage aliases; an unavailable
result with no count universe does not fabricate them.

## Component Flow

```text
index-repository-graph
  -> parse documentation map and owner documents
  -> write concern/term/owner rows for the current v3 build
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

The graph store identity and schema version increment from v2 to v3. When v3 is
absent and v2 exists, startup must checkpoint v2 and atomically clone it into a
temporary v3 candidate; a busy/incomplete checkpoint or clone/publish failure
blocks startup without touching either canonical file. The cloned store is then
migrated transactionally. V2 remains intact as rollback evidence and is not
retired by this slice. If v2 is absent, the existing direct-upgrade seed from
`graph.sqlite` remains valid; if no prior store exists, v3 starts empty. An
existing v3 file is never overwritten or replaced from an older identity, and
a corrupt or partial v3 fails explicitly without fallback.

Existing snapshots keep their v2 schema identity and receive no synthetic
concern rows. Only a coordinated v3 rebuild writes the explicit
concern-index state and makes authority-aware ranking usable. Migration creates
the concern tables/indexes; frozen-universe storage follows in T005. A snapshot
with an older schema or without an explicit concern-index state is incompatible
with the new ranking policy and returns structured unavailable evidence rather
than `no_match`.

The normalized concern label is always an implicit term. A map without an
`Intent terms` column, including the repository's current durable map, is valid
and indexes label-only terms until T009 promotes explicit aliases. A missing or
blank `Intent terms` cell adds no aliases; an empty element inside a non-empty
semicolon list is malformed.

Strict build-time map extraction reads every link in the owner cell. It rejects
an empty normalized label, a malformed explicit semicolon list, and an absolute
or repository-escaping owner target. Inline Markdown destinations support both
ordinary whitespace-free paths and CommonMark angle-bracket paths containing
spaces. Malformed map evidence publishes an
`invalid` concern-index state with zero concern rows, blocking authority-aware
ranking while allowing the otherwise complete graph/docs snapshot to remain
available. Persistence or publication failures still fail the target build and
preserve the prior publication.

Map discovery does not infer absence from the bounded docs scan. The indexer
calls `WorkspaceFilePort.stat` for the exact
`docs/reference/documentation-map.md` path. Only a definitive missing result
publishes `no_map`; an existing non-file, inaccessible read, or other discovery
failure publishes `invalid` with bounded reason evidence. A present map is read
exactly during indexing even if the docs scan is truncated.

Exact map and mapped-owner discovery remains byte-bounded even when the catalog
scan is truncated. Each source must be a regular file no larger than 120,000
bytes. Its exact `stat` check occurs before `readText`, and the retrieved byte
length is checked again to cover cached content or a concurrent file change.
An oversized source publishes feature-local `invalid` state with a bounded
reason; sources already over the limit at `stat` are not read.

Map links resolve relative to the map document, convert to canonical
repo-relative POSIX paths, and must remain workspace-contained. Frontmatter
`canonical_owner` and `superseded_by` values are repo-relative paths; normalize
`./` and separators, reject absolute/escaping/malformed values, and retain a
well-formed path even when the replacement document is absent. Invalid
frontmatter path evidence makes the concern index `invalid` rather than guessing
an owner state.

Owner-state precedence is `missing`, `conflicting`, `superseded`, `archived`,
`draft`, then `valid`. Archived, historical, legacy, template, and sample
documents use the non-governing `archived` owner state while their public
document status remains independent. Multiple mapped owners alone never create
a conflict.

Publication tests prove documents, FTS rows, concern ownership, concern-index
state, and schema version become visible atomically through the existing
building-to-published snapshot fence. Failed extraction/build never publishes a
mixed snapshot.

## Failure And Trust Behavior

- Missing map evidence yields `no_match`/uncertainty, not a guessed owner.
- Invalid owner evidence remains visible as governance inconsistency.
- Distinct FTS-plus-owner candidate overflow blocks with no hits/cursor.
- Missing/expired frozen universe rejects continuation without rebuilding.
- Failure to select a valid snapshot for a valid request returns a snapshot-less
  `selected_snapshot_unavailable` ranked variant with bounded status guidance;
  it never fabricates a snapshot ID or falls back to legacy search.
- Snapshot/path validity remains governed by existing freshness checks.
- Ranking and count receipts flow through trust metadata; a response never
  claims complete rank when no complete universe was frozen.
- No alternate search, broad per-query map read, hidden retry, or partial result
  fallback is introduced.

## Operational Considerations

- Index extraction and each ranked universe are bounded to 500 hits with a
  15-minute expiry. A repository-wide live-universe cap and eviction semantics
  are a separate storage-policy decision routed to EB059.
- This slice records aggregate FTS, owner, and distinct-union counts, result
  outcome, overflow, expiry, and invalid-cursor state without raw query text.
  EB059 owns the remaining matched-concern, freeze-duration, page-read, eviction,
  and live-population observability contract.
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
