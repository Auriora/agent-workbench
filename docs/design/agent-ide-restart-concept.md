---
title: Agent IDE restart concept
doc_type: design
status: draft
owner: platform
last_reviewed: 2026-06-07
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Agent IDE Restart Concept

## Purpose

This document captures the concept for a new agent-first IDE/runtime project
based on lessons from the existing `agent-ide` proof of concept and current
Agent Workbench design work.

The goal is to define the project shape before creating a new repository: what
to keep, what to change, and which capabilities should be first-class from the
start.

This concept has been fanned out into focused architecture, requirements,
design, ADR, reference, and spec documents. Use this document for the narrative
through-line and the fanned-out documents for ongoing changes. Contract details,
MVP scope, schemas, and enum definitions belong in the fanned-out docs, not in
this concept note.

Primary fanned-out docs:

- [Documentation map](../reference/documentation-map.md)
- [System architecture](../architecture/system-architecture.md)
- [Runtime requirements](../requirements/runtime-requirements.md)
- [Runtime contracts](../reference/runtime-contracts.md)
- [Workspace safety contract](../reference/workspace-safety-contract.md)
- [Layered runtime architecture](layered-runtime-architecture.md)
- [Graph store design](graph-store-design.md)
- [Language adapter design](language-adapter-design.md)
- [MCP surface design](mcp-surface-design.md)
- [Attention layer design](attention-layer-design.md)
- [Edit and validation loop design](edit-and-validation-loop-design.md)
- [Knowledge layer design](knowledge-layer-design.md)
- [Language capability matrix](../reference/language-capability-matrix.md)
- [MVP proof matrix](../reference/mvp-proof-matrix.md)
- [Runtime requirements](../requirements/runtime-requirements.md)

## Scope

In scope:

- repo-scoped runtime architecture for coding agents
- local graph/index storage
- initial language/config extraction and reference evidence
- agent-facing MCP tools, resources, prompts, and workflow contracts
- scoped context, symbol/reference evidence, bounded edits, and validation
  planning
- trust, freshness, provenance, and audit semantics

Out of scope for the first implementation:

- a full graphical IDE UI
- cloud-hosted multi-user orchestration
- LLM-generated code understanding as the default source of truth
- full semantic support for every language at launch
- broad graph reports, communities, and analytics in the MVP

## Source Projects

### `agent-ide`

`agent-ide` proves the runtime-first model. Its strongest ideas are:

- a long-lived repo-scoped MCP runtime
- background indexing and warm cache state
- compact resources for status, scope, docs, and runtime health
- tools for symbol lookup, references, diagnostics, impact, test targeting, and
  post-edit feedback
- trust/freshness/scope metadata on outputs
- preview/apply/rollback contracts for workspace edits

Its main limitation is that it grew from a Python-first script/plugin PoC.
Some compact first-pass tools still trigger broad topology, validation, or
cache freshness work. That makes results slower and pushes agents back to
direct file reads.

The restart should keep deterministic local extraction, persisted graph
evidence, explicit reference resolution, confidence labels, and compact
agent-facing query tools, but keep
`tree-sitter` as the mandatory deterministic parser evidence for coding
workflows. LSP and AST are optional enrichers, never replacement parsers.

## Design Summary

The new project should be a language-neutral, local-first agent IDE backend.

The runtime owns a single analyzed repository, maintains a SQLite-backed graph
index, watches source and config changes, and exposes compact MCP resources and
tools. Agents use the runtime as an IDE backend: they ask for status, retrieve
task context, inspect symbols and graph relationships, apply bounded edits, and
run targeted validation.

The key shift from the current PoC is to make graph and index primitives the
foundation rather than wrapping broad scans with compact payloads. Routine
edit-loop tools should use targeted indexed queries. Broad topology and
community analysis should be explicit orientation/reporting operations.

## Components And Responsibilities

