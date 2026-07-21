---
title: Ranked documentation readiness verification
doc_type: spec
artifact_type: verification
status: draft
owner: platform
last_reviewed: 2026-07-21
---

# Verification

## Scope

Spec 044 requirements, tasks T001-T007, public status/orientation/docs-search
contracts, production concern extraction, daemon publication, and Codex/Claude
installed-runtime acceptance.

## Quality Gates

| Gate | Required? | Status | Evidence |
| --- | --- | --- | --- |
| Gate 1: Worktree map recovery and repository-real regression | yes | passed | T001-T002: production extraction complete; focused suite 26/26 |
| Gate 2: Snapshot-bound status readiness | yes | passed | T003: exhaustive readiness, trust, recovery, snapshot identity, and presentation-safety regressions pass |
| Gate 3: Orientation and recovery agreement | yes | passed | T004-T005: exact-snapshot orientation trust, bounded refresh admission, and executable docs-search recovery agree |
| Gate 4: Published snapshot and two-client acceptance | yes | passed | T006: snapshot `1784667715173`; Codex and Claude parity |
| Gate 5: Full validation, promotion, and closure review | yes | passed | T007: reviewed candidate `54f1dfe`; final lifecycle gates below |

## Validation Commands

| Command | Purpose | Result | Evidence |
| --- | --- | --- | --- |
| focused concern-routing and map-index tests | Production extractor and invalid owner behavior | passed | Final combined focused run: 10 files; 191/191 tests |
| focused status, orientation, docs ranking, refresh, and MCP tests | Public readiness and recovery | passed for Phase 3 | T004-T005: 131/131 tests passed |
| `pnpm typecheck` | TypeScript contracts and wiring | passed | Final Phase 5 candidate |
| `pnpm test` | Full regression suite | passed | Uncontended final run: 99 files; 1061/1061 tests |
| `pnpm run validate:plugin` | Packaged MCP/provider wiring | passed | Final Phase 5 candidate |
| `pnpm run validate:skills` | Packaged skill integrity | passed | 6 owned files; no errors or warnings |
| `pnpm run pack:dry-run` | Distribution contents | passed | package `0.6.1`; 246 entries |
| lifecycle lint, task audit, evidence quality, closure checks | Spec readiness and closure | passed | T007; final commands returned no blockers before removal |

## Production Extractor Command

The Phase 1 proof was run from repository root at `HEAD a95d3d6` plus the
uncommitted documentation-map recovery shown by `git diff`. It is evidence for
the worktree candidate, not a claim about the checked-in revision.

```bash
pnpm exec tsx -e 'import path from "node:path"; import { extractDocumentationConcernIndex } from "./src/application/use-cases/document-currency-routing.ts"; import { WorkspaceFileAdapter } from "./src/infrastructure/filesystem/index.ts"; void (async () => { const evidence = await extractDocumentationConcernIndex({ workspace: new WorkspaceFileAdapter({ repoRoot: path.resolve(".") }) }); console.log(JSON.stringify({ state: evidence.state, source_path: evidence.source_path, failure_reason: evidence.failure_reason, concerns: evidence.concerns.length, terms: evidence.terms.length, owners: evidence.owners.length })); })();'
```

Expected Phase 1 result:

```json
{"state":"complete","source_path":"docs/reference/documentation-map.md","concerns":58,"terms":72,"owners":60}
```

## Cross-Client Acceptance Payload

After both clients read `repo:///status` and bind the same published snapshot,
Codex and Claude Code SHALL each execute exactly:

```json
{
  "repo_root": "/home/bcherrington/Projects/Auriora/agent-workbench",
  "query": "rule governing SessionStart behavior",
  "max_results": 10,
  "include_snippets": true
}
```

The first page must have `trust_state: complete_ranked_universe`; it must
include `docs/design/coding-agent-integration-design.md` with
`doc_status: current` and `authority: canonical`. The two client records must
match on runtime and provider-plugin version, selected snapshot ID, ranking
readiness state/recovery, docs-search trust state, that hit's path, authority,
doc status, and governing concern evidence. Result scores and timing are
diagnostic, not parity fields.

## Requirement Coverage

