---
title: Observability and debugging design
doc_type: design
status: draft
owner: platform
last_reviewed: 2026-11-08
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

## Local Daemon Lifetime Evidence

Daemon lifetime receipts are operational local evidence, independent of optional
telemetry. The source implementation retains at most two launch records and 4096
serialized bytes with launch identity, PID, timestamps and fixed lifecycle/cause
enums. It excludes raw errors, stack traces, repository paths, environment values
and client/tool payloads. Receipt content is not forwarded to PostHog or OTEL.
Fatal observation ignores the throwable itself and preserves default termination.
The optional shutdown block adds fixed phase/cause and observed termination,
activity and publication state. It survives exit and later launch rotation; no
throwable, stack, path or client payload is introduced by shutdown recording.

Health exposes available records or a fixed unavailable reason. A missing terminal
observation is unknown prior-owner loss on the next admission; it does not diagnose
SIGKILL or a native crash. See [runtime operations](runtime-operations-design.md#daemon-lifetime-evidence)
for observation boundaries and [runtime contracts](../reference/runtime-contracts.md#daemon-lifetime-evidence)
for the canonical schema. This behavior is source delivery, not installed evidence.

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

## PostHog Product Analytics

Agent Workbench also supports an independent PostHog product-analytics path.
Official release bundles carry build-injected configuration and enable this path
by default; source and development builds without those defaults remain
disabled. Operators can explicitly opt out. Enabling or disabling PostHog must
not change OTEL traces or MCP behavior.

PostHog is limited to aggregate MCP and runtime-boundary events. It is not a
general exporter and it must not send raw error data, repo identity, prompts,
paths, resource URIs, source bodies, command text, or environment values.

Runtime overrides and distribution defaults resolve as follows:

| Variable | Default | Purpose |
| --- | --- | --- |
| `AGENT_WORKBENCH_ANALYTICS_ENABLED` | official release: true; source/development: false | Explicit `false` or `0` opts out before client construction; `true` or `1` opts in when configuration is available. |
| `AGENT_WORKBENCH_POSTHOG_PROJECT_TOKEN` | official release: build-injected; source/development: unset | Optional runtime override for the project token used only during SDK initialization. |
| `AGENT_WORKBENCH_POSTHOG_HOST` | official release: `https://eu.i.posthog.com`; source/development: unset | Optional runtime override; only the exact approved EU ingestion host is accepted. |

The runtime constructs PostHog only when all of the following are true:

- analytics resolves enabled from an explicit runtime setting or configured
  distribution default
- no explicit `false` or `0` runtime opt-out is present
- a project token is present after applying runtime overrides
- the host is exactly the approved EU ingestion endpoint

Official release builds receive the project token through the
`POSTHOG_PROJECT_TOKEN` GitHub Actions secret. Selecting distribution analytics
without that secret fails the build. The token may appear only in generated
runtime bundles; it is not committed to source, documentation, tests, logs, or
the runtime build receipt. Both the npm tarball and Windows portable ZIP use the
same generated bundle.

The runtime adapter exposes a local token-free configuration status of
`disabled`, `ready`, `missing_configuration`, or `invalid_host`. This evidence
is for local diagnostics only and is not itself exported as analytics.

PostHog events are personless:

- every event uses an ephemeral process-lifetime runtime identifier
- every event sets `$process_person_profile` to `false`
- the SDK is configured with `personProfiles: "never"`
- exception autocapture and passing original throwables to `captureException`
  are forbidden; only adapter-created stackless synthetic errors use that SDK
  route

The PostHog adapter constructs a new outbound payload from an allowlist. The
stable normal analytics event names in this slice are:

- `mcp.tool.dispatch`
- `mcp.resource.dispatch`
- `runtime.boundary`
- `runtime.error`

Sanitized Error Tracking uses PostHog's required `$exception` event shape after
the adapter reconstructs its nested properties. `recordError` uses this path;
`runtime.error` remains an allowlisted normal event for explicit aggregate
recording.

Only bounded scalar properties may leave the process. Supported fields are
aggregate status and count metadata such as surface kind/name, boundary
kind/name, outcome, analysis validity, verification status, cache/runtime
state, duration bucket, truncation, row/traversal/source-byte budgets, and
Markdown-audit counters when present.

`recordError` maps failures locally to a bounded category enum such as
`type_error`, `range_error`, `syntax_error`, `reference_error`, `uri_error`,
`aggregate_error`, `error`, or `non_error_throwable`. Changing an exception
message, stack, path, prompt, or command content must not change the serialized
PostHog payload. Error Tracking receives only a newly constructed synthetic
error with a fixed generic message, a bounded category type/fingerprint, and no
stack. The original throwable is never passed to the SDK. The `before_send`
boundary reconstructs the resulting `$exception` event from its own nested
allowlist and drops SDK-added frames, mechanisms, source, and other properties.

Capture, flush, and shutdown failures are contained inside the adapter. They do
not raise into MCP handlers, do not trigger another exporter, and do not change
response envelopes.

## PostHog Operational Logs

PostHog operational logs are a separate OTLP Logs destination. They are not a
replacement for Jaeger/OTEL traces and do not change the trace configuration
above. The runtime creates the logs provider only when
`AGENT_WORKBENCH_POSTHOG_LOGS_ENABLED` is exactly `true` or `1`, the PostHog
analytics configuration is ready, and no analytics opt-out is present. The
default is disabled for both release and source builds.

The exporter uses PostHog's EU OTLP Logs endpoint,
`https://eu.i.posthog.com/i/v1/logs`, with the configured project token in the
authorization header. That token never becomes a log attribute. The logs path
has its own `LoggerProvider`, batching, flush, and idempotent shutdown lifecycle;
provider construction, emit, flush, and shutdown failures are contained.

Only actionable, already-structured telemetry records may become logs:

| Source event | Fixed log body |
| --- | --- |
| `mcp.tool.dispatch` | `agent_workbench.mcp_tool_attention` |
| `mcp.resource.dispatch` | `agent_workbench.mcp_resource_attention` |
| `runtime.boundary` | `agent_workbench.runtime_boundary_attention` |

`blocked`, `degraded`, `missing`, or a positive degraded-mode count produces a
`WARN` record. Explicit `error` or `failed` outcomes produce an `ERROR` record.
Successful and unknown events produce no log. Attributes pass through the same
bounded scalar allowlist as product analytics; arbitrary nested values are
dropped. Bodies are fixed constants rather than caller-provided text.

The logs adapter intentionally ignores `recordError`. Sanitized exceptions are
sent only through PostHog Error Tracking, preventing duplicate exception data.
Raw logger messages, stdout/stderr, exception messages, stack traces, throwable
objects, repository or path data, source, prompts, queries, commands, resource
URIs, and environment values are never exported as logs.

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
- `pnpm debug:refresh-fixture --parent <existing-private-directory>`: creates
  a newly owned deterministic Git fixture for refresh profiling and emits its
  revision, content manifest and independent expected Qt/TypeScript cases.
- `pnpm debug:refresh-profile --repo <read-only-repo> --output <new-directory>
  --runs 5 --max-files 2000`: runs cold complete generations through the actual
  production worker/controller/executor with an isolated database for each run.
  Output must be a new private directory disjoint from the source, including
  symlink aliases. The runtime must provide process.threadCpuUsage; unavailable
  capability returns a structured blocked result, without a profiling fallback.
  Profiles cover the production-worker isolate. Reports distinguish the observed
  worker-thread CPU interval from whole-process generation CPU and sampled process
  RSS. Exact scanner counters cover successful directory enumerations, returned
  entries considered, file-identity stat attempts and actual ignore/priority
  wildcard constructions; they do not claim all process filesystem syscalls.
  Exclusive phase intervals reconcile to the observed thread totals. Milestone
  intervals remain separate, and sampled RSS is not an exact peak. Source/runtime
  identity drift or incomplete worker evidence fails the run, with no successful
  aggregate summary. This read-only input command measures cold generations.
- `pnpm debug:refresh-scenarios --output <new-directory> --runs 5 --python-files 320`:
  constructs newly owned deterministic fixtures and measures cold generation,
  persisted first-read reuse, a real sixty-second settled idle window, actual
  watcher single/burst edits and a committed-continuation dispatch pause/store
  reopen. It accepts no external mutable --repo input. Persisted first-read reuse
  is not daemon startup reuse; paused same-session continuation is not crash
  recovery. The suite records fixed watcher calibration, content/mutation manifests,
  full selected-snapshot semantic evidence and per-scenario repetition comparison.
  Missing or mismatched evidence fails without a successful suite summary. Zero
  worker counts in reuse/idle do not imply zero parent validator/watcher I/O.
- `pnpm exec tsx src/debug/refresh-scan-benchmark.ts --output <new-directory>
  --runs 5 --python-files 4000`: measures two complete broad catalog scans on a
  newly owned deterministic fixture after one unmeasured warmup pair. The same
  unchanged harness runs before and after matcher changes. Reports retain full
  scanner output, CPU/wall spread, exact construction/work counts and
  harness/runtime/input fingerprints. Only the generated fixture-root field is
  normalized. The comparison requires at least five complete runs, matching
  fixture/runtime parameters and harness identity, identical full output, and
  reconciled measurements. Source validation, fixture setup and output writes
  remain outside scan timing. This is a scan benchmark; worker/full-generation
  performance and memory acceptance require the refresh profiling suite.
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

Production startup and the checkout sweep compose extractors through the same
canonical production-registry factory. Its parity regression covers C, C++,
Go, JavaScript, TypeScript, Python, and Ruby so a consumer-local registration
list cannot silently narrow dogfood proof.

Graph-backed sweep probes select a deterministic symbol-bearing source file
from the detected repository ecosystem. Rails-shaped mixed repositories prefer
Ruby, Go modules prefer Go, and CMake-shaped native repositories prefer C++
then C for symbol, reference, impact, and context probes. Candidate regexes are
only bounded discovery aids: the published graph must contain the candidate,
and public capability and evidence labels are derived from the selected graph
node. A successful sweep therefore exercises the intended production adapter
without promoting heuristic C/C++ evidence or selecting incidental tooling.

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

### Refresh performance acceptance

Refresh performance acceptance compares complete generations, including final
resolution and settlement. Freeze source revision, content/timestamp manifest,
Node/platform, scenario parameters, measurement boundaries and independently
expected semantic corrections before running candidates. Use at least five
repetitions for cold, persisted reuse, settled idle, edits and resume, and retain
failed repetitions with their original failure evidence. Report process CPU and
worker-thread CPU separately, plus wall and sampled RSS median/minimum/maximum.
Worker scanner counters exclude parent validation/watcher work; zero workers
therefore does not mean zero parent I/O. Source drift or unexplained graph changes
invalidate acceptance. An additional read-only cold run set supplements the
preselected primary scenario; it cannot replace a less favorable primary result.


Spec 072's frozen synthetic fixture comparison (Node 24.8.0, Linux x64, five
repetitions per scenario) records cold complete-generation median process CPU
7.421 to 3.766 seconds (49.26% lower) and wall 5.062 to 2.987 seconds
(41.00% lower), with exact graph parity after independently frozen Qt/schema/
accounting corrections. Default worker passes fall four to two; discovery runs
once per generation. Five >=60-second settled-idle windows invoke zero workers.
The [verification record](../history/072-daemon-cpu-efficiency-review.md#performance-and-equivalence)
and [audit artifact](../history/072-daemon-cpu-efficiency-performance-evidence.json)
retain all scenarios, spreads, phase costs, counters and identity limits.

Memory is a recorded tradeoff: all scenario median RSS changes are below +10%,
but maximum end-sampled idle RSS grows 13.69%. Platform review accepts that
bounded fixture result with [B016](../backlog/README.md#b016-characterize-refresh-profiling-rss-retention)
owning further allocation/long-idle characterization. Idle RSS is a single
post-capture sample; allocation cause and production leak behavior remain unknown.
These measurements establish neither production-wide memory/CPU bounds nor
FreeCAD-wide performance. Background duty-cycle policy remains B014.

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
- `runtime.boundary`
- `runtime.error`

These events remain opt-in for OTEL. PostHog follows the distribution-default
and explicit opt-out contract above. Neither path may change MCP response
schemas or add visible feedback to agents.

Avoid durable usage records for operational telemetry. Durable usage tables are
only justified when there is a product query that cannot be answered by OTEL,
for example repeated low-confidence workflows or long-term adoption analysis.

## Related Docs

- [Runtime operations design](runtime-operations-design.md)
- [MCP surface design](mcp-surface-design.md)
- [Edit and validation loop design](edit-and-validation-loop-design.md)
- [Runtime contracts](../reference/runtime-contracts.md)
