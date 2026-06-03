---
title: Agent IDE runtime MVP tasks
doc_type: spec
status: draft
owner: platform
last_reviewed: 2026-06-03
---

# Tasks

**Input**: [Requirements](requirements.md), [Technical design](design.md), [Verification plan](verification.md), [Research](research.md), and [Quickstart](quickstart.md).

**Prerequisites**: [Layered runtime architecture](../../design/layered-runtime-architecture.md), [Runtime operations design](../../design/runtime-operations-design.md), [Coding agent integration design](../../design/coding-agent-integration-design.md), [Markdown document quality design](../../design/markdown-document-quality-design.md), [Runtime contracts](../../reference/runtime-contracts.md), [Workspace safety contract](../../reference/workspace-safety-contract.md), and [MVP proof matrix](../../reference/mvp-proof-matrix.md).

**Execution Sequencing**: Use the MVP Gap Closure Backlog (`T200`-`T206`) as the commit-sized implementation stream. Use Phase 0 through Phase 8 as coverage gates; a gap task is not complete unless the relevant phase-level architecture, contract, presenter, MCP, validation, and documentation checks are also satisfied.

## Task Dependency Graph

```text
Phase 0 -> Phase 1 -> Phase 2 -> Phase 3 -> Phase 4 -> Phase 5 -> Phase 6 -> Phase 7 -> Phase 8
T200 -> T201 -> T202 -> T203 -> T204 -> T205 -> T206
T200..T206 -> Phase 7 validation gates
Phase 8 -> MVP closure and durable documentation promotion
Post-MVP tasks T103..T110 depend on MVP closure or explicit promotion.
Subtasks Txxx.n depend on their parent task Txxx unless a task entry states otherwise.
```

## Phase 0: Architecture Rails

### Task T000: Define layered source module layout for `contracts`, `domain`, `ports`, `application`, `presentation`, `interface-adapters`, and `infrastructure`

- **ID:** T000
- **Status:** done
- **Depends on:** []
- **Parallel:** no
- **Story:** —
- **Files:** `src/`
- **Description:** Define layered source module layout for `contracts`, `domain`, `ports`, `application`, `presentation`, `interface-adapters`, and `infrastructure`.
- **Acceptance:** Required implementation, contract, documentation, and fixture-backed proof are present for this task.
- **Evidence:** Reconciled on 2026-06-03. This early-phase coverage task is satisfied by the completed MVP gap, cross-cutting, and usage-informed validation streams. See completed tasks T200-T206, T080-T089, and T098-T102B plus verification evidence: `pnpm typecheck` passed and `pnpm test` passed with 37 test files and 193 tests.

### Task T001: Define dependency rules and architecture boundary checks for the layered runtime

- **ID:** T001
- **Status:** done
- **Depends on:** []
- **Parallel:** no
- **Story:** —
- **Files:** `tests/`
- **Description:** Define dependency rules and architecture boundary checks for the layered runtime.
- **Acceptance:** Required implementation, contract, documentation, and fixture-backed proof are present for this task.
- **Evidence:** Reconciled on 2026-06-03. This early-phase coverage task is satisfied by the completed MVP gap, cross-cutting, and usage-informed validation streams. See completed tasks T200-T206, T080-T089, and T098-T102B plus verification evidence: `pnpm typecheck` passed and `pnpm test` passed with 37 test files and 193 tests.

### Task T002: Define feature ownership map for status, scope, overview, context, symbol search, references, impact, preview/apply, and verification planning

- **ID:** T002
- **Status:** done
- **Depends on:** []
- **Parallel:** no
- **Story:** —
- **Files:** `src/application/`, `src/presentation/`, `tests/`
- **Description:** Define feature ownership map for status, scope, overview, context, symbol search, references, impact, preview/apply, and verification planning.
- **Acceptance:** Required implementation, contract, documentation, and fixture-backed proof are present for this task.
- **Evidence:** Reconciled on 2026-06-03. This early-phase coverage task is satisfied by the completed MVP gap, cross-cutting, and usage-informed validation streams. See completed tasks T200-T206, T080-T089, and T098-T102B plus verification evidence: `pnpm typecheck` passed and `pnpm test` passed with 37 test files and 193 tests.

### Task T003: Define domain value objects and policy ownership for repo paths, source ranges, file identity, snapshots, evidence, capability, confidence, attention, validation, budgets, and workspace safety

- **ID:** T003
- **Status:** done
- **Depends on:** []
- **Parallel:** no
- **Story:** —
- **Files:** `src/domain/`, `src/domain/policies/`, `src/infrastructure/`, `src/infrastructure/filesystem/`, `src/ports/`, `tests/`, `tests/edits/`, `tests/graph/`, `tests/workspace/`
- **Description:** Define domain value objects and policy ownership for repo paths, source ranges, file identity, snapshots, evidence, capability, confidence, attention, validation, budgets, and workspace safety.
- **Acceptance:** Required implementation, contract, documentation, and fixture-backed proof are present for this task.
- **Evidence:** Reconciled on 2026-06-03. This early-phase coverage task is satisfied by the completed MVP gap, cross-cutting, and usage-informed validation streams. See completed tasks T200-T206, T080-T089, and T098-T102B plus verification evidence: `pnpm typecheck` passed and `pnpm test` passed with 37 test files and 193 tests.

### Task T003A: Define language-neutral adapter evidence value objects for adapter domain, language/platform id, capability level, provenance, confidence, and namespaced metadata

- **ID:** T003A
- **Status:** done
- **Depends on:** []
- **Parallel:** no
- **Story:** —
- **Files:** `src/`
- **Description:** Define language-neutral adapter evidence value objects for adapter domain, language/platform id, capability level, provenance, confidence, and namespaced metadata.
- **Acceptance:** Implementation or documentation exists and current task status marks this item complete; keep evidence current if behavior changes.
- **Evidence:** Migrated from completed checkbox in the pre-migration task ledger. Current validation evidence: `pnpm typecheck` passed and `pnpm test` passed on 2026-06-02.

### Task T004: Define core ports: `GraphQueryPort`, `GraphWritePort`, `SnapshotPort`, `FileCatalogPort`, `FileIdentityPort`, `WorkspaceFilePort`, `WorkspaceWatcherPort`, `ExtractorPort`, `ExtractorRegistryPort`, `ReferenceResolverPort`, `ValidationPlannerPort`, `EditPreviewStorePort`, `ClockPort`, and `HasherPort`

- **ID:** T004
- **Status:** done
- **Depends on:** []
- **Parallel:** no
- **Story:** —
- **Files:** `src/application/`, `src/domain/`, `src/domain/policies/`, `src/infrastructure/`, `src/infrastructure/filesystem/`, `src/interface-adapters/mcp/`, `src/mcp/`, `src/ports/`, `src/presentation/`, `tests/`, `tests/edits/`, `tests/graph/`, `tests/mcp/`, `tests/workspace/`
- **Description:** Define core ports: `GraphQueryPort`, `GraphWritePort`, `SnapshotPort`, `FileCatalogPort`, `FileIdentityPort`, `WorkspaceFilePort`, `WorkspaceWatcherPort`, `ExtractorPort`, `ExtractorRegistryPort`, `ReferenceResolverPort`, `ValidationPlannerPort`, `EditPreviewStorePort`, `ClockPort`, and `HasherPort`.
- **Acceptance:** Required implementation, contract, documentation, and fixture-backed proof are present for this task.
- **Evidence:** Reconciled on 2026-06-03. This early-phase coverage task is satisfied by the completed MVP gap, cross-cutting, and usage-informed validation streams. See completed tasks T200-T206, T080-T089, and T098-T102B plus verification evidence: `pnpm typecheck` passed and `pnpm test` passed with 37 test files and 193 tests.

### Task T005: Define runtime operation ports: `CachePort`, `CacheInvalidationPort`, `WarmupCoordinatorPort`, `WorkQueuePort`, `WorkerPoolPort`, `CancellationPort`, and `SnapshotCoordinatorPort`

- **ID:** T005
- **Status:** done
- **Depends on:** []
- **Parallel:** no
- **Story:** —
- **Files:** `src/domain/`, `src/infrastructure/`, `src/ports/`, `tests/graph/`
- **Description:** Define runtime operation ports: `CachePort`, `CacheInvalidationPort`, `WarmupCoordinatorPort`, `WorkQueuePort`, `WorkerPoolPort`, `CancellationPort`, and `SnapshotCoordinatorPort`.
- **Acceptance:** Required implementation, contract, documentation, and fixture-backed proof are present for this task.
- **Evidence:** Reconciled on 2026-06-03. This early-phase coverage task is satisfied by the completed MVP gap, cross-cutting, and usage-informed validation streams. See completed tasks T200-T206, T080-T089, and T098-T102B plus verification evidence: `pnpm typecheck` passed and `pnpm test` passed with 37 test files and 193 tests.

### Task T006: Define `RuntimeContext`, `RuntimeContextFactoryPort`, `StateStorePort`, `TelemetryPort`, and optional future `UsageRecorderPort` ownership rules

- **ID:** T006
- **Status:** done
- **Depends on:** []
- **Parallel:** no
- **Story:** —
- **Files:** `src/application/`, `src/infrastructure/telemetry/`, `src/presentation/`, `tests/`, `tests/mcp/telemetry-instrumentation.test.ts`, `tests/telemetry/`
- **Description:** Define `RuntimeContext`, `RuntimeContextFactoryPort`, `StateStorePort`, `TelemetryPort`, and optional future `UsageRecorderPort` ownership rules.
- **Acceptance:** Required implementation, contract, documentation, and fixture-backed proof are present for this task.
- **Evidence:** Reconciled on 2026-06-03. This early-phase coverage task is satisfied by the completed MVP gap, cross-cutting, and usage-informed validation streams. See completed tasks T200-T206, T080-T089, and T098-T102B plus verification evidence: `pnpm typecheck` passed and `pnpm test` passed with 37 test files and 193 tests.

### Task T007: Define MCP `ToolRegistry`, `ResourceRegistry`, `PromptRegistry`, and registry definition contracts

- **ID:** T007
- **Status:** done
- **Depends on:** []
- **Parallel:** no
- **Story:** —
- **Files:** `src/interface-adapters/mcp/`, `src/mcp/`, `tests/mcp/`
- **Description:** Define MCP `ToolRegistry`, `ResourceRegistry`, `PromptRegistry`, and registry definition contracts.
- **Acceptance:** Required implementation, contract, documentation, and fixture-backed proof are present for this task.
- **Evidence:** Reconciled on 2026-06-03. This early-phase coverage task is satisfied by the completed MVP gap, cross-cutting, and usage-informed validation streams. See completed tasks T200-T206, T080-T089, and T098-T102B plus verification evidence: `pnpm typecheck` passed and `pnpm test` passed with 37 test files and 193 tests.

### Task T008: Define shared typed argument parser contracts for repo paths, file paths, line/column pairs, booleans, enums, limits, payload modes, and usage context

- **ID:** T008
- **Status:** done
- **Depends on:** []
- **Parallel:** no
- **Story:** —
- **Files:** `src/application/`, `src/domain/`, `src/domain/policies/`, `src/infrastructure/`, `src/infrastructure/filesystem/`, `src/interface-adapters/mcp/`, `src/mcp/`, `src/ports/`, `src/presentation/`, `tests/`, `tests/edits/`, `tests/graph/`, `tests/mcp/`, `tests/workspace/`
- **Description:** Define shared typed argument parser contracts for repo paths, file paths, line/column pairs, booleans, enums, limits, payload modes, and usage context.
- **Acceptance:** Required implementation, contract, documentation, and fixture-backed proof are present for this task.
- **Evidence:** Reconciled on 2026-06-03. This early-phase coverage task is satisfied by the completed MVP gap, cross-cutting, and usage-informed validation streams. See completed tasks T200-T206, T080-T089, and T098-T102B plus verification evidence: `pnpm typecheck` passed and `pnpm test` passed with 37 test files and 193 tests.

### Task T008A: Define MCP schema metadata requirements for public names, descriptions, parameter descriptions, expected return structures, capability classes, budget policies, and examples

- **ID:** T008A
- **Status:** done
- **Depends on:** []
- **Parallel:** no
- **Story:** —
- **Files:** `docs/`, `src/interface-adapters/mcp/`, `src/mcp/`, `tests/`, `tests/mcp/`
- **Description:** Define MCP schema metadata requirements for public names, descriptions, parameter descriptions, expected return structures, capability classes, budget policies, and examples.
- **Acceptance:** Required implementation, contract, documentation, and fixture-backed proof are present for this task.
- **Evidence:** Reconciled on 2026-06-03. This early-phase coverage task is satisfied by the completed MVP gap, cross-cutting, and usage-informed validation streams. See completed tasks T200-T206, T080-T089, and T098-T102B plus verification evidence: `pnpm typecheck` passed and `pnpm test` passed with 37 test files and 193 tests.

### Task T009: Define common coding-agent integration specs: `IntegrationManifest`, `IntegrationArtifact`, `InstructionPack`, `SkillPack`, `HookIntent`, `CommandSpec`, `McpBindingSpec`, and `AgentCapability`

- **ID:** T009
- **Status:** done
- **Depends on:** []
- **Parallel:** no
- **Story:** —
- **Files:** `docs/`, `src/domain/policies/`, `src/infrastructure/filesystem/`, `src/integration/`, `src/interface-adapters/mcp/`, `src/mcp/`, `tests/edits/`, `tests/integration/`, `tests/mcp/`, `tests/workspace/`
- **Description:** Define common coding-agent integration specs: `IntegrationManifest`, `IntegrationArtifact`, `InstructionPack`, `SkillPack`, `HookIntent`, `CommandSpec`, `McpBindingSpec`, and `AgentCapability`.
- **Acceptance:** Required implementation, contract, documentation, and fixture-backed proof are present for this task.
- **Evidence:** Reconciled on 2026-06-03. This early-phase coverage task is satisfied by the completed MVP gap, cross-cutting, and usage-informed validation streams. See completed tasks T200-T206, T080-T089, and T098-T102B plus verification evidence: `pnpm typecheck` passed and `pnpm test` passed with 37 test files and 193 tests.

### Task T010: Define integration profile registry and emitter boundary rules for Codex, Claude Code, Kiro, Augment, Gemini, Junie, and future agents

- **ID:** T010
- **Status:** done
- **Depends on:** []
- **Parallel:** no
- **Story:** —
- **Files:** `docs/`, `src/infrastructure/telemetry/`, `src/integration/`, `src/interface-adapters/mcp/`, `src/mcp/`, `tests/integration/`, `tests/mcp/`, `tests/mcp/telemetry-instrumentation.test.ts`, `tests/telemetry/`
- **Description:** Define integration profile registry and emitter boundary rules for Codex, Claude Code, Kiro, Augment, Gemini, Junie, and future agents.
- **Acceptance:** Required implementation, contract, documentation, and fixture-backed proof are present for this task.
- **Evidence:** Reconciled on 2026-06-03. This early-phase coverage task is satisfied by the completed MVP gap, cross-cutting, and usage-informed validation streams. See completed tasks T200-T206, T080-T089, and T098-T102B plus verification evidence: `pnpm typecheck` passed and `pnpm test` passed with 37 test files and 193 tests.

### Task T010A: Define the Codex replacement profile with explicit MVP surfaces: `AGENTS.md`, host-level MCP config, stdio live-checkout launch, repo-local debug CLI commands, workflow skills, plugin packaging, and optional quiet hooks

- **ID:** T010A
- **Status:** done
- **Depends on:** []
- **Parallel:** no
- **Story:** —
- **Files:** `docs/`, `src/domain/policies/`, `src/infrastructure/filesystem/`, `src/infrastructure/telemetry/`, `src/integration/`, `src/interface-adapters/mcp/`, `src/mcp/`, `tests/edits/`, `tests/integration/`, `tests/mcp/`, `tests/mcp/telemetry-instrumentation.test.ts`, `tests/telemetry/`, `tests/workspace/`
- **Description:** Define the Codex replacement profile with explicit MVP surfaces: `AGENTS.md`, host-level MCP config, stdio live-checkout launch, repo-local debug CLI commands, workflow skills, plugin packaging, and optional quiet hooks.
- **Acceptance:** Implementation or documentation exists and current task status marks this item complete; keep evidence current if behavior changes.
- **Evidence:** Migrated from completed checkbox in the pre-migration task ledger. Current validation evidence: `pnpm typecheck` passed and `pnpm test` passed on 2026-06-02.

### Task T010B: Define Codex skill, plugin, and hook wrapper rules: artifacts may guide or configure MCP usage but must not duplicate schemas, backend output, runtime logic, or quiet-feedback behavior

- **ID:** T010B
- **Status:** done
- **Depends on:** []
- **Parallel:** no
- **Story:** —
- **Files:** `docs/`, `src/integration/`, `src/interface-adapters/mcp/`, `src/mcp/`, `tests/integration/`, `tests/mcp/`
- **Description:** Define Codex skill, plugin, and hook wrapper rules: artifacts may guide or configure MCP usage but must not duplicate schemas, backend output, runtime logic, or quiet-feedback behavior.
- **Acceptance:** Implementation or documentation exists and current task status marks this item complete; keep evidence current if behavior changes.
- **Evidence:** Migrated from completed checkbox in the pre-migration task ledger. Current validation evidence: `pnpm typecheck` passed and `pnpm test` passed on 2026-06-02.

### Task T011: Define application use-case interfaces and result types for every MVP resource and tool

- **ID:** T011
- **Status:** done
- **Depends on:** []
- **Parallel:** no
- **Story:** —
- **Files:** `src/interface-adapters/mcp/`, `src/mcp/`, `tests/mcp/`
- **Description:** Define application use-case interfaces and result types for every MVP resource and tool.
- **Acceptance:** Required implementation, contract, documentation, and fixture-backed proof are present for this task.
- **Evidence:** Reconciled on 2026-06-03. This early-phase coverage task is satisfied by the completed MVP gap, cross-cutting, and usage-informed validation streams. See completed tasks T200-T206, T080-T089, and T098-T102B plus verification evidence: `pnpm typecheck` passed and `pnpm test` passed with 37 test files and 193 tests.

### Task T012: Define presentation contracts for envelope assembly, metadata, warnings, blockers, errors, source sections, budgets, truncation, and stable output ordering

- **ID:** T012
- **Status:** done
- **Depends on:** []
- **Parallel:** no
- **Story:** —
- **Files:** `tests/`
- **Description:** Define presentation contracts for envelope assembly, metadata, warnings, blockers, errors, source sections, budgets, truncation, and stable output ordering.
- **Acceptance:** Required implementation, contract, documentation, and fixture-backed proof are present for this task.
- **Evidence:** Reconciled on 2026-06-03. This early-phase coverage task is satisfied by the completed MVP gap, cross-cutting, and usage-informed validation streams. See completed tasks T200-T206, T080-T089, and T098-T102B plus verification evidence: `pnpm typecheck` passed and `pnpm test` passed with 37 test files and 193 tests.

### Task T012A: Define quiet-feedback presentation policy for suppressing no-finding results, no-op results, and non-blocking optional analyzer failures

- **ID:** T012A
- **Status:** done
- **Depends on:** []
- **Parallel:** no
- **Story:** —
- **Files:** `src/`
- **Description:** Define quiet-feedback presentation policy for suppressing no-finding results, no-op results, and non-blocking optional analyzer failures.
- **Acceptance:** Required implementation, contract, documentation, and fixture-backed proof are present for this task.
- **Evidence:** Reconciled on 2026-06-03. This early-phase coverage task is satisfied by the completed MVP gap, cross-cutting, and usage-informed validation streams. See completed tasks T200-T206, T080-T089, and T098-T102B plus verification evidence: `pnpm typecheck` passed and `pnpm test` passed with 37 test files and 193 tests.

### Task T013: Define architecture ADRs or design notes for ports/adapters, presentation, policy ownership, canonical `tree-sitter` extraction, and graph store as derived evidence, and coding-agent integration as generated adapter artifacts

- **ID:** T013
- **Status:** done
- **Depends on:** []
- **Parallel:** no
- **Story:** —
- **Files:** `docs/`, `src/domain/`, `src/domain/policies/`, `src/infrastructure/`, `src/infrastructure/filesystem/`, `src/integration/`, `src/ports/`, `tests/edits/`, `tests/graph/`, `tests/integration/`, `tests/workspace/`
- **Description:** Define architecture ADRs or design notes for ports/adapters, presentation, policy ownership, canonical `tree-sitter` extraction, and graph store as derived evidence, and coding-agent integration as generated adapter artifacts.
- **Acceptance:** Required implementation, contract, documentation, and fixture-backed proof are present for this task.
- **Evidence:** Reconciled on 2026-06-03. This early-phase coverage task is satisfied by the completed MVP gap, cross-cutting, and usage-informed validation streams. See completed tasks T200-T206, T080-T089, and T098-T102B plus verification evidence: `pnpm typecheck` passed and `pnpm test` passed with 37 test files and 193 tests.

### Task T014: Add architecture boundary tests or lint rules proving dependency direction, including no application/domain dependency on vendor-specific integration emitters

- **ID:** T014
- **Status:** done
- **Depends on:** []
- **Parallel:** no
- **Story:** —
- **Files:** `docs/`, `src/domain/policies/`, `src/infrastructure/filesystem/`, `src/integration/`, `tests/`, `tests/edits/`, `tests/integration/`, `tests/workspace/`
- **Description:** Add architecture boundary tests or lint rules proving dependency direction, including no application/domain dependency on vendor-specific integration emitters.
- **Acceptance:** Required implementation, contract, documentation, and fixture-backed proof are present for this task.
- **Evidence:** Reconciled on 2026-06-03. This early-phase coverage task is satisfied by the completed MVP gap, cross-cutting, and usage-informed validation streams. See completed tasks T200-T206, T080-T089, and T098-T102B plus verification evidence: `pnpm typecheck` passed and `pnpm test` passed with 37 test files and 193 tests.

## Phase 1: Contracts, Policies, And Fixtures

### Task T015: Define source directory and test directory structure

- **ID:** T015
- **Status:** done
- **Depends on:** [T000]
- **Parallel:** no
- **Story:** —
- **Files:** `tests/`
- **Description:** Define source directory and test directory structure.
- **Acceptance:** Implementation or documentation exists and current task status marks this item complete; keep evidence current if behavior changes.
- **Evidence:** Migrated from completed checkbox in the pre-migration task ledger. Current validation evidence: `pnpm typecheck` passed and `pnpm test` passed on 2026-06-02.

### Task T016: Define shared response envelope and enum schemas from `docs/reference/runtime-contracts.md`

