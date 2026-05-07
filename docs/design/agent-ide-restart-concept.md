---
title: Agent IDE restart concept
doc_type: design
status: draft
owner: platform
last_reviewed: 2026-05-07
---

# Agent IDE Restart Concept

## Purpose

This document captures the concept for a new agent-first IDE/runtime project
based on lessons from the existing `agent-ide` proof of concept and selected
ideas from `graphify` and `codegraph`.

The goal is to define the project shape before creating a new repository: what
to keep, what to change, and which capabilities should be first-class from the
start.

This concept has been fanned out into focused architecture, requirements,
design, ADR, reference, and spec documents. Use this document for the narrative
through-line and the fanned-out documents for ongoing changes.

Primary fanned-out docs:

- [System architecture](../architecture/system-architecture.md)
- [Runtime requirements](../requirements/runtime-requirements.md)
- [Graph store design](graph-store-design.md)
- [Language adapter design](language-adapter-design.md)
- [MCP surface design](mcp-surface-design.md)
- [Attention layer design](attention-layer-design.md)
- [Edit and validation loop design](edit-and-validation-loop-design.md)
- [Knowledge layer design](knowledge-layer-design.md)
- [Language capability matrix](../reference/language-capability-matrix.md)
- [MVP spec package](../specs/001-agent-ide-runtime/spec.md)

## Scope

In scope:

- repo-scoped runtime architecture for coding agents
- local graph/index storage
- cross-language extraction and reference resolution
- agent-facing MCP tools, resources, prompts, and workflow contracts
- graph-based onboarding, exploration, impact analysis, and validation routing
- trust, freshness, provenance, and audit semantics

Out of scope for the first implementation:

- a full graphical IDE UI
- cloud-hosted multi-user orchestration
- LLM-generated code understanding as the default source of truth
- full semantic support for every language at launch

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

### `codegraph`

`codegraph` provides the strongest model for deterministic, local,
cross-language code intelligence:

- tree-sitter-based extraction across many languages
- SQLite graph database with FTS indexes
- explicit reference-resolution phase after extraction
- callers, callees, impact radius, file tree, symbol search, and task context
- native file watcher with debounced incremental sync
- parse workers, parser timeouts, and worker recycling for large repositories
- MCP tools separated into lightweight targeted lookups and heavier exploration
  tools

The restart should borrow its local-first graph core and language extraction
model, while preserving Agent IDE's stronger edit-loop and validation semantics.

### `graphify`

`graphify` provides the strongest knowledge-graph product model:

- pipeline from detection to extraction, graph build, clustering, analysis,
  report, and export
- confidence labels such as `EXTRACTED`, `INFERRED`, and `AMBIGUOUS`
- god nodes, communities, surprising connections, knowledge gaps, ambiguous
  edges, and suggested questions
- graph query tools such as BFS/DFS query, neighbors, shortest path, community,
  graph stats, and god nodes
- generated markdown/wiki/report outputs that give agents a stable onboarding
  entry point

The restart should borrow these reporting and audit concepts, but keep
deterministic parser/LSP evidence as the default for coding workflows.

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
| Graph store | Persist files, symbols, edges, references, docs, tests, snapshots, freshness metadata | extraction results, resolution results, docs index, validation hints | SQLite rows, FTS indexes, query results |
| Extractor registry | Dispatch parser/LSP/tree-sitter adapters by language | files, language config, parser backends | nodes, edges, unresolved references, diagnostics hints |
| Reference resolver | Resolve extracted references into graph edges | unresolved refs, imports, symbols, framework rules | resolved edges with provenance and confidence |
| Context engine | Build agent-ready context for tasks | query, symbols, files, graph store, docs, tests | entry points, related symbols, source sections, validation plan |
| Knowledge layer | Produce orientation and audit views | graph communities, edge provenance, docs, source metadata | repo report, god nodes, communities, surprising links, gaps |
| Attention layer | Surface scoped signals that should change the agent's next action | diagnostics, graph changes, edit previews, validation gaps, stale state | blockers, warnings, nudges, next actions |
| Edit manager | Preview, apply, drift-check, and roll back edits | workspace edits, file identities | preview tokens, applied edits, rollback records |
| Validation engine | Run or plan diagnostics, formatting, lint, and tests | touched files, graph impact, project commands | executed results, evidence tiers, next actions |
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
- `docs`: markdown/doc paths, headings, links, path mentions, source identity
- `tests`: test files, test cases, nearest-code links, command hints
- `attention_items`: severity, kind, source, scope, evidence, next action,
  lifecycle state