| Component | Responsibility | Owned Inputs | Owned Outputs |
| --- | --- | --- | --- |
| Repo runtime | Own one analyzed repo, coordinate indexing, watch changes, expose MCP | repo path, config, watcher events, client requests | resources, tool responses, runtime state |
| Graph store | Persist files, symbols, edges, unresolved refs, snapshots, and freshness metadata | extraction results, resolution results, validation hints | SQLite rows, FTS indexes, query results |
| Extractor registry | Dispatch mandatory `tree-sitter` adapters by language; enrichers (AST/LSP) remain optional | files, language config, parser backends | nodes, edges, unresolved references, diagnostics hints |
| Reference resolver | Resolve extracted references into graph edges | unresolved refs, imports, symbols, framework rules | resolved edges with provenance and confidence |
| Application use cases | Orchestrate status, scope, context, search, references, impact, edit, and validation operations | domain policies, graph/file/extraction ports, request models | application results for presenters |
| Presentation layer | Assemble envelopes, metadata, warnings/errors, source sections, truncation, budgets, and stable ordering | application results, runtime contracts | agent-facing response payloads |
| Knowledge layer | Produce post-MVP orientation and audit views | graph communities, edge provenance, docs, source metadata | repo report, god nodes, communities, surprising links, gaps |
| Edit manager | Preview, apply, and drift-check bounded edits | workspace edits, file identities | preview tokens, applied edits |
| Command runner | Plan commands in MVP and execute allowlisted commands post-MVP | touched files, graph impact, project commands | planned or executed validation evidence |
| MCP surface | Present resources, tools, templates, and prompts to agents | runtime APIs | client-neutral contracts |

## Core Data Model

The graph store should be SQLite-backed from the start.

Core tables:

- `files`: repo-relative path, language, content hash, size, mtime, indexed_at,
  node count, indexing errors
- `nodes`: stable id, kind, name, qualified name, file path, language, source
  range, signature, docstring, visibility, metadata
- `edges`: source node, target node, kind, source range, provenance,
  confidence, metadata
- `unresolved_refs`: source node, reference name, reference kind, file, range,
  candidate metadata
- `snapshots`: repo/config identity, created_at, freshness, schema version
- optional post-MVP tables: docs, tests, attention items, report summaries, and
  usage events, added only when a concrete query needs relational storage

Indexes should support exact lookup, lower-name lookup, qualified-name lookup,
file/range lookup, incoming/outgoing edge traversal, and FTS over names,
qualified names, signatures, docstrings, docs headings, and selected text.

SQLite is an acceleration and evidence store, not canonical truth. Source files,
`tree-sitter` extraction, repo docs, and executed tests remain authoritative.
AST and LSP outputs can add evidence with provenance but never replace parser
authority.

## Language Capability Model

Every language adapter must report capability level:

- `semantic`: symbols, references, diagnostics, test routing, freshness, and
  fallback behavior are backed by `tree-sitter` extraction plus optional
  enrichment evidence (AST/LSP/tooling).
- `partial_semantic`: conservative declarations or config extraction exist, but
  references or flow claims need direct verification.
- `resource_backed`: files and project signals are available for routing only.
- `unsupported`: files may exist, but no meaningful adapter is configured.

Initial recommended language scope:

- Markdown/config: shared routing and project-context substrate from day one.
- Python: first partial-semantic target, with promotion to `semantic` only after
  fixture-proven references, impact, diagnostics, validation routing,
  freshness, and degraded behavior.
- TypeScript/JavaScript: second partial-semantic target after the first
  language path proves the contracts.
- PHP/Laravel: Level 1 dogfood target because an identified PHP developer can
  test the tools and give feedback; start with Composer metadata, Laravel
  route/controller/model evidence, and PHPUnit/Pest planning.
- Nuxt/Vue web apps: Level 1 dogfood target for the same tester's JS/TS Nuxt
  workflow; start with app shape, routes/pages/components, SSR/runtime config,
  and Vite/Vitest/Playwright planning.
- C#: post-MVP resource-backed or partial-semantic target.
- CloudFormation/SAM: post-MVP infrastructure/resource-backed target for
  resource and handler relationships.
- Go: next language after the Level 1 language and framework targets plus C#
  and SAM are stable.
- C/C++: later priority because strong semantics require compile metadata and
  clangd/libclang readiness.
- Rust: add after C/C++ as repo-language support using Cargo and
  `rust-analyzer`; keep distinct from any future Rust implementation core.