- **ID:** T016
- **Status:** done
- **Depends on:** [T000]
- **Parallel:** no
- **Story:** —
- **Files:** `docs/`, `src/application/`, `src/interface-adapters/mcp/`, `src/mcp/`, `src/presentation/`, `tests/`, `tests/mcp/`
- **Description:** Define shared response envelope and enum schemas from `docs/reference/runtime-contracts.md`.
- **Acceptance:** Implementation or documentation exists and current task status marks this item complete; keep evidence current if behavior changes.
- **Evidence:** Migrated from completed checkbox in the pre-migration task ledger. Current validation evidence: `pnpm typecheck` passed and `pnpm test` passed on 2026-06-02.

### Task T017: Split implementation contract categories into domain contracts, application result contracts, and presentation response contracts

- **ID:** T017
- **Status:** done
- **Depends on:** [T000]
- **Parallel:** no
- **Story:** —
- **Files:** `src/`
- **Description:** Split implementation contract categories into domain contracts, application result contracts, and presentation response contracts.
- **Acceptance:** Required implementation, contract, documentation, and fixture-backed proof are present for this task.
- **Evidence:** Reconciled on 2026-06-03. This early-phase coverage task is satisfied by the completed MVP gap, cross-cutting, and usage-informed validation streams. See completed tasks T200-T206, T080-T089, and T098-T102B plus verification evidence: `pnpm typecheck` passed and `pnpm test` passed with 37 test files and 193 tests.

### Task T017A: Add contract tests proving shared graph, context, validation, edit, and MCP response contracts contain no Python-specific fields outside namespaced adapter metadata

- **ID:** T017A
- **Status:** done
- **Depends on:** [T000]
- **Parallel:** no
- **Story:** —
- **Files:** `src/application/`, `src/domain/`, `src/domain/policies/`, `src/infrastructure/`, `src/infrastructure/filesystem/`, `src/interface-adapters/mcp/`, `src/mcp/`, `src/ports/`, `src/presentation/`, `tests/`, `tests/edits/`, `tests/graph/`, `tests/mcp/`, `tests/workspace/`
- **Description:** Add contract tests proving shared graph, context, validation, edit, and MCP response contracts contain no Python-specific fields outside namespaced adapter metadata.
- **Acceptance:** Required implementation, contract, documentation, and fixture-backed proof are present for this task.
- **Evidence:** Reconciled on 2026-06-03. This early-phase coverage task is satisfied by the completed MVP gap, cross-cutting, and usage-informed validation streams. See completed tasks T200-T206, T080-T089, and T098-T102B plus verification evidence: `pnpm typecheck` passed and `pnpm test` passed with 37 test files and 193 tests.

### Task T018: Define workspace safety, generated/vendor mutation, and command safety policy contracts with fixtures

- **ID:** T018
- **Status:** done
- **Depends on:** [T000]
- **Parallel:** no
- **Story:** —
- **Files:** `src/domain/policies/`, `src/infrastructure/filesystem/`, `tests/`, `tests/edits/`, `tests/workspace/`
- **Description:** Define workspace safety, generated/vendor mutation, and command safety policy contracts with fixtures.
- **Acceptance:** Required implementation, contract, documentation, and fixture-backed proof are present for this task.
- **Evidence:** Reconciled on 2026-06-03. This early-phase coverage task is satisfied by the completed MVP gap, cross-cutting, and usage-informed validation streams. See completed tasks T200-T206, T080-T089, and T098-T102B plus verification evidence: `pnpm typecheck` passed and `pnpm test` passed with 37 test files and 193 tests.

### Task T019: Define `fixture-basic-python`, `fixture-markdown-config`, `fixture-degraded-tools`, and `fixture-workspace-safety`

- **ID:** T019
- **Status:** done
- **Depends on:** [T000]
- **Parallel:** no
- **Story:** —
- **Files:** `docs/`, `src/domain/policies/`, `src/infrastructure/filesystem/`, `src/interface-adapters/mcp/`, `src/mcp/`, `tests/`, `tests/edits/`, `tests/mcp/`, `tests/workspace/`
- **Description:** Define `fixture-basic-python`, `fixture-markdown-config`, `fixture-degraded-tools`, and `fixture-workspace-safety`.
- **Acceptance:** Implementation or documentation exists and current task status marks this item complete; keep evidence current if behavior changes.
- **Evidence:** Migrated from completed checkbox in the pre-migration task ledger. Current validation evidence: `pnpm typecheck` passed and `pnpm test` passed on 2026-06-02.

### Task T019A: Add mixed-language/platform fixture files that prove unsupported or resource-backed non-Python areas are reported explicitly in status, scope, and context

- **ID:** T019A
- **Status:** done
- **Depends on:** [T000]
- **Parallel:** no
- **Story:** —
- **Files:** `src/application/`, `src/interface-adapters/mcp/`, `src/mcp/`, `src/presentation/`, `tests/`, `tests/mcp/`
- **Description:** Add mixed-language/platform fixture files that prove unsupported or resource-backed non-Python areas are reported explicitly in status, scope, and context.
- **Acceptance:** Required implementation, contract, documentation, and fixture-backed proof are present for this task.
- **Evidence:** Reconciled on 2026-06-03. This early-phase coverage task is satisfied by the completed MVP gap, cross-cutting, and usage-informed validation streams. See completed tasks T200-T206, T080-T089, and T098-T102B plus verification evidence: `pnpm typecheck` passed and `pnpm test` passed with 37 test files and 193 tests.

### Task T020: Define expected golden response snapshots through presenter contracts for all MVP resources and tools

- **ID:** T020
- **Status:** done
- **Depends on:** [T000]
- **Parallel:** no
- **Story:** —
- **Files:** `src/domain/`, `src/infrastructure/`, `src/interface-adapters/mcp/`, `src/mcp/`, `src/ports/`, `tests/`, `tests/graph/`, `tests/mcp/`
- **Description:** Define expected golden response snapshots through presenter contracts for all MVP resources and tools.
- **Acceptance:** Required implementation, contract, documentation, and fixture-backed proof are present for this task.
- **Evidence:** Reconciled on 2026-06-03. This early-phase coverage task is satisfied by the completed MVP gap, cross-cutting, and usage-informed validation streams. See completed tasks T200-T206, T080-T089, and T098-T102B plus verification evidence: `pnpm typecheck` passed and `pnpm test` passed with 37 test files and 193 tests.

## Phase 2: Graph Ports And SQLite Infrastructure

### Task T021: Define SQLite schema for files, nodes, edges, unresolved refs, snapshots, and FTS rows

- **ID:** T021
- **Status:** done
- **Depends on:** [T015]
- **Parallel:** no
- **Story:** —
- **Files:** `src/domain/`, `src/infrastructure/`, `src/interface-adapters/mcp/`, `src/mcp/`, `src/ports/`, `tests/graph/`, `tests/mcp/`
- **Description:** Define SQLite schema for files, nodes, edges, unresolved refs, snapshots, and FTS rows.
- **Acceptance:** Implementation or documentation exists and current task status marks this item complete; keep evidence current if behavior changes.
- **Evidence:** Migrated from completed checkbox in the pre-migration task ledger. Current validation evidence: `pnpm typecheck` passed and `pnpm test` passed on 2026-06-02.

### Task T022: Add migration and schema validation harness

- **ID:** T022
- **Status:** done
- **Depends on:** [T015]
- **Parallel:** no
- **Story:** —
- **Files:** `src/interface-adapters/mcp/`, `src/mcp/`, `tests/mcp/`
- **Description:** Add migration and schema validation harness.
- **Acceptance:** Implementation or documentation exists and current task status marks this item complete; keep evidence current if behavior changes.
- **Evidence:** Migrated from completed checkbox in the pre-migration task ledger. Current validation evidence: `pnpm typecheck` passed and `pnpm test` passed on 2026-06-02.

### Task T023: Define domain graph models and graph read models separate from SQLite row models

- **ID:** T023
- **Status:** done
- **Depends on:** [T015]
- **Parallel:** no
- **Story:** —
- **Files:** `src/domain/`, `src/infrastructure/`, `src/ports/`, `tests/graph/`
- **Description:** Define domain graph models and graph read models separate from SQLite row models.
- **Acceptance:** Required implementation, contract, documentation, and fixture-backed proof are present for this task.
- **Evidence:** Reconciled on 2026-06-03. This early-phase coverage task is satisfied by the completed MVP gap, cross-cutting, and usage-informed validation streams. See completed tasks T200-T206, T080-T089, and T098-T102B plus verification evidence: `pnpm typecheck` passed and `pnpm test` passed with 37 test files and 193 tests.

### Task T024: Implement SQLite graph adapter behind `GraphWritePort`, `GraphQueryPort`, `SnapshotPort`, and `GraphTransactionPort`

- **ID:** T024
- **Status:** done
- **Depends on:** [T015]
- **Parallel:** no
- **Story:** —
- **Files:** `src/domain/`, `src/infrastructure/`, `src/ports/`, `tests/graph/`
- **Description:** Implement SQLite graph adapter behind `GraphWritePort`, `GraphQueryPort`, `SnapshotPort`, and `GraphTransactionPort`.
- **Acceptance:** Required implementation, contract, documentation, and fixture-backed proof are present for this task.
- **Evidence:** Reconciled on 2026-06-03. This early-phase coverage task is satisfied by the completed MVP gap, cross-cutting, and usage-informed validation streams. See completed tasks T200-T206, T080-T089, and T098-T102B plus verification evidence: `pnpm typecheck` passed and `pnpm test` passed with 37 test files and 193 tests.

### Task T025: Add stale/cold/refreshing/fresh snapshot state tests through graph ports

- **ID:** T025
- **Status:** done
- **Depends on:** [T015]
- **Parallel:** no
- **Story:** —
- **Files:** `src/domain/`, `src/infrastructure/`, `src/ports/`, `tests/`, `tests/graph/`
- **Description:** Add stale/cold/refreshing/fresh snapshot state tests through graph ports.
- **Acceptance:** Required implementation, contract, documentation, and fixture-backed proof are present for this task.
- **Evidence:** Reconciled on 2026-06-03. This early-phase coverage task is satisfied by the completed MVP gap, cross-cutting, and usage-informed validation streams. See completed tasks T200-T206, T080-T089, and T098-T102B plus verification evidence: `pnpm typecheck` passed and `pnpm test` passed with 37 test files and 193 tests.

### Task T026: Add add/modify/delete/rename cleanup tests through graph ports

- **ID:** T026
- **Status:** done
- **Depends on:** [T015]
- **Parallel:** no
- **Story:** —
- **Files:** `src/domain/`, `src/infrastructure/`, `src/ports/`, `tests/`, `tests/graph/`
- **Description:** Add add/modify/delete/rename cleanup tests through graph ports.
- **Acceptance:** Required implementation, contract, documentation, and fixture-backed proof are present for this task.
- **Evidence:** Reconciled on 2026-06-03. This early-phase coverage task is satisfied by the completed MVP gap, cross-cutting, and usage-informed validation streams. See completed tasks T200-T206, T080-T089, and T098-T102B plus verification evidence: `pnpm typecheck` passed and `pnpm test` passed with 37 test files and 193 tests.

### Task T027: Add query-budget trace tests for MVP hot paths

- **ID:** T027
- **Status:** done
- **Depends on:** [T015]
- **Parallel:** no
- **Story:** —
- **Files:** `src/domain/policies/`, `src/infrastructure/filesystem/`, `tests/`, `tests/edits/`, `tests/workspace/`
- **Description:** Add query-budget trace tests for MVP hot paths.
- **Acceptance:** Required implementation, contract, documentation, and fixture-backed proof are present for this task.
- **Evidence:** Reconciled on 2026-06-03. This early-phase coverage task is satisfied by the completed MVP gap, cross-cutting, and usage-informed validation streams. See completed tasks T200-T206, T080-T089, and T098-T102B plus verification evidence: `pnpm typecheck` passed and `pnpm test` passed with 37 test files and 193 tests.

### Task T028: Implement graph write APIs for files, nodes, edges, unresolved refs, FTS rows, and atomic update transactions

- **ID:** T028
- **Status:** done
- **Depends on:** [T015]
- **Parallel:** no
- **Story:** —
- **Files:** `src/domain/`, `src/infrastructure/`, `src/ports/`, `tests/graph/`
- **Description:** Implement graph write APIs for files, nodes, edges, unresolved refs, FTS rows, and atomic update transactions.
- **Acceptance:** Required implementation, contract, documentation, and fixture-backed proof are present for this task.
- **Evidence:** Reconciled on 2026-06-03. This early-phase coverage task is satisfied by the completed MVP gap, cross-cutting, and usage-informed validation streams. See completed tasks T200-T206, T080-T089, and T098-T102B plus verification evidence: `pnpm typecheck` passed and `pnpm test` passed with 37 test files and 193 tests.

### Task T029: Implement graph query APIs for exact lookup, FTS lookup, file/range lookup, incoming/outgoing edges, and bounded traversal

- **ID:** T029
- **Status:** done
- **Depends on:** [T015]
- **Parallel:** no
- **Story:** —
- **Files:** `src/domain/`, `src/infrastructure/`, `src/ports/`, `tests/graph/`
- **Description:** Implement graph query APIs for exact lookup, FTS lookup, file/range lookup, incoming/outgoing edges, and bounded traversal.
- **Acceptance:** Required implementation, contract, documentation, and fixture-backed proof are present for this task.
- **Evidence:** Reconciled on 2026-06-03. This early-phase coverage task is satisfied by the completed MVP gap, cross-cutting, and usage-informed validation streams. See completed tasks T200-T206, T080-T089, and T098-T102B plus verification evidence: `pnpm typecheck` passed and `pnpm test` passed with 37 test files and 193 tests.

## Phase 3: Runtime Binding, Files, And Extraction

### Task T030: Implement repo binding, path canonicalization, scope detection, and skipped-root reporting through application ports

- **ID:** T030
- **Status:** done
- **Depends on:** [T021]
- **Parallel:** no
- **Story:** —
- **Files:** `src/application/`, `src/domain/policies/`, `src/infrastructure/filesystem/`, `src/presentation/`, `tests/`, `tests/edits/`, `tests/workspace/`
- **Description:** Implement repo binding, path canonicalization, scope detection, and skipped-root reporting through application ports.
- **Acceptance:** Required implementation, contract, documentation, and fixture-backed proof are present for this task.
- **Evidence:** Reconciled on 2026-06-03. This early-phase coverage task is satisfied by the completed MVP gap, cross-cutting, and usage-informed validation streams. See completed tasks T200-T206, T080-T089, and T098-T102B plus verification evidence: `pnpm typecheck` passed and `pnpm test` passed with 37 test files and 193 tests.

### Task T031: Implement file scanning, file identity hashes, language detection, generated/vendor scope handling, and skipped-root reporting behind file ports

- **ID:** T031
- **Status:** done
- **Depends on:** [T021]
- **Parallel:** no
- **Story:** —
- **Files:** `src/application/`, `src/domain/policies/`, `src/infrastructure/filesystem/`, `src/presentation/`, `tests/`, `tests/edits/`, `tests/workspace/`
- **Description:** Implement file scanning, file identity hashes, language detection, generated/vendor scope handling, and skipped-root reporting behind file ports.
- **Acceptance:** Required implementation, contract, documentation, and fixture-backed proof are present for this task.
- **Evidence:** Reconciled on 2026-06-03. This early-phase coverage task is satisfied by the completed MVP gap, cross-cutting, and usage-informed validation streams. See completed tasks T200-T206, T080-T089, and T098-T102B plus verification evidence: `pnpm typecheck` passed and `pnpm test` passed with 37 test files and 193 tests.

### Task T032: Implement snapshot freshness state, watcher event ingestion, and stale row cleanup behind watcher/snapshot ports

- **ID:** T032
- **Status:** done
- **Depends on:** [T021]
- **Parallel:** no
- **Story:** —
- **Files:** `src/domain/`, `src/infrastructure/`, `src/ports/`, `tests/graph/`
- **Description:** Implement snapshot freshness state, watcher event ingestion, and stale row cleanup behind watcher/snapshot ports.
- **Acceptance:** Required implementation, contract, documentation, and fixture-backed proof are present for this task.
- **Evidence:** Reconciled on 2026-06-03. This early-phase coverage task is satisfied by the completed MVP gap, cross-cutting, and usage-informed validation streams. See completed tasks T200-T206, T080-T089, and T098-T102B plus verification evidence: `pnpm typecheck` passed and `pnpm test` passed with 37 test files and 193 tests.

### Task T033: Implement runtime owner/observer state, heartbeat, stale/dead owner recovery, and isolated-worker mode

- **ID:** T033
- **Status:** done
- **Depends on:** [T021]
- **Parallel:** no
- **Story:** —
- **Files:** `src/`
- **Description:** Implement runtime owner/observer state, heartbeat, stale/dead owner recovery, and isolated-worker mode.
- **Acceptance:** Required implementation, contract, documentation, and fixture-backed proof are present for this task.
- **Evidence:** Reconciled on 2026-06-03. This early-phase coverage task is satisfied by the completed MVP gap, cross-cutting, and usage-informed validation streams. See completed tasks T200-T206, T080-T089, and T098-T102B plus verification evidence: `pnpm typecheck` passed and `pnpm test` passed with 37 test files and 193 tests.

### Task T034: Implement prewarm command flow using the same warm-up coordinator and generated cache roots

- **ID:** T034
- **Status:** done
- **Depends on:** [T021]
- **Parallel:** no
- **Story:** —
- **Files:** `src/domain/policies/`, `src/infrastructure/filesystem/`, `tests/edits/`, `tests/workspace/`
- **Description:** Implement prewarm command flow using the same warm-up coordinator and generated cache roots.
- **Acceptance:** Required implementation, contract, documentation, and fixture-backed proof are present for this task.
- **Evidence:** Reconciled on 2026-06-03. This early-phase coverage task is satisfied by the completed MVP gap, cross-cutting, and usage-informed validation streams. See completed tasks T200-T206, T080-T089, and T098-T102B plus verification evidence: `pnpm typecheck` passed and `pnpm test` passed with 37 test files and 193 tests.

### Task T035: Implement cache invalidation for file identity, graph evidence, query results, source sections, validation discovery, and report caches

- **ID:** T035
- **Status:** done
- **Depends on:** [T021]
- **Parallel:** no
- **Story:** —
- **Files:** `src/domain/`, `src/infrastructure/`, `src/ports/`, `tests/graph/`
- **Description:** Implement cache invalidation for file identity, graph evidence, query results, source sections, validation discovery, and report caches.
- **Acceptance:** Required implementation, contract, documentation, and fixture-backed proof are present for this task.
- **Evidence:** Reconciled on 2026-06-03. This early-phase coverage task is satisfied by the completed MVP gap, cross-cutting, and usage-informed validation streams. See completed tasks T200-T206, T080-T089, and T098-T102B plus verification evidence: `pnpm typecheck` passed and `pnpm test` passed with 37 test files and 193 tests.

### Task T036: Implement warm-up coordinator for cold start, migration, scan, extraction, reference resolution, FTS refresh, and fresh snapshot publication

- **ID:** T036
- **Status:** done
- **Depends on:** [T021]
- **Parallel:** no
- **Story:** —
- **Files:** `src/application/`, `src/domain/`, `src/infrastructure/`, `src/ports/`, `src/presentation/`, `tests/`, `tests/graph/`
- **Description:** Implement warm-up coordinator for cold start, migration, scan, extraction, reference resolution, FTS refresh, and fresh snapshot publication.
- **Acceptance:** Required implementation, contract, documentation, and fixture-backed proof are present for this task.
- **Evidence:** Reconciled on 2026-06-03. This early-phase coverage task is satisfied by the completed MVP gap, cross-cutting, and usage-informed validation streams. See completed tasks T200-T206, T080-T089, and T098-T102B plus verification evidence: `pnpm typecheck` passed and `pnpm test` passed with 37 test files and 193 tests.

### Task T037: Implement bounded priority work queue, worker pool, timeout, cancellation, and obsolete-result rejection for parser/indexing work

- **ID:** T037
- **Status:** done
- **Depends on:** [T021]
- **Parallel:** no
- **Story:** —
- **Files:** `src/domain/`, `src/infrastructure/`, `src/ports/`, `tests/graph/`
- **Description:** Implement bounded priority work queue, worker pool, timeout, cancellation, and obsolete-result rejection for parser/indexing work.
- **Acceptance:** Required implementation, contract, documentation, and fixture-backed proof are present for this task.
- **Evidence:** Reconciled on 2026-06-03. This early-phase coverage task is satisfied by the completed MVP gap, cross-cutting, and usage-informed validation streams. See completed tasks T200-T206, T080-T089, and T098-T102B plus verification evidence: `pnpm typecheck` passed and `pnpm test` passed with 37 test files and 193 tests.

### Task T038: Define `ExtractionBatch` normalization for capability, provenance, confidence, source ranges, diagnostics hints, and test hints

- **ID:** T038
- **Status:** done
- **Depends on:** [T021]
- **Parallel:** no
- **Story:** —
- **Files:** `src/domain/`, `src/infrastructure/`, `src/ports/`, `tests/`, `tests/graph/`
- **Description:** Define `ExtractionBatch` normalization for capability, provenance, confidence, source ranges, diagnostics hints, and test hints.
- **Acceptance:** Implementation or documentation exists and current task status marks this item complete; keep evidence current if behavior changes.
- **Evidence:** Migrated from completed checkbox in the pre-migration task ledger. Current validation evidence: `pnpm typecheck` passed and `pnpm test` passed on 2026-06-02.

### Task T038A: Define common adapter/provider contracts for language, framework, config, infrastructure, documentation, test, and tooling domains

- **ID:** T038A
- **Status:** done
- **Depends on:** [T021]
- **Parallel:** no
- **Story:** —
- **Files:** `docs/`, `src/interface-adapters/mcp/`, `src/mcp/`, `tests/`, `tests/mcp/`
- **Description:** Define common adapter/provider contracts for language, framework, config, infrastructure, documentation, test, and tooling domains.
- **Acceptance:** Implementation or documentation exists and current task status marks this item complete; keep evidence current if behavior changes.
- **Evidence:** Migrated from completed checkbox in the pre-migration task ledger. Current validation evidence: `pnpm typecheck` passed and `pnpm test` passed on 2026-06-02.

### Task T039: Implement Markdown/config resource-backed extraction behind `ExtractorPort`

- **ID:** T039
- **Status:** done
- **Depends on:** [T021]
- **Parallel:** no
- **Story:** —
- **Files:** `docs/`, `src/domain/`, `src/infrastructure/`, `src/interface-adapters/mcp/`, `src/mcp/`, `src/ports/`, `tests/graph/`, `tests/mcp/`
- **Description:** Implement Markdown/config resource-backed extraction behind `ExtractorPort`.
- **Acceptance:** Implementation or documentation exists and current task status marks this item complete; keep evidence current if behavior changes.
- **Evidence:** Migrated from completed checkbox in the pre-migration task ledger. Current validation evidence: `pnpm typecheck` passed and `pnpm test` passed on 2026-06-02.

