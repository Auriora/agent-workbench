---
title: Authority-aware documentation ranking verification
doc_type: spec
artifact_type: verification
status: draft
owner: platform
last_reviewed: 2026-07-20
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Verification

## Scope

This record covers Requirements 1-4 and every criterion explicitly enumerated
in the Requirement Coverage table, plus CP-001-CP-008, SC-001-SC-004, and
T001-T010. Spec review findings are addressed in the package design; all
implementation, promotion, release, and closure evidence remains pending.

## Quality Gates

| Gate | Required | Status | Evidence owner |
| --- | --- | --- | --- |
| contract/fixture review | yes | pending | T001-T002, V001-V005 |
| schema/index/publication proof | yes | pending | T003, V006 |
| architecture boundary proof | yes | pending | T004-T006, V007 |
| property and 499/500/501 budget proof | yes | pending | T005, V005, V008 |
| typecheck and full regression | yes | pending | T007, V009 |
| plugin, skill, and package gates | yes | pending | T007, V010 |
| exact installed-package smoke | yes | pending | T008, V011 |
| lifecycle package lint | yes | pending | T009, V012 |
| bounded Markdown/link check | yes | pending | T009, V013 |
| durable promotion review | yes | pending | T009, V014 |
| architecture/code expert review | yes | pending | T009, V015 |
| docs/lifecycle expert review | yes | pending | T009, V016 |
| closure check | yes | pending | T010, V017 |
| closure-log/archive reconciliation | yes | pending | T010, V018 |
| final close/archive phase gate | yes | pending | T010, V019 |

## Validation Commands

| ID | Command or tool | Purpose | Result |
| --- | --- | --- | --- |
| V001 | `pnpm exec vitest run tests/contracts/docs-ranking-contracts.test.ts` | concern/rank/cursor/count/trust contracts, legacy aggregate score, and lexical-score consumers | pending |
| V002 | `pnpm exec vitest run tests/docs/documentation-concern-routing.test.ts` | normalization, exact phrase/token, SessionStart, multi/no-match/tie behavior, and matched-owner admission | pending |
| V003 | `pnpm exec vitest run tests/docs/docs-ranking-policy.test.ts` | relevance bands including `intent_owner_match`, exhaustive owner tiers/caveats, tuple/reasons, and both score semantics | pending |
| V004 | `pnpm exec vitest run tests/presentation/docs-ranking-presenter.test.ts tests/mcp/docs-ranking-tool.test.ts` | public order, candidate/page counts and filter bases, aliases, blockers, trust | pending |
| V005 | `pnpm exec vitest run tests/docs/docs-ranking-pagination.test.ts` | seeded property tests for FTS/owner union, total order, cursor binding, page equivalence, duplicates, and 0/499/500/501 | pending |
| V006 | `pnpm exec vitest run tests/graph/documentation-map-indexing.test.ts tests/graph/documentation-owner-publication.test.ts tests/graph/docs-ranked-universe-store.test.ts` | schema, migration/backfill, one-to-many extraction, atomic publication, universe persistence | pending |
| V007 | `pnpm exec vitest run tests/architecture/layer-boundaries.test.ts` | SQLite/application/domain/presentation/adapter boundaries | pending |
| V008 | `pnpm exec vitest run tests/docs/docs-ranking-pagination.test.ts --testNamePattern='candidate budget'` | deterministic 499/500/501 distinct-union budget gate, including independently bounded FTS and owner-query sentinels plus owner-only union overflow | pending |
| V009 | `pnpm typecheck && pnpm test` | TypeScript and full regression suite | pending |
| V010 | `pnpm run validate:plugin && pnpm run validate:skills && pnpm run pack:dry-run` | integration/package contents | pending |
| V011 | `node scripts/ci/installed-package-mcp-smoke.mjs` | exact packed/installed artifact and dual-provider candidate-union/ranking/count smoke | pending |
| V012 | MCP `lint_spec_package(repo_root=".", spec_path="docs/specs/043-authority-aware-documentation-intent-ranking-and-count-semantics")` | dedicated lifecycle structure/traceability lint | pending |
| V013 | MCP `check_markdown_set(paths=[all Spec 043 artifacts and promoted durable docs], required_frontmatter=["title","doc_type","status","owner","last_reviewed"])` | bounded Markdown structure, table, and link gate | pending |
| V014 | MCP `promotion_plan(repo_root=".", spec_path="docs/specs/043-authority-aware-documentation-intent-ranking-and-count-semantics")` plus diff review | prove every lasting contract has a durable owner and was promoted | pending |
| V015 | MCP `review_packet(..., review_type="implementation_review")` followed by architecture/code expert disposition | pure-policy and layering review against implementation/tests | pending |
| V016 | MCP `review_packet(..., review_type="documentation_governance")` followed by docs/lifecycle expert disposition | authority, status, promotion, evidence, and lifecycle review | pending |
| V017 | MCP `closure_check(repo_root=".", spec_path="docs/specs/043-authority-aware-documentation-intent-ranking-and-count-semantics")` | dedicated closure blockers | pending |
| V018 | MCP `archive_index(repo_root=".")` after truthful closure metadata | closure log/archive index consistency | pending |
| V019 | MCP `phase_gate_check` for close, then archive | separate final lifecycle decisions; lint/tests are not substitutes | pending |

