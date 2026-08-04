---
title: Git submodule repository support verification
doc_type: spec
artifact_type: verification
status: draft
owner: platform
last_reviewed: 2026-08-04
---

# Verification

## Scope

This record covers future T001-T014 implementation and proof. Test-owned local
Git fixtures may construct submodule states, but the behavior under test is
read-only. Nothing authorizes target command execution, remote access, or
submodule/Git mutation.

## Quality Gates

| Gate | Required | Status | Evidence target |
|------|----------|--------|-----------------|
| G1 Contract and shared bounded runner | yes | pending | T001 contracts, bounds, cancellation, environment, redaction, compatibility |
| G2 Fixed Git metadata adapter | yes | pending | T002 exact argv, parsing, overflow, failure, prohibited-operation spies |
| G3 Composition state, authority, recursion, limits | yes | pending | T003-T005 truth tables, properties, fixtures, checkpoint |
| G4 Workspace policy and catalog federation | yes | pending | T006/T007 declared/unrelated/read/write/confinement/regression tests |
| G5 Storage migration and composition freshness | yes | pending | T008 schema, round-trip, prefix, old-snapshot, refresh tests |
| G6 Repository-local Spec 057 planning | yes | pending | T009 selection, aggregation, blocking, no-execution tests |
| G7 Cross-surface public provenance | yes | pending | T010 graph/docs/context/status/MCP contract and payload tests |
| G8 Independent implementation review | yes | pending | T011 resolved findings and reruns |
| G9 Full repository/package regression | yes | pending | T012 complete command record |
| G10 Durable promotion | yes | pending | T013 explicit Markdown validation and docs tests |
| G11 Closure reconciliation | yes | pending | T014 lifecycle coverage/evidence/closure checks |

## Validation Commands

Exact new test paths may be refined during implementation. All commands run in
Agent Workbench; no command is executed inside an external target repository.

| Command | Purpose | Result |
|---------|---------|--------|
| `pnpm exec vitest run tests/workspace/file-catalog-scanner.test.ts tests/workspace/git-history.test.ts` | Preserve current scanner/Git-history behavior while adding the shared bounded seam. | pending |
| `pnpm exec vitest run tests/application/validation-planner-rules.test.ts tests/mcp/verification-plan-tool.test.ts` | Prove repository-local planning and MCP presentation. | pending |
| Focused repository-composition, command-adapter, storage, refresh, graph, docs, context, and contract tests introduced by T001-T010 | Prove every new state and boundary. | pending |
| `pnpm typecheck` | Validate contracts and layer integration. | pending |
| `pnpm test` | Run the full Vitest regression suite. | pending |
| `pnpm validate:plugin` | Validate packaged plugin/MCP declarations. | pending |
| `pnpm validate:skills` | Validate packaged skill guidance. | pending |
| `pnpm pack:dry-run` | Validate package contents without publishing. | pending |
| Agent Workbench bounded Markdown check over the explicit changed-document set | Validate frontmatter and Markdown quality. | pending |
| `git diff --check` | Detect whitespace errors. | pending |

## Requirement Coverage

| Requirement | Pending evidence | Residual risk |
|-------------|------------------|---------------|
| Requirement 1 | T003-T007/T010 declared-versus-unrelated and no-prompt read tests | Admission depends on correct Git evidence reconciliation. |
| Requirement 2 | T001-T005/T008/T010 inventory, state, revision, and malformed-path tests | Host Git behavior remains external. |
| Requirement 3 | T004/T005/T007 recursive bound, cycle, order, and lineage tests | Large real compositions need bounded dogfood after fixtures pass. |
| Requirement 4 | T001/T007-T010 repository identity, storage, claims, and presenter tests | Older clients may ignore additive repository detail. |
| Requirement 5 | T009/T010 Spec 057 selection, aggregation, blocked, and no-execution tests | T009 is gated on Spec 057 T001-T009 complete and verified. |
| Requirement 6 | T001/T002/T005/T011 process/network/write/hook spies | Cannot prove Git internals beyond controlled process behavior. |
| Requirement 7 | T002-T010 unavailable, orphan, declaration-only, mismatch, and broken-metadata tests | Repair remains user-operated and out of scope. |
| Requirement 8 | T003-T012 fixture matrix, regressions, review, and full suite | Fixtures cannot cover every platform-specific Git installation. |

## Required Fixture Matrix

| Fixture/state | Required assertions |
|---------------|---------------------|
| initialized pinned detached HEAD | read admitted; source/revision attributed; no branch failure |
| initialized dirty child and clean parent | independent cleanliness; aggregate not clean |
| uninitialized | pin/path retained; source unavailable; no init/network |
| worktree revision mismatch | local source retained; pinned-composition claim blocked |
| declaration without gitlink | distinct state; no traversal |
| orphan HEAD/index gitlink | distinct state; no traversal or inference |
| recursively nested initialized children | lineage and stable prefixed paths; no prompts |
| repeated/cyclic canonical root | structured cycle blocker; bounded termination |
| malformed/absolute/duplicate/symlink-escaping path | confinement blocker; no absolute-path disclosure |
| broken parent or child Git metadata | readable source retained where safe; dependent claims blocked |
| unrelated nested checkout | existing read skip and write refusal unchanged |
| mixed project units inside sibling submodules | repository-local Spec 057 candidates; no evidence borrowing |
| exact limit exhaustion | deterministic next skipped work and incomplete aggregate |

## Correctness Property Coverage

