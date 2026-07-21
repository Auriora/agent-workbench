---
title: Authority-aware documentation ranking verification
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

This record covers Requirements 1-4 and every criterion explicitly enumerated
in the Requirement Coverage table, plus CP-001-CP-008, SC-001-SC-004, and
T001-T010. Spec review findings are addressed in the package design. Phase 1
contract, fixture, Phase 2 snapshot-ownership, and Phase 3 ranking/frozen-
pagination, public presentation, production wiring, and final repository
validation, exact installed-package, and durable promotion evidence is
complete; only closure evidence remains pending.

## Quality Gates

| Gate | Required | Status | Evidence owner |
|---|---|---|---|
| contract/fixture review | yes | passed for Phase 1 | T001-T002, V001-V005 |
| schema/index/publication proof | yes | passed for Phase 2 | T003, V006 |
| architecture boundary proof | yes | passed through final T007 rerun | T004-T007, V007 |
| property and 499/500/501 budget proof | yes | passed at final T007 rerun | T005, T007, V005, V008 |
| typecheck and full regression | yes | passed at final T007 rerun | T007, V009 |
| plugin, skill, and package gates | yes | passed at final T007 rerun | T007, V010 |
| exact installed-package smoke | yes | passed | T008, V011 |
| lifecycle package lint | yes | passed | T009, V012 |
| bounded Markdown/link check | yes | passed with advisory readability warnings | T009, V013 |
| durable promotion review | yes | passed | T009, V014 |
| architecture/code expert review | yes | passed after remediation | T009, V015 |
| docs/lifecycle expert review | yes | passed after remediation | T009, V016 |
| closure check | yes | passed: ready, 0 blockers, lint 0/0/0 | T010, V017 |
| closure-log/archive reconciliation | yes | pending | T010, V018 |
| final close/archive phase gate | yes | pending | T010, V019 |

## Validation Commands

