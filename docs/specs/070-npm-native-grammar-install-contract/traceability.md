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
| Requirement 2 | T002 | partial | v0.6.10 accepted; corrective v0.6.11 container gate in progress |
| Requirement 3 | T002; T003 | partial | v0.6.10 publication failed before push; corrective v0.6.11 pending |

## Design To Implementation Matrix

D001 seals exact corrected metadata; D002 pins project-owned artifact transport.
Runtime source/package/platform acceptance passed for v0.6.10. Corrective
container packaging, v0.6.11 publication and live installation remain in progress.

## Open Decision Impact

D001/D002 decisions are fixed. Ordinary consumer and platform gates passed for v0.6.10. Corrective container
packaging is in progress; no product decision is pending.
