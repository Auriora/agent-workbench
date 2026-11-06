---
title: MCP transport failure containment traceability
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

| Task ID | Requirements | Acceptance Criteria | Design Sections | Change Impact | Verification | Durable Targets | Open Decisions |
| --- | --- | --- | --- | --- | --- | --- | --- |
| T001 | Requirement 1 | AC1, AC2, AC3 | design.md#bridge-lifecycle-requirement-1 | none | verification.md V001 | docs/design/runtime-operations-design.md | none |
| T002 | Requirement 2, Requirement 3 | Requirement 2 AC1-AC4; Requirement 3 AC1-AC2 | design.md#input-framing-requirement-2; design.md#sending-requirement-3 | none | verification.md V002, V003, V004 | docs/reference/runtime-contracts.md | none |
| T003 | Requirement 4 | AC2, AC3 | design.md#deferred-work-requirement-4 | none | verification.md V005 | docs/backlog/README.md; docs/runbooks/codex-agent-workbench-plugin.md | none |
| T004 | Requirement 4 | AC1 | design.md#validation-and-promotion | none | verification.md V001-V005 | docs/design/runtime-operations-design.md; docs/reference/runtime-contracts.md | none |

## Requirement To Delivery Matrix

| Requirement | Priority | Acceptance Criteria | Design Sections | Tasks | Verification | Durable Targets | Coverage State | Residual Destination |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Requirement 1 | must-have | AC1-AC3 | Bridge lifecycle | T001 | V001 | runtime operations design | complete | none |
| Requirement 2 | must-have | AC1-AC4 | Input framing | T002 | V002, V004 | runtime contracts | complete | none |
| Requirement 3 | must-have | AC1-AC2 | Sending | T002 | V003 | runtime contracts | complete | none |
| Requirement 4 | must-have | AC1-AC3 | Deferred work; promotion | T003, T004 | V004, V005 | backlog; runbook | partial-blocking | T004: full-suite metadata failure in excluded release-note draft |

## Correctness Property Coverage

| Property | Requirements | Design Sections | Tasks | Tests Or Verification | Residual Risk |
| --- | --- | --- | --- | --- | --- |
| CP-001 | Requirement 1, Requirement 2 | Bridge lifecycle; input framing | T001, T002 | V001, V004 | Aggregate resource admission remains B006 |
| CP-002 | Requirement 3 | Sending | T002 | V003 | none |
| CP-003 | Requirement 2 | Input framing | T002 | V002 | none |
| CP-004 | Requirement 1 | Bridge lifecycle | T001 | V001 | Pending-write guards can outlive a completed session until the caller stream settles |

## Finding disposition

| Static finding | Owner | Disposition |
| --- | --- | --- |
| Unhandled bridge stdout EPIPE | T001 | Implemented in source; targeted regressions pass |
| Unbounded socket input | T002 | Implemented in source; targeted regressions pass |
| Backpressured send remains pending | T002 | Implemented in source; targeted regressions pass |
| Daemon lifetime diagnostic loss | Backlog B001 | Accepted P0 follow-up |
| One-second termination can interrupt refresh | Backlog B002 | Accepted P0 follow-up |
| Endpoint location/cleanup | Existing Spec 065 | Preserve separate ownership |
| MoE W1: aggregate resource admission | Backlog B006 | Accepted P1; assess before release |

## Design To Implementation Matrix

| Design Section | Requirements | Tasks | Interfaces Or Files | Verification |
| --- | --- | --- | --- | --- |
| Bridge lifecycle | Requirement 1 | T001 | src/mcp/stdio-launch.ts | V001 |
| Input framing | Requirement 2 | T002 | socket-transport.ts; daemon.ts readHandshake | V002, V004 |
| Sending | Requirement 3 | T002 | src/mcp/socket-transport.ts | V003 |
| Deferred work; promotion | Requirement 4 | T003, T004 | backlog and durable owners | V004, V005 |

## Open Decision Impact

None block T001-T004. B001/B002 own subsequent lifetime evidence and shutdown
decisions. Existing Spec 065 retains endpoint policy decisions.
