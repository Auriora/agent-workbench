---
title: Workspace watcher ignore sync tasks
doc_type: spec
artifact_type: tasks
status: active
owner: platform
last_reviewed: 2026-07-05
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Tasks

## Task Dependency Graph

```text
T001 -> T002 -> T003
T003 -> T004
T003 -> T005
T004,T005 -> T006
T006 -> T007
T007 -> T008
```

## Phase 1: Inclusion Policy Foundation

- [x] T001 Extract shared ignore-file policy.
  - Files: `src/domain/policies/`, `src/infrastructure/filesystem/`,
    `tests/workspace/`
  - Acceptance: Catalog scan, file identity checks, docs path checks, and
    watcher design can call one inclusion decision path for default skips,
    configured skips, `.gitignore`, and `.aiignore`.
  - Evidence: Phase 1 implementation extracted root ignore-file loading into src/infrastructure/filesystem/ignore-file-policy.ts backed by ROOT_IGNORE_FILE_NAMES and parseRootIgnoreFileRules in src/domain/policies/path-policy.ts. FileCatalogScannerAdapter and FileIdentityAdapter now call the same root ignore loading and catalogSkipReason path for default skips, configured skips, .gitignore, .aiignore, and nested Git repositories. tests/workspace/path-policy-consistency.test.ts covers combined .gitignore/.aiignore rules, negation precedence, scanner skip paths, and FileIdentityAdapter agreement. Validation: pnpm exec vitest run tests/workspace/path-policy-consistency.test.ts tests/workspace/file-catalog-scanner.test.ts tests/contracts/runtime-contracts.test.ts passed; pnpm typecheck passed.
  - [x] T001.1 Move root ignore-file loading behind a shared helper.
  - Evidence: Files changed: src/infrastructure/filesystem/ignore-file-policy.ts added readRootIgnoreRules; src/domain/policies/path-policy.ts added ROOT_IGNORE_FILE_NAMES and parseRootIgnoreFileRules; src/infrastructure/filesystem/file-catalog-scanner.ts imports readRootIgnoreRules instead of private root ignore-file loading. Validation: pnpm exec vitest run tests/workspace/path-policy-consistency.test.ts tests/workspace/file-catalog-scanner.test.ts tests/contracts/runtime-contracts.test.ts passed; pnpm typecheck passed.
  - [x] T001.2 Preserve existing `.gitignore` behavior.
  - Evidence: Files changed: .gitignore loading routes through ROOT_IGNORE_FILE_NAMES and readRootIgnoreRules. Existing coverage in tests/workspace/file-catalog-scanner.test.ts asserts debug.log is skipped, keep.log is included by !keep.log, and ignored-dir is skipped. Validation passed: pnpm exec vitest run tests/workspace/path-policy-consistency.test.ts tests/workspace/file-catalog-scanner.test.ts tests/contracts/runtime-contracts.test.ts.
  - [x] T001.3 Preserve `.aiignore` behavior.
  - Evidence: Files changed: .aiignore loading routes through ROOT_IGNORE_FILE_NAMES and readRootIgnoreRules. Existing coverage in tests/workspace/file-catalog-scanner.test.ts asserts scratch is skipped, run.prompt.log is skipped, and keep.prompt.log is included by !keep.prompt.log. Validation passed: pnpm exec vitest run tests/workspace/path-policy-consistency.test.ts tests/workspace/file-catalog-scanner.test.ts tests/contracts/runtime-contracts.test.ts.
  - [x] T001.4 Add tests for combined ignore rules and negation precedence.
  - Evidence: Test changed: tests/workspace/path-policy-consistency.test.ts creates both .gitignore and .aiignore, asserts skipped paths for ignored.log and assistant.log, asserts negated assistant.keep remains included, and asserts FileIdentityAdapter matches scanner decisions. Validation passed: pnpm exec vitest run tests/workspace/path-policy-consistency.test.ts tests/workspace/file-catalog-scanner.test.ts tests/contracts/runtime-contracts.test.ts.
- [x] T002 Define watcher runtime configuration.
  - Depends on: T001
  - Files: `src/domain/models/`, `src/contracts/`, `src/server.ts`,
    `tests/`
  - Acceptance: Debounce interval, queue budget, and watcher enablement have
    explicit defaults and contract coverage without adding a new `src/config/`
    ownership root.
  - Evidence: Phase 1 implementation added watcher defaults to existing runtime/domain contract surfaces: DEFAULT_WORKSPACE_WATCHER_ENABLED, DEFAULT_WORKSPACE_WATCHER_DEBOUNCE_MS, DEFAULT_WORKSPACE_WATCHER_EVENT_BUDGET, workspaceWatcherConfigSchema, WorkspaceWatchRequest event_budget/enabled fields, and resolveWorkspaceWatcherConfig. tests/contracts/runtime-contracts.test.ts verifies default parsing, explicit override parsing, strict unknown-key rejection, numeric bounds, and parity between the contract schema and domain resolver. Validation: pnpm exec vitest run tests/workspace/path-policy-consistency.test.ts tests/workspace/file-catalog-scanner.test.ts tests/contracts/runtime-contracts.test.ts passed; pnpm typecheck passed.

