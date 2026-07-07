---
title: Index completeness and docs-first warmup verification
doc_type: spec
artifact_type: verification
status: draft
owner: platform
last_reviewed: 2026-07-07
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Verification

## Scope

This verification record covers Spec 036: docs-first indexing, partial
warmup/index coverage, docs-search coverage metadata, and completion or durable
deferral behavior.

## Quality Gates

| Gate | Required? | Status | Evidence |
| --- | --- | --- | --- |
| Requirements acceptance criteria reviewed | yes | complete | Requirements and acceptance criteria reconciled against implementation, durable promotion, and EB014 routing. |
| Task evidence complete | yes | complete | T001 through T010 complete with implementation, validation, routing, and promotion evidence. |
| Automated tests pass or alternate verification recorded | yes | complete | Phase 2 focused validation passed; Phase 3/4 docs and routing changes use recorded validation plus docs/spec checks. |
| Durable documentation updates identified | yes | complete | `change-impact.md` lists and now marks promotion targets. |
| Durable documentation promoted or explicitly deferred | yes | complete | Current behavior promoted; persisted graph completion executor routed to EB014. |
| Spec cleanup decision recorded | yes | complete | Keep active until a separate closure/archive action updates history and removes or archives the package. |
| Governance or policy conflicts resolved | yes | complete | No governance conflicts found; no parser fallback or hidden broad-scan fallback added. |

## Validation Commands

| Command | Purpose | Result | Evidence |
| --- | --- | --- | --- |
| `pnpm typecheck` | TypeScript contract and compile validation. | passed | `tsc --noEmit` passed after Phase 2 contract and presenter changes. |
| `pnpm test -- tests/docs/query-docs.test.ts tests/docs/fts-docs-search-fixtures.test.ts` | Docs search and FTS behavior. | passed | Covered by focused Phase 2 Vitest run; command ran 78 files and 570 tests in this repo setup. |
| `pnpm test -- tests/graph/extraction-pipeline.test.ts` | Graph/docs indexing pipeline behavior. | passed | Phase 2 run updated the large-repo fixture to pass with docs indexed and graph coverage reported non-complete; command ran 78 files and 570 tests in this repo setup. |
| `pnpm test -- tests/runtime/process-workspace-change-queue.test.ts tests/runtime/status.test.ts` | Warmup, watcher, and freshness states. | not rerun | Phase 3 chose durable routing instead of production completion executor changes; no runtime code changed after Phase 2. Existing queue tests remain referenced as coverage for scheduled rescan semantics. |
| `pnpm test -- tests/mcp/docs-surfaces.test.ts tests/mcp/repo-status-resource.test.ts tests/mcp/trust-golden.test.ts` | Public MCP and trust metadata behavior. | partial | `tests/mcp/stdio-entrypoint.test.ts` was covered by the focused Phase 2 run. Remaining broad MCP surfaces were not rerun because Phase 4 is docs/spec-only. |
| `pnpm test -- tests/docs/docs-links-metadata.test.ts` | Docs metadata/link confidence after spec evidence updates. | failed-unrelated | Command expanded into a broad 319s Vitest run; failures were timeout/worker issues in architecture, graph store, hook, and Kiro integration tests unrelated to Phase 2 docs-first indexing. |
| `git diff --check` | Whitespace and patch sanity for Phase 4 docs/spec edits. | passed | No whitespace errors. |
| `spec_lifecycle_manager.lint_spec_package` | Spec package lifecycle lint. | passed-with-warnings | No errors; one advisory canonical-context warning remains and does not require creating `canonical-context.md` for this package. |
| `spec_lifecycle_manager.evidence_quality_check` | Task and evidence consistency. | passed-with-warnings | No errors; one weak-evidence warning remains for the evidence-log table separator, which is an advisory parser artifact. |
| `spec_lifecycle_manager.closure_check` | Closure readiness and blockers. | ready | Ready with no blockers; requirement coverage is complete. The package remains active until a closure/archive action updates history and removes or archives temporary scaffolding. |
| `pnpm test` | Full regression suite. | not run | Broad suite remains expensive and has unrelated timeout/worker failures recorded above; full-suite cleanup is outside this Phase 4 docs promotion slice. |

