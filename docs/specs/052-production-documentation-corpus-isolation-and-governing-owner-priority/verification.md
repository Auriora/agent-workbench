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
| Requirements/design/task trace reviewed | yes | pending | independent review after creation |
| Corpus policy and parity tests pass | yes | pending | T003-T004 |
| Contract/store/readiness tests pass | yes | pending | T005 |
| Ranking/migration/cursor tests pass | yes | pending | T006-T007 |
| Typecheck and full suite pass | yes | pending | T008 |
| Plugin/package validation passes | yes | pending | T008 |
| Bounded dogfood and direct count inspection pass | yes | pending | T008 |
| Durable documentation promoted | yes | pending | T009 |
| Final multi-discipline review addressed | yes | pending | T009 |
| Closure check and cleanup decision recorded | yes | pending | T009 |

## Validation Commands

| Command | Purpose | Result | Evidence |
| --- | --- | --- | --- |
| lifecycle package lint/review tools | structural and trace readiness | pending | T001 |
| `pnpm typecheck` | TypeScript contract/integration correctness | pending | T008 |
| focused `pnpm vitest run` slices for changed docs/store/ranking tests | rapid requirement regressions | pending | T003-T007 |
| `pnpm test -- --maxWorkers=4` | full bounded regression suite | pending | T008 |
| `pnpm validate:plugin` | packaged MCP surface consistency | pending | T008 |
| `pnpm validate:skills` | packaged skill consistency if touched by promotion | pending | T008 or not applicable |
| `pnpm pack:dry-run` | packaged artifact completeness | pending | T008 |
| `git diff --check` | whitespace/patch integrity | pending | every phase |

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
| Requirement 1 | AC1-AC6 | pending G3 | broader fixture forms remain evidence-gated |
| Requirement 2 | AC1-AC6 | pending G4 | refresh required for pre-policy snapshot |
| Requirement 3 | AC1-AC6 | pending G5 | exact concern scope only |
| Requirement 4 | AC1-AC4 | pending G6 | transient universes intentionally invalidated |
| Requirement 5 | AC1-AC4 | pending G3-G8 | installed acceptance pending |
| Requirement 6 | AC1-AC3 | pending G9-G10 | closure blocked until promotion |

## Correctness Property Coverage

| Property | Covered by | Evidence | Residual risk |
| --- | --- | --- | --- |
| CP-001 | T003, T004, T007; G3 | pending | broader conventions gated |
| CP-002 | T003, T004; G3 | pending | none expected |
| CP-003 | T004, T005, T007; G4 | pending | none expected |
| CP-004 | T006, T007; G5 | pending | exact concern only |
| CP-005 | T006, T007; G5-G6 | pending | none expected |
| CP-006 | T005, T007; G4-G6 | pending | refresh operational delay |
| CP-007 | T003, T004, T006, T007; G3-G5 | pending | additive owner state |

## Scope Reconciliation Before Closure

| Broad requirement, design target, or review finding | Implemented in this spec | Coverage state | Deferred or rejected work | Destination | Blocks closure? | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| Requirement 1 through Requirement 5 implementation | none yet | not-covered | none | none | yes | pending T003-T008 |
| Requirement 6 durable promotion | none yet | not-covered | none | none | yes | pending T009 |
| ranked-universe capacity/eviction | none | out-of-scope | explicit policy decision | EB059 | no | requirements/design boundary |
| validation-plan payload compaction | none | out-of-scope | independent repair | EB065 | no | requirements/design boundary |

## Agent Readiness Evidence

| Field | Evidence | Residual risk |
| --- | --- | --- |
| Scope and out-of-scope files | requirements, design, change impact | exact affected test list confirmed in T002 |
| Must-read context | canonical context and all package artifacts | source may drift before implementation |
| Permissions and approval points | source/docs/tests only; no external writes | migration reviewed before implementation |
| Validation commands and expected signals | G1-G10 and command table | focused command list finalized in T002 |
| Review needs | architecture, contract, SQLite migration, docs authority, final implementation | reviewer availability |
| Durable-doc or closure impact | change-impact promotion map | all pending |
| Repo-evidence provider caveats | Workbench routes reads; direct tests/store inspection prove behavior | snapshot freshness must be recorded |

## Task Evidence

| Task ID | Status | Evidence | Notes |
| --- | --- | --- | --- |
| T001 | pending | none | creation is not readiness proof |
| T002 | pending | none | contract/migration seam |
| T003 | pending | none | corpus policy |
| T004 | pending | none | two admission surfaces |
| T005 | pending | none | storage/readiness/counts |
| T006 | pending | none | ranking/version |
| T007 | pending | none | cross-surface regressions |
| T008 | pending | none | full validation/dogfood |
| T009 | pending | none | promotion/review/closure |

## Evidence Log

| Date | Evidence | Result | Notes |
| --- | --- | --- | --- |
| 2026-08-02 | Spec creation plan and direct source/backlog inspection | planned | confirms Spec 052 scope; not implementation proof |

## Manual Or External Verification

None yet. Installed-runtime dogfood is required in G8; record exact runtime,
plugin, snapshot, repository state, commands/calls, and limits.

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
| requirements and accepted behavior | runtime requirements; backlog | pending | T009 |
| corpus and owner-ranking design | documentation map; MCP surface design | pending | T009 |
| storage/migration behavior | graph-store design | pending | T009 |
| public contracts | runtime contracts | pending | T009 |
| proof and dogfood | MVP proof matrix; dogfood ledger | pending | T009 |
| agent-visible change | agent-readable changelog | pending | T009 |
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
- **Blast radius checked:** no
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

- **Ready to implement:** no, pending T001 review and T002 seam confirmation
- **Ready for promotion:** no
- **Ready for release:** no
- **Ready for closure:** no

## Related Artifacts

- Requirements: `requirements.md`
- Change Impact: `change-impact.md`
- Design: `design.md`
- Tasks: `tasks.md`