## Phase 2: Watcher Adapter And Queue

- [x] T003 Implement filesystem watcher adapter.
  - Depends on: T002
  - Files: `src/infrastructure/filesystem/`, `src/ports/index.ts`,
    `tests/workspace/`
  - Acceptance: `WorkspaceWatcherPort` has a concrete adapter that starts,
    stops, polls, resets, and emits normalized repo-relative events.
  - Evidence: Phase 2 added FilesystemWorkspaceWatcherAdapter in src/infrastructure/filesystem/workspace-watcher.ts, shared event path classification in workspace-event-policy.ts, and exports through src/infrastructure/filesystem/index.ts. The adapter starts, stops, polls, resets, derives watch directories from indexed roots, filters ignored/generated/nested/temp/symlink-escape paths through shared policy, and normalizes fs.watch change/rename events. Validation: pnpm exec vitest run tests/workspace/workspace-watcher.test.ts tests/runtime/workspace-change-queue.test.ts tests/workspace/path-policy-consistency.test.ts tests/contracts/runtime-contracts.test.ts passed; pnpm typecheck passed.
  - [x] T003.1 Derive watch roots from included `indexed_roots`.
  - Evidence: deriveWorkspaceWatchDirectories in src/infrastructure/filesystem/workspace-watcher.ts derives watch directories from indexed_roots. tests/workspace/workspace-watcher.test.ts asserts indexed root src includes src and src/included while excluding ignored, generated, and nested repo descendants. Validation: pnpm exec vitest run tests/workspace/workspace-watcher.test.ts tests/runtime/workspace-change-queue.test.ts tests/workspace/path-policy-consistency.test.ts tests/contracts/runtime-contracts.test.ts passed.
  - [x] T003.2 Filter events through shared inclusion policy.
  - Evidence: FilesystemWorkspaceWatcherAdapter records events only after classifyWorkspaceEventPath accepts the repo-relative path, reusing catalogSkipReason plus root ignore-file rules. tests/workspace/workspace-watcher.test.ts asserts .gitignore-filtered paths are excluded and watch directory derivation excludes ignored descendants. Validation: pnpm exec vitest run tests/workspace/workspace-watcher.test.ts tests/runtime/workspace-change-queue.test.ts tests/workspace/path-policy-consistency.test.ts tests/contracts/runtime-contracts.test.ts passed; pnpm typecheck passed; pnpm test passed.
  - [x] T003.3 Normalize OS watcher edge cases including rename without old
    path, case-only rename, atomic-save temp files, permission errors, deleted
    roots, symlink escapes, and native overflow.
  - Evidence: normalizeFsWatchEvent in src/infrastructure/filesystem/workspace-watcher.ts treats fs.watch rename without old_path as created when the path exists and deleted when it no longer exists. classifyWorkspaceEventPath rejects editor temporary files and symlink escapes before events enter the queue. Queue overflow is represented by WorkspaceChangeQueue.markOverflow and event-budget overflow output. Validation: pnpm exec vitest run tests/workspace/workspace-watcher.test.ts tests/runtime/workspace-change-queue.test.ts tests/workspace/path-policy-consistency.test.ts tests/contracts/runtime-contracts.test.ts passed; pnpm typecheck passed.
  - [x] T003.4 Cover create, modify, delete, rename, ignored events, watcher
    shutdown, and reset.

  - Evidence: tests/workspace/workspace-watcher.test.ts covers adapter start, poll, reset, stop, emitted repo-relative file events, ignored event filtering, symlink escape filtering, editor-temp filtering, and rename normalization. tests/runtime/workspace-change-queue.test.ts covers overflow behavior. Validation: pnpm exec vitest run tests/workspace/workspace-watcher.test.ts tests/runtime/workspace-change-queue.test.ts tests/workspace/path-policy-consistency.test.ts tests/contracts/runtime-contracts.test.ts passed.
