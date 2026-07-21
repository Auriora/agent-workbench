---
title: Reference completeness verification
doc_type: spec
artifact_type: verification
status: draft
owner: platform
last_reviewed: 2026-07-21
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Verification

## Scope

This record covers Requirement 1, Requirement 2, Requirement 3, Requirement 4,
CP-001, CP-002, CP-003, CP-004, CP-005, CP-006, CP-007, CP-008, CP-009,
CP-010, CP-011, and T001-T013 for truthful bounded reference completeness.
Phase 1 contract/reproduction, Phase 2 route/scanner/pagination/presentation,
and Phase 3 repository, package, and real installed-provider validation are
complete. Promotion, final review, and closure evidence remains pending.

## Completed Authoring Gates

| Gate | Status | Evidence |
| --- | --- | --- |
| Requirements and correctness properties reviewed | passed | Initial MoE disposition plus final authoring audit in `review-disposition.md` |
| Lifecycle package lint | passed | 2026-07-20 evidence log; zero errors/warnings |
| Bounded Markdown/link check | passed with readability advisories | 2026-07-20 evidence log; eight checked, zero skipped |
| Authoring expert findings disposed | passed | `review-disposition.md`; four blockers, sixteen additional findings, and five final-audit findings resolved |

These authoring results establish draft readiness only. They do not satisfy the
fresh post-implementation gates below.

## Quality Gates

The following are post-implementation gates and remain distinct from the
completed authoring checks above.

| Gate | Required? | Status | Evidence |
| --- | --- | --- | --- |
| Contract and reproduction tests characterize intended pre-fix seam | yes | passed for Phase 1 | V001; Phase 1 portions of V002 and V005 |
| Parser-route and file-atomic pagination properties pass | yes | passed for Phase 2 | V002, V005, V006, V008; no Phase 2 todos remain |
| Focused and full automated tests pass | yes | passed for Phase 3 | V001-V008; final V007 passed with 88 files and 884 tests |
| Plugin, skill, and package gates pass | yes | passed | V009-V010; six skills, 242 package entries, package convergence/query/cleanup receipt |
| Installed Codex and Claude plugin smokes pass | yes | passed | V011-V012; real Codex CLI `0.144.6` and Claude Code `2.1.216`, exact twelve-reference oracle, package/runtime/plugin `0.6.1`, and all nine cleanup checks |
| Fresh lifecycle package lint and Markdown/link checks pass | yes | pending | Must rerun after implementation evidence and task-state changes. |
| Durable documentation promoted | yes | pending | |
| Fresh implementation and promotion expert review findings disposed | yes | pending | T011/V015; authoring review is recorded separately above. |
| Promotion diff, closure, and archive gates pass | yes | pending | |

## Validation Commands

