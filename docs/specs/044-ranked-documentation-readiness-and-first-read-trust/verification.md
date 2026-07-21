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
| Gate 1: Worktree map recovery and repository-real regression | yes | pending | T001-T002 |
| Gate 2: Snapshot-bound status readiness | yes | pending | T003 |
| Gate 3: Orientation and recovery agreement | yes | pending | T004-T005 |
| Gate 4: Published snapshot and two-client acceptance | yes | pending | T006 |
| Gate 5: Full validation, promotion, and closure review | yes | pending | T007 |

## Validation Commands

| Command | Purpose | Result | Evidence |
| --- | --- | --- | --- |
| focused concern-routing and map-index tests | Production extractor and invalid owner behavior | pending | T001-T002 |
| focused status, orientation, docs ranking, and MCP tests | Public readiness and recovery | pending | T003-T005 |
| `pnpm typecheck` | TypeScript contracts and wiring | pending | T006-T007 |
| `pnpm test` | Full regression suite | pending | T006-T007 |
| `pnpm run validate:plugin` | Packaged MCP/provider wiring | pending | T006-T007 |
| `pnpm run validate:skills` | Packaged skill integrity | pending | T007 |
| `pnpm run pack:dry-run` | Distribution contents | pending | T007 |
| lifecycle lint, task audit, evidence quality, closure checks | Spec readiness and closure | pending | T001, T007 |

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
| Requirement 1 | pending | T001-T002 | backlog ownership is navigation-only until bounded classification and CI guard land |
| Requirement 2 | pending | T003 | status hot-path/store failure behavior |
| Requirement 3 | pending | T004-T005 | refresh/source-repair classification |
| Requirement 4 | pending | T006 | installed provider reload and convergence |

## Correctness Property Coverage

| Property | Covered by | Evidence | Residual risk |
| --- | --- | --- | --- |
| CP-001 | T003, T006 | pending | cross-snapshot mismatch |
| CP-002 | T004 | pending | false reusable orientation |
| CP-003 | T004-T005 | pending | refresh loop |

## Agent Readiness Evidence

| Field | Evidence | Residual risk |
| --- | --- | --- |
| Scope and out-of-scope files | canonical context and slice boundary | none identified |
| Must-read context | all package artifacts plus named durable sources | review pending |
| Permissions and approval points | user requested repair, backlog, and active spec creation | implementation remains task-gated |
| Validation commands | table above and repository CI gates | focused file selection may evolve |
| Review needs | independent work-product review before implementation | completed; findings addressed and re-reviewed |
| Durable-doc or closure impact | change-impact promotion table | pending implementation |
| Repo-evidence caveats | live `docs_search` remains blocked until implementation and repaired publication | pending T006/Gate 4 |

## Task Evidence

| Task ID | Status | Evidence | Notes |
| --- | --- | --- | --- |
| T001 | complete | map/ledger edits and revision-bound extractor result | live publication deliberately moves to T006 after implementation |
| T002 | pending | | repository-real regression |
| T003 | pending | | status readiness |
| T004 | pending | | orientation |
| T005 | pending | | recovery action |
| T006 | pending | | cross-client acceptance |
| T007 | pending | | promotion and closure |

## Evidence Log

| Date | Evidence | Result | Notes |
| --- | --- | --- | --- |
| 2026-07-21 | Codex and Claude live queries on snapshot `1784657587477`; read-only concern-state inspection | failed as expected before repair | `docs_search` blocked; orientation falsely reusable; persisted reason named `docs/adr` directory |
| 2026-07-21 | Exact production-extractor command above against `HEAD a95d3d6` plus the displayed worktree map repair | passed after recovery edits | 58 concerns, 72 terms, 60 owners; no failure reason. Initial retry exposed the separate 120,000-byte backlog-owner limit now assigned to T002. |

## Residual Risks

- Public receipt naming may change during implementation review without changing
  required semantics.
- Installed-provider acceptance requires reload after the repo-local package is rebuilt.
- EB059 and EB061 remain intentionally outside this package.

## Durable Promotion And Cleanup

| Spec content | Durable destination or deferral | Status | Evidence |
| --- | --- | --- | --- |
| Readiness and recovery contracts | runtime contracts and MCP surface design | pending | T007 |
| Publication/operations behavior | graph-store and runtime operations design | pending | T007 |
| Map authoring rule | documentation map | partial | immediate repair text added |
| Repository-real extraction proof | `docs/reference/mvp-proof-matrix.md` | pending | T002 and T007 |
| Operational dogfood evidence | dogfood ledger | partial | initial reproduction added |
| Follow-up capacity/reference work | EB059 and EB061 | complete routing | backlog |

### Spec Cleanup Decision

- **Cleanup action:** remove after verified promotion
- **Reason:** Repository policy keeps closed packages out of `docs/specs/`.
- **Final spec commit:** pending
- **Closure log path:** `docs/history/spec-closure-log.md`
- **Closure log entry updated:** no
- **Closure cleanup commit:** pending
- **Active indexes updated:** backlog promotion added; closure pending
- **Durable docs linked back to evidence where useful:** partial
- **Residual spec-only content:** implementation coordination until closure

## Ship Or Closure Risk

- **Risk level:** medium
- **Breaking change:** no
- **Blast radius checked:** partial
- **Rollback path:** revert readiness contract and preserve structured blocked docs result
- **Requires human review:** yes
- **Release notes needed:** yes if public receipts change
- **Follow-up issue or spec needed:** EB059 and EB061 already own excluded work

## Readiness Decision

- **Ready for promotion:** no
- **Ready for release:** no
- **Ready for closure:** no
