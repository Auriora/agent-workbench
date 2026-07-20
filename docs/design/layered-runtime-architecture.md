---
title: Layered runtime architecture
doc_type: design
status: draft
owner: platform
last_reviewed: 2026-07-20
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Layered Runtime Architecture

## Purpose

Define the implementation architecture that every runtime feature must follow
from the first MVP task. The goal is a small vertical slice with stable
boundaries, not a temporary implementation that has to be untangled later.

## Architecture Style

The runtime uses a clean, hexagonal architecture with explicit presentation,
application, domain, port, and infrastructure boundaries.

```text
interface adapters
-> presentation
-> application use cases
-> domain models, services, and policies
-> ports
<- infrastructure adapters
```

Dependencies point inward:

- interface adapters may depend on presentation and application contracts
- presentation may depend on application result contracts and runtime contracts
- application may depend on domain models, policies, and ports
- domain must not depend on MCP, SQLite, tree-sitter, filesystem, or process
  execution
- infrastructure implements ports and may depend on external libraries

## Layers

| Layer | Responsibility | Must Not Own |
| --- | --- | --- |
| Interface adapters | MCP registration, request schema validation, transport dispatch | response envelope construction, graph queries, parser logic, policy decisions |
| Presentation | response envelopes, metadata composition, warnings/errors, source packing, truncation, stable ordering | domain decisions, graph persistence, parsing, command execution |
| Application use cases | orchestrate one user-visible operation such as status, context, search, preview, apply, or verification planning | raw MCP responses, SQL, tree-sitter, filesystem scanning |
| Domain models and policies | capability, freshness, confidence, attention, validation, safety, source ranges, edit plans, operation gates | external I/O, persistence details, transport schemas |
| Ports | stable interfaces for graph, extraction, files, watchers, validation, command discovery, caches, queues, workers, clocks, hashing | concrete SQLite, MCP, parser, filesystem, process implementations |
| Infrastructure adapters | SQLite/FTS, tree-sitter, filesystem scanner/watcher, worker pools, cache stores, deterministic config parsers, command discovery | application policy, presentation, cross-file semantic decisions |

## Required Source Layout

Use this layout unless a later ADR changes it:

```text
src/
  contracts/
  domain/
    models/
    policies/
    services/
  ports/
  application/
    use-cases/
  presentation/
  interface-adapters/
    mcp/
      arguments/
      registries/
  integration/
    common/
    emitters/
    registry/
  infrastructure/
    sqlite/
    filesystem/
    tree-sitter/
    config/
    commands/
    cache/
    workers/
    telemetry/
```

`contracts/` contains shared runtime vocabulary and wire-safe schemas.
`domain/` contains pure value objects, policies, and services.
`ports/` contains interfaces consumed by domain/application code.
`application/` contains orchestration use cases.
`presentation/` turns application results into response envelopes.
`interface-adapters/` binds external protocols such as MCP.
`integration/` defines portable coding-agent integration artifacts and
agent-specific emitters for instructions, skills, hooks, commands, MCP config,
plugins, extensions, and ACP-aware packaging.
`infrastructure/` implements ports with SQLite, tree-sitter, filesystem, and
other external tools.

## Boundary Rules

- MCP handlers call one use case and one presenter.
- MCP tools, resources, and prompts are registered through declarative
  registries. Inline dispatch branches are not the pattern for new surfaces.
- MCP argument parsing is shared across handlers and returns typed request
  values or structured invalid-input errors before use cases run.
- Use cases return application result objects, not MCP envelopes.
- Presenters build the shared response envelope and attach metadata, warnings,
  errors, source sections, truncation, budgets, and next actions.
- Use cases depend on `GraphQueryPort` and `GraphWritePort`, not SQLite.
- Extractors emit `ExtractionBatch` values and never write graph rows.
- Reference resolution is separate from extraction and graph persistence.
- Workspace writes apply already-planned edits; refactor semantics belong in a
  refactor planning use case.
- Validation planning, command discovery, command safety, execution, result
  capture, and result presentation are separate responsibilities.
- Reports consume graph read models through reporting ports; they do not query
  raw SQLite tables directly.
- Refresh policy is an application/runtime service behind narrow operation
  ports. Worker, SQLite, watcher, timer, process, socket, and lock mechanics are
  infrastructure concerns. Presentation and MCP adapters never manage cache or
  background state directly.
