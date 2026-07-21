---
title: Authority-aware documentation intent ranking and count semantics requirements
doc_type: spec
artifact_type: requirements
status: draft
owner: platform
last_reviewed: 2026-07-21
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Requirements

## Introduction

`docs_search` already returns useful authority, currency, and coverage labels,
but healthy runtime `0.6.0` dogfood showed that those signals do not govern
ranking strongly enough for documentation-intent queries. A highly lexical
draft install guide can outrank the mapped design authority, while two truthful
inventory counts appear contradictory because their universes are unnamed.
This spec defines a deterministic concern resolver, complete bounded candidate
universe, stable ranking and pagination, and unambiguous count receipt.

## Goals

- Resolve exact query phrases and tokens to one or more documentation-map
  concerns without semantic inference.
- Route governing-intent queries to every valid owner of a matched concern that
  is repository-present within the selected scope.
- Keep governing ownership separate from truthful authority and currency.
- Form one distinct union of FTS candidates and exact matched-owner documents,
  then freeze the complete bounded ranked universe before issuing any page.
- Make every documentation count name its universe and filter basis.

## Non-Goals

- Make every canonical document outrank more relevant content.
- Promote draft, archived, or superseded content by changing its status label.
- Read or parse the documentation map broadly on every query.
- Replace SQLite FTS, add embeddings, or add a second search implementation.
- Continue from, or present results from, a candidate universe larger than the
  supported 500-candidate bound.
- Choose a repository-wide cap or eviction policy for concurrently live ranked
  universes; the current slice retains the 15-minute expiry and routes that
  separate storage-policy decision to EB059.

## Durable Source Baseline

| Source | Current boundary |
| --- | --- |
| `docs/reference/documentation-map.md` | Canonical owner registry; Spec 043 adds explicit intent terms and one-to-many ownership extraction. |
| `docs/design/mcp-surface-design.md` | Bounded docs search, cursors, trust, and routing behavior. |
| `docs/design/graph-store-design.md` | SQLite FTS retrieval, snapshot storage, candidate bounds, and index coverage. |
| `docs/reference/runtime-contracts.md` | Public documentation result, ranking, cursor, and count semantics. |
| `docs/design/coding-agent-integration-design.md` | Governing owner for coding-agent and SessionStart behavior. |
| `docs/backlog/README.md` EB054 | Accepted defect and implementation boundary. |

At intake, SQLite performs bounded FTS candidate retrieval and
`query-docs.ts` delegates to that port. The intended pure ranking policy and
frozen ranked-universe repository do not yet exist.

## Requirements

### Requirement 1: Deterministic Concern Resolution And Ranking

**Priority:** must-have

#### Acceptance Criteria

1. **AC1.1:** WHEN documentation-map rows are indexed, THEN the indexer SHALL
   normalize the concern label and its explicit semicolon-delimited intent
   terms using Unicode NFKC, lowercase, punctuation-to-space conversion,
   whitespace collapse, and trim; it SHALL NOT infer synonyms.
2. **AC1.2:** WHEN a query is resolved, THEN a multi-token term SHALL match only
   as an exact contiguous normalized phrase and a single-token term SHALL match
   only an equal normalized query token.
3. **AC1.3:** WHEN a query matches several concerns, THEN all matched concerns
   SHALL be retained; a document that owns any matched concern receives the
   owner tier and the result explains every matched concern it owns.
4. **AC1.4:** IF no concern term matches, THEN no document receives a governing
   owner tier and ordinary relevance/authority ordering applies with
   `concern_match_state: no_match`.
5. **AC1.5:** Concern-match ties SHALL be deterministic: longest matched phrase
   token count, then normalized concern key, then normalized owner path; ties
   SHALL NOT be resolved by hidden weights or path guesses.
6. **AC1.6:** Ranking SHALL establish the explicit relevance band before
   governing ownership, authority, currency, lexical score, normalized path,
   and stable document identity.
7. **AC1.7:** A highly lexical supporting or draft document SHALL NOT overwhelm
   a comparably relevant governing owner, while an irrelevant canonical
   document SHALL NOT outrank an exact relevant result solely through authority.
8. **AC1.8:** Ranking reasons SHALL identify normalized matched term, concern,
   candidate source, owner state, relevance band, authority, currency, legacy
   aggregate score, lexical score, and stable tie-breakers without claiming
   semantic certainty.
