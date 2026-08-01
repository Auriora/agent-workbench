---
title: Ruby and Rails partial-semantic traceability
doc_type: spec
artifact_type: traceability
status: draft
owner: platform
last_reviewed: 2026-08-01
---

# Traceability Matrix

## Task To Context Matrix

| Task ID | Requirements | Acceptance Criteria | Design Sections | Verification | Durable Targets | Open Decisions |
|---------|--------------|---------------------|-----------------|--------------|-----------------|----------------|
| T001 | Requirement 1, Requirement 5 | dependency and fixture boundaries | Dependency; Slice Boundary | G1 | all promotion owners | reconciled: forms frozen in canonical context |
| T002 | Requirement 1 | Requirement 1 AC1-AC3 | Components; Compatibility | G2 | packaging/runbook if needed | grammar version/build viability |
| T003 | Requirement 1 | Requirement 1 AC1-AC3 | Architecture; Error Handling | G3 | adapter design | none |
| T004 | Requirement 2 | Requirement 2 AC1-AC3 | Supported Forms; Algorithms | G4 | adapter design, matrix | none |
| T005 | Requirement 3 | Requirement 3 AC1 | Supported Forms | G5 | adapter design | exact call-form subset |
| T006 | Requirement 3, Requirement 5 | Requirement 3 AC2-AC3; Requirement 5 AC2 | Resolution; contracts | G5-G6 | runtime contracts, MCP/graph design if changed | generic coverage shape |
| T007 | Requirement 4, Requirement 5 | DSL matrix criteria | Supported Forms | G7 | adapter design | freeze initial DSL list |
| T008 | Requirement 4 | Requirement 4 AC1-AC3 | Rails DSL extraction | G7 | adapter design | none after T007 |
| T009 | Requirement 1-Requirement 5 | all validation criteria | Validation Strategy | G2-G10 | ledger/changelog | none |
| T010 | Requirement 5 | Requirement 5 AC2-AC4 | Slice Boundary; Promotion | G10-G11 | all durable targets and history | review disposition |

## Requirement To Delivery Matrix

| Requirement | Priority | Acceptance Criteria | Design Sections | Tasks | Verification | Durable Targets | Coverage State | Residual Destination |
|-------------|----------|---------------------|-----------------|-------|--------------|-----------------|----------------|----------------------|
| Requirement 1 | must-have | AC1-AC3 | Architecture; Error Handling | T001-T003, T009 | G1-G3, G8-G10 | adapter design, packaging docs | covered | Cross-platform native ABI evidence remains release validation. |
| Requirement 2 | must-have | AC1-AC3 | Supported Forms; Algorithms | T004, T009 | G4, G8-G10 | adapter design, matrix | covered | Dynamic identity remains unresolved under EB010. |
| Requirement 3 | must-have | AC1-AC3 | References; Coverage | T005-T006, T009 | G5-G6, G8-G10 | adapter/runtime/MCP/graph docs | covered | Runtime dispatch/constant lookup under EB010; generic disclosure under EB061. |
| Requirement 4 | should-have | AC1-AC3 | Rails DSL forms | T007-T009 | G7-G10 | adapter design | covered | Rails metaprogramming and engine/runtime composition under EB010. |
| Requirement 5 | must-have | AC1-AC4 | Validation; Promotion | T001, T006-T010 | G1-G11 | all promotion targets | covered | Representative fixtures and one dogfood application remain bounded evidence; deeper semantics stay under EB010, EB014 and EB061. |

## Correctness Property Coverage

| Property | Requirements | Design Sections | Tasks | Tests Or Verification | Residual Risk |
|----------|--------------|-----------------|-------|-----------------------|---------------|
| CP-001 | R1-R4 | Data Flow; Algorithms | T003-T005, T008-T009 | Extraction record invariants | Grammar edge cases |
| CP-002 | R2-R4 | Resolver | T004, T006, T008-T009 | Duplicate/ambiguous fixtures | Runtime lookup remains unknown |
| CP-003 | R3, R5 | Coverage disclosure | T005-T006, T009 | Query golden tests | Other languages may need EB061 migration |
| CP-004 | R1 | Error Handling | T002-T003, T009 | Missing/timeout/crash fixtures | Platform ABI variance |
| CP-005 | R4 | Rails DSL forms | T007-T009 | Static/dynamic paired fixtures | Rails metaprogramming |

## Design To Implementation Matrix

| Design Section | Requirements | Tasks | Interfaces Or Files | Verification | Coverage State | Residual Destination |
|----------------|--------------|-------|---------------------|--------------|----------------|----------------------|
| Components and Changes | R1-R5 | T001-T010 | package metadata, Ruby tree-sitter adapter, graph/query surfaces | G1-G11 | covered | Cross-platform ABI and deeper semantics remain outside this closed slice. |
| Supported Initial Forms | R2-R4 | T004-T008 | Ruby extractor and fixtures | G4-G7 | covered | Deeper dynamic forms under EB010. |
| Algorithms and Logic | R1-R4 | T003-T008 | extraction and resolver | G3-G7 | covered | Whole-program semantics under EB010. |
| Error Handling | R1, R5 | T002-T003, T009 | parser/native failure boundary | G2-G3, G8-G10 | covered | Platform ABI variance remains. |
| Slice Boundary And Residual Architecture | R3-R5 | T006-T010 | coverage contracts and durable routing | G6, G10-G11 | covered | EB010, EB014 and EB061 retain the explicit residual semantics. |

## Open Decision Impact

| Decision | Blocks | Affected Tasks | Resolution Needed |
|----------|--------|----------------|-------------------|
| Exact generic coverage-contract delta | none; no public schema change | T006, T009-T010 | Existing generic parser-route contract reused; EB061 owns broader disclosure changes. |
| Initial Rails DSL form list | none | T007-T008 | Frozen and proved by paired static/dynamic fixtures. |

## Maintenance Notes

Update coverage states and destinations after Spec 047 reconciliation and every
implemented slice. `not-covered` and `partial-blocking` rows prevent closure.
