---
title: Repo-root authority traceability
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
| T001 | Requirement 1, Requirement 2 | Root Authority Policy | Workspace safety contract, MCP surface design | Policy unit tests |
| T002 | Requirement 2, Requirement 3 | Debug Gate | MCP surface design, threat model | Env/flag tests |
| T003 | Requirement 1, Requirement 2 | Root Authority Policy, Low-Level Design | Workspace safety contract | MCP request tests |
| T004 | Requirement 2, Requirement 3 | Metadata Filtering | Integration docs and profiles | Schema/profile tests |
| T005 | Requirement 1, Requirement 2, Requirement 3, P1, P2, P3 | All | Runtime contracts if changed | Contract and MCP tests |
| T006 | Requirement 1, Requirement 2, Requirement 3 | Operational Considerations | Workspace safety contract, MCP surface design, threat model | Markdown review |
| T007 | Requirement 1, Requirement 2, Requirement 3, P1, P2, P3 | All | Closure docs/backlog route | `pnpm typecheck`, targeted MCP tests |

## Requirement To Delivery Matrix

| Requirement | Delivery Tasks | Validation |
| --- | --- | --- |
| R1 Normal surfaces use the launch root | T001, T003, T005 | MCP request tests |
| R2 Debug root override is explicit and hidden | T001, T002, T004, T005 | Debug gate and schema tests |
| R3 Debug override scope is this project only | T004, T006 | Integration guidance tests and docs review |

## Design To Implementation Matrix

| Design Area | Tasks | Notes |
| --- | --- | --- |
| Root authority policy | T001, T003 | Must precede registry metadata changes |
| Metadata filtering | T004 | Prevents normal agent leakage |
| Debug gate | T002 | Use one env var or hidden flag |
| Operational docs | T006, T007 | Promote current accepted behavior before closure |

## Open Decision Impact

- Choose one debug gate name. Proposed default:
  `AGENT_WORKBENCH_DEBUG_REPO_ROOT_OVERRIDE=1`.
- Decide whether debug mode allows any accessible root or an explicit allowlist.