- `RuntimeContext` carries per-call repo identity, workspace identity,
  snapshot/freshness, budget/deadline, cancellation, observability span, and
  optional usage context. Use cases receive context explicitly.
- Coding-agent integrations are generated from common integration specs.
  Agent-specific plugins, hooks, commands, rules, steering files, guidelines,
  and extension manifests must not become core runtime abstractions.

## Current Boundary Ownership

The runtime keeps shared response policy in the innermost layer that needs it:

- Markdown document parsing helpers used by docs query/index use cases live in
  `src/application/use-cases/markdown-docs.ts`. They are pure application
  helpers, not filesystem or Markdown infrastructure adapters.
- Response metadata policy, public next-action filtering, runtime trust
  classification, and invalid-response metadata live in
  `src/application/use-cases/response-metadata.ts`. Presenters may use those
  helpers while still owning envelope construction, warnings/errors, and final
  response shaping.
- MCP instrumentation depends on `TelemetryRecorderPort` from `src/ports`.
  Concrete telemetry adapters, OpenTelemetry configuration, and fallback
  in-memory/no-op implementations live in `src/infrastructure/telemetry/`.

Architecture tests enforce these decisions: application code must not import
`src/presentation` or `src/infrastructure`, presentation must not import
`src/infrastructure`, and MCP adapters must not import concrete infrastructure.
There are no current intentional exceptions for these rules.

## Core Ports

Refresh convergence uses one provider-neutral port family:

- `SnapshotRefreshPort` admits startup, first-read, and watcher generations;
- `SnapshotRefreshControllerPort` exposes the shared controller receipt and
  transition subscription used for daemon lifetime;
- `SnapshotRefreshDiagnosticsPort` provides the single awaited public-health
  authority;
- `SnapshotRefreshAdmissionFailurePort` records structured pre-execution store,
  permission, and orphan-recovery failures;
- `SnapshotPublicationPort` owns building allocation, published selection, and
  generation-fenced terminal transitions;
- `RefreshExecutorPort` and `RefreshDeadlineSchedulerPort` isolate the bounded
  worker protocol and finite deadline.

The daemon composition root owns one controller, watcher/change queue,
repository ownership lease, activity lifetime coordinator, publication adapter,
and worker executor, then injects the same request and diagnostics ports into
every connection-specific server. Standalone composition uses the same
controller only behind successful ownership admission. Use cases depend on
these ports; MCP adapters, presenters, and provider integrations cannot import
the controller, graph store, watcher, worker, or ownership implementation.

MVP ports:

- `GraphQueryPort`
- `GraphWritePort`
- `SnapshotPort`
- `FileCatalogPort`
- `FileIdentityPort`
- `WorkspaceFilePort`
- `WorkspaceWatcherPort`
- `ExtractorPort`
- `ExtractorRegistryPort`
- `ReferenceResolverPort`
- `ValidationPlannerPort`
- `EditPreviewStorePort`
- `WorkspaceSafetyPolicy`
- `FreshnessPolicy`
- `BudgetPolicy`
- `CapabilityPolicy`
- `AttentionPolicy`
- `ClockPort`
- `HasherPort`
- `CachePort`
- `CacheInvalidationPort`
- `WarmupCoordinatorPort`
- `WorkQueuePort`
- `WorkerPoolPort`
- `CancellationPort`
- `SnapshotCoordinatorPort`
- `RuntimeContextFactoryPort`
- `StateStorePort`
- `TelemetryPort`
- `TelemetryRecorderPort`
- `IntegrationProfileRegistryPort`
- `IntegrationArtifactEmitterPort`

Post-MVP ports may include `ValidationExecutorPort`, `CommandExecutorPort`,
  `ReportStorePort`, `RefactorPlannerPort`, `ImportPlannerPort`,
`MarkdownParserPort`, `MarkdownStructureCheckPort`,
`MarkdownCompliancePolicyPort`, `MarkdownFormatPlannerPort`,
`MarkdownLinkResolverPort`, `DocumentationPolicyPort`, and
`EnrichmentProviderPort` when a fixture-backed capability needs them.
Agent-specific hook, plugin, extension, or ACP emitters are post-MVP unless a
fixture-backed integration capability needs one earlier.
`UsageRecorderPort` is optional and should be added only when the runtime needs
durable, queryable workflow history that cannot be answered from OTEL telemetry
alone.

## Coding Agent Integration Boundary

