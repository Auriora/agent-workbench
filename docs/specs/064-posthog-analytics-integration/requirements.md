---
title: PostHog analytics integration requirements
doc_type: spec
artifact_type: requirements
status: active
owner: platform
last_reviewed: 2026-08-15
---

# Requirements

## Introduction

Agent Workbench already emits optional aggregate operational telemetry through
`TelemetryRecorderPort`, but it has no supported PostHog destination. A PostHog
wizard added a second, Python developer-CLI analytics path with direct capture
calls and global exception autocapture. This slice removes that path and adds
one explicit, privacy-bounded PostHog adapter to the TypeScript runtime.

## Goals

- Measure dogfood MCP surface usage, outcomes, degraded states, and latency.
- Enable privacy-bounded analytics in official distributed artifacts while
  keeping source/development builds disabled and providing an explicit runtime
  opt-out.
- Enforce one outbound allowlist that applies to normal and failure events.
- Preserve existing OpenTelemetry behavior and MCP response contracts.
- Add a separately enabled, privacy-bounded PostHog OTLP Logs path for
  actionable operational summaries without rerouting traces.
- Make analytics failure unable to block or alter a tool invocation.

## Non-Goals

- User identification, person profiles, stable installation identifiers,
  session replay, feature flags, or cross-session retention.
- Developer-CLI command analytics, hook-specific analytics, source capture,
  prompt or task capture, repository identification, or automatic/raw exception
  reporting.
- A primary-plus-fallback exporter route or durable local usage database.
- Bulk stdout/stderr forwarding, debug logs, raw exception logs, or replacing
  the existing optional OTEL trace exporter with a logs endpoint.

## Durable Source Baseline

| Source | Current behavior relied on | Confidence | Notes |
|---|---|---|---|
| `docs/design/observability-debugging-design.md` | Telemetry is disabled by default, environment configured, aggregate-first, and must not change MCP responses. | high | Canonical observability owner. |
| `docs/design/layered-runtime-architecture.md` | MCP instrumentation uses `TelemetryRecorderPort`; concrete adapters live under infrastructure. | high | Canonical layering owner. |
| `src/interface-adapters/mcp/instrumentation.ts` | MCP dispatch already produces aggregate operational attributes. | high | Must remove path and raw-error fields before PostHog export. |
| `src/infrastructure/telemetry/index.ts` | No-op, in-memory, and OTEL adapters implement the shared port. | high | PostHog composes here, not in individual tools. |

## Requirements

### Requirement 1: Distribution-aware and isolated enablement

**Requirement ID:** REQ-001

**Priority:** must-have

#### Acceptance Criteria

1. GIVEN a source or development build without distribution analytics defaults,
   WHEN the runtime starts without explicit analytics configuration, THEN it
   SHALL NOT create a PostHog client or send network analytics.
2. GIVEN an official distributed artifact with build-injected analytics
   defaults, WHEN the runtime starts without an operator override, THEN it SHALL
   create the privacy-bounded PostHog adapter; WHEN
   `AGENT_WORKBENCH_ANALYTICS_ENABLED=false`, THEN it SHALL create no PostHog
   client and send no analytics.
3. GIVEN analytics is selected but configuration is missing or invalid, WHEN
   the runtime starts, THEN analytics SHALL remain disabled without blocking the
   runtime and SHALL expose only local structured configuration evidence.
4. WHERE OpenTelemetry is enabled or disabled independently, PostHog enablement
   SHALL NOT change the OTEL destination or response behavior.
5. THE RELEASE BUILD SHALL inject the project token into generated runtime
   artifacts from release configuration, SHALL use the approved EU ingestion
   host, and SHALL NOT write the token to source, docs, tests, build receipts, or
   logs.
6. THE PACKAGED README and install runbook SHALL disclose that official
   distributions enable personless aggregate analytics by default, summarize
   the excluded data categories, and show the pre-launch opt-out setting.

### Requirement 2: Aggregate MCP analytics

**Requirement ID:** REQ-002

**Priority:** must-have

#### Acceptance Criteria

1. WHEN an MCP tool or resource completes, THEN PostHog SHALL receive an event
   containing only allowlisted aggregate fields such as surface kind/name,
   outcome, validity, verification status, bounded counts, duration bucket,
   runtime version, and configured provider category.
2. WHEN a runtime boundary records a degraded or failed outcome, THEN PostHog
   SHALL receive only a sanitized category and allowlisted aggregate fields.
3. THE SYSTEM SHALL use an ephemeral runtime identifier and set person-profile
   processing off for every event.
4. THE SYSTEM SHALL NOT emit developer-CLI command events or duplicate direct
   PostHog capture calls across MCP handlers.

