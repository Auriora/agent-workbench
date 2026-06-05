---
title: Cross-repo trust and discovery tasks
doc_type: spec
status: draft
owner: platform
last_reviewed: 2026-06-05
---

# Tasks

**Input**: [Requirements](requirements.md), [Technical design](design.md), and
[Verification](verification.md).

**Dogfood evidence**: TimeLocker, OneMount, and FreeCAD manual agent reports.
These repositories are examples of generic repo shapes; implementation and
fixtures must not special-case their paths, names, commands, or product
structure.

## Task Dependency Graph

```text
T001 -> T002 -> T003
T003 -> T003A
T002 -> T004
T003A -> T005
T004 -> T005
T005 -> T006
T005 -> T007
T006 -> T008
T007 -> T008
T001..T008 -> T009
```

## Phase 1: Close Prior Specs And Establish Fixtures

### Task T001: Close Spec 002 And Preserve Delivery Evidence

- **ID:** T001
- **Status:** completed
- **Depends on:** []
- **Parallel:** no
- **Story:** —
- **Files:** `docs/specs/002-timelocker-dogfood-followups/`, `docs/reference/documentation-map.md`
- **Description:** Archive Spec 002, add closure records, and point remaining
  cross-repo caveats to this spec.
- **Acceptance:** Spec 002 frontmatter is archived, closure records are present,
  and documentation map identifies Spec 002 as delivery evidence.
- **Evidence:** Completed on 2026-06-05 in this package setup pass.

### Task T002: Add Cross-Repo Fixture Shapes

- **ID:** T002
- **Status:** completed
- **Depends on:** [T001]
- **Parallel:** no
- **Story:** Requirements 1, 2, 4, 5, 6, 7
- **Files:** `tests/fixtures/`, `tests/runtime/`, `tests/mcp/`, `tests/graph/`, `tests/integration/`
- **Description:** Add compact fixture slices for generic Python-service,
  Go-service, and CMake/C++ repositories inspired by dogfood findings without
  depending on external checkouts or product-specific names.
- **Acceptance:** Fixture docs and tests can exercise status/scope consistency,
  unsupported language visibility, context ranking, validation planning, and
  first-slice symbols.
- **Evidence:** Added `fixture-python-service-repo`, `fixture-go-service-repo`,
  and `fixture-cmake-cpp-repo`; added focused catalog and MCP scope coverage for
  Go cache skipping, Go coverage, C++ header/source classification, and Python
  stub classification. Validated with `pnpm exec vitest run
  tests/workspace/file-catalog-scanner.test.ts
  tests/mcp/repo-scope-overview-resource.test.ts` on 2026-06-05.

## Phase 2: First-Call Trust And Scope Visibility

### Task T003: Align Resource Metadata Across Status, Scope, And Overview

- **ID:** T003
- **Status:** completed
- **Depends on:** [T002]
- **Parallel:** no
- **Story:** Requirement 1
- **Files:** `src/application/use-cases/get-repo-status.ts`, `src/application/use-cases/get-repo-scope.ts`, `src/application/use-cases/get-repo-overview.ts`, `src/presentation/`, `tests/runtime/`, `tests/mcp/`
- **Description:** Share snapshot/freshness/capability metadata construction so
  first-call resources agree on fresh warmups and coarse coverage without making
  status enumerate the file catalog.
- **Acceptance:** Tests prove status remains bounded and scope/overview metadata
  does not report unknown freshness when fresh status evidence exists.
- **Evidence:** `getRepoScope` and `getRepoOverview` now accept optional
  snapshot/warmup metadata and the composed server passes the graph store and
  runtime state into both resources. Focused MCP tests prove scope and overview
  report fresh metadata when a fresh snapshot exists while preserving scanned
  language coverage. Validated with `pnpm typecheck` and `pnpm exec vitest run
  tests/workspace/file-catalog-scanner.test.ts
  tests/mcp/repo-scope-overview-resource.test.ts` on 2026-06-05.

### Task T003A: Centralize Freshness And Trust Presentation Helpers

- **ID:** T003A
- **Status:** completed
- **Depends on:** [T003]
- **Parallel:** no
- **Story:** Requirement 1
- **Files:** `src/presentation/metadata.ts`, `src/application/use-cases/get-repo-status.ts`, `src/application/use-cases/get-repo-scope.ts`, `src/application/use-cases/get-repo-overview.ts`, `tests/contracts/`, `tests/mcp/`
- **Description:** Move reusable freshness, capability, caveat, and trust-label
  composition into presentation-owned helpers so status, scope, overview, and
  later tools use one output policy instead of duplicating metadata assembly.
- **Acceptance:** Contract or MCP tests prove fresh, refreshing, cold, stale,
  partial, and unsupported-language metadata are generated through shared helper
  paths and no resource presenter emits conflicting trust labels.