- Ruby: add after Rust as repo and framework support using Bundler/Gemfile
  evidence, Rails route/model/controller evidence where present, and
  RSpec/Minitest planning.
- Extended backlog, in order: SQL, Bash/Shell, Terraform/HCL,
  Dockerfile/Compose, GitHub Actions/CI YAML, Kubernetes/Helm, Svelte,
  PowerShell, Swift/Kotlin/Dart, Java last.

Initial capability targets:

| Area | Initial level | Backend direction |
| --- | --- | --- |
| Markdown/config | `resource_backed` | deterministic parsers, path/link extraction, project config discovery |
| Python | `partial_semantic`, then `semantic` | `tree-sitter` (mandatory), optional Python AST enrichment, Pyright/LSP, Ruff, pytest |
| TypeScript/JavaScript | `partial_semantic`, then `semantic` | tree-sitter plus TypeScript compiler API or `tsserver`, `package.json`, `tsconfig` |
| PHP/Laravel | `resource_backed`, then `partial_semantic` | Level 1 dogfood priority; `tree-sitter` parser, Composer metadata, Laravel app/route/controller/model discovery, PHPUnit/Pest planning, optional PHP LSP |
| Nuxt/Vue Web Apps | `resource_backed`, then `partial_semantic`, then `semantic` | Level 1 dogfood priority; Nuxt/Vue app shape, routes/pages/components, SSR/runtime config, Vite/Vitest/Playwright planning, optional framework language services |
| C# | `partial_semantic`, then `semantic` | `tree-sitter` (mandatory), C# LSP as optional enrichment, `.sln`/`.csproj`, NuGet and test project discovery |
| CloudFormation/SAM | `resource_backed`, then `partial_semantic` | YAML/JSON parser plus intrinsic resolver and source handler linking |
| Go | `partial_semantic`, then `semantic` | Go parser, `gopls`, `go list`, `go test` |
| C/C++ | `resource_backed`, then `partial_semantic` | tree-sitter, clangd/libclang when `compile_commands.json` exists |
| Rust | `partial_semantic`, then `semantic` | `tree-sitter` (mandatory), optional Rust parser/enrichment, Cargo metadata, `rust-analyzer`, `cargo test` |
| Ruby | `resource_backed`, then `partial_semantic` | `tree-sitter` parser, Bundler/Gemfile metadata, Rails route/model/controller discovery, RSpec/Minitest planning, optional Ruby LSP |
| SQL | `resource_backed`, then `partial_semantic` | dialect-aware parser, migration-tool integration, schema/table/column references |
| Bash/Shell | `partial_semantic` | shell parser, ShellCheck, sourced-file and command/function references |
| Terraform/HCL | `partial_semantic` | HCL parser, provider/module/resource/variable/output graph |
| Docker/Compose | `resource_backed` | Dockerfile and Compose parsers, service/env/port/volume graph |
| CI YAML | `resource_backed` | GitHub Actions and workflow parsers, jobs, steps, validation commands |
| Kubernetes/Helm | `resource_backed`, then `partial_semantic` | Kubernetes YAML and Helm chart parsing, resource/service/config relationships |
| Svelte | `partial_semantic`, then `semantic` | framework language services, SFC parsing, route/component/template links |
| PowerShell | `partial_semantic` | PowerShell parser, script/function/module references |
| Swift/Kotlin/Dart | `resource_backed`, then `partial_semantic` | `tree-sitter` parser, optional LSP adapters when relevant repos appear |
| Java | `resource_backed`, then `partial_semantic` | `tree-sitter` parser plus Maven/Gradle, optional Java LSP support, deferred until last |

Backend promotion gates:

- exact-symbol correctness
- duplicate-name ambiguity behavior
- reference and impact correctness
- diagnostics and nearest-test routing
- cache freshness after add, modify, delete, rename, and config changes
- cold/warm latency on representative repositories
- degraded behavior when primary parser or enrichers/tooling are missing or slow

## Language Implementation Plan

Implementation should start with a cross-cutting slice rather than completing
one language in isolation. The first slice must exercise the full runtime path
for the priority areas:

```text
scan files
-> detect language or infra type
-> extract nodes, edges, and unresolved references
-> store graph/index rows
-> resolve references
-> query symbols/resources/usages/callers/callees
-> build task context
-> emit attention items
-> plan or run diagnostics/tests
-> expose through MCP
```

The first cross-cutting slice should include Markdown/config plus one
partial-semantic language path. TypeScript/JavaScript should be the next
language once the first fixture-backed path proves the runtime contracts. C# and
CloudFormation/SAM should remain post-MVP unless reduced to resource-backed
discovery fixtures.

After the slice works, deepen support one area at a time:

1. Python: imports, references, diagnostics, pytest targeting, safe rename,
   change signature, and import cleanup.
2. TypeScript/JavaScript: `tsconfig` path aliases, JSX/TSX, package metadata,
   Jest/Vitest/Playwright discovery, safe rename, and import maintenance.
3. TypeScript/JavaScript: `tsconfig` path aliases, JSX/TSX, package metadata,
   Jest/Vitest/Playwright discovery, and import maintenance after preview
   contracts are safe.
4. PHP/Laravel: Composer metadata, Laravel route/controller/model evidence,
   framework-aware validation planning, and PHPUnit/Pest targeting.
5. Nuxt/Vue web apps: app-shape detection, route/page/component links,
   SSR/runtime config, and Vite/Vitest/Playwright targeting.
6. CloudFormation/SAM: handler/resource linking, API routes, events, env vars,
   IAM relationships, and affected-handler/test mapping.
7. C#: Roslyn/LSP semantic resolution, solution/project graph, NuGet context,
   partial classes, extension methods, xUnit/NUnit/MSTest targeting.
8. Go: `gopls`, package graph, build tags, references, callers/callees, and
   `go test` targeting.
9. C/C++: clangd/libclang integration, include graph, compile-unit readiness,
   callers/callees, and test routing where project metadata supports it.
10. Rust: Cargo metadata, module graph, `rust-analyzer` references, macro caveats,
   callers/callees, and `cargo test` targeting.
11. Ruby: Bundler/Gemfile metadata, Rails route/model/controller evidence,
   framework-aware validation planning, and RSpec/Minitest targeting.
12. Extended backlog in priority order: SQL; Bash/Shell; Terraform/HCL;
   Dockerfile/Compose; GitHub Actions/CI YAML; Kubernetes/Helm; Svelte;
   PowerShell; Swift/Kotlin/Dart; Java last.

Do not mark a language `semantic` because a parser can extract declarations.
Semantic support requires trustworthy references, impact, diagnostics/test
routing, freshness behavior, and degraded-mode reporting.

## CloudFormation And SAM Support

CloudFormation and SAM should be treated as an infra adapter, not generic YAML.
It should add graph evidence that connects infrastructure resources to source
code, tests, configuration, and security posture.

Recommended nodes:

- `stack`
- `template`
- `resource`
- `lambda_function`
- `api_route`
- `event_source`
- `iam_policy`
- `env_var`
- `output`
- `parameter`
- `condition`
- `handler_symbol`

Recommended edges:

- `defines`
- `references`
- `depends_on`
- `invokes`
- `routes_to`
- `uses_env`
- `grants_permission`
- `exports`
- `imports_value`
- `handler_resolves_to`

The adapter should understand common intrinsic functions and SAM conventions:
`Ref`, `Fn::GetAtt`, `Fn::Sub`, `Fn::Join`, `Fn::ImportValue`, `DependsOn`,
Lambda events, API routes, environment variables, policies, outputs, and
handler strings.

Agent questions this should support:

- Which Lambda handles this API route?
- What environment variables does this handler rely on?
- What permissions does this function have?
- Which template resources are affected by changing this handler?
- What tests should run if this Lambda handler or route changes?

## MCP Surface

The runtime should expose resources for cheap state and tools for computation.

MVP first-read resources:

- `repo:///overview`
- `repo:///status`
- `repo:///scope`

MVP workflow tools:

- `context_for_task`
- `symbol_search`
- `find_references`
- bounded `impact`
- `verification_plan`
- `preview_workspace_edit`
- `apply_workspace_edit`