## Requirement Coverage

| Requirement | Acceptance criteria covered | Evidence | Residual risk |
| --- | --- | --- | --- |
| Requirement 1 | complete | Truncated graph seed snapshots now report `refreshing` and index coverage metadata instead of complete freshness; durable docs describe the rule. | None for this spec. |
| Requirement 2 | complete | Large-repo fixture now finds durable `docs/**` content from docs-priority indexing while graph seed coverage is non-complete; durable docs describe the docs/config seed. | None for this spec. |
| Requirement 3 | complete | Non-complete graph seed coverage is reported and the completion executor is routed to EB014. | Persisted graph completion remains future EB014 work; not residual to this spec. |
| Requirement 4 | complete | `docs_search` reports count basis, docs-index state, indexed docs count, coverage notes, and partial-coverage next actions; durable docs describe usage. | Remaining broad MCP golden validation is residual but not blocking for this docs promotion slice. |
| Requirement 5 | complete | Large-repo fixture proves the fixed docs-search behavior and coverage metadata. | No proof-matrix update required for this scoped bug fix. |

## Correctness Property Coverage

| Property | Covered by | Evidence | Residual risk |
| --- | --- | --- | --- |
| CP-001 | Phase 2 graph extraction and stdio tests. | `tests/graph/extraction-pipeline.test.ts`; `tests/mcp/stdio-entrypoint.test.ts` | None for this spec. |
| CP-002 | Phase 2 docs-search and graph extraction tests. | `tests/docs/query-docs.test.ts`; `tests/graph/extraction-pipeline.test.ts` | Persisted completion remains EB014. |
| CP-003 | Phase 2 large-repo docs-priority fixture. | `tests/graph/extraction-pipeline.test.ts` | None for this spec. |
| CP-004 | Durable deferral to EB014. | `docs/backlog/README.md` | Completion executor remains future work. |

## Scope Reconciliation Before Closure

| Broad requirement, design target, or review finding | Implemented in this spec | Coverage state | Deferred or rejected work | Destination | Blocks closure? | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| Docs-first searchable index | T004 | promoted | None. | Durable docs | no | Focused Phase 2 Vitest run passed; durable docs updated. |
| Partial/truncated freshness semantics | T005, T006 | promoted | None. | Durable docs | no | Focused Phase 2 Vitest run passed; durable docs updated. |
| Resumable completion over remaining files | T005 reporting plus T007 routing | promoted-with-routing | Completion executor remains future work. | EB014 in `docs/backlog/README.md` | no | Non-complete graph coverage is explicit and durable follow-up is recorded. |
| Query ranking/tokenization improvements beyond coverage semantics | none | out-of-scope | Synonyms, stemming, and domain dictionaries are not required. | none | no | Requirements non-goals. |

## Agent Readiness Evidence

| Field | Evidence | Residual risk |
| --- | --- | --- |
| Scope and out-of-scope files | Scope is `src/server.ts`, warmup/indexing use cases, file scanner, SQLite docs search, contracts, presenters, MCP tests, docs tests, runtime tests, and durable docs. Out of scope: parser/LSP fallbacks and generic query synonym work. | Implementation must avoid broad parser changes. |
| Must-read and optional context | Must read all spec artifacts plus `docs/reference/documentation-map.md`, runtime operations design, graph store design, MCP surface design, runtime contracts, and affected source/tests. | Durable docs may need exact section reads before promotion. |
| Permissions and approval points | Normal workspace edits only; no generated `.cache/` commits. | Native dependency validation may need `pnpm rebuild:native` if local install is stale. |
| Validation commands and expected signals | Listed in validation commands. | Full `pnpm test` can be expensive but should run before closure. |
| Review needs | Architecture/implementation review required after behavior changes. | Completion deferral needs explicit owner/destination. |
| Durable-doc or closure impact | Promotion required before closure. | Spec-only behavior blocks closure. |
| Optional repo-evidence provider caveats | Workbench snapshot evidence may be stale or partial for this exact failure class; use direct file reads and tests for implementation evidence. | Avoid relying on docs search to prove docs search coverage. |