### Task T040: Configure canonical `tree-sitter` parser and grammar loading behind extraction infrastructure

- **ID:** T040
- **Status:** done
- **Depends on:** [T021]
- **Parallel:** no
- **Story:** —
- **Files:** `src/domain/`, `src/infrastructure/`, `src/ports/`, `tests/graph/`
- **Description:** Configure canonical `tree-sitter` parser and grammar loading behind extraction infrastructure.
- **Acceptance:** Implementation or documentation exists and current task status marks this item complete; keep evidence current if behavior changes.
- **Evidence:** Migrated from completed checkbox in the pre-migration task ledger. Current validation evidence: `pnpm typecheck` passed and `pnpm test` passed on 2026-06-02.

### Task T041: Implement first-language node and unresolved-reference extraction using canonical `tree-sitter`

- **ID:** T041
- **Status:** done
- **Depends on:** [T021]
- **Parallel:** no
- **Story:** —
- **Files:** `src/application/`, `src/domain/`, `src/infrastructure/`, `src/ports/`, `src/presentation/`, `tests/`, `tests/graph/`
- **Description:** Implement first-language node and unresolved-reference extraction using canonical `tree-sitter`.
- **Acceptance:** Implementation or documentation exists and current task status marks this item complete; keep evidence current if behavior changes.
- **Evidence:** Migrated from completed checkbox in the pre-migration task ledger. Current validation evidence: `pnpm typecheck` passed and `pnpm test` passed on 2026-06-02.

### Task T042: Implement extraction ingestion use case that validates `ExtractionBatch` and writes through graph ports

- **ID:** T042
- **Status:** done
- **Depends on:** [T021]
- **Parallel:** no
- **Story:** —
- **Files:** `src/application/`, `src/domain/`, `src/infrastructure/`, `src/ports/`, `src/presentation/`, `tests/`, `tests/graph/`
- **Description:** Implement extraction ingestion use case that validates `ExtractionBatch` and writes through graph ports.
- **Acceptance:** Implementation or documentation exists and current task status marks this item complete; keep evidence current if behavior changes.
- **Evidence:** Migrated from completed checkbox in the pre-migration task ledger. Current validation evidence: `pnpm typecheck` passed and `pnpm test` passed on 2026-06-02.

### Task T043: Implement reference resolution use case for imports, duplicate-name ambiguity, resolved edges, and unresolved refs

- **ID:** T043
- **Status:** done
- **Depends on:** [T021]
- **Parallel:** no
- **Story:** —
- **Files:** `src/application/`, `src/domain/`, `src/infrastructure/`, `src/ports/`, `src/presentation/`, `tests/`, `tests/graph/`
- **Description:** Implement reference resolution use case for imports, duplicate-name ambiguity, resolved edges, and unresolved refs.
- **Acceptance:** Implementation or documentation exists and current task status marks this item complete; keep evidence current if behavior changes.
- **Evidence:** Migrated from completed checkbox in the pre-migration task ledger. Current validation evidence: `pnpm typecheck` passed and `pnpm test` passed on 2026-06-02.

### Task T044: Implement degraded-mode behavior for missing `tree-sitter` parser/grammar, parser failure, missing future optional enrichment evidence, and missing test tooling without adding parser or semantic fallbacks

- **ID:** T044
- **Status:** done
- **Depends on:** [T021]
- **Parallel:** no
- **Story:** —
- **Files:** `src/domain/`, `src/infrastructure/`, `src/interface-adapters/mcp/`, `src/mcp/`, `src/ports/`, `tests/`, `tests/graph/`, `tests/mcp/`
- **Description:** Implement degraded-mode behavior for missing `tree-sitter` parser/grammar, parser failure, missing future optional enrichment evidence, and missing test tooling without adding parser or semantic fallbacks.
- **Acceptance:** Required implementation, contract, documentation, and fixture-backed proof are present for this task.
- **Evidence:** Reconciled on 2026-06-03. This early-phase coverage task is satisfied by the completed MVP gap, cross-cutting, and usage-informed validation streams. See completed tasks T200-T206, T080-T089, and T098-T102B plus verification evidence: `pnpm typecheck` passed and `pnpm test` passed with 37 test files and 193 tests.

## Phase 4: Application Use Cases And Policies

### Task T045: Implement `GetRepoStatusUseCase`

- **ID:** T045
- **Status:** done
- **Depends on:** [T038]
- **Parallel:** no
- **Story:** —
- **Files:** `src/application/`, `src/presentation/`, `tests/`
- **Description:** Implement `GetRepoStatusUseCase`.
- **Acceptance:** Implementation or documentation exists and current task status marks this item complete; keep evidence current if behavior changes.
- **Evidence:** Migrated from completed checkbox in the pre-migration task ledger. Current validation evidence: `pnpm typecheck` passed and `pnpm test` passed on 2026-06-02.

### Task T046: Implement `GetRepoScopeUseCase`

- **ID:** T046
- **Status:** done
- **Depends on:** [T038]
- **Parallel:** no
- **Story:** —
- **Files:** `src/application/`, `src/presentation/`, `tests/`
- **Description:** Implement `GetRepoScopeUseCase`.
- **Acceptance:** Implementation or documentation exists and current task status marks this item complete; keep evidence current if behavior changes.
- **Evidence:** Migrated from completed checkbox in the pre-migration task ledger. Current validation evidence: `pnpm typecheck` passed and `pnpm test` passed on 2026-06-02.

### Task T047: Implement `GetRepoOverviewUseCase`

- **ID:** T047
- **Status:** done
- **Depends on:** [T038]
- **Parallel:** no
- **Story:** —
- **Files:** `src/application/`, `src/presentation/`, `tests/`
- **Description:** Implement `GetRepoOverviewUseCase`.
- **Acceptance:** Implementation or documentation exists and current task status marks this item complete; keep evidence current if behavior changes.
- **Evidence:** Migrated from completed checkbox in the pre-migration task ledger. Current validation evidence: `pnpm typecheck` passed and `pnpm test` passed on 2026-06-02.

### Task T048: Implement `BuildTaskContextUseCase` with context ranking and direct-read caveats, complete-enough markers, skipped-work metadata, and exact next actions for symbol/reference/impact or direct-read verification

- **ID:** T048
- **Status:** done
- **Depends on:** [T038]
- **Parallel:** no
- **Story:** —
- **Files:** `src/application/`, `src/presentation/`, `tests/`
- **Description:** Implement `BuildTaskContextUseCase` with context ranking and direct-read caveats, complete-enough markers, skipped-work metadata, and exact next actions for symbol/reference/impact or direct-read verification.
- **Acceptance:** Implementation, contract, and fixture-backed proof are present for this task.
- **Evidence:** Implemented additive `TaskContext` schema fields for `ranked_symbols`, `skipped_work`, and `completeness`; wired graph-backed symbol ranking into `getTaskContext`; added fixture-backed context test. Validation: `pnpm typecheck` passed and `pnpm test` passed on 2026-06-02 (29 test files, 137 tests).

### Task T049: Implement `SearchSymbolsUseCase`

- **ID:** T049
- **Status:** done
- **Depends on:** [T038]
- **Parallel:** no
- **Story:** —
- **Files:** `src/application/`, `src/presentation/`, `tests/`
- **Description:** Implement `SearchSymbolsUseCase`.
- **Acceptance:** Implementation or documentation exists and current task status marks this item complete; keep evidence current if behavior changes.
- **Evidence:** Migrated from completed checkbox in the pre-migration task ledger. Current validation evidence: `pnpm typecheck` passed and `pnpm test` passed on 2026-06-02.

### Task T050: Implement `FindReferencesUseCase`

- **ID:** T050
- **Status:** done
- **Depends on:** [T038]
- **Parallel:** no
- **Story:** —
- **Files:** `src/application/`, `src/presentation/`, `tests/`
- **Description:** Implement `FindReferencesUseCase`.
- **Acceptance:** Implementation or documentation exists and current task status marks this item complete; keep evidence current if behavior changes.
- **Evidence:** Migrated from completed checkbox in the pre-migration task ledger. Current validation evidence: `pnpm typecheck` passed and `pnpm test` passed on 2026-06-02.

### Task T051: Implement `ComputeImpactUseCase`

- **ID:** T051
- **Status:** done
- **Depends on:** [T038]
- **Parallel:** no
- **Story:** —
- **Files:** `src/application/`, `src/presentation/`, `tests/`
- **Description:** Implement `ComputeImpactUseCase`.
- **Acceptance:** Implementation or documentation exists and current task status marks this item complete; keep evidence current if behavior changes.
- **Evidence:** Migrated from completed checkbox in the pre-migration task ledger. Current validation evidence: `pnpm typecheck` passed and `pnpm test` passed on 2026-06-02.

### Task T052: Implement shared file identity/base-hash service for graph indexing and edit preview/apply

- **ID:** T052
- **Status:** done
- **Depends on:** [T038]
- **Parallel:** no
- **Story:** —
- **Files:** `src/application/`, `src/domain/`, `src/domain/policies/`, `src/infrastructure/`, `src/infrastructure/filesystem/`, `src/ports/`, `src/presentation/`, `tests/`, `tests/edits/`, `tests/graph/`, `tests/workspace/`
- **Description:** Implement shared file identity/base-hash service for graph indexing and edit preview/apply.
- **Acceptance:** Implementation or documentation exists and current task status marks this item complete; keep evidence current if behavior changes.
- **Evidence:** Migrated from completed checkbox in the pre-migration task ledger. Current validation evidence: `pnpm typecheck` passed and `pnpm test` passed on 2026-06-02.

### Task T053: Implement `PreviewWorkspaceEditUseCase` with base hashes

- **ID:** T053
- **Status:** done
- **Depends on:** [T038]
- **Parallel:** no
- **Story:** US3
- **Files:** `src/application/`, `src/domain/policies/`, `src/infrastructure/filesystem/`, `src/presentation/`, `tests/`, `tests/edits/`, `tests/workspace/`
- **Description:** Implement `PreviewWorkspaceEditUseCase` with base hashes.
- **Acceptance:** Implementation or documentation exists and current task status marks this item complete; keep evidence current if behavior changes.
- **Evidence:** Migrated from completed checkbox in the pre-migration task ledger. Current validation evidence: `pnpm typecheck` passed and `pnpm test` passed on 2026-06-02.

### Task T054: Implement `ApplyWorkspaceEditUseCase` with path containment and stale-preview rejection

- **ID:** T054
- **Status:** done
- **Depends on:** [T038]
- **Parallel:** no
- **Story:** US3
- **Files:** `src/application/`, `src/domain/policies/`, `src/infrastructure/filesystem/`, `src/presentation/`, `tests/`, `tests/edits/`, `tests/workspace/`
- **Description:** Implement `ApplyWorkspaceEditUseCase` with path containment and stale-preview rejection.
- **Acceptance:** Implementation or documentation exists and current task status marks this item complete; keep evidence current if behavior changes.
- **Evidence:** Migrated from completed checkbox in the pre-migration task ledger. Current validation evidence: `pnpm typecheck` passed and `pnpm test` passed on 2026-06-02.

### Task T055: Implement `PlanVerificationUseCase` without command execution, distinguishing planned checks from proven runnable checks and routing low-confidence discovery to exact follow-up actions. Touched-file static feedback is represented as an optional, read-only `static_feedback` section

- **ID:** T055
- **Status:** done
- **Depends on:** [T038]
- **Parallel:** no
- **Story:** —
- **Files:** `src/application/`, `src/domain/policies/`, `src/infrastructure/filesystem/`, `src/presentation/`, `tests/`, `tests/edits/`, `tests/workspace/`
- **Description:** Implement `PlanVerificationUseCase` without command execution, distinguishing planned checks from proven runnable checks and routing low-confidence discovery to exact follow-up actions. Touched-file static feedback is represented as an optional, read-only `static_feedback` section.
- **Acceptance:** Implementation or documentation exists and current task status marks this item complete; keep evidence current if behavior changes.
- **Evidence:** Migrated from completed checkbox in the pre-migration task ledger. Current validation evidence: `pnpm typecheck` passed and `pnpm test` passed on 2026-06-02.

### Task T056: Implement `DescribeIntegrationProfileUseCase` for common coding-agent integration metadata without generating vendor-specific artifacts

- **ID:** T056
- **Status:** done
- **Depends on:** [T038]
- **Parallel:** no
- **Story:** —
- **Files:** `docs/`, `src/application/`, `src/domain/policies/`, `src/infrastructure/filesystem/`, `src/infrastructure/telemetry/`, `src/integration/`, `src/presentation/`, `tests/`, `tests/edits/`, `tests/integration/`, `tests/mcp/telemetry-instrumentation.test.ts`, `tests/telemetry/`, `tests/workspace/`
- **Description:** Implement `DescribeIntegrationProfileUseCase` for common coding-agent integration metadata without generating vendor-specific artifacts.
- **Acceptance:** Implementation or documentation exists and current task status marks this item complete; keep evidence current if behavior changes.
- **Evidence:** Migrated from completed checkbox in the pre-migration task ledger. Current validation evidence: `pnpm typecheck` passed and `pnpm test` passed on 2026-06-02.

### Task T056A: Implement Codex integration profile output that reports which Codex features are active in MVP, which wrappers are available, and why MCP remains the executable source of truth

- **ID:** T056A
- **Status:** done
- **Depends on:** [T038]
- **Parallel:** no
- **Story:** —
- **Files:** `docs/`, `src/infrastructure/telemetry/`, `src/integration/`, `src/interface-adapters/mcp/`, `src/mcp/`, `tests/integration/`, `tests/mcp/`, `tests/mcp/telemetry-instrumentation.test.ts`, `tests/telemetry/`
- **Description:** Implement Codex integration profile output that reports which Codex features are active in MVP, which wrappers are available, and why MCP remains the executable source of truth.
- **Acceptance:** Implementation or documentation exists and current task status marks this item complete; keep evidence current if behavior changes.
- **Evidence:** Migrated from completed checkbox in the pre-migration task ledger. Current validation evidence: `pnpm typecheck` passed and `pnpm test` passed on 2026-06-02.

### Task T057: Implement freshness, capability, confidence, budget, attention, validation, and workspace safety policies used by the use cases

- **ID:** T057
- **Status:** done
- **Depends on:** [T038]
- **Parallel:** no
- **Story:** —
- **Files:** `src/application/`, `src/domain/policies/`, `src/infrastructure/filesystem/`, `src/presentation/`, `tests/`, `tests/edits/`, `tests/workspace/`
- **Description:** Implement freshness, capability, confidence, budget, attention, validation, and workspace safety policies used by the use cases.
- **Acceptance:** Required implementation, contract, documentation, and fixture-backed proof are present for this task.
- **Evidence:** Reconciled on 2026-06-03. This early-phase coverage task is satisfied by the completed MVP gap, cross-cutting, and usage-informed validation streams. See completed tasks T200-T206, T080-T089, and T098-T102B plus verification evidence: `pnpm typecheck` passed and `pnpm test` passed with 37 test files and 193 tests.

### Task T058: Implement cache validity and snapshot validity policies used by the use cases

- **ID:** T058
- **Status:** done
- **Depends on:** [T038]
- **Parallel:** no
- **Story:** —
- **Files:** `src/application/`, `src/domain/`, `src/infrastructure/`, `src/ports/`, `src/presentation/`, `tests/`, `tests/graph/`
- **Description:** Implement cache validity and snapshot validity policies used by the use cases.
- **Acceptance:** Required implementation, contract, documentation, and fixture-backed proof are present for this task.
- **Evidence:** Reconciled on 2026-06-03. This early-phase coverage task is satisfied by the completed MVP gap, cross-cutting, and usage-informed validation streams. See completed tasks T200-T206, T080-T089, and T098-T102B plus verification evidence: `pnpm typecheck` passed and `pnpm test` passed with 37 test files and 193 tests.

### Task T058A: Implement schema translation policies that map backend parser, diagnostic, validation, test-discovery, and worker outputs into public MCP schemas without leaking backend names or raw payloads

- **ID:** T058A
- **Status:** done
- **Depends on:** [T038]
- **Parallel:** no
- **Story:** —
- **Files:** `src/domain/`, `src/infrastructure/`, `src/interface-adapters/mcp/`, `src/mcp/`, `src/ports/`, `tests/`, `tests/graph/`, `tests/mcp/`
- **Description:** Implement schema translation policies that map backend parser, diagnostic, validation, test-discovery, and worker outputs into public MCP schemas without leaking backend names or raw payloads.
- **Acceptance:** Required implementation, contract, documentation, and fixture-backed proof are present for this task.
- **Evidence:** Reconciled on 2026-06-03. This early-phase coverage task is satisfied by the completed MVP gap, cross-cutting, and usage-informed validation streams. See completed tasks T200-T206, T080-T089, and T098-T102B plus verification evidence: `pnpm typecheck` passed and `pnpm test` passed with 37 test files and 193 tests.

## Phase 5: Presentation Layer

### Task T059: Implement shared response envelope presenter

- **ID:** T059
- **Status:** done
- **Depends on:** [T045]
- **Parallel:** no
- **Story:** —
- **Files:** `src/`
- **Description:** Implement shared response envelope presenter.
- **Acceptance:** Required implementation, contract, documentation, and fixture-backed proof are present for this task.
- **Evidence:** Reconciled on 2026-06-03. This early-phase coverage task is satisfied by the completed MVP gap, cross-cutting, and usage-informed validation streams. See completed tasks T200-T206, T080-T089, and T098-T102B plus verification evidence: `pnpm typecheck` passed and `pnpm test` passed with 37 test files and 193 tests.

### Task T060: Implement metadata presenter for freshness, capability, evidence, verification, budgets, truncation, and scope

- **ID:** T060
- **Status:** done
- **Depends on:** [T045]
- **Parallel:** no
- **Story:** —
- **Files:** `src/application/`, `src/presentation/`, `tests/`
- **Description:** Implement metadata presenter for freshness, capability, evidence, verification, budgets, truncation, and scope.
- **Acceptance:** Required implementation, contract, documentation, and fixture-backed proof are present for this task.
- **Evidence:** Reconciled on 2026-06-03. This early-phase coverage task is satisfied by the completed MVP gap, cross-cutting, and usage-informed validation streams. See completed tasks T200-T206, T080-T089, and T098-T102B plus verification evidence: `pnpm typecheck` passed and `pnpm test` passed with 37 test files and 193 tests.

### Task T061: Implement warm-up/cache/concurrency metadata presentation for status and degraded responses

- **ID:** T061
- **Status:** done
- **Depends on:** [T045]
- **Parallel:** no
- **Story:** —
- **Files:** `src/application/`, `src/presentation/`, `tests/`
- **Description:** Implement warm-up/cache/concurrency metadata presentation for status and degraded responses.
- **Acceptance:** Required implementation, contract, documentation, and fixture-backed proof are present for this task.
- **Evidence:** Reconciled on 2026-06-03. This early-phase coverage task is satisfied by the completed MVP gap, cross-cutting, and usage-informed validation streams. See completed tasks T200-T206, T080-T089, and T098-T102B plus verification evidence: `pnpm typecheck` passed and `pnpm test` passed with 37 test files and 193 tests.

### Task T062: Implement warning/blocker attention presenter

- **ID:** T062
- **Status:** done
- **Depends on:** [T045]
- **Parallel:** no
- **Story:** —
- **Files:** `src/`
- **Description:** Implement warning/blocker attention presenter.
- **Acceptance:** Required implementation, contract, documentation, and fixture-backed proof are present for this task.
- **Evidence:** Reconciled on 2026-06-03. This early-phase coverage task is satisfied by the completed MVP gap, cross-cutting, and usage-informed validation streams. See completed tasks T200-T206, T080-T089, and T098-T102B plus verification evidence: `pnpm typecheck` passed and `pnpm test` passed with 37 test files and 193 tests.

### Task T063: Implement error and next-action presenter support with retryable `next_action` shape for direct reads, `symbol_search`, `find_references`, `impact`, preview/apply, and validation follow-up actions, plus quiet `static_feedback` presentation for `verification_plan`

- **ID:** T063
- **Status:** done
- **Depends on:** [T045]
- **Parallel:** no
- **Story:** —
- **Files:** `src/application/`, `src/presentation/`, `tests/`
- **Description:** Implement error and next-action presenter support with retryable `next_action` shape for direct reads, `symbol_search`, `find_references`, `impact`, preview/apply, and validation follow-up actions, plus quiet `static_feedback` presentation for `verification_plan`.
- **Acceptance:** Required implementation, contract, documentation, and fixture-backed proof are present for this task.
- **Evidence:** Reconciled on 2026-06-03. This early-phase coverage task is satisfied by the completed MVP gap, cross-cutting, and usage-informed validation streams. See completed tasks T200-T206, T080-T089, and T098-T102B plus verification evidence: `pnpm typecheck` passed and `pnpm test` passed with 37 test files and 193 tests.

### Task T064: Implement source section presenter with byte and row budgets

- **ID:** T064
- **Status:** done
- **Depends on:** [T045]
- **Parallel:** no
- **Story:** —
- **Files:** `tests/`
- **Description:** Implement source section presenter with byte and row budgets.
- **Acceptance:** Required implementation, contract, documentation, and fixture-backed proof are present for this task.
- **Evidence:** Reconciled on 2026-06-03. This early-phase coverage task is satisfied by the completed MVP gap, cross-cutting, and usage-informed validation streams. See completed tasks T200-T206, T080-T089, and T098-T102B plus verification evidence: `pnpm typecheck` passed and `pnpm test` passed with 37 test files and 193 tests.

### Task T065: Implement integration profile presenter for agent target surfaces, unsupported capabilities, provenance, and regeneration safety

- **ID:** T065
- **Status:** done
- **Depends on:** [T045]
- **Parallel:** no
- **Story:** —
- **Files:** `docs/`, `src/domain/policies/`, `src/infrastructure/filesystem/`, `src/infrastructure/telemetry/`, `src/integration/`, `tests/edits/`, `tests/integration/`, `tests/mcp/telemetry-instrumentation.test.ts`, `tests/telemetry/`, `tests/workspace/`
- **Description:** Implement integration profile presenter for agent target surfaces, unsupported capabilities, provenance, and regeneration safety.
- **Acceptance:** Required implementation, contract, documentation, and fixture-backed proof are present for this task.
- **Evidence:** Reconciled on 2026-06-03. This early-phase coverage task is satisfied by the completed MVP gap, cross-cutting, and usage-informed validation streams. See completed tasks T200-T206, T080-T089, and T098-T102B plus verification evidence: `pnpm typecheck` passed and `pnpm test` passed with 37 test files and 193 tests.

### Task T065A: Implement Codex profile presentation for `AGENTS.md`, MCP config, stdio live-checkout launch, debug CLI, skill guidance, plugin packaging, optional hooks, and update/restart behavior