| ID | Command or tool | Purpose | Result |
| --- | --- | --- | --- |
| V001 | `pnpm exec vitest run tests/contracts/docs-ranking-contracts.test.ts` | concern/rank/cursor/count/trust contracts, legacy aggregate score, and lexical-score consumers | passed: 12 contract tests |
| V002 | `pnpm exec vitest run tests/docs/documentation-concern-routing.test.ts` | normalization, exact phrase/token, SessionStart, multi/no-match/tie behavior, and matched-owner admission | passed: 14 tests |
| V003 | `pnpm exec vitest run tests/docs/docs-ranking-policy.test.ts` | relevance bands including `intent_owner_match`, exhaustive owner tiers/caveats, tuple/reasons, and both score semantics | passed: 12 tests |
| V004 | `pnpm exec vitest run tests/presentation/docs-ranking-presenter.test.ts tests/mcp/docs-ranking-tool.test.ts tests/mcp/docs-surfaces.test.ts` | public order, candidate/page counts and filter bases, aliases, blockers, trust, redaction, and production server wiring | passed: 40 tests |
| V005 | `pnpm exec vitest run tests/docs/docs-ranking-pagination.test.ts tests/graph/docs-ranked-universe-store.test.ts` | seeded property tests and persisted-universe proofs for FTS/owner union, total order, cursor binding, page equivalence, duplicates, snippets, and 0/499/500/501 | passed: 33 tests |
| V006 | `pnpm exec vitest run tests/graph/documentation-map-indexing.test.ts tests/graph/documentation-owner-publication.test.ts tests/graph/store.test.ts` | v2-to-v3 schema/store migration, current-snapshot rebuild, incompatible-old-snapshot handling, one-to-many extraction, and atomic publication | passed: 50 tests |
| V007 | `pnpm exec vitest run tests/architecture/layer-boundaries.test.ts` | SQLite/application/domain/presentation/adapter boundaries | passed: 6 tests |
| V008 | `pnpm exec vitest run tests/docs/docs-ranking-pagination.test.ts --testNamePattern='candidate budget'` | deterministic 499/500/501 distinct-union budget gate, including independently bounded FTS and owner-query sentinels plus owner-only union overflow | passed at T007: 6 selected tests; 18 skipped by the required pattern |
| V009 | `pnpm typecheck && pnpm test` | TypeScript and full regression suite | passed at T007: typecheck; 97 files, 994 tests |
| V010 | `pnpm run validate:plugin && pnpm run validate:skills && pnpm run pack:dry-run` | integration/package contents | passed at T007: plugin/package validation; 6 owned skills with 0 errors and 0 warnings; npm dry-run produced the 0.6.1 package with 245 entries |
| V011 | `node scripts/ci/installed-package-mcp-smoke.mjs` | exact packed/installed artifact and dual-provider candidate-union/ranking/count smoke | passed after review remediation: allowlisted environment; exact 0.6.1 tarball SHA-256 `69c1104562fe3603367df85648e6456c1bde776c1cfe1c61b40ce5bca4b84523`; installed-content SHA-256 `c5e2f36ff0f02b19af3e757184c5c161e18e4bcb052ada60b5cfc25a29d691b0`; exact legacy/lexical scores, 5/5 searchable/scope counts, 5/5/0 priority counts, coverage/filter/alias receipts, ranking/cursor/provider checks, and all cleanup booleans passed. Injected `post-launch-pre-health` failure returned categorized failure with all cleanup booleans true |
| V012 | MCP `lint_spec_package(repo_root=".", spec_path="docs/specs/043-authority-aware-documentation-intent-ranking-and-count-semantics")` | dedicated lifecycle structure/traceability lint | passed: 0 errors, 0 warnings, 0 information diagnostics |
| V013 | MCP `check_markdown_set(paths=[all Spec 043 artifacts and promoted durable docs], required_frontmatter=["title","doc_type","status","owner","last_reviewed"])` | bounded Markdown structure, table, and link gate | passed: 11 documents checked, 0 skipped, required frontmatter present, no structural or missing-file error; advisory table-readability warnings and the existing directory-link warning for present `docs/adr/` remain |
| V014 | MCP `promotion_plan(repo_root=".", spec_path="docs/specs/043-authority-aware-documentation-intent-ranking-and-count-semantics")` plus diff review | prove every lasting contract has a durable owner and was promoted | passed: no missing targets; current contracts promoted to documentation map, graph store design, MCP surface design, and runtime contracts; T010 owns EB054/changelog/closure/archive records |
| V015 | MCP `review_packet(..., review_type="implementation_review")` followed by architecture/code expert disposition | pure-policy and layering review against implementation/tests | passed after remediation: exact score/count/coverage smoke assertions verified; domain/application/SQLite/presentation/MCP boundaries remain correct; 66 focused tests and script syntax/diff checks passed |
| V016 | MCP `review_packet(..., review_type="documentation_governance")` followed by docs/lifecycle expert disposition | authority, status, promotion, evidence, and lifecycle review | passed after remediation: allowlisted smoke environment, non-vacuous injected-failure cleanup, full digests, delivered-state prose, promotion evidence, and EB059 boundary are consistent; no blocker remains |
| V017 | MCP `closure_check(repo_root=".", spec_path="docs/specs/043-authority-aware-documentation-intent-ranking-and-count-semantics")` | dedicated closure blockers | passed: `ready: true`, 0 blockers, requirement coverage `covered` for all four requirements, lint 0 errors/0 warnings/0 information diagnostics |
| V018 | MCP `archive_index(repo_root=".")` after truthful closure metadata | closure log/archive index consistency | pending |
| V019 | MCP `phase_gate_check` for close, then archive | separate final lifecycle decisions; lint/tests are not substitutes | pending |

## Property And Boundary Test Contract

`tests/docs/docs-ranking-policy.test.ts` runs ranking insertion seeds
`1, 7, 19, 41, 73`. `tests/docs/docs-ranking-pagination.test.ts` runs
candidate-union deduplication seeds `1, 7, 19, 41, 73`, complete-boundary seed
`23` for distinct unions `0, 499, 500`, and total-order/page-equivalence seeds
`3, 17, 29` with page sizes `1, 7, 50`. The tests generate FTS-only,
owner-only, and overlapping-source candidate documents
with colliding relevance/owner/authority/currency/lexical components, varied
insertion order, page sizes, and cursor positions. For each complete universe it
asserts:

- tuple order is total and stable;
- each stable document ID occurs exactly once;
- concatenated pages equal a single page over the same frozen universe;
- changing any cursor identity component is rejected;
- missing/expired frozen state does not restart search;
- stable-ID source deduplication precedes the cap;
- 499 and 500 distinct candidates complete, while distinct row 501 blocks with
  zero hits/cursor.