Post-MVP graph exploration tools:

- `graph_query`
- `shortest_path`
- `neighbors`
- `community`
- `god_nodes`
- `surprising_connections`
- `graph_stats`

Post-MVP attention tools:

- `attention_current`
- `attention_acknowledge`
- `attention_for_files`

Heavy exploration tools should have project-size-aware budgets. Lightweight
tools should return locations and metadata by default, with source sections only
when requested or when the task context engine decides they are high value.

## Agent Workflow

Normal coding work should follow this loop:

1. read `repo:///status` and `repo:///scope`
2. `context_for_task`
3. direct source read only for selected edit targets or when context reports
   low confidence
4. preview/apply edits
5. `verification_plan`
6. run commands manually or through a future allowlisted command runner

Exploration work should follow this loop:

1. read `repo:///overview`
2. use `symbol_search`, `find_references`, or bounded `impact` for
   bounded follow-up
3. read exact files only when the graph says source verification is needed

The runtime should treat agent fallback to `rg`, `find`, broad file reads, or
ad hoc validation as a product signal. Repeated fallback should become backlog
evidence for improving indexes, ranking, contracts, or trust metadata.

## Agent Attention Layer

Human IDEs guide attention with visual cues: red squiggles, gutter icons,
highlighted usages, changed-file markers, breadcrumbs, inline hints, and
warning tool windows. Agents do not need those visual surfaces. They need the
same underlying information as timely, scoped, machine-readable attention
guidance.

The runtime should emit attention items only when the information changes the
safe or efficient next action. The default path should remain quiet when an edit
is clean and validation is complete.

Attention item shape and enum values are owned by
[Runtime contracts](../reference/runtime-contracts.md).

MVP attention is limited to blockers and warnings defined in
[Runtime contracts](../reference/runtime-contracts.md). Nudges, context items,
rollback availability, and refactoring-specific risks are post-MVP.

High-value injection points:

- `context_for_task`: surface planning ambiguity, generated/vendor boundaries,
  missing language support, known risky files, likely tests, and required direct
  reads.
- `preview_workspace_edit`: surface missed rename surfaces, dynamic references,
  public API changes, stale targets, or broad replacement fallbacks.
- `apply_workspace_edit`: surface drift, unexpected touched files, parse errors,
  and refused paths.
- `verification_plan`: surface what is proven, what is only planned, and which
  validation command is cheapest with useful evidence.
- pre-final response checks: surface unvalidated touched files, blocked tests,
  stale diagnostics, or caveats the agent should mention.

Refactoring-specific attention examples:

- Rename: detected usages, possible unresolved usages, missed surfaces such as
  templates, route names, string literals, or config keys.
- Change signature: callers missing required parameters, overrides that no
  longer match, interface implementations that need updating.
- Safe delete: live non-test references, exported symbols, public API mentions,
  or unresolved dynamic references.
- Move symbol: imports requiring update, package boundary changes, generated
  source ownership, and affected tests.

This layer is one of the main differences between an agent IDE and a human IDE.
It should not dump everything the runtime knows. It should interrupt only with
ranked facts that change the next action.

## IDE Capability Assessment

Human IDE feature sets are useful evidence, but they should not be copied as UI
features. For agents, the useful form is a tool, resource, edit contract,
validation primitive, or attention item.

Highest-value capabilities:

- Project-wide indexing, fast search, file tree, generated/vendor awareness:
  these reduce discovery tool calls and prevent edits in the wrong place.
- Symbol navigation, definitions, usages, callers, callees, and dependency
  impact: these answer where to edit and what may break.
- Context building with source section packing: this gives agents enough source
  to act without broad file reads.
- Diagnostics, type checking, formatting, and nearest-test routing: these close
  the edit loop with concrete evidence.
- Previewable bounded edits are valuable only with preview, drift checks, path
  containment, and validation planning. Semantic refactors are post-MVP.

Medium-value capabilities:

- Structure views, breadcrumbs, module views, and file outlines: useful as
  compact context packets rather than visual navigation.