9. **AC1.9:** Every repository-present document within the selected scope that
   is mapped as an owner of an exact matched concern SHALL join the candidate
   union even when SQLite FTS does not return it; such a document SHALL enter
   the explicit `intent_owner_match` relevance band below all-token FTS bands
   and above `partial_fts_match`.

### Requirement 2: Truthful Snapshot Ownership

**Priority:** must-have

#### Acceptance Criteria

1. **AC2.1:** Governing-owner evidence SHALL remain separate from `doc_status`,
   authority, and currency fields.
2. **AC2.2:** A draft governing owner MAY rank first but SHALL retain its draft
   label and direct-read caveat.
3. **AC2.3:** An archived, superseded, missing, or conflicting mapped owner
   SHALL NOT receive the valid-owner tier and SHALL emit a bounded governance
   inconsistency.
4. **AC2.4:** One concern MAY have multiple owners and one owner MAY govern
   multiple concerns; the index SHALL preserve the complete one-to-many rows
   rather than silently choose one.
5. **AC2.5:** Owner evidence SHALL be extracted during a coordinated current-
   schema rebuild, stored, and published with the selected graph snapshot;
   store migration SHALL NOT synthesize evidence for older snapshots, and
   queries SHALL not broadly read the map from the workspace.
6. **AC2.6:** Owner states SHALL map exhaustively and deterministically to
   ranking tiers and caveats: `valid` and `draft` are valid-owner states;
   `missing`, `archived`, `superseded`, and `conflicting` are invalid-owner
   states with their corresponding bounded caveat.

### Requirement 3: Complete Frozen Pagination Universe

**Priority:** must-have

#### Acceptance Criteria

1. **AC3.1:** SQLite SHALL retrieve at most 501 ordered FTS candidates without
   page offset and at most 501 distinct matched-owner document IDs, in stable
   document-ID order, from the same snapshot. Either source's row 501 SHALL be
   an overflow sentinel; otherwise both bounded sources SHALL be deduplicated
   by stable document ID before the union cap is evaluated.
2. **AC3.2:** For a distinct candidate union of 0 through 500 documents, the
   runtime SHALL rank the complete union, persist a
   snapshot/query/scope/policy-bound ordered universe, and only then emit the
   first page.
3. **AC3.3:** If the distinct FTS-plus-owner union contains candidate 501, the
   runtime SHALL return a structured
   `candidate_universe_exceeds_limit` blocked result with zero hits and no
   cursor; it SHALL NOT page or continue from an incomplete universe. The
   blocker SHALL expose an exact count for a fully retrieved source or the
   corresponding literal-501 lower bound for an overflowing FTS, matched-owner,
   or union source.
4. **AC3.4:** A cursor SHALL identify the frozen universe and next position and
   SHALL bind snapshot, normalized query, scope, retrieval bound, schema
   version, and ranking-policy version.
5. **AC3.5:** Concatenating cursor pages SHALL equal a sufficiently large page
   over the same frozen universe in exact order and set, without duplicates or
   omissions.
6. **AC3.6:** A missing/expired universe or changed snapshot, query, scope,
   bound, schema, or policy SHALL reject the cursor with structured stale or
   invalid evidence rather than rebuild or restart it. If no valid snapshot can
   be selected for an otherwise valid request, the public result SHALL use a
   snapshot-less `selected_snapshot_unavailable` blocker and SHALL NOT fabricate
   snapshot identity.

### Requirement 4: Explicit Ranking Compatibility And Counts

**Priority:** must-have

#### Acceptance Criteria

1. **AC4.1:** The existing numeric `score` SHALL retain its shipped aggregate
   lexical/path/field/authority/currency meaning as a deprecated compatibility
   field; the new optional `lexical_score` SHALL expose the raw SQLite lexical
   score for FTS candidates and SHALL be absent for owner-only candidates. It
   SHALL be the only numeric score component used by the final tuple.
2. **AC4.2:** Each hit SHALL expose an explicit final rank tuple/components and
   `ranking_policy_version`; consumers SHALL order by response order or the
   tuple, not by legacy aggregate `score` or `lexical_score` alone.
3. **AC4.3:** Count receipts SHALL use these unambiguous names:
   `searchable_snapshot_documents_count`,
   `searchable_scope_documents_count`,
   `fts_candidate_documents_count`,
   `matched_owner_candidate_documents_count`,
   `candidate_union_documents_count`,
   `ranked_candidate_universe_count`, and
   `returned_page_documents_count`.