| Requirement | Acceptance criteria covered | Evidence | Residual risk |
| --- | --- | --- | --- |
| Requirement 1 | AC1-AC6 | T001-T002: repository-real worktree map candidate complete with restored backlog owner; bounded metadata and invalid-owner regressions pass | revision-bound evidence follows the Phase 1 commit |
| Requirement 2 | AC1-AC6 | T003/T007: strict readiness receipt; exhaustive mapping; non-blocking `no_map` with frozen partial trust; atomic legacy-universe migration; typed term/owner/overflow environment races; public redaction and 512-byte cap | none identified |
| Requirement 3 | AC1-AC3 | T004-T005: blocked ranking evidence makes orientation non-reusable; only refresh recovery admits the coordinator; the callable status action returns the same snapshot/category/recovery | installed-client acceptance remains T006 |
| Requirement 4 | AC1-AC4 | T006: fresh ranking-ready snapshot `1784667715173`; exact Codex/Claude parity receipt. T007 final candidate install and daemon restart published `1784671161602`; Claude Code `2.1.217` repeated the exact query and Codex `0.144.6` observed the same fresh ready snapshot/runtime, while its non-interactive MCP client cancelled the search call before execution. | Phase 4 remains the complete two-client query parity proof; final candidate happy-path behavior is additionally covered by daemon-provider regression and Claude live acceptance |

## Correctness Property Coverage

| Property | Covered by | Evidence | Residual risk |
| --- | --- | --- | --- |
| CP-001 | T003, T006 | status and docs-search regressions reject foreign snapshot state, terms, and owners before use; both installed clients selected `1784667715173` across status, orientation, and search | none identified |
| CP-002 | T004 | missing, foreign, invalid, and unavailable ranking receipts are non-reusable; ready complete/no-map receipts remain reusable | installed-client proof remains T006 |
| CP-003 | T004-T005 | source/request/environment repair never admits refresh; failed dirty generations are observed without retry; recovery actions preserve the classified boundary | installed-client proof remains T006 |

## Agent Readiness Evidence

| Field | Evidence | Residual risk |
| --- | --- | --- |
| Scope and out-of-scope files | canonical context and slice boundary | none identified |
| Must-read context | all package artifacts plus named durable sources | Phase 2 implementation review complete; later phases remain |
| Permissions and approval points | user requested repair, backlog, and active spec creation | implementation remains task-gated |
| Validation commands | table above and repository CI gates | focused file selection may evolve |
| Review needs | independent work-product review before implementation | completed; findings addressed and re-reviewed |
| Durable-doc or closure impact | change-impact promotion table | pending implementation |
| Repo-evidence caveats | live `docs_search` remains blocked until implementation and repaired publication | pending T006/Gate 4 |

## Task Evidence

| Task ID | Status | Evidence | Notes |
| --- | --- | --- | --- |
| T001 | complete | map/ledger edits and revision-bound extractor result | live publication deliberately moves to T006 after implementation |
| T002 | complete | production extraction 59 concerns/73 terms/61 owners; focused suite 26/26; typecheck and docs checks passed | repository-real regression and bounded metadata classification |
| T003 | complete | strict readiness contract; exact-snapshot status and docs-search guards; orientation trust/refresh projection; public safety regression; focused 97/97; typecheck; full 1029/1029 | independent review found five issues; all were fixed and re-review cleared the slice |
| T004 | complete | shared readiness classifier, truthful orientation blockers, refresh-only admission, failed-generation convergence; focused 131/131 and full suite pass | independent implementation review found no issues |
| T005 | complete | docs-search action executed verbatim through MCP and matched status snapshot/category/recovery; frozen cursor continuation preserved | installed-client proof belongs to T006 |
| T006 | complete | daemon-backed two-provider regression; repaired `0.6.1` package install; Codex `0.144.6` and Claude Code `2.1.216` accepted snapshot `1784667715173` and identical pinned result fields | global per-file FTS sweep removed after live rebuild timeout; duplicate same-ID FTS rows routed to EB062 |
| T007 | complete | candidate `54f1dfe`; independent MoE review/re-review; 191/191 focused and 1061/1061 full tests; exact installed artifact and final fresh publication | EB063 routes generic shared failure-message redaction outside this spec |

## Evidence Log

Evidence-quality tooling may report the Markdown table separator immediately
below as weak evidence. That row is table syntax, not an evidence claim; the
warning is accepted as a parser false positive and does not reduce the concrete
records that follow.

