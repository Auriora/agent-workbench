---
title: Index completeness and docs-first warmup change impact
doc_type: spec
artifact_type: change-impact
status: draft
owner: platform
last_reviewed: 2026-07-07
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Change Impact

## Purpose

This spec changes runtime behavior and trust semantics for graph and docs
indexing. It must be promoted to durable docs before closure so future agents do
not infer current behavior from the temporary spec package.

## Durable Source Mapping

| Source | Current behavior relied on | Confidence | Notes |
| --- | --- | --- | --- |
| `docs/design/runtime-operations-design.md` | Owns warmup, cache, worker, queue, and runtime signal design. | high | Must describe phased warmup, partial coverage, and completion behavior. |
| `docs/design/graph-store-design.md` | Owns SQLite graph/docs FTS storage, rebuilds, and query budget design. | high | Must describe docs-index coverage and snapshot semantics. |
| `docs/design/mcp-surface-design.md` | Owns docs search/read and public MCP behavior. | high | Must describe partial docs-search behavior and direct-read routing. |
| `docs/reference/runtime-contracts.md` | Owns freshness, trust, response metadata, and evidence vocabulary. | high | Must describe any new or clarified metadata fields. |
| `docs/reference/documentation-map.md` | Maps canonical owners. | high | Update only if owners or durable destinations change. |
| `docs/backlog/README.md` | Owns deferred follow-up. | medium | Required if completion or ranking work is deferred. |
| `docs/reference/agent-readable-changelog.md` | Owns agent-visible behavior changes. | medium | Add an entry if public tool guidance changes. |

## Change Type

- **Primary type:** bug_fix
- **Breaking change:** no
- **Durable docs required:** yes
- **External behavior affected:** yes

## Proposed Changes

| Change | Type | Source of truth | New durable destination | Promotion required |
| --- | --- | --- | --- | --- |
| Truncated warmup no longer reports complete freshness for affected evidence classes. | bug_fix | `src/application/use-cases/index-repository-graph.ts` | `docs/design/runtime-operations-design.md`; `docs/reference/runtime-contracts.md` | yes |
| Docs indexing is docs-first or docs-dedicated instead of derived only from graph seed scan. | bug_fix | `src/application/use-cases/index-repository-graph.ts`; `src/infrastructure/sqlite/graph-store.ts` | `docs/design/graph-store-design.md`; `docs/design/mcp-surface-design.md` | yes |
| `docs_search` exposes coverage state and avoids misleading sparse results. | modify | `src/infrastructure/sqlite/graph-store.ts`; docs contracts | `docs/design/mcp-surface-design.md`; `docs/reference/runtime-contracts.md` | yes |
| Large-repo truncation behavior is fixture-backed. | add | `tests/docs`; `tests/graph`; `tests/runtime`; `tests/mcp` | `docs/reference/mvp-proof-matrix.md` if proof matrix scope changes | maybe |
| Completion/rescan behavior is implemented or explicitly routed. | modify | `src/application/use-cases/process-workspace-change-queue.ts`; warmup worker | `docs/design/runtime-operations-design.md`; `docs/backlog/README.md` if deferred | yes |

## Promotion Targets

| Spec content | Durable destination | Promotion status | Notes |
| --- | --- | --- | --- |
| Phased warmup and completion model | `docs/design/runtime-operations-design.md` | pending | Required before closure. |
| Docs/graph index coverage and FTS completeness | `docs/design/graph-store-design.md` | pending | Required before closure. |
| `docs_search` partial/degraded behavior and next actions | `docs/design/mcp-surface-design.md` | pending | Required before closure. |
| Freshness/trust metadata vocabulary | `docs/reference/runtime-contracts.md` | pending | Required if contracts change. |
| Follow-up work if completion is deferred | `docs/backlog/README.md` | pending | Required if any accepted target is deferred. |
| Agent-visible tool behavior change | `docs/reference/agent-readable-changelog.md` | pending | Required if public usage guidance changes. |

## Unchanged Durable Areas

| Durable area | Reviewed source | Reason unchanged |
| --- | --- | --- |
| Workspace safety | `docs/reference/workspace-safety-contract.md` | Existing path containment and skip policies should be reused, not redesigned. |
| Threat model | `docs/security/threat-model.md` | No new trust boundary or network behavior is intended. Update only if implementation changes that. |
| Language adapter semantics | `docs/design/language-adapter-design.md` | No parser capability promotion or fallback route is included. |

## Bug Fix Details

- **Observed behavior:** In aws-datalake, `docs_search` only indexed front-door
  Markdown and omitted durable `docs/**` analytics references because startup
  warmup used a bounded scan that did not reach `docs/`.
- **Expected behavior:** `docs_search` finds durable docs early or explicitly
  reports incomplete docs-index coverage.
- **Root cause evidence:** Startup warmup passes a `2000` file budget into
  graph indexing; docs FTS rows are built only from that bounded scan; the
  scanner prioritizes source/config before `docs/`; truncated snapshots can be
  marked fresh.
- **Regression risk:** Large repositories may silently lose docs or symbols if
  partial coverage is not surfaced.
- **Durable doc update needed:** yes.

## Open Questions

- Should the first implementation slice include a resumable completion executor,
  or is docs-first indexing plus partial coverage metadata sufficient for the
  first fix?
- Should coverage metadata be persisted in SQLite or derived from warmup result
  and scan state?

## Related Artifacts

- Requirements: `requirements.md`
- Design: `design.md`
- Tasks: `tasks.md`
- Verification: `verification.md`