4. **AC4.4:** Priority scan receipts SHALL use
   `priority_scan_eligible_markdown_files_count`,
   `priority_scan_indexed_markdown_files_count`, and
   `priority_scan_skipped_markdown_files_count`.
5. **AC4.5:** Receipts SHALL name `searchable_filter_basis`,
   `scope_filter_basis`, `query_filter_basis`, `page_filter_basis`, and
   `priority_scan_filter_basis`. `query_filter_basis` SHALL be a strict object
   keyed by each query-derived count field, because FTS, matched-owner, and
   union/ranked counts have different bases. Every count SHALL have exactly one
   universe and one keyed filter basis.
6. **AC4.6:** Documents indexed outside priority roots SHALL increase the
   searchable snapshot/scope counts but SHALL NOT inflate priority-scan counts.
7. **AC4.7:** Partial/skipped priority scans SHALL preserve mandatory coverage
   state and truncation receipts independently of the complete ranked candidate
   universe.
8. **AC4.8:** Existing ambiguous count fields and aggregate `score` SHALL remain
   additive deprecated aliases during this slice, with consumer contract tests,
   deprecation notes, and no silent meaning change. Success and overflow SHALL
   emit the legacy page count/basis, searchable snapshot count, and priority-scan
   coverage aliases. The existing `include_snippets` request SHALL remain
   effective on first and continuation pages without changing frozen order or
   re-querying candidates.

## Concrete Intent Examples

| Query | Indexed exact terms | Matched concern result | Required behavior |
| --- | --- | --- | --- |
| `What rule governs SessionStart behavior?` | `sessionstart` on `Coding-agent integrations` | one concern | coding-agent integration design receives the valid-owner tier; install guide may remain draft/supporting |
| `Keep Codex and Kiro hooks consistent` | `codex`, `kiro`, and `agent hooks` may map to the same or multiple explicit concerns | all exact concern matches | preserve all matches and explain each owner relationship |
| `Session startup diagnostics` | no `session start` phrase and no `sessionstart` token unless explicitly registered | no match | no owner tier; use ordinary relevance/authority order |
| `runtime contracts and graph schema` | exact terms for two concerns | two concerns | both valid mapped owners may receive owner tier; stable tie rules decide order |

The documentation-map promotion for the coding-agent row must register
`SessionStart` explicitly; the resolver must not derive that synonym from
`startup`, `hook`, or a filename.

## Correctness Properties

- **CP-001:** Authority can reorder only within an established relevance band.
- **CP-002:** Governing ownership never mutates underlying document status.
- **CP-003:** Concern resolution is exact, deterministic, multi-concern, and
  admits every repository-present matched owner into the distinct candidate
  union.
- **CP-004:** A page is emitted only from a complete persisted universe of at
  most 500 ranked candidates.
- **CP-005:** Cursor traversal is stable, duplicate-free, and order-equivalent
  to a large page over the same universe.
- **CP-006:** Every count has exactly one named universe and filter basis.
- **CP-007:** Legacy aggregate `score` retains its shipped meaning;
  `lexical_score` alone supplies the tuple's numeric lexical component.
- **CP-008:** Invalid ownership never becomes silent authority promotion.

## Success Criteria

- **SC-001:** SessionStart intent fixtures rank the mapped coding-agent design
  owner above a highly lexical supporting install guide with explicit reasons.
- **SC-002:** Fixtures with 499 and 500 distinct FTS-plus-owner candidates page
  completely; a 501st distinct candidate, whether from FTS or an owner-only
  admission, blocks without hits or continuation.
- **SC-003:** Example/property tests prove cursor binding, total order,
  duplicate absence, page concatenation, legacy aggregate and lexical-score
  compatibility, and count/filter semantics.
- **SC-004:** Focused/full tests, budgets, typecheck, plugin/skill/package
  checks, installed-package smoke, lifecycle gates, Markdown checks, expert
  review, promotion, closure, and archive reconciliation pass before closure.

## Related Artifacts

- Canonical context: `canonical-context.md`
- Change impact: `change-impact.md`
- Design: `design.md`
- Tasks: `tasks.md`
- Traceability: `traceability.md`
- Verification: `verification.md`
