---
title: Agent IDE runtime MVP tasks
doc_type: spec
status: draft
owner: platform
last_reviewed: 2026-05-07
---

# Tasks

**Input**: Design documents from `docs/specs/001-agent-ide-runtime/`

**Prerequisites**: `spec.md`, `plan.md`,
[Layered runtime architecture](../../design/layered-runtime-architecture.md),
[Runtime operations design](../../design/runtime-operations-design.md),
[Coding agent integration design](../../design/coding-agent-integration-design.md),
[Markdown document quality design](../../design/markdown-document-quality-design.md),
[Runtime contracts](../../reference/runtime-contracts.md),
[Workspace safety contract](../../reference/workspace-safety-contract.md), and
[MVP proof matrix](../../reference/mvp-proof-matrix.md).

**Tests**: Add contract and fixture tests for every MVP surface before expanding
adapters or graph features.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel because it touches different files and has no
  dependency on another task.
- **[Story]**: User story label such as US1, US2, or US3.
- Include exact file paths once implementation paths exist.

## Phase 0: Architecture Rails

- [ ] T000 Define layered source module layout for `contracts`, `domain`,
  `ports`, `application`, `presentation`, `interface-adapters`, and
  `infrastructure`.
- [ ] T001 Define dependency rules and architecture boundary checks for the
  layered runtime.
- [ ] T002 Define feature ownership map for status, scope, overview, context,
  symbol search, references, impact, preview/apply, and verification planning.
- [ ] T003 Define domain value objects and policy ownership for repo paths,
  source ranges, file identity, snapshots, evidence, capability, confidence,
  attention, validation, budgets, and workspace safety.
- [ ] T004 Define core ports: `GraphQueryPort`, `GraphWritePort`,
  `SnapshotPort`, `FileCatalogPort`, `FileIdentityPort`, `WorkspaceFilePort`,
  `WorkspaceWatcherPort`, `ExtractorPort`, `ExtractorRegistryPort`,
  `ReferenceResolverPort`, `ValidationPlannerPort`, `EditPreviewStorePort`,
  `ClockPort`, and `HasherPort`.
- [ ] T005 Define runtime operation ports: `CachePort`,
  `CacheInvalidationPort`, `WarmupCoordinatorPort`, `WorkQueuePort`,
  `WorkerPoolPort`, `CancellationPort`, and `SnapshotCoordinatorPort`.
- [ ] T006 Define `RuntimeContext`, `RuntimeContextFactoryPort`,
  `StateStorePort`, `TelemetryPort`, and optional future `UsageRecorderPort`
  ownership rules.
- [ ] T007 Define MCP `ToolRegistry`, `ResourceRegistry`, `PromptRegistry`, and
  registry definition contracts.
- [ ] T008 Define shared typed argument parser contracts for repo paths, file
  paths, line/column pairs, booleans, enums, limits, payload modes, and usage
  context.
- [ ] T009 Define common coding-agent integration specs:
  `IntegrationManifest`, `IntegrationArtifact`, `InstructionPack`, `SkillPack`,
  `HookIntent`, `CommandSpec`, `McpBindingSpec`, and `AgentCapability`.
- [ ] T010 Define integration profile registry and emitter boundary rules for
  Codex, Claude Code, Kiro, Augment, Gemini, Junie, and future agents.
- [ ] T011 Define application use-case interfaces and result types for every MVP
  resource and tool.
- [ ] T012 Define presentation contracts for envelope assembly, metadata,
  warnings, blockers, errors, source sections, budgets, truncation, and stable
  output ordering.
- [ ] T013 Define architecture ADRs or design notes for ports/adapters,
  presentation, policy ownership, canonical `tree-sitter` extraction, and graph
  store as derived evidence, and coding-agent integration as generated adapter
  artifacts.
- [ ] T014 Add architecture boundary tests or lint rules proving dependency
  direction, including no application/domain dependency on vendor-specific
  integration emitters.

**Checkpoint**: every future feature has an owning layer, use case, policy, or
port before implementation begins.

## Phase 1: Contracts, Policies, And Fixtures

- [x] T015 Define source directory and test directory structure.
- [x] T016 Define shared response envelope and enum schemas from
  `docs/reference/runtime-contracts.md`.
- [ ] T017 Split implementation contract categories into domain contracts,
  application result contracts, and presentation response contracts.
- [ ] T018 Define workspace safety, generated/vendor mutation, and command
  safety policy contracts with fixtures.
- [x] T019 Define `fixture-basic-python`, `fixture-markdown-config`,
  `fixture-degraded-tools`, and `fixture-workspace-safety`.
- [ ] T020 Define expected golden response snapshots through presenter
  contracts for all MVP resources and tools.

## Phase 2: Graph Ports And SQLite Infrastructure

- [x] T021 Define SQLite schema for files, nodes, edges, unresolved refs,
  snapshots, and FTS rows.
- [x] T022 Add migration and schema validation harness.
- [ ] T023 Define domain graph models and graph read models separate from SQLite
  row models.
