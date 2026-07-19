---
title: Snapshot path validity change impact
doc_type: spec
artifact_type: change-impact
status: draft
owner: platform
last_reviewed: 2026-07-19
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Change Impact

## Durable Source Mapping

| Source | Current behavior relied on | Confidence |
| --- | --- | --- |
| `docs/design/graph-store-design.md` | SQLite graph/docs persistence and query invariants | high |
| `docs/design/runtime-operations-design.md` | Snapshot freshness, watcher, queue, and warm-up ownership | high |
| `docs/design/mcp-surface-design.md` | Public stale/degraded and query behavior | high |
| `docs/reference/runtime-contracts.md` | Canonical freshness and trust vocabulary | high |
| `docs/backlog/README.md#eb051-snapshot-freshness-versus-deleted-indexed-paths` | Observed defect and acceptance baseline | high |

## Change Type

- **Primary type:** bug_fix
- **Breaking change:** no
- **Durable docs required:** yes
- **External behavior affected:** yes

## Proposed Changes

| Change | Type | Current source | Durable destination | Promotion required |
| --- | --- | --- | --- | --- |
| Treat missing indexed paths as material snapshot invalidity | bug_fix | runtime/graph behavior and EB051 | runtime operations; graph store; runtime contracts | yes |
| Share snapshot freshness across public surfaces | bug_fix | MCP/status/task-context behavior | MCP surface; runtime contracts | yes |
| Replace raw stale-path failures with bounded evidence | bug_fix | graph query use cases/registries | MCP surface; runtime contracts | yes |
| Prune deleted docs from all persisted/search representations | bug_fix | SQLite graph/docs store | graph store design | yes |

## Promotion Targets

| Spec content | Durable destination | Promotion status |
| --- | --- | --- |
| snapshot validity and refresh rules | `docs/design/runtime-operations-design.md` | pending |
| graph/docs removal invariants | `docs/design/graph-store-design.md` | pending |
| public graph stale/degraded behavior | `docs/design/mcp-surface-design.md` | pending |
| freshness/trust contract wording | `docs/reference/runtime-contracts.md` | pending |
| agent-visible change and delivery state | changelog, backlog, history | pending |

## Bug Fix Details

- **Observed behavior:** snapshot `1783312125057` claimed fresh/reusable while
  retaining seven paths removed at `c90769b`; task context said unknown, graph
  traversal leaked `ENOENT`, and docs inventory/search retained deleted paths.
- **Expected behavior:** deletion invalidates freshness, all consumers agree,
  graph tools return bounded stale/degraded evidence, and docs rows disappear.
- **Root cause evidence:** persisted freshness is trusted without current path
  validation; task context derives separate unknown metadata; stale catalog
  paths are read directly; file removal does not consistently prune docs/FTS.
- **Regression risk:** high across first-read trust, graph traversal, SQLite
  removal, and query budgets.
- **Durable doc update needed:** yes.

## Unchanged Durable Areas

| Durable area | Reviewed source | Reason unchanged |
| --- | --- | --- |
| repository-root authority | `docs/reference/workspace-safety-contract.md` | No root override or containment change. |
| parser capability | `docs/design/language-adapter-design.md` | No parser or semantic fallback. |
| coding-agent hook policy | `docs/design/coding-agent-integration-design.md` | Hooks only exposed the defect; they do not own snapshot validity. |

## Related Artifacts

- Requirements: `requirements.md`
- Design: `design.md`
- Tasks: `tasks.md`
- Verification: `verification.md`
