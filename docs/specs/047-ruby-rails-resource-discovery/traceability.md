---
title: Ruby and Rails resource discovery traceability
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
| T001 | Requirement 1, Requirement 2, Requirement 3, Requirement 4 | Requirement 1 AC1; Requirement 1 AC2; Requirement 1 AC3; Requirement 1 AC4; Requirement 2 AC1; Requirement 2 AC2; Requirement 2 AC3; Requirement 2 AC4; Requirement 2 AC5; Requirement 2 AC6; Requirement 3 AC1; Requirement 3 AC2; Requirement 3 AC3; Requirement 3 AC6; Requirement 4 AC2; Requirement 4 AC3 | Components and Changes; Data Flow; Rails Project Shape Discovery; Path-Policy Expansion; Validation Candidate Discovery and Ranking; Security, Trust, and Access; Operational Considerations | Gate 1 | `docs/specs/047-ruby-rails-resource-discovery/design.md`; `docs/specs/047-ruby-rails-resource-discovery/traceability.md`; `docs/specs/047-ruby-rails-resource-discovery/verification.md` | none |
| T002 | Requirement 1, Requirement 2, Requirement 3, Requirement 4 | Requirement 1 AC1; Requirement 1 AC2; Requirement 1 AC3; Requirement 1 AC4; Requirement 2 AC1; Requirement 2 AC2; Requirement 2 AC3; Requirement 2 AC4; Requirement 2 AC5; Requirement 2 AC6; Requirement 3 AC1; Requirement 3 AC2; Requirement 3 AC3; Requirement 3 AC4; Requirement 3 AC5; Requirement 3 AC6; Requirement 4 AC1; Requirement 4 AC2; Requirement 4 AC3 | Validation Strategy | Gates 2-4 | `docs/reference/dogfood-evidence-ledger.md`; `docs/reference/workspace-safety-contract.md` | none |
| T003 | Requirement 1 | Requirement 1 AC1; Requirement 1 AC2; Requirement 1 AC3; Requirement 1 AC4 | Components and Changes; Data Flow; Path-Policy Expansion | Gate 2 | `docs/design/language-adapter-design.md`; `docs/reference/language-capability-matrix.md` | none |
| T004 | Requirement 2, Requirement 4 | Requirement 2 AC1; Requirement 2 AC2; Requirement 2 AC3; Requirement 2 AC4; Requirement 2 AC5; Requirement 2 AC6; Requirement 4 AC1; Requirement 4 AC2; Requirement 4 AC3 | System Architecture; Components and Changes; Data Flow; Error Handling | Gate 3 | `docs/design/language-adapter-design.md`; `docs/reference/workspace-safety-contract.md` | none |
| T005 | Requirement 2 | Requirement 2 AC1; Requirement 2 AC2; Requirement 2 AC3; Requirement 2 AC4; Requirement 2 AC5; Requirement 2 AC6 | Components and Changes; Data Flow | Gate 3 | `docs/design/language-adapter-design.md` | none |
| T006 | Requirement 3 | Requirement 3 AC1; Requirement 3 AC2; Requirement 3 AC3; Requirement 3 AC4; Requirement 3 AC5; Requirement 3 AC6 | Validation Candidate Discovery and Ranking; Error Handling | Gate 4 | `docs/design/language-adapter-design.md`; `docs/reference/runtime-contracts.md` if needed | none |
| T007 | Requirement 1, Requirement 2, Requirement 3, Requirement 4 | Requirement 1 AC1; Requirement 1 AC2; Requirement 1 AC3; Requirement 1 AC4; Requirement 2 AC1; Requirement 2 AC2; Requirement 2 AC3; Requirement 2 AC4; Requirement 2 AC5; Requirement 2 AC6; Requirement 3 AC1; Requirement 3 AC2; Requirement 3 AC3; Requirement 3 AC4; Requirement 3 AC5; Requirement 3 AC6; Requirement 4 AC1; Requirement 4 AC2; Requirement 4 AC3 | Validation Strategy; Operational Considerations | Gates 2-7 | `tests/workspace/path-policy-consistency.test.ts`; `tests/telemetry/boundary-instrumentation.test.ts`; `tests/graph/resource-extractor-rules.test.ts`; `tests/mcp/telemetry-instrumentation.test.ts`; `docs/reference/workspace-safety-contract.md`; `docs/reference/dogfood-evidence-ledger.md` | none |
| T008 | Requirement 4 | Requirement 4 AC2; Requirement 4 AC3 | Slice Boundary And Residual Architecture; Operational Considerations | Gates 7-8 | `docs/design/language-adapter-design.md`; `docs/reference/language-capability-matrix.md`; `docs/backlog/README.md`; `docs/reference/workspace-safety-contract.md`; `docs/reference/dogfood-evidence-ledger.md`; `docs/history/spec-closure-log.md` | none |

## Requirement To Delivery Matrix

