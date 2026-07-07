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
| Requirements acceptance criteria reviewed | yes | pending | Requirements drafted. |
| Task evidence complete | yes | partial | T001 through T006 complete; T007 through T010 remain pending. |
| Automated tests pass or alternate verification recorded | yes | partial | Phase 2 focused validation ran successfully; completion, promotion, and closure validation remain pending. |
| Durable documentation updates identified | yes | pending | `change-impact.md` lists targets. |
| Durable documentation promoted or explicitly deferred | yes | pending | Pending implementation. |
| Spec cleanup decision recorded | yes | pending | Pending implementation and promotion. |
| Governance or policy conflicts resolved | yes | pending | No known conflicts; review after design changes. |

## Validation Commands

| Command | Purpose | Result | Evidence |
| --- | --- | --- | --- |
| `pnpm typecheck` | TypeScript contract and compile validation. | passed | `tsc --noEmit` passed after Phase 2 contract and presenter changes. |
| `pnpm test -- tests/docs/query-docs.test.ts tests/docs/fts-docs-search-fixtures.test.ts` | Docs search and FTS behavior. | passed | Covered by focused Phase 2 Vitest run; command ran 78 files and 570 tests in this repo setup. |
| `pnpm test -- tests/graph/extraction-pipeline.test.ts` | Graph/docs indexing pipeline behavior. | passed | Phase 2 run updated the large-repo fixture to pass with docs indexed and graph coverage reported non-complete; command ran 78 files and 570 tests in this repo setup. |
| `pnpm test -- tests/runtime/process-workspace-change-queue.test.ts tests/runtime/status.test.ts` | Warmup, watcher, and freshness states. | pending | |
| `pnpm test -- tests/mcp/docs-surfaces.test.ts tests/mcp/repo-status-resource.test.ts tests/mcp/trust-golden.test.ts` | Public MCP and trust metadata behavior. | partial | `tests/mcp/stdio-entrypoint.test.ts` was covered by the focused Phase 2 run; remaining listed MCP surfaces are pending T008. |
| `pnpm test` | Full regression suite. | pending | Run before closure unless explicitly waived. |

## Requirement Coverage

| Requirement | Acceptance criteria covered | Evidence | Residual risk |
| --- | --- | --- | --- |
| Requirement 1 | implemented-not-promoted | Truncated graph seed snapshots now report `refreshing` and index coverage metadata instead of complete freshness. | Durable docs still need promotion. |
| Requirement 2 | implemented-not-promoted | Large-repo fixture now finds durable `docs/**` content from docs-priority indexing while graph seed coverage is non-complete. | Durable docs still need promotion. |
| Requirement 3 | partially-implemented | Non-complete graph seed coverage is now reported; T007 still owns completion executor or durable deferral. | Tail files remain unindexed until completion is implemented or routed. |
| Requirement 4 | implemented-not-promoted | `docs_search` reports count basis, docs-index state, indexed docs count, coverage notes, and partial-coverage next actions. | Remaining MCP golden/docs-surface validation is deferred to T008. |
| Requirement 5 | implemented-not-promoted | Large-repo fixture now proves the fixed docs-search behavior and coverage metadata. | T007 still owns completion/deferral proof. |

## Correctness Property Coverage

| Property | Covered by | Evidence | Residual risk |
| --- | --- | --- | --- |
| CP-001 | Phase 2 graph extraction and stdio tests. | `tests/graph/extraction-pipeline.test.ts`; `tests/mcp/stdio-entrypoint.test.ts` | Durable promotion remains. |
| CP-002 | Phase 2 docs-search and graph extraction tests. | `tests/docs/query-docs.test.ts`; `tests/graph/extraction-pipeline.test.ts` | T007 still owns completion/deferral. |
| CP-003 | Phase 2 large-repo docs-priority fixture. | `tests/graph/extraction-pipeline.test.ts` | Durable promotion remains. |
| CP-004 | Pending completion-state tests or durable deferral. | | Medium to high depending implementation scope. |

## Scope Reconciliation Before Closure

| Broad requirement, design target, or review finding | Implemented in this spec | Coverage state | Deferred or rejected work | Destination | Blocks closure? | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| Docs-first searchable index | T004 | implemented-not-promoted | None accepted yet. | T009 durable docs | yes | Focused Phase 2 Vitest run passed. |
| Partial/truncated freshness semantics | T005, T006 | implemented-not-promoted | None accepted yet. | T009 durable docs | yes | Focused Phase 2 Vitest run passed. |
| Resumable completion over remaining files | T005 reporting only | partial-blocking | Completion executor remains undecided. | T007 | yes | Non-complete graph coverage is explicit. |
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
| T004 | complete | Docs-priority indexing added in `index-repository-graph.ts`; large-repo fixture finds durable docs outside graph seed scan. | Durable promotion remains. |
| T005 | complete | Additive coverage contracts, graph result coverage, refreshing freshness for truncated graph seed, and docs-search metadata added. | T007 still owns completion/deferral. |
| T006 | complete | `docs_search` count basis, docs-index state, indexed docs count, coverage notes, and partial-coverage next action covered by tests. | Broader MCP golden validation remains in T008. |
| T007 | pending | | |
| T008 | pending | | |
| T009 | pending | | |
| T010 | pending | | |

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

## Manual Or External Verification

- Read-only expert review was performed before spec creation. It identified the
  critical risk that incomplete warmups are published as fresh and recommended
  phased indexing with separate docs and graph coverage.

## Residual Risks

- The spec is not implemented yet.
- Exact metadata shape may change during implementation.
- Completion-phase behavior is still an open design decision; closure requires
  either implementation or explicit durable deferral.

## Durable Promotion And Cleanup

| Spec content | Durable destination or deferral | Status | Evidence |
| --- | --- | --- | --- |
| Requirements and accepted behavior | `docs/requirements/runtime-requirements.md` if requirement language changes | pending | |
| Technical design or architecture | `docs/design/runtime-operations-design.md`; `docs/design/graph-store-design.md`; `docs/design/mcp-surface-design.md` | pending | |
| Contracts, schemas, integration behavior | `docs/reference/runtime-contracts.md` | pending | |
| Operational validation or recovery | `docs/runbooks` only if operator action changes | pending | |
| Decisions and rationale | Durable design docs or ADR if architectural decision needs separate record | pending | |
| Follow-up work | `docs/backlog/README.md` if completion/ranking work is deferred | pending | |

### Spec Cleanup Decision

- **Cleanup action:** keep active
- **Reason:** Spec is newly created and not implemented.
- **Final spec commit:** pending
- **Closure log path:** `docs/history/spec-closure-log.md`
- **Closure log entry updated:** no
- **Closure cleanup commit:** pending
- **Active indexes updated:** no
- **Durable docs linked back to evidence where useful:** no
- **Residual spec-only content:** all behavior pending implementation

## Ship Or Closure Risk

- **Risk level:** high
- **Breaking change:** no
- **Blast radius checked:** no
- **Rollback path:** not documented
- **Requires human review:** yes
- **Release notes needed:** yes
- **Follow-up issue or spec needed:** unknown

### Risk Rationale

This change affects public trust semantics and evidence availability across
graph-backed and docs-backed MCP tools. Incorrect implementation can make
agents overtrust partial evidence or block useful evidence unnecessarily.

## Readiness Decision

- **Ready for promotion:** no
- **Ready for release:** no
- **Ready for closure:** no

## Related Artifacts

- Requirements: `requirements.md`
- Change Impact: `change-impact.md`
- Design: `design.md`
- Tasks: `tasks.md`
- Traceability: `traceability.md`
