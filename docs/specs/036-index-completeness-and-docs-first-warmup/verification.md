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
| Task evidence complete | yes | pending | T001 complete; implementation tasks pending. |
| Automated tests pass or alternate verification recorded | yes | pending | No implementation validation yet. |
| Durable documentation updates identified | yes | pending | `change-impact.md` lists targets. |
| Durable documentation promoted or explicitly deferred | yes | pending | Pending implementation. |
| Spec cleanup decision recorded | yes | pending | Pending implementation and promotion. |
| Governance or policy conflicts resolved | yes | pending | No known conflicts; review after design changes. |

## Validation Commands

| Command | Purpose | Result | Evidence |
| --- | --- | --- | --- |
| `pnpm typecheck` | TypeScript contract and compile validation. | pending | |
| `pnpm test -- tests/docs/query-docs.test.ts tests/docs/fts-docs-search-fixtures.test.ts` | Docs search and FTS behavior. | pending | |
| `pnpm test -- tests/graph/extraction-pipeline.test.ts` | Graph/docs indexing pipeline behavior. | pending | |
| `pnpm test -- tests/runtime/process-workspace-change-queue.test.ts tests/runtime/status.test.ts` | Warmup, watcher, and freshness states. | pending | |
| `pnpm test -- tests/mcp/docs-surfaces.test.ts tests/mcp/repo-status-resource.test.ts tests/mcp/trust-golden.test.ts` | Public MCP and trust metadata behavior. | pending | |
| `pnpm test` | Full regression suite. | pending | Run before closure unless explicitly waived. |

## Requirement Coverage

| Requirement | Acceptance criteria covered | Evidence | Residual risk |
| --- | --- | --- | --- |
| Requirement 1 | pending | Pending tests and implementation. | Truncated snapshot may still overclaim until fixed. |
| Requirement 2 | pending | Pending large-repo docs fixture. | Docs search may stay sparse in large repos until fixed. |
| Requirement 3 | pending | Pending completion or durable deferral decision. | Tail files may remain unindexed unless completion is implemented. |
| Requirement 4 | pending | Pending contract/presenter changes. | Agents may misread result counts or sparse hits. |
| Requirement 5 | pending | Pending fixture-backed tests. | Regression risk remains until fixture exists. |

## Correctness Property Coverage

| Property | Covered by | Evidence | Residual risk |
| --- | --- | --- | --- |
| CP-001 | Pending truncated warmup metadata tests. | | High until implemented. |
| CP-002 | Pending separate docs/graph coverage tests. | | High until implemented. |
| CP-003 | Pending large-repo docs fixture. | | High until implemented. |
| CP-004 | Pending completion-state tests or durable deferral. | | Medium to high depending implementation scope. |

## Scope Reconciliation Before Closure

| Broad requirement, design target, or review finding | Implemented in this spec | Coverage state | Deferred or rejected work | Destination | Blocks closure? | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| Docs-first searchable index | none yet | not-covered | None accepted yet. | none | yes | Pending. |
| Partial/truncated freshness semantics | none yet | not-covered | None accepted yet. | none | yes | Pending. |
| Resumable completion over remaining files | none yet | partial-blocking | May be routed only if partial state is correct and durable follow-up exists. | pending | yes | Pending. |
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
| T002 | pending | | |
| T003 | pending | | |
| T004 | pending | | |
| T005 | pending | | |
| T006 | pending | | |
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
