---
title: Multi-file post-edit repair traceability
doc_type: spec
artifact_type: traceability
status: active
owner: platform
last_reviewed: 2026-06-13
---

# Traceability Matrix

## Purpose

Map Spec 020 implementation tasks to requirements, design sections,
verification evidence, durable destinations, and open decisions.

## Task To Context Matrix

| Task ID | Requirements | Acceptance Criteria | Design Sections | Verification | Durable Targets | Open Decisions |
| --- | --- | --- | --- | --- | --- | --- |
| T001 | Requirement 1, Requirement 2 | R1 AC1-3, R2 AC1-3 | Low-Level Design, Operational Considerations | Feedback and hook fixture tests | Tests and verification evidence | None |
| T002 | Requirement 1, Requirement 2 | R1 AC1-3, R2 AC2-3 | Low-Level Design, Resolved Decisions | Feedback use-case tests and typecheck | Runtime contracts, edit loop design | Persisted queue deferred |
| T003 | Requirement 2 | R2 AC1-3 | Low-Level Design, Operational Considerations | Feedback, hook, and Kiro integration tests | Coding-agent integration design | None |
| T004 | Requirement 1, Requirement 2 | R1 AC2-3, R2 AC2-3 | Resolved Decisions, Operational Considerations | Feedback, MCP telemetry, telemetry helper tests, typecheck | Observability behavior in edit loop and runtime contracts | None |
| T005 | All requirements | Success criteria and closure readiness | All sections | Full validation gates, spec lint, closure check | Durable docs, documentation map, closure readiness record | Final package removal waits for final spec commit |

## Requirement To Delivery Matrix

| Requirement | Delivered By | Evidence |
| --- | --- | --- |
| Requirement 1: Bounded Multi-File Feedback | T001, T002, T004 | Hook fixture tests for clean, too-many-files, large-file skipped, timeout, unavailable, and provider-failed paths; feedback tests for queued/skipped/unavailable/errored outcomes. |
| Requirement 2: Repair-Oriented Next Steps | T002, T003, T004 | Feedback presenter tests, Kiro hook adapter tests, and telemetry tests proving quiet deferred states with actionable-only visible messages. |

## Design To Implementation Matrix

| Design Section | Implementation | Evidence |
| --- | --- | --- |
| High-Level Design | Post-edit budget policy, multi-file diagnostic aggregation result, quiet hook presenter rules, and telemetry/logging for deferred reasons. | `src/contracts/runtime-validation-edit-contracts.ts`, `src/application/use-cases/build-post-edit-feedback.ts`, `plugins/agent-workbench/hooks/post-edit-feedback.js`, and telemetry instrumentation tests. |
| Low-Level Design | Structured post-edit result with checked files, outcome, findings, deferred checks, next actions, and optional visible message. | Feedback use-case tests and hook fixture tests. |
| Operational Considerations | Hooks remain non-blocking, command execution is limited to existing inline syntax checks, and hook output stays quiet for non-actionable states. | Kiro integration tests and post-edit hook fixture tests. |
| Resolved Decisions | Queued diagnostics are represented as structured deferred checks; telemetry records aggregate deferred reasons. | Runtime contracts docs and telemetry helper/MCP instrumentation tests. |

## Durable Promotion Matrix

| Durable Target | Promoted Content |
| --- | --- |
| `docs/design/edit-and-validation-loop-design.md` | Post-edit outcomes, deferred checks, budget handling, quiet hook behavior, and telemetry/logger observability. |
| `docs/design/coding-agent-integration-design.md` | Agent hook adapter boundary and deferred-check logging/telemetry guidance. |
| `docs/reference/runtime-contracts.md` | Post-edit outcome vocabulary and deferred-check shape. |
| `docs/reference/documentation-map.md` | Current durable owner for multi-file post-edit repair behavior. |

## Open Decision Impact

The only deferred decision is persisted background diagnostics pickup. It is
not implemented in this slice and does not block current repair feedback
because queued work is represented as explicit deferred evidence with follow-up
to `diagnostics_for_files` or `verification_plan`.
