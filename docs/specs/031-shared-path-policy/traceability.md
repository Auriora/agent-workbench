---
title: Shared path policy traceability
doc_type: spec
artifact_type: traceability
status: active
owner: platform
last_reviewed: 2026-06-18
---

# Traceability

## Task To Context Matrix

| Task | Requirements | Design Sections | Durable Targets | Verification |
| --- | --- | --- | --- | --- |
| T001 | R1 | Overview | Workspace safety contract | Inventory review |
| T002 | R1, R2, P1, P2, P3 | High-Level Design, Low-Level Design | Workspace safety contract, threat model | Classifier unit tests |
| T003 | R1, R2, P2 | Low-Level Design | Workspace safety contract | Workspace safety tests |
| T004 | R1, R3, P1 | Low-Level Design | Runtime operations design if changed | Scanner/docs/context tests |
| T005 | R1, R3 | Low-Level Design | Hook docs if changed | Hook fixture tests |
| T006 | R2, R3, P1, P2, P3 | Operational Considerations | Runtime contracts if changed | Consistency and secret-path tests |
| T007 | R1, R2, R3 | Operational Considerations | Workspace safety contract, threat model | Markdown review |
| T008 | R1, R2, R3, P1, P2, P3 | All | Backlog EB033 remains separate | `pnpm typecheck`, targeted tests |

## Requirement To Delivery Matrix

| Requirement | Delivery Tasks | Validation |
| --- | --- | --- |
| R1 One path classifier | T001, T002, T003, T004, T005 | Classifier and consumer tests |
| R2 Secret-bearing paths are explicit | T002, T003, T006 | Secret-path fixtures |
| R3 Policy consistency tests | T004, T005, T006, T008 | Drift tests |

## Design To Implementation Matrix

| Design Area | Tasks | Notes |
| --- | --- | --- |
| Shared classifier | T002 | Keep compatibility shims where needed |
| Workspace safety migration | T003 | Write policy may be stricter, not looser |
| Scanner/routing migration | T004 | Preserve or explicitly tighten behavior |
| Hook alignment | T005 | Direct import or tested mirrored table |
| Durable docs | T007 | Threat model and safety contract must agree |

## Open Decision Impact

- Decide whether hook feedback imports a shared generated policy table or keeps
  a mirrored table with drift tests.