- **ID:** T065A
- **Status:** done
- **Depends on:** [T045]
- **Parallel:** no
- **Story:** —
- **Files:** `docs/`, `src/infrastructure/telemetry/`, `src/integration/`, `src/interface-adapters/mcp/`, `src/mcp/`, `tests/integration/`, `tests/mcp/`, `tests/mcp/telemetry-instrumentation.test.ts`, `tests/telemetry/`
- **Description:** Implement Codex profile presentation for `AGENTS.md`, MCP config, stdio live-checkout launch, debug CLI, skill guidance, plugin packaging, optional hooks, and update/restart behavior.
- **Acceptance:** Implementation or documentation exists and current task status marks this item complete; keep evidence current if behavior changes.
- **Evidence:** Migrated from completed checkbox in the pre-migration task ledger. Current validation evidence: `pnpm typecheck` passed and `pnpm test` passed on 2026-06-02.

### Task T066: Add presenter-level golden response tests for all MVP resources and tools

- **ID:** T066
- **Status:** done
- **Depends on:** [T045]
- **Parallel:** no
- **Story:** —
- **Files:** `src/interface-adapters/mcp/`, `src/mcp/`, `tests/`, `tests/mcp/`
- **Description:** Add presenter-level golden response tests for all MVP resources and tools.
- **Acceptance:** Required implementation, contract, documentation, and fixture-backed proof are present for this task.
- **Evidence:** Reconciled on 2026-06-03. This early-phase coverage task is satisfied by the completed MVP gap, cross-cutting, and usage-informed validation streams. See completed tasks T200-T206, T080-T089, and T098-T102B plus verification evidence: `pnpm typecheck` passed and `pnpm test` passed with 37 test files and 193 tests.

## Phase 6: MCP Interface Adapter

### Task T067: Implement shared MCP typed argument parsers and structured invalid-input responses

- **ID:** T067
- **Status:** done
- **Depends on:** [T059]
- **Parallel:** no
- **Story:** —
- **Files:** `src/domain/`, `src/infrastructure/`, `src/interface-adapters/mcp/`, `src/mcp/`, `src/ports/`, `tests/graph/`, `tests/mcp/`
- **Description:** Implement shared MCP typed argument parsers and structured invalid-input responses.
- **Acceptance:** Required implementation, contract, documentation, and fixture-backed proof are present for this task.
- **Evidence:** Reconciled on 2026-06-03. This early-phase coverage task is satisfied by the completed MVP gap, cross-cutting, and usage-informed validation streams. See completed tasks T200-T206, T080-T089, and T098-T102B plus verification evidence: `pnpm typecheck` passed and `pnpm test` passed with 37 test files and 193 tests.

### Task T068: Implement MCP server/resource/tool/prompt registration and schema binding as a thin adapter over use cases and presenters

- **ID:** T068
- **Status:** done
- **Depends on:** [T059]
- **Parallel:** no
- **Story:** —
- **Files:** `src/application/`, `src/interface-adapters/mcp/`, `src/mcp/`, `src/presentation/`, `tests/`, `tests/mcp/`
- **Description:** Implement MCP server/resource/tool/prompt registration and schema binding as a thin adapter over use cases and presenters.
- **Acceptance:** Required implementation, contract, documentation, and fixture-backed proof are present for this task.
- **Evidence:** Reconciled on 2026-06-03. This early-phase coverage task is satisfied by the completed MVP gap, cross-cutting, and usage-informed validation streams. See completed tasks T200-T206, T080-T089, and T098-T102B plus verification evidence: `pnpm typecheck` passed and `pnpm test` passed with 37 test files and 193 tests.

### Task T069: Wire `repo:///status` through MCP schema, use case, and presenter

- **ID:** T069
- **Status:** done
- **Depends on:** [T059]
- **Parallel:** yes
- **Story:** US1
- **Files:** `src/application/`, `src/interface-adapters/mcp/`, `src/mcp/`, `src/presentation/`, `tests/`, `tests/mcp/`
- **Description:** Wire `repo:///status` through MCP schema, use case, and presenter.
- **Acceptance:** Implementation or documentation exists and current task status marks this item complete; keep evidence current if behavior changes.
- **Evidence:** Migrated from completed checkbox in the pre-migration task ledger. Current validation evidence: `pnpm typecheck` passed and `pnpm test` passed on 2026-06-02.

### Task T070: Wire `repo:///scope` through MCP schema, use case, and presenter

- **ID:** T070
- **Status:** done
- **Depends on:** [T059]
- **Parallel:** yes
- **Story:** US1
- **Files:** `src/application/`, `src/interface-adapters/mcp/`, `src/mcp/`, `src/presentation/`, `tests/`, `tests/mcp/`
- **Description:** Wire `repo:///scope` through MCP schema, use case, and presenter.
- **Acceptance:** Implementation or documentation exists and current task status marks this item complete; keep evidence current if behavior changes.
- **Evidence:** Migrated from completed checkbox in the pre-migration task ledger. Current validation evidence: `pnpm typecheck` passed and `pnpm test` passed on 2026-06-02.

### Task T071: Wire `repo:///overview` through MCP schema, use case, and presenter

- **ID:** T071
- **Status:** done
- **Depends on:** [T059]
- **Parallel:** yes
- **Story:** US1
- **Files:** `src/application/`, `src/interface-adapters/mcp/`, `src/mcp/`, `src/presentation/`, `tests/`, `tests/mcp/`
- **Description:** Wire `repo:///overview` through MCP schema, use case, and presenter.
- **Acceptance:** Implementation or documentation exists and current task status marks this item complete; keep evidence current if behavior changes.
- **Evidence:** Migrated from completed checkbox in the pre-migration task ledger. Current validation evidence: `pnpm typecheck` passed and `pnpm test` passed on 2026-06-02.

### Task T072: Wire `context_for_task` through MCP schema, use case, and presenter

- **ID:** T072
- **Status:** done
- **Depends on:** [T059]
- **Parallel:** no
- **Story:** US1
- **Files:** `src/application/`, `src/interface-adapters/mcp/`, `src/mcp/`, `src/presentation/`, `tests/`, `tests/mcp/`
- **Description:** Wire `context_for_task` through MCP schema, use case, and presenter.
- **Acceptance:** Implementation or documentation exists and current task status marks this item complete; keep evidence current if behavior changes.
- **Evidence:** Migrated from completed checkbox in the pre-migration task ledger. Current validation evidence: `pnpm typecheck` passed and `pnpm test` passed on 2026-06-02.

### Task T073: Wire `symbol_search` through MCP schema, use case, and presenter

- **ID:** T073
- **Status:** done
- **Depends on:** [T059]
- **Parallel:** no
- **Story:** US2
- **Files:** `src/application/`, `src/interface-adapters/mcp/`, `src/mcp/`, `src/presentation/`, `tests/`, `tests/mcp/`
- **Description:** Wire `symbol_search` through MCP schema, use case, and presenter.
- **Acceptance:** Implementation or documentation exists and current task status marks this item complete; keep evidence current if behavior changes.
- **Evidence:** Migrated from completed checkbox in the pre-migration task ledger. Current validation evidence: `pnpm typecheck` passed and `pnpm test` passed on 2026-06-02.

### Task T074: Wire `find_references` through MCP schema, use case, and presenter

- **ID:** T074
- **Status:** done
- **Depends on:** [T059]
- **Parallel:** no
- **Story:** US2
- **Files:** `src/application/`, `src/interface-adapters/mcp/`, `src/mcp/`, `src/presentation/`, `tests/`, `tests/mcp/`
- **Description:** Wire `find_references` through MCP schema, use case, and presenter.
- **Acceptance:** Implementation or documentation exists and current task status marks this item complete; keep evidence current if behavior changes.
- **Evidence:** Migrated from completed checkbox in the pre-migration task ledger. Current validation evidence: `pnpm typecheck` passed and `pnpm test` passed on 2026-06-02.

### Task T075: Wire bounded `impact` through MCP schema, use case, and presenter

- **ID:** T075
- **Status:** done
- **Depends on:** [T059]
- **Parallel:** no
- **Story:** US2
- **Files:** `src/application/`, `src/interface-adapters/mcp/`, `src/mcp/`, `src/presentation/`, `tests/`, `tests/mcp/`
- **Description:** Wire bounded `impact` through MCP schema, use case, and presenter.
- **Acceptance:** Implementation or documentation exists and current task status marks this item complete; keep evidence current if behavior changes.
- **Evidence:** Migrated from completed checkbox in the pre-migration task ledger. Current validation evidence: `pnpm typecheck` passed and `pnpm test` passed on 2026-06-02.

### Task T076: Wire `preview_workspace_edit` through MCP schema, use case, and presenter

- **ID:** T076
- **Status:** done
- **Depends on:** [T059]
- **Parallel:** no
- **Story:** US3
- **Files:** `src/application/`, `src/domain/policies/`, `src/infrastructure/filesystem/`, `src/interface-adapters/mcp/`, `src/mcp/`, `src/presentation/`, `tests/`, `tests/edits/`, `tests/mcp/`, `tests/workspace/`
- **Description:** Wire `preview_workspace_edit` through MCP schema, use case, and presenter.
- **Acceptance:** Implementation or documentation exists and current task status marks this item complete; keep evidence current if behavior changes.
- **Evidence:** Migrated from completed checkbox in the pre-migration task ledger. Current validation evidence: `pnpm typecheck` passed and `pnpm test` passed on 2026-06-02.

### Task T077: Wire `apply_workspace_edit` through MCP schema, use case, and presenter

- **ID:** T077
- **Status:** done
- **Depends on:** [T059]
- **Parallel:** no
- **Story:** US3
- **Files:** `src/application/`, `src/domain/policies/`, `src/infrastructure/filesystem/`, `src/interface-adapters/mcp/`, `src/mcp/`, `src/presentation/`, `tests/`, `tests/edits/`, `tests/mcp/`, `tests/workspace/`
- **Description:** Wire `apply_workspace_edit` through MCP schema, use case, and presenter.
- **Acceptance:** Implementation or documentation exists and current task status marks this item complete; keep evidence current if behavior changes.
- **Evidence:** Migrated from completed checkbox in the pre-migration task ledger. Current validation evidence: `pnpm typecheck` passed and `pnpm test` passed on 2026-06-02.

### Task T078: Wire `verification_plan` through MCP schema, use case, and presenter, including optional quiet `static_feedback` for touched files

- **ID:** T078
- **Status:** done
- **Depends on:** [T059]
- **Parallel:** no
- **Story:** US3
- **Files:** `src/application/`, `src/interface-adapters/mcp/`, `src/mcp/`, `src/presentation/`, `tests/`, `tests/mcp/`
- **Description:** Wire `verification_plan` through MCP schema, use case, and presenter, including optional quiet `static_feedback` for touched files.
- **Acceptance:** Implementation or documentation exists and current task status marks this item complete; keep evidence current if behavior changes.
- **Evidence:** Migrated from completed checkbox in the pre-migration task ledger. Current validation evidence: `pnpm typecheck` passed and `pnpm test` passed on 2026-06-02.

### Task T079: Wire `repo:///agent-integration-profile` through MCP schema, use case, and presenter as a read-only post-MVP-discovery resource. MVP requires common integration contracts and boundary tests; this resource is included only if the first integration slice explicitly promotes it

- **ID:** T079
- **Status:** skipped
- **Depends on:** [T059]
- **Parallel:** no
- **Story:** —
- **Files:** `docs/`, `src/application/`, `src/infrastructure/telemetry/`, `src/integration/`, `src/interface-adapters/mcp/`, `src/mcp/`, `src/presentation/`, `tests/`, `tests/integration/`, `tests/mcp/`, `tests/mcp/telemetry-instrumentation.test.ts`, `tests/telemetry/`
- **Description:** Wire `repo:///agent-integration-profile` through MCP schema, use case, and presenter as a read-only post-MVP-discovery resource. MVP requires common integration contracts and boundary tests; this resource is included only if the first integration slice explicitly promotes it.
- **Acceptance:** Required implementation, contract, documentation, and fixture-backed proof are present for this task.
- **Evidence:** Skipped on 2026-06-03. Superseded for MVP by the promoted Codex-specific `integration:///profiles/codex` resource and common integration profile tests; the generic `repo:///agent-integration-profile` resource remains post-MVP unless explicitly promoted.

### Task T079D: Add Codex integration profile schema coverage proving MVP feature mapping is explicit and no skill, plugin, or hook artifact is treated as a second executable runtime path

- **ID:** T079D
- **Status:** done
- **Depends on:** [T059]
- **Parallel:** no
- **Story:** —
- **Files:** `docs/`, `src/domain/policies/`, `src/infrastructure/filesystem/`, `src/infrastructure/telemetry/`, `src/integration/`, `src/interface-adapters/mcp/`, `src/mcp/`, `tests/`, `tests/edits/`, `tests/integration/`, `tests/mcp/`, `tests/mcp/telemetry-instrumentation.test.ts`, `tests/telemetry/`, `tests/workspace/`
- **Description:** Add Codex integration profile schema coverage proving MVP feature mapping is explicit and no skill, plugin, or hook artifact is treated as a second executable runtime path.
- **Acceptance:** Implementation or documentation exists and current task status marks this item complete; keep evidence current if behavior changes.
- **Evidence:** Migrated from completed checkbox in the pre-migration task ledger. Current validation evidence: `pnpm typecheck` passed and `pnpm test` passed on 2026-06-02.

### Task T079A: Add a stdio MCP process entrypoint that composes the production server from repository source code, connects `StdioServerTransport`, and keeps transport setup separate from registry/resource/tool implementation

- **ID:** T079A
- **Status:** done
- **Depends on:** [T059]
- **Parallel:** no
- **Story:** —
- **Files:** `src/interface-adapters/mcp/`, `src/mcp/`, `tests/mcp/`
- **Description:** Add a stdio MCP process entrypoint that composes the production server from repository source code, connects `StdioServerTransport`, and keeps transport setup separate from registry/resource/tool implementation.
- **Acceptance:** Implementation or documentation exists and current task status marks this item complete; keep evidence current if behavior changes.
- **Evidence:** Migrated from completed checkbox in the pre-migration task ledger. Current validation evidence: `pnpm typecheck` passed and `pnpm test` passed on 2026-06-02.

### Task T079B: Add a host-level Codex MCP install/runbook task that documents how to point Codex at this checkout with absolute paths so all Codex sessions on the host use the latest repo code after restart without reinstalling

- **ID:** T079B
- **Status:** done
- **Depends on:** [T059]
- **Parallel:** no
- **Story:** —
- **Files:** `docs/`, `src/domain/policies/`, `src/infrastructure/filesystem/`, `src/integration/`, `src/interface-adapters/mcp/`, `src/mcp/`, `tests/`, `tests/edits/`, `tests/integration/`, `tests/mcp/`, `tests/workspace/`
- **Description:** Add a host-level Codex MCP install/runbook task that documents how to point Codex at this checkout with absolute paths so all Codex sessions on the host use the latest repo code after restart without reinstalling.
- **Acceptance:** Implementation or documentation exists and current task status marks this item complete; keep evidence current if behavior changes.
- **Evidence:** Migrated from completed checkbox in the pre-migration task ledger. Current validation evidence: `pnpm typecheck` passed and `pnpm test` passed on 2026-06-02.

### Task T079C: Define default repo-root behavior for host-level MCP launches, including explicit `repo_root` arguments, `AGENT_WORKBENCH_DEFAULT_REPO_ROOT`, and tests for launch directories that are not the target project

- **ID:** T079C
- **Status:** done
- **Depends on:** [T059]
- **Parallel:** no
- **Story:** —
- **Files:** `docs/`, `src/integration/`, `src/interface-adapters/mcp/`, `src/mcp/`, `tests/`, `tests/integration/`, `tests/mcp/`
- **Description:** Define default repo-root behavior for host-level MCP launches, including explicit `repo_root` arguments, `AGENT_WORKBENCH_DEFAULT_REPO_ROOT`, and tests for launch directories that are not the target project.
- **Acceptance:** Implementation or documentation exists and current task status marks this item complete; keep evidence current if behavior changes.
- **Evidence:** Migrated from completed checkbox in the pre-migration task ledger. Current validation evidence: `pnpm typecheck` passed and `pnpm test` passed on 2026-06-02.

## Gap 1: Repo Orientation Surfaces

### Task T200: Complete the first-pass repo orientation surfaces: `repo:///status`, `repo:///scope`, and `repo:///overview`

- **ID:** T200
- **Status:** done
- **Depends on:** []
- **Parallel:** no
- **Story:** US1
- **Files:** `src/application/`, `src/interface-adapters/mcp/`, `src/mcp/`, `src/presentation/`, `tests/`, `tests/mcp/`
- **Description:** Complete the first-pass repo orientation surfaces: `repo:///status`, `repo:///scope`, and `repo:///overview`.
- **Acceptance:** Implementation or documentation exists and current task status marks this item complete; keep evidence current if behavior changes.
- **Evidence:** Migrated from completed checkbox in the pre-migration task ledger. Current validation evidence: `pnpm typecheck` passed and `pnpm test` passed on 2026-06-02.

### Task T200.1: Keep `repo:///status` backed by repository scanning, adapter coverage, freshness, scope, budgets, and shared envelope presentation

- **ID:** T200.1
- **Status:** done
- **Depends on:** [T200]
- **Parallel:** no
- **Story:** —
- **Files:** `src/application/`, `src/interface-adapters/mcp/`, `src/mcp/`, `src/presentation/`, `tests/`, `tests/mcp/`
- **Description:** Keep `repo:///status` backed by repository scanning, adapter coverage, freshness, scope, budgets, and shared envelope presentation.
- **Acceptance:** Implementation or documentation exists and current task status marks this item complete; keep evidence current if behavior changes.
- **Evidence:** Migrated from completed checkbox in the pre-migration task ledger. Current validation evidence: `pnpm typecheck` passed and `pnpm test` passed on 2026-06-02.

### Task T200.2: Implement `GetRepoScopeUseCase` over the same repo binding and file catalog evidence used by status

- **ID:** T200.2
- **Status:** done
- **Depends on:** [T200]
- **Parallel:** no
- **Story:** —
- **Files:** `src/application/`, `src/presentation/`, `tests/`
- **Description:** Implement `GetRepoScopeUseCase` over the same repo binding and file catalog evidence used by status.
- **Acceptance:** Implementation or documentation exists and current task status marks this item complete; keep evidence current if behavior changes.
- **Evidence:** Migrated from completed checkbox in the pre-migration task ledger. Current validation evidence: `pnpm typecheck` passed and `pnpm test` passed on 2026-06-02.

### Task T200.3: Implement `GetRepoOverviewUseCase` with compact summary, language/platform coverage, fixture counts, and no source dump

- **ID:** T200.3
- **Status:** done
- **Depends on:** [T200]
- **Parallel:** no
- **Story:** —
- **Files:** `src/application/`, `src/presentation/`, `tests/`
- **Description:** Implement `GetRepoOverviewUseCase` with compact summary, language/platform coverage, fixture counts, and no source dump.
- **Acceptance:** Implementation or documentation exists and current task status marks this item complete; keep evidence current if behavior changes.
- **Evidence:** Migrated from completed checkbox in the pre-migration task ledger. Current validation evidence: `pnpm typecheck` passed and `pnpm test` passed on 2026-06-02.

### Task T200.4: Add presenter-level golden responses for status, scope, and overview across `fixture-basic-python`, `fixture-markdown-config`, and `fixture-mixed-language-platform`

- **ID:** T200.4
- **Status:** done
- **Depends on:** [T200]
- **Parallel:** no
- **Story:** —
- **Files:** `docs/`, `src/application/`, `src/presentation/`, `tests/`
- **Description:** Add presenter-level golden responses for status, scope, and overview across `fixture-basic-python`, `fixture-markdown-config`, and `fixture-mixed-language-platform`.
- **Acceptance:** Implementation or documentation exists and current task status marks this item complete; keep evidence current if behavior changes.
- **Evidence:** Migrated from completed checkbox in the pre-migration task ledger. Current validation evidence: `pnpm typecheck` passed and `pnpm test` passed on 2026-06-02.

### Task T200.5: Wire `repo:///scope` and `repo:///overview` through MCP resources using typed argument parsing and thin handlers

- **ID:** T200.5
- **Status:** done
- **Depends on:** [T200]
- **Parallel:** no
- **Story:** —
- **Files:** `src/application/`, `src/interface-adapters/mcp/`, `src/mcp/`, `src/presentation/`, `tests/`, `tests/mcp/`
- **Description:** Wire `repo:///scope` and `repo:///overview` through MCP resources using typed argument parsing and thin handlers.
- **Acceptance:** Implementation or documentation exists and current task status marks this item complete; keep evidence current if behavior changes.
- **Evidence:** Migrated from completed checkbox in the pre-migration task ledger. Current validation evidence: `pnpm typecheck` passed and `pnpm test` passed on 2026-06-02.

### Task T200.6: Add proof that mixed-language/platform scope is represented without Python-specific shared response fields

- **ID:** T200.6
- **Status:** done
- **Depends on:** [T200]
- **Parallel:** no
- **Story:** —
- **Files:** `src/application/`, `src/presentation/`, `tests/`
- **Description:** Add proof that mixed-language/platform scope is represented without Python-specific shared response fields.
- **Acceptance:** Implementation or documentation exists and current task status marks this item complete; keep evidence current if behavior changes.
- **Evidence:** Migrated from completed checkbox in the pre-migration task ledger. Current validation evidence: `pnpm typecheck` passed and `pnpm test` passed on 2026-06-02.

### Task T200.7: Add budget tests proving default orientation responses stay bounded and do not perform hidden broad source reads

- **ID:** T200.7
- **Status:** done
- **Depends on:** [T200]
- **Parallel:** no
- **Story:** —
- **Files:** `tests/`
- **Description:** Add budget tests proving default orientation responses stay bounded and do not perform hidden broad source reads.
- **Acceptance:** Implementation or documentation exists and current task status marks this item complete; keep evidence current if behavior changes.
- **Evidence:** Migrated from completed checkbox in the pre-migration task ledger. Current validation evidence: `pnpm typecheck` passed and `pnpm test` passed on 2026-06-02.

## Gap 2: Graph Extraction Pipeline

### Task T201: Complete the graph extraction pipeline from repository scan to queryable SQLite evidence

- **ID:** T201
- **Status:** done
- **Depends on:** [T200]
- **Parallel:** no
- **Story:** US2
- **Files:** `src/domain/`, `src/infrastructure/`, `src/ports/`, `tests/graph/`
- **Description:** Complete the graph extraction pipeline from repository scan to queryable SQLite evidence.
- **Acceptance:** Implementation or documentation exists and current task status marks this item complete; keep evidence current if behavior changes.
- **Evidence:** Migrated from completed checkbox in the pre-migration task ledger. Current validation evidence: `pnpm typecheck` passed and `pnpm test` passed on 2026-06-02.