- **Evidence:** Added `buildRuntimeResponseMeta`, `classifyRuntimeTrust`, and
  `deriveRuntimeStatusCaveats` in `src/presentation/metadata.ts`; status now
  uses the shared helper instead of owning trust-label composition. Validated
  with `pnpm typecheck` and `pnpm exec vitest run
  tests/contracts/presentation-metadata.test.ts tests/runtime/status.test.ts
  tests/mcp/repo-scope-overview-resource.test.ts` on 2026-06-05.

### Task T004: Preserve Unsupported Source-Language Coverage Under Budgets

- **ID:** T004
- **Status:** completed
- **Depends on:** [T002]
- **Parallel:** yes
- **Story:** Requirement 2
- **Files:** `src/infrastructure/filesystem/`, `src/application/use-cases/get-repo-scope.ts`, `tests/runtime/`, `tests/mcp/`
- **Description:** Add `.gocache` to skipped roots and ensure scope reports
  representative unsupported Go/C/C++ source coverage even when row caps apply.
- **Acceptance:** Go-service fixture reports Go coverage, skips `.gocache`,
  and exposes truncation without hiding unsupported source languages.
- **Evidence:** Added generic catalog traversal priority so project-shape,
  source, and test paths are considered before docs noise under row caps without
  increasing the output row budget. Focused scanner tests prove `.gocache`
  remains skipped and row-capped scans preserve representative Go source
  coverage. Validated with `pnpm typecheck` and `pnpm exec vitest run
  tests/workspace/file-catalog-scanner.test.ts
  tests/mcp/repo-scope-overview-resource.test.ts` on 2026-06-05.

### Task T005: Remove Non-Callable Next Actions

- **ID:** T005
- **Status:** completed
- **Depends on:** [T003, T004]
- **Parallel:** no
- **Story:** Requirement 3
- **Files:** `src/presentation/`, `src/application/use-cases/`, `src/interface-adapters/mcp/`, `tests/mcp/`, `tests/integration/`
- **Description:** Validate next-action tool names against public MCP tool
  metadata or the active integration profile and remove unavailable actions such
  as `prewarm_graph`.
- **Acceptance:** MCP tests prove every returned next action names a callable
  public tool in Codex-visible surfaces.
- **Evidence:** `capNextActions` now filters next actions to the public MCP tool
  set, unavailable `prewarm_graph` actions were removed from graph-blocked
  results, and `verification_plan` no longer emits pseudo `manual_command`
  next actions. Validated with `pnpm typecheck` and `pnpm exec vitest run
  tests/contracts/presentation-metadata.test.ts tests/graph/query-tools.test.ts
  tests/mcp/query-tools.test.ts tests/mcp/context-for-task-tool.test.ts
  tests/mcp/verification-plan-tool.test.ts tests/integration/usage-informed-mvp.test.ts
  tests/integration/replacement-readiness.test.ts` on 2026-06-05.

## Phase 3: Ranking And Validation Planning

### Task T006: Improve Context Ranking For Broad And File-Seeded Tasks

- **ID:** T006
- **Status:** completed
- **Depends on:** [T005]
- **Parallel:** yes
- **Story:** Requirement 4
- **Files:** `src/application/use-cases/get-task-context.ts`, `src/application/use-cases/query-helpers.ts`, `tests/mcp/`, `tests/integration/`
- **Description:** Downrank generated/vendored/fixture noise for broad
  implementation tasks and boost adjacent source, local build files, and nearby
  tests when explicit files are supplied.
- **Acceptance:** CMake/C++ fixture ranks `DocumentObject` adjacent files
  and local CMake/test evidence ahead of unrelated CMake find modules,
  installer docs, vendored docs, or fixture blobs.
- **Evidence:** `context_for_task` now boosts same-directory build files,
  same-stem sibling files, and nearby tests when explicit files are supplied;
  weak broad path matches carry routing-only wording and noisy artifact paths
  are downranked. CMake/C++ fixture tests prove local CMake and test evidence
  rank ahead of incidental package files. Validated with `pnpm typecheck` and
  `pnpm exec vitest run tests/mcp/context-for-task-tool.test.ts
  tests/integration/usage-informed-mvp.test.ts
  tests/integration/replacement-readiness.test.ts` on 2026-06-05.

### Task T007: Add Repository-Shape Validation Planning

- **ID:** T007
- **Status:** completed
- **Depends on:** [T005]
- **Parallel:** yes
- **Story:** Requirement 5
- **Files:** `src/application/use-cases/plan-verification.ts`, `src/infrastructure/filesystem/`, `tests/mcp/verification-plan-tool.test.ts`, `tests/integration/`
- **Description:** Detect primary Go and CMake/C++ project shapes and rank
  their validation evidence ahead of incidental package-manager commands.
- **Acceptance:** Go fixtures return planned or blocked Go validation evidence;
  CMake/C++ fixtures prioritize CMake/build/test evidence over incidental
  `package.json` Node commands.