## Property And Boundary Test Contract

`tests/docs/docs-ranking-pagination.test.ts` uses recorded deterministic seeds
and generates FTS-only, owner-only, and overlapping-source candidate documents
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

Separate 501 fixtures include a valid mapped owner at FTS row 501 and an
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
| Requirement 1 | AC1.1, AC1.2, AC1.3, AC1.4, AC1.5, AC1.6, AC1.7, AC1.8, AC1.9 | V001-V005, V007-V016 | implementation absent |
| Requirement 2 | AC2.1, AC2.2, AC2.3, AC2.4, AC2.5, AC2.6 | V001-V004, V006-V016 | schema/index absent |
| Requirement 3 | AC3.1, AC3.2, AC3.3, AC3.4, AC3.5, AC3.6 | V001, V004-V005, V008-V016 | frozen universe absent |
| Requirement 4 | AC4.1, AC4.2, AC4.3, AC4.4, AC4.5, AC4.6, AC4.7, AC4.8 | V001, V003-V005, V007-V016 | contract/presentation absent |

## Review Disposition

### Blockers

| ID | Finding | Resolution in this revision | Delivery proof |
| --- | --- | --- | --- |
| B1 | query-to-concern behavior was unspecified | fixed NFKC normalization, exact phrase/token rules, multi/no-match/ties, evidence, SessionStart examples, and admission of every repository-present exact matched owner | R1; Exact Resolver; Candidate Boundary; T001-T005; V001-V005 |
| B2 | pagination could continue from an incomplete universe | fixed persisted complete universe; 501 blocks with zero hits/cursor | R3; Complete Frozen Pagination; T005; V005/V008 |
| B3 | design misstated current retrieval/ranking ownership | current SQLite FTS and query-docs delegation are explicit; pure policy is target state | Current And Intended Ownership; T003-T006; V007 |
| B4 | indexing task omitted integration/schema lifecycle | T003 now owns `index-repository-graph`, extraction, one-to-many schema, migration/backfill, publication and tests | T003; V006 |

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
| A16 | readiness/review status overstated | spec-design readiness is conditional below; all implementation/promotion/closure evidence remains pending | Readiness Decision; Task Evidence |

All four blockers and sixteen additional findings are addressed in the planned
contracts. “Addressed” here means the spec is revised; it is not implementation
or closure evidence.

### Final Audit Follow-Up

| ID | Finding | Resolution in this revision | Delivery proof |
| --- | --- | --- | --- |
| F1 | mapped owners absent from FTS could disappear before ranking | exact matched-owner documents now join FTS rows before stable-ID deduplication and the distinct cap; `intent_owner_match` defines their relevance | AC1.9, AC3.1, AC3.2, AC3.3; Candidate Boundary; T002-T005; V002-V005/V008 |
| F2 | lexical-only `score` contradicted the shipped aggregate field | legacy aggregate `score` is preserved and deprecated; new optional FTS-only `lexical_score` supplies the tuple component and is absent for owner-only hits | AC4.1, AC4.2, AC4.8; Deterministic Final Tuple; T001/T004/T006; V001/V003/V004 |
| F3 | returned-page count lacked a named filter basis | `page_filter_basis: frozen_universe_position_and_requested_page_size` is mandatory | AC4.5; Count And Filter Receipt; T001/T006; V001/V004 |
| F4 | owner states did not map exhaustively to tiers/caveats | every state now has an explicit tier and caveat/status rule | AC2.6; Concern Ownership Index; T003-T004/T006; V002-V004/V006 |