### Task T201.1: Implement snapshot creation, freshness transitions, and repo identity/config identity checks before extraction writes

- **ID:** T201.1
- **Status:** done
- **Depends on:** [T201]
- **Parallel:** no
- **Story:** —
- **Files:** `src/domain/`, `src/infrastructure/`, `src/ports/`, `tests/`, `tests/graph/`
- **Description:** Implement snapshot creation, freshness transitions, and repo identity/config identity checks before extraction writes.
- **Acceptance:** Implementation or documentation exists and current task status marks this item complete; keep evidence current if behavior changes.
- **Evidence:** Migrated from completed checkbox in the pre-migration task ledger. Current validation evidence: `pnpm typecheck` passed and `pnpm test` passed on 2026-06-02.

### Task T201.2: Normalize scanned files into `ExtractionRequest` batches with file identity, adapter capability, provenance, confidence, and source range conventions

- **ID:** T201.2
- **Status:** done
- **Depends on:** [T201]
- **Parallel:** no
- **Story:** —
- **Files:** `src/domain/`, `src/infrastructure/`, `src/ports/`, `tests/graph/`
- **Description:** Normalize scanned files into `ExtractionRequest` batches with file identity, adapter capability, provenance, confidence, and source range conventions.
- **Acceptance:** Implementation or documentation exists and current task status marks this item complete; keep evidence current if behavior changes.
- **Evidence:** Migrated from completed checkbox in the pre-migration task ledger. Current validation evidence: `pnpm typecheck` passed and `pnpm test` passed on 2026-06-02.

### Task T201.3: Implement Markdown/config resource-backed extraction through `ExtractorPort` without claiming semantic language support

- **ID:** T201.3
- **Status:** done
- **Depends on:** [T201]
- **Parallel:** no
- **Story:** —
- **Files:** `docs/`, `src/domain/`, `src/infrastructure/`, `src/interface-adapters/mcp/`, `src/mcp/`, `src/ports/`, `tests/graph/`, `tests/mcp/`
- **Description:** Implement Markdown/config resource-backed extraction through `ExtractorPort` without claiming semantic language support.
- **Acceptance:** Implementation or documentation exists and current task status marks this item complete; keep evidence current if behavior changes.
- **Evidence:** Migrated from completed checkbox in the pre-migration task ledger. Current validation evidence: `pnpm typecheck` passed and `pnpm test` passed on 2026-06-02.

### Task T201.4: Implement canonical tree-sitter Python extraction for symbols, imports, calls, source ranges, signatures, docstrings, diagnostics hints, and unresolved references

- **ID:** T201.4
- **Status:** done
- **Depends on:** [T201]
- **Parallel:** no
- **Story:** —
- **Files:** `docs/`, `src/application/`, `src/domain/`, `src/infrastructure/`, `src/ports/`, `src/presentation/`, `tests/`, `tests/graph/`
- **Description:** Implement canonical tree-sitter Python extraction for symbols, imports, calls, source ranges, signatures, docstrings, diagnostics hints, and unresolved references.
- **Acceptance:** Implementation or documentation exists and current task status marks this item complete; keep evidence current if behavior changes.
- **Evidence:** Migrated from completed checkbox in the pre-migration task ledger. Current validation evidence: `pnpm typecheck` passed and `pnpm test` passed on 2026-06-02.

### Task T201.5: Implement extraction ingestion that validates `ExtractionBatch`, writes files/nodes/edges/unresolved refs through graph ports, and keeps SQLite row models isolated in infrastructure

- **ID:** T201.5
- **Status:** done
- **Depends on:** [T201]
- **Parallel:** no
- **Story:** —
- **Files:** `src/domain/`, `src/infrastructure/`, `src/ports/`, `tests/graph/`
- **Description:** Implement extraction ingestion that validates `ExtractionBatch`, writes files/nodes/edges/unresolved refs through graph ports, and keeps SQLite row models isolated in infrastructure.
- **Acceptance:** Implementation or documentation exists and current task status marks this item complete; keep evidence current if behavior changes.
- **Evidence:** Migrated from completed checkbox in the pre-migration task ledger. Current validation evidence: `pnpm typecheck` passed and `pnpm test` passed on 2026-06-02.

### Task T201.6: Implement reference resolution for imports, duplicate names, ambiguous references, resolved edges, unresolved refs, confidence, and provenance

- **ID:** T201.6
- **Status:** done
- **Depends on:** [T201]
- **Parallel:** no
- **Story:** —
- **Files:** `src/application/`, `src/domain/`, `src/infrastructure/`, `src/ports/`, `src/presentation/`, `tests/`, `tests/graph/`
- **Description:** Implement reference resolution for imports, duplicate names, ambiguous references, resolved edges, unresolved refs, confidence, and provenance.
- **Acceptance:** Implementation or documentation exists and current task status marks this item complete; keep evidence current if behavior changes.
- **Evidence:** Migrated from completed checkbox in the pre-migration task ledger. Current validation evidence: `pnpm typecheck` passed and `pnpm test` passed on 2026-06-02.

### Task T201.7: Add add/modify/delete/rename cleanup tests that prove stale graph evidence is removed or marked stale by snapshot/file identity

- **ID:** T201.7
- **Status:** done
- **Depends on:** [T201]
- **Parallel:** no
- **Story:** —
- **Files:** `src/domain/`, `src/infrastructure/`, `src/ports/`, `tests/`, `tests/graph/`
- **Description:** Add add/modify/delete/rename cleanup tests that prove stale graph evidence is removed or marked stale by snapshot/file identity.
- **Acceptance:** Implementation or documentation exists and current task status marks this item complete; keep evidence current if behavior changes.
- **Evidence:** Migrated from completed checkbox in the pre-migration task ledger. Current validation evidence: `pnpm typecheck` passed and `pnpm test` passed on 2026-06-02.

### Task T201.8: Add fixture-backed tests proving non-Python files remain `unsupported` or `resource_backed` while Python is the only partial-semantic extraction path

- **ID:** T201.8
- **Status:** done
- **Depends on:** [T201]
- **Parallel:** no
- **Story:** —
- **Files:** `src/domain/`, `src/domain/policies/`, `src/infrastructure/`, `src/infrastructure/filesystem/`, `src/interface-adapters/mcp/`, `src/mcp/`, `src/ports/`, `tests/`, `tests/edits/`, `tests/graph/`, `tests/mcp/`, `tests/workspace/`
- **Description:** Add fixture-backed tests proving non-Python files remain `unsupported` or `resource_backed` while Python is the only partial-semantic extraction path.
- **Acceptance:** Implementation or documentation exists and current task status marks this item complete; keep evidence current if behavior changes.
- **Evidence:** Migrated from completed checkbox in the pre-migration task ledger. Current validation evidence: `pnpm typecheck` passed and `pnpm test` passed on 2026-06-02.

### Task T201.9: Add query-budget and transaction tests for extraction ingestion, FTS refresh, and graph reads used by MVP hot paths

- **ID:** T201.9
- **Status:** done
- **Depends on:** [T201]
- **Parallel:** no
- **Story:** —
- **Files:** `src/domain/`, `src/domain/policies/`, `src/infrastructure/`, `src/infrastructure/filesystem/`, `src/ports/`, `tests/`, `tests/edits/`, `tests/graph/`, `tests/workspace/`
- **Description:** Add query-budget and transaction tests for extraction ingestion, FTS refresh, and graph reads used by MVP hot paths.
- **Acceptance:** Implementation or documentation exists and current task status marks this item complete; keep evidence current if behavior changes.
- **Evidence:** Migrated from completed checkbox in the pre-migration task ledger. Current validation evidence: `pnpm typecheck` passed and `pnpm test` passed on 2026-06-02.

## Gap 3: Query Tools

### Task T202: Complete the read/query tools that turn indexed evidence into bounded coding-agent context

- **ID:** T202
- **Status:** done
- **Depends on:** [T201]
- **Parallel:** no
- **Story:** US1, US2
- **Files:** `docs/`, `src/application/`, `src/integration/`, `src/interface-adapters/mcp/`, `src/mcp/`, `src/presentation/`, `tests/`, `tests/integration/`, `tests/mcp/`
- **Description:** Complete the read/query tools that turn indexed evidence into bounded coding-agent context.
- **Acceptance:** Implementation, contract, and fixture-backed proof are present for this task.
- **Evidence:** `T202.1` through `T202.9` are complete. Validation: `pnpm typecheck` passed and `pnpm test` passed on 2026-06-02 (29 test files, 137 tests).

### Task T202.1: Implement `BuildTaskContextUseCase` with ranked files, ranked symbols, docs/config routing evidence, direct-read caveats, complete-enough markers, skipped-work metadata, and exact next actions

- **ID:** T202.1
- **Status:** done
- **Depends on:** [T202]
- **Parallel:** no
- **Story:** —
- **Files:** `docs/`, `src/application/`, `src/presentation/`, `tests/`
- **Description:** Implement `BuildTaskContextUseCase` with ranked files, ranked symbols, docs/config routing evidence, direct-read caveats, complete-enough markers, skipped-work metadata, and exact next actions.
- **Acceptance:** Implementation, contract, and fixture-backed proof are present for this task.
- **Evidence:** Implemented additive `TaskContext` schema fields for `ranked_symbols`, `skipped_work`, and `completeness`; wired graph-backed symbol ranking into `getTaskContext`; added fixture-backed context test. Validation: `pnpm typecheck` passed and `pnpm test` passed on 2026-06-02 (29 test files, 137 tests).

### Task T202.2: Implement `SearchSymbolsUseCase` with exact and fuzzy lookup, stable ordering, language/platform filtering, row limits, and no broad source scan

- **ID:** T202.2
- **Status:** done
- **Depends on:** [T202]
- **Parallel:** no
- **Story:** —
- **Files:** `src/application/`, `src/presentation/`, `tests/`
- **Description:** Implement `SearchSymbolsUseCase` with exact and fuzzy lookup, stable ordering, language/platform filtering, row limits, and no broad source scan.
- **Acceptance:** Implementation or documentation exists and current task status marks this item complete; keep evidence current if behavior changes.
- **Evidence:** Migrated from completed checkbox in the pre-migration task ledger. Current validation evidence: `pnpm typecheck` passed and `pnpm test` passed on 2026-06-02.

### Task T202.3: Implement `FindReferencesUseCase` with resolved references, unresolved references, ambiguity labels, confidence, provenance, and bounded depth

- **ID:** T202.3
- **Status:** done
- **Depends on:** [T202]
- **Parallel:** no
- **Story:** —
- **Files:** `src/application/`, `src/presentation/`, `tests/`
- **Description:** Implement `FindReferencesUseCase` with resolved references, unresolved references, ambiguity labels, confidence, provenance, and bounded depth.
- **Acceptance:** Implementation or documentation exists and current task status marks this item complete; keep evidence current if behavior changes.
- **Evidence:** Migrated from completed checkbox in the pre-migration task ledger. Current validation evidence: `pnpm typecheck` passed and `pnpm test` passed on 2026-06-02.

### Task T202.4: Implement `ComputeImpactUseCase` with bounded graph traversal, max-depth/max-node limits, truncation metadata, and affected file/symbol grouping

- **ID:** T202.4
- **Status:** done
- **Depends on:** [T202]
- **Parallel:** no
- **Story:** —
- **Files:** `src/application/`, `src/domain/`, `src/infrastructure/`, `src/ports/`, `src/presentation/`, `tests/`, `tests/graph/`
- **Description:** Implement `ComputeImpactUseCase` with bounded graph traversal, max-depth/max-node limits, truncation metadata, and affected file/symbol grouping.
- **Acceptance:** Implementation or documentation exists and current task status marks this item complete; keep evidence current if behavior changes.
- **Evidence:** Migrated from completed checkbox in the pre-migration task ledger. Current validation evidence: `pnpm typecheck` passed and `pnpm test` passed on 2026-06-02.

### Task T202.5: Add source-section presentation with byte budgets and explicit caveats when context contains routing evidence rather than verified source evidence

- **ID:** T202.5
- **Status:** done
- **Depends on:** [T202]
- **Parallel:** no
- **Story:** —
- **Files:** `src/application/`, `src/presentation/`, `tests/`
- **Description:** Add source-section presentation with byte budgets and explicit caveats when context contains routing evidence rather than verified source evidence.
- **Acceptance:** Implementation or documentation exists and current task status marks this item complete; keep evidence current if behavior changes.
- **Evidence:** Migrated from completed checkbox in the pre-migration task ledger. Current validation evidence: `pnpm typecheck` passed and `pnpm test` passed on 2026-06-02.

### Task T202.6: Add adoption-oriented tests proving `context_for_task` and `verification_plan` route ambiguous work to `symbol_search`, `find_references`, `impact`, or direct reads through structured `next_action` metadata

- **ID:** T202.6
- **Status:** done
- **Depends on:** [T202]
- **Parallel:** no
- **Story:** —
- **Files:** `src/application/`, `src/presentation/`, `tests/`
- **Description:** Add adoption-oriented tests proving `context_for_task` and `verification_plan` route ambiguous work to `symbol_search`, `find_references`, `impact`, or direct reads through structured `next_action` metadata.
- **Acceptance:** Implementation or documentation exists and current task status marks this item complete; keep evidence current if behavior changes.
- **Evidence:** Migrated from completed checkbox in the pre-migration task ledger. Current validation evidence: `pnpm typecheck` passed and `pnpm test` passed on 2026-06-02.

### Task T202.7: Add fixture-backed budget tests for `context_for_task`, `symbol_search`, `find_references`, and `impact`, including row limits, traversal depth, and source-byte caps

- **ID:** T202.7
- **Status:** done
- **Depends on:** [T202]
- **Parallel:** no
- **Story:** —
- **Files:** `src/application/`, `src/presentation/`, `tests/`
- **Description:** Add fixture-backed budget tests for `context_for_task`, `symbol_search`, `find_references`, and `impact`, including row limits, traversal depth, and source-byte caps.
- **Acceptance:** Implementation or documentation exists and current task status marks this item complete; keep evidence current if behavior changes.
- **Evidence:** Migrated from completed checkbox in the pre-migration task ledger. Current validation evidence: `pnpm typecheck` passed and `pnpm test` passed on 2026-06-02.

### Task T202.8: Add mixed-language/platform context tests proving unsupported and resource-backed files appear as routing evidence only, with no Python-specific shared fields

- **ID:** T202.8
- **Status:** done
- **Depends on:** [T202]
- **Parallel:** no
- **Story:** —
- **Files:** `src/application/`, `src/interface-adapters/mcp/`, `src/mcp/`, `src/presentation/`, `tests/`, `tests/mcp/`
- **Description:** Add mixed-language/platform context tests proving unsupported and resource-backed files appear as routing evidence only, with no Python-specific shared fields.
- **Acceptance:** Implementation or documentation exists and current task status marks this item complete; keep evidence current if behavior changes.
- **Evidence:** Migrated from completed checkbox in the pre-migration task ledger. Current validation evidence: `pnpm typecheck` passed and `pnpm test` passed on 2026-06-02.

### Task T202.9: Add docs/config and test-planning routing tests that preserve the useful predecessor workflows through new schemas without duplicating predecessor tool names or backend output

- **ID:** T202.9
- **Status:** done
- **Depends on:** [T202]
- **Parallel:** no
- **Story:** —
- **Files:** `docs/`, `src/interface-adapters/mcp/`, `src/mcp/`, `tests/`, `tests/mcp/`
- **Description:** Add docs/config and test-planning routing tests that preserve the useful predecessor workflows through new schemas without duplicating predecessor tool names or backend output.
- **Acceptance:** Implementation or documentation exists and current task status marks this item complete; keep evidence current if behavior changes.
- **Evidence:** Migrated from completed checkbox in the pre-migration task ledger. Current validation evidence: `pnpm typecheck` passed and `pnpm test` passed on 2026-06-02.

## Gap 4: Edit And Validation Loop

### Task T203: Complete the bounded edit and validation planning loop without executing commands by default

- **ID:** T203
- **Status:** done
- **Depends on:** [T202]
- **Parallel:** no
- **Story:** US3
- **Files:** `src/domain/policies/`, `src/infrastructure/filesystem/`, `tests/edits/`, `tests/workspace/`
- **Description:** Complete the bounded edit and validation planning loop without executing commands by default.
- **Acceptance:** Implementation or documentation exists and current task status marks this item complete; keep evidence current if behavior changes.
- **Evidence:** Migrated from completed checkbox in the pre-migration task ledger. Current validation evidence: `pnpm typecheck` passed and `pnpm test` passed on 2026-06-02.

### Task T203.1: Implement shared file identity and base-hash services used by graph indexing, preview tokens, apply drift checks, and stale snapshot detection

- **ID:** T203.1
- **Status:** done
- **Depends on:** [T203]
- **Parallel:** no
- **Story:** —
- **Files:** `src/application/`, `src/domain/`, `src/infrastructure/`, `src/ports/`, `src/presentation/`, `tests/`, `tests/graph/`
- **Description:** Implement shared file identity and base-hash services used by graph indexing, preview tokens, apply drift checks, and stale snapshot detection.
- **Acceptance:** Implementation or documentation exists and current task status marks this item complete; keep evidence current if behavior changes.
- **Evidence:** Migrated from completed checkbox in the pre-migration task ledger. Current validation evidence: `pnpm typecheck` passed and `pnpm test` passed on 2026-06-02.

### Task T203.2: Implement `PreviewWorkspaceEditUseCase` with path containment, generated/vendor read-only policy, secret/redaction checks, base hashes, preview token persistence, and no file mutation

- **ID:** T203.2
- **Status:** done
- **Depends on:** [T203]
- **Parallel:** no
- **Story:** —
- **Files:** `src/application/`, `src/domain/policies/`, `src/infrastructure/filesystem/`, `src/presentation/`, `tests/`, `tests/edits/`, `tests/workspace/`
- **Description:** Implement `PreviewWorkspaceEditUseCase` with path containment, generated/vendor read-only policy, secret/redaction checks, base hashes, preview token persistence, and no file mutation.
- **Acceptance:** Implementation or documentation exists and current task status marks this item complete; keep evidence current if behavior changes.
- **Evidence:** Migrated from completed checkbox in the pre-migration task ledger. Current validation evidence: `pnpm typecheck` passed and `pnpm test` passed on 2026-06-02.

### Task T203.3: Implement `ApplyWorkspaceEditUseCase` with preview-token lookup, expiration, single-use semantics, stale preview rejection, path refusal, concurrent modification checks, and atomic write ordering

- **ID:** T203.3
- **Status:** done
- **Depends on:** [T203]
- **Parallel:** no
- **Story:** —
- **Files:** `src/application/`, `src/domain/policies/`, `src/infrastructure/filesystem/`, `src/presentation/`, `tests/`, `tests/edits/`, `tests/workspace/`
- **Description:** Implement `ApplyWorkspaceEditUseCase` with preview-token lookup, expiration, single-use semantics, stale preview rejection, path refusal, concurrent modification checks, and atomic write ordering.
- **Acceptance:** Implementation or documentation exists and current task status marks this item complete; keep evidence current if behavior changes.
- **Evidence:** Migrated from completed checkbox in the pre-migration task ledger. Current validation evidence: `pnpm typecheck` passed and `pnpm test` passed on 2026-06-02.

### Task T203.4: Implement `PlanVerificationUseCase` with planned diagnostics, formatter, lint, and test commands, plus blocked states for missing, unsafe, too-broad, or low-confidence checks

- **ID:** T203.4
- **Status:** done
- **Depends on:** [T203]
- **Parallel:** no
- **Story:** —
- **Files:** `src/application/`, `src/domain/policies/`, `src/infrastructure/filesystem/`, `src/presentation/`, `tests/`, `tests/edits/`, `tests/workspace/`
- **Description:** Implement `PlanVerificationUseCase` with planned diagnostics, formatter, lint, and test commands, plus blocked states for missing, unsafe, too-broad, or low-confidence checks.
- **Acceptance:** Implementation or documentation exists and current task status marks this item complete; keep evidence current if behavior changes.
- **Evidence:** Migrated from completed checkbox in the pre-migration task ledger. Current validation evidence: `pnpm typecheck` passed and `pnpm test` passed on 2026-06-02.

### Task T203.5: Keep `verification_plan` read-only: do not execute diagnostics, lint, formatting, tests, or hooks in the MVP planning path

- **ID:** T203.5
- **Status:** done
- **Depends on:** [T203]
- **Parallel:** no
- **Story:** —
- **Files:** `docs/`, `src/application/`, `src/domain/policies/`, `src/infrastructure/filesystem/`, `src/integration/`, `src/presentation/`, `tests/`, `tests/edits/`, `tests/integration/`, `tests/workspace/`
- **Description:** Keep `verification_plan` read-only: do not execute diagnostics, lint, formatting, tests, or hooks in the MVP planning path.
- **Acceptance:** Implementation or documentation exists and current task status marks this item complete; keep evidence current if behavior changes.
- **Evidence:** Migrated from completed checkbox in the pre-migration task ledger. Current validation evidence: `pnpm typecheck` passed and `pnpm test` passed on 2026-06-02.

### Task T203.6: Add next-action metadata when verification discovery is incomplete, including direct-read, symbol/reference/impact, or manual command-confirmation follow-up

- **ID:** T203.6
- **Status:** done
- **Depends on:** [T203]
- **Parallel:** no
- **Story:** —
- **Files:** `src/application/`, `src/domain/policies/`, `src/infrastructure/filesystem/`, `src/presentation/`, `tests/`, `tests/edits/`, `tests/workspace/`
- **Description:** Add next-action metadata when verification discovery is incomplete, including direct-read, symbol/reference/impact, or manual command-confirmation follow-up.
- **Acceptance:** Implementation or documentation exists and current task status marks this item complete; keep evidence current if behavior changes.
- **Evidence:** Migrated from completed checkbox in the pre-migration task ledger. Current validation evidence: `pnpm typecheck` passed and `pnpm test` passed on 2026-06-02.

### Task T203.7: Add workspace-safety negative tests for traversal, symlink escape, generated/vendor mutation, `.env` or secret-like content, shell injection, output caps, and command refusal

- **ID:** T203.7
- **Status:** done
- **Depends on:** [T203]
- **Parallel:** no
- **Story:** —
- **Files:** `src/domain/policies/`, `src/infrastructure/filesystem/`, `tests/`, `tests/edits/`, `tests/workspace/`
- **Description:** Add workspace-safety negative tests for traversal, symlink escape, generated/vendor mutation, `.env` or secret-like content, shell injection, output caps, and command refusal.
- **Acceptance:** Implementation or documentation exists and current task status marks this item complete; keep evidence current if behavior changes.
- **Evidence:** Migrated from completed checkbox in the pre-migration task ledger. Current validation evidence: `pnpm typecheck` passed and `pnpm test` passed on 2026-06-02.