- **Evidence:** `verification_plan` now detects generic Go project-shape
  evidence from `go.mod`, `go.work`, and `Makefile`, and CMake/C++ evidence
  from root/local `CMakeLists.txt` plus C/C++ files. Go plans include `make
  test`/`go test ./...` when supported by repository evidence; CMake/C++ plans
  return a planned manual CMake build/test review ahead of incidental Node
  scripts. Validated with `pnpm typecheck` and `pnpm exec vitest run
  tests/mcp/verification-plan-tool.test.ts` on 2026-06-05.

## Phase 4: First-Slice Language Identity And Symbols

### Task T008: Add Go Identity And Basic Symbol Extraction

- **ID:** T008
- **Status:** completed
- **Depends on:** [T006, T007]
- **Parallel:** yes
- **Story:** Requirement 6
- **Files:** `src/infrastructure/tree-sitter/`, `src/infrastructure/filesystem/`, `src/infrastructure/sqlite/graph-store.ts`, `tests/graph/`, `tests/mcp/query-tools.test.ts`
- **Description:** Classify Go files and extract packages, functions, types,
  methods, and `main` as routing symbols with honest confidence labels.
- **Acceptance:** Go-service fixtures support Go scope and symbol search
  for representative declarations while references/impact remain low confidence
  when semantic edges are absent.
- **Evidence:** Added a Go declaration extractor that emits routing-only
  package, function, method, type, and `main` symbols with `resource_backed`
  capability and `heuristic` evidence. The server registers the extractor, Go
  files classify as resource-backed instead of unsupported, and graph tests
  prove representative Go symbols are searchable while impact remains low
  confidence when semantic edges are absent. Validated with `pnpm typecheck`
  and `pnpm exec vitest run tests/contracts/presentation-metadata.test.ts
  tests/runtime/status.test.ts tests/workspace/file-catalog-scanner.test.ts
  tests/mcp/repo-scope-overview-resource.test.ts
  tests/graph/extraction-pipeline.test.ts tests/graph/query-tools.test.ts
  tests/mcp/query-tools.test.ts tests/mcp/context-for-task-tool.test.ts
  tests/mcp/verification-plan-tool.test.ts
  tests/integration/usage-informed-mvp.test.ts
  tests/integration/replacement-readiness.test.ts` on 2026-06-05.

### Task T009: Add C/C++ Identity, Stub Routing, And Basic Symbol Extraction

- **ID:** T009
- **Status:** completed
- **Depends on:** [T001, T002, T003, T004, T005, T006, T007, T008]
- **Parallel:** no
- **Story:** Requirement 7
- **Files:** `src/infrastructure/tree-sitter/`, `src/infrastructure/filesystem/`, `src/infrastructure/sqlite/graph-store.ts`, `tests/graph/`, `tests/mcp/query-tools.test.ts`
- **Description:** Classify C/C++ source/header files and `.pyi` stubs, extract
  basic declarations/includes, and connect CMake target membership as
  resource-backed routing evidence.
- **Acceptance:** CMake/C++ fixtures support C/C++ scope and symbol search
  for classes/functions/methods/includes and keep impact confidence low unless
  parser-backed edges exist.
- **Evidence:** Added a C/C++ declaration extractor for routing-only classes,
  functions, methods, and includes with `resource_backed` capability and
  `heuristic` evidence; `.pyi` files now route through the Python parser path;
  and `CMakeLists.txt` resource extraction now emits CMake target declaration
  nodes with source membership metadata. Graph and query tests prove C++ and
  stub symbols are searchable while impact remains low confidence when semantic
  edges are absent. Validated with `pnpm typecheck` and `pnpm exec vitest run
  tests/contracts/presentation-metadata.test.ts tests/runtime/status.test.ts
  tests/workspace/file-catalog-scanner.test.ts
  tests/mcp/repo-scope-overview-resource.test.ts
  tests/graph/extraction-pipeline.test.ts tests/graph/query-tools.test.ts
  tests/mcp/query-tools.test.ts tests/mcp/context-for-task-tool.test.ts
  tests/mcp/verification-plan-tool.test.ts
  tests/integration/usage-informed-mvp.test.ts
  tests/integration/replacement-readiness.test.ts` on 2026-06-05.

## Phase 5: Verification And Promotion

### Task T010: Retest Cross-Repo Dogfood And Promote Durable Docs

- **ID:** T010
- **Status:** pending
- **Depends on:** [T001, T002, T003, T004, T005, T006, T007, T008, T009]
- **Parallel:** no
- **Story:** All requirements
- **Files:** `docs/design/`, `docs/reference/`, `docs/specs/003-cross-repo-trust-discovery/verification.md`
- **Description:** Run focused automated validation, retest against TimeLocker,
  OneMount, and FreeCAD, and promote accepted behavior to durable docs.
- **Acceptance:** Verification records automated tests, manual dogfood results,
  residual risks, and durable-doc promotion status.
- **Evidence:** pending