The boundary fixture records complete `0`, `499`, and `500` universes plus FTS
source row 501, owner-only distinct-union row 501, and matched-owner source row
501. Separate 501 fixtures include a valid mapped owner at FTS row 501 and an
owner-only document that becomes union row 501. They prove neither retrieval
source can hide an owner below the supported cap and still claim results.

## Installed-Package Smoke Contract

V011 is the exact installed-artifact gate. The script must:

1. create isolated temp pack, install, home/state/cache/runtime, and workspace
   roots;
2. pack the current checkout to a real tarball and record tarball and package
   content hashes;
3. install that tarball into the isolated prefix without `NODE_PATH` or checkout
   overrides and prove the resolved binary realpath is inside the install;
4. launch Codex- and Claude-labelled MCP sessions against that installed bin;
5. build the SessionStart fixture and prove FTS-plus-owner admission, expected
   owner-first order, preserved legacy aggregate score, new lexical score,
   tuple/reasons, exact candidate/page count/filter receipt, and page
   concatenation under one snapshot/universe/policy identity;
6. emit one machine-readable `installed-package-mcp-smoke OK` JSON receipt with
   hashes, package version/root, binary realpath, provider identities, snapshot,
   frozen universe and policy IDs, stable hit paths, counts, and assertions;
7. in `finally`, close both clients, stop the daemon, remove socket/metadata and
   every temp root, and include boolean cleanup evidence. Failure output must be
   safely categorized and cleanup still runs.

The provider labels prove installed MCP behavior for both profiles; they do not
claim that real Codex or Claude CLIs loaded the plugin.

## Requirement Coverage

| Requirement | Acceptance criteria | Planned evidence | Current residual |
| --- | --- | --- | --- |
| Requirement 1 | AC1.1, AC1.2, AC1.3, AC1.4, AC1.5, AC1.6, AC1.7, AC1.8, AC1.9 | V001-V005, V007-V016 | implementation, installed proof, durable promotion, and expert review delivered |
| Requirement 2 | AC2.1, AC2.2, AC2.3, AC2.4, AC2.5, AC2.6 | V001-V004, V006-V016 | snapshot ownership, exhaustive owner presentation, promotion, and expert review delivered |
| Requirement 3 | AC3.1, AC3.2, AC3.3, AC3.4, AC3.5, AC3.6 | V001, V004-V005, V008-V016 | frozen-universe, installed-artifact, promotion, and expert review delivered |
| Requirement 4 | AC4.1, AC4.2, AC4.3, AC4.4, AC4.5, AC4.6, AC4.7, AC4.8 | V001, V003-V005, V007-V016 | count/compatibility contracts, strengthened V011 assertions, promotion, and expert review delivered |

## Review Disposition

### Blockers

| ID | Finding | Resolution in this revision | Delivery proof |
| --- | --- | --- | --- |
| B1 | query-to-concern behavior was unspecified | fixed NFKC normalization, exact phrase/token rules, multi/no-match/ties, evidence, SessionStart examples, and admission of every repository-present exact matched owner | R1; Exact Resolver; Candidate Boundary; T001-T005; V001-V005 |
| B2 | pagination could continue from an incomplete universe | fixed persisted complete universe; 501 blocks with zero hits/cursor | R3; Complete Frozen Pagination; T005; V005/V008 |
| B3 | design misstated intake retrieval/ranking ownership | the pre-implementation baseline and delivered current ownership are now explicitly separated | Intake Baseline And Delivered Ownership; T003-T006; V007 |
| B4 | indexing task omitted integration/schema lifecycle | T003 now owns `index-repository-graph`, extraction, one-to-many schema, v2-to-v3 migration, current-snapshot rebuild, publication and tests | T003; V006 |

### Additional Findings

