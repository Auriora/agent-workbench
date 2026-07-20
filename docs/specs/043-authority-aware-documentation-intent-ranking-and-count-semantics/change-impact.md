---
title: Authority-aware documentation ranking change impact
doc_type: spec
artifact_type: change-impact
status: draft
owner: platform
last_reviewed: 2026-07-20
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Change Impact

## Summary

This feature changes documentation-map extraction, graph schema/publication,
documentation query ordering, frozen-universe persistence, owner evidence,
cursor identity, and count presentation. It does not change source document
status or replace SQLite as the bounded FTS candidate source.

## Durable Source Mapping

| Current authority | Change responsibility |
| --- | --- |
| documentation map | define explicit intent terms, one-to-many concern ownership, and conflict evidence |
| MCP surface design | define intent ranking, explanations, and pagination |
| graph store design | define indexed owner metadata and candidate bounds |
| runtime contracts | define count universes, cursor identity, and trust |

## Change Type

- **Primary type:** feature
- **Breaking change:** additive fields plus ranking/cursor policy version change
- **Durable docs required:** yes
- **External behavior affected:** yes, docs ordering, explanations, pagination,
  and coverage counts

## Proposed Changes

| Change | Type | Source of truth | Durable destination | Promotion required |
| --- | --- | --- | --- | --- |
| exact concern resolver and relevance/authority tuple | add | pure application/domain policy | MCP surface design | yes |
| snapshot owner signal and schema | add | documentation map and `index-repository-graph` | graph store design; documentation map | yes |
| distinct FTS-plus-owner frozen ranked universe and cursor | add/modify | docs query contracts and store port | MCP surface design; runtime contracts | yes |
| legacy aggregate score plus new lexical score | add/clarify | docs query contracts | runtime contracts | yes |
| explicit count/filter receipt | clarify | graph-store coverage and query state | runtime contracts | yes |

## Promotion Targets

| Intended behavior | Durable owner | Closure evidence |
| --- | --- | --- |
| intent ranking and explanations | `docs/design/mcp-surface-design.md` | ranking fixtures and goldens |
| indexed ownership and bounded candidates | `docs/design/graph-store-design.md` | store/index tests |
| count and cursor semantics | `docs/reference/runtime-contracts.md` | contract and pagination tests |
| owner/conflict governance | `docs/reference/documentation-map.md` | owner-state fixtures |
| delivered outcome | EB054 and agent-readable changelog | full and installed validation |

## Risk Assessment

- **Ranking risk:** authority may overcorrect and hide exact relevant results;
  relevance-band tests are mandatory.
- **Pagination risk:** reranking after page selection may duplicate or omit
  results; pagination must use one persisted complete final order.
- **Bound risk:** more than 500 candidates may hide the governing owner; the
  501 sentinel must block with no result/continuation.
- **Index risk:** ownership metadata may drift from snapshot documents; build it
  in the same publication boundary.
- **Compatibility risk:** clients may rely on old counters, aggregate numeric
  `score`, or cursors; retain those aliases and meanings, add
  `lexical_score`/tuple/fields, and reject old cursor versions explicitly.

## Unchanged Durable Areas

| Durable area | Reason unchanged |
| --- | --- |
| document content/status | ranking does not promote or rewrite docs |
| workspace safety | existing indexed path and snapshot validity apply |
| search implementation | SQLite FTS remains the single bounded retrieval source; no alternate query route is added |

## Related Artifacts

- Requirements: `requirements.md`
- Design: `design.md`
- Tasks: `tasks.md`
- Verification: `verification.md`