### Requirement 3: Outbound privacy enforcement

**Requirement ID:** REQ-003

**Priority:** must-have

#### Acceptance Criteria

1. THE POSTHOG ADAPTER SHALL construct a new payload from an explicit event and
   property allowlist; it SHALL NOT forward arbitrary recorder properties.
2. THE OUTBOUND PAYLOAD SHALL exclude repository roots, paths, filenames,
   resource URIs, task/query/prompt text, source bodies, command content,
   environment values, tokens, raw error messages, stack traces, and exception
   objects.
3. IF `recordError` receives any error value, THEN the adapter SHALL map it to a
   bounded failure category locally and SHALL invoke PostHog Error Tracking only
   with a new synthetic stackless error and sanitized aggregate properties; it
   SHALL NOT pass the original throwable to the SDK or enable exception
   autocapture.
4. WHEN an unknown event name, unknown property, nested value, or oversized
   value is recorded, THEN the adapter SHALL drop it rather than serialize it.

### Requirement 4: Failure-safe lifecycle and distribution

**Requirement ID:** REQ-004

**Priority:** must-have

#### Acceptance Criteria

1. WHEN PostHog capture, flush, or shutdown fails, THEN MCP behavior SHALL remain
   unchanged and the failure SHALL NOT be retried through another exporter.
2. IN daemon mode, the runtime SHALL own at most one PostHog client per daemon
   telemetry lifecycle rather than one client per MCP connection.
3. WHEN the owning runtime shuts down, THEN it SHALL attempt one bounded flush
   and shutdown without keeping the process alive indefinitely.
4. THE DISTRIBUTED npm package and manifest SHALL contain the declared
   `posthog-node` dependency, and all committed dependency lockfiles SHALL match
   their manifests.
5. THE OFFICIAL npm and Windows portable release artifacts SHALL use the same
   build-injected analytics defaults, and release packaging SHALL fail rather
   than silently publish an analytics-disabled artifact when the required token
   is absent.

### Requirement 5: Privacy-bounded PostHog operational logs

**Requirement ID:** REQ-005

**Priority:** must-have

#### Acceptance Criteria

1. GIVEN PostHog analytics configuration is ready, WHEN
   `AGENT_WORKBENCH_POSTHOG_LOGS_ENABLED=true` or `1`, THEN the runtime SHALL
   create a separate OTLP Logs exporter targeting the exact approved EU logs
   endpoint; WHEN the setting is absent, false, or analytics is opted out, THEN
   it SHALL create no logs exporter.
2. THE LOGS EXPORTER SHALL emit only fixed-body WARN or ERROR operational
   summaries selected from allowlisted recorder events and outcomes, with
   bounded scalar attributes reconstructed from the existing privacy allowlist.
3. THE LOGS EXPORTER SHALL NOT receive or serialize original throwables, raw
   messages, stacks, paths, repository identity, prompts, queries, commands,
   environment values, user identity, or arbitrary recorder properties.
4. `recordError` SHALL remain owned by sanitized PostHog Error Tracking and
   SHALL NOT duplicate the exception as a PostHog log record.
5. POSTHOG LOGS and the existing OTEL trace exporter SHALL have independent
   providers, endpoints, enablement, flush, and shutdown behavior; logs
   failures SHALL NOT change traces, analytics, or MCP behavior.

## Correctness Properties

- **CP-001:** An explicit runtime opt-out always produces zero PostHog clients
  and outbound PostHog events; source/development builds without distribution
  defaults also remain disabled by default.
- **CP-002:** Every outbound PostHog property key belongs to the fixed allowlist
  and every value is a bounded scalar.
- **CP-003:** Changing an error message, stack, path, source body, command, or
  task text cannot change either the serialized analytics payload or the
  synthetic PostHog exception payload.
- **CP-004:** For one daemon lifecycle, concurrent MCP connections share one
  analytics adapter and one shutdown path.
- **CP-005:** Analytics adapter failure cannot change an MCP handler result or
  thrown application error.
- **CP-006:** Changing any non-allowlisted recorder value or any raw exception
  detail cannot change a PostHog log record, and disabling PostHog logs creates
  no OTLP Logs exporter while leaving OTEL trace configuration unchanged.

## Success Criteria

- Focused tests prove consent, sanitization, personless events, lifecycle, and
  failure isolation.
- The wizard's Python analytics code and dependencies are absent, `.env` is
  ignored, and the Python lockfile is current.
- Typecheck, relevant tests, full tests, plugin validation, and package dry-run
  pass.
- A no-network OTLP transport test proves the emitted log body, severity, and
  attributes are bounded and excludes sensitive sentinels.