| ID | Finding | Resolution in this revision | Delivery proof |
| --- | --- | --- | --- |
| A1 | count universes were ambiguous | exact snapshot/scope/FTS/owner/union/ranked/page and priority-scan field names | R4; Count And Filter Receipt; V001/V004 |
| A2 | filter bases were ambiguous | exact searchable/scope/query/page/priority fields and one-basis invariant | AC4.5; CP-006; V001/V004 |
| A3 | numeric score compatibility was undecided | legacy aggregate `score` keeps shipped meaning; `lexical_score` supplies the tuple's numeric lexical component | AC4.1, AC4.2; T001/T004/T006; V001/V003/V004 |
| A4 | no owner-below-cap proof | 501 fixtures cover both a valid owner at FTS row 501 and an owner-only union row 501 | T002; V005/V008 |
| A5 | no 499/500/501 boundary contract | explicit distinct-union success/success/block behavior | R3; T002/T005; V005/V008 |
| A6 | installed smoke command was not exact | V011 names the existing installed-package script exactly | T008; V011 |
| A7 | installed smoke artifacts/cleanup were vague | receipt fields, isolated paths, hashes, `finally` cleanup and assertions fixed | Installed-Package Smoke Contract; T008 |
| A8 | lifecycle lint was folded into generic validation | dedicated V012/T009 gate | V012 |
| A9 | Markdown/link checks were folded into generic validation | dedicated bounded V013/T009 gate | V013 |
| A10 | promotion was not independently gated | dedicated plan/diff V014/T009 gate | V014 |
| A11 | closure and archive reconciliation were combined | separate V017 closure, V018 archive consistency, V019 close/archive phase decisions | T010; V017-V019 |
| A12 | expert review was underspecified | separate architecture/code and docs/lifecycle packets/dispositions | T009; V015-V016 |
| A13 | implementation tasks crossed too many layers | ten tasks split contract, fixtures, indexing, pure policy, freeze, presentation/trust, validation, install, promotion/review, closure | tasks dependency graph |
| A14 | cursor/order/duplicate properties were examples only | seeded property contract varies tuples, insertion, pages, cursors and expiry | Property And Boundary Test Contract; V005 |
| A15 | intended tests were unstable placeholders | every implementation task and validation ID names stable test files | tasks and V001-V008 |
| A16 | readiness/review status was overstated during authoring | every phase now advances only after its named implementation, installation, promotion, review, or closure evidence | Readiness Decision; Task Evidence |

All four blockers and sixteen additional findings are addressed in the planned
contracts. “Addressed” here means the spec is revised; it is not implementation
or closure evidence.

### Final Audit Follow-Up

| ID | Finding | Resolution in this revision | Delivery proof |
| --- | --- | --- | --- |
| F1 | mapped owners absent from FTS could disappear before ranking | exact matched-owner documents now join FTS rows before stable-ID deduplication and the distinct cap; `intent_owner_match` defines their relevance | AC1.9, AC3.1, AC3.2, AC3.3; Candidate Boundary; T002-T005; V002-V005/V008 |
| F2 | lexical-only `score` contradicted the shipped aggregate field | legacy aggregate `score` is preserved and deprecated; new optional FTS-only `lexical_score` supplies the tuple component and is absent for owner-only hits | AC4.1, AC4.2, AC4.8; Deterministic Final Tuple; T001/T004/T006; V001/V003/V004 |
| F3 | returned-page count lacked a named filter basis | `page_filter_basis: frozen_universe_position_and_requested_page_size` is mandatory | AC4.5; Count And Filter Receipt; T001/T006; V001/V004 |
| F4 | owner states did not map exhaustively to tiers/caveats | every state has an explicit persisted classification in T003 and an explicit tier/caveat rule owned by T004/T006 | AC2.6; Concern Ownership Index; T004/T006; V002-V004 |

### Phase 4 Independent Review

