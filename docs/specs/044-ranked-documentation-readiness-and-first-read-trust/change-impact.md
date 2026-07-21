---
title: Ranked documentation readiness change impact
doc_type: spec
artifact_type: change-impact
status: draft
owner: platform
last_reviewed: 2026-07-21
---

# Change Impact

## Purpose

Record the correction from graph-fresh-only orientation to snapshot-bound
ranked-documentation readiness and the repository validation that prevents an
invalid concern map from passing closure.

## Durable Source Mapping

| Source | Current behavior relied on | Confidence | Notes |
| --- | --- | --- | --- |
| `docs/design/mcp-surface-design.md` | Orientation is the first receipt; ranking unavailability routes to status. | high | Current recovery is not actionable. |
| `docs/design/runtime-operations-design.md` | Fresh is necessary but not sufficient for reuse. | high | Extend beyond path validity. |
| `docs/reference/runtime-contracts.md` | Public status/orientation/docs-search vocabulary. | high | Add readiness relationship. |
| `docs/design/graph-store-design.md` | Invalid concern state is persisted per snapshot. | high | Reuse existing state. |

## Change Type

- **Primary type:** bug_fix
- **Breaking change:** no
- **Durable docs required:** yes
- **External behavior affected:** yes

## Proposed Changes

| Change | Type | Source of truth | New durable destination | Promotion required |
| --- | --- | --- | --- | --- |
| File-only canonical-owner authoring rule | clarify | documentation map and extractor | `docs/reference/documentation-map.md` | yes |
| Snapshot-bound ranking readiness in status | add | runtime contracts and implementation | `docs/reference/runtime-contracts.md` | yes |
| Orientation blocker/recovery agreement | bug_fix | MCP surface and operations design | existing durable docs | yes |
| Real-repository concern validation | add | tests/CI | `docs/reference/mvp-proof-matrix.md` | yes |

## Promotion Targets

| Spec content | Durable destination | Promotion status | Notes |
| --- | --- | --- | --- |
| Public receipt and recovery semantics | `docs/reference/runtime-contracts.md` | complete | Five ranked result shapes, snapshot readiness, no-map trust, and recovery are explicit. |
| First-read behavior | `docs/design/mcp-surface-design.md` | complete | Status/orientation/search agree; frozen continuation trust is retained. |
| Refresh versus source repair | `docs/design/runtime-operations-design.md` | complete | Refresh admission and publication performance boundaries are explicit. |
| Concern readiness publication | `docs/design/graph-store-design.md` | complete | Same-snapshot evidence, bounded owner reads, atomic universe migration, and FTS cleanup are explicit. |
| Repository-real proof gate | `docs/reference/mvp-proof-matrix.md` | complete | Production extractor, directory-owner, bounded large-owner, publication, and installed-client gates are durable. |

## Unchanged Durable Areas

| Durable area | Reviewed source | Reason unchanged |
| --- | --- | --- |
| ranking order/count/cursors | MCP surface and runtime contracts | Closed Spec 043 semantics remain accepted. |
| universe capacity/eviction | EB059 | Separate product decision. |
| JS/TS reference coverage | EB061 | Separate capability decision. |
| duplicate node identities in FTS batches | EB062 | Separate graph-store/extraction repair. |

## Bug Fix Details

- **Observed behavior:** Fresh reusable orientation over blocked ranked search.
- **Expected behavior:** Status explains readiness; orientation reports the
  blocker; refresh is recommended only when it can repair the state.
- **Root cause evidence:** Persisted concern state was `invalid` because
  `docs/adr/` is a directory, while status/orientation did not read concern state.
- **Regression risk:** Status hot-path latency, cross-snapshot state joins, and
  accidental refresh loops.
- **Durable doc update needed:** yes, all promotion targets above.

## Open Questions

- None blocking.
