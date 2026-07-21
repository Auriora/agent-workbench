---
title: Authority-aware documentation ranking traceability
doc_type: spec
artifact_type: traceability
status: draft
owner: platform
last_reviewed: 2026-07-21
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Traceability

## Requirement To Delivery Matrix

| Requirement | Priority | Acceptance Criteria | Design Sections | Tasks | Verification | Durable Targets | Coverage State | Residual Destination |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Requirement 1 | must-have | AC1.1, AC1.2, AC1.3, AC1.4, AC1.5, AC1.6, AC1.7, AC1.8, AC1.9 | Concern Ownership Index; Ranking Model; Candidate Boundary | T001-T010 | V001-V019 | MCP surface design; documentation map | covered | EB059 owns only repository-wide universe capacity/observability |
| Requirement 2 | must-have | AC2.1, AC2.2, AC2.3, AC2.4, AC2.5, AC2.6 | Concern Ownership Index; Schema, Migration, And Publication; Failure And Trust Behavior | T001-T004, T006-T010 | V001-V004, V006-V019 | graph store design; documentation map | covered | none |
| Requirement 3 | must-have | AC3.1, AC3.2, AC3.3, AC3.4, AC3.5, AC3.6 | Complete Frozen Pagination; Failure And Trust Behavior | T001-T002, T005-T010 | V001, V004-V005, V008-V019 | MCP surface design; runtime contracts | covered | EB059 owns capacity-eviction cursor semantics only |
| Requirement 4 | must-have | AC4.1, AC4.2, AC4.3, AC4.4, AC4.5, AC4.6, AC4.7, AC4.8 | Deterministic Final Tuple; Count And Filter Receipt | T001-T002, T004-T010 | V001, V003-V019 | runtime contracts; graph store design | covered | none |

## Correctness Property Mapping

| Property | Design section | Tasks | Verification |
| --- | --- | --- | --- |
| CP-001 relevance before authority | Relevance Bands; Deterministic Final Tuple | T001-T002, T004, T007-T010 | V001-V003, V007-V019 |
| CP-002 status independence | Deterministic Final Tuple; Failure And Trust Behavior | T001-T004, T006-T010 | V001-V004, V007-V019 |
| CP-003 exact multi-concern resolver | Normalization; Exact Resolver | T001-T004, T007-T010 | V001-V004, V007-V019 |
| CP-004 complete bounded freeze | Candidate Boundary; Frozen Universe Repository | T001-T002, T005, T007-T010 | V001, V004-V005, V008-V019 |
| CP-005 stable duplicate-free pages | Frozen Universe Repository | T001-T002, T005, T007-T010 | V001, V005, V008-V019 |
| CP-006 named count/filter basis | Count And Filter Receipt | T001-T002, T006-T010 | V001, V004-V005, V007-V019 |
| CP-007 legacy aggregate and lexical-score separation | Deterministic Final Tuple | T001-T002, T004, T006-T010 | V001, V003-V005, V007-V019 |
| CP-008 invalid owners never promote | Concern Ownership Index; Failure And Trust Behavior | T001-T004, T006-T010 | V001-V004, V007-V019 |

## Task To Context Matrix

