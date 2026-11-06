---
title: Native grammar npm installation traceability
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

| Task ID | Requirements | Design Sections | Verification | Durable Targets |
| --- | --- | --- | --- | --- |
| T001 | Requirement 1 | Low-Level Design | V001 npm/native fixture | packaging; native dependency setup |
| T002 | Requirement 2; Requirement 3 AC1 | Operational Considerations | V002 candidate gates | release notes; install runbook |
| T003 | Requirement 3 | Operational Considerations | V003 published/installed identity | backlog; verification |

## Requirement To Delivery Matrix

| Requirement | Tasks | Coverage State | Evidence |
| --- | --- | --- | --- |
| Requirement 1 | T001 | complete | verification.md#v001-native-grammar-dependency-acceptance |
| Requirement 2 | T002 | complete | verification.md#corrective-v0611-candidate-acceptance |
| Requirement 3 | T002; T003 | partial | v0.6.11 image published; D003 final asset publication and installation pending |

## Design To Implementation Matrix

D001 seals exact corrected metadata; D002 pins project-owned artifact transport.
D003 governs final publication resumption using retained verified bytes.
Runtime source/package/platform and corrective container acceptance passed for
v0.6.11. Publication and live installation remain in progress.

## Open Decision Impact

D001/D002 decisions are fixed. Ordinary consumer, platform and corrective container gates passed for v0.6.11.
Publication and live installation remain; no product decision is pending.