### Task T203.8: Add presenter golden responses for preview, apply success, stale apply rejection, unsafe path rejection, blocked validation, and planned validation

- **ID:** T203.8
- **Status:** done
- **Depends on:** [T203]
- **Parallel:** no
- **Story:** —
- **Files:** `src/application/`, `src/domain/policies/`, `src/infrastructure/filesystem/`, `src/presentation/`, `tests/`, `tests/edits/`, `tests/workspace/`
- **Description:** Add presenter golden responses for preview, apply success, stale apply rejection, unsafe path rejection, blocked validation, and planned validation.
- **Acceptance:** Implementation or documentation exists and current task status marks this item complete; keep evidence current if behavior changes.
- **Evidence:** Migrated from completed checkbox in the pre-migration task ledger. Current validation evidence: `pnpm typecheck` passed and `pnpm test` passed on 2026-06-02.

### Task T203.9: Implement quiet file-change static feedback for touched files as optional `verification_plan.static_feedback` with actionable findings only, silent clean results, and silent non-blocking optional analyzer failures

- **ID:** T203.9
- **Status:** done
- **Depends on:** [T203]
- **Parallel:** no
- **Story:** —
- **Files:** `src/application/`, `src/presentation/`, `tests/`
- **Description:** Implement quiet file-change static feedback for touched files as optional `verification_plan.static_feedback` with actionable findings only, silent clean results, and silent non-blocking optional analyzer failures.
- **Acceptance:** Implementation or documentation exists and current task status marks this item complete; keep evidence current if behavior changes.
- **Evidence:** Migrated from completed checkbox in the pre-migration task ledger. Current validation evidence: `pnpm typecheck` passed and `pnpm test` passed on 2026-06-02.

### Task T203.10: Add tests proving file-change feedback does not distract the agent with no-issue files, optional analyzer failures, backend tool names, or raw diagnostic output, and proving no separate public MCP tool/resource is registered for static feedback in MVP

- **ID:** T203.10
- **Status:** done
- **Depends on:** [T203]
- **Parallel:** no
- **Story:** —
- **Files:** `docs/`, `src/integration/`, `src/interface-adapters/mcp/`, `src/mcp/`, `tests/`, `tests/integration/`, `tests/mcp/`
- **Description:** Add tests proving file-change feedback does not distract the agent with no-issue files, optional analyzer failures, backend tool names, or raw diagnostic output, and proving no separate public MCP tool/resource is registered for static feedback in MVP.
- **Acceptance:** Implementation or documentation exists and current task status marks this item complete; keep evidence current if behavior changes.
- **Evidence:** Migrated from completed checkbox in the pre-migration task ledger. Current validation evidence: `pnpm typecheck` passed and `pnpm test` passed on 2026-06-02.

## Gap 5: Runtime And Degraded Behavior

### Task T204: Complete runtime state, cache, degraded-mode, concurrency, and observability proof for MVP surfaces

- **ID:** T204
- **Status:** done
- **Depends on:** [T203]
- **Parallel:** no
- **Story:** US1
- **Files:** `src/infrastructure/telemetry/`, `tests/`, `tests/mcp/telemetry-instrumentation.test.ts`, `tests/telemetry/`
- **Description:** Complete runtime state, cache, degraded-mode, concurrency, and observability proof for MVP surfaces.
- **Acceptance:** Runtime state, cache validity, degraded-mode responses, concurrency, observability, profiling, debug harness, and Codex runtime-update proof are implemented or fixture-backed for MVP surfaces.
- **Evidence:** Completed child tasks `T204.1` through `T204.11`, including OTEL dispatch and runtime boundary tests, warm-up/cache/concurrency fixtures, degraded status caveats, profiling/debug harness support, and Codex runtime-update validation. Validation passed with `pnpm typecheck` and `pnpm test` on 2026-06-02 (31 test files, 159 tests).

### Task T204.1: Implement cold, refreshing, fresh, stale, partial, invalid, and invalid-due-to-environment status transitions through snapshot/runtime ports

- **ID:** T204.1
- **Status:** done
- **Depends on:** [T204]
- **Parallel:** no
- **Story:** —
- **Files:** `src/application/`, `src/domain/`, `src/infrastructure/`, `src/ports/`, `src/presentation/`, `tests/`, `tests/graph/`
- **Description:** Implement cold, refreshing, fresh, stale, partial, invalid, and invalid-due-to-environment status transitions through snapshot/runtime ports.
- **Acceptance:** Snapshot-backed status use case reports cold, refreshing, fresh, stale, partial, invalid, and invalid-due-to-environment runtime states through structured status metadata and preserves scanner-backed status compatibility.
- **Evidence:** Implemented runtime status classification through snapshot, catalog, workspace, and warm-up ports with fixture coverage in `tests/runtime/status.test.ts`; validation passed with `pnpm typecheck` and `pnpm test` on 2026-06-02 (29 test files, 138 tests).

### Task T204.2: Implement runtime owner/observer coordination, heartbeat, stale/dead owner recovery, isolated-worker mode, and duplicate warm-up refusal

- **ID:** T204.2
- **Status:** done
- **Depends on:** [T204]
- **Parallel:** no
- **Story:** —
- **Files:** `src/`
- **Description:** Implement runtime owner/observer coordination, heartbeat, stale/dead owner recovery, isolated-worker mode, and duplicate warm-up refusal.
- **Acceptance:** Implementation or documentation exists and current task status marks this item complete; keep evidence current if behavior changes.
- **Evidence:** Migrated from completed checkbox in the pre-migration task ledger. Current validation evidence: `pnpm typecheck` passed and `pnpm test` passed on 2026-06-02.

### Task T204.3: Implement warm-up orchestration for migration, scan, extraction, reference resolution, FTS refresh, cache publication, and fresh snapshot publication

- **ID:** T204.3
- **Status:** done
- **Depends on:** [T204]
- **Parallel:** no
- **Story:** —
- **Files:** `src/application/`, `src/domain/`, `src/infrastructure/`, `src/ports/`, `src/presentation/`, `tests/`, `tests/graph/`
- **Description:** Implement warm-up orchestration for migration, scan, extraction, reference resolution, FTS refresh, cache publication, and fresh snapshot publication.
- **Acceptance:** Warm-up orchestration requests and owns a warm-up execution, runs the single graph indexing path through scan, extraction, reference resolution, and fresh snapshot publication, publishes cache metadata when configured, and records failed warm-ups without returning partial-success graph evidence.
- **Evidence:** Added `warmupRepositoryGraph` orchestration and fixture coverage for successful fresh snapshot/cache publication plus parser-timeout failure state in `tests/graph/extraction-pipeline.test.ts`. Validation passed with `pnpm typecheck` and `pnpm test` on 2026-06-02 (30 test files, 157 tests).

### Task T204.4: Implement cache invalidation for file identity, graph evidence, query results, source sections, validation discovery, and report caches

- **ID:** T204.4
- **Status:** done
- **Depends on:** [T204]
- **Parallel:** no
- **Story:** —
- **Files:** `src/domain/`, `src/infrastructure/`, `src/ports/`, `tests/graph/`
- **Description:** Implement cache invalidation for file identity, graph evidence, query results, source sections, validation discovery, and report caches.
- **Acceptance:** Implementation or documentation exists and current task status marks this item complete; keep evidence current if behavior changes.
- **Evidence:** Migrated from completed checkbox in the pre-migration task ledger. Current validation evidence: `pnpm typecheck` passed and `pnpm test` passed on 2026-06-02.

### Task T204.5: Implement obsolete-result rejection for parser/indexing work when snapshot id, file hash, or config identity no longer matches

- **ID:** T204.5
- **Status:** done
- **Depends on:** [T204]
- **Parallel:** no
- **Story:** —
- **Files:** `src/domain/`, `src/infrastructure/`, `src/ports/`, `tests/graph/`
- **Description:** Implement obsolete-result rejection for parser/indexing work when snapshot id, file hash, or config identity no longer matches.
- **Acceptance:** Runtime cache reads reject stale parser/indexing work when the requested snapshot id, config identity, or file content-hash bindings no longer match the cached evidence.
- **Evidence:** Implemented cache validation identity checks across runtime domain models, services, ports, and in-memory runtime cache; fixture proof covers snapshot, config, and file-hash mismatch rejection in `tests/runtime/operations.test.ts` and `tests/graph/extraction-pipeline.test.ts`. Validation passed with `pnpm typecheck` and `pnpm test` on 2026-06-02 (30 test files, 150 tests).

### Task T204.6: Implement degraded responses for missing tree-sitter parser or grammar, parser timeout/crash, missing future optional enrichment evidence, unsupported language/platform, missing test runner, and stale watcher snapshots without adding parser or semantic fallbacks

- **ID:** T204.6
- **Status:** done
- **Depends on:** [T204]
- **Parallel:** no
- **Story:** —
- **Files:** `src/domain/`, `src/infrastructure/`, `src/ports/`, `tests/`, `tests/graph/`
- **Description:** Implement degraded responses for missing tree-sitter parser or grammar, parser timeout/crash, missing future optional enrichment evidence, unsupported language/platform, missing test runner, and stale watcher snapshots without adding parser or semantic fallbacks.
- **Acceptance:** Snapshot-backed status metadata reports structured caveats for parser/grammar absence, parser timeout/crash, missing optional enrichment, unsupported language/platform evidence, missing test runner, and stale watcher state without adding alternate parser or semantic fallback paths.
- **Evidence:** Added runtime status caveat contract metadata plus status-use-case derivation and tests in `tests/contracts/runtime-contracts.test.ts` and `tests/runtime/status.test.ts`. Validation passed with `pnpm typecheck` and `pnpm test` on 2026-06-02 (30 test files, 150 tests).

### Task T204.7: Add concurrency tests proving bounded reads use the last valid snapshot or explicit refreshing/stale metadata while graph writes are serialized per repository

- **ID:** T204.7
- **Status:** done
- **Depends on:** [T204]
- **Parallel:** no
- **Story:** —
- **Files:** `src/domain/`, `src/infrastructure/`, `src/ports/`, `tests/`, `tests/graph/`
- **Description:** Add concurrency tests proving bounded reads use the last valid snapshot or explicit refreshing/stale metadata while graph writes are serialized per repository.
- **Acceptance:** Runtime tests prove duplicate refresh work is coordinated, bounded reads can continue using last-valid cache evidence unless a new snapshot identity is explicitly required, and graph-writer ownership is serialized per repository with observers.
- **Evidence:** Added concurrency coverage in `tests/runtime/operations.test.ts` for duplicate warm-up coordination, last-valid cache reads during refresh, explicit stale validation rejection, and owner/observer graph-writer serialization. Validation passed with `pnpm typecheck` and `pnpm test` on 2026-06-02 (30 test files, 157 tests).

### Task T204.8: Add OTEL contract tests for dispatch, use case, graph/query, worker, cache, presentation, degraded state, and error boundaries without adding durable usage records

- **ID:** T204.8
- **Status:** done
- **Depends on:** [T204]
- **Parallel:** no
- **Story:** —
- **Files:** `src/application/`, `src/domain/`, `src/infrastructure/`, `src/infrastructure/telemetry/`, `src/ports/`, `src/presentation/`, `tests/`, `tests/graph/`, `tests/mcp/telemetry-instrumentation.test.ts`, `tests/telemetry/`
- **Description:** Add OTEL contract tests for dispatch, use case, graph/query, worker, cache, presentation, degraded state, and error boundaries without adding durable usage records.
- **Acceptance:** OTEL-compatible tests cover MCP dispatch plus use-case, graph/query, worker, cache, presentation, degraded-state, and error-boundary instrumentation without adding durable usage records or changing public MCP schemas.
- **Evidence:** Added reusable runtime telemetry boundary instrumentation in `src/infrastructure/telemetry/index.ts` and contract coverage in `tests/telemetry/boundary-instrumentation.test.ts`, alongside existing MCP dispatch/lifecycle tests. Validation passed with `pnpm typecheck` and `pnpm test` on 2026-06-02 (31 test files, 159 tests).

### Task T204.8A: Implement configurable OTEL setup with disabled-by-default behavior, console export, OTLP HTTP export for Jaeger/collectors, environment configuration, and shutdown/flush handling

- **ID:** T204.8A
- **Status:** done
- **Depends on:** [T204]
- **Parallel:** no
- **Story:** —
- **Files:** `src/infrastructure/telemetry/`, `tests/mcp/telemetry-instrumentation.test.ts`, `tests/telemetry/`
- **Description:** Implement configurable OTEL setup with disabled-by-default behavior, console export, OTLP HTTP export for Jaeger/collectors, environment configuration, and shutdown/flush handling.
- **Acceptance:** Implementation or documentation exists and current task status marks this item complete; keep evidence current if behavior changes.
- **Evidence:** Migrated from completed checkbox in the pre-migration task ledger. Current validation evidence: `pnpm typecheck` passed and `pnpm test` passed on 2026-06-02.

### Task T204.8B: Add low-impact performance monitoring for tool latency, row-count caps, traversal depth, source-byte caps, cache hit/miss state, degraded-mode counts, quiet-feedback suppression counts, and invalid-input counts. Define whether each signal is emitted as an OTEL metric, span attribute, or stable instrumentation event

- **ID:** T204.8B
- **Status:** done
- **Depends on:** [T204]
- **Parallel:** no
- **Story:** —
- **Files:** `src/application/`, `src/infrastructure/telemetry/`, `src/interface-adapters/mcp/`, `src/mcp/`, `src/presentation/`, `tests/`, `tests/mcp/`, `tests/mcp/telemetry-instrumentation.test.ts`, `tests/telemetry/`
- **Description:** Add low-impact performance monitoring for tool latency, row-count caps, traversal depth, source-byte caps, cache hit/miss state, degraded-mode counts, quiet-feedback suppression counts, and invalid-input counts. Define whether each signal is emitted as an OTEL metric, span attribute, or stable instrumentation event.
- **Acceptance:** MCP dispatch instrumentation emits stable event properties for latency, budget caps, runtime/cache state, degraded-mode counts, quiet-feedback suppression counts, and invalid-input counts without adding durable usage records.
- **Evidence:** Added MCP instrumentation extraction for runtime/cache state, invalid/degraded counts, quiet-feedback suppression counts, row-limit, traversal-depth, source-byte caps, and latency; covered by `tests/mcp/telemetry-instrumentation.test.ts`. Validation passed with `pnpm typecheck` and `pnpm test` on 2026-06-02 (30 test files, 150 tests).

### Task T204.8C: Add profiling guidance and harness support so MCP paths can be run under Node CPU profiling or external profilers without changing public MCP schemas

- **ID:** T204.8C
- **Status:** done
- **Depends on:** [T204]
- **Parallel:** no
- **Story:** —
- **Files:** `src/domain/`, `src/domain/policies/`, `src/infrastructure/`, `src/infrastructure/filesystem/`, `src/infrastructure/telemetry/`, `src/interface-adapters/mcp/`, `src/mcp/`, `src/ports/`, `tests/edits/`, `tests/graph/`, `tests/mcp/`, `tests/mcp/telemetry-instrumentation.test.ts`, `tests/telemetry/`, `tests/workspace/`
- **Description:** Add profiling guidance and harness support so MCP paths can be run under Node CPU profiling or external profilers without changing public MCP schemas.
- **Acceptance:** Repo-local MCP-adjacent debug harnesses can run under Node CPU profiling without changing public MCP schemas or registering profiling behavior as a public MCP surface.
- **Evidence:** Added `debug:mcp-profile` over `src/debug/mcp-use-case.ts`, CPU profile output resolution under `.cache/profiles/`, non-registration tests in `tests/mcp/debug-harness.test.ts`, and durable guidance in `docs/design/observability-debugging-design.md`. Validation passed with `pnpm typecheck` and `pnpm test` on 2026-06-02 (30 test files, 157 tests).

### Task T204.8D: Add structured operational log-event contract tests for startup, shutdown, exporter failures, degraded runtime state, and invalid input, using OTEL-compatible instrumentation without writing durable usage records

- **ID:** T204.8D
- **Status:** done
- **Depends on:** [T204]
- **Parallel:** no
- **Story:** —
- **Files:** `src/infrastructure/telemetry/`, `tests/`, `tests/mcp/telemetry-instrumentation.test.ts`, `tests/telemetry/`
- **Description:** Add structured operational log-event contract tests for startup, shutdown, exporter failures, degraded runtime state, and invalid input, using OTEL-compatible instrumentation without writing durable usage records.
- **Acceptance:** Telemetry lifecycle and MCP dispatch tests prove startup, shutdown, flush/exporter failure, degraded runtime state, and invalid-input events are represented as stable instrumentation events without durable usage records.
- **Evidence:** Added telemetry lifecycle operational events and exporter-failure fallback coverage in `tests/telemetry/config.test.ts`, plus degraded runtime-state and invalid-input dispatch coverage in `tests/mcp/telemetry-instrumentation.test.ts`. Validation passed with `pnpm typecheck` and `pnpm test` on 2026-06-02 (30 test files, 150 tests).

### Task T204.9: Add fixture-runtime-operations and fixture-runtime-boundaries coverage for warm-up, cache reuse, invalidation, owner state, parser timeout, malformed inputs, and operational metadata

- **ID:** T204.9
- **Status:** done
- **Depends on:** [T204]
- **Parallel:** no
- **Story:** —
- **Files:** `src/domain/`, `src/infrastructure/`, `src/ports/`, `tests/`, `tests/graph/`
- **Description:** Add fixture-runtime-operations and fixture-runtime-boundaries coverage for warm-up, cache reuse, invalidation, owner state, parser timeout, malformed inputs, and operational metadata.
- **Acceptance:** Runtime operation and boundary fixtures cover warm-up, cache reuse and invalidation, owner state, parser timeout failure handling, malformed/stale validation inputs, and operational metadata.
- **Evidence:** Expanded `tests/runtime/operations.test.ts` and `tests/graph/extraction-pipeline.test.ts` to cover warm-up success/failure metadata, cache reuse/invalidation and stale identity rejection, owner/observer/stale/dead/isolated states, parser timeout failure, and operational cache/snapshot metadata. Validation passed with `pnpm typecheck` and `pnpm test` on 2026-06-02 (30 test files, 157 tests).

### Task T204.10: Add repo-local debug harnesses for testing MCP use cases against arbitrary target repos from this project only; prove they are not registered as public MCP tools/resources

- **ID:** T204.10
- **Status:** done
- **Depends on:** [T204]
- **Parallel:** no
- **Story:** —
- **Files:** `src/application/`, `src/interface-adapters/mcp/`, `src/mcp/`, `src/presentation/`, `tests/`, `tests/mcp/`
- **Description:** Add repo-local debug harnesses for testing MCP use cases against arbitrary target repos from this project only; prove they are not registered as public MCP tools/resources.
- **Acceptance:** Repo-local debug CLI can exercise bounded MCP-adjacent status, scope, overview, and context use cases against arbitrary target repos only when launched from this checkout, and debug commands are not public MCP resources or tools.
- **Evidence:** Added `src/debug/mcp-use-case.ts`, retained `debug:mcp-status`, added `debug:mcp-use-case`, and proved repo-local guard plus non-registration in `tests/mcp/debug-harness.test.ts`. Validation passed with `pnpm typecheck` and `pnpm test` on 2026-06-02 (30 test files, 150 tests).

### Task T204.11: Add host-level Codex runtime-update validation proving the MCP process is launched from this repository checkout, code changes are picked up after Codex restart, and dependency changes require only `pnpm install` rather than plugin/package reinstall

- **ID:** T204.11
- **Status:** done
- **Depends on:** [T204]
- **Parallel:** no
- **Story:** —
- **Files:** `docs/`, `src/integration/`, `src/interface-adapters/mcp/`, `src/mcp/`, `tests/integration/`, `tests/mcp/`
- **Description:** Add host-level Codex runtime-update validation proving the MCP process is launched from this repository checkout, code changes are picked up after Codex restart, and dependency changes require only `pnpm install` rather than plugin/package reinstall.
- **Acceptance:** Codex integration profile and plugin fixture tests prove MCP launches from this repository checkout, source changes are picked up after Codex restart, and dependency changes require `pnpm install` in the checkout rather than plugin/package reinstall.
- **Evidence:** Added host-level runtime update semantics to `describeCodexIntegrationProfile` and fixture assertions in `tests/integration/codex-integration-profile.test.ts` for repository-checkout runtime source, `src/mcp/stdio.ts` launch path, restart-based source updates, and `pnpm install` dependency updates. Validation passed with `pnpm typecheck` and `pnpm test` on 2026-06-02 (30 test files, 157 tests).

## Gap 6: MCP Completion

### Task T205: Complete MCP bindings for every MVP resource and tool as thin transport adapters over use cases and presenters

- **ID:** T205
- **Status:** done
- **Depends on:** [T204]
- **Parallel:** no
- **Story:** US1, US2, US3
- **Files:** `src/application/`, `src/interface-adapters/mcp/`, `src/mcp/`, `src/presentation/`, `tests/`, `tests/mcp/`
- **Description:** Complete MCP bindings for every MVP resource and tool as thin transport adapters over use cases and presenters.
- **Acceptance:** Required implementation, contract, documentation, and fixture-backed proof are present for this task.
- **Evidence:** Completed on 2026-06-02. Validation evidence: `pnpm typecheck` passed; focused MCP suite passed with 9 test files and 66 tests; `pnpm test` passed with 33 test files and 182 tests.

### Task T205.1: Implement shared MCP argument parser helpers for repo roots, paths, source ranges, positions, enums, row limits, traversal depth, payload modes, usage context, edit operations, and validation targets

- **ID:** T205.1
- **Status:** done
- **Depends on:** [T205]
- **Parallel:** no
- **Story:** —
- **Files:** `src/application/`, `src/domain/`, `src/domain/policies/`, `src/infrastructure/`, `src/infrastructure/filesystem/`, `src/interface-adapters/mcp/`, `src/mcp/`, `src/ports/`, `src/presentation/`, `tests/`, `tests/edits/`, `tests/graph/`, `tests/mcp/`, `tests/workspace/`
- **Description:** Implement shared MCP argument parser helpers for repo roots, paths, source ranges, positions, enums, row limits, traversal depth, payload modes, usage context, edit operations, and validation targets.
- **Acceptance:** Required implementation, contract, documentation, and fixture-backed proof are present for this task.
- **Evidence:** Completed on 2026-06-02. Added shared MCP argument helpers in `src/interface-adapters/mcp/arguments/index.ts` and parser coverage in `tests/mcp/argument-parser.test.ts`. Validation evidence: `pnpm typecheck` passed; focused MCP suite passed with 9 test files and 66 tests; `pnpm test` passed with 33 test files and 182 tests.

### Task T205.2: Implement structured invalid-input responses that fail before use-case execution and still use the shared response envelope shape

