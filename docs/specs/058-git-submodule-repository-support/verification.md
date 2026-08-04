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

This record covers T001-T014 implementation and proof. Test-owned local
Git fixtures may construct submodule states, but the behavior under test is
read-only. Nothing authorizes target command execution, remote access, or
submodule/Git mutation.

## Quality Gates

| Gate | Required | Status | Evidence target |
|------|----------|--------|-----------------|
| G1 Contract and shared bounded runner | yes | passed | T001 contracts, independent byte caps, cancellation, fixed environment, redaction, compatibility |
| G2 Fixed Git metadata adapter | yes | passed | T002 exact argv, parsing, overflow, failure, index-immutability and helper/hook probes |
| G3 Composition state, authority, recursion, limits | yes | passed | T003-T005 truth tables, properties, fixtures, checkpoint |
| G4 Workspace policy and catalog federation | yes | passed | T006/T007 declared/unrelated/read/write/confinement/regression tests |
| G5 Storage migration and composition freshness | yes | passed | T008 schema, round-trip, prefix, old-snapshot, refresh tests |
| G6 Repository-local Spec 057 planning | yes | passed | T009 selection, mixed-repository blocking, no-execution tests |
| G7 Cross-surface public provenance | yes | passed | T010 graph/docs/context/status/MCP contract and real-scanner tests |
| G8 Independent implementation review | yes | passed | T011 correctness and security findings resolved and re-reviewed |
| G9 Full repository/package regression | yes | passed | T012: 119 files / 1,312 tests plus package gates |
| G10 Durable promotion | yes | passed | T013 explicit Markdown validation and docs tests |
| G11 Closure reconciliation | yes | passed | T014 lifecycle coverage/evidence/closure checks |

## Validation Commands

Exact new test paths may be refined during implementation. All commands run in
Agent Workbench; no command is executed inside an external target repository.

| Command | Purpose | Result |
|---------|---------|--------|
| `pnpm exec vitest run tests/workspace/file-catalog-scanner.test.ts tests/workspace/git-history.test.ts` | Preserve current scanner/Git-history behavior while adding the shared bounded seam. | passed within focused and full suites |
| `pnpm exec vitest run tests/application/validation-planner-rules.test.ts tests/mcp/verification-plan-tool.test.ts` | Prove repository-local planning and MCP presentation. | passed; verification-plan suite 54 tests after mixed-repository coverage |
| Focused repository-composition, command-adapter, storage, refresh, graph, docs, context, and contract tests introduced by T001-T010 | Prove every new state and boundary. | passed; combined checkpoint 16 files / 329 tests before review remediation, all remediation suites passed |
| `pnpm typecheck` | Validate contracts and layer integration. | passed |
| `pnpm exec vitest run --maxWorkers=4` | Run the full Vitest regression suite. | passed; 119 files / 1,312 tests |
| `pnpm validate:plugin` | Validate packaged plugin/MCP declarations. | passed |
| `pnpm validate:skills` | Validate packaged skill guidance. | passed; 6 skills, 0 errors, 0 warnings |
| `pnpm pack:dry-run` | Validate package contents without publishing. | passed for 0.6.7 |
| Agent Workbench bounded Markdown check over the explicit changed-document set | Validate frontmatter and Markdown quality. | passed with pre-existing table-readability advisories only |
| `git diff --check` | Detect whitespace errors. | passed |

## Requirement Coverage

