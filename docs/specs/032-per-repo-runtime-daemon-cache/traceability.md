---
title: Per-repo runtime daemon and shared cache traceability
doc_type: spec
artifact_type: traceability
status: active
owner: platform
last_reviewed: 2026-07-05
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Traceability

## Task To Context Matrix

| Task | Requirements | Design Sections | Durable Targets | Verification |
| --- | --- | --- | --- | --- |
| T001 | Requirement 1, Requirement 2, Requirement 3, Requirement 4 | Socket And Identity, Request Routing | Runtime operations design | Design review |
| T002 | Requirement 1, Requirement 3, P1, P3, P4 | High-Level Design, Socket And Identity | MCP surface design | Client launcher tests, POSIX permission tests |
| T003 | Requirement 1, Requirement 2, P1, P4 | Graph Store Ownership | Graph store design, runtime operations design | Graph ownership tests |
| T004 | Requirement 2, P1, P2 | Graph Store Ownership | Runtime operations design | Concurrent read/write tests |
| T005 | Requirement 4 | Doctor State | Runtime operations design, dev CLI spec if needed | Doctor/debug tests |
| T006 | Requirement 1, Requirement 2, Requirement 3, Requirement 4, P1, P2, P3, P4 | All | Runtime contracts if changed | MCP integration tests |
| T007 | Requirement 2, P1, P2 | Operational Considerations | Dogfood evidence destination | Multi-client warmed sweep |
| T008 | Requirement 1, Requirement 2, Requirement 3, Requirement 4 | All | Runtime operations, MCP surface, backlog EB036 | `pnpm typecheck`, targeted tests, dogfood evidence |

## Requirement To Delivery Matrix

| Requirement | Delivery Tasks | Validation |
| --- | --- | --- |
| Requirement 1 (R1) One daemon per repo | T001, T002, T006 | Parallel cold-start, multi-client, and second-repo tests |
| Requirement 2 (R2) Shared cache writes are serialized | T003, T004, T006, T007 | Concurrent read/write tests and dogfood sweep |
| Requirement 3 (R3) Daemon lifecycle tracks clients | T002, T006 | Idle grace and crash/restart tests |
| Requirement 4 (R4) Debug and doctor visibility | T005, T008 | Doctor/debug tests and docs review |

## Design To Implementation Matrix

| Design Area | Tasks | Notes |
| --- | --- | --- |
| Socket and identity | T001, T002, T006 | Must stay repo-scoped and owner-only on POSIX |
| Request routing | T002, T003 | Spec 029 owns root override policy |
| Graph store ownership | T003, T004 | One daemon starter and one writer per repo |
| Doctor state | T005 | Keep normal agent output compact |
| Durable docs | T008 | EB036 marked promoted on closure |

## Open Decision Impact

- Local IPC implementation is resolved: Node `net` local IPC, using Unix domain
  sockets on POSIX and named pipes on Windows.
- Doctor/debug destination is resolved: daemon diagnostics ship through MCP
  integration health; no dev CLI doctor command shipped in Spec 032.
