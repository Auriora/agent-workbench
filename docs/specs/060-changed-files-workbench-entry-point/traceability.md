---
title: Changed-files Workbench entry point traceability
doc_type: spec
artifact_type: traceability
status: active
owner: platform
last_reviewed: 2026-08-06
---

# Traceability Matrix

## Task To Context Matrix

| Task ID | Requirements | Acceptance Criteria | Design Sections | Verification | Durable Targets | Open Decisions |
| --- | --- | --- | --- | --- | --- | --- |
| T001 | Requirement 1, Requirement 2 | Requirement 1 AC1-AC3; Requirement 2 AC3 | Components; data models; security | Git/contract gates | runtime contracts | none |
| T002 | Requirement 2, Requirement 3 | all | Data flow; algorithms; errors | application/presenter gates | edit/validation design | none |
| T003 | Requirement 4 | AC1, AC3 | MCP adapter; compatibility | MCP/registry gates | MCP surface design | none |
| T004 | Requirement 4 | AC2, AC3 | Integration guidance | provider integration gates | coding-agent integration design | none |
| T005 | all | all | Validation strategy | all gates and reviews | verification evidence | none |
| T006 | all | all | Durable impact; residual architecture | promotion/closure checks | all named targets | none |

## Requirement To Delivery Matrix

| Requirement | Priority | Tasks | Verification | Durable Targets | Coverage State | Residual Destination |
| --- | --- | --- | --- | --- | --- | --- |
| Requirement 1 | must-have | T001 | Git and contract tests | runtime contracts | covered | none |
| Requirement 2 | must-have | T001-T003 | application, presenter, MCP tests | edit/validation and MCP designs | covered | none |
| Requirement 3 | must-have | T002-T003 | lifecycle observational/no-write tests | lifecycle bridge contract | covered | none |
| Requirement 4 | must-have | T003-T004 | registry/integration/plugin tests | coding-agent integration design | covered | none |

## Correctness Property Coverage

| Property | Requirements | Tasks | Tests Or Verification | Residual Risk |
| --- | --- | --- | --- | --- |
| CP-001 | Requirement 1 | T001 | Git adapter and contract tests | platform Git behavior |
| CP-002 | Requirement 2 | T002 | state matrix tests | provider combination growth |
| CP-003 | Requirement 2 | T001-T003 | validation-status contract and MCP tests | none expected |
| CP-004 | Requirement 3 | T002-T003 | no-writer dependency and behavior tests | external caller truthfulness |

## Design To Implementation Matrix

| Design Section | Requirements | Tasks | Interfaces Or Files | Verification | Coverage State | Residual Destination |
| --- | --- | --- | --- | --- | --- | --- |
| Contracts and Git categories | Requirement 1, Requirement 2 | T001 | contracts, ports, command adapter | focused tests | covered | none |
| Application/presentation flow | Requirement 2, Requirement 3 | T002 | use case and presenter | state matrix | covered | none |
| Public MCP surface | Requirement 4 | T003 | registry and server composition | MCP tests | covered | none |
| Agent discoverability | Requirement 4 | T004 | integration profiles and packaged guidance | integration tests | covered | none |

## Open Decision Impact

No open decision blocks implementation. Historical duplicate Spec 034 numbering
is preserved and disambiguated by full package identity; it does not alter Spec
060 behavior.

## Maintenance Notes

Update coverage states and evidence with each completed task.
