---
title: Agent IDE runtime MVP tasks
doc_type: spec
status: draft
owner: platform
last_reviewed: 2026-05-31
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

**Usage-Informed Priority**: The predecessor `agent-ide` traces showed agents
most frequently using first-pass context, docs/search style routing,
diagnostics/lint/validation planning, and post-edit feedback. MVP tasks should
therefore optimize status/scope, `context_for_task`, docs/config routing
evidence, validation planning, and edit safety metadata before broad
orientation, diagnostics execution, hooks, usage analytics, or expanded public
surface area.

**Language-Neutral Priority**: Python is the first partial-semantic adapter for
comparison with the predecessor PoC. The runtime core must still support
multiple coding languages, frameworks, project systems, test runners, CI,
containers, infrastructure platforms, and documentation surfaces through common
adapter/provider contracts.

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
- [ ] T003A Define language-neutral adapter evidence value objects for adapter
  domain, language/platform id, capability level, provenance, confidence, and
  namespaced metadata.
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
- [ ] T017A Add contract tests proving shared graph, context, validation, edit,
  and MCP response contracts contain no Python-specific fields outside
  namespaced adapter metadata.
- [ ] T018 Define workspace safety, generated/vendor mutation, and command
  safety policy contracts with fixtures.
- [x] T019 Define `fixture-basic-python`, `fixture-markdown-config`,
  `fixture-degraded-tools`, and `fixture-workspace-safety`.
- [ ] T019A Add mixed-language/platform fixture files that prove unsupported or
  resource-backed non-Python areas are reported explicitly in status, scope, and
  context.
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
- [ ] T038A Define common adapter/provider contracts for language, framework,
  config, infrastructure, documentation, test, and tooling domains.
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
  direct-read caveats, complete-enough markers, skipped-work metadata, and
  exact next actions for symbol/reference/impact or direct-read verification.
- [ ] T049 Implement `SearchSymbolsUseCase`.
- [ ] T050 Implement `FindReferencesUseCase`.
- [ ] T051 Implement `ComputeImpactUseCase`.
- [ ] T052 Implement shared file identity/base-hash service for graph indexing
  and edit preview/apply.
- [ ] T053 [US3] Implement `PreviewWorkspaceEditUseCase` with base hashes.
- [ ] T054 [US3] Implement `ApplyWorkspaceEditUseCase` with path containment
  and stale-preview rejection.
- [ ] T055 Implement `PlanVerificationUseCase` without command execution,
  distinguishing planned checks from proven runnable checks and routing
  low-confidence discovery to exact follow-up actions.
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
- [ ] T063 Implement error and next-action presenter support with retryable
  `next_action` shape for direct reads, `symbol_search`, `find_references`,
  `impact`, preview/apply, and validation follow-up actions.
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

## MVP Gap Closure Backlog

The following groups convert the current MVP gaps into an execution checklist.
They do not replace the phase tasks above; they group the remaining work into
commit-sized implementation streams tied to the feature spec and proof matrix.

### Gap 1: Repo Orientation Surfaces

- [ ] T200 [US1] Complete the first-pass repo orientation surfaces:
  `repo:///status`, `repo:///scope`, and `repo:///overview`.
  - [ ] T200.1 Keep `repo:///status` backed by repository scanning, adapter
    coverage, freshness, scope, budgets, and shared envelope presentation.
  - [ ] T200.2 Implement `GetRepoScopeUseCase` over the same repo binding and
    file catalog evidence used by status.
  - [ ] T200.3 Implement `GetRepoOverviewUseCase` with compact summary,
    language/platform coverage, fixture counts, and no source dump.
  - [ ] T200.4 Add presenter-level golden responses for status, scope, and
    overview across `fixture-basic-python`, `fixture-markdown-config`, and
    `fixture-mixed-language-platform`.
  - [ ] T200.5 Wire `repo:///scope` and `repo:///overview` through MCP
    resources using typed argument parsing and thin handlers.
  - [ ] T200.6 Add proof that mixed-language/platform scope is represented
    without Python-specific shared response fields.
  - [ ] T200.7 Add budget tests proving default orientation responses stay
    bounded and do not perform hidden broad source reads.

### Gap 2: Graph Extraction Pipeline

- [ ] T201 [US2] Complete the graph extraction pipeline from repository scan to
  queryable SQLite evidence.
  - [ ] T201.1 Implement snapshot creation, freshness transitions, and repo
    identity/config identity checks before extraction writes.
  - [ ] T201.2 Normalize scanned files into `ExtractionRequest` batches with
    file identity, adapter capability, provenance, confidence, and source range
    conventions.
  - [ ] T201.3 Implement Markdown/config resource-backed extraction through
    `ExtractorPort` without claiming semantic language support.
  - [ ] T201.4 Implement canonical tree-sitter Python extraction for symbols,
    imports, calls, source ranges, signatures, docstrings, diagnostics hints,
    and unresolved references.
  - [ ] T201.5 Implement extraction ingestion that validates
    `ExtractionBatch`, writes files/nodes/edges/unresolved refs through graph
    ports, and keeps SQLite row models isolated in infrastructure.
  - [ ] T201.6 Implement reference resolution for imports, duplicate names,
    ambiguous references, resolved edges, unresolved refs, confidence, and
    provenance.
  - [ ] T201.7 Add add/modify/delete/rename cleanup tests that prove stale graph
    evidence is removed or marked stale by snapshot/file identity.
  - [ ] T201.8 Add fixture-backed tests proving non-Python files remain
    `unsupported` or `resource_backed` while Python is the only
    partial-semantic extraction path.
  - [ ] T201.9 Add query-budget and transaction tests for extraction ingestion,
    FTS refresh, and graph reads used by MVP hot paths.

