---
title: Observability and debugging design
doc_type: design
status: draft
owner: platform
last_reviewed: 2026-05-31
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
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
- MCP tool/resource dispatch events with low-cardinality surface names,
  duration, outcome, validity, verification status, warning/error counts, and
  budget attributes when present
- an in-memory adapter for contract tests only; it is not a durable usage store

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
must not be emitted to downstream projects. Installed and containerized Agent
Workbench packages strip `src/debug/`, `debug:*` package scripts, and active
implementation specs under `docs/specs/`, so cross-repo debug options are
available only from the owning repository checkout.

Current harnesses:

- `pnpm debug:mcp-status -- <target-repo>`: runs scanned status against another
  repo and prints the normal MCP envelope.
- `pnpm debug:mcp-use-case -- <status|scope|overview|context> <target-repo>`:
  runs bounded MCP-adjacent use cases against another repo and prints the normal
  MCP envelope.
- `pnpm debug:mcp-profile -- <status|scope|overview|context> <target-repo>`:
  runs the same debug use-case harness under Node CPU profiling and writes a
  `.cpuprofile` under `.cache/profiles/` unless `--profile-output` is provided.
- `pnpm debug:mcp-tool-sweep -- --repo <repo> [--repo <repo> ...]`: calls every
  registered public MCP resource and tool through bounded repo-local use-case
  adapters, writes a timestamped JSON report under the selected `.tmp` output
  directory, and writes a fixed `mcp-tool-sweep-progress.json` while the run is
  in progress. The progress report records sweep, repo, warm-up, discovery,
  resource, and tool phases with cumulative results and a running, complete, or
  failed state so interrupted runs can be diagnosed without relying on terminal
  observation.

The tool sweep is a generated-report debug harness. It is not a public MCP
surface, not an installed plugin option, and not a target-repo command runner.
It may inspect arbitrary target repositories as read-only source data, but it
must not build, test, install dependencies, start containers, or execute
commands in those repositories. Workspace-write surfaces may be exercised only
against repository-owned fixtures or committed-tree sandbox copies under `.tmp`
or an Agent Workbench-named `/tmp` sandbox. Original external repositories are
read-only inputs.

Tool sweep quality labels describe harness result quality, not product
severity:

- `full`: the surface returned a complete, usable envelope for the requested
  bounded call.
- `partial`: the surface returned useful but incomplete evidence without a
  continuation cursor or equivalent recovery path.
- `degraded`: the surface completed with non-blocking missing capability,
  skipped prerequisite, or warning evidence.
- `blocked`: required evidence was unavailable and the response names the
  blocker or next action.
- `invalid`: the call failed, returned invalid analysis, or produced a contract
  error.

`partial` and `degraded` are last-resort labels. The expected workflow is to
trace each non-full result to a root cause, fix the runtime or harness when
possible, and rerun the sweep rather than accepting partial output as normal
success.

The current sweep harness runs repos serially. Future parallelization should be
bounded at the repo level, use isolated per-repo runtimes, preserve deterministic
repo-order final report assembly, serialize progress and final report writes,
and propagate cancellation explicitly. Shared SQLite writes within one repo,
workspace-write preview/apply pairs, and final report publication remain
serialized.

Future harnesses should follow the same pattern:

- accept a target repo explicitly
- use normal use cases and presenters
- remain checkout-only and be stripped from installed/containerized packages
- optionally emit OTEL traces when telemetry is enabled
- never expose debug-only behavior through the public MCP registry

## Profiling

Profiling should be possible without changing MCP contracts. Preferred modes:

- Node CPU profiling around debug harnesses for local investigations. Use
  `pnpm debug:mcp-profile -- <use-case> <target-repo>` to capture a local
  profile without registering new MCP tools/resources or changing response
  schemas.
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

MVP dispatch instrumentation currently emits the following stable event names:

- `mcp.tool.dispatch`
- `mcp.resource.dispatch`
- `error` for thrown boundary failures

These events are opt-in when using OpenTelemetry exporters and must not change
MCP response schemas or add visible feedback to agents.

Avoid durable usage records for operational telemetry. Durable usage tables are
only justified when there is a product query that cannot be answered by OTEL,
for example repeated low-confidence workflows or long-term adoption analysis.

## Related Docs

- [Runtime operations design](runtime-operations-design.md)
- [MCP surface design](mcp-surface-design.md)
- [Edit and validation loop design](edit-and-validation-loop-design.md)
- [Runtime contracts](../reference/runtime-contracts.md)
