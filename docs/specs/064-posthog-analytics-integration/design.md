---
title: PostHog analytics integration design
doc_type: spec
artifact_type: design
status: active
owner: platform
last_reviewed: 2026-08-15
---

# Technical Design

## Overview

The TypeScript runtime remains the only analytics producer. Existing MCP and
runtime instrumentation records through `TelemetryRecorderPort`. Official
release builds inject a PostHog project token into generated runtime bundles and
select privacy-bounded analytics by default. Source and development builds have
no injected token and remain disabled. Operators can disable analytics with
`AGENT_WORKBENCH_ANALYTICS_ENABLED=false`.

The PostHog adapter is a privacy boundary, not a generic exporter. It accepts
the recorder interface but creates each outbound event from fixed event-name and
property allowlists. Unknown keys and non-scalar values are dropped. Error
objects are classified locally into a small category enum. Error Tracking
receives a newly constructed stackless synthetic error plus sanitized aggregate
properties; raw messages, original exceptions, paths, source, and stacks never
reach the SDK.

## Requirement Coverage

| Requirement | Acceptance Criteria | Design Coverage | Validation Approach |
|---|---|---|---|
| REQ-001 | AC1-AC4 | separate analytics config and explicit consent gate | configuration tests |
| REQ-002 | AC1-AC4 | existing recorder boundary plus PostHog adapter | MCP instrumentation and adapter tests |
| REQ-003 | AC1-AC4 | outbound event/property allowlists and local error classification | adversarial payload tests |
| REQ-004 | AC1-AC4 | composite adapter, daemon ownership, bounded shutdown, package metadata | lifecycle, package, and lock checks |
| REQ-005 | AC1-AC5 | separate opt-in OTLP Logs provider with fixed bodies and attribute allowlist | config, exporter, privacy, and lifecycle tests |

## Correctness Property Coverage

| Property | Design Behavior | Validation Direction | Notes |
|---|---|---|---|
| CP-001 | consent is checked before client construction | constructor spy tests | credentials alone are insufficient |
| CP-002 | sanitizer returns bounded scalar-only records | table-driven tests | nested values are dropped |
| CP-003 | sensitive inputs are absent from serialized captures | sentinel regression tests | includes errors and arbitrary properties |
| CP-004 | daemon constructs and disposes shared telemetry once | daemon lifecycle test | standalone injection remains supported |
| CP-005 | composite recorder isolates adapter failures | throwing-adapter tests | no fallback or retry path |
| CP-006 | logs use independent enablement and reconstruct fixed-body records | disabled-constructor and no-network exporter tests | trace configuration is invariant |

## High-Level Design

The daemon composition root creates one runtime telemetry adapter and injects it
into every connection-scoped server. That adapter independently composes the
existing OTEL destination with PostHog when the resolved runtime/distribution
configuration is valid. Runtime environment values take precedence over
build-injected defaults, including the explicit `false` opt-out. MCP
instrumentation emits aggregate recorder events without knowing which
destinations are active.

## Components and Changes

- `src/infrastructure/telemetry/`: PostHog config, sanitization, adapter,
  composite recorder, and lifecycle ownership.
- `src/interface-adapters/mcp/instrumentation.ts`: retain aggregate collection,
  but stop recording repository roots and resource URIs at the shared source.
- `src/server.ts` and `src/mcp/daemon.ts`: accept and share injected telemetry;
  the owner performs shutdown once.
- `scripts/build-runtime.mjs` and release workflows: validate and inject the
  distribution analytics defaults into generated bundles without recording the
  token in build receipts.
- `package.json`, `pnpm-lock.yaml`, and the distribution manifest: declare and
  package `posthog-node`.
- `src/infrastructure/telemetry/posthog-logs.ts`: resolve separate logs
  enablement, select actionable aggregate records, rebuild their fixed-body
  OTLP shape, and own one logs provider lifecycle.
- `tests/telemetry/` and MCP/daemon tests: prove privacy and lifecycle behavior.
- `docs/design/observability-debugging-design.md`: own current PostHog config,
  payload, privacy, and operational behavior.

## Data Flow

```text
MCP/resource/runtime boundary
  -> TelemetryRecorderPort.record / recordError
  -> CompositeTelemetryAdapter
       -> existing OTEL adapter (existing opt-in policy)
       -> PostHogTelemetryAdapter (separate explicit consent)
            -> event-name allowlist
            -> property allowlist + scalar bounds
            -> local error category
            -> normal capture or synthetic stackless captureException
            -> posthog-node with ephemeral distinct id
               and $process_person_profile=false
       -> PostHogLogsTelemetryAdapter (separate explicit logs opt-in)
            -> actionable event/outcome selector
            -> fixed WARN/ERROR body + bounded scalar attribute allowlist
            -> OTLP HTTP Logs exporter at the approved EU endpoint
```

## Low-Level Design

