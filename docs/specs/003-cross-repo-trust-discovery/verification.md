---
title: Cross-repo trust and discovery verification
doc_type: spec
status: archived
owner: platform
last_reviewed: 2026-06-05
---

# Verification

## Closure Record

Spec 003 closed on 2026-06-05 with automated gates passing and read-only
dogfood retest caveats recorded below. Remaining work is durable backlog, not
active spec work.

## Validation Plan

Required automated gates:

- `pnpm typecheck`
- Focused Vitest suites for status/scope/overview metadata, scope budgets,
  context ranking, next actions, validation planning, and query tools.
- Fixture tests for generic Python-service, Go-service, and CMake/C++
  repositories inspired by TimeLocker, OneMount, and FreeCAD findings.
- Contract tests if new public metadata, evidence labels, or capability values
  are added.

Manual dogfood gates:

- Restart Agent Workbench MCP in TimeLocker, OneMount, and FreeCAD.
- Read `repo:///status`, `repo:///scope`, and `repo:///overview`.
- Run `context_for_task` with broad and explicit-file prompts in each repo.
- Run `verification_plan` for Python, Go, and CMake/C++ representative files.
- Run `symbol_search`, `find_references`, and `impact` for representative Go
  and C/C++ identifiers, verifying confidence labels remain honest.
- Confirm `next_actions` contain only visible public MCP tool names.

## Evidence Log

