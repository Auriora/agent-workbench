---
title: Authority-aware documentation ranking canonical context
doc_type: spec
artifact_type: canonical-context
status: draft
owner: platform
last_reviewed: 2026-07-20
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Canonical Context

## Purpose

Define the authority boundary for Spec 043 while preserving the distinction
between intended ranking behavior and the currently shipped docs search.

## Authority Hierarchy

1. User instructions, `AGENTS.md`, source contracts, tests, and observed live
   runtime evidence remain always canonical.
2. `requirements.md` and `design.md` are canonical for the intended Spec 043
   slice only.
3. The documentation map and durable design/reference documents own current
   behavior until verified promotion.
4. Dated dogfood and direct-search comparisons demonstrate one reproduction;
   they do not establish universal ranking quality.

## Always-Canonical External Sources

- The user request and healthy runtime `0.6.0` dogfood establish the defect,
  priority, and desired authority-ranking investigation.
- `AGENTS.md` defines repository architecture, documentation ownership, and
  no-fallback constraints.

## Spec-Canonical Working Sources

- `requirements.md` owns Spec 043 acceptance.
- `design.md` owns the tiered ranking, indexed ownership, pagination, and count
  model.
- `tasks.md`, `traceability.md`, and `verification.md` own delivery state.

## Imported Sources

- EB054 and the dogfood ledger supply dated product evidence.
- Documentation map, MCP surface design, graph store design, runtime contracts,
  and coding-agent integration design supply current durable boundaries.

## Non-Canonical Background Sources

- Direct repository search is comparative evidence, not the Workbench search
  contract or an authorized implementation fallback.
- Draft Spec 043 claims do not become runtime truth before verification and
  durable promotion.

## Repository Truth At Intake

- SQLite graph storage performs the bounded FTS candidate retrieval;
  `query-docs.ts` delegates through `DocsIndexPort` and coordinates the result.
- The current implementation combines lexical and small additive
  authority/currency scores; a pure final-rank policy and frozen ranked-universe
  repository are intended state and do not exist yet.
- `document-currency-routing.ts` can identify documentation-map ownership, but
  `docs_search` does not consume that signal.
- SQLite FTS returns a bounded candidate set before application reranking.
- `indexed_docs_count` describes merged searchable documents, while docs index
  coverage describes the dedicated priority scan.

## Encoded Constraints

- Establish relevance before authority.
- Normalize concern terms deterministically and match only explicit exact
  phrases/tokens; preserve multi-concern and one-to-many ownership.
- Preserve truthful status and represent ownership separately.
- Index or join owner evidence within the selected snapshot.
- Read at most 501 FTS candidates and 501 distinct exact matched-owner document
  IDs from the selected snapshot, union them by stable document ID, then freeze
  at most 500 distinct candidates before emitting pages; either source sentinel
  or distinct union candidate 501 blocks without hits or continuation.
- Preserve legacy aggregate `score`, add `lexical_score` for the final tuple,
  expose final components, bind cursors to frozen ranking identity, and name
  candidate, page, and priority-scan count/filter bases explicitly.

## Promotion Map

| Spec content | Durable destination | Required before closure |
| --- | --- | --- |
| relevance/authority rank and pagination | `docs/design/mcp-surface-design.md` | yes |
| indexed ownership and candidate behavior | `docs/design/graph-store-design.md` | yes |
| count, cursor, and trust fields | `docs/reference/runtime-contracts.md` | yes |
| governing-owner signal and conflicts | `docs/reference/documentation-map.md` | yes |
| delivered result | EB054 and agent-readable changelog | yes |

## Related Artifacts

- Requirements: `requirements.md`
- Design: `design.md`
- Tasks: `tasks.md`
- Change impact: `change-impact.md`
- Verification: `verification.md`