### Gap 3: Query Tools

- [ ] T202 [US1] [US2] Complete the read/query tools that turn indexed
  evidence into bounded coding-agent context.
  - [ ] T202.1 Implement `BuildTaskContextUseCase` with ranked files, ranked
    symbols, docs/config routing evidence, direct-read caveats,
    complete-enough markers, skipped-work metadata, and exact next actions.
  - [ ] T202.2 Implement `SearchSymbolsUseCase` with exact and fuzzy lookup,
    stable ordering, language/platform filtering, row limits, and no broad
    source scan.
  - [ ] T202.3 Implement `FindReferencesUseCase` with resolved references,
    unresolved references, ambiguity labels, confidence, provenance, and
    bounded depth.
  - [ ] T202.4 Implement `ComputeImpactUseCase` with bounded graph traversal,
    max-depth/max-node limits, truncation metadata, and affected file/symbol
    grouping.
  - [ ] T202.5 Add source-section presentation with byte budgets and explicit
    caveats when context contains routing evidence rather than verified source
    evidence.
  - [ ] T202.6 Add adoption-oriented tests proving `context_for_task` and
    `verification_plan` route ambiguous work to `symbol_search`,
    `find_references`, `impact`, or direct reads through structured
    `next_action` metadata.
  - [ ] T202.7 Add fixture-backed budget tests for `context_for_task`,
    `symbol_search`, `find_references`, and `impact`, including row limits,
    traversal depth, and source-byte caps.
  - [ ] T202.8 Add mixed-language/platform context tests proving unsupported
    and resource-backed files appear as routing evidence only, with no
    Python-specific shared fields.

### Gap 4: Edit And Validation Loop

- [ ] T203 [US3] Complete the bounded edit and validation planning loop without
  executing commands by default.
  - [ ] T203.1 Implement shared file identity and base-hash services used by
    graph indexing, preview tokens, apply drift checks, and stale snapshot
    detection.
  - [ ] T203.2 Implement `PreviewWorkspaceEditUseCase` with path containment,
    generated/vendor read-only policy, secret/redaction checks, base hashes,
    preview token persistence, and no file mutation.
  - [ ] T203.3 Implement `ApplyWorkspaceEditUseCase` with preview-token lookup,
    expiration, single-use semantics, stale preview rejection, path refusal,
    concurrent modification checks, and atomic write ordering.
  - [ ] T203.4 Implement `PlanVerificationUseCase` with planned diagnostics,
    formatter, lint, and test commands, plus blocked states for missing,
    unsafe, too-broad, or low-confidence checks.
  - [ ] T203.5 Keep `verification_plan` read-only: do not execute diagnostics,
    lint, formatting, tests, or hooks in the MVP planning path.
  - [ ] T203.6 Add next-action metadata when verification discovery is
    incomplete, including direct-read, symbol/reference/impact, or manual
    command-confirmation follow-up.
  - [ ] T203.7 Add workspace-safety negative tests for traversal, symlink
    escape, generated/vendor mutation, `.env` or secret-like content, shell
    injection, output caps, and command refusal.
  - [ ] T203.8 Add presenter golden responses for preview, apply success,
    stale apply rejection, unsafe path rejection, blocked validation, and
    planned validation.

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

## Phase 8: Usage-Informed MVP Validation

- [ ] T098 Add regression fixtures proving broad task prompts route to expected
  implementation files and do not drift to unrelated high-frequency files.
- [ ] T099 Add response tests proving `context_for_task` and
  `verification_plan` include complete-enough markers, skipped-work metadata,
  and exact next actions for targeted symbol/reference/impact follow-up.
- [ ] T100 Add negative budget tests proving compact/default first-pass
  responses do not invoke broad orientation, full topology, diagnostics
  execution, or high-cardinality cache validation paths.
- [ ] T101 Add adoption-oriented golden checks showing targeted
  `symbol_search`, `find_references`, and `impact` calls are discoverable from
  first-pass context or validation responses.
- [ ] T102 Add docs/config routing tests for Markdown/config evidence as
  routing evidence only, including direct-read caveats before precise
  documentation claims.
- [ ] T102A Add multi-language/platform coverage tests proving non-Python files
  are surfaced with `unsupported` or `resource_backed` capability metadata and
  do not depend on Python adapter behavior.

## Post-MVP Task Backlog

### Markdown Document Quality

- [ ] T103 Define Markdown document quality contracts for structure findings,
  compliance findings, link findings, table-readability findings, and formatter
  plans.
- [ ] T104 Define documentation quality ports: `MarkdownParserPort`,
  `MarkdownStructureCheckPort`, `MarkdownCompliancePolicyPort`,
  `MarkdownFormatPlannerPort`, `MarkdownLinkResolverPort`, and
  `DocumentationPolicyPort`.
- [ ] T105 Add Markdown quality fixtures for skipped heading levels,
  inconsistent numbering, ambiguous nested lists, wide tables, definition-like
  tables, frontmatter violations, broken links, and unchanged documents.
- [ ] T106 Implement read-only `CheckMarkdownDocument` and `CheckMarkdownSet`
  use-case contracts behind documentation quality ports.
- [ ] T107 Implement `PlanMarkdownFormat` and `PreviewMarkdownFormat` contracts
  so readability rewrites are explainable and previewable before mutation.
- [ ] T108 Integrate Markdown quality checks into `verification_plan` for
  touched documentation without running hidden formatting.
- [ ] T109 Add documentation-quality presenter golden outputs for findings,
  formatter rationale, source ranges, and preview-token metadata.
- [ ] T110 Add documentation-quality boundary tests proving the checker and
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