| Date | Evidence | Result | Notes |
| --- | --- | --- | --- |
| 2026-07-21 | Codex and Claude live queries on snapshot `1784657587477`; read-only concern-state inspection | failed as expected before repair | `docs_search` blocked; orientation falsely reusable; persisted reason named `docs/adr` directory |
| 2026-07-21 | Exact production-extractor command above against `HEAD a95d3d6` plus the displayed worktree map repair | passed after recovery edits | 58 concerns, 72 terms, 60 owners; no failure reason. Initial retry exposed the separate 120,000-byte backlog-owner limit now assigned to T002. |
| 2026-07-21 | Spec 044 Phase 1 production extractor against the restored repository-real worktree map candidate | passed | `complete`; 59 concerns, 73 terms, 61 owners; `docs/backlog/README.md` classified `draft`; no failure reason. Revision-bound evidence awaits the Phase 1 commit. |
| 2026-07-21 | `pnpm exec vitest run tests/docs/documentation-concern-routing.test.ts`; `pnpm typecheck`; docs link/frontmatter test; Markdown set check; `git diff --check` | passed | 26/26 focused tests and 2/2 docs tests; no non-table Markdown findings. |
| 2026-07-21 | `pnpm test`, followed by exact daemon-suite rerun | partial full-suite environment evidence | Full suite reached 1004/1005; one daemon refresh case observed stale instead of fresh outside the changed file set. `tests/mcp/daemon-entrypoint-integration.test.ts` then passed 15/15 in isolation, proving intermittence but not root cause. The failure remains recorded rather than treated as a clean full-suite pass. |
| 2026-07-21 | Final `pnpm test` after bounded-iterator correction | passed | 97 test files passed; 1006/1006 tests passed. This supplies clean full-suite Phase 1 evidence while preserving the earlier intermittent observation above. |
| 2026-07-21 | Spec 044 Phase 2 focused contract, status, orientation, docs-ranking, and MCP resource suites; `pnpm typecheck`; `git diff --check` | passed | 5 files and 97/97 focused tests passed; strict receipt, exhaustive mapping, CP-001 guards, trust projection, recovery classification, and public reason safety are covered. |
| 2026-07-21 | Independent Phase 2 implementation review and two re-review passes over the 14-file diff; reviewer reran 5 focused files, 97/97 tests, `pnpm typecheck`, and `git diff --check` | passed | Five reported issues were repaired: foreign docs concern evidence, incorrect refresh guidance, permissive receipt combinations, mismatch recovery semantics, and incomplete public redaction proof; the final 3-file/66-test narrow rerun reported zero blockers and warnings. |
| 2026-07-21 | First two Phase 2 full-suite runs plus isolated installed-provider smoke rerun | test-budget failure characterized | Both full runs passed 1028/1029 and exceeded the default 5-second budget in the same three-process Claude discovery test; the exact 37-test file passed in isolation. The test budget was aligned to the existing 15-second multi-process convention without adding retries. |
| 2026-07-21 | Final `pnpm test` after provider-smoke budget correction | passed | 97 test files passed; 1029/1029 tests passed. |
| 2026-07-21 | Spec 044 Phase 3 focused status, orientation, docs-ranking, recovery-chain, refresh-coordinator, and stdio suites; `pnpm typecheck`; `pnpm test`; `git diff --check` | passed | Focused run passed 8 files and 131/131 tests; typecheck, full Vitest suite, and diff check exited successfully. Cursor continuation was rechecked after moving readiness admission to initial searches only. |
| 2026-07-21 | Independent Phase 3 implementation review across application, MCP, runtime, and test changes; reviewer reran 6 focused files, `pnpm typecheck`, and `git diff --check` | passed | Reviewer passed 104/104 tests and reported zero blockers, warnings, or suggestions; installed-client acceptance remains explicitly assigned to T006. |
| 2026-07-21 | Phase 4 real-repository rebuild with the unchanged 60-second worker deadline | failed, repaired, then passed | Repeated pre-repair workers timed out after per-file `node_fts NOT IN` sweeps amplified retained snapshot cost. Scoped file/snapshot cleanup already preserved the invariant; after removal, snapshot `1784667715173` published fresh in 34.6 seconds and pruned failed builds. |
| 2026-07-21 | Fresh Codex app-server and Claude Code clients executed the exact cross-client payload against installed runtime/plugin `0.6.1` | passed | Both selected snapshot `1784667715173`, reported reusable orientation with no blockers and `complete_ranked_universe`, and returned `docs/design/coding-agent-integration-design.md` as `current`/`canonical` with the coding-agent concern match. |
| 2026-07-21 | Phase 4 focused graph-store and daemon ranking suites; daemon crash-recovery and status-refresh suites; `pnpm typecheck`; plugin, skills, package, and documentation gates; final serial `pnpm test` | passed | Focused acceptance passed 44/44; crash/status process suites passed 28/28; full suite passed 99 files and 1050/1050 tests. The crash fixture now seeds concern evidence so first-read ranking cannot start an unintended refresh, and real-process test budgets match their concurrent full-suite execution cost. |
| 2026-07-21 | Independent Phase 5 architecture, QA, lifecycle, and operations/security review with repeated re-review | passed after repair | Findings repaired: first-insertion FTS cleanup, no-map public trust, frozen continuation admission, bounded production owner I/O, atomic legacy-universe migration, typed term/owner/overflow environment races, installed-client receipt granularity, snapshot-independent proof, and durable contract wording. Shared generic MCP error-message redaction is separately routed to EB063. |
| 2026-07-21 | Final focused tests; `pnpm typecheck`; plugin/skills/package gates; uncontended `pnpm test` | passed | Focused run passed 10 files and 191/191 tests. Final full suite passed 99 files and 1061/1061 tests. A prior full run overlapped reviewer test processes and passed 1056/1058 with two daemon timing failures; the uncontended rerun supplied the closure gate. |
| 2026-07-21 | Candidate `54f1dfe` local package install and source parity | passed | Tarball `auriora-agent-workbench-0.6.1.tgz` SHA-256 `4c4083ec9aa3c4dcfbc02ca56d954638ab55f3f2d6aeac862927499ff82ba356`; installed and repository graph-store source SHA-256 both `3004852f23c4eabc1ebd8c10552e87458d6cae70729a38d0af6a034173c73675`; Codex and repo-local Claude plugins enabled at `0.6.1`. |
| 2026-07-21 | Final daemon restart and installed-client acceptance | passed with recorded Codex-client limitation | Final-source daemon PID `2881415` completed execution `refresh-10988012-9680-4c29-9785-87d2d8d2b2a0` and published snapshot `1784671161602` fresh/ready. Claude Code `2.1.217` returned `complete_ranked_universe` and the canonical/current coding-agent design with owner evidence. Codex `0.144.6` observed the same runtime/plugin, PID, snapshot, freshness, and readiness; its non-interactive MCP client cancelled two `docs_search` attempts before execution, so complete Codex query parity remains the Phase 4 receipt. |