- Auto-imports and import cleanup: useful as conservative repair-loop tools.
- TODO tracking and docs indexing: useful routing evidence for intent and
  conventions, but not proof of behavior.
- Package manager, module config, and dependency awareness: important for
  knowing first-party boundaries, generated source, validation commands, and
  external ownership.
- Framework-specific inspections: valuable after generic parser, graph, and
  validation contracts are reliable.

Lower-priority or higher-risk capabilities:

- Broad quick fixes and intention actions: risky unless each action has clear
  preconditions, preview, and validation.
- Advanced refactors such as pull up, push down, extract interface, broad move,
  or whole-project safe delete: defer until the language backend has strong
  semantic evidence and representative tests.
- Coverage reports: useful later, but nearest-test routing and validation gaps
  are more important early.
- Security inspections: useful but likely noisy; require provenance, severity,
  suppressions, and clear distinction between findings and advice.
- External library navigation: useful but must be version-labeled,
  local/cache-first, and explicitly caveated when relying on external docs.

The practical priority is:

1. Indexing, FTS, file tree, generated/vendor awareness.
2. Symbol search, definitions, references, callers, callees, impact.
3. Context builder with source section packing.
4. Diagnostics, type checking, formatting, nearest tests.
5. Bounded edits with preview/apply and drift checks.
6. TODO, docs, project config, dependency context.
7. Safe rename and change signature for mature language backends.
8. Dead code, security, and framework-specific inspections.
9. Coverage and advanced refactors.

## Trust And Provenance

Every result should use the shared response envelope and enums in
[Runtime contracts](../reference/runtime-contracts.md).

Every graph edge should carry:

- `confidence`: `EXTRACTED`, `INFERRED`, or `AMBIGUOUS`
- `provenance`: `tree-sitter` parser, AST enrich, LSP enrich, import resolver, framework resolver, docs link,
  test relation, heuristic, semantic extraction
- source range or explanation where available

Agents should never need to infer whether a result is proof, routing evidence,
or a useful guess.

## Performance Principles

The restart should avoid the main performance trap from the current PoC:
compact output must not hide broad computation.

Rules:

- Hot-path tools use targeted SQLite queries.
- Broad topology/community reports are explicit orientation calls.
- Validation never loads whole-repo topology when a file-level impact query is
  sufficient.
- Watcher-clean snapshots are the freshness authority for hot reads.
- Parser work runs in isolated workers with timeouts and recycling.
- Index updates are incremental where possible and debounced after save bursts.
- SQLite rebuilds use locks, temporary databases, validation, and atomic replace.
- Large result caches live in SQLite or compact row stores, not unbounded JSON
  files.

## Reporting And Knowledge Layer

The graph report should be a durable onboarding artifact generated from the
current graph. It should include:

- corpus/repo summary
- language coverage and unsupported areas
- god nodes
- communities and cohesion
- surprising cross-file or cross-language connections
- ambiguous edges that need review
- isolated nodes and thin communities
- suggested questions
- validation and freshness caveats

The report should be available as an MCP resource and optionally exported as
markdown under a generated docs/wiki directory.

## Implementation Language Recommendation

The first implementation should use TypeScript on Node.js, while keeping graph
schema, adapter contracts, MCP contracts, and persisted data model
language-neutral.

TypeScript is the recommended starting point because:

- TypeScript fits the target runtime shape: tree-sitter extraction, SQLite,
  MCP tools, watcher/sync, graph traversal, and context building are all
  practical in a Node.js package.
- Node.js has practical cross-platform support for filesystem watching, worker
  threads, subprocess orchestration, and npm distribution.
- MCP server packaging and installation into arbitrary repositories is
  straightforward through npm.
- The design is still fluid; TypeScript allows faster iteration on tool
  contracts, ranking, attention items, validation loops, and agent ergonomics
  than a lower-level implementation.
- A TypeScript runtime can still orchestrate Python, pytest, pyright, ruff, Go,
  npm, Rust, .NET, and other ecosystem tools without making the core runtime
  Python-bound.

Python should remain an important adapter and validation ecosystem, especially
for Python-specific diagnostics, tests, and refactors. It should not be the core
runtime language again, because the existing PoC shows the cost of Python-first
assumptions, environment coupling, and broad-scan performance pressure.

