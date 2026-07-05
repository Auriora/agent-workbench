---
title: Workspace watcher ignore sync traceability
doc_type: spec
artifact_type: traceability
status: active
owner: platform
last_reviewed: 2026-07-05
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Traceability

## Requirement To Delivery Matrix

| Requirement | Acceptance focus | Design sections | Tasks | Verification target |
| --- | --- | --- | --- | --- |
| Requirement 1: Shared Inclusion Policy | AC1-AC3: same scanner and watcher policy for default skips, configured skips, `.gitignore`, and `.aiignore` | Shared Ignore Rule Loading, Watch Scope | T001, T003 | Catalog and watcher policy tests |
| Requirement 2: Watch Included Roots Only | AC1-AC3: watch `indexed_roots` and filter generated/vendor/cache descendants | Watch Scope | T002, T003 | Watch root and ignored-event tests |
| Requirement 3: Debounced Event Queue | AC1-AC3: coalesce bursts, handle rename, recover on overflow | Event Coalescing | T004 | Queue coalescing and overflow tests |
| Requirement 4: Evidence Invalidation And Bounded Rescan | AC1-AC3: stale included changes and schedule bounded rescan through existing indexing | Change Handling Strategy | T006, T007 | Stale-rescan scheduling and no parallel indexer tests |
| Requirement 5: Freshness Authority | AC1-AC3: report fresh only after watcher queue and scope are synchronized | Freshness State | T008 | Runtime status and MCP caveat tests |

## Task To Context Matrix

| Task | Requirements | Primary files | Evidence expected |
| --- | --- | --- | --- |
| T001 | Requirement 1 AC1-AC3 | `src/domain/policies/`, `src/infrastructure/filesystem/`, `tests/workspace/` | Tests prove combined `.gitignore` and `.aiignore` policy behavior |
| T002 | Requirement 2 AC1-AC3, Requirement 3 AC3 | `src/domain/models/`, `src/contracts/`, `src/server.ts`, `tests/` | Defaults and contract tests for watcher enablement, debounce, and budget |
| T003 | Requirement 1 AC1-AC2, Requirement 2 AC1-AC3 | `src/infrastructure/filesystem/`, `src/ports/index.ts`, `tests/workspace/` | Watcher adapter tests for lifecycle, event filtering, OS edge cases, and overflow |
| T004 | Requirement 3 AC1-AC3, Requirement 5 AC2-AC3 | `src/application/use-cases/`, `tests/runtime/` | Queue tests for coalescing, rename, stale overflow, and rescan request |
| T005 | Requirement 1 AC2, Requirement 3 AC1-AC3 | Hook adapter or plugin hook files, `tests/` | Tests or review evidence that hooks feed the same queue only |
| T006 | Requirement 4 AC1-AC3 | `src/application/use-cases/`, `src/infrastructure/workers/`, `tests/runtime/`, `tests/graph/` | Included changes mark stale and schedule one bounded rescan |
| T007 | Requirement 4 AC2-AC3, Requirement 5 AC2-AC3 | `src/application/use-cases/index-repository-graph.ts`, `src/infrastructure/workers/`, `tests/graph/`, `tests/runtime/` | Tests prove no parallel per-file graph/docs/FTS mutation path is added |
| T008 | Requirement 5 AC1-AC3 | `src/application/use-cases/get-repo-status.ts`, `src/application/use-cases/response-metadata.ts`, `src/presentation/`, `tests/runtime/`, `tests/mcp/` | Status and MCP tests prove fresh, refreshing, stale, and degraded reporting |

## Design To Implementation Matrix

| Design section | Implementation tasks | Validation signal |
| --- | --- | --- |
| Shared Ignore Rule Loading | T001 | Policy tests cover root `.gitignore` and `.aiignore` together |
| Watch Scope | T002, T003 | Watch root tests prove excluded descendants do not enqueue events |
| Event Coalescing | T004 | Queue tests prove burst, rename, and overflow behavior |
| Change Handling Strategy | T006, T007 | Tests prove stale-rescan scheduling and no parallel indexer |
| Freshness State | T008 | Runtime and MCP tests prove stale watcher caveats |
| Hook Integration | T005 | Hook tests or review evidence prove hooks use the same queue |

## Open Decision Impact

- Resolved 2026-07-05: edited files mark stale and trigger bounded rescan in
  the first watcher implementation.
- Whether tool response diagnostics should split `.gitignore` and `.aiignore`
  into separate skip categories.
