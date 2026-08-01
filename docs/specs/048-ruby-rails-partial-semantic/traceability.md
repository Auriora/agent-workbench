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
| T001 | R1, R5 | dependency and fixture boundaries | Dependency; Slice Boundary | G1 | all promotion owners | exact reconciled forms |
| T002 | R1 | AC1-AC3 | Components; Compatibility | G2 | packaging/runbook if needed | grammar version/build viability |
| T003 | R1 | AC1-AC3 | Architecture; Error Handling | G3 | adapter design | none |
| T004 | R2 | AC1-AC3 | Supported Forms; Algorithms | G4 | adapter design, matrix | none |
| T005 | R3 | AC1 | Supported Forms | G5 | adapter design | exact call-form subset |
| T006 | R3, R5 | R3 AC2-AC3; R5 AC2 | Resolution; contracts | G5-G6 | runtime contracts, MCP/graph design if changed | generic coverage shape |
| T007 | R4, R5 | DSL matrix criteria | Supported Forms | G7 | adapter design | freeze initial DSL list |
| T008 | R4 | AC1-AC3 | Rails DSL extraction | G7 | adapter design | none after T007 |
| T009 | R1-R5 | all validation criteria | Validation Strategy | G2-G10 | ledger/changelog | none |
| T010 | R5 | AC2-AC4 | Slice Boundary; Promotion | G10-G11 | all durable targets and history | review disposition |

## Requirement To Delivery Matrix

| Requirement | Priority | Acceptance Criteria | Design Sections | Tasks | Verification | Durable Targets | Coverage State | Residual Destination |
|-------------|----------|---------------------|-----------------|-------|--------------|-----------------|----------------|----------------------|
| R1 | must-have | AC1-AC3 | Architecture; Error Handling | T001-T003, T009 | G1-G3, G8-G10 | adapter design, packaging docs | not-covered | Spec 048 tasks |
| R2 | must-have | AC1-AC3 | Supported Forms; Algorithms | T004, T009 | G4, G8-G10 | adapter design, matrix | not-covered | Spec 048 tasks |
| R3 | must-have | AC1-AC3 | References; Coverage | T005-T006, T009 | G5-G6, G8-G10 | adapter/runtime/MCP/graph docs | not-covered | Spec 048 tasks |
| R4 | should-have | AC1-AC3 | Rails DSL forms | T007-T009 | G7-G10 | adapter design | not-covered | Spec 048 tasks or explicit follow-up |
| R5 | must-have | AC1-AC4 | Validation; Promotion | T001, T006-T010 | G1-G11 | all promotion targets | not-covered | Spec 048 tasks |

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
| Components and Changes | R1-R5 | T001-T010 | package metadata, Ruby tree-sitter adapter, graph/query surfaces | G1-G11 | not-covered | Spec 048 tasks |
| Supported Initial Forms | R2-R4 | T004-T008 | Ruby extractor and fixtures | G4-G7 | not-covered | Spec 048 tasks |
| Algorithms and Logic | R1-R4 | T003-T008 | extraction and resolver | G3-G7 | not-covered | Spec 048 tasks |
| Error Handling | R1, R5 | T002-T003, T009 | parser/native failure boundary | G2-G3, G8-G10 | not-covered | Spec 048 tasks |
| Slice Boundary And Residual Architecture | R3-R5 | T006-T010 | coverage contracts and durable routing | G6, G10-G11 | not-covered | T010, EB014, EB061 or focused follow-up |

## Open Decision Impact

| Decision | Blocks | Affected Tasks | Resolution Needed |
|----------|--------|----------------|-------------------|
| Exact generic coverage-contract delta | T006 if public contract changes | T006, T009-T010 | Architecture review during T001/T006. |
| Initial Rails DSL form list | Rails extraction | T007-T008 | Freeze from fixtures before T008. |

## Maintenance Notes

Update coverage states and destinations after Spec 047 reconciliation and every
implemented slice. `not-covered` and `partial-blocking` rows prevent closure.
