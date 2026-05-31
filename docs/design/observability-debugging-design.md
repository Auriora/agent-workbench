---
title: Observability and debugging design
doc_type: design
status: draft
owner: platform
last_reviewed: 2026-05-31
---

# Observability And Debugging Design

## Purpose

Define how the runtime exposes operational telemetry, profiling hooks, and
repo-local debug tools without adding noise to normal MCP responses or slowing
hot paths.

## Principles

- Observability is off by default.
- MCP response schemas are not telemetry transport.
- Debug and profiling tools are for this repository only unless promoted by a
  fixture-backed design decision.
- Hot paths must pay near-zero overhead when telemetry is disabled.
- Raw backend output belongs in traces or debug logs, not agent-facing MCP
  responses.

## OpenTelemetry And Jaeger

The runtime uses OpenTelemetry as the operational telemetry path. The initial
implementation supports:

- disabled no-op adapter by default
- console trace exporter for local debugging
- OTLP HTTP trace exporter for Jaeger or an OpenTelemetry Collector

Configuration is environment driven:

| Variable | Default | Purpose |
| --- | --- | --- |
| `AGENT_WORKBENCH_OTEL_ENABLED` | unset/false | Enables telemetry when `true` or `1`. |
| `AGENT_WORKBENCH_OTEL_DESTINATION` | `otlp_http` when enabled | `otlp_http`, `console`, or `none`. |
| `AGENT_WORKBENCH_OTEL_ENDPOINT` | `http://localhost:4318/v1/traces` | OTLP HTTP traces endpoint. Jaeger all-in-one or collector endpoints can be used here. |
| `AGENT_WORKBENCH_OTEL_SERVICE_NAME` | `agent-workbench` | OTEL service name. |

Example local Jaeger usage:

```bash
AGENT_WORKBENCH_OTEL_ENABLED=true \
AGENT_WORKBENCH_OTEL_DESTINATION=otlp_http \
AGENT_WORKBENCH_OTEL_ENDPOINT=http://localhost:4318/v1/traces \
pnpm dev -- tests/fixtures/fixture-mixed-language-platform
```

## Repo-Local Debug Harnesses

Debug harnesses may call runtime use cases against arbitrary target repos, but
they must live in this repository and refuse to run unless the current working
directory is the `agent-workbench` project. They are not MCP resources/tools and
must not be emitted to downstream projects.

Current harness:

- `pnpm debug:mcp-status -- <target-repo>`: runs scanned status against another
  repo and prints the normal MCP envelope.

Future harnesses should follow the same pattern:

- accept a target repo explicitly
- use normal use cases and presenters
- optionally emit OTEL traces when telemetry is enabled
- never expose debug-only behavior through the public MCP registry

## Profiling

Profiling should be possible without changing MCP contracts. Preferred modes:

- Node CPU profiling around debug harnesses for local investigations.
- OTEL spans around runtime boundaries for latency attribution.
- Query budget tests and trace assertions for hot path regressions.
- Optional sampled span attributes for row counts, traversal depth, source byte
  counts, skipped work, and cache hit/miss state.

Profiling runs should use debug harnesses first so target repos can be varied
without enabling debug behavior inside those repos.

## Low-Impact Monitoring Candidates

These are useful and should remain opt-in:

- Per-tool latency histograms through OTEL metrics or span attributes.
- Row-count, traversal-depth, source-byte, and truncation counters.
- Cache hit/miss counters by cache namespace.
- Snapshot freshness transition spans.
- Parser/extractor timeout counters.
- Degraded-mode counters by capability and reason.
- Quiet-feedback suppression counters for no-finding and optional-analyzer
  failures.
- MCP invalid-input counters by schema name.
- Validation-plan confidence counters.

Avoid durable usage records for operational telemetry. Durable usage tables are
only justified when there is a product query that cannot be answered by OTEL,
for example repeated low-confidence workflows or long-term adoption analysis.

## Related Docs

- [Runtime operations design](runtime-operations-design.md)
- [MCP surface design](mcp-surface-design.md)
- [Edit and validation loop design](edit-and-validation-loop-design.md)
- [Runtime contracts](../reference/runtime-contracts.md)