- **ID:** T205.2
- **Status:** done
- **Depends on:** [T205]
- **Parallel:** no
- **Story:** —
- **Files:** `src/`
- **Description:** Implement structured invalid-input responses that fail before use-case execution and still use the shared response envelope shape.
- **Acceptance:** Required implementation, contract, documentation, and fixture-backed proof are present for this task.
- **Evidence:** Completed on 2026-06-02. MCP resources and tools now route malformed input through shared argument parsing/error formatting before use-case execution while preserving invalid-input presenter envelopes. Validation evidence: `pnpm typecheck` passed; focused MCP suite passed with 9 test files and 66 tests; `pnpm test` passed with 33 test files and 182 tests.

### Task T205.3: Implement registry definitions for each MCP resource, tool, and prompt with schema, argument parser, use-case binding, presenter binding, budget policy, capability class, and mutation class

- **ID:** T205.3
- **Status:** done
- **Depends on:** [T205]
- **Parallel:** no
- **Story:** —
- **Files:** `src/domain/`, `src/infrastructure/`, `src/interface-adapters/mcp/`, `src/mcp/`, `src/ports/`, `tests/`, `tests/graph/`, `tests/mcp/`
- **Description:** Implement registry definitions for each MCP resource, tool, and prompt with schema, argument parser, use-case binding, presenter binding, budget policy, capability class, and mutation class.
- **Acceptance:** Implementation or documentation exists and current task status marks this item complete; keep evidence current if behavior changes.
- **Evidence:** Migrated from completed checkbox in the pre-migration task ledger. Current validation evidence: `pnpm typecheck` passed and `pnpm test` passed on 2026-06-02.

### Task T205.3A: Add registry metadata tests proving every public MCP surface has a clear agent-facing name, description, parameter descriptions, expected return structure, capability class, and budget policy

- **ID:** T205.3A
- **Status:** done
- **Depends on:** [T205]
- **Parallel:** no
- **Story:** —
- **Files:** `docs/`, `src/integration/`, `src/interface-adapters/mcp/`, `src/mcp/`, `tests/`, `tests/integration/`, `tests/mcp/`
- **Description:** Add registry metadata tests proving every public MCP surface has a clear agent-facing name, description, parameter descriptions, expected return structure, capability class, and budget policy.
- **Acceptance:** Implementation or documentation exists and current task status marks this item complete; keep evidence current if behavior changes.
- **Evidence:** Migrated from completed checkbox in the pre-migration task ledger. Current validation evidence: `pnpm typecheck` passed and `pnpm test` passed on 2026-06-02.

### Task T205.4: Wire resources `repo:///status`, `repo:///scope`, and `repo:///overview` through typed parsers, use cases, presenters, and golden MCP response tests

- **ID:** T205.4
- **Status:** done
- **Depends on:** [T205]
- **Parallel:** no
- **Story:** —
- **Files:** `src/application/`, `src/domain/`, `src/infrastructure/`, `src/interface-adapters/mcp/`, `src/mcp/`, `src/ports/`, `src/presentation/`, `tests/`, `tests/graph/`, `tests/mcp/`
- **Description:** Wire resources `repo:///status`, `repo:///scope`, and `repo:///overview` through typed parsers, use cases, presenters, and golden MCP response tests.
- **Acceptance:** Implementation or documentation exists and current task status marks this item complete; keep evidence current if behavior changes.
- **Evidence:** Migrated from completed checkbox in the pre-migration task ledger. Current validation evidence: `pnpm typecheck` passed and `pnpm test` passed on 2026-06-02.

### Task T205.5: Wire tools `context_for_task`, `symbol_search`, `find_references`, and bounded `impact` through typed parsers, use cases, presenters, budgets, truncation, and next-action metadata

- **ID:** T205.5
- **Status:** done
- **Depends on:** [T205]
- **Parallel:** no
- **Story:** —
- **Files:** `src/application/`, `src/domain/`, `src/infrastructure/`, `src/interface-adapters/mcp/`, `src/mcp/`, `src/ports/`, `src/presentation/`, `tests/`, `tests/graph/`, `tests/mcp/`
- **Description:** Wire tools `context_for_task`, `symbol_search`, `find_references`, and bounded `impact` through typed parsers, use cases, presenters, budgets, truncation, and next-action metadata.
- **Acceptance:** Implementation or documentation exists and current task status marks this item complete; keep evidence current if behavior changes.
- **Evidence:** Migrated from completed checkbox in the pre-migration task ledger. Current validation evidence: `pnpm typecheck` passed and `pnpm test` passed on 2026-06-02.

### Task T205.6: Wire tools `preview_workspace_edit`, `apply_workspace_edit`, and `verification_plan` through typed parsers, use cases, presenters, safety policy metadata, and read/write capability classes

- **ID:** T205.6
- **Status:** done
- **Depends on:** [T205]
- **Parallel:** no
- **Story:** —
- **Files:** `src/application/`, `src/domain/`, `src/domain/policies/`, `src/infrastructure/`, `src/infrastructure/filesystem/`, `src/interface-adapters/mcp/`, `src/mcp/`, `src/ports/`, `src/presentation/`, `tests/`, `tests/edits/`, `tests/graph/`, `tests/mcp/`, `tests/workspace/`
- **Description:** Wire tools `preview_workspace_edit`, `apply_workspace_edit`, and `verification_plan` through typed parsers, use cases, presenters, safety policy metadata, and read/write capability classes.
- **Acceptance:** Implementation or documentation exists and current task status marks this item complete; keep evidence current if behavior changes.
- **Evidence:** Migrated from completed checkbox in the pre-migration task ledger. Current validation evidence: `pnpm typecheck` passed and `pnpm test` passed on 2026-06-02.

### Task T205.7: Add MCP registry tests proving handlers do not import concrete SQLite, tree-sitter, filesystem watcher, or process-execution infrastructure

- **ID:** T205.7
- **Status:** done
- **Depends on:** [T205]
- **Parallel:** no
- **Story:** —
- **Files:** `src/domain/`, `src/infrastructure/`, `src/interface-adapters/mcp/`, `src/mcp/`, `src/ports/`, `tests/`, `tests/graph/`, `tests/mcp/`
- **Description:** Add MCP registry tests proving handlers do not import concrete SQLite, tree-sitter, filesystem watcher, or process-execution infrastructure.
- **Acceptance:** Implementation or documentation exists and current task status marks this item complete; keep evidence current if behavior changes.
- **Evidence:** Migrated from completed checkbox in the pre-migration task ledger. Current validation evidence: `pnpm typecheck` passed and `pnpm test` passed on 2026-06-02.

### Task T205.8: Add malformed-input fixture tests for invalid repo roots, file paths, ranges, enums, limits, payload modes, edit operations, and validation targets

- **ID:** T205.8
- **Status:** done
- **Depends on:** [T205]
- **Parallel:** no
- **Story:** —
- **Files:** `src/domain/policies/`, `src/infrastructure/filesystem/`, `tests/`, `tests/edits/`, `tests/workspace/`
- **Description:** Add malformed-input fixture tests for invalid repo roots, file paths, ranges, enums, limits, payload modes, edit operations, and validation targets.
- **Acceptance:** Implementation or documentation exists and current task status marks this item complete; keep evidence current if behavior changes.
- **Evidence:** Migrated from completed checkbox in the pre-migration task ledger. Current validation evidence: `pnpm typecheck` passed and `pnpm test` passed on 2026-06-02.

### Task T205.9: Add end-to-end MCP fixture tests proving all MVP responses match presenter goldens and no handler hand-coerces raw MCP inputs

- **ID:** T205.9
- **Status:** done
- **Depends on:** [T205]
- **Parallel:** no
- **Story:** —
- **Files:** `src/interface-adapters/mcp/`, `src/mcp/`, `tests/`, `tests/mcp/`
- **Description:** Add end-to-end MCP fixture tests proving all MVP responses match presenter goldens and no handler hand-coerces raw MCP inputs.
- **Acceptance:** Required implementation, contract, documentation, and fixture-backed proof are present for this task.
- **Evidence:** Completed on 2026-06-02. Added end-to-end stdio fixture/golden coverage for MVP MCP resources and tools plus no hand-coercion parser assertions in MCP tests. Validation evidence: `pnpm typecheck` passed; focused MCP suite passed with 9 test files and 66 tests; `pnpm test` passed with 33 test files and 182 tests.

### Task T205.10: Add backend translation-boundary tests proving raw parser, diagnostic, validation, test-discovery, and worker payloads never pass through to MCP responses unless modeled by the public schema

- **ID:** T205.10
- **Status:** done
- **Depends on:** [T205]
- **Parallel:** no
- **Story:** —
- **Files:** `src/domain/`, `src/infrastructure/`, `src/interface-adapters/mcp/`, `src/mcp/`, `src/ports/`, `tests/`, `tests/graph/`, `tests/mcp/`
- **Description:** Add backend translation-boundary tests proving raw parser, diagnostic, validation, test-discovery, and worker payloads never pass through to MCP responses unless modeled by the public schema.
- **Acceptance:** Required implementation, contract, documentation, and fixture-backed proof are present for this task.
- **Evidence:** Completed on 2026-06-02. Added MCP translation-boundary tests and presenter sanitization for task-context and verification-plan responses so backend parser, diagnostic, validation, test-discovery, and worker payloads are not emitted unless modeled by public schemas. Validation evidence: `pnpm typecheck` passed; focused MCP suite passed with 9 test files and 66 tests; `pnpm test` passed with 33 test files and 182 tests.

### Task T205.11: Implement and test `src/mcp/stdio.ts` as the canonical production MCP entrypoint over `createAgentWorkbenchServer`, with no duplicated server registration logic

- **ID:** T205.11
- **Status:** done
- **Depends on:** [T205]
- **Parallel:** no
- **Story:** —
- **Files:** `docs/`, `src/integration/`, `src/interface-adapters/mcp/`, `src/mcp/`, `tests/`, `tests/integration/`, `tests/mcp/`
- **Description:** Implement and test `src/mcp/stdio.ts` as the canonical production MCP entrypoint over `createAgentWorkbenchServer`, with no duplicated server registration logic.
- **Acceptance:** Implementation or documentation exists and current task status marks this item complete; keep evidence current if behavior changes.
- **Evidence:** Migrated from completed checkbox in the pre-migration task ledger. Current validation evidence: `pnpm typecheck` passed and `pnpm test` passed on 2026-06-02.

### Task T205.12: Add package script and documentation for host-level Codex configuration using an absolute Node command, the `tsx` loader, and an absolute source-file path, with OTEL env vars remaining optional and disabled by default

- **ID:** T205.12
- **Status:** done
- **Depends on:** [T205]
- **Parallel:** no
- **Story:** —
- **Files:** `docs/`, `src/domain/`, `src/domain/policies/`, `src/infrastructure/`, `src/infrastructure/filesystem/`, `src/infrastructure/telemetry/`, `src/integration/`, `src/ports/`, `tests/edits/`, `tests/graph/`, `tests/integration/`, `tests/mcp/telemetry-instrumentation.test.ts`, `tests/telemetry/`, `tests/workspace/`
- **Description:** Add package script and documentation for host-level Codex configuration using an absolute Node command, the `tsx` loader, and an absolute source-file path, with OTEL env vars remaining optional and disabled by default.
- **Acceptance:** Implementation or documentation exists and current task status marks this item complete; keep evidence current if behavior changes.
- **Evidence:** Migrated from completed checkbox in the pre-migration task ledger. Current validation evidence: `pnpm typecheck` passed and `pnpm test` passed on 2026-06-02.

### Task T205.13: Add MCP launch tests or smoke checks proving the stdio entrypoint starts cleanly, exposes the registered public MCP surfaces, and handles explicit `repo_root` arguments when the process cwd is not the target repository

- **ID:** T205.13
- **Status:** done
- **Depends on:** [T205]
- **Parallel:** no
- **Story:** —
- **Files:** `src/interface-adapters/mcp/`, `src/mcp/`, `tests/`, `tests/mcp/`
- **Description:** Add MCP launch tests or smoke checks proving the stdio entrypoint starts cleanly, exposes the registered public MCP surfaces, and handles explicit `repo_root` arguments when the process cwd is not the target repository.
- **Acceptance:** Implementation or documentation exists and current task status marks this item complete; keep evidence current if behavior changes.
- **Evidence:** Migrated from completed checkbox in the pre-migration task ledger. Current validation evidence: `pnpm typecheck` passed and `pnpm test` passed on 2026-06-02.

### Task T205.14: Add Codex integration profile fixture tests proving the profile lists `AGENTS.md`, host-level MCP config, stdio live-checkout launch, and repo-local debug CLI as MVP surfaces, with skills, plugin packaging, and hooks marked as wrappers around MCP

- **ID:** T205.14
- **Status:** done
- **Depends on:** [T205]
- **Parallel:** no
- **Story:** —
- **Files:** `docs/`, `src/infrastructure/telemetry/`, `src/integration/`, `src/interface-adapters/mcp/`, `src/mcp/`, `tests/`, `tests/integration/`, `tests/mcp/`, `tests/mcp/telemetry-instrumentation.test.ts`, `tests/telemetry/`
- **Description:** Add Codex integration profile fixture tests proving the profile lists `AGENTS.md`, host-level MCP config, stdio live-checkout launch, and repo-local debug CLI as MVP surfaces, with skills, plugin packaging, and hooks marked as wrappers around MCP.
- **Acceptance:** Implementation or documentation exists and current task status marks this item complete; keep evidence current if behavior changes.
- **Evidence:** Migrated from completed checkbox in the pre-migration task ledger. Current validation evidence: `pnpm typecheck` passed and `pnpm test` passed on 2026-06-02.

## Gap 7: Codex Replacement Readiness

### Task T206: Complete Codex replacement readiness so the MVP can replace predecessor `agent-ide` usage without depending on copied plugin runtime code

- **ID:** T206
- **Status:** done
- **Depends on:** [T205]
- **Parallel:** no
- **Story:** US1, US3
- **Files:** `docs/`, `src/integration/`, `tests/integration/`
- **Description:** Complete Codex replacement readiness so the MVP can replace predecessor `agent-ide` usage without depending on copied plugin runtime code.
- **Acceptance:** Required implementation, contract, documentation, and fixture-backed proof are present for this task.
- **Evidence:** Completed on 2026-06-02. Completed child task `T206.5` after previously completed Codex host config, workflow skill, plugin wrapper, hook, and update-path tasks. Validation evidence: `pnpm exec vitest run tests/integration/replacement-readiness.test.ts` passed with 1 test file and 2 tests; `pnpm typecheck` passed; `pnpm test` passed with 34 test files and 184 tests.

### Task T206.1: Document the host-level Codex MCP config snippet with absolute paths to this checkout and optional OTEL environment variables

- **ID:** T206.1
- **Status:** done
- **Depends on:** [T206]
- **Parallel:** no
- **Story:** —
- **Files:** `docs/`, `src/domain/policies/`, `src/infrastructure/filesystem/`, `src/infrastructure/telemetry/`, `src/integration/`, `src/interface-adapters/mcp/`, `src/mcp/`, `tests/edits/`, `tests/integration/`, `tests/mcp/`, `tests/mcp/telemetry-instrumentation.test.ts`, `tests/telemetry/`, `tests/workspace/`
- **Description:** Document the host-level Codex MCP config snippet with absolute paths to this checkout and optional OTEL environment variables.
- **Acceptance:** Implementation or documentation exists and current task status marks this item complete; keep evidence current if behavior changes.
- **Evidence:** Migrated from completed checkbox in the pre-migration task ledger. Current validation evidence: `pnpm typecheck` passed and `pnpm test` passed on 2026-06-02.

### Task T206.2: Add a Codex workflow skill draft that teaches status -> context -> targeted symbol/reference/impact -> edit preview/apply -> `verification_plan`, without restating MCP schemas or duplicating runtime logic

- **ID:** T206.2
- **Status:** done
- **Depends on:** [T206]
- **Parallel:** no
- **Story:** —
- **Files:** `docs/`, `src/application/`, `src/domain/policies/`, `src/infrastructure/filesystem/`, `src/integration/`, `src/interface-adapters/mcp/`, `src/mcp/`, `src/presentation/`, `tests/`, `tests/edits/`, `tests/integration/`, `tests/mcp/`, `tests/workspace/`
- **Description:** Add a Codex workflow skill draft that teaches status -> context -> targeted symbol/reference/impact -> edit preview/apply -> `verification_plan`, without restating MCP schemas or duplicating runtime logic.
- **Acceptance:** Implementation or documentation exists and current task status marks this item complete; keep evidence current if behavior changes.
- **Evidence:** Migrated from completed checkbox in the pre-migration task ledger. Current validation evidence: `pnpm typecheck` passed and `pnpm test` passed on 2026-06-02.

### Task T206.3: Add a plugin wrapper note that defines what the Codex plugin may package: MCP config, skills, hook declarations, setup metadata, and docs, but not copied runtime logic for local development

- **ID:** T206.3
- **Status:** done
- **Depends on:** [T206]
- **Parallel:** no
- **Story:** —
- **Files:** `docs/`, `src/integration/`, `src/interface-adapters/mcp/`, `src/mcp/`, `tests/integration/`, `tests/mcp/`
- **Description:** Add a plugin wrapper note that defines what the Codex plugin may package: MCP config, skills, hook declarations, setup metadata, and docs, but not copied runtime logic for local development.
- **Acceptance:** Implementation or documentation exists and current task status marks this item complete; keep evidence current if behavior changes.
- **Evidence:** Migrated from completed checkbox in the pre-migration task ledger. Current validation evidence: `pnpm typecheck` passed and `pnpm test` passed on 2026-06-02.

### Task T206.4: Add hook feasibility notes and tests for optional quiet changed-file/post-edit feedback that reuses `verification_plan.static_feedback` and stays silent for no findings

- **ID:** T206.4
- **Status:** done
- **Depends on:** [T206]
- **Parallel:** no
- **Story:** —
- **Files:** `docs/`, `src/application/`, `src/domain/policies/`, `src/infrastructure/filesystem/`, `src/integration/`, `src/presentation/`, `tests/`, `tests/edits/`, `tests/integration/`, `tests/workspace/`
- **Description:** Add hook feasibility notes and tests for optional quiet changed-file/post-edit feedback that reuses `verification_plan.static_feedback` and stays silent for no findings.
- **Acceptance:** Implementation or documentation exists and current task status marks this item complete; keep evidence current if behavior changes.
- **Evidence:** Migrated from completed checkbox in the pre-migration task ledger. Current validation evidence: `pnpm typecheck` passed and `pnpm test` passed on 2026-06-02.

### Task T206.5: Add replacement-readiness checks comparing predecessor high-frequency workflows against the new MVP surfaces: first-pass context, docs/config routing, validation planning, test planning, and post-edit static feedback

- **ID:** T206.5
- **Status:** done
- **Depends on:** [T206]
- **Parallel:** no
- **Story:** —
- **Files:** `docs/`, `src/application/`, `src/domain/policies/`, `src/infrastructure/filesystem/`, `src/presentation/`, `tests/`, `tests/edits/`, `tests/workspace/`
- **Description:** Add replacement-readiness checks comparing predecessor high-frequency workflows against the new MVP surfaces: first-pass context, docs/config routing, validation planning, test planning, and post-edit static feedback.
- **Acceptance:** Required implementation, contract, documentation, and fixture-backed proof are present for this task.
- **Evidence:** Completed on 2026-06-02. Added replacement-readiness integration checks in `tests/integration/replacement-readiness.test.ts` covering first-pass context, docs/config routing, validation planning, test planning, and post-edit static feedback through `context_for_task` and `verification_plan` without predecessor tool names or backend payloads. Updated `docs/reference/mvp-proof-matrix.md` with the Codex replacement-readiness proof gate. Validation evidence: `pnpm exec vitest run tests/integration/replacement-readiness.test.ts` passed with 1 test file and 2 tests; `pnpm typecheck` passed; `pnpm test` passed with 34 test files and 184 tests.

### Task T206.6: Add documentation proving restarting Codex is the expected update path for source changes, while dependency changes require `pnpm install` and not plugin reinstall

- **ID:** T206.6
- **Status:** done
- **Depends on:** [T206]
- **Parallel:** no
- **Story:** —
- **Files:** `docs/`, `src/domain/policies/`, `src/infrastructure/filesystem/`, `src/integration/`, `tests/edits/`, `tests/integration/`, `tests/workspace/`
- **Description:** Add documentation proving restarting Codex is the expected update path for source changes, while dependency changes require `pnpm install` and not plugin reinstall.
- **Acceptance:** Implementation or documentation exists and current task status marks this item complete; keep evidence current if behavior changes.
- **Evidence:** Migrated from completed checkbox in the pre-migration task ledger. Current validation evidence: `pnpm typecheck` passed and `pnpm test` passed on 2026-06-02.

## Phase 7: Cross-Cutting Validation

### Task T080: Add produced-response assertions against the expected golden snapshots from T020

- **ID:** T080
- **Status:** done
- **Depends on:** [T205]
- **Parallel:** no
- **Story:** —
- **Files:** `src/domain/`, `src/infrastructure/`, `src/ports/`, `tests/`, `tests/graph/`
- **Description:** Add produced-response assertions against the expected golden snapshots from T020.
- **Acceptance:** Required implementation, contract, documentation, and fixture-backed proof are present for this task.
- **Evidence:** Completed on 2026-06-03. Produced-response golden assertions are covered by presenter and MCP/stdio golden tests, including `tests/mcp/stdio-entrypoint.test.ts`, `tests/edits/workspace-edit-presenter.test.ts`, and presentation-backed MCP response checks. Validation evidence: `pnpm typecheck` passed; `pnpm test` passed with 36 test files and 188 tests.

### Task T081: Add use-case tests for every MVP resource and tool

- **ID:** T081
- **Status:** done
- **Depends on:** [T205]
- **Parallel:** no
- **Story:** —
- **Files:** `src/interface-adapters/mcp/`, `src/mcp/`, `tests/`, `tests/mcp/`
- **Description:** Add use-case tests for every MVP resource and tool.
- **Acceptance:** Required implementation, contract, documentation, and fixture-backed proof are present for this task.
- **Evidence:** Completed on 2026-06-03. MVP resources and tools are covered by use-case and MCP tests for status, scope, overview, context, symbol search, references, impact, preview/apply, and verification planning across `tests/mcp/`, `tests/graph/query-tools.test.ts`, `tests/runtime/status.test.ts`, and `tests/integration/replacement-readiness.test.ts`. Validation evidence: `pnpm typecheck` passed; `pnpm test` passed with 36 test files and 188 tests.

### Task T082: Add registry and shared argument-parser tests for valid input, invalid input, paths, positions, enums, limits, and payload modes

