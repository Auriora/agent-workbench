---
title: Production documentation corpus isolation and governing-owner priority verification
doc_type: spec
artifact_type: verification
status: draft
owner: platform
last_reviewed: 2026-08-02
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Verification

## Scope

Plan evidence for Requirements 1-6, Tasks T001-T009, CP-001 through CP-007,
the additive corpus-policy/storage change, the v2 ranking migration, both
repository-root shapes, exact SessionStart ordering, durable promotion, and
closure readiness.

## Quality Gates

| Gate | Required? | Status | Evidence |
| --- | --- | --- | --- |
| Requirements/design/task trace reviewed | yes | complete | 2026-08-02 lifecycle preflight plus requirements/QA, architecture, and persistence/operations MoE review; T002 seam updated for findings |
| Corpus policy and parity tests pass | yes | complete | focused and full-suite tests cover containing-product, selected-root, live/snapshot parity, and read traps |
| Contract/store/readiness tests pass | yes | complete | contract, graph-store, status, empty-corpus, and MCP recovery tests pass |
| Ranking/migration/cursor tests pass | yes | complete | owner-priority permutations, v2 store, migration, pagination, and cursor tests pass |
| Typecheck and full suite pass | yes | complete | `pnpm typecheck`; 109 files and 1,211 tests passed with four workers |
| Plugin/package validation passes | yes | complete | plugin validation and package dry-run passed |
| Bounded dogfood and direct count inspection pass | yes | complete with blocked observation | isolated checkout-copy refresh hit the finite worker deadline before a snapshot; structured blocking evidence is recorded and no acceptance claim was made |
| Durable documentation promoted | yes | complete | all `change-impact.md` durable owners updated; EB064 delivered in source |
| Final multi-discipline review addressed | yes | complete | architecture review found no actionable defect; QA fixture/status findings and zero-document readiness loop fixed |
| Closure check and cleanup decision recorded | yes | complete | closure check reports ready with no blockers; package intentionally remains active until explicit closure authorization |

## Validation Commands

| Command | Purpose | Result | Evidence |
| --- | --- | --- | --- |
| lifecycle package lint/review tools | structural and trace readiness | passed | 0 package diagnostics before implementation; final audit follows reconciliation |
| `pnpm typecheck` | TypeScript contract/integration correctness | passed | final settled worktree |
| focused `pnpm exec vitest run ... --maxWorkers=4` slices | rapid requirement regressions | passed | 16-file Spec 052 slice passed 266 tests; later status/store regressions also passed |
| `pnpm exec vitest run --maxWorkers=4` | full bounded regression suite | passed | 109 files, 1,211 tests |
| `pnpm validate:plugin` | packaged MCP surface consistency | passed | plugin/package validation passed |
| `pnpm validate:skills` | packaged skill consistency if touched by promotion | not applicable | no packaged skill changed |
| `pnpm pack:dry-run` | packaged artifact completeness | passed | package contains the changed runtime source |
| `git diff --check` | whitespace/patch integrity | passed | final implementation and promotion diff |

Exact focused test paths are finalized in T002 after the implementation seam is
confirmed; they must cover the named gates below rather than relying only on a
broad suite.

## Verification Gates

### G1: Package Readiness

Lifecycle lint, requirements/design trace review, task-state audit, and
architecture/migration review report no blocker before source implementation.

### G2: Contract And Migration Seam

The selected corpus receipt/policy identity, count equations, v2 transient
universe migration, stale-policy blocker, and no-fallback boundary are explicit
in design/contracts/tests.

### G3: Corpus Isolation And Root Relativity

Table and integration tests prove containing-product exclusion, selected-root
inclusion, shared surface parity, path normalization, and no excluded-content
read.

### G4: Counts, Attribution, And Trust

Contract/store/MCP tests prove exact count conservation, bounded
`embedded_fixture` attribution, excluded-owner evidence without document/candidate
identity, no content leakage, current policy round-trip, refresh-required
blocking on missing/mismatched identity, and non-blocking map-less behavior.

### G5: Exact Owner Ranking

Candidate permutations and the exact SessionStart request prove the public v2
owner-priority component puts the canonical/current governing owner first,
valid multi-owner ordering is deterministic, invalid/excluded owners retain
truthful evidence without priority, and unmatched queries preserve their
established behavior.

### G6: Migration And Cursor Compatibility

Transactional migration tests prove old transient universes are removed or
invalidated, current graph evidence is preserved, v2 universes round-trip, and
old/tampered cursors return the existing restart path without implicit rebuild.

### G7: Full Repository Gates