- `usage_events`: tool/resource usage, fallback reasons, validation gaps

Indexes should support exact lookup, lower-name lookup, qualified-name lookup,
file/range lookup, incoming/outgoing edge traversal, and FTS over names,
qualified names, signatures, docstrings, docs headings, and selected text.

SQLite is an acceleration and evidence store, not canonical truth. Source files,
parser/LSP responses, repo docs, and executed tests remain authoritative.

## Language Capability Model

Every language adapter must report capability level:

- `semantic`: symbols, references, diagnostics, test routing, freshness, and
  fallback behavior are backed by parser/LSP/tool evidence.
- `partial_semantic`: conservative declarations or config extraction exist, but
  references or flow claims need direct verification.
- `resource_backed`: files and project signals are available for routing only.
- `unsupported`: files may exist, but no meaningful adapter is configured.

Initial recommended language scope:

- Markdown/config: shared routing and project-context substrate from day one.
- Python: first semantic target, using the existing PoC learnings.
- TypeScript/JavaScript: first cross-language semantic target, borrowing from
  `codegraph`.
- C#: early priority with Roslyn/LSP-backed semantics after the initial slice.
- CloudFormation/SAM: early infra-semantic adapter for resource and handler
  relationships.
- Go: next language after Python, TypeScript/JavaScript, C#, and SAM are stable.
- C/C++: later priority because strong semantics require compile metadata and
  clangd/libclang readiness.
- Rust: add after C/C++ as repo-language support using Cargo and
  `rust-analyzer`; keep distinct from any future Rust implementation core.
- Extended backlog, in order: SQL, Bash/Shell, Terraform/HCL,
  Dockerfile/Compose, GitHub Actions/CI YAML, Kubernetes/Helm, Vue/Svelte,
  PowerShell, Ruby/PHP, Swift/Kotlin/Dart, Java last.

Initial capability targets:

| Area | Initial level | Backend direction |
| --- | --- | --- |
| Markdown/config | `resource_backed` / `routing_evidence` | deterministic parsers, path/link extraction, project config discovery |
| Python | `semantic` | Python AST or tree-sitter, Pyright/LSP, Ruff, pytest |
| TypeScript/JavaScript | `semantic` | tree-sitter plus TypeScript compiler API or `tsserver`, `package.json`, `tsconfig` |
| C# | `partial_semantic`, then `semantic` | Roslyn or C# LSP, `.sln`/`.csproj`, NuGet and test project discovery |
| CloudFormation/SAM | `infra_semantic` with caveats | YAML/JSON parser plus intrinsic resolver and source handler linking |
| Go | `partial_semantic`, then `semantic` | Go parser, `gopls`, `go list`, `go test` |
| C/C++ | `resource_backed`, then `partial_semantic` | tree-sitter, clangd/libclang when `compile_commands.json` exists |
| Rust | `partial_semantic`, then `semantic` | tree-sitter or Rust parser, Cargo metadata, `rust-analyzer`, `cargo test` |
| SQL | `resource_backed`, then `partial_semantic` | dialect-aware parser, migration-tool integration, schema/table/column references |
| Bash/Shell | `partial_semantic` | shell parser, ShellCheck, sourced-file and command/function references |
| Terraform/HCL | `partial_semantic` | HCL parser, provider/module/resource/variable/output graph |
| Docker/Compose | `resource_backed` / `routing_evidence` | Dockerfile and Compose parsers, service/env/port/volume graph |
| CI YAML | `resource_backed` / `routing_evidence` | GitHub Actions and workflow parsers, jobs, steps, validation commands |
| Kubernetes/Helm | `resource_backed`, then `partial_semantic` | Kubernetes YAML and Helm chart parsing, resource/service/config relationships |
| Vue/Svelte | `partial_semantic`, then `semantic` | framework language services, SFC parsing, route/component/template links |
| PowerShell | `partial_semantic` | PowerShell parser, script/function/module references |
| Ruby/PHP | `resource_backed`, then `partial_semantic` | parser/LSP where project demand exists |
| Swift/Kotlin/Dart | `resource_backed`, then `partial_semantic` | mobile/client parser or LSP adapters when relevant repos appear |
| Java | `resource_backed`, then `partial_semantic` | Maven/Gradle and Java LSP support, deferred until last |

Backend promotion gates:

- exact-symbol correctness
- duplicate-name ambiguity behavior
- reference and impact correctness
- diagnostics and nearest-test routing
- cache freshness after add, modify, delete, rename, and config changes
- cold/warm latency on representative repositories
- degraded behavior when parser/LSP/tooling is missing or slow

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

The first cross-cutting slice should include Markdown/config, Python,
TypeScript/JavaScript, a thin C# project/symbol slice, and a CloudFormation/SAM
resource slice. That proves the core contracts are truly language-neutral and
also covers the repository types that matter most.

After the slice works, deepen support one area at a time:

1. Python: imports, references, diagnostics, pytest targeting, safe rename,
   change signature, and import cleanup.
2. TypeScript/JavaScript: `tsconfig` path aliases, JSX/TSX, package metadata,
   Jest/Vitest/Playwright discovery, safe rename, and import maintenance.
3. CloudFormation/SAM: handler/resource linking, API routes, events, env vars,
   IAM relationships, and affected-handler/test mapping.
4. C#: Roslyn/LSP semantic resolution, solution/project graph, NuGet context,
   partial classes, extension methods, xUnit/NUnit/MSTest targeting.
5. Go: `gopls`, package graph, build tags, references, callers/callees, and
   `go test` targeting.
6. C/C++: clangd/libclang integration, include graph, compile-unit readiness,
   callers/callees, and test routing where project metadata supports it.
7. Rust: Cargo metadata, module graph, `rust-analyzer` references, macro caveats,
   callers/callees, and `cargo test` targeting.
8. Extended backlog in priority order: SQL; Bash/Shell; Terraform/HCL;
   Dockerfile/Compose; GitHub Actions/CI YAML; Kubernetes/Helm; Vue/Svelte;
   PowerShell; Ruby/PHP; Swift/Kotlin/Dart; Java last.

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

First-read resources:

- `repo:///overview`
- `repo:///status`
- `repo:///scope`
- `repo:///mcp-surface`
- `repo:///graph/report`
- `repo:///graph/communities`
- `repo:///docs/overview`
- `repo:///validation-surface`
- `repo:///attention/current`
- `repo:///usage/gaps`

Primary workflow tools:

- `repo_preflight`
- `context_for_task`
- `symbol_search`
- `symbol_context`
- `find_references`
- `callers`
- `callees`
- `impact`
- `diagnostics_for_files`
- `post_edit_feedback`
- `verification_plan`
- `run_nearest_tests`

Graph exploration tools:

- `graph_query`
- `shortest_path`
- `neighbors`
- `community`
- `god_nodes`
- `surprising_connections`
- `graph_stats`

Edit tools:

- `preview_workspace_edit`
- `apply_workspace_edit`
- `check_concurrent_modifications`
- `rollback_workspace_edit`

Attention tools:

- `attention_current`
- `attention_acknowledge`
- `attention_for_files`

Heavy exploration tools should have project-size-aware budgets. Lightweight
tools should return locations and metadata by default, with source sections only
when requested or when the task context engine decides they are high value.

## Agent Workflow

Normal coding work should follow this loop:

1. `repo_preflight`
2. `context_for_task`
3. direct source read only for selected edit targets or when context reports
   low confidence
4. preview/apply edits
5. `post_edit_feedback`
6. `verification_plan`
7. `run_nearest_tests`

Exploration work should follow this loop:

1. read `repo:///overview`
2. read `repo:///graph/report`
3. use `symbol_search`, `graph_query`, `shortest_path`, or `community` for
   bounded follow-up
4. read exact files only when the graph says source verification is needed

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

Attention item shape:

```json
{
  "severity": "blocker|warning|nudge|context",
  "kind": "syntax_error|rename_risk|verification_gap|scope_change",
  "scope": {
    "files": ["src/auth/session.ts"],
    "symbols": ["UserSession"],
    "ranges": [{"file": "src/auth/session.ts", "line": 84}]
  },
  "message": "Edited file no longer parses.",
  "why_this_matters": "Later symbol and test results are unreliable until syntax is fixed.",
  "evidence": {
    "source": "parser",
    "freshness": "fresh",
    "trust_level": "semantic"
  },
  "next_action": {
    "tool": "diagnostics_for_files",
    "args": {"files": ["src/auth/session.ts"]}
  }
}
```

Recommended attention severities:

- `blocker`: continuing would be unsafe or misleading, such as syntax failure,
  stale edit preview, or unresolved required target.
- `warning`: continuing is possible, but the result needs caveats or validation,
  such as heuristic references or unresolved dynamic usage.
