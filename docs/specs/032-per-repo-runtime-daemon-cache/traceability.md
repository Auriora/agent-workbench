---
title: Per-repo runtime daemon and shared cache traceability
doc_type: spec
artifact_type: traceability
status: active
owner: platform
last_reviewed: 2026-06-18
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Traceability

## Task To Context Matrix

| Task | Requirements | Design Sections | Durable Targets | Verification |
| --- | --- | --- | --- | --- |
| T001 | R1, R2, R3, R4 | Socket And Identity, Request Routing | Runtime operations design | Design review |
| T002 | R1, R3, P3, P4 | High-Level Design, Socket And Identity | MCP surface design | Client launcher tests |
| T003 | R1, R2, P1, P4 | Graph Store Ownership | Graph store design, runtime operations design | Graph ownership tests |
| T004 | R2, P1, P2 | Graph Store Ownership | Runtime operations design | Concurrent read/write tests |
| T005 | R4 | Doctor State | Runtime operations design, dev CLI spec if needed | Doctor/debug tests |
| T006 | R1, R2, R3, R4, P1, P2, P3, P4 | All | Runtime contracts if changed | MCP integration tests |
| T007 | R2, P1, P2 | Operational Considerations | Dogfood evidence destination | Multi-client warmed sweep |
| T008 | R1, R2, R3, R4 | All | Runtime operations, MCP surface, backlog EB036 | `pnpm typecheck`, targeted tests, dogfood evidence |

## Requirement To Delivery Matrix

| Requirement | Delivery Tasks | Validation |
| --- | --- | --- |
| R1 One daemon per repo | T001, T002, T006 | Multi-client and second-repo tests |
| R2 Shared cache writes are serialized | T003, T004, T006, T007 | Concurrent read/write tests and dogfood sweep |
| R3 Daemon lifecycle tracks clients | T002, T006 | Idle grace and crash/restart tests |
| R4 Debug and doctor visibility | T005, T008 | Doctor/debug tests and docs review |

## Design To Implementation Matrix

| Design Area | Tasks | Notes |
| --- | --- | --- |
| Socket and identity | T001, T002, T006 | Must stay repo-scoped |
| Request routing | T002, T003 | Spec 029 owns root override policy |
| Graph store ownership | T003, T004 | One writer per repo |
| Doctor state | T005 | Keep normal agent output compact |
| Durable docs | T008 | EB036 marked promoted on closure |

## Open Decision Impact

- Choose local IPC implementation details per platform.
- Decide whether doctor/debug surface lands in the runtime first or the dev CLI
  when Spec 028 is ready.
