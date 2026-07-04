---
title: MCP error envelope consistency traceability
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
| T001 | R1, R2 | Migration Plan | Runtime contracts, MCP surface design | Inventory review |
| T002 | R1, R2, P1, P2, P3 | Handler Helper, Error Classification | Runtime contracts | Wrapper unit tests |
| T003 | R1, R2 | Migration Plan | MCP surface design | Representative MCP tests |
| T004 | R3, P1, P2, P3 | Error Classification | Runtime contracts | Registry consistency tests |
| T005 | R1, R2, R3 | Operational Considerations | Runtime contracts, MCP surface design | Markdown review |
| T006 | R1, R2, R3, P1, P2, P3 | All | Backlog for remaining registries | `pnpm typecheck`, targeted MCP tests |

## Requirement To Delivery Matrix

| Requirement | Delivery Tasks | Validation |
| --- | --- | --- |
| R1 Shared handler wrapper | T001, T002, T003 | Wrapper and representative MCP tests |
| R2 Failure classes stay distinct | T002, T003, T004 | Golden failure tests |
| R3 Tests cover registry consistency | T004, T006 | Registry consistency test suite |

## Design To Implementation Matrix

| Design Area | Tasks | Notes |
| --- | --- | --- |
| Handler helper | T002, T003 | Preserve tool-specific presenters |
| Error classification | T002, T004 | Avoid class collapse into invalid input |
| Migration plan | T001, T003, T006 | Migrate representative tools first |
| Operational docs | T005 | Promote before closure |

## Open Decision Impact

- Decide whether new public failure classes require contract enum migration or
  can map onto existing validity and verification metadata.
