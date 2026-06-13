---
title: Spec task traceability lookup traceability
doc_type: spec
artifact_type: traceability
status: active
owner: platform
last_reviewed: 2026-06-13
---

# Traceability Matrix

## Purpose

Map spec-task routing requirements to design, implementation tasks,
verification evidence, durable-doc targets, and open decisions. This package
defines a companion-runtime bridge: spec-lifecycle-manager owns lifecycle
semantics, while Agent Workbench owns repo-evidence routing.

## Task To Context Matrix

| Task ID | Requirements | Acceptance Criteria | Design Sections | Change Impact | Verification | Durable Targets | Open Decisions |
| --- | --- | --- | --- | --- | --- | --- | --- |
| T001 | Requirement 1, Requirement 3 | R1 AC1-AC6, R3 AC1-AC3 | Overview, High-Level Design, Low-Level Design, Operational Considerations | None | Boundary review, spec lifecycle lint | `docs/design/mcp-surface-design.md`, `docs/design/coding-agent-integration-design.md` | Companion callability discovery mechanism |
| T002 | Requirement 1, Requirement 2, Requirement 3 | R1 AC2-AC5, R2 AC1-AC5, R3 AC1-R3 AC2 | High-Level Design, Low-Level Design | None | Fixture coverage for active, archived, malformed, traceability-rich, available, unavailable, unknown, and caller-supplied lifecycle context states | Fixture docs under `tests/fixtures/` | Exact fixture shape |
| T003 | Requirement 1, Requirement 2 | R1 AC1-R1 AC6, R2 AC1-R2 AC5 | Low-Level Design | None | Focused docs/task-context tests | `src/application/`, `src/infrastructure/markdown/`, `src/contracts/` | Local reader extraction scope |
| T004 | Requirement 1, Requirement 2, Requirement 3 | R1 AC1-R1 AC6, R2 AC1-R2 AC5, R3 AC1-R3 AC3 | High-Level Design, Low-Level Design, Operational Considerations | None | MCP and presenter golden responses | `src/application/use-cases/get-task-context.ts`, `src/interface-adapters/mcp/`, `src/presentation/` | Whether Workbench brokers lifecycle calls or only routes |
| T005 | Requirement 3 | R3 AC1-R3 AC3 | Operational Considerations | None | `pnpm typecheck`, focused tests, `pnpm test`, `git diff --check`, spec lifecycle scan | `docs/design/mcp-surface-design.md`, `docs/design/coding-agent-integration-design.md`, packaged skill and Power guidance, documentation map | Closure readiness |

## Requirement To Delivery Matrix

| Requirement | Acceptance Criteria | Design Sections | Tasks | Verification | Durable Targets |
| --- | --- | --- | --- | --- | --- |
| Requirement 1: Lifecycle Tool Handoff | AC1-AC6 | Overview, High-Level Design, Low-Level Design | T001, T002, T003, T004 | Companion available/unavailable/unknown fixtures, task-context tests, MCP golden responses | MCP surface design, coding-agent integration design |
| Requirement 2: Task Context Integration | AC1-AC5 | High-Level Design, Low-Level Design | T002, T003, T004 | Spec/task prompt tests, validation-plan join tests, missing-evidence tests | MCP surface design |
| Requirement 3: Integration Boundary Visibility | AC1-AC3 | Operational Considerations | T001, T002, T004, T005 | Integration health/profile tests, skill/Power guidance review | Coding-agent integration design, packaged skill and Power guidance |

## Design To Implementation Matrix

| Design Section | Requirements | Tasks | Interfaces Or Files | Verification |
| --- | --- | --- | --- | --- |
| Overview | Requirement 1, Requirement 3 | T001 | `docs/specs/021-spec-task-traceability-lookup/design.md` | Boundary review |
| High-Level Design | Requirement 1, Requirement 2 | T001, T002, T004 | `context_for_task`, companion integration metadata, lifecycle context bridge | Fixture and golden task-context tests |
| Low-Level Design | Requirement 1, Requirement 2 | T002, T003, T004 | `src/application/use-cases/get-task-context.ts`, local Markdown routing reader, presenters | Docs/task-context/MCP tests |
| Operational Considerations | Requirement 3 | T001, T005 | `docs/design/mcp-surface-design.md`, `docs/design/coding-agent-integration-design.md`, packaged skill/Power docs | Durable-doc review, spec lifecycle scan |

## Open Decision Impact

| Decision ID | Blocks | Affected Requirements | Affected Tasks | Resolution Needed |
| --- | --- | --- | --- | --- |
| D001 | Implementation details for companion callability | Requirement 1, Requirement 3 | T001, T004 | Decide whether Agent Workbench brokers lifecycle MCP calls or only reports companion next actions. |
| D002 | Fixture shape for caller-supplied lifecycle context | Requirement 1, Requirement 2 | T002, T003, T004 | Define the test payload shape for preflight, task detail, validation plan, evidence quality, task-state audit, and closure-risk context. |

## Maintenance Notes

- Update this matrix when requirements, task IDs, lifecycle context outputs, or
  durable-doc targets change.
- Keep lifecycle evidence and repository evidence separate. Task-state,
  evidence-quality, and closure-risk outputs are routing inputs, not Agent
  Workbench-owned lifecycle decisions.