| Requirement | Priority | Acceptance Criteria | Design Sections | Tasks | Verification | Durable Targets | Coverage State | Residual Destination |
|-------------|----------|---------------------|-----------------|-------|--------------|-----------------|----------------|----------------------|
| Requirement 1 | must-have | Requirement 1 AC1; Requirement 1 AC2; Requirement 1 AC3; Requirement 1 AC4 | Components and Changes; Data Flow; Security, Trust, and Access | T001-T003, T007 | Gates 1-2, 6 | `docs/design/language-adapter-design.md`; `docs/reference/language-capability-matrix.md` | not-covered | Spec 047 tasks |
| Requirement 2 | must-have | Requirement 2 AC1; Requirement 2 AC2; Requirement 2 AC3; Requirement 2 AC4; Requirement 2 AC5; Requirement 2 AC6 | System Architecture; Data Flow; Error Handling | T002, T004-T005, T007 | Gate 3 | `docs/design/language-adapter-design.md` | not-covered | Spec 047 tasks |
| Requirement 3 | must-have | Requirement 3 AC1; Requirement 3 AC2; Requirement 3 AC3; Requirement 3 AC4; Requirement 3 AC5; Requirement 3 AC6 | Validation Candidate Discovery and Ranking; Error Handling | T002, T006-T007 | Gate 4 | `docs/design/language-adapter-design.md` | not-covered | Spec 047 tasks |
| Requirement 4 | must-have | Requirement 4 AC1; Requirement 4 AC2; Requirement 4 AC3 | Validation Strategy; Slice Boundary And Residual Architecture | T001-T002, T004, T007-T008 | Gates 2-8 (AC1 fixture proof uses Gates 2-4; regression, promotion, and closure use Gates 5-8) | `docs/design/language-adapter-design.md`; `docs/reference/language-capability-matrix.md`; `docs/backlog/README.md`; `docs/reference/dogfood-evidence-ledger.md`; `docs/reference/workspace-safety-contract.md`; `docs/history/spec-closure-log.md` | not-covered | Spec 047 tasks |

## Correctness Property Coverage

| Property | Requirements | Design Sections | Tasks | Tests Or Verification | Residual Risk |
|----------|--------------|-----------------|-------|-----------------------|---------------|
| CP-001 | Requirement 2, Requirement 4 | Data Flow | T002, T004-T005, T007 | Rails fixture returned-path assertions | Convention diversity |
| CP-002 | Requirement 2 | Error Handling | T002, T004-T005, T007 | Degraded overview/context coverage tests | Surface-specific metadata |
| CP-003 | Requirement 3 | Validation Candidate Discovery and Ranking; Error Handling | T002, T006-T007 | Validation-plan golden tests | Custom wrappers |
| CP-004 | Requirement 1, Requirement 2 | Security, Trust, and Access | T002-T004, T007 | Exclusion fixtures and shared policy regressions | Novel generated paths |
| CP-005 | Requirement 1, Requirement 2, Requirement 4 | Migration and Compatibility | T002-T005, T007 | Existing adapter regression suite | none expected |
| CP-006 | Requirement 1, Requirement 2 | Security, Trust, and Access | T002-T004, T007 | Secret-path and redaction regressions | Novel Rails secret paths |

## Design To Implementation Matrix

| Design Section | Requirements | Tasks | Interfaces Or Files | Verification | Coverage State | Residual Destination |
|----------------|--------------|-------|---------------------|--------------|----------------|----------------------|
| Components and Changes | Requirement 1, Requirement 2, Requirement 3, Requirement 4 | T001-T006 | `file-catalog-entry`, `rails-project-shape`, capability policy, extraction and use cases | Gates 2-5 | not-covered | Spec 047 tasks |
| Data Flow | Requirement 1, Requirement 2, Requirement 3 | T003-T006 | catalog, resource extraction, context, validation planning | Gates 2-4 | not-covered | Spec 047 tasks |
| Security, Trust, and Access | Requirement 1, Requirement 2, Requirement 3, Requirement 4 | T002-T007 | shared path policy, command safety, telemetry suppression, presentation redaction | Gates 2-8 | not-covered | Spec 047 tasks |
| Validation Strategy | Requirement 1, Requirement 2, Requirement 3, Requirement 4 | T002, T007 | focused/full tests and dogfood evidence | Gates 2-7 | not-covered | Spec 047 tasks |
| Slice Boundary And Residual Architecture | Requirement 4 | T008 | durable docs and follow-up package route | Gate 8 | not-covered | `docs/specs/048-ruby-rails-partial-semantic/` |

## Open Decision Impact

No owner decision blocks T001. The recorded architecture uses the existing
generic `resource` node; any proposed public schema or graph-kind change must
pause the affected task for architecture review.

## Maintenance Notes

Update coverage states and evidence when task scope or implementation changes.
`not-covered` rows block closure until implemented, rejected with rationale, or
routed to exactly one owner.
Keep requirement and acceptance-criterion references fully qualified so
lifecycle task context can resolve them without aliases.
T007 remains the end-to-end verification owner for CP-001 through CP-006.
The focused design review accepted the current mappings; T001 must refresh them
if live-source reconciliation finds drift.