| Requirement | Pending evidence | Residual risk |
|-------------|------------------|---------------|
| Requirement 1 | delivered: declaration/gitlink admission, unrelated refusal, federated real-scanner tests | Admission depends on correct Git evidence reconciliation. |
| Requirement 2 | delivered: bounded inventory, state, revision, malformed-path and public-summary tests | Host Git behavior remains external. |
| Requirement 3 | delivered: recursive bounds, cycle, order, lineage, sibling preservation | Large real compositions remain bounded by configured limits. |
| Requirement 4 | delivered: storage, independent claims, per-hit provenance, degraded freshness | Older clients may ignore additive repository detail. |
| Requirement 5 | delivered: Spec 057 repository-local selection, mixed-repository blocking, no execution | Explicit aggregators remain future evidence-driven work. |
| Requirement 6 | delivered: fixed local operations, hardened environment, index/helper/hook probes | Cannot prove Git internals beyond controlled process behavior. |
| Requirement 7 | delivered: unavailable, orphan, declaration-only, mismatch, broken metadata | Repair remains user-operated and out of scope. |
| Requirement 8 | delivered: fixture matrix, compatibility regressions, independent review, full suite | Fixtures cannot cover every platform-specific Git installation. |

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
| T001 | complete | Additive contracts and one independently bounded command runner. |
| T002 | complete | Fixed local Git metadata adapter with hardened config/environment. |
| T003 | complete | Declaration/gitlink reconciliation and explicit states. |
| T004 | complete | Recursive discovery, lineage, limits, and cycle guards. |
| T005 | complete | Foundation checkpoint passed. |
| T006 | complete | Evidence-aware read exception; writes/unrelated repos refused. |
| T007 | complete | Federated child-local scanning and shared bounds. |
| T008 | complete | Normalized storage, migration, prefix lookup, freshness classifier. |
| T009 | complete | Repository-local Spec 057 planning and cross-repository blocking. |
| T010 | complete | Composition summaries and per-hit public provenance. |
| T011 | complete | Correctness/security findings resolved and re-reviewed. |
| T012 | complete | Full repository and packaging gates passed. |
| T013 | complete | Durable contracts, designs, threat model, and backlog state promoted and validated. |
| T014 | complete | Requirement/property coverage, promotion, evidence, risks, and closure state reconciled. |

## Evidence Log

| Date | Evidence | Result | Notes |
|------|----------|--------|-------|
| 2026-08-04 | Spec 058 authored from direct source, current workspace/validation authorities, Spec 057, and user authority decision | planning only | No source implementation, Git mutation, target command, or remote operation performed. |
| 2026-08-04 | Independent Spec 058 review | findings addressed | Made recursive traversal automatic and bounded, pinned T009 to Spec 057 T001-T009, added active-package supersession reconciliation, and refreshed readiness metadata. |
| 2026-08-04 | Independent focused re-review | passed | Prior recursion-contract, cross-spec dependency, and stale-readiness findings are resolved with no remaining issue text. |
| 2026-08-04 | Lifecycle lint and staged readiness | passed | Zero diagnostics or blocking/context/acceptance/requirement gaps; T001 is agent-ready and implementation-ready. |
| 2026-08-04 | Focused docs tests and `git diff --check` | passed | 2 test files and 10 tests passed; no whitespace errors. |
| 2026-08-04 | Downstream review after Spec 057 closure | passed | The later requirements edit only replaced predecessor package references with promoted durable owners and the closure record; design, tasks, traceability, and verification obligations remain unchanged. |
| 2026-08-04 | T001-T010 implementation checkpoints | passed | Composition, command, scanner, storage, planning, graph, status, docs, context, and per-hit provenance tests passed with typecheck. |
| 2026-08-04 | Independent correctness and security reviews | passed after remediation | Threaded composition through all named scan surfaces, surfaced degraded freshness, replaced `git status`, hardened Git configuration, and added real-repository non-mutation/helper probes. |
| 2026-08-04 | Full T012 validation | passed | Typecheck; 119 test files / 1,312 tests; plugin, 6-skill, and package dry-run gates all passed. |
| 2026-08-04 | T013 durable promotion | passed | Seven canonical documents updated; 2 docs test files / 37 tests passed, bounded Markdown checks found no blocking issue, and `git diff --check` passed. |
| 2026-08-04 | T014 closure reconciliation | passed | `lint_spec_package` reported 0 diagnostics; `stage_readiness` reported 0 gaps; `task_state_audit` reported 0 findings; `closure_check` returned `ready=true` with 0 blockers and complete coverage for all eight must-have requirements. |

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
| Authority and safety | workspace safety contract and threat model | promoted |
| Public composition/claim contract | runtime contracts | promoted |
| Layer/port ownership | layered runtime architecture | promoted |
| Storage and freshness | graph-store design | promoted |
| Repository-local validation | edit/validation design | promoted |
| Backlog/spec residual reconciliation | backlog README | promoted |

### Spec Cleanup Decision

- **Cleanup action:** remove after recording the final spec commit
- **Reason:** Implementation, validation, durable promotion, and closure reconciliation are complete.
- **Final spec commit:** pending
- **Closure log path:** `docs/history/spec-closure-log.md`
- **Ready for implementation:** complete
- **Ready for promotion/release/closure:** yes

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