| ID | Command | Purpose | Result |
| --- | --- | --- | --- |
| V001 | `pnpm exec vitest run tests/contracts/runtime-contracts.test.ts tests/contracts/response-metadata.test.ts tests/contracts/reference-completeness.test.ts` | result, evidence-universe, accounting, cursor, and trust contracts | passed 2026-07-21: 3 files, 50 tests |
| V002 | `pnpm exec vitest run tests/graph/query-tools.test.ts tests/graph/reference-completeness.test.ts` | per-route limit probes; disjoint outgoing/incoming/unresolved ownership; fixed composite order and route transitions; file-atomic catalog pagination; all candidate and stop classes | passed 2026-07-21: 2 files, 35 tests |
| V003 | `pnpm exec vitest run tests/mcp/query-tools.test.ts tests/mcp/stdio-entrypoint.test.ts tests/mcp/reference-completeness.test.ts` | public MCP envelope, callable continuation, and exact page/sequence accounting | passed 2026-07-21: 3 files, 38 tests |
| V004 | `pnpm exec vitest run tests/mcp/trust-golden.test.ts` | complete versus partial trust presentation | passed 2026-07-21: 1 file, 16 tests |
| V005 | `pnpm exec vitest run tests/integration/reference-session-start.test.ts` | exact twelve-occurrence reproduction, missing row 101, same-line occurrence, and failed/policy-excluded candidate cases | passed 2026-07-21: 1 file, 7 tests |
| V006 | `pnpm exec vitest run tests/graph/reference-pagination.property.test.ts` | seeded concatenation/order properties; authenticated scan/result/composite cursor replay; tampered ordinal/counter/route/tag rejection; key-epoch restart expiry | passed 2026-07-21: 1 file, 22 tests |
| V007 | `pnpm typecheck && pnpm test` | TypeScript integration and full regression suite | passed 2026-07-21: typecheck; 88 files, 884 tests |
| V008 | `pnpm exec vitest run tests/graph/reference-query-budget.test.ts` | deterministic clock proves file-admission time, file, declared-byte, and result bounds; actual-byte observation; atomic time overrun; and failed-candidate progress/accounting | passed 2026-07-21: 1 file, 15 tests |
| V009 | `pnpm run validate:plugin && pnpm run validate:skills && pnpm run pack:dry-run` | packaged integration gates | passed 2026-07-21: plugin validation; six owned skills with zero findings; 242-entry `0.6.1` package |
| V010 | `CXXFLAGS=-std=c++20 node scripts/ci/installed-package-mcp-smoke.mjs` | pack/install `@auriora/agent-workbench@0.6.1`, verify installed bin and two provider-labelled sessions, then verify the structured cleanup receipt | passed 2026-07-21: fresh replacement snapshot, queries, and all cleanup checks; correctly records that no real agent CLI executed |
| V011 | `node scripts/ci/installed-provider-plugin-smoke.mjs --provider codex --expected-version 0.6.1` | isolated real Codex plugin install/discovery and reference call | passed 2026-07-21: Codex CLI `0.144.6`; direct app-server discovery/resource/tool protocol; exact twelve zero-based occurrences; package/runtime/plugin `0.6.1`; all nine cleanup checks |
| V012 | `node scripts/ci/installed-provider-plugin-smoke.mjs --provider claude --expected-version 0.6.1` | isolated real Claude plugin install/discovery and reference call | passed 2026-07-21 after host reauthentication: Claude Code `2.1.216`; bounded ToolSearch discovery; provider-qualified resource/tool correlation; exact twelve zero-based occurrences; package/runtime/plugin `0.6.1`; all nine cleanup checks |
| V013 | MCP `lint_spec_package(repo_root=".", spec_path="docs/specs/042-reference-completeness-and-bounded-scan-truthfulness")` | dedicated lifecycle structure and traceability lint | pending |
| V014 | MCP `check_markdown_set(paths=[all Spec 042 Markdown artifacts], required_frontmatter=["title","doc_type","status","owner","last_reviewed"])` | bounded Markdown structure and link validation | pending |
| V015 | MCP `review_packet` plus the repository-local `$review-work-products` MoE, scoped to Spec 042 and its implementation/promotion diff | architecture/contracts, QA/trust, and lifecycle evidence review | pending |
| V016 | `git diff --check && git diff -- docs/design/mcp-surface-design.md docs/design/graph-store-design.md docs/design/language-adapter-design.md docs/reference/runtime-contracts.md docs/reference/mvp-proof-matrix.md docs/reference/agent-readable-changelog.md docs/backlog/README.md` | whitespace safety and explicit promotion-diff review | pending |
| V017 | MCP `closure_check(repo_root=".", spec_path="docs/specs/042-reference-completeness-and-bounded-scan-truthfulness")` | dedicated closure gate | pending |
| V018 | MCP `archive_index(repo_root=".")` after closure metadata and package disposition | closure-log/archive-index consistency | pending |

## Installed Provider Smoke Contract

T009 must make V011 and V012 self-contained and isolated. Each command packs
the checkout, installs the tarball under a temporary HOME/client state root,
uses the named real CLI to register and load its provider-specific plugin, and
then calls Agent Workbench status plus the SessionStart reference fixture. It
must assert:

- npm identity `@auriora/agent-workbench` and expected version `0.6.1`;
- provider plugin manifest and version, MCP launcher, SessionStart hook, and
  bundled `agent-workbench` skill originate under the isolated installed path;
- runtime and provider-plugin identities both report `0.6.1`;
- the reference query is complete or its callable continuation concatenates to
  the expected ordered occurrences; and
- the provider process is closed, daemon/socket and metadata are removed, the
  plugin is unregistered, and all isolated install/state/temp roots are removed.

The smoke emits a structured receipt naming `real_agent_cli_executed: true`,
provider, expected/observed versions, checked artifact classes, reference
outcome, and every cleanup boolean. An unavailable CLI, mismatched version,
missing artifact, incomplete query, or false cleanup boolean fails the gate.
V010 remains useful package evidence but cannot substitute for V011 or V012.
V010-V012 have passed using the package smoke and both named real provider
CLIs, respectively.

## Requirement Coverage