Coding-agent integration follows
[Coding agent integration design](coding-agent-integration-design.md).

The core runtime exposes executable capabilities through MCP definitions and
application use cases. Agent-specific integration artifacts are generated from a
common model:

- `IntegrationManifest`
- `IntegrationArtifact`
- `InstructionPack`
- `SkillPack`
- `HookIntent`
- `CommandSpec`
- `McpBindingSpec`
- `AgentCapability`

Emitters may target Codex, Claude Code, Kiro, Augment, Gemini, Junie, or future
agents. Emitters must depend on the common integration model and runtime
contracts; application/domain code must not depend on emitters.

MCP is the authoritative executable surface. Skills and instruction files guide
agents in how to use the runtime. Plugins, extensions, hooks, commands,
steering, rules, guidelines, and ACP packaging are distribution or UX adapters.

## Interface Adapter Registries

MCP registrations are declarative:

- `ToolRegistry`
- `ResourceRegistry`
- `PromptRegistry`
- `ToolDefinition`
- `ResourceDefinition`
- `PromptDefinition`

Definitions own schema, argument parser, use-case binding, presenter binding,
budget policy, and capability policy. The MCP adapter resolves definitions and
dispatches them; it does not contain per-tool business logic.

## Runtime Context

`RuntimeContext` is an application-facing value passed to every use case. It
contains:

- repo root and workspace root
- current snapshot id and freshness
- request budget and deadline
- cancellation token
- operation id
- OTEL span or trace context
- caller-provided usage context when available
- redaction/path-presentation context

`RuntimeContext` is created by interface/runtime infrastructure and consumed by
use cases. Domain policies should receive only the fields they need.

## Presentation Pattern

Every MCP resource or tool must use presenters instead of hand-building
responses.

Required presenters:

- `EnvelopePresenter`
- `MetadataPresenter`
- `AttentionPresenter`
- `ErrorPresenter`
- `SourceSectionPresenter`
- `BudgetPresenter`
- `ResourcePresenter`
- `ToolPresenter`

Presenter tests should cover golden response shape before MCP transport wiring.

## Feature Ownership

| Feature | Application Use Case | Domain/Policy Owners | Infrastructure |
| --- | --- | --- | --- |
| Status/scope/overview | `GetRepoStatus`, `GetRepoScope`, `GetRepoOverview` | freshness, capability, budget policies | graph query, snapshot, file catalog |
| Context | `BuildTaskContext` | context ranking, confidence, attention policy | graph query, source reads |
| Symbol search/references/impact | `SearchSymbols`, `FindReferences`, `ComputeImpact` | confidence, budget, capability policies | graph query |
| Preview/apply | `PreviewWorkspaceEdit`, `ApplyWorkspaceEdit` | workspace safety, freshness, edit drift policy | workspace files, preview store |
| Verification plan | `PlanVerification` | validation policy, command safety policy | validation catalog, command discovery |
| Refactors | future refactor use cases | refactor preconditions, import planning, operation gates | graph query, workspace files |
| Markdown document quality | `CheckMarkdownDocument`, `CheckMarkdownSet`; future `PlanMarkdownFormat`, `PreviewMarkdownFormat`, `ApplyMarkdownFormat` | documentation policy, readability policy, formatter safety | markdown parser, link resolver, edit preview store |
| Reports | future reporting use cases | report caveat and redaction policies | graph query, report store |
| Coding-agent integrations | `DescribeIntegrationProfile`, future artifact generation use cases | integration capability, provenance, regeneration safety | integration emitters, config writers |

## Boundary Tests

The implementation must include architecture checks that prove:

- domain imports no MCP, SQLite, tree-sitter, filesystem, or process modules
- application imports no MCP or SQLite implementation
- presentation imports no SQLite, tree-sitter, filesystem watcher, or process
  runner implementation
- interface adapters do not query SQLite or parse source directly
- language adapters do not import graph persistence or MCP presentation code
- SQLite is reachable only through graph ports
- every MVP MCP surface has a use-case test and a presenter test

## Related Docs

- [System architecture](../architecture/system-architecture.md)
- [MCP surface design](mcp-surface-design.md)
- [Graph store design](graph-store-design.md)
- [Language adapter design](language-adapter-design.md)
- [Edit and validation loop design](edit-and-validation-loop-design.md)
- [Runtime operations design](runtime-operations-design.md)
- [Runtime requirements](../requirements/runtime-requirements.md)