- [ ] T024 Implement SQLite graph adapter behind `GraphWritePort`,
  `GraphQueryPort`, `SnapshotPort`, and `GraphTransactionPort`.
- [ ] T025 Add stale/cold/refreshing/fresh snapshot state tests through graph
  ports.
- [ ] T026 Add add/modify/delete/rename cleanup tests through graph ports.
- [ ] T027 Add query-budget trace tests for MVP hot paths.
- [ ] T028 Implement graph write APIs for files, nodes, edges, unresolved refs,
  FTS rows, and atomic update transactions.
- [ ] T029 Implement graph query APIs for exact lookup, FTS lookup,
  file/range lookup, incoming/outgoing edges, and bounded traversal.

**Checkpoint**: graph schema, graph ports, and fixture proof gates are
executable without application code depending on SQLite.

## Phase 3: Runtime Binding, Files, And Extraction

- [ ] T030 Implement repo binding, path canonicalization, scope detection, and
  skipped-root reporting through application ports.
- [ ] T031 Implement file scanning, file identity hashes, language detection,
  generated/vendor scope handling, and skipped-root reporting behind file ports.
- [ ] T032 Implement snapshot freshness state, watcher event ingestion, and
  stale row cleanup behind watcher/snapshot ports.
- [ ] T033 Implement runtime owner/observer state, heartbeat, stale/dead owner
  recovery, and isolated-worker mode.
- [ ] T034 Implement prewarm command flow using the same warm-up coordinator and
  generated cache roots.
- [ ] T035 Implement cache invalidation for file identity, graph evidence, query
  results, source sections, validation discovery, and report caches.
- [ ] T036 Implement warm-up coordinator for cold start, migration, scan,
  extraction, reference resolution, FTS refresh, and fresh snapshot publication.
- [ ] T037 Implement bounded priority work queue, worker pool, timeout,
  cancellation, and
  obsolete-result rejection for parser/indexing work.
- [ ] T038 Define `ExtractionBatch` normalization for capability, provenance,
  confidence, source ranges, diagnostics hints, and test hints.
- [ ] T039 Implement Markdown/config resource-backed extraction behind
  `ExtractorPort`.
- [ ] T040 Configure canonical `tree-sitter` parser and grammar loading behind
  extraction infrastructure.
- [ ] T041 Implement first-language node and unresolved-reference extraction
  using canonical `tree-sitter`.
- [ ] T042 Implement extraction ingestion use case that validates
  `ExtractionBatch` and writes through graph ports.
- [ ] T043 Implement reference resolution use case for imports, duplicate-name
  ambiguity, resolved edges, and unresolved refs.
- [ ] T044 Implement degraded-mode behavior for missing `tree-sitter`
  parser/grammar, parser failure, missing optional enrichers, and missing test
  tooling.

**Checkpoint**: runtime can bind to fixture repos, extract evidence, resolve
references, and report status/scope without adapter-to-SQLite coupling.

## Phase 4: Application Use Cases And Policies

- [ ] T045 Implement `GetRepoStatusUseCase`.
- [ ] T046 Implement `GetRepoScopeUseCase`.
- [ ] T047 Implement `GetRepoOverviewUseCase`.
- [ ] T048 Implement `BuildTaskContextUseCase` with context ranking and
  direct-read caveats.
- [ ] T049 Implement `SearchSymbolsUseCase`.
- [ ] T050 Implement `FindReferencesUseCase`.
- [ ] T051 Implement `ComputeImpactUseCase`.
- [ ] T052 Implement shared file identity/base-hash service for graph indexing
  and edit preview/apply.
- [ ] T053 [US3] Implement `PreviewWorkspaceEditUseCase` with base hashes.
- [ ] T054 [US3] Implement `ApplyWorkspaceEditUseCase` with path containment
  and stale-preview rejection.
- [ ] T055 Implement `PlanVerificationUseCase` without command execution.
- [ ] T056 Implement `DescribeIntegrationProfileUseCase` for common coding-agent
  integration metadata without generating vendor-specific artifacts.
- [ ] T057 Implement freshness, capability, confidence, budget, attention,
  validation, and workspace safety policies used by the use cases.
- [ ] T058 Implement cache validity and snapshot validity policies used by the
  use cases.

**Checkpoint**: MVP behavior is available through application use cases before
MCP transport is wired.

## Phase 5: Presentation Layer

- [ ] T059 Implement shared response envelope presenter.
- [ ] T060 Implement metadata presenter for freshness, capability, evidence,
  verification, budgets, truncation, and scope.
- [ ] T061 Implement warm-up/cache/concurrency metadata presentation for status
  and degraded responses.
- [ ] T062 Implement warning/blocker attention presenter.
- [ ] T063 Implement error presenter with retryable `next_action` shape.
- [ ] T064 Implement source section presenter with byte and row budgets.
- [ ] T065 Implement integration profile presenter for agent target surfaces,
  unsupported capabilities, provenance, and regeneration safety.
- [ ] T066 Add presenter-level golden response tests for all MVP resources and
  tools.

**Checkpoint**: every MVP response shape is produced by presenters, not by MCP
handlers or use cases.

