---
title: PostHog analytics integration traceability
doc_type: spec
artifact_type: traceability
status: active
owner: platform
last_reviewed: 2026-08-15
---

# Traceability Matrix

## Task To Context Matrix

| Task ID | Requirements | Acceptance Criteria | Design Sections | Change Impact | Verification | Durable Targets |
|---|---|---|---|---|---|---|
| T001 | REQ-001 to REQ-004 | all | Overview, Security, Lifecycle | all | spec readiness | observability and architecture docs |
| T002 | REQ-001 to REQ-004 | REQ-001 AC1-AC4; REQ-002 AC4; REQ-004 AC4 | Migration, Security | CLI removal and secret protection | dev CLI tests and uv lock check | none |
| T003 | REQ-001 to REQ-004 | all runtime criteria | Components, Data Flow, Interfaces, Error Handling | runtime adapter | telemetry/MCP/daemon tests | observability and architecture docs |
| T004 | all | all | all | promotion targets | full gates and expert review | observability and architecture docs |
| T005 | REQ-001, REQ-003, REQ-004 | distribution defaults, opt-out, release failure, synthetic exception routing | Migration, Security, Error Handling, Operational Considerations | distribution and exception configuration | config, exception privacy, build, workflow, package, and regression tests | observability design and install runbook |
| T006 | REQ-005 | AC1-AC5; CP-002, CP-003, CP-005, CP-006 | Components, Data Flow, Interfaces, Security, Operations | opt-in operational logs | config, no-network OTLP payload, privacy, lifecycle, package, and full regression tests | observability design, layered architecture, README, and install runbook |

## Requirement To Delivery Matrix

| Requirement | Priority | Tasks | Verification | Durable Targets | Coverage State | Residual Destination |
|---|---|---|---|---|---|---|
| REQ-001 | must-have | T002-T005 | config, local evidence, distribution-default, and opt-out tests | observability design | complete | none |
| REQ-002 | must-have | T003-T004 | MCP capture tests | observability design | complete | none |
| REQ-003 | must-have | T003-T005 | adversarial sanitizer, synthetic exception invariance tests, and security review | observability design | complete | none |
| REQ-004 | must-have | T002-T005 | daemon lifecycle, build injection, package, lock, and regression gates | layered architecture and install runbook | complete | none |
| REQ-005 | must-have | T006 | focused logs/privacy/lifecycle tests, build/package/docs validation, and live PostHog logs receipt | observability design, layered architecture, README, and install runbook | complete | none |

## Design To Implementation Matrix

| Design element | Implementation | Verification | Requirements |
|---|---|---|---|
| Explicit consent and local configuration receipt | `src/infrastructure/telemetry/posthog.ts`, `src/infrastructure/telemetry/index.ts` | `tests/telemetry/posthog.test.ts` | REQ-001 |
| Exact outbound privacy allowlist and error classification | `src/infrastructure/telemetry/posthog.ts` | adversarial and error-invariance tests | REQ-002, REQ-003 |
| Aggregate MCP producer | `src/interface-adapters/mcp/instrumentation.ts` | `tests/mcp/telemetry-instrumentation.test.ts` | REQ-002, REQ-003 |
| Shared daemon lifecycle and standalone ownership | `src/mcp/daemon.ts`, `src/server.ts` | daemon lifecycle test and full regression suite | REQ-004 |
| Distribution | `package.json`, `pnpm-lock.yaml`, package manifest | build receipt, plugin validation, package dry run | REQ-004 |
| Separate PostHog OTLP Logs adapter | `src/infrastructure/telemetry/posthog-logs.ts`, runtime composition | config, payload privacy, no-network transport, lifecycle, and package tests | REQ-005 |

## Correctness Property Coverage

| Property | Requirements | Tasks | Tests Or Verification | Residual Risk |
|---|---|---|---|---|
| CP-001 | REQ-001 | T003 | configuration constructor-spy tests | none identified |
| CP-002 | REQ-003 | T003 | exact-key allowlist tests | none identified |
| CP-003 | REQ-003 | T003, T005 | sensitive sentinel, synthetic exception reconstruction, and error-invariance tests | none identified |
| CP-004 | REQ-004 | T003 | shared daemon lifecycle and idempotent shutdown test | none identified |
| CP-005 | REQ-004 | T003 | throwing-adapter tests | none identified |
| CP-006 | REQ-005 | T006 | disabled-constructor, payload invariance, recordError exclusion, trace-config independence, and live receipt tests | none identified |

## Open Decision Impact

| Decision ID | Blocks | Affected Requirements | Affected Tasks | Resolution Needed |
|---|---|---|---|---|
| none | none | none | none | User resolved scope, privacy, migration, and implementation direction. |
