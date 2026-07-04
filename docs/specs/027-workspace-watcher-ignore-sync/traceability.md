---
title: Workspace watcher ignore sync traceability
doc_type: spec
artifact_type: traceability
status: active
owner: platform
last_reviewed: 2026-06-14
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Traceability

## Requirement To Delivery Matrix

| Requirement | Acceptance focus | Design sections | Tasks | Verification target |
| --- | --- | --- | --- | --- |
| R1 Shared Inclusion Policy | Same scanner and watcher policy for default skips, configured skips, `.gitignore`, and `.aiignore` | Shared Ignore Rule Loading, Watch Scope | T001, T003 | Catalog and watcher policy tests |
| R2 Watch Included Roots Only | Watch `indexed_roots` and filter generated/vendor/cache descendants | Watch Scope | T002, T003 | Watch root and ignored-event tests |
| R3 Debounced Event Queue | Coalesce bursts, handle rename, recover on overflow | Event Coalescing | T004 | Queue coalescing and overflow tests |
| R4 Incremental Evidence Maintenance | Remove deleted evidence and refresh or degrade edited evidence | Incremental Refresh | T006, T007 | Graph/docs/FTS maintenance tests |
| R5 Freshness Authority | Report fresh only after watcher queue and scope are synchronized | Freshness State | T008 | Runtime status and MCP caveat tests |

## Task To Context Matrix

| Task | Requirements | Primary files | Evidence expected |
| --- | --- | --- | --- |
| T001 | R1 | `src/domain/policies/`, `src/infrastructure/filesystem/`, `tests/workspace/` | Tests prove combined `.gitignore` and `.aiignore` policy behavior |
| T002 | R2, R3 | `src/config/`, `src/contracts/`, `tests/` | Defaults and contract tests for watcher enablement, debounce, and budget |
| T003 | R1, R2 | `src/infrastructure/filesystem/`, `src/ports/index.ts`, `tests/workspace/` | Watcher adapter tests for lifecycle and event filtering |
| T004 | R3, R5 | `src/application/use-cases/`, `tests/runtime/` | Queue tests for coalescing, rename, stale overflow, and rescan request |
| T005 | R1, R3 | Hook adapter or plugin hook files, `tests/` | Tests or review evidence that hooks feed the same queue only |
| T006 | R4 | `src/infrastructure/sqlite/graph-store.ts`, `src/application/use-cases/`, `tests/graph/` | Delete-path tests cover catalog, graph, docs, and FTS cleanup |
| T007 | R4, R5 | `src/application/use-cases/index-repository-graph.ts`, `src/infrastructure/workers/`, `tests/graph/`, `tests/runtime/` | Refresh or stale-rescan tests for edited files |
| T008 | R5 | `src/application/use-cases/get-repo-status.ts`, `src/application/use-cases/response-metadata.ts`, `src/presentation/`, `tests/runtime/`, `tests/mcp/` | Status and MCP tests prove fresh, refreshing, stale, and degraded reporting |

## Design To Implementation Matrix

| Design section | Implementation tasks | Validation signal |
| --- | --- | --- |
| Shared Ignore Rule Loading | T001 | Policy tests cover root `.gitignore` and `.aiignore` together |
| Watch Scope | T002, T003 | Watch root tests prove excluded descendants do not enqueue events |
| Event Coalescing | T004 | Queue tests prove burst, rename, and overflow behavior |
| Incremental Refresh | T006, T007 | Graph/docs/FTS tests prove delete cleanup and edit refresh or stale-rescan |
| Freshness State | T008 | Runtime and MCP tests prove stale watcher caveats |
| Hook Integration | T005 | Hook tests or review evidence prove hooks use the same queue |

## Open Decision Impact

- Whether edited files receive single-file graph refresh in the first watcher
  implementation or mark stale and trigger bounded rescan.
- Whether tool response diagnostics should split `.gitignore` and `.aiignore`
  into separate skip categories.
