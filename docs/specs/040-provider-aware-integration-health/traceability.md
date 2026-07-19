---
title: Provider-aware integration health traceability
doc_type: spec
artifact_type: traceability
status: draft
owner: platform
last_reviewed: 2026-07-19
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Traceability Matrix

## Task To Context Matrix

| Task | Requirements | Acceptance Criteria | Properties | Design sections | Verification | Durable targets |
| --- | --- | --- | --- | --- | --- | --- |
| T001 | Requirement 1; Requirement 2; Requirement 3; Requirement 4; Requirement 5 | all | CP-001-CP-005 | all | Failing/compatibility contract fixtures | runtime contracts |
| T002 | Requirement 1 | Requirement 1 AC1-AC5 | CP-001 | Common Profile; Registered Surface Authority | Profile/resource fixtures | integration design; runtime contracts |
| T003 | Requirement 2 | Requirement 2 AC1-AC5 | CP-001, CP-002 | Per-Connection Identity | Mixed-client daemon/launcher fixtures | integration design |
| T004 | Requirement 3 | Requirement 3 AC1-AC5 | CP-003 | Health Surfaces | Static/tool golden tests | MCP surface; runtime contracts |
| T005 | Requirement 4; Requirement 5 | Requirement 4 AC1-AC5; Requirement 5 AC1-AC4 | CP-004, CP-005 | Artifact Identity; Migration | Mismatch/package validation | runtime contracts; runbooks |
| T006 | Requirement 1; Requirement 2; Requirement 3; Requirement 4; Requirement 5 | all | CP-001-CP-005 | Validation Strategy | Focused/package/full gates | none |
| T007 | Requirement 1; Requirement 2; Requirement 3; Requirement 4; Requirement 5 | all | all | Slice Boundary | Promotion/closure checks | all named durable owners |

## Requirement To Delivery Matrix

| Requirement | Priority | Acceptance Criteria | Design Sections | Tasks | Verification | Durable Targets | Coverage State | Residual Destination |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Requirement 1 | must-have | AC1-AC5 | Common Profile; Registered Surface Authority | T001-T002, T006-T007 | Profile/compatibility fixtures | integration design; runtime contracts | complete | none |
| Requirement 2 | must-have | AC1-AC5 | Per-Connection Identity | T001, T003, T006-T007 | Mixed-client daemon fixtures | integration design | complete | none |
| Requirement 3 | must-have | AC1-AC5 | Health Surfaces | T001, T004, T006-T007 | Static/tool protocol fixtures | MCP surface; runtime contracts | complete | none |
| Requirement 4 | must-have | AC1-AC5 | Artifact Identity | T001, T005-T007 | Identity/mismatch fixtures | runtime contracts; runbooks | complete | none |
| Requirement 5 | must-have | AC1-AC4 | Migration And Compatibility | T001, T005-T007 | Package/compatibility gates | plugin/runbook/changelog | complete | none |

## Correctness Property Coverage

| Property | Requirements | Tasks | Planned evidence | Residual risk |
| --- | --- | --- | --- | --- |
| CP-001 | Requirement 1, Requirement 2 | T001-T003 | Unknown/Claude/Codex mapping fixtures | pending |
| CP-002 | Requirement 2 | T001, T003 | Concurrent mixed-client daemon fixture | pending |
| CP-003 | Requirement 3 | T001, T004 | Static resource versus tool golden tests | pending |
| CP-004 | Requirement 4 | T001, T005 | Artifact identity/provenance schemas | pending |
| CP-005 | Requirement 4, Requirement 5 | T001, T005-T006 | Mismatch/no-side-effect tests | pending |

## Design To Implementation Matrix

| Design section | Requirements | Tasks | Likely interfaces/files | Coverage state |
| --- | --- | --- | --- | --- |
| Common Profile Model | Requirement 1 | T001-T002 | integration contracts/use cases/presenters/resources | not-covered |
| Per-Connection Identity Context | Requirement 2 | T001, T003 | launchers, stdio, daemon, server factory | not-covered |
| Registered Surface Authority | Requirement 1 | T002 | registry/common binding catalog | not-covered |
| Health Surfaces | Requirement 3 | T001, T004 | health use case/presenter/resource/tool | not-covered |
| Artifact Identity And Mismatch Policy | Requirement 4, Requirement 5 | T001, T005 | version/metadata/validator paths | not-covered |

## Open Decision Impact

| Decision ID | Blocks | Requirements | Tasks | Resolution needed |
| --- | --- | --- | --- | --- |
| D004 handshake identity field | T003 implementation | Requirement 2, Requirement 4 | T001, T003 | Select a narrow explicit field/provenance shape that is provider-neutral and cache-layout-independent. |

## Maintenance Notes

- Replace `not-covered` only with concrete implementation/test evidence.
- Any partial result requires one destination before closure.