Rust should not be the initial implementation language unless the project is
prepared to spend more time on infrastructure before learning from agent usage.
Rust remains a strong candidate for a future hot-path core if profiling shows
that parsing, graph indexing, or reference resolution need tighter memory and
CPU control.

Recommended implementation shape:

```text
TypeScript runtime
  - MCP server
  - SQLite graph store
  - watcher and incremental sync
  - context engine
  - attention layer
  - edit and validation orchestration

Language adapters
  - TypeScript/JavaScript tree-sitter and language-service integration
  - Python tree-sitter extraction with optional AST/LSP/tooling enrichment
  - C# tree-sitter extraction with optional LSP enrichment
  - CloudFormation/SAM infra adapter
  - future Go, C/C++, PHP/Laravel, Nuxt/Vue, Rust, Ruby, SQL, shell, infra,
    frontend, and other adapters

Optional future Rust core
  - high-volume parsing
  - graph indexing hot paths
  - reference resolution hot paths
```

The main architectural guardrail is to avoid baking Node-specific assumptions
into the durable contracts. Storage schemas, MCP payloads, adapter outputs, and
attention items should remain implementation-neutral.

## MVP

The first useful version should include:

- explicit repo initialization and binding
- minimal SQLite graph store with files, nodes, edges, unresolved refs, and FTS
- Markdown/config routing and one partial-semantic language path
- fixture-backed promotion gates before any adapter is labeled `semantic`
- file watcher with debounced incremental sync
- status, scope, overview, context, symbol search, references, and bounded
  impact
- task context builder with source section packing
- MCP response envelope with canonical capability, freshness, trust, and
  evidence metadata
- preview/apply edit contracts with built-in drift checks
- validation planning without command execution by default
- workspace safety policy for path containment, generated writes, redaction, and
  command planning
- MVP proof matrix with fixtures, golden responses, budget tests, and degraded
  modes

Post-MVP capabilities include graph reports, communities, god nodes,
surprising connections, usage-gap analytics, nearest-test execution, C# semantic
support, CloudFormation/SAM relationship extraction, import maintenance, safe
rename, change signature, safe delete, and broad graph exploration tools.

## Open Questions

- Decision: `tree-sitter` is the mandatory primary extraction path.
  AST and LSP are optional enrichers and must never replace parser ownership.
- When graph reports are added, should they remain generated cache artifacts or
  have an explicit tracked export workflow?
- What is the minimum supported MCP/client surface for Codex, Claude Code, Kiro,
  and other agents?
- How much of docs/media corpus support belongs in the core product versus an
  optional knowledge extension?
- When should vector search be considered after FTS plus graph traversal are
  proven?
- Which attention items should be visible by default, and which should require
  explicit expansion to avoid alert fatigue?
- What minimum semantic evidence is required before enabling each mutating
  refactor tool?
- Which hot paths, if any, should be candidates for a future Rust core after
  TypeScript implementation profiling?

## Related Local References

- Architecture: [System architecture](../architecture/system-architecture.md)
- Requirements: [Runtime requirements](../requirements/runtime-requirements.md)
- ADRs:
  - [Use a local-first repo runtime](../adr/0001-local-first-repo-runtime.md)
  - [Use SQLite as the graph evidence store](../adr/0002-sqlite-graph-evidence-store.md)
  - [Start with a TypeScript runtime](../adr/0003-typescript-runtime.md)
  - [Require semantic evidence before semantic capability](../adr/0004-semantic-evidence-gates.md)
- Designs:
  - [Graph store design](graph-store-design.md)
  - [Language adapter design](language-adapter-design.md)
  - [MCP surface design](mcp-surface-design.md)
  - [Attention layer design](attention-layer-design.md)
  - [Edit and validation loop design](edit-and-validation-loop-design.md)
  - [Knowledge layer design](knowledge-layer-design.md)
- Reference: [Language capability matrix](../reference/language-capability-matrix.md)
- Delivery record: [Spec closure log](../history/spec-closure-log.md)
- Predecessor proof of concept: superseded by the current Agent Workbench
  design and closure evidence.