The PostHog module resolves explicit runtime enablement first, then runtime
credentials, then build-injected distribution defaults. Explicit `false` always
disables analytics. It constructs no client unless the configuration status is
`ready` and exposes a token-free local status receipt. Its primary sanitizer and SDK `before_send` callback both
rebuild events from exact event/property sets, enforce bounded scalar types,
bucket duration, and force person processing off. `recordError` inspects only
the local error class, never its message or stack, then creates a fixed-message,
stackless synthetic error for PostHog Error Tracking. The SDK `before_send`
boundary rebuilds the resulting `$exception` event from a dedicated nested
allowlist. Adapter shutdown is idempotent and bounded; composition contains
each destination's failures.

### Interfaces

```text
PostHogAnalyticsConfig {
  enabled: boolean
  status: disabled | ready | missing_configuration | invalid_host
  projectToken?: string
  host?: approved EU ingestion URL
}

createRuntimeTelemetryAdapter(options): TelemetryRecorderPort + local configuration evidence
sanitizePostHogEvent(name, properties): SanitizedEvent | undefined
```

The SDK client is hidden behind a narrow internal capture interface so unit
tests do not perform network access and the infrastructure module remains the
only vendor-specific implementation location.

The logs module uses an independent OpenTelemetry `LoggerProvider`,
`BatchLogRecordProcessor`, and OTLP HTTP log exporter. It implements the same
recorder port only to consume existing aggregate records; `recordError` is a
no-op so Error Tracking remains the sole exception destination. The first
slice selects blocked, degraded, failed, missing, or error outcomes from
`mcp.tool.dispatch`, `mcp.resource.dispatch`, and `runtime.boundary`, maps them
to fixed operational bodies and WARN/ERROR severity, then copies only the
existing bounded analytics scalar allowlist. It never forwards a caller body.

## Error Handling

- Configuration absence or invalidity selects no PostHog adapter.
- `record` and `recordError` never throw into the caller.
- PostHog SDK errors are contained in the PostHog adapter. They are not sent to
  OTEL as raw messages and do not activate another analytics route.
- Flush and shutdown use the SDK lifecycle once at the owning runtime boundary;
  failures are contained after the bounded attempt.
- OTLP Logs export, flush, and shutdown failures are contained in the logs
  adapter and are never retried through analytics, traces, or another exporter.

## Security, Trust, and Access

- `.env` is local secret material and is ignored; `.env.example` contains names
  and non-secret placeholders only.
- Only the approved HTTPS EU ingestion host is accepted in this slice.
- The project token is configuration, never an event property.
- Exception autocapture and passing original throwables to `captureException`
  are prohibited. Only the adapter-created stackless synthetic error may use
  the SDK exception route.
- No stable machine, repository, user, account, or installation identifier is
  created. The runtime identifier is random and process-lifetime only.
- Log bodies are fixed enum values and log attributes are reconstructed from
  the aggregate allowlist; raw exception and text-bearing recorder inputs are
  never passed to the OTLP logs API.

## Migration and Compatibility

The wizard's Python module, imports, capture calls, and dependencies are
removed. Existing OTEL variables and destinations retain their behavior.
PostHog is additive, enabled by default only in official configured release
artifacts, and explicitly disableable at runtime. MCP contracts do not change.
PostHog Logs is additive but remains separately opt-in. Enabling it does not
enable or retarget the disabled-by-default Jaeger/OTLP trace path.

## Slice Boundary And Residual Architecture

| Design target | In this slice | Out of this slice | Follow-up destination | Blocks closure? |
|---|---|---|---|---|
| product analytics | aggregate MCP/runtime dogfood events | CLI analytics, retention funnels, user identity | future evidence-backed spec | no |
| error analytics | sanitized category plus synthetic Error Tracking event | original exceptions, messages, stacks, source | none; explicitly rejected | no |
| identity | ephemeral runtime id | stable install or user id | future privacy decision | no |
| destinations | PostHog EU plus existing independent OTEL | arbitrary PostHog/self-hosted hosts | future configuration design | no |
| operational logs | fixed-body WARN/ERROR summaries for actionable aggregate outcomes | stdout/stderr forwarding, DEBUG/INFO streams, raw exceptions | future evidence-backed expansion | no |

## Operational Considerations

- Official release jobs must provide the distribution project token; packaging
  fails if analytics is selected without it.
- Operators can set `AGENT_WORKBENCH_ANALYTICS_ENABLED=false` before launch to
  suppress client construction and all analytics network activity.
- Dashboard verification is external evidence and does not replace local
  payload-contract tests.
- Changing the allowlist is a privacy-sensitive contract change requiring tests
  and review.
- Operators opt in to logs with `AGENT_WORKBENCH_POSTHOG_LOGS_ENABLED=true`;
  the existing analytics opt-out overrides and disables both PostHog paths.

## Open Questions

None blocking. The user selected explicit dogfood analytics, personless events,
and sanitization instead of exception autocapture.