## Task Evidence

| Task ID | Status | Evidence | Notes |
| --- | --- | --- | --- |
| T001 | complete | Spec package created. | No code implementation yet. |
| T002 | complete | Dynamic large-repo fixture added in `tests/graph/extraction-pipeline.test.ts`. | Fixture is generated at test runtime to avoid large checked-in files. |
| T003 | complete | Characterization assertions added for truncated fresh snapshot, missing durable docs catalog entry, cold docs index, and blocked docs search. | Phase 2 must invert the unsafe behavior. |
| T004 | complete | Docs-priority indexing added in `index-repository-graph.ts`; large-repo fixture finds durable docs outside graph seed scan. | Promoted to durable docs in T009. |
| T005 | complete | Additive coverage contracts, graph result coverage, refreshing freshness for truncated graph seed, and docs-search metadata added. | Persisted completion executor routed to EB014. |
| T006 | complete | `docs_search` count basis, docs-index state, indexed docs count, coverage notes, and partial-coverage next action covered by tests. | Broad MCP golden validation remains residual. |
| T007 | complete | Completion executor deferred to EB014; public graph state remains non-complete when first-pass graph warmup truncates. | Promoted to durable docs in T009. |
| T008 | complete | Focused validation from Phase 2 remains current for code; Phase 3/4 docs/routing changes are validated through docs/spec checks. | Full broad suite not rerun due unrelated timeout/worker failures. |
| T009 | complete | Accepted behavior promoted to runtime operations, graph store, MCP surface, runtime contracts, changelog, and EB014 backlog docs. | `documentation-map.md` unchanged; existing owners already cover behavior. |
| T010 | complete | Closure risk and cleanup decision recorded; active package retained for separate closure/archive action. | Ready for closure action after this final spec commit. |

## Evidence Log

| Date | Evidence | Result | Notes |
| --- | --- | --- | --- |
| 2026-07-07 | User-reported aws-datalake Workbench docs_search sparsity and follow-up discussion. | accepted input | Root cause: bounded warmup/docs FTS coverage. |
| 2026-07-07 | Read-only senior reviewer architecture assessment. | accepted input | Reviewer concluded hard `2000` cap is only defensible as phase budget, not correctness boundary. |
| 2026-07-07 | Local cache inspection of aws-datalake `.cache/agent-workbench/graph.sqlite`. | observed | Docs FTS contained only front-door/config docs and no `docs/**` rows. |
| 2026-07-07 | Added Phase 1 characterization test in `tests/graph/extraction-pipeline.test.ts`. | passed | Reproduces docs omission when startup scan truncates before `docs/`. |
| 2026-07-07 | `pnpm test -- tests/graph/extraction-pipeline.test.ts` | passed | Vitest ran 78 files and 569 tests successfully in this repo setup. |
| 2026-07-07 | `pnpm test -- tests/docs/docs-links-metadata.test.ts` | passed | Vitest ran 78 files and 569 tests successfully in this repo setup after spec evidence updates. |
| 2026-07-07 | Implemented Phase 2 docs-priority indexing and additive coverage metadata. | passed | T004 through T006 complete in code/tests. |
| 2026-07-07 | `pnpm typecheck` | passed | TypeScript compile validation passed. |
| 2026-07-07 | `pnpm test -- tests/graph/extraction-pipeline.test.ts tests/docs/query-docs.test.ts tests/docs/fts-docs-search-fixtures.test.ts tests/mcp/stdio-entrypoint.test.ts` | passed | Vitest ran 78 files and 570 tests successfully in this repo setup. |
| 2026-07-07 | `pnpm test -- tests/docs/docs-links-metadata.test.ts` | failed | Command expanded into a broad 319s Vitest run; 65 files passed, 6 files failed from timeout/worker issues in architecture, graph store, hook, and Kiro integration tests unrelated to Phase 2 docs-first indexing. |
| 2026-07-07 | Updated `docs/backlog/README.md` EB014 for Spec 036 Phase 3. | routed | Persisted completion executor is deferred; public metadata remains explicitly non-complete for truncated graph seed coverage. |
| 2026-07-07 | Promoted Spec 036 behavior to `docs/design/runtime-operations-design.md`, `docs/design/graph-store-design.md`, `docs/design/mcp-surface-design.md`, `docs/reference/runtime-contracts.md`, and `docs/reference/agent-readable-changelog.md`. | promoted | Current behavior no longer exists only in the temporary spec package. |