Typecheck, full tests with bounded workers, required plugin/skill/package checks,
and diff checks pass.

### G8: Dogfood Acceptance

On a fresh snapshot, the exact SessionStart request returns the coding-agent
integration design first; `docs_current_for_task` returns no embedded fixture
docs; direct read-only SQLite inspection reconciles corpus/search counts and
policy versions. Dogfood records runtime/package/snapshot identity and does not
claim more than the executed evidence.

### G9: Durable Promotion

Every target in `change-impact.md` describes current implemented behavior or a
truthful residual route; EB059 and EB065 remain separate.

### G10: Closure Readiness

Requirement/property coverage, implementation review, evidence quality,
promotion, cleanup metadata, and archive validation have no blocker.

## Requirement Coverage

| Requirement | Acceptance criteria covered | Evidence | Residual risk |
| --- | --- | --- | --- |
| Requirement 1 | AC1-AC6 | G3 passed | broader fixture conventions remain evidence-gated |
| Requirement 2 | AC1-AC6 | G4 passed | pre-policy snapshots intentionally require refresh |
| Requirement 3 | AC1-AC6 | G5 passed | owner precedence remains exact-concern scoped |
| Requirement 4 | AC1-AC4 | G6 passed | transient v1 universes intentionally invalidated |
| Requirement 5 | AC1-AC4 | G3-G7 passed; G8 blocked observation retained | installed fresh-snapshot acceptance remains evidence, not implementation scope |
| Requirement 6 | AC1-AC3 | G9 passed | closure/removal awaits explicit authorization |

## Correctness Property Coverage

| Property | Covered by | Evidence | Residual risk |
| --- | --- | --- | --- |
| CP-001 | T003, T004, T007; G3 | passed | broader conventions gated |
| CP-002 | T003, T004; G3 | passed | none |
| CP-003 | T004, T005, T007; G4 | passed | none |
| CP-004 | T006, T007; G5 | passed | exact concern only |
| CP-005 | T006, T007; G5-G6 | passed | none |
| CP-006 | T005, T007; G4-G6 | passed | refresh remains an operational action |
| CP-007 | T003, T004, T006, T007; G3-G5 | passed | additive owner state |

## Scope Reconciliation Before Closure

| Broad requirement, design target, or review finding | Implemented in this spec | Coverage state | Deferred or rejected work | Destination | Blocks closure? | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| Requirement 1 through Requirement 5 implementation | corpus, admission, coverage, readiness, owner priority, migration, and regressions | covered | installed acceptance evidence | dogfood ledger | no | T003-T008 plus full suite |
| Requirement 6 durable promotion | all mapped durable owners and EB064 source delivery | covered | package closure/removal | active Spec 052 | no | T009 |
| ranked-universe capacity/eviction | none | out-of-scope | explicit policy decision | EB059 | no | requirements/design boundary |
| validation-plan payload compaction | none | out-of-scope | independent repair | EB065 | no | requirements/design boundary |

## Agent Readiness Evidence

| Field | Evidence | Residual risk |
| --- | --- | --- |
| Scope and out-of-scope files | requirements, design, change impact, and the final implementation diff | EB059 and EB065 remain separately owned |
| Must-read context | canonical context, all package artifacts, and promoted durable owners | none for source implementation |
| Permissions and approval points | source/docs/tests only; no external writes | commit and closure remain separate user actions |
| Validation commands and expected signals | G1-G10 and command table | installed-runtime observation remains pending evidence |
| Review needs | requirements/QA, architecture, persistence/operations, and final implementation MoE | complete; no actionable defect remains |
| Durable-doc or closure impact | all `change-impact.md` destinations promoted | package intentionally remains active |
| Repo-evidence provider caveats | direct tests/store inspection prove behavior; checkout-copy dogfood retained a structured worker-deadline blocker | installed snapshot freshness was not achieved |

## Task Evidence

| Task ID | Status | Evidence | Notes |
| --- | --- | --- | --- |
| T001 | complete | lifecycle lint 0 errors/warnings; independent readiness review and 2026-08-02 MoE recheck | package review complete; T002 findings reconciled before source implementation |
| T002 | complete | contracts/store/status tests and reviewed design seam | additive contract and migration |
| T003 | complete | pure policy tests | corpus policy |
| T004 | complete | extraction/current-doc/query/MCP surface tests | all admission surfaces |
| T005 | complete | store/status/readiness tests including empty corpus | storage/readiness/counts |
| T006 | complete | ranking permutations, migration, cursor, pagination tests | ranking/version |
| T007 | complete | focused Spec 052 regression suite | cross-surface acceptance |
| T008 | complete | typecheck, 1,211-test full suite, plugin/package/diff gates; blocked dogfood receipt | validation/dogfood boundary |
| T009 | complete | durable promotion and final MoE findings addressed | implementation complete; spec remains active |