| Requirement | Acceptance criteria covered | Evidence | Residual risk |
| --- | --- | --- | --- |
| Requirement 1 | AC1.1, AC1.2, AC1.3, AC1.4, AC1.5, AC1.6, AC1.7, AC1.8 | V001-V012; pending final V013-V015 | route/scanner and installed-provider behavior are implemented; final review remains |
| Requirement 2 | AC2.1, AC2.2, AC2.3, AC2.4, AC2.5, AC2.6, AC2.7, AC2.8 | V001-V003, V005-V012 | authenticated pagination, accounting, and installed-package behavior are implemented; final review remains |
| Requirement 3 | AC3.1, AC3.2, AC3.3, AC3.4, AC3.5, AC3.6, AC3.7 | V001, V003-V004, V006, V008-V012 | public accounting/trust and installed-package behavior are implemented; final review remains |
| Requirement 4 | AC4.1, AC4.2, AC4.3, AC4.4, AC4.5, AC4.6, AC4.7, AC4.8, AC4.9 | V002-V012; pending V013-V015 | healthy/degraded and both real installed-provider paths are proven; final review remains |

## Agent Readiness Evidence

| Field | Evidence | Residual risk |
| --- | --- | --- |
| Scope | `find_references`, catalog pagination, graph contracts, presenter, focused tests, durable docs | none |
| Excluded work | no shell/LSP/parser fallback, no unbounded scan, no daemon or impact redesign | none |
| Permissions | repository source/docs/tests only; no external writes or deployment | none |
| Validation | V001-V012 passed; V013-V018 pending | both required real provider CLIs were available and passed; final lifecycle gates remain |
| Review | architecture/contracts, QA/trust, and lifecycle/evidence review required | pending |
| Closure impact | durable promotion and EB053 closure required | pending |

## Task Evidence

| Task ID | Status | Evidence | Notes |
| --- | --- | --- | --- |
| T001 | complete | V001: 3 files/49 tests passed; typecheck and focused daemon launch passed | canonical contracts and daemon-scoped authenticated cursor lifetime |
| T002 | complete | V002 Phase 1: 2 files/30 tests/5 todos; V005: 3 tests/5 todos | named boundary fixtures and passing false-complete characterization; todos belong to T003-T005 |
| T003 | complete | V002: 2 files/35 tests; storage dedupe regression | limit-plus-one parser routes and composite continuation |
| T004 | complete | V002, V005, V008 | file-atomic scanner, classification, read-policy, and budget behavior |
| T005 | complete | V006: 1 file/22 tests | authenticated scan/result/composite cursor and replay properties |
| T006 | complete | V003: 3 files/38 tests; V006 mixed sequence | exact accounting and public presentation |
| T007 | complete | V003; V004: 1 file/16 tests | complete/partial/blocked/stale/invalid trust and callable actions |
| T008 | complete | Phase 3 V001-V006/V008 rerun: 50, 35, 38, 16, 7, 22, and 15 tests | focused validation, including exact query-budget proof |
| T009 | complete | 37 focused tests; V011-V012 real-provider passes | direct Codex app-server and Claude stream-json installed-provider harness |
| T010 | complete | V007 and V009-V012 passed | repository, package, and both real-provider gates passed |
| T011 | pending | none | lifecycle lint and expert review |
| T012 | pending | none | promotion and diff review |
| T013 | pending | none | closure and archive gates |

## Evidence Log

