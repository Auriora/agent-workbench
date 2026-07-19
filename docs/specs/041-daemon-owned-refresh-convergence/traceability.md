---
title: Daemon-owned refresh convergence traceability
doc_type: spec
artifact_type: traceability
status: draft
owner: platform
last_reviewed: 2026-07-19
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Traceability

## Requirement To Delivery Matrix

Requirement delivery coverage below records whether the planned design, tasks,
verification, and durable destinations are complete enough to implement. It is
not implementation evidence. The implementation matrices remain
`not-covered` until code and executed validation exist.

| Requirement | Priority | Acceptance Criteria | Design Sections | Tasks | Verification | Durable Targets | Coverage State | Residual Destination |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Requirement 1 | must-have | AC1.1-AC1.4 | Daemon-Scoped Refresh Controller; Connection Composition | T001-T004 | V001-V003 | runtime operations design; runtime requirements | complete | none |
| Requirement 2 | must-have | AC2.1-AC2.4 | Connection Composition; Lifetime And Disconnects | T001, T003, T006 | V002, V004 | runtime operations design; MVP proof matrix | complete | none |
| Requirement 3 | must-have | AC3.1-AC3.4 | Authoritative Diagnostics | T001, T005, T006 | V005-V006 | runtime contracts; MCP surface design | complete | none |
| Requirement 4 | must-have | AC4.1-AC4.4 | Snapshot Publication; Failure Behavior | T001, T002, T006 | V007-V009 | graph store design; MVP proof matrix | complete | none |
| Requirement 5 | must-have | AC5.1-AC5.4 | Failure Behavior; Lifetime And Disconnects | T001-T003, T005-T006 | V003-V005, V010 | runtime operations design; runtime contracts | complete | none |
| Requirement 6 | must-have | AC6.1-AC6.4 | Connection Composition; Resolved Decisions | T001-T007 | V011-V018 | runtime requirements; backlog/changelog/history | complete | none |

## Correctness-Property Coverage

| Property | Design mechanism | Tasks | Verification | Coverage |
| --- | --- | --- | --- | --- |
| CP-001 | shared controller idempotence | T001-T003 | V001-V003 | not-covered |
| CP-002 | daemon-scoped observable lifecycle | T001, T003, T006 | V002, V004 | not-covered |
| CP-003 | controller lifetime independent of socket | T001, T003, T006 | V004 | not-covered |
| CP-004 | existing atomic worker publication | T002, T006 | V007-V009 | not-covered |
| CP-005 | awaited canonical diagnostics | T001, T005-T006 | V005-V006 | not-covered |
| CP-006 | terminal structured failure, no fallback | T001-T002, T005-T006 | V003, V010-V011 | not-covered |

## Task To Context Matrix

| Task ID | Requirements | Acceptance Criteria | Design Sections | Change Impact | Verification | Durable Targets | Open Decisions |
| --- | --- | --- | --- | --- | --- | --- | --- |
| T001 | Requirement 1; Requirement 2; Requirement 3; Requirement 4; Requirement 5; Requirement 6 | all | Confirmed Root Cause; Daemon-Scoped Refresh Controller; Authoritative Diagnostics | Code And Contract Impact | V001-V011 | runtime operations design; runtime contracts | none; D001-D005 resolved |
| T002 | Requirement 1; Requirement 5; Requirement 6 | AC1.1-AC1.4; AC5.1-AC5.4; AC6.2-AC6.4 | Daemon-Scoped Refresh Controller; Failure Behavior | runtime coordination; graph publication | V001, V003, V008, V010-V011 | runtime operations design; graph store design | none |
| T003 | Requirement 1; Requirement 2; Requirement 6 | AC1.1-AC1.3; AC2.1-AC2.4; AC6.1-AC6.4 | Connection Composition; Lifetime And Disconnects | daemon composition; server composition | V002-V004, V011 | runtime operations design; runtime requirements | none |
| T004 | Requirement 1; Requirement 2; Requirement 5 | AC1.4; AC2.1-AC2.2; AC5.2 | Data Flow; Failure Behavior | watcher/first read | V002-V003, V007 | runtime operations design; MCP surface design | none |
| T005 | Requirement 3; Requirement 5 | AC3.1-AC3.4; AC5.1 | Authoritative Diagnostics; Resolved Decisions | integration health | V005-V006, V010 | runtime contracts; MCP surface design | none |
| T006 | Requirement 2; Requirement 4; Requirement 5 | AC2.1-AC2.4; AC4.1-AC4.4; AC5.1-AC5.4 | Snapshot Publication; Lifetime And Disconnects; Failure Behavior | daemon composition; graph publication; packaging | V002-V011 | graph store design; MVP proof matrix | none |
| T007 | Requirement 1; Requirement 2; Requirement 3; Requirement 4; Requirement 5; Requirement 6 | all | Durable Promotion Targets | Promotion Targets; Out-Of-Scope Destinations | V012-V018 and completed focused evidence | all named durable owners | none |

## Design To Implementation Matrix

| Design target | Likely implementation | Tasks | Coverage |
| --- | --- | --- | --- |
| daemon-scoped controller | daemon, server, runtime/port modules | T002-T003 | not-covered |
| shared invalidation request | server and workspace queue use case | T004 | not-covered |
| authoritative diagnostics | daemon, contracts, health use case/presenter | T005 | not-covered |
| atomic publication and query recovery | index use case, graph store selection, existing worker, and public query tests | T002, T006 | not-covered |
| durable promotion | canonical targets in design | T007 | not-covered |

## Open Decision Impact

No open product or architecture decision remains. D001-D005 in `design.md` are
resolved constraints; implementation naming cannot weaken them.

## Task Dependencies

```text
T001 -> T002 -> T003 -> T004
                  |       |
                  -> T005 -> T006 -> T007
```

## Promotion Trace

T007 must reconcile every row above, record exact evidence in
`verification.md`, promote lasting behavior to the named durable targets, and
leave no `not-covered` row before closure.