## Evidence Log

| Date | Evidence | Result | Notes |
| --- | --- | --- | --- |
| 2026-08-02 | `lint_spec_package` and `reconcile_spec` after direct source/backlog inspection | passed | 0 lint diagnostics; no reconciliation findings or blind spots |
| 2026-08-02 | Pre-implementation requirements/QA, architecture, and persistence/operations MoE | passed after reconciliation | findings were incorporated into `design.md`, `tasks.md`, and `traceability.md` before source implementation |
| 2026-08-02 | Focused Spec 052 tests | passed | 266 tests across 16 files, followed by zero-document/status regressions |
| 2026-08-02 | Final repository validation | passed | typecheck; 109 Vitest files/1,211 tests; plugin validation; package dry-run; diff check |
| 2026-08-02 | Checkout-copy source dogfood recorded in `docs/reference/dogfood-evidence-ledger.md` | blocked truthfully | `Refresh worker deadline expired` before a fresh snapshot; no ranking/count acceptance claimed |
| 2026-08-02 | Final architecture and QA MoE over the implementation diff | passed after fixes | `tests/mcp/repo-status-resource.test.ts` fixture correction and `tests/graph/docs-ranked-universe-store.test.ts` zero-document regression pass; no remaining actionable implementation or migration defect |

## Manual Or External Verification

Checkout-source dogfood against an isolated copy of this repository returned a
structured cold/failed status because the refresh worker deadline expired. The
dogfood ledger records the exact boundary. Installed-runtime fresh-snapshot
ranking and direct count reconciliation remain pending acceptance evidence and
are not presented as implementation proof.

## Residual Risks

- An overly broad fixture predicate could erase legitimate product docs;
  mitigate with structural minimum and selected-root regression.
- An old snapshot could appear successful after upgrade; mitigate with persisted
  corpus-policy identity and readiness blocking.
- Changing rank order without versioning could corrupt cursor semantics;
  mitigate with v2 identity and transient migration.
- Counts could mix discovered, eligible, indexed, excluded, and searchable
  bases; mitigate with explicit equations and contract tests.

## Durable Promotion And Cleanup

| Spec content | Durable destination or deferral | Status | Evidence |
| --- | --- | --- | --- |
| requirements and accepted behavior | runtime requirements; backlog | complete | T009 |
| corpus and owner-ranking design | documentation map; MCP surface design | complete | T009 |
| storage/migration behavior | graph-store design | complete | T009 |
| public contracts | runtime contracts | complete | T009 |
| proof and dogfood | MVP proof matrix; dogfood ledger | complete with blocked installed-acceptance residual | T009 |
| agent-visible change | agent-readable changelog | complete | T009 |
| follow-up work | EB059; EB065 | already routed | unchanged backlog ownership |

### Spec Cleanup Decision

- **Cleanup action:** remove after verified promotion and closure
- **Reason:** temporary implementation scaffold; durable owners retain behavior
- **Final spec commit:** pending
- **Closure log path:** `docs/history/spec-closure-log.md`
- **Closure log entry updated:** no
- **Closure cleanup commit:** pending
- **Active indexes updated:** no
- **Durable docs linked back to evidence where useful:** no
- **Residual spec-only content:** none expected

## Ship Or Closure Risk

- **Risk level:** medium
- **Breaking change:** no request-schema break; intentional ranking/version change
- **Blast radius checked:** yes, by focused contract/store/MCP tests and the
  1,211-test full suite
- **Rollback path:** restore prior runtime/store from preserved transaction and
  rebuild a previous-compatible snapshot; no mixed-policy fallback
- **Requires human review:** yes
- **Release notes needed:** yes
- **Follow-up issue or spec needed:** no, EB059 and EB065 already own exclusions

### Risk Rationale

This crosses domain policy, application use cases, public contracts, SQLite
migration, ranking order, trust, and durable documentation authority. The
behavior is bounded and locally testable, but closure requires migration and
installed-runtime evidence.

## Readiness Decision

- **Ready to implement:** implemented; T001-T009 are complete
- **Ready for promotion:** yes, durable owners are updated
- **Ready for release:** no
- **Ready for closure:** yes according to the lifecycle checker; closure has not
  been performed or authorized

## Related Artifacts

- Requirements: `requirements.md`
- Change Impact: `change-impact.md`
- Design: `design.md`
- Tasks: `tasks.md`
