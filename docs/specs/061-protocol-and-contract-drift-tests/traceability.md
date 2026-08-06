---
title: Protocol and contract drift tests traceability
doc_type: spec
artifact_type: traceability
status: draft
owner: platform
last_reviewed: 2026-08-06
---

# Traceability

## Requirement To Delivery Matrix

| Requirement | Task | Verification |
| --- | --- | --- |
| Requirement 1 | T001, T003 | CLI clean pass; enum and registry drift fixtures |
| Requirement 2 | T001, T002 | invalid example enum and missing action fixtures |
| Requirement 3 | T001, T002 | mutating safety-policy drift fixtures |
| Requirement 4 | T001, T002 | stable finding snapshots and local-only execution |
| CP-001 | T001 | source-authority unit tests |
| CP-002 | T002, T003 | changed source projection causes failure |
| CP-003 | T001, T003 | fixture and CLI run with no writes or network |

## Task To Context Matrix

| Task | Inputs | Outputs |
| --- | --- | --- |
| T001 | source schemas and registry | pure checker |
| T002 | checker API | fixtures and focused tests |
| T003 | checker, durable projections | package command and docs |
| T004 | completed implementation | validation and closure evidence |

## Design To Implementation Matrix

| Design section | Implementation |
| --- | --- |
| Authority flow | checker input and CLI adapters |
| Low-Level Design | snapshot, JSON example, server-card, and safety checks |
| Failure behavior | stable findings and non-zero exit |

## Open Decision Impact

No open decisions block delivery.