## Phase 6: MCP Interface Adapter

- [ ] T067 Implement shared MCP typed argument parsers and structured
  invalid-input responses.
- [ ] T068 Implement MCP server/resource/tool/prompt registration and schema
  binding as a thin adapter over use cases and presenters.
- [ ] T069 [P] [US1] Wire `repo:///status` through MCP schema, use case, and
  presenter.
- [ ] T070 [P] [US1] Wire `repo:///scope` through MCP schema, use case, and
  presenter.
- [ ] T071 [P] [US1] Wire `repo:///overview` through MCP schema, use case, and
  presenter.
- [ ] T072 [US1] Wire `context_for_task` through MCP schema, use case, and
  presenter.
- [ ] T073 [US2] Wire `symbol_search` through MCP schema, use case, and
  presenter.
- [ ] T074 [US2] Wire `find_references` through MCP schema, use case, and
  presenter.
- [ ] T075 [US2] Wire bounded `impact` through MCP schema, use case, and
  presenter.
- [ ] T076 [US3] Wire `preview_workspace_edit` through MCP schema, use case, and
  presenter.
- [ ] T077 [US3] Wire `apply_workspace_edit` through MCP schema, use case, and
  presenter.
- [ ] T078 [US3] Wire `verification_plan` through MCP schema, use case, and
  presenter.
- [ ] T079 Wire `repo:///agent-integration-profile` through MCP schema, use
  case, and presenter as a read-only post-MVP-discovery resource if included in
  the first integration slice.

**Checkpoint**: MVP read/write/planning surfaces match golden responses and
budgets through the presentation layer.

## Phase 7: Cross-Cutting Validation

- [ ] T080 Add produced-response assertions against the expected golden
  snapshots from T020.
- [ ] T081 Add use-case tests for every MVP resource and tool.
- [ ] T082 Add registry and shared argument-parser tests for valid input,
  invalid input, paths, positions, enums, limits, and payload modes.
- [ ] T083 Add OTEL instrumentation tests or contract checks for dispatch,
  use-case, graph/query, worker, cache, and presentation boundaries.
- [ ] T084 Add runtime owner/observer, prewarm, cache invalidation,
  cold-to-fresh warm-up, stale-to-refreshing-to-fresh update, obsolete-result
  rejection, concurrent-read, and single-writer graph transaction tests.
- [ ] T085 Add workspace safety negative tests for traversal, symlink escape,
  generated/vendor mutation, shell injection, env handling, output caps, and
  redaction.
- [ ] T086 Add degraded-mode tests for missing `tree-sitter` parser/grammar,
  parser timeout/crash, missing optional enricher, and missing test runner.
- [ ] T087 Add query budget tests for status, scope, context, symbol search,
  references, impact, preview/apply, and verification plan.
- [ ] T088 Add integration boundary tests proving common integration specs can
  describe Codex, Claude Code, Kiro, Augment, Gemini, and Junie targets without
  runtime core dependencies on vendor-specific emitters.
- [ ] T089 Validate docs links and metadata.

## Post-MVP Task Backlog

### Markdown Document Quality

- [ ] T090 Define Markdown document quality contracts for structure findings,
  compliance findings, link findings, table-readability findings, and formatter
  plans.
- [ ] T091 Define documentation quality ports: `MarkdownParserPort`,
  `MarkdownStructureCheckPort`, `MarkdownCompliancePolicyPort`,
  `MarkdownFormatPlannerPort`, `MarkdownLinkResolverPort`, and
  `DocumentationPolicyPort`.
- [ ] T092 Add Markdown quality fixtures for skipped heading levels,
  inconsistent numbering, ambiguous nested lists, wide tables, definition-like
  tables, frontmatter violations, broken links, and unchanged documents.
- [ ] T093 Implement read-only `CheckMarkdownDocument` and `CheckMarkdownSet`
  use-case contracts behind documentation quality ports.
- [ ] T094 Implement `PlanMarkdownFormat` and `PreviewMarkdownFormat` contracts
  so readability rewrites are explainable and previewable before mutation.
- [ ] T095 Integrate Markdown quality checks into `verification_plan` for
  touched documentation without running hidden formatting.
- [ ] T096 Add documentation-quality presenter golden outputs for findings,
  formatter rationale, source ranges, and preview-token metadata.
- [ ] T097 Add documentation-quality boundary tests proving the checker and
  formatter do not bypass workspace safety or edit preview/apply.

- C# semantic support.
- CloudFormation/SAM relationship extraction.
- TypeScript/JavaScript semantic promotion if not selected as the first
  language path.
- Graph reports, communities, god nodes, surprising connections, and generated
  docs/wiki export.
- Usage-gap analytics.
- Agent-specific plugin/extension packaging for Codex, Claude Code, Kiro,
  Augment, Gemini, and Junie beyond common integration profiles.
- Agent-specific hook generation beyond vendor-neutral hook intents.
- ACP adapter implementation.
- `run_nearest_tests` execution.
- Rollback, safe rename, change signature, safe delete, move symbol, and import
  mutation.