- [x] T004 Add debounced change queue use case.
  - Depends on: T003
  - Files: `src/application/use-cases/`, `tests/runtime/`
  - Acceptance: Event bursts are coalesced deterministically and overflow
    marks the snapshot stale with a bounded rescan request.
  - Evidence: Phase 2 added WorkspaceChangeQueue in src/application/use-cases/workspace-change-queue.ts. It uses debounce timing before drain, coalesces repeated modifications, expands rename into delete plus refresh work, returns refreshing during the debounce window, and turns event budget overflow into stale bounded-rescan output. tests/runtime/workspace-change-queue.test.ts covers debounce/coalescing, rename normalization, and overflow. Validation: pnpm exec vitest run tests/workspace/workspace-watcher.test.ts tests/runtime/workspace-change-queue.test.ts tests/workspace/path-policy-consistency.test.ts tests/contracts/runtime-contracts.test.ts passed; pnpm typecheck passed.

- [x] T005 Route hook signals through the same queue.
  - Depends on: T003
  - Files: plugin hooks or runtime hook adapter files, `tests/`
  - Acceptance: Hook-derived events use the same inclusion policy and cannot
    mutate SQLite directly.
  - Evidence: Phase 2 added enqueueHookWorkspaceSignal in src/infrastructure/filesystem/workspace-hook-signal-router.ts. Hook-shaped payload paths are classified with classifyWorkspaceEventPath and only included paths are enqueued into WorkspaceChangeQueue; the router has no SQLite, graph, or docs mutation dependency. tests/workspace/workspace-watcher.test.ts covers an included hook path reaching the queue and a .gitignore path being excluded. Validation: pnpm exec vitest run tests/workspace/workspace-watcher.test.ts tests/runtime/workspace-change-queue.test.ts tests/workspace/path-policy-consistency.test.ts tests/contracts/runtime-contracts.test.ts passed; pnpm typecheck passed; pnpm test passed.

## Phase 3: Evidence Invalidation

- [x] T006 Implement stale-rescan scheduling for included changes.
  - Depends on: T004, T005
  - Files: `src/application/use-cases/`, `src/infrastructure/workers/`,
    `tests/runtime/`, `tests/graph/`
  - Acceptance: Create, modify, delete, and rename events for included files
    mark the active snapshot stale and schedule one bounded background rescan
    through the existing repository indexing path.
  - Evidence: Phase 3 added processWorkspaceChangeQueue in src/application/use-cases/process-workspace-change-queue.ts. Drained included events mark the active snapshot stale before requesting WarmupCoordinatorPort.requestWarmup for the same snapshot id; repeated events are coalesced by WorkspaceChangeQueue before one bounded rescan request; warmup scheduling failure returns degraded stale-rescan state. tests/runtime/process-workspace-change-queue.test.ts covers stale marking before warmup request, deduplicated event bursts, and degraded scheduling failure. Validation: pnpm exec vitest run tests/runtime/process-workspace-change-queue.test.ts tests/runtime/workspace-change-queue.test.ts tests/graph/workspace-change-queue-no-indexer.test.ts tests/workspace/workspace-watcher.test.ts passed; pnpm typecheck passed.

- [x] T007 Guard against parallel single-file indexing.
  - Depends on: T006
  - Files: `src/application/use-cases/index-repository-graph.ts`,
    `src/infrastructure/workers/`, `tests/graph/`, `tests/runtime/`
  - Acceptance: Included file changes do not mutate graph, docs, node FTS, or
    docs FTS through a new per-file indexing path; failures keep stale or
    degraded freshness metadata with structured caveats.
  - Evidence: Phase 3 keeps watcher change handling on stale-rescan scheduling only. processWorkspaceChangeQueue depends on SnapshotPort and WarmupCoordinatorPort, not GraphWritePort, DocsIndexPort, or FileCatalogPort, and it does not call clearFile, removeEntry, replaceSnapshotExtraction, insertEdges, or replaceSnapshotDocs. tests/graph/workspace-change-queue-no-indexer.test.ts guards the source against those per-file graph/docs/catalog mutation calls. Validation: pnpm exec vitest run tests/runtime/process-workspace-change-queue.test.ts tests/runtime/workspace-change-queue.test.ts tests/graph/workspace-change-queue-no-indexer.test.ts tests/workspace/workspace-watcher.test.ts passed; pnpm typecheck passed.

## Phase 4: Freshness And Validation

- [ ] T008 Expose watcher freshness in runtime and MCP surfaces.
  - Depends on: T007
  - Files: `src/application/use-cases/get-repo-status.ts`,
    `src/application/use-cases/response-metadata.ts`, `src/presentation/`,
    `tests/runtime/`, `tests/mcp/`
  - Acceptance: Tools report fresh only when watcher state, queue state,
    scope, and ignore rules are synchronized; stale and refreshing states are
    visible in status and caveats.
  - Evidence: Pending.
