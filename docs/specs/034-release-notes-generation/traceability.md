---
title: Release notes generation traceability
doc_type: spec
artifact_type: traceability
status: active
owner: platform
last_reviewed: 2026-07-05
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Traceability

## Task To Context Matrix

| Task | Requirements | Design Sections | Verification |
| --- | --- | --- | --- |
| T001 | R1, R4 | Data Model, Implementation Review Decisions | Helper unit tests for semantic version, tag, candidate ID, and traceability field behavior |
| T002 | R1 | CLI Surface, Evidence Collector, Command Planning | Release tag detection, invalid range, no-tag, and empty-range tests |
| T003 | R1, R4 | Evidence Collector, Data Model, Implementation Review Decisions | Commit parsing and per-commit file-evidence tests, including multiline body and malformed row cases |
| T004 | R1, R4 | Evidence Collector, Data Model | Rename/copy parsing and malformed name-status tests |
| T005 | R2, R4 | Classifier | Representative path classification tests for every area and audience |
| T006 | R2, R4 | Grouping Strategy, Classifier, Implementation Review Decisions | Candidate grouping tests with per-commit attachment, confidence, review-needed, and rationale assertions |
| T007 | R2, R3, R4 | CLI Surface, Output Rules | Validation note/file tests and no-validation output checks |
| T008 | R1, R2, R4 | Data Model, Evidence Collector, Grouping Strategy | Evidence packet shape and skipped-enrichment assertions |
| T009 | R2, R3, R4 | Output Modes, Markdown Renderer, Output Rules | Snapshot-style output tests for draft, GitHub, Markdown, and agent modes |
| T010 | R3, R4, R5 | Agent-Assisted Synthesis, Reusable Prompt Or Skill Contract, Output Rules | JSON evidence and agent-instruction file tests |
| T011 | R1, R3, R4 | CLI Surface, Command Planning, Release Publishing Integration, Implementation Review Decisions | CLI help, dry-run, parent-directory creation, file-write, module-boundary, and no-network behavior tests |
| T012 | R1, R2, R3, R4 | Command Planning, Evidence Collector, Output Modes, Implementation Review Decisions | Fixture-backed end-to-end dev CLI tests |
| T013 | R3, R5 | Release Publishing Integration, Operational Considerations | Documentation review and command example checks |
| T014 | R2, R4, R5 | Agent-Assisted Synthesis, Reusable Prompt Or Skill Contract | Guidance review against generated evidence packet |
| T015 | R1, R2, R3, R4, R5 | All implementation-facing design sections | Required validation commands and waiver recording |
| T016 | R3, R5 | Operational Considerations | Durable-doc promotion and closure-readiness check |

## Requirement To Delivery Matrix

- R1: T001, T002, T003, T004, T008, T011, T012, T015
- R2: T005, T006, T007, T008, T009, T012, T014, T015
- R3: T007, T009, T010, T011, T012, T013, T015, T016
- R4: T001, T003, T004, T005, T006, T007, T008, T009, T010, T011,
  T012, T014, T015
- R5: T010, T013, T014, T015, T016

## Design To Implementation Matrix

- CLI Surface: T002, T007, T011, T013
- Evidence Collector: T002, T003, T004, T008, T012
- Classifier: T005, T006, T012
- Grouping Strategy: T006, T008, T012
- Agent-Assisted Synthesis: T010, T014
- Markdown Renderer: T009, T012
- Reusable Prompt Or Skill Contract: T010, T014, T016
- Command Planning: T002, T011, T012
- Output Modes: T009, T012
- Output Rules: T007, T009, T010, T011
- Operational Considerations: T013, T015, T016
- Release Publishing Integration: T011, T013
- Implementation Review Decisions: T001, T003, T006, T011, T012
- Data Model: T001, T003, T004, T008
- Release-tag detection: T002, T008, T012
- Per-commit file evidence: T003, T006, T008, T012
- Rename/copy parsing: T004, T012
- Validation evidence inputs: T007, T012
- Draft/final release-note state: T009, T013

## Open Decision Impact

| Decision | Impact | Blocking |
| --- | --- | --- |
| Sidecar JSON default vs opt-in | Affects T010 evidence output behavior, T011 command flags, T012 tests, and release review ergonomics | No; default can start opt-in |
| Release preflight validation import | Affects T007 validation evidence richness and possible future `awb release notes` flags | No; can defer to follow-up |
| Fixed vs configurable sections | Affects T009 renderer complexity and cross-repo reuse | No; fixed sections are acceptable for first implementation |
| First-parent release tag detection | Affects T002 default range selection and T012 fixture shape | No; semantic version filtering is accepted for v1 |

## Durable Promotion Targets

- `tools/devcli/README.md`
- `docs/reference/agent-readable-changelog.md`
- `docs/backlog/README.md`
- `docs/reference/documentation-map.md` if a new durable release-note guidance
  document is added
