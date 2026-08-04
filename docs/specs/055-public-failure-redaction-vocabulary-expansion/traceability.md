---
title: Public failure redaction vocabulary expansion traceability
doc_type: spec
artifact_type: traceability
status: active
owner: platform
last_reviewed: 2026-08-04
---

# Traceability Matrix

## Task To Context Matrix

| Task | Requirements | Criteria/properties | Design | Verification | Durable targets |
| --- | --- | --- | --- | --- | --- |
| T001 | Requirement 1, Requirement 2, Requirement 3, Requirement 4 | readiness | overview and boundaries | lifecycle preflight | package |
| T002 | R1-R3 | all; CP-001 to CP-003 | redaction components | focused redaction tests | workspace safety/runtime contracts |
| T003 | R4 | all; CP-004 | error handling | diagnostics MCP tests | runtime contracts/EB038 |
| T004 | Requirement 1, Requirement 2, Requirement 3, Requirement 4 | durable impact | compatibility | Markdown checks | contracts/backlog |
| T005 | Requirement 1, Requirement 2, Requirement 3, Requirement 4 | SC-001 to SC-003 | validation strategy | full gates and reviews | closure evidence |

## Requirement To Delivery Matrix

| Requirement | Priority | Tasks | Tests/evidence | Coverage State |
| --- | --- | --- | --- | --- |
| Requirement 1 | must-have | T002, T005 | focused redaction boundary regression plus independent review | complete |
| Requirement 2 | must-have | T002, T005 | focused redaction boundary regression plus independent review | complete |
| Requirement 3 | must-have | T002, T005 | safe counterexamples, UTF-8 bound assertions, and closure-readiness review | complete |
| Requirement 4 | must-have | T003, T005 | focused diagnostics/error-envelope regression plus independent review | complete |

## Correctness Property Coverage

| Property | Tasks | Verification | Residual risk |
| --- | --- | --- | --- |
| CP-001 | T002 | repeated-sanitization assertions | none planned |
| CP-002 | T002 | safe counterexample table | none planned |
| CP-003 | T002, T005 | UTF-8 bound test | none planned |
| CP-004 | T003, T005 | complete envelope assertions | none planned |

## Design To Implementation Matrix

| Design section | Requirements | Tasks | Interfaces/files | Verification | Coverage State |
| --- | --- | --- | --- | --- | --- |
| High-Level Design | R1-R4 | T002-T004 | presentation, MCP adapter, durable docs | focused tests and review | implemented |
| Low-Level Design | R1-R4 | T002-T003 | redaction and diagnostics presenters | focused tests | implemented |
| Error Handling | R4 | T003 | diagnostics presenter and registry | diagnostics MCP tests | implemented |
| Security, Trust, and Access | R1-R3 | T002, T005 | canonical redactor | security review and boundary tests | implemented |

## Open Decision Impact

No open decisions block implementation.