| Task ID | Requirements | Acceptance Criteria | Design Sections | Change Impact | Verification | Durable Targets | Open Decisions |
| --- | --- | --- | --- | --- | --- | --- | --- |
| T001 | Requirement 1, Requirement 2, Requirement 3, Requirement 4 | AC1.1, AC1.9, AC2.1, AC2.6, AC3.1, AC3.6, AC4.1, AC4.8 | Contract Boundary; Count And Filter Receipt | public and internal contracts | V001 | runtime contracts | none |
| T002 | Requirement 1, Requirement 2, Requirement 3, Requirement 4 | AC1.1, AC1.9, AC2.1, AC2.6, AC3.1, AC3.6, AC4.1, AC4.8 | Validation Strategy | fixture-backed behavior | V002, V003, V005, V008 | EB054 | none |
| T003 | Requirement 1, Requirement 2 | AC1.1, AC2.1, AC2.4, AC2.5 | Concern Ownership Index; Schema, Migration, And Publication | graph schema and publication | V002, V006 | graph store design; documentation map | none |
| T004 | Requirement 1, Requirement 2, Requirement 4 | AC1.2, AC1.9, AC2.1, AC2.6, AC4.1, AC4.8 | Exact Resolver; Ranking Model | pure resolution and ranking | V002, V003 | MCP surface design | none |
| T005 | Requirement 1, Requirement 3, Requirement 4 | AC1.9, AC3.1, AC3.2, AC3.3, AC3.4, AC3.5, AC3.6, AC4.3, AC4.5 | Candidate Boundary; Frozen Universe Repository | query orchestration and persistence | V004, V005, V008 | MCP surface design; runtime contracts | none |
| T006 | Requirement 2, Requirement 3, Requirement 4 | AC2.1, AC2.6, AC3.6, AC4.1, AC4.2, AC4.3, AC4.4, AC4.5, AC4.6, AC4.7, AC4.8 | Count And Filter Receipt; Failure And Trust Behavior | presentation, production wiring, and public envelope | V001, V004, V006 | runtime contracts | EB059 owns aggregate live-universe capacity and remaining operational metrics |
| T007 | Requirement 1, Requirement 2, Requirement 3, Requirement 4 | all mapped criteria | Validation Strategy | focused and full validation | V001, V002, V003, V004, V005, V006, V007, V008, V009, V010 | verification record | none |
| T008 | Requirement 1, Requirement 2, Requirement 3, Requirement 4 | all mapped criteria | Operational Considerations | installed package | V011 | release evidence | none |
| T009 | Requirement 1, Requirement 2, Requirement 3, Requirement 4 | all mapped criteria | Durable Promotion Targets | promotion and review | V012, V013, V014, V015, V016 | durable design/reference targets | none |
| T010 | Requirement 1, Requirement 2, Requirement 3, Requirement 4 | all mapped criteria | Durable Promotion Targets | closure and archive | V017, V018, V019 | EB054; changelog; closure log; archive index | none |

## Extended Task Evidence Matrix