| ID | Finding | Resolution in this revision | Delivery proof |
| --- | --- | --- | --- |
| P4-1 | public ranked route still used legacy ordering/provider and lacked production cursor wiring | one `searchRankedDocs` provider, order-preserving presenter, authenticated daemon-shared ranked cursor, and one-GraphStore production path | V004, V007; architecture re-review ready |
| P4-2 | snippets and snapshot-unavailable failures broke public compatibility/trust | bounded snippets stay frozen and project per page; valid requests without a selected snapshot return a typed snapshot-less blocker | AC3.6, AC4.8; V001, V004-V005 |
| P4-3 | compatibility and coverage receipts were optional or ambiguously redacted | success/overflow require aliases and coverage; canonical/alias note equality and one sanitized presentation value are enforced | V001, V004 |
| P4-4 | owner states, draft labels, one-to-many evidence, and bounded caveats lacked public proof | exhaustive state matrix, draft status/caveat, multi-owner/multi-concern, and ten archived-owner compression tests pass | V004; QA re-review ready |
| P4-5 | ranked path, coverage, query identity, and recovery actions had field-specific redaction/trust gaps | defensive path redaction, recursive safe action arguments, stale freshness, callable recovery, validated debug path, and query-free aggregate telemetry | V004; operations re-review ready |
| P4-6 | repository-wide live-universe capacity and detailed observability had no normative policy | explicitly excluded from T006 and routed to EB059 with cap, eviction, cursor-staleness, concurrency, and metrics acceptance | requirements non-goal; design operational boundary; EB059 |

### Phase 5 Expert Review

| ID | Finding | Resolution in this revision | Delivery proof |
| --- | --- | --- | --- |
| P5-1 | installed smoke inherited uncontrolled host state and could expose credentials | replaced inherited environment with a runtime/native-build allowlist and exact-value plus credential-shaped failure redaction | V011 normal and injected-failure receipts; V016 re-review |
| P5-2 | unknown daemon identity could pass cleanup vacuously | launch possibility is tracked before spawn; post-launch cleanup requires corroborated PID/socket/metadata ownership and an injected pre-health failure proves cleanup | V011 injected failure; V016 re-review |
| P5-3 | installed smoke asserted score presence rather than compatibility values and omitted count/coverage universes | added fixed fixture-specific legacy/lexical score assertions plus exact searchable/scope/priority/count/filter/coverage/alias assertions | V011; V015 re-review ready |
| P5-4 | spec prose mixed intake baseline and delivered state and retained stale pending evidence | labeled intake history explicitly and reconciled scope, requirement residuals, task evidence, promotion, and readiness statements | V015-V016 re-review |

## Task Evidence

| Task | Status | Evidence | Notes |
| --- | --- | --- | --- |
| T001 | complete | V001: 11 contract tests; runtime-contract regression: 17 tests; typecheck | additive contracts and candidate-query ports locked; independent-review source/band and bounded-result findings corrected |
| T002 | complete | 15 ordinary fixture/oracle tests and 9 expected-failure proofs; combined Phase 1 suite: 43 ordinary plus 9 expected failures | 13-document fixture, exact concern/rank oracles, source-backed 0/499/500/501 boundaries, frozen-page/cursor/expiry red proofs |
| T003 | complete | V002: 11 tests; V006: 50 tests; V007: 6 tests; production-path integration: 51 tests; V009 checkpoint: typecheck and 94-file full suite | v3 migration-before-publication, bounded exact extraction, snapshot-scoped concern/term/owner state, startup/debug wiring, and independent review findings resolved |
| T004 | complete | V002: 14 tests; V003: 12 tests; V007: 6 tests; typecheck; 95-file/966-test full suite; independent review | pure exact resolver and authority-aware ranker, exhaustive tuple/source/owner semantics, legacy-score compatibility, and ordinal Unicode-safe identity ordering |
| T005 | complete | V001: 11 tests; V005: 31 tests; V006: 50 tests; V007: 6 tests; V008: 6 selected tests; typecheck; 95-file/966-test full suite; independent review | complete concern evidence, bounded FTS/owner union, immutable SQLite universes, frozen continuation, literal scope, canonical expiry, and cardinality/identity rejection |
| T006 | complete | V001: 12; V004: 40; V005: 33; V006: 50; V007: 6; typecheck; full suite 994; three-role independent review ready | single ranked public route, daemon-shared authenticated cursor, frozen snippet projection, mandatory receipts/aliases, structured failures/recovery, complete redaction/trust, aggregate telemetry, and production/debug wiring |
| T007 | complete | V001-V010: focused suites 12/14/12/40/33/50/6; V008 6 selected/18 skipped; typecheck; full suite 97 files/994 tests; plugin/skill/package gates | final deterministic seeds and 0/499/500/501 runs recorded above |
| T008 | complete | V011 packed/installed 0.6.1 receipt with tarball/content hashes, installed realpath, snapshot/universe/policy identities, three stable ranked paths, exact counts, dual provider labels, and all cleanup booleans true | isolated provider-labelled sessions prove the installed MCP package, not real CLI plugin loading |
| T009 | complete | V012: 0 lifecycle diagnostics; V013: 11 documents with 0 structural/frontmatter/missing-file errors; V014: 0 missing promotion targets; V015: 66 focused tests and architecture boundaries passed; V016: no blocker after environment, cleanup, digest, and lifecycle remediation | four durable owners contain current contracts; EB059 remains a separately governed residual |
| T010 | complete | V017: ready, 0 blockers, four covered requirements, lint 0/0/0; EB054 status and four-part changelog entry reconciled | V018-V019 and commit identities are produced by guarded closure/archive actions |