- `nudge`: low-cost repair or cleanup, such as import cleanup or formatting.
- `context`: a relevant planning fact, such as generated-source ownership or
  public API surface.

Recommended attention kinds:

- `ambiguity`: multiple plausible files, symbols, commands, or test targets.
- `blocker`: syntax errors, parse failures, stale previews, or missing required
  tooling.
- `risk_flag`: dynamic references, framework bindings, generated source,
  exported/public API changes, or non-semantic language coverage.
- `scope_change`: touched files or affected files expanded beyond the planned
  validation slice.
- `staleness`: index, diagnostics, test discovery, or preview state is stale.
- `verification_gap`: diagnostics, tests, or dependency checks have not proven
  the current change.
- `rollback_available`: a mutation can be reverted with a known token.

High-value injection points:

- `context_for_task`: surface planning ambiguity, generated/vendor boundaries,
  missing language support, known risky files, likely tests, and required direct
  reads.
- `preview_workspace_edit`: surface missed rename surfaces, dynamic references,
  public API changes, stale targets, or broad replacement fallbacks.
- `apply_workspace_edit`: surface drift, unexpected touched files, parse errors,
  and rollback tokens.
- `post_edit_feedback`: surface syntax errors, diagnostics, import cleanup,
  formatting changes, test gaps, and recommended repair order.
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
- Previewable simple edits and refactors: rename, import maintenance, change
  signature, and safe delete are valuable only with preview, drift checks, and
  rollback.

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
5. Import maintenance and simple semantic edits with preview/apply/rollback.
6. TODO, docs, project config, dependency context.
7. Safe rename and change signature for mature language backends.
8. Dead code, security, and framework-specific inspections.
9. Coverage and advanced refactors.

## Trust And Provenance

Every result should label:

- `analysis_validity`: valid, partial, invalid, or invalid_due_to_environment
- `freshness`: fresh, stale, cold, refreshing, or unknown
- `scope`: analyzed repo, indexed roots, language coverage, skipped roots
- `trust_level`: semantic, partial_semantic, resource_only, routing_evidence,
  unsupported
- `verification_status`: done, planned, needed, blocked
- `evidence_sources`: parser, LSP, SQLite, FTS, docs, tests, direct read,
  inferred topology, text fallback

Every graph edge should carry:

- `confidence`: `EXTRACTED`, `INFERRED`, or `AMBIGUOUS`
- `provenance`: parser, LSP, import resolver, framework resolver, docs link,
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

- `codegraph` already proves much of the desired shape in TypeScript: tree-sitter
  extraction, SQLite, FTS, MCP tools, watcher/sync, graph traversal, and context
  building.
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
  - Python parser/LSP/tooling integration
  - C# Roslyn/LSP integration
  - CloudFormation/SAM infra adapter
  - future Go, C/C++, Rust, SQL, shell, infra, frontend, and other adapters

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
- SQLite graph store with FTS
- Markdown/config, Python, TypeScript/JavaScript, C#, and CloudFormation/SAM
  thin vertical slices
- unresolved-reference storage and basic resolver
- file watcher with debounced incremental sync
- symbol search, node details, callers, callees, impact, shortest path
- task context builder with source section packing
- graph report with god nodes, communities, gaps, and ambiguous edges
- attention layer with blockers, warnings, nudges, and verification gaps
- MCP resources and tools for the primary workflow
- preview/apply/rollback edit contracts
- conservative import maintenance and formatting hooks
- Python and TypeScript diagnostics/test-routing hooks where project config
  supports them
- C# project detection and partial symbol/reference support
- SAM resource, route, handler, environment, and IAM relationship extraction

## Open Questions

- Should tree-sitter be the primary semantic substrate, with LSP as enrichment,
  or should LSP be primary for languages where it is reliable?
- Should graph reports be committed to repos, generated on demand, or both?
- What is the minimum supported MCP/client surface for Codex, Claude Code, Kiro,
  and other agents?
- How much of docs/media corpus support belongs in the core product versus an
  optional knowledge extension?
- Should the graph store support vector search in the MVP, or should FTS plus
  graph traversal come first?
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
- Spec: [Agent IDE runtime MVP](../specs/001-agent-ide-runtime/spec.md)
- Existing PoC: `/home/bcherrington/Projects/Auriora/agent-ide`
- Graph product/reference workflow: `/home/bcherrington/Projects/Webstorm/graphify`
- Cross-language code graph reference: `/home/bcherrington/Projects/Webstorm/codegraph`