## Task Evidence

| Task | Status | Evidence | Notes |
| --- | --- | --- | --- |
| T001 | pending | none | contract implementation not started |
| T002 | pending | none | fixtures/tests not created |
| T003 | pending | none | schema/indexing not implemented |
| T004 | pending | none | pure policies not implemented |
| T005 | pending | none | frozen pagination not implemented |
| T006 | pending | none | presentation/trust not implemented |
| T007 | pending | none | implementation validation unavailable |
| T008 | pending | none | installed artifact not exercised for Spec 043 |
| T009 | pending | none | promotion/expert gates not run against implementation |
| T010 | pending | none | closure/archive not eligible |

## Evidence Log

| Date | Stage | Evidence | Outcome |
| --- | --- | --- | --- |
| 2026-07-20 | intake | runtime `0.6.0` ranked a draft supporting install guide above the expected governing design and exposed 100/40 counters with unnamed bases | defect routed to EB054 |
| 2026-07-20 | authoring | source review confirmed SQLite bounded FTS retrieval, query-docs delegation, additive authority scoring, missing docs-search owner signal, and distinct merged/priority count universes | current/target boundaries corrected |
| 2026-07-20 | expert-review revision | four blockers and sixteen additional findings converted to fixed contracts, tasks, traceability, and gates | authoring findings resolved |
| 2026-07-20 | final audit reconciliation | repaired FTS-plus-owner admission, legacy/lexical score compatibility, page filter basis, exhaustive owner-state mapping, and lifecycle traceability columns/criteria | lifecycle lint: zero diagnostics; bounded seven-document Markdown check: table-readability warnings only |
| pending | implementation | V001-V011 | no implementation evidence yet |
| pending | promotion/closure | V012-V019 | no durable promotion or closure evidence yet |

## Durable Promotion And Cleanup

| Spec content | Durable destination | Status | Evidence |
| --- | --- | --- | --- |
| exact concern terms and ownership | documentation map; graph store design | pending | V014 |
| rank tuple, frozen pagination, failures | MCP surface design | pending | V014 |
| score, count/filter, cursor, trust semantics | runtime contracts | pending | V014 |
| delivered outcome | EB054; agent-readable changelog | pending | V014, V017 |
| closure/archive record | closure log; archive index | pending | V017-V019 |

## Residual Risks

- Explicit intent terms require governed documentation-map maintenance; missing
  terms truthfully yield no owner boost rather than inferred recovery.
- Persisted ranked universes add bounded snapshot storage and expiry behavior
  that require concurrency and cleanup proof.
- Blocking queries above 500 candidates favors correctness but requires clear
  narrowing guidance and production evidence that the bound is practical.
- Additive compatibility fields increase payload size until legacy aliases can
  be removed through a separately governed deprecation.
- The fixed contracts remain unproved until T001-T010 and V001-V019 complete.

## Readiness Decision

- **Package structure:** valid; post-revision lifecycle lint returned zero
  diagnostics. V012 and V013 remain final post-implementation lifecycle and
  promoted-document gates.
- **Ready to implement:** yes; the post-revision authoring review found no
  remaining blocking requirement, design, or traceability gap.
- **Ready to validate implementation:** no; T001-T006 are pending.
- **Ready for promotion/release/closure/archive:** no.
- **Risk:** medium-high; schema, ranking, cursor, and public contract change.
- **Rollback boundary:** do not publish mixed schema/policy or partial overflow
  results; retain the current complete runtime until the new snapshot and
  contract pass V001-V011 together.

## Related Artifacts

- Requirements: `requirements.md`
- Design: `design.md`
- Tasks: `tasks.md`
- Traceability: `traceability.md`