| Date | Scope | Evidence | Result |
|------|-------|----------|--------|
| 2026-06-05 | Spec intake | TimeLocker, OneMount, and FreeCAD dogfood feedback reviewed and durable backlog updated | Follow-up requirements captured |
| 2026-06-05 | Spec setup | Spec 002 archived; Spec 003 created with task DAG and verification plan | Closed on 2026-06-05 |
| 2026-06-05 | T002 fixture setup | `pnpm exec vitest run tests/workspace/file-catalog-scanner.test.ts tests/mcp/repo-scope-overview-resource.test.ts` | Passed: 2 test files, 11 tests |
| 2026-06-05 | T003 scope/overview metadata alignment | `pnpm typecheck`; `pnpm exec vitest run tests/workspace/file-catalog-scanner.test.ts tests/mcp/repo-scope-overview-resource.test.ts` | Passed: typecheck and 2 test files, 13 tests |
| 2026-06-05 | T003A presentation metadata helper | `pnpm typecheck`; `pnpm exec vitest run tests/contracts/presentation-metadata.test.ts tests/runtime/status.test.ts tests/mcp/repo-scope-overview-resource.test.ts` | Passed: typecheck and 3 test files, 21 tests |
| 2026-06-05 | T004 row-cap source visibility | `pnpm typecheck`; `pnpm exec vitest run tests/workspace/file-catalog-scanner.test.ts tests/mcp/repo-scope-overview-resource.test.ts` | Passed: typecheck and 2 test files, 14 tests |
| 2026-06-05 | T007 repository-shape validation planning | `pnpm typecheck`; `pnpm exec vitest run tests/mcp/verification-plan-tool.test.ts` | Passed: typecheck and 1 test file, 13 tests |
| 2026-06-05 | T005 public next-action filtering | `pnpm typecheck`; `pnpm exec vitest run tests/contracts/presentation-metadata.test.ts tests/graph/query-tools.test.ts tests/mcp/query-tools.test.ts tests/mcp/context-for-task-tool.test.ts tests/mcp/verification-plan-tool.test.ts tests/integration/usage-informed-mvp.test.ts tests/integration/replacement-readiness.test.ts` | Passed: typecheck and 7 test files, 54 tests |
| 2026-06-05 | T006 context ranking | `pnpm typecheck`; `pnpm exec vitest run tests/mcp/context-for-task-tool.test.ts tests/integration/usage-informed-mvp.test.ts tests/integration/replacement-readiness.test.ts` | Passed: typecheck and 3 test files, 19 tests |
| 2026-06-05 | T008 Go routing symbols | `pnpm typecheck`; `pnpm exec vitest run tests/contracts/presentation-metadata.test.ts tests/runtime/status.test.ts tests/workspace/file-catalog-scanner.test.ts tests/mcp/repo-scope-overview-resource.test.ts tests/graph/extraction-pipeline.test.ts tests/graph/query-tools.test.ts tests/mcp/query-tools.test.ts tests/mcp/context-for-task-tool.test.ts tests/mcp/verification-plan-tool.test.ts tests/integration/usage-informed-mvp.test.ts tests/integration/replacement-readiness.test.ts` | Passed: typecheck and 11 test files, 85 tests |
| 2026-06-05 | T009 C/C++ routing symbols and CMake targets | `pnpm typecheck`; `pnpm exec vitest run tests/contracts/presentation-metadata.test.ts tests/runtime/status.test.ts tests/workspace/file-catalog-scanner.test.ts tests/mcp/repo-scope-overview-resource.test.ts tests/graph/extraction-pipeline.test.ts tests/graph/query-tools.test.ts tests/mcp/query-tools.test.ts tests/mcp/context-for-task-tool.test.ts tests/mcp/verification-plan-tool.test.ts tests/integration/usage-informed-mvp.test.ts tests/integration/replacement-readiness.test.ts` | Passed: typecheck and 11 test files, 87 tests |
| 2026-06-05 | T010 durable docs and debug harness | `pnpm typecheck`; `pnpm exec vitest run tests/mcp/debug-harness.test.ts`; `pnpm exec vitest run tests/docs/docs-links-metadata.test.ts`; `pnpm test` | Passed: typecheck, focused harness/docs tests, and full suite: 38 test files, 228 tests |
| 2026-06-05 | T010 read-only dogfood retest | `pnpm debug:mcp-use-case -- status|scope|overview /home/bcherrington/Projects/Auriora/TimeLocker`; `pnpm debug:mcp-use-case -- status|scope|overview|verification /home/bcherrington/Projects/Auriora/OneMount`; `pnpm debug:mcp-use-case -- status|scope|overview|context|verification /home/bcherrington/Projects/CLion/FreeCAD` | Accepted with caveats: TimeLocker shows partial Python/config/docs coverage; OneMount reports Go/C/C++ visibility, skips `.gocache`, and plans `make test` plus `go test ./...`; FreeCAD reports C/C++ and `.pyi` visibility, file-seeded context ranks local CMake/stub/tests first, and validation plans CMake review. Overview ranking remains noisy on large repos. |
| 2026-06-05 | T010 live MCP post-reload smoke | Read `repo:///status`, `repo:///scope`, and `repo:///overview`; ran live `context_for_task` for FreeCAD `DocumentObject`; ran live `verification_plan` for OneMount Go and FreeCAD CMake/C++ files | Passed with known caveats: startup now reports `fresh` and `warmup_state: complete`; scope/overview metadata are fresh; no hidden `prewarm_graph` action was returned; FreeCAD C++ headers/stubs classify correctly; OneMount and FreeCAD validation plans match current-code debug harness behavior. Overview ranking remains noisy on large repos. |
| 2026-06-05 | Post-reload external repo feedback | OneMount and FreeCAD Codex agents re-ran read-only MCP workflows and wrote `docs/reference/freecad-notes/2026-06-05-codex-freecad-workbench-reevaluation.md` | Follow-up accepted: file/resource awareness improved, but live OneMount exposed a graph warmup `Invalid string length` failure, unsafe generic Go host-command planning under Docker-only repo guidance, and generated hidden runtime artifacts in context. FreeCAD exposed status/scope contradiction, noisy broad routing, preview metadata drift for C++ files, shallow references/impact, and placeholder CMake validation. Durable backlog updated in `docs/design/mcp-surface-design.md`. |
| 2026-06-05 | Post-reload hardening batch | `pnpm typecheck`; `pnpm exec vitest run tests/graph/extraction-pipeline.test.ts tests/runtime/status.test.ts tests/workspace/file-catalog-scanner.test.ts tests/mcp/verification-plan-tool.test.ts tests/mcp/workspace-edit-tools.test.ts tests/docs/docs-links-metadata.test.ts`; `pnpm test`; OneMount throwaway graph-index smoke with `/tmp` SQLite | Passed: focused tests, full suite with 38 files and 231 tests, and OneMount indexing completed with 1,079 scanned files, 1,014 extracted files, 4,632 nodes, and no truncation. Fixes covered bounded snapshot status evidence, Docker-only validation blocking, hidden/generated artifact skips, oversized-file skipped catalog evidence, shared preview file metadata, and FreeCAD reevaluation note metadata. |
| 2026-06-05 | Environment, vendor, overview, and ranking follow-up | `pnpm typecheck`; `pnpm exec vitest run tests/workspace/file-catalog-scanner.test.ts tests/mcp/context-for-task-tool.test.ts tests/mcp/repo-scope-overview-resource.test.ts tests/runtime/orientation-golden.test.ts` | Passed focused tests. Scanner now excludes common language env/cache/dependency roots and nested git checkouts; context routing downranks third-party/fixture/generated matches; overview detects Go, CMake, Docker, and devcontainer evidence and prioritizes CMake/source topology over incidental package scripts. |
| 2026-06-05 | Read-only sample smoke harness | `pnpm typecheck`; `pnpm exec vitest run tests/mcp/debug-harness.test.ts`; `pnpm debug:sample-smoke -- --repo /home/bcherrington/Projects/Auriora/TimeLocker --repo /home/bcherrington/Projects/Auriora/OneMount --repo /home/bcherrington/Projects/CLion/FreeCAD --max 3` | Passed focused tests and external read-only smoke: 3 repos passed, 0 failed, with report written under `.tmp/sample-smoke/`. Added `pnpm debug:sample-smoke` for bounded read-only status/scope/overview/context checks across explicit sample repos or discovered git repos. |
| 2026-06-05 | AWS IaC comparison feedback | Read `docs/reference/aws-iac/aws-datalake-agent-workbench-evaluation-2026-06-05.md` | Accepted as durable comparison artifact. Roadmap updated for first-read resource reliability, SAM/CloudFormation logical ID and handler semantics, template-to-handler edges, Lambda handler grouping, AWS-aware validation planning, nearest-test ranking, and result-scope metadata correctness. |

## Residual Risks

- External dogfood repositories may drift independently and should not be
  required for automated CI.
- Go and C/C++ parser-backed extraction may require native tree-sitter grammar
  dependencies; install/build failures must be surfaced rather than masked.
- Repository-shape validation can infer wrong commands in unusual build
  systems; plans must distinguish proven, planned, and blocked evidence.
- Context ranking heuristics can improve first pass routing but must not be
  treated as edit-proof evidence.
- `repo:///overview` still over-prioritizes workflows, incidental package files,
  generated metadata, or third-party source in some large repositories. This is
  tracked as durable MCP surface backlog.
- Debug harness status/scope/overview checks are read-only current-code smoke
  tests, not a substitute for warm graph snapshot validation inside each
  external repo's own MCP session.

## Closure Criteria

This spec can close when:

- All tasks are marked completed or explicitly deferred with rationale.
- Required automated gates pass.
- TimeLocker, OneMount, and FreeCAD dogfood confirms the targeted improvements
  or records remaining caveats.
- Accepted behavior is promoted to durable design/reference docs listed in
  [Design](design.md#promotion-targets).