| Property | Proof |
|----------|-------|
| CP-001 | Admission truth table over declaration, gitlink, initialization, containment, and unrelated checkout. |
| CP-002 | Cross-surface identity assertions and longest-prefix storage/query properties. |
| CP-003 | Permuted evidence/filesystem ordering yields identical bounded receipts. |
| CP-004 | Escape, symlink, `.git` indirection, cycle, and malformed metadata fixtures. |
| CP-005 | Process/network/hook/write spies plus exact semantic Git operations. |
| CP-006 | Mixed clean/dirty/unknown/fresh/stale/blocked per-claim aggregation tests. |
| CP-007 | Adding or breaking an unrelated sibling leaves selected source/project results unchanged. |

## Agent Readiness Evidence

| Field | Evidence | Residual risk |
|-------|----------|---------------|
| Scope/out-of-scope | requirements, canonical context, design boundary table | Exact implementation filenames may change after T001 review. |
| Authority | selected parent authorizes declared initialized child reads; no per-child prompt | Writes, network, mutation, and unrelated repos remain blocked. |
| Implementation route | one semantic Git port, one hardened shared runner, composition use case, federated scanner | T001 must confirm the existing seam before coding. |
| Upstream dependency | Spec 057 T001-T009 complete and verified before T009 | Reuse the proven contract/planner/goldens; do not fork a second planner. |
| Review | security, architecture, storage migration, public contract, workspace safety | Required at T011 and before closure. |
| Durable impact | all targets in `change-impact.md` | Promotion follows implementation proof. |

## Task Evidence

| Task | Status | Evidence |
|------|--------|----------|
| T001 | pending | Contract and shared runner. |
| T002 | pending | Git metadata adapter. |
| T003 | pending | State reconciliation. |
| T004 | pending | Recursive discovery. |
| T005 | pending | Foundation checkpoint. |
| T006 | pending | Path-policy exception. |
| T007 | pending | Catalog federation. |
| T008 | pending | Storage/freshness. |
| T009 | pending | Spec 057 planning. |
| T010 | pending | Public provenance. |
| T011 | pending | Independent review. |
| T012 | pending | Full validation. |
| T013 | pending | Durable promotion. |
| T014 | pending | Closure reconciliation. |

## Evidence Log

| Date | Evidence | Result | Notes |
|------|----------|--------|-------|
| 2026-08-04 | Spec 058 authored from direct source, current workspace/validation authorities, Spec 057, and user authority decision | planning only | No source implementation, Git mutation, target command, or remote operation performed. |
| 2026-08-04 | Independent Spec 058 review | findings addressed | Made recursive traversal automatic and bounded, pinned T009 to Spec 057 T001-T009, added active-package supersession reconciliation, and refreshed readiness metadata. |
| 2026-08-04 | Independent focused re-review | passed | Prior recursion-contract, cross-spec dependency, and stale-readiness findings are resolved with no remaining issue text. |
| 2026-08-04 | Lifecycle lint and staged readiness | passed | Zero diagnostics or blocking/context/acceptance/requirement gaps; T001 is agent-ready and implementation-ready. |
| 2026-08-04 | Focused docs tests and `git diff --check` | passed | 2 test files and 10 tests passed; no whitespace errors. |

## Manual Or External Verification

After fixture-backed implementation proof, test read-only against real
repositories containing initialized, dirty, uninitialized, mismatched, and
nested submodules. Record the repository baseline and revision without exposing
URLs. Dogfood supplements fixtures and cannot replace exact acceptance tests.

## Residual Risks

- Git behavior and metadata layouts vary across versions/platforms; the adapter
  must fail closed when its bounded parse contract is not met.
- Composition receipts and per-hit provenance increase payload/storage size;
  caps and compact references need explicit tests.
- A local submodule worktree can be safe to read while not matching the pinned
  composition; presenters must keep those truths visibly separate.
- Spec 057 integration must reuse its one planner path and avoid a temporary
  root/sibling fallback.

## Durable Promotion And Cleanup

| Content | Destination | Status |
|---------|-------------|--------|
| Authority and safety | workspace safety contract and threat model | pending T013 |
| Public composition/claim contract | runtime contracts | pending T013 |
| Layer/port ownership | layered runtime architecture | pending T013 |
| Storage and freshness | graph-store design | pending T013 |
| Repository-local validation | edit/validation design | pending T013 |
| Backlog/spec residual reconciliation | backlog README | pending T013 |

### Spec Cleanup Decision

- **Cleanup action:** keep active
- **Reason:** Implementation has not started.
- **Final spec commit:** pending
- **Closure log path:** `docs/history/spec-closure-log.md`
- **Ready for implementation:** yes, subject to the final post-review lifecycle
  results recorded at handoff
- **Ready for promotion/release/closure:** no

## Ship Or Closure Risk

- **Risk level:** high
- **Breaking change:** no, subject to additive contract proof
- **Blast radius:** scanner policy, command runner, snapshots/storage, freshness,
  graph/docs/context/status presentation, validation planning, MCP payloads
- **Requires human review:** yes
- **Release notes needed:** decide at closure
- **Rollback:** remove the admitted composition receipt and additive public
  projection; do not retain a second runtime path as fallback

## Related Artifacts

- Requirements: `requirements.md`
- Canonical Context: `canonical-context.md`
- Design: `design.md`
- Change Impact: `change-impact.md`
- Tasks: `tasks.md`
- Traceability: `traceability.md`
