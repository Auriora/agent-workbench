---
title: MCP tool-sweep production extractor parity traceability
doc_type: spec
artifact_type: traceability
status: active
owner: platform
last_reviewed: 2026-08-04
---

# Traceability

## Task To Context Matrix

| Task | Requirements | Properties | Design | Verification | Durable targets |
| --- | --- | --- | --- | --- | --- |
| T001 | R1-R4 | readiness | all boundaries | lifecycle preflight/lint | active package |
| T002 | R1 | CP-001 | canonical registry | registry/parity tests | debugging design |
| T003 | R2-R4 | CP-002 to CP-004 | ecosystem selection and failure behavior | Go/C++ sweep fixtures | debugging design, EB010 |
| T004 | R1-R4 | proof boundary | durable promotion | Markdown and dogfood checks | debugging design, backlog, ledger |
| T005 | R1-R4 | CP-001 to CP-004 | validation strategy | focused/full/review/lifecycle gates | closure evidence |

## Requirement To Delivery Matrix

| Requirement | Tasks | Expected evidence | Coverage State | Residual Destination |
| --- | --- | --- | --- | --- |
| Requirement 1 | T002, T005 | canonical factory, consumer adoption, parity assertion | complete | none |
| Requirement 2 | T003, T005 | Go and C/C++ indexed sweep probes | complete | none |
| Requirement 3 | T003, T005 | capability/provenance and failure-quality assertions | complete | none |
| Requirement 4 | T002-T005 | drift regression, validation, review, target preservation | complete | none |

## Correctness Properties

| Property | Tasks | Verification |
| --- | --- | --- |
| CP-001 | T002 | exact sorted language set and shared factory use |
| CP-002 | T003 | deterministic fixture reruns |
| CP-003 | T003, T005 | stored/public capability and provenance assertions |
| CP-004 | T003-T005 | fixture safety plus target Git-status comparison |

## Design To Implementation Matrix

| Design area | Requirements | Tasks | Files | Verification |
| --- | --- | --- | --- | --- |
| Canonical registry | R1, R4 | T002, T005 | extraction composition and both consumers | parity and architecture tests |
| Ecosystem selection | R2-R4 | T003, T005 | debug sweep and fixtures | Go/C++ graph probe tests |
| Evidence presentation | R3-R4 | T003, T005 | query helpers, references, impact | C++ capability/provenance assertions |
| Durable proof boundary | R1-R4 | T004, T005 | design, backlog, ledger | Markdown and dogfood checks |

## Open Decision Impact

None. One canonical factory and existing extractor implementations are the only
approved path for this slice.