| Task ID | Design Sections | Requirements | Verification | Durable Targets |
| --- | --- | --- | --- | --- |
| T001 | public/internal contracts | Requirement 1, Requirement 2, Requirement 3, Requirement 4 | `tests/contracts/docs-ranking-contracts.test.ts`; AC1.1, AC1.2, AC1.3, AC1.4, AC1.5, AC1.6, AC1.7, AC1.8, AC1.9, AC2.1, AC2.2, AC2.3, AC2.4, AC2.5, AC2.6, AC3.1, AC3.2, AC3.3, AC3.4, AC3.5, AC3.6, AC4.1, AC4.2, AC4.3, AC4.4, AC4.5, AC4.6, AC4.7, AC4.8; CP-001-CP-008 | runtime contracts |
| T002 | fixtures and failing proofs | Requirements 1, 2, 3, 4; AC1.1, AC1.2, AC1.3, AC1.4, AC1.5, AC1.6, AC1.7, AC1.8, AC1.9, AC2.1, AC2.2, AC2.3, AC2.4, AC2.5, AC2.6, AC3.1, AC3.2, AC3.3, AC3.4, AC3.5, AC3.6, AC4.1, AC4.2, AC4.3, AC4.4, AC4.5, AC4.6, AC4.7, AC4.8; CP-001-CP-008 | `tests/fixtures/fixture-docs-authority-ranking/`; concern-routing, ranking-policy, and ranking-pagination test files named in T002 | EB054 |
| T003 | extraction/schema/index/publication | Requirements 1, 2; AC1.1, AC2.1, AC2.4, AC2.5; CP-002 | `tests/graph/documentation-map-indexing.test.ts`; `tests/graph/documentation-owner-publication.test.ts`; `tests/graph/store.test.ts` | graph store design; documentation map |
| T004 | pure resolution/ranking | Requirements 1, 2, 4; AC1.2, AC1.3, AC1.4, AC1.5, AC1.6, AC1.7, AC1.8, AC1.9, AC2.1, AC2.2, AC2.3, AC2.4, AC2.6, AC4.1, AC4.2, AC4.8; CP-001, CP-002, CP-003, CP-007, CP-008 | `tests/docs/documentation-concern-routing.test.ts`; `tests/docs/docs-ranking-policy.test.ts` | MCP surface design |
| T005 | frozen universe/pagination | Requirements 1, 3, 4; AC1.9, AC3.1, AC3.2, AC3.3, AC3.4, AC3.5, AC3.6, AC4.3, AC4.5; CP-004, CP-005 | `tests/docs/docs-ranking-pagination.test.ts`; `tests/graph/docs-ranked-universe-store.test.ts` | MCP surface design; runtime contracts |
| T006 | presentation/counts/trust | Requirements 2, 3, 4; AC2.1, AC2.2, AC2.3, AC2.4, AC2.6, AC3.6, AC4.1, AC4.2, AC4.3, AC4.4, AC4.5, AC4.6, AC4.7, AC4.8; CP-002, CP-004, CP-006, CP-007, CP-008 | `tests/presentation/docs-ranking-presenter.test.ts`; `tests/mcp/docs-ranking-tool.test.ts`; `tests/mcp/docs-surfaces.test.ts`; `tests/docs/docs-ranking-pagination.test.ts` | runtime contracts |
| T007 | focused/full/property/budget gates | Requirements 1, 2, 3, 4; AC1.1, AC1.2, AC1.3, AC1.4, AC1.5, AC1.6, AC1.7, AC1.8, AC1.9, AC2.1, AC2.2, AC2.3, AC2.4, AC2.5, AC2.6, AC3.1, AC3.2, AC3.3, AC3.4, AC3.5, AC3.6, AC4.1, AC4.2, AC4.3, AC4.4, AC4.5, AC4.6, AC4.7, AC4.8; CP-001-CP-008 | `verification.md` V001-V010 | verification record |
| T008 | exact installed package | Requirements 1, 2, 3, 4; AC1.1, AC1.2, AC1.3, AC1.4, AC1.5, AC1.6, AC1.7, AC1.8, AC1.9, AC2.1, AC2.2, AC2.3, AC2.4, AC2.5, AC2.6, AC3.1, AC3.2, AC3.3, AC3.4, AC3.5, AC3.6, AC4.1, AC4.2, AC4.3, AC4.4, AC4.5, AC4.6, AC4.7, AC4.8; SC-001-SC-004 | `scripts/ci/installed-package-mcp-smoke.mjs`; V011 receipt | release evidence |
| T009 | promotion/Markdown/expert review | Requirements 1, 2, 3, 4; AC1.1, AC1.2, AC1.3, AC1.4, AC1.5, AC1.6, AC1.7, AC1.8, AC1.9, AC2.1, AC2.2, AC2.3, AC2.4, AC2.5, AC2.6, AC3.1, AC3.2, AC3.3, AC3.4, AC3.5, AC3.6, AC4.1, AC4.2, AC4.3, AC4.4, AC4.5, AC4.6, AC4.7, AC4.8; SC-004 | V012-V016 and review disposition | all durable design/reference targets |
| T010 | closure/archive reconciliation | Requirements 1, 2, 3, 4; AC1.1, AC1.2, AC1.3, AC1.4, AC1.5, AC1.6, AC1.7, AC1.8, AC1.9, AC2.1, AC2.2, AC2.3, AC2.4, AC2.5, AC2.6, AC3.1, AC3.2, AC3.3, AC3.4, AC3.5, AC3.6, AC4.1, AC4.2, AC4.3, AC4.4, AC4.5, AC4.6, AC4.7, AC4.8; SC-004 | V017-V019 | EB054; changelog; closure log; archive index |

## Design To Implementation Matrix

| Design section | Planned implementation | Task | Verification |
| --- | --- | --- | --- |
| Documentation-Map Source Shape; Normalization | pure shared extraction plus snapshot rows | T003-T004 | V002, V006 |
| Exact Resolver | pure multi-concern resolver | T004 | V002-V003 |
| Relevance Bands; Deterministic Final Tuple | pure rank policy, legacy aggregate score preserved, new lexical score | T004 | V001, V003-V004 |
| Candidate Boundary | separately bounded 501-row FTS and same-snapshot owner queries, stable-ID union cap | T005 | V004-V005, V008 |
| Frozen Universe Repository | port plus SQLite snapshot-bound persistence | T005 | V005-V006, V008 |
| Count And Filter Receipt | contract/use-case/presenter mapping | T001, T006 | V001, V004-V005 |
| Schema, Migration, And Publication | `index-repository-graph` and graph store | T003 | V006 |
| Failure And Trust Behavior | query orchestration and presenter | T005-T006 | V004-V005, V011 |

## Review Finding Disposition

The full review disposition, including all blocker and advisory findings, is in
`verification.md`. Every listed finding maps to a requirement/design decision,
task, and validation gate above. No decision remains deferred to T001.

## Open Decision Impact

No open product decision blocks implementation planning. SQL/type identifiers
may be selected within the fixed behavior, but changes to normalization,
matching, cap behavior, frozen persistence, score compatibility, tuple order,
or count/filter semantics require requirements/design revision and re-review.
