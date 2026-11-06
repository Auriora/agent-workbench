---
title: Daemon admission budget traceability
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

| Task | Requirements | Design | Properties | Validation |
| --- | --- | --- | --- | --- |
| T001 | Requirement 1; Requirement 2 AC1; Requirement 3 | design.md#policy-and-components | CP-001; CP-002; CP-003; CP-004 | Accounting and SDK lifetime tests |
| T002 | Requirement 1; Requirement 2; Requirement 3 | design.md#policy-and-components | CP-001; CP-002; CP-003; CP-004 | Socket saturation and inactivity fixtures |
| T003 | Requirement 4 | design.md#promotion-and-boundaries | CP-001; CP-002; CP-003; CP-004 | Regression, review and promotion |

## Requirement To Delivery Matrix

| Requirement | Tasks | Coverage State | Evidence |
| --- | --- | --- | --- |
| Requirement 1 | T001; T002 | complete | verification.md |
| Requirement 2 | T001; T002 | complete | verification.md |
| Requirement 3 | T001; T002 | complete | verification.md |
| Requirement 4 | T003 | complete | verification.md |

## Design To Implementation Matrix

| Design Section | Requirements | Tasks | Interfaces Or Files | Verification |
| --- | --- | --- | --- | --- |
| Policy and components | Requirement 1; Requirement 2; Requirement 3 | T001; T002 | admission module; SDK adapter; daemon; socket transport | Focused and regression suites |
| Shutdown quiescence | Requirement 3 | T001; T002 | admission.whenQuiescent; daemon.close_clients | Delayed-tool shutdown and successor fixture |
| Promotion and boundaries | Requirement 4 | T003 | durable owners; backlog | Review and metadata checks |

## Open Decision Impact

No unresolved decision. Counter bounds do not establish total memory or CPU-rate
fairness. Constructor-installed controls remain synchronous in the current SDK.