- **ID:** T082
- **Status:** done
- **Depends on:** [T205]
- **Parallel:** no
- **Story:** —
- **Files:** `src/domain/`, `src/domain/policies/`, `src/infrastructure/`, `src/infrastructure/filesystem/`, `src/interface-adapters/mcp/`, `src/mcp/`, `src/ports/`, `tests/`, `tests/edits/`, `tests/graph/`, `tests/mcp/`, `tests/workspace/`
- **Description:** Add registry and shared argument-parser tests for valid input, invalid input, paths, positions, enums, limits, and payload modes.
- **Acceptance:** Required implementation, contract, documentation, and fixture-backed proof are present for this task.
- **Evidence:** Completed on 2026-06-03. Registry and shared argument-parser coverage is implemented in `tests/mcp/registry-metadata.test.ts`, `tests/mcp/argument-parser.test.ts`, `tests/mcp/malformed-input.test.ts`, and MCP handler tests for valid/defaulted and invalid inputs. Validation evidence: `pnpm typecheck` passed; `pnpm test` passed with 36 test files and 188 tests.

### Task T083: Add OTEL instrumentation tests or contract checks for dispatch, use-case, graph/query, worker, cache, presentation boundaries, low-impact performance signals, and structured operational log events

- **ID:** T083
- **Status:** done
- **Depends on:** [T205]
- **Parallel:** no
- **Story:** —
- **Files:** `src/application/`, `src/domain/`, `src/infrastructure/`, `src/infrastructure/telemetry/`, `src/ports/`, `src/presentation/`, `tests/`, `tests/graph/`, `tests/mcp/telemetry-instrumentation.test.ts`, `tests/telemetry/`
- **Description:** Add OTEL instrumentation tests or contract checks for dispatch, use-case, graph/query, worker, cache, presentation boundaries, low-impact performance signals, and structured operational log events.
- **Acceptance:** Required implementation, contract, documentation, and fixture-backed proof are present for this task.
- **Evidence:** Completed on 2026-06-03. OTEL and operational instrumentation boundaries are covered by `tests/mcp/telemetry-instrumentation.test.ts`, `tests/telemetry/boundary-instrumentation.test.ts`, and `tests/telemetry/config.test.ts`. Validation evidence: `pnpm typecheck` passed; `pnpm test` passed with 36 test files and 188 tests.

### Task T084: Add runtime owner/observer, prewarm, cache invalidation, cold-to-fresh warm-up, stale-to-refreshing-to-fresh update, obsolete-result rejection, concurrent-read, and single-writer graph transaction tests

- **ID:** T084
- **Status:** done
- **Depends on:** [T205]
- **Parallel:** no
- **Story:** —
- **Files:** `src/domain/`, `src/infrastructure/`, `src/ports/`, `tests/`, `tests/graph/`
- **Description:** Add runtime owner/observer, prewarm, cache invalidation, cold-to-fresh warm-up, stale-to-refreshing-to-fresh update, obsolete-result rejection, concurrent-read, and single-writer graph transaction tests.
- **Acceptance:** Required implementation, contract, documentation, and fixture-backed proof are present for this task.
- **Evidence:** Completed on 2026-06-03. Runtime owner/observer, warm-up, cache invalidation, stale/refreshing behavior, obsolete-result rejection, concurrent-read, and single-writer ownership coverage is implemented in `tests/runtime/operations.test.ts`, `tests/runtime/status.test.ts`, and graph transaction tests. Validation evidence: `pnpm typecheck` passed; `pnpm test` passed with 36 test files and 188 tests.

### Task T085: Add workspace safety negative tests for traversal, symlink escape, generated/vendor mutation, shell injection, env handling, output caps, and redaction

- **ID:** T085
- **Status:** done
- **Depends on:** [T205]
- **Parallel:** no
- **Story:** —
- **Files:** `src/domain/policies/`, `src/infrastructure/filesystem/`, `tests/`, `tests/edits/`, `tests/workspace/`
- **Description:** Add workspace safety negative tests for traversal, symlink escape, generated/vendor mutation, shell injection, env handling, output caps, and redaction.
- **Acceptance:** Required implementation, contract, documentation, and fixture-backed proof are present for this task.
- **Evidence:** Completed on 2026-06-03. Workspace safety negative coverage is implemented in `tests/workspace/safety.test.ts`, `tests/workspace/command.test.ts`, `tests/edits/workspace-edit.test.ts`, and workspace edit MCP tests, including traversal, symlink escape, generated/vendor mutation, shell-looking commands, secret-like content, and redaction behavior. Validation evidence: `pnpm typecheck` passed; `pnpm test` passed with 36 test files and 188 tests.

### Task T086: Add degraded-mode tests for missing `tree-sitter` parser/grammar, parser timeout/crash, missing future optional enrichment evidence, and missing test runner

- **ID:** T086
- **Status:** done
- **Depends on:** [T205]
- **Parallel:** no
- **Story:** —
- **Files:** `src/domain/`, `src/infrastructure/`, `src/ports/`, `tests/`, `tests/graph/`
- **Description:** Add degraded-mode tests for missing `tree-sitter` parser/grammar, parser timeout/crash, missing future optional enrichment evidence, and missing test runner.
- **Acceptance:** Required implementation, contract, documentation, and fixture-backed proof are present for this task.
- **Evidence:** Completed on 2026-06-03. Degraded-mode coverage is implemented in runtime status, extraction pipeline, telemetry, and validation-planning tests for parser absence/failure/timeout metadata, unsupported/resource-backed evidence, stale snapshots, and missing validation evidence without fallback behavior. Validation evidence: `pnpm typecheck` passed; `pnpm test` passed with 36 test files and 188 tests.

### Task T087: Add query budget tests for status, scope, context, symbol search, references, impact, preview/apply, and verification plan

- **ID:** T087
- **Status:** done
- **Depends on:** [T205]
- **Parallel:** no
- **Story:** —
- **Files:** `src/application/`, `src/presentation/`, `tests/`
- **Description:** Add query budget tests for status, scope, context, symbol search, references, impact, preview/apply, and verification plan.
- **Acceptance:** Required implementation, contract, documentation, and fixture-backed proof are present for this task.
- **Evidence:** Completed on 2026-06-03. Query budget coverage is implemented across `tests/graph/query-tools.test.ts`, `tests/runtime/orientation-budget.test.ts`, MCP telemetry budget assertions, and edit/verification tests for row limits, traversal depth, source-byte caps, preview/apply bounds, and validation-plan command caps. Validation evidence: `pnpm typecheck` passed; `pnpm test` passed with 36 test files and 188 tests.

### Task T088: Add integration boundary tests proving common integration specs can describe Codex, Claude Code, Kiro, Augment, Gemini, and Junie targets without runtime core dependencies on vendor-specific emitters

- **ID:** T088
- **Status:** done
- **Depends on:** [T205]
- **Parallel:** no
- **Story:** —
- **Files:** `docs/`, `src/domain/policies/`, `src/infrastructure/filesystem/`, `src/integration/`, `tests/`, `tests/edits/`, `tests/integration/`, `tests/workspace/`
- **Description:** Add integration boundary tests proving common integration specs can describe Codex, Claude Code, Kiro, Augment, Gemini, and Junie targets without runtime core dependencies on vendor-specific emitters.
- **Acceptance:** Required implementation, contract, documentation, and fixture-backed proof are present for this task.
- **Evidence:** Completed on 2026-06-03. Added `buildCommonIntegrationProfile` in `src/integration/common/index.ts` and `tests/integration/common-integration-profile.test.ts` proving Codex, Claude Code, Kiro, Augment, Gemini, and Junie are described through common MCP metadata while integration code avoids concrete runtime infrastructure and vendor emitter imports. Validation evidence: `pnpm exec vitest run tests/integration/common-integration-profile.test.ts` passed with 1 test file and 2 tests; `pnpm typecheck` passed; `pnpm test` passed with 36 test files and 188 tests.

### Task T088A: Add Codex feature-wrapper boundary tests proving skills, plugin manifests, hooks, and host MCP config cannot import or call concrete runtime infrastructure except through MCP launch/config metadata

- **ID:** T088A
- **Status:** done
- **Depends on:** [T205]
- **Parallel:** no
- **Story:** —
- **Files:** `docs/`, `src/integration/`, `src/interface-adapters/mcp/`, `src/mcp/`, `tests/`, `tests/integration/`, `tests/mcp/`
- **Description:** Add Codex feature-wrapper boundary tests proving skills, plugin manifests, hooks, and host MCP config cannot import or call concrete runtime infrastructure except through MCP launch/config metadata.
- **Acceptance:** Implementation or documentation exists and current task status marks this item complete; keep evidence current if behavior changes.
- **Evidence:** Migrated from completed checkbox in the pre-migration task ledger. Current validation evidence: `pnpm typecheck` passed and `pnpm test` passed on 2026-06-02.

### Task T089: Validate docs links and metadata

- **ID:** T089
- **Status:** done
- **Depends on:** [T205]
- **Parallel:** no
- **Story:** —
- **Files:** `docs/`
- **Description:** Validate docs links and metadata.
- **Acceptance:** Required implementation, contract, documentation, and fixture-backed proof are present for this task.
- **Evidence:** Completed on 2026-06-03. Added `tests/docs/docs-links-metadata.test.ts` to validate required frontmatter and local Markdown links across `docs/`. Validation evidence: `pnpm exec vitest run tests/docs/docs-links-metadata.test.ts` passed with 1 test file and 2 tests; `pnpm typecheck` passed; `pnpm test` passed with 36 test files and 188 tests.

## Phase 8: Usage-Informed MVP Validation

### Task T098: Add regression fixtures proving broad task prompts route to expected implementation files and do not drift to unrelated high-frequency files

- **ID:** T098
- **Status:** done
- **Depends on:** [T205]
- **Parallel:** no
- **Story:** —
- **Files:** `tests/`
- **Description:** Add regression fixtures proving broad task prompts route to expected implementation files and do not drift to unrelated high-frequency files.
- **Acceptance:** Required implementation, contract, documentation, and fixture-backed proof are present for this task.
- **Evidence:** Completed on 2026-06-03. Added `tests/integration/usage-informed-mvp.test.ts` coverage proving broad task prompts route to expected implementation files without drifting to unrelated high-frequency files. Validation evidence: `pnpm exec vitest run tests/integration/usage-informed-mvp.test.ts tests/mcp/context-for-task-tool.test.ts` passed with 2 test files and 14 tests.

### Task T099: Add response tests proving `context_for_task` and `verification_plan` include complete-enough markers, skipped-work metadata, and exact next actions for targeted symbol/reference/impact follow-up

- **ID:** T099
- **Status:** done
- **Depends on:** [T205]
- **Parallel:** no
- **Story:** —
- **Files:** `src/application/`, `src/presentation/`, `tests/`
- **Description:** Add response tests proving `context_for_task` and `verification_plan` include complete-enough markers, skipped-work metadata, and exact next actions for targeted symbol/reference/impact follow-up.
- **Acceptance:** Required implementation, contract, documentation, and fixture-backed proof are present for this task.
- **Evidence:** Completed on 2026-06-03. Added usage-informed response coverage for complete-enough markers, skipped-work metadata, and exact next actions from `context_for_task` and `verification_plan`. Validation evidence: `pnpm exec vitest run tests/integration/usage-informed-mvp.test.ts tests/mcp/context-for-task-tool.test.ts` passed with 2 test files and 14 tests.

### Task T100: Add negative budget tests proving compact/default first-pass responses do not invoke broad orientation, full topology, diagnostics execution, or high-cardinality cache validation paths

- **ID:** T100
- **Status:** done
- **Depends on:** [T205]
- **Parallel:** no
- **Story:** —
- **Files:** `src/domain/policies/`, `src/infrastructure/filesystem/`, `tests/`, `tests/edits/`, `tests/workspace/`
- **Description:** Add negative budget tests proving compact/default first-pass responses do not invoke broad orientation, full topology, diagnostics execution, or high-cardinality cache validation paths.
- **Acceptance:** Required implementation, contract, documentation, and fixture-backed proof are present for this task.
- **Evidence:** Completed on 2026-06-03. Added negative compact-first-pass coverage proving context requests stay bounded and do not emit or invoke broad orientation, topology, diagnostics-execution, or high-cardinality cache-validation surfaces. Validation evidence: `pnpm exec vitest run tests/integration/usage-informed-mvp.test.ts tests/mcp/context-for-task-tool.test.ts` passed with 2 test files and 14 tests.

### Task T101: Add adoption-oriented golden checks showing targeted `symbol_search`, `find_references`, and `impact` calls are discoverable from first-pass context or validation responses

- **ID:** T101
- **Status:** done
- **Depends on:** [T205]
- **Parallel:** no
- **Story:** —
- **Files:** `src/application/`, `src/presentation/`, `tests/`
- **Description:** Add adoption-oriented golden checks showing targeted `symbol_search`, `find_references`, and `impact` calls are discoverable from first-pass context or validation responses.
- **Acceptance:** Required implementation, contract, documentation, and fixture-backed proof are present for this task.
- **Evidence:** Completed on 2026-06-03. Added adoption-oriented checks proving `symbol_search`, `find_references`, and bounded `impact` are discoverable from graph-backed first-pass context; `context_for_task` now emits a bounded `impact` next action for ranked symbols. Validation evidence: `pnpm exec vitest run tests/integration/usage-informed-mvp.test.ts tests/mcp/context-for-task-tool.test.ts` passed with 2 test files and 14 tests.

### Task T102: Add docs/config routing tests for Markdown/config evidence as routing evidence only, including direct-read caveats before precise documentation claims

- **ID:** T102
- **Status:** done
- **Depends on:** [T205]
- **Parallel:** no
- **Story:** —
- **Files:** `docs/`, `tests/`
- **Description:** Add docs/config routing tests for Markdown/config evidence as routing evidence only, including direct-read caveats before precise documentation claims.
- **Acceptance:** Required implementation, contract, documentation, and fixture-backed proof are present for this task.
- **Evidence:** Completed on 2026-06-03. Added docs/config routing assertions proving Markdown/config evidence is routing evidence only and carries direct-read caveats before precise documentation claims. Validation evidence: `pnpm exec vitest run tests/integration/usage-informed-mvp.test.ts tests/mcp/context-for-task-tool.test.ts` passed with 2 test files and 14 tests.

### Task T102A: Add multi-language/platform coverage tests proving non-Python files are surfaced with `unsupported` or `resource_backed` capability metadata and do not depend on Python adapter behavior

- **ID:** T102A
- **Status:** done
- **Depends on:** [T205]
- **Parallel:** no
- **Story:** —
- **Files:** `src/interface-adapters/mcp/`, `src/mcp/`, `tests/`, `tests/mcp/`
- **Description:** Add multi-language/platform coverage tests proving non-Python files are surfaced with `unsupported` or `resource_backed` capability metadata and do not depend on Python adapter behavior.
- **Acceptance:** Required implementation, contract, documentation, and fixture-backed proof are present for this task.
- **Evidence:** Completed on 2026-06-03. Added multi-language/platform checks proving TypeScript is surfaced as unsupported while YAML workflows and Dockerfile infrastructure are resource-backed, independent of Python adapter behavior. Validation evidence: `pnpm exec vitest run tests/integration/usage-informed-mvp.test.ts tests/mcp/context-for-task-tool.test.ts` passed with 2 test files and 14 tests.

### Task T102B: Add Codex replacement-readiness golden checks proving the predecessor high-frequency workflows are discoverable through the MVP Codex feature mix without using predecessor tool names or backend pass-throughs

- **ID:** T102B
- **Status:** done
- **Depends on:** [T205]
- **Parallel:** no
- **Story:** —
- **Files:** `docs/`, `src/integration/`, `src/interface-adapters/mcp/`, `src/mcp/`, `tests/`, `tests/integration/`, `tests/mcp/`
- **Description:** Add Codex replacement-readiness golden checks proving the predecessor high-frequency workflows are discoverable through the MVP Codex feature mix without using predecessor tool names or backend pass-throughs.
- **Acceptance:** Required implementation, contract, documentation, and fixture-backed proof are present for this task.
- **Evidence:** Completed on 2026-06-03. Added Codex replacement-readiness golden checks proving predecessor high-frequency workflows are discoverable through `context_for_task`, `verification_plan`, and Codex MCP binding metadata without predecessor tool names or backend pass-throughs. Validation evidence: `pnpm exec vitest run tests/integration/usage-informed-mvp.test.ts tests/integration/replacement-readiness.test.ts` passed.

## Post-MVP Task Backlog

### Task T103: Define Markdown document quality contracts for structure findings, compliance findings, link findings, table-readability findings, and formatter plans

- **ID:** T103
- **Status:** skipped
- **Depends on:** [T206]
- **Parallel:** no
- **Story:** —
- **Files:** `docs/`
- **Description:** Define Markdown document quality contracts for structure findings, compliance findings, link findings, table-readability findings, and formatter plans.
- **Acceptance:** Post-MVP scope is explicitly designed or implemented when this item is promoted; until then it remains deferred.
- **Evidence:** Skipped on 2026-06-03. Post-MVP Markdown quality scope remains deferred and is not required for MVP closure.

### Task T104: Define documentation quality ports: `MarkdownParserPort`, `MarkdownStructureCheckPort`, `MarkdownCompliancePolicyPort`, `MarkdownFormatPlannerPort`, `MarkdownLinkResolverPort`, and `DocumentationPolicyPort`

- **ID:** T104
- **Status:** skipped
- **Depends on:** [T206]
- **Parallel:** no
- **Story:** —
- **Files:** `docs/`, `src/domain/`, `src/infrastructure/`, `src/ports/`, `tests/graph/`
- **Description:** Define documentation quality ports: `MarkdownParserPort`, `MarkdownStructureCheckPort`, `MarkdownCompliancePolicyPort`, `MarkdownFormatPlannerPort`, `MarkdownLinkResolverPort`, and `DocumentationPolicyPort`.
- **Acceptance:** Post-MVP scope is explicitly designed or implemented when this item is promoted; until then it remains deferred.
- **Evidence:** Skipped on 2026-06-03. Post-MVP Markdown quality ports remain deferred and are not required for MVP closure.

### Task T105: Add Markdown quality fixtures for skipped heading levels, inconsistent numbering, ambiguous nested lists, wide tables, definition-like tables, frontmatter violations, broken links, and unchanged documents

- **ID:** T105
- **Status:** skipped
- **Depends on:** [T206]
- **Parallel:** no
- **Story:** —
- **Files:** `docs/`, `tests/`
- **Description:** Add Markdown quality fixtures for skipped heading levels, inconsistent numbering, ambiguous nested lists, wide tables, definition-like tables, frontmatter violations, broken links, and unchanged documents.
- **Acceptance:** Post-MVP scope is explicitly designed or implemented when this item is promoted; until then it remains deferred.
- **Evidence:** Skipped on 2026-06-03. Post-MVP Markdown quality fixtures remain deferred and are not required for MVP closure.

### Task T106: Implement read-only `CheckMarkdownDocument` and `CheckMarkdownSet` use-case contracts behind documentation quality ports

- **ID:** T106
- **Status:** skipped
- **Depends on:** [T206]
- **Parallel:** no
- **Story:** —
- **Files:** `docs/`
- **Description:** Implement read-only `CheckMarkdownDocument` and `CheckMarkdownSet` use-case contracts behind documentation quality ports.
- **Acceptance:** Post-MVP scope is explicitly designed or implemented when this item is promoted; until then it remains deferred.
- **Evidence:** Skipped on 2026-06-03. Post-MVP Markdown checking use cases remain deferred and are not required for MVP closure.

### Task T107: Implement `PlanMarkdownFormat` and `PreviewMarkdownFormat` contracts so readability rewrites are explainable and previewable before mutation

- **ID:** T107
- **Status:** skipped
- **Depends on:** [T206]
- **Parallel:** no
- **Story:** —
- **Files:** `docs/`, `src/application/`, `src/presentation/`, `tests/`
- **Description:** Implement `PlanMarkdownFormat` and `PreviewMarkdownFormat` contracts so readability rewrites are explainable and previewable before mutation.
- **Acceptance:** Post-MVP scope is explicitly designed or implemented when this item is promoted; until then it remains deferred.
- **Evidence:** Skipped on 2026-06-03. Post-MVP Markdown formatting contracts remain deferred and are not required for MVP closure.

### Task T108: Integrate Markdown quality checks into `verification_plan` for touched documentation without running hidden formatting

- **ID:** T108
- **Status:** skipped
- **Depends on:** [T206]
- **Parallel:** no
- **Story:** —
- **Files:** `docs/`, `src/application/`, `src/presentation/`, `tests/`
- **Description:** Integrate Markdown quality checks into `verification_plan` for touched documentation without running hidden formatting.
- **Acceptance:** Post-MVP scope is explicitly designed or implemented when this item is promoted; until then it remains deferred.
- **Evidence:** Skipped on 2026-06-03. Post-MVP Markdown quality integration into `verification_plan` remains deferred and is not required for MVP closure.

### Task T109: Add documentation-quality presenter golden outputs for findings, formatter rationale, source ranges, and preview-token metadata

- **ID:** T109
- **Status:** skipped
- **Depends on:** [T206]
- **Parallel:** no
- **Story:** —
- **Files:** `docs/`, `src/application/`, `src/presentation/`, `tests/`
- **Description:** Add documentation-quality presenter golden outputs for findings, formatter rationale, source ranges, and preview-token metadata.
- **Acceptance:** Post-MVP scope is explicitly designed or implemented when this item is promoted; until then it remains deferred.
- **Evidence:** Skipped on 2026-06-03. Post-MVP Markdown quality presenter goldens remain deferred and are not required for MVP closure.

### Task T110: Add documentation-quality boundary tests proving the checker and formatter do not bypass workspace safety or edit preview/apply. language path. docs/wiki export. Kiro, Augment, Gemini, and Junie beyond common integration profiles. vendor-neutral hook intents. mutation

- **ID:** T110
- **Status:** skipped
- **Depends on:** [T206]
- **Parallel:** no
- **Story:** —
- **Files:** `docs/`, `src/application/`, `src/domain/policies/`, `src/infrastructure/filesystem/`, `src/infrastructure/telemetry/`, `src/integration/`, `src/presentation/`, `tests/`, `tests/edits/`, `tests/integration/`, `tests/mcp/telemetry-instrumentation.test.ts`, `tests/telemetry/`, `tests/workspace/`
- **Description:** Add documentation-quality boundary tests proving the checker and formatter do not bypass workspace safety or edit preview/apply. language path. docs/wiki export. Kiro, Augment, Gemini, and Junie beyond common integration profiles. vendor-neutral hook intents. mutation.
- **Acceptance:** Post-MVP scope is explicitly designed or implemented when this item is promoted; until then it remains deferred.
- **Evidence:** Skipped on 2026-06-03. Post-MVP Markdown quality boundary tests remain deferred and are not required for MVP closure.