## Evidence Log

| Date | Stage | Evidence | Outcome |
|---|---|---|---|
| 2026-07-20 | intake | runtime `0.6.0` ranked `docs/runbooks/install-agent-workbench.md` first with score 256 while the governing design was absent from page one, and reported unnamed 100-document searchable versus 40-file priority universes | exact reproduction routed to EB054 |
| 2026-07-20 | authoring | source review located the bounded FTS retrieval in the SQLite graph store, query delegation in `query-docs`, additive authority scoring, the absent owner candidate route, and distinct merged/priority counters | design separated current implementation from the target FTS-plus-owner union and named count bases |
| 2026-07-20 | expert-review revision | the review inventory recorded 4 blockers and 16 additional findings; `traceability.md` maps CP-001-CP-008, T001-T010, and V001-V019 to every disposition | package lint reported 0 errors and 0 warnings after those mappings were added |
| 2026-07-20 | final audit reconciliation | `design.md` and `verification.md` record FTS-plus-owner admission, fixed legacy/lexical score values, per-count filter bases, exhaustive owner-state mapping, and lifecycle criteria | package lint reported 0 diagnostics; the bounded seven-document Markdown check reported 0 structural or link errors |
| 2026-07-21 | Phase 1 contract preflight | T001 review found one scalar `query_filter_basis` could not represent distinct FTS/owner/union bases and owner-source overflow lacked a lower bound | revised AC3.3/AC4.5 and design to use a strict per-count basis object plus exact-or-literal-501 source/union receipts |
| 2026-07-21 | Phase 1 fixture preflight | T002 review found multiple owners could not define `conflicting`, stable document identity was unspecified, and all-token relevance did not state token filtering | fixed conflict derivation to contradictory owner frontmatter, stable ID to normalized repo-relative POSIX path, and all-token matching to every normalized token without stopword/minimum-length filtering |
| 2026-07-21 | Phase 1 implementation | T001-T002 delivered additive runtime contracts and ports plus a 13-document fixture, ranking/count oracles, and executable red proofs; focused suite passed 43 ordinary tests plus 9 expected failures | independent review found and verified corrections for the complete source/band matrix, non-empty reasons, exact-or-overflow port invariants, scenario-specific 501 source identities, frozen-page equivalence, cursor identity, and expiry |
| 2026-07-21 | Phase 2 snapshot ownership | T003 delivered graph identity/schema v3; atomic v2 clone, migration, validation, and publication; bounded exact map/owner extraction; explicit complete/no-map/invalid snapshot state; one-to-many rows; startup/debug wiring; V002 11 tests, V006 50 tests, V007 6 tests, production integration 51 tests, typecheck, full suite 933 passed plus 8 expected failures | independent review blockers and additional findings resolved: no premature v3 publication, no masked safety denial, invalid provenance retained, non-complete rows refused, byte bounds rechecked, CommonMark angle destinations accepted, row limits bounded, and T003 traceability narrowed truthfully |
| 2026-07-21 | Phase 3 ranking and frozen pagination | T004-T005 delivered pure exact concern resolution, complete authority-aware tuple ranking, separately bounded 501-row candidate sources, stable-ID union, immutable SQLite universes, and stored-state-only continuation; V001 11 tests, V002 14, V003 12, V005 31, V006 50, V007 6, V008 6 selected, typecheck, and full suite 95 files/966 tests | independent review found and verified repairs for legacy-score sign, universe cardinality, canonical expiry, complete concern relations, literal SQL scope, ordinal Unicode ordering, cursor identity breadth, executable 0/499/500/501 gates, and production comparator coverage |
| 2026-07-21 | Phase 4 presentation and trust | T006 delivered the single ranked MCP route, immutable ordered presentation, daemon-shared authenticated cursor, snapshot-less selection blocker, mandatory canonical/compatibility receipts, frozen snippet projection, exhaustive owner/caveat proof, consistent redaction, recovery actions, validated debug behavior, and aggregate query-free telemetry; V001 12, V004 40, V005 33, V006 50, V007 6, typecheck, full suite 994 | architecture, QA, and security/operations re-reviews all returned ready; repository-wide universe population/eviction and remaining detailed metrics routed to EB059 |
| 2026-07-21 | final validation and installed-artifact acceptance | V001-V010 passed focused suites 12/14/12/40/33/50/6, 6 selected budget tests, typecheck, 97 files/994 tests, plugin/skill gates, and a 245-entry pack dry-run; V011 installed packed 0.6.1 in an allowlisted environment and asserted fixed scores, every count/coverage/alias basis, and cross-provider cursor behavior | tarball SHA-256 `69c1104562fe3603367df85648e6456c1bde776c1cfe1c61b40ce5bca4b84523`, installed-content SHA-256 `c5e2f36ff0f02b19af3e757184c5c161e18e4bcb052ada60b5cfc25a29d691b0`, and five true cleanup assertions on normal and injected-failure receipts |
| 2026-07-21 | durable promotion and expert review | V012 returned 0 diagnostics; V013 checked 11 documents with 0 structural/frontmatter/missing-file errors; V014 had 0 missing targets; V015 re-ran 66 tests; V016 returned 0 blockers | current contracts are present in `docs/reference/documentation-map.md`, graph store design, MCP surface design, and runtime contracts; EB059 names the separate capacity/observability scope |
| 2026-07-21 | closure readiness | V017 returned `ready: true`, 0 blockers, all 4 requirements covered, and lint 0/0/0 | V018 archive consistency and V019 close/archive decisions follow the guarded closure actions |

