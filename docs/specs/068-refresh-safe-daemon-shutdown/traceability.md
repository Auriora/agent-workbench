---
title: Refresh-safe daemon shutdown traceability
doc_type: spec
artifact_type: traceability
status: active
owner: platform
last_reviewed: 2026-11-06
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Traceability

## Task To Context Matrix

| Task ID | Requirements | Acceptance Criteria | Design Sections | Verification | Durable Targets | Open Decisions |
| --- | --- | --- | --- | --- | --- | --- |
| T001 | Requirement 1 | AC1-AC3 | Controller shutdown | V001 | runtime contracts; runtime operations | none |
| T002 | Requirement 2, Requirement 3 | all | Daemon protocol; Startup exclusion reclamation; Evidence | V002 | runtime operations; observability; runbook | none |
| T003 | Requirement 4 | AC1-AC2 | Validation and promotion | V003 | all named owners; backlog | none |

## Requirement To Delivery Matrix

| Requirement | Priority | Acceptance Criteria | Design Sections | Tasks | Verification | Durable Targets | Coverage State | Residual Destination |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Requirement 1 | must-have | AC1-AC3 | Controller shutdown | T001 | V001 | operations; contracts | complete | none |
| Requirement 2 | must-have | AC1-AC4 | Daemon protocol | T002 | V002 | operations; runbook | complete | none |
| Requirement 3 | must-have | AC1-AC3 | Evidence | T002 | V002 | contracts; observability | complete | none |
| Requirement 4 | must-have | AC1-AC2 | Validation and promotion | T003 | V003 | all owners; backlog | complete | none |

## Design To Implementation Matrix

| Design Section | Requirements | Tasks | Interfaces Or Files | Verification |
| --- | --- | --- | --- | --- |
| Controller shutdown | Requirement 1 | T001 | controller; ownership; ports | V001 |
| Daemon protocol; Evidence | Requirement 2, Requirement 3 | T002 | daemon/client lifecycle; coordinator; lifetime receipt | V002 |
| Validation and promotion | Requirement 4 | T003 | child fixtures; docs; backlog | V003 |

## Open Decision Impact

Shared APIs and fixture boundaries are fixed in design.md; no blocking decision
is pending. B001 is committed; B006 and Spec 065 retain separate scope.