## Residual Risks

- EB059, EB061, and EB062 remain intentionally outside this package.

## Durable Promotion And Cleanup

| Spec content | Durable destination or deferral | Status | Evidence |
| --- | --- | --- | --- |
| Readiness and recovery contracts | runtime contracts and MCP surface design | complete | T007; five result shapes, no-map/frozen trust, and recovery promoted |
| Publication/operations behavior | graph-store and runtime operations design | complete | T007; bounded I/O, atomic migration, and first-insertion cleanup promoted |
| Map authoring rule | documentation map | complete for Phase 1 | file-only owner rule retained and backlog owner restored |
| Repository-real extraction proof | `docs/reference/mvp-proof-matrix.md` | complete for Phase 1 | checked-in map and metadata-boundary gate added; final promotion review remains T007 |
| Operational dogfood evidence | dogfood ledger | complete for Phase 4 | installed two-client acceptance and rebuild repair recorded |
| Follow-up capacity/reference/storage work | EB059, EB061, and EB062 | complete routing | backlog |

### Spec Cleanup Decision

- **Cleanup action:** remove after verified promotion
- **Reason:** Repository policy keeps closed packages out of `docs/specs/`.
- **Final spec commit:** recorded by the closure plan after this evidence commit
- **Closure log path:** `docs/history/spec-closure-log.md`
- **Closure log entry updated:** prepared for closure application
- **Closure cleanup commit:** resolved after package removal
- **Active indexes updated:** EB060 closure and archive records accompany removal
- **Durable docs linked back to evidence where useful:** yes
- **Residual spec-only content:** none after removal

## Ship Or Closure Risk

- **Risk level:** low
- **Breaking change:** no
- **Blast radius checked:** yes; runtime, graph store, filesystem adapter, MCP presentation, persistence migration, packaging, and live daemon/client paths
- **Rollback path:** revert readiness contract and preserve structured blocked docs result
- **Requires human review:** completed through independent MoE review
- **Release notes needed:** agent-readable unreleased changelog updated; formal release notes remain release-flow work
- **Follow-up issue or spec needed:** EB059, EB061, EB062, and EB063 own excluded work

## Readiness Decision

- **Ready for promotion:** yes
- **Ready for release:** no
- **Ready for closure:** yes