## Durable Promotion And Cleanup

| Spec content | Durable destination | Status | Evidence |
| --- | --- | --- | --- |
| exact concern terms and ownership | documentation map; graph store design | promoted | V014 |
| rank tuple, frozen pagination, failures | MCP surface design | promoted | V014 |
| score, count/filter, cursor, trust semantics | runtime contracts | promoted | V014 |
| delivered outcome | EB054; agent-readable changelog | pending | V014, V017 |
| closure/archive record | closure log; archive index | pending | V017-V019 |

## Residual Risks

- Explicit intent terms require governed documentation-map maintenance; missing
  terms truthfully yield no owner boost rather than inferred recovery.
- Each persisted ranked universe has at most 500 hits, immutable cardinality,
  canonical 15-minute expiry, and cleanup proof. EB059 owns the separate
  repository-wide live-population cap, deterministic eviction, cursor-staleness
  semantics, concurrency proof, and remaining detailed metrics.
- Blocking queries above 500 candidates favors correctness but requires clear
  narrowing guidance and production evidence that the bound is practical.
- Additive compatibility fields increase payload size until legacy aliases can
  be removed through a separately governed deprecation.
- Snapshot ownership, ranking, frozen pagination, presentation, public trust,
  exact installed-artifact behavior, and durable promotion are proved; V016
  final reconciliation and closure remain.

## Readiness Decision

- **Package structure:** valid; V012 returned zero diagnostics and V013 checked
  all 11 package/promotion documents with advisory readability warnings only.
- **Ready to implement:** yes; the post-revision authoring review found no
  remaining blocking requirement, design, or traceability gap.
- **Ready to validate implementation:** complete; T001-T008 and V001-V011 pass.
- **Ready for promotion:** complete; V014-V015 pass and V016 final
  reconciliation passed.
- **Ready for closure/archive:** T010 lifecycle checks and metadata remain.
- **Risk:** medium-high; schema, ranking, cursor, and public contract change.
- **Rollback boundary:** do not publish mixed schema/policy or partial overflow
  results; retain the current complete runtime until the new snapshot and
  contract pass V001-V011 together.

## Related Artifacts

- Requirements: `requirements.md`
- Design: `design.md`
- Tasks: `tasks.md`
- Traceability: `traceability.md`