## Manual Or External Verification

- Read-only expert review was performed before spec creation. It identified the
  critical risk that incomplete warmups are published as fresh and recommended
  phased indexing with separate docs and graph coverage.

## Residual Risks

- Persisted graph completion remains future work in EB014.
- Broad full-suite validation still has unrelated timeout/worker instability
  recorded in the evidence log.
- Existing caches may require warm-up or rebuild before all new coverage
  metadata is populated.

## Durable Promotion And Cleanup

| Spec content | Durable destination or deferral | Status | Evidence |
| --- | --- | --- | --- |
| Requirements and accepted behavior | Existing durable design/reference docs | promoted | No new requirements doc needed; behavior is architectural/runtime contract detail. |
| Technical design or architecture | `docs/design/runtime-operations-design.md`; `docs/design/graph-store-design.md`; `docs/design/mcp-surface-design.md` | promoted | Warmup phases, coverage separation, docs-search semantics, and EB014 routing documented. |
| Contracts, schemas, integration behavior | `docs/reference/runtime-contracts.md` | promoted | Additive `index_coverage` and coverage-state semantics documented. |
| Operational validation or recovery | `docs/runbooks` only if operator action changes | no-op | No new operator command or recovery procedure in this slice. |
| Decisions and rationale | Durable design docs and `docs/reference/agent-readable-changelog.md` | promoted | Agent-visible behavior and required usage changes documented. |
| Follow-up work | `docs/backlog/README.md` | promoted | EB014 owns persisted graph completion executor. |

### Spec Cleanup Decision

- **Cleanup action:** keep active
- **Reason:** Phase 4 promotion is complete, but closure/removal should be a
  separate action that updates closure history and archive/index records in one
  final cleanup slice.
- **Final spec commit:** this Phase 4 commit
- **Closure log path:** `docs/history/spec-closure-log.md`
- **Closure log entry updated:** no
- **Closure cleanup commit:** pending
- **Active indexes updated:** no
- **Durable docs linked back to evidence where useful:** yes
- **Residual spec-only content:** temporary delivery evidence only; current
  accepted behavior is promoted.

## Ship Or Closure Risk

- **Risk level:** medium
- **Breaking change:** no
- **Blast radius checked:** yes
- **Rollback path:** revert the Phase 2 implementation commit and Phase 4
  durable docs promotion if coverage metadata causes consumer issues.
- **Requires human review:** yes
- **Release notes needed:** yes
- **Follow-up issue or spec needed:** yes, EB014

### Risk Rationale

This change affects public trust semantics and evidence availability across
graph-backed and docs-backed MCP tools. The highest remaining risk is EB014:
files beyond the first graph seed budget remain unindexed until persisted graph
completion ships, but public metadata no longer presents that state as complete.

## Readiness Decision

- **Ready for promotion:** yes
- **Ready for release:** no
- **Ready for closure:** yes, after a separate closure/archive action

## Related Artifacts

- Requirements: `requirements.md`
- Change Impact: `change-impact.md`
- Design: `design.md`
- Tasks: `tasks.md`
- Traceability: `traceability.md`