| Date | Stage | Evidence | Outcome |
| --- | --- | --- | --- |
| 2026-07-20 | intake | runtime `0.6.0` returned nine lexical occurrences while direct repository search found twelve | defect reproduced and routed to EB053 |
| 2026-07-20 | authoring | source review confirmed two 100-row catalog caps, result-offset cursor, line-level lexical collapse, and response-derived language scope | requirements and design expanded before implementation |
| 2026-07-20 | review reconciliation | Spec 042 MoE disposition resolved four blockers and sixteen additional findings in the package design and plan | authoring evidence only; implementation remains pending |
| 2026-07-20 | authoring validation | lifecycle package lint: zero errors/warnings; bounded Markdown set: eight checked, zero skipped, 136 table-readability warnings only, not truncated; scoped `git diff --check`: pass | initial revised draft was structurally valid; final audit followed |
| 2026-07-20 | final authoring audit | authenticated cursor lifecycle, failed-candidate progress, composite parser routing, actual-byte semantics, and staged review evidence were reconciled | authoring evidence only; fresh post-implementation review remains required |
| 2026-07-20 | final authoring validation | lifecycle lint: zero errors/warnings/info; task audit: zero errors/warnings and nineteen advisory infos; Markdown set: eight checked, zero skipped, 154 table-readability warnings only, not truncated; whitespace scan: pass | revised draft is structurally valid; implementation gates remain pending |
| 2026-07-21 | Phase 1 T001 | V001 contract schemas and authenticated cursor codec; focused daemon composition checks; `pnpm typecheck` | V001 passed with three files and 49 tests; daemon test and typecheck passed; T001 complete |
| 2026-07-21 | Phase 1 T002 | Compact SessionStart fixture, row-101 virtual catalog, boundary manifest, V002/V005 characterization | 9 early plus 3 late occurrences and same-line collapse reproduced; candidate configurations locked; T002 complete with Phase 2 behavior explicitly todo |
| 2026-07-21 | Phase 1 checkpoint | `pnpm typecheck`; full `pnpm test`; lifecycle package lint; targeted daemon entrypoint rerun | typecheck passed; 84 files/786 tests passed with 10 Phase 2 todos; lifecycle lint zero diagnostics; daemon entrypoint 15/15 passed |
| 2026-07-21 | Phase 2 implementation | authenticated parser/lexical pagination, storage-side filtering/deduplication, file-atomic scan budgets, exact accounting, public presentation, and trust calibration | V001-V006 and V008 passed; no Phase 2 todo tests remain |
| 2026-07-21 | Phase 2 MoE remediation | architecture, requirements/QA, and security/operations review; fifteen deduplicated findings reconciled in `review-disposition.md` | stat/read failure isolation, classification deadlines, live read policy, replay failure, duplicate identities, cursor bounds, validity, recovery, and missing proof cases resolved |
| 2026-07-21 | Phase 2 checkpoint | `pnpm typecheck`; full `pnpm test`; lifecycle package lint; task-state audit; `git diff --check` | typecheck passed; 87 files/848 tests passed; lifecycle lint zero diagnostics; task audit zero errors/warnings with eight advisory infos on future broad tasks; whitespace scan passed |
| 2026-07-21 | Phase 3 T008 | Fresh execution of V001-V006 and V008 from the committed Phase 2 baseline | all seven gates passed with 50, 35, 38, 16, 7, 22, and 15 tests; V008 proves monotonic file-admission timing, file/declared-byte/result limits, actual-byte observation, and classified-failure progress without fallback |
| 2026-07-21 | Phase 3 T009 | installed-provider harness, independent review remediation, Codex app-server protocol correction, and 37 focused tests | direct raw Codex MCP responses replace model-mediated evidence; exact oracle, discovery, correlation, cleanup, and credential boundaries pass |
| 2026-07-21 | Phase 3 V007/V009-V011 | full typecheck/tests, package gates, package convergence smoke, and real Codex installed-provider smoke | 88 files/884 tests; six skills; 242 package entries; package and Codex receipts passed with complete cleanup |
| 2026-07-21 | Phase 3 V012 | isolated Claude Code `2.1.216` install/discovery after host reauthentication | bounded discovery and provider-qualified correlation returned the exact twelve-reference oracle with package/runtime/plugin `0.6.1`; all nine cleanup checks passed |
| 2026-07-21 | Phase 3 checkpoint | V007 and V009-V012 plus final 37-test provider-harness rerun, typecheck, syntax, and whitespace checks | T008-T010 complete; repository, package, and real Codex/Claude installed-provider evidence passed |
| pending | Phase 4 delivery | V013-V018 | durable promotion, final review, and closure remain pending |

## Residual Risks

- Result replay may duplicate or skip hits if an atomic file identity or
  occurrence ordinal is not bound correctly; seeded properties and named
  boundary tests are required.
- Complete scans may increase IO; per-page file and byte budgets must remain
  enforced and observable.
- Existing callers may interpret `result_count` as total; additive basis fields
  and compatibility tests must prevent silent semantic drift.
- A whole-file read can cross the time admission deadline because the current
  port is not cancellable; the receipt must expose that atomic overrun and no
  later file may be admitted.

## Durable Promotion And Cleanup

| Spec content | Durable destination | Status | Evidence |
| --- | --- | --- | --- |
| reference completeness and continuation | MCP surface design | pending | |
| count, coverage, and trust contracts | runtime contracts | pending | |
| catalog pagination role | graph store design | pending | |
| lexical occurrence semantics | language adapter design | pending | |
| bounded reference proof | MVP proof matrix | pending | |
| delivered defect and user-visible change | EB053; agent-readable changelog | pending | |

## Ship Or Closure Risk

- **Risk level:** high
- **Breaking change:** additive contract/cursor semantics with compatibility risk
- **Blast radius checked:** no
- **Rollback path:** retain current graph-first route; do not retain false-complete lexical behavior
- **Requires human review:** yes
- **Release notes needed:** yes
- **Follow-up issue or spec needed:** no known follow-up

## Readiness Decision

- **Ready to implement:** Phase 3 is complete; Phase 4 review, promotion, and
  closure remains next.
- **Ready for promotion:** no
- **Ready for release:** no
- **Ready for closure:** no

## Related Artifacts

- Requirements: `requirements.md`
- Change impact: `change-impact.md`
- Design: `design.md`
- Tasks: `tasks.md`
- Traceability: `traceability.md`
- Review disposition: `review-disposition.md`
