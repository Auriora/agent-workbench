---
title: Runtime requirements
doc_type: requirements
status: draft
owner: platform
last_reviewed: 2026-07-20
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Runtime Requirements

## Purpose

Define the target requirements for the Agent IDE restart runtime. These are
draft target-state requirements until implementation evidence exists.

## Scope

These requirements cover the repo-scoped runtime, graph/index storage, adapter
capability reporting, MCP surface, context building, bounded edit management,
validation planning, trust metadata, performance behavior, workspace safety,
coding-agent integration, Markdown document quality, and MVP scope.
Multi-language, multi-framework, and multi-platform support is a core target
requirement even though the MVP implements only one partial-semantic language
adapter.

## Audiences

Runtime engineers, language adapter maintainers, plugin authors, and agent
workflow designers.

## Current-State Requirements

| ID | Requirement | Applies To | Source Of Truth | Verification |
| --- | --- | --- | --- | --- |
| REQ-001 | The runtime must bind to one analyzed repository at a time. | Repo runtime | Architecture, ADR-0001 | Runtime startup tests |
| REQ-002 | Source files and repo config must remain canonical truth; parser/LSP/tool output and executed tests are derived evidence tied to a snapshot. | Graph store | ADR-0002, graph design | Unit tests for stale/cold states |
| REQ-003 | The MVP graph store must persist files, nodes, edges, unresolved refs, snapshots, and FTS rows. | Graph store | Graph design | Schema migration tests |
| REQ-004 | Hot-path lookup tools must use targeted indexed queries instead of hidden whole-repo scans. | MCP tools, graph store | Architecture, performance principles | Query budget tests and traces |
| REQ-005 | Broad topology, community, and report generation must be explicit orientation operations. | Knowledge layer | Architecture, knowledge design | Tool contract review |
| REQ-006 | Each adapter must report a capability level from the canonical runtime contracts. | Language adapters | Runtime contracts, language adapter design | Adapter contract tests |
| REQ-007 | A language must not be marked `semantic` until references, impact, diagnostics/test routing, freshness, and degraded behavior are trustworthy. | Language adapters | ADR-0004 | Capability promotion checklist |
| REQ-008 | MCP responses must use the shared response envelope for analysis validity, freshness, scope, capability, verification, evidence, budgets, warnings, and errors. | MCP surface | Runtime contracts | Schema tests |
| REQ-009 | Graph edges must carry confidence, provenance, and source range or explanation where available. | Graph store, resolver | Graph design | Resolver tests |
| REQ-010 | MVP mutating edits must support preview, apply, path containment, and drift checks; rollback is post-MVP unless fixture-proven. | Edit manager | Edit and validation design, workspace safety contract | Edit contract tests |
| REQ-011 | Validation planning must identify diagnostics, formatting, lint, and tests without executing commands by default. | Workflow service | Edit and validation design, workspace safety contract | Validation planner fixtures |
| REQ-012 | MVP attention must be limited to blockers and warnings that change the next safe action. | Workflow service | Attention design, runtime contracts | Attention fixture tests |
| REQ-013 | Watcher-clean snapshots must be the freshness authority for hot reads: included file changes, watcher overflow, scope drift, and ignore-rule drift must prevent fresh claims until bounded rescan publishes synchronized evidence. | Repo runtime, graph store | Runtime operations design, graph design | Watcher freshness tests |
| REQ-014 | Parser work must run with timeouts, isolation, and recovery behavior. | Extractor registry | Language adapter design | Worker failure tests |
| REQ-015 | Large result caches must live in SQLite or compact row stores, not unbounded JSON files. | Graph store | Performance principles | Storage review |
| REQ-016 | The MVP must include Markdown/config routing plus one partial-semantic language path; TypeScript/JavaScript, C#, and CloudFormation/SAM are post-MVP unless scoped as resource-backed fixtures. | MVP | Spec package, MVP proof matrix | MVP acceptance tests |
| REQ-016A | Runtime core contracts must be language-, framework-, and platform-neutral. Python-specific evidence must stay inside the Python adapter or namespaced adapter metadata. | Runtime core, adapters | Language adapter design, capability matrix | Contract and boundary tests |
| REQ-016B | Unsupported or resource-backed non-Python languages, frameworks, and platform artifacts must be surfaced explicitly with capability metadata rather than silently ignored. | Repo runtime, adapters, MCP surface | Language adapter design, MVP proof matrix | Mixed-language fixture tests |
| REQ-017 | MVP tool surfaces must fit the contract MVP: status, scope, overview, context, symbol search, references, bounded impact, preview/apply, and validation plan. | MCP surface | Runtime contracts, MCP design | MCP contract tests |
| REQ-018 | Workspace safety must cover path containment, generated/vendor write policy, command planning/execution gates, environment handling, redaction, and generated writes. | Runtime, MCP, edit manager, command runner | Workspace safety contract | Negative safety tests |
| REQ-019 | MCP must be the authoritative executable integration surface for coding agents. Agent-specific plugins, hooks, commands, skills, rules, steering, guidelines, extensions, and ACP packaging must be generated or configured around MCP definitions, not implemented as parallel runtime behavior. | Agent integration | Coding agent integration design, MCP design | Integration contract tests |
| REQ-019A | Agent plugin MCP bindings must launch the installed runtime entrypoint and preserve the target workspace as the analyzed repo root. For Codex, the source plugin config may use `${PLUGIN_ROOT}` only as package input, npm `postinstall` must materialize the installed config to an absolute shim path without setting `cwd`, the session cwd supplies the default repo root, and the install-root pointer or `AGENT_WORKBENCH_INSTALL_ROOT` supplies the runtime root; plugin cache directories are integration artifact caches, not executable runtime roots or default repository roots. | Agent integration, MCP launch | MCP design, coding agent integration design, plugin runbooks | Plugin launch contract tests and MCP smoke tests |
| REQ-020 | The runtime must define common integration specs for instruction packs, skill packs, hook intents, command specs, MCP binding specs, integration manifests, and agent capability metadata before adding vendor-specific emitters. | Agent integration | Coding agent integration design, layered architecture | Architecture boundary tests |
| REQ-021 | Vendor-specific integration emitters must not depend on SQLite, tree-sitter, filesystem watchers, process execution, or application/domain internals. They may depend on runtime contracts, MCP definitions, and common integration specs. | Agent integration | Layered architecture | Dependency boundary tests |
| REQ-022 | Markdown document quality contracts must distinguish parser-backed structure checks, repository compliance linting, and readability formatting. Executable tools are post-MVP unless promoted by fixture-backed scope decision. | Documentation quality | Markdown document quality design | Documentation contract fixture tests |
| REQ-023 | Markdown readability formatting contracts must require rendered meaning preservation, fenced-code protection by default, non-trivial rewrite rationale, and the bounded edit preview/apply safety path before any future mutation support. | Documentation quality, edit manager | Markdown document quality design, edit and validation design | Formatter contract and stale-apply tests |
| REQ-024 | Public MCP tools/resources must have agent-facing names, descriptions, parameter descriptions, expected return structures, capability classes, and budget policies. | MCP surface | MCP design, runtime contracts | Registry metadata tests |
| REQ-025 | Backend parser, diagnostic, validation, test-discovery, worker, and tool outputs must be translated into public MCP schemas instead of passed through raw. | Application, presentation, MCP surface | MCP design, layered architecture | Translation-boundary tests |
| REQ-026 | Agent-facing feedback must be quiet by default: no-finding results, no-op results, and non-blocking optional analyzer failures should be silent or minimal. | Presentation, validation, post-edit feedback | MCP design, edit and validation design | Quiet-feedback fixture tests |
| REQ-027 | Usage-proven docs/config routing, validation planning, test planning, and file-change static feedback must be retained through new schemas without duplicating predecessor tool names or backend surfaces. | Workflow service, MCP surface | Spec package, research, MCP design | Workflow golden tests |
| REQ-028 | OpenTelemetry export must be disabled by default, configurable by environment, and support OTLP HTTP endpoints suitable for Jaeger or collectors. | Runtime operations, telemetry | Observability design, runtime operations design | Telemetry config tests |
| REQ-029 | Repo-local debug harnesses may target arbitrary repos for MCP/use-case testing, but must not be registered as public MCP surfaces or emitted to other projects. | Debug tooling | Observability design, MCP design | Debug harness tests |
| REQ-030 | Profiling and performance monitoring must identify slow MCP paths with low overhead through spans, budgets, counters, and profiler-friendly harnesses. | Runtime operations, MCP tools | Observability design, performance principles | Profiling and budget tests |

## Configuration Requirements

| Config Source | Key Or Field | Required Behavior | Validation |
| --- | --- | --- | --- |
| Repo runtime config | analyzed roots and skipped roots | Defines the analysis scope and skipped/generated/vendor boundaries. | Startup and scope tests |
| Adapter registry config | adapter enablement and capability overrides | Controls language and infra adapters without changing core contracts. | Adapter registration tests |
| Validation config | command discovery and command budgets | Controls diagnostics, formatting, lint, and test planning. Execution requires post-MVP allowlisting. | Validation planner tests |
| MCP schema config | resource and tool schema generation | Keeps agent-facing contracts stable and machine-readable. | Schema generation tests |
| Agent integration config | target agent profiles and artifact output policy | Controls generated instruction, skill, hook, command, plugin, extension, and ACP-aware artifacts without changing runtime behavior. | Integration artifact tests |
| Documentation policy config | frontmatter fields, heading policy, numbering policy, link policy, table readability budget, formatter policy | Controls Markdown structure checks, compliance linting, and readability formatting without hard-coding repo conventions. | Documentation policy tests |

## Operational Requirements

- Runtime status must expose cold, refreshing, stale, and valid analysis states.
- One daemon-scoped controller, watcher/change queue, repository ownership
  lease, activity lease, finite worker deadline, and executor must own refresh
  for each repository. Connection-specific sessions share its narrow request
  and awaited-diagnostics ports; standalone uses the same controller only after
  successful ownership admission.
- Startup, stale first reads, and watcher batches must advance or join one
  monotonic invalidation generation. Planned/running requests reuse one
  execution, and a newer generation causes one sequential catch-up without
  parallel writers or automatic failure retry.
- Entering `planned` must acquire controller activity before admission returns.
  Disconnect cannot cancel it; idle shutdown must recheck both zero clients and
  no active or termination-quarantined work.
- Index rebuilds must use repository ownership, building snapshots, generation
  fences, finite worker execution, and one atomic transition to published.
  Building, superseded, and failed snapshots remain invisible, and prior
  published evidence remains selected through failure or crash recovery.
- Publication, freshness, and evidence coverage are independent. A completed
  bounded scan may be fresh and published with partial coverage; EB014 owns
  large-repository completion, incremental indexing, throughput, and deadline
  tuning beyond current bounds.
- Refresh diagnostics must come from one awaited authority and identify
  controller/diagnostic revisions, worker invocation count, execution and
  invalidation generations, target/visible snapshots, publication/freshness,
  activity/termination state, and bounded structured failure. Invalid evidence
  must lower top-level trust.
- Publication migration must seed the schema-identity-v2 store without
  mutating v1, transactionally classify legacy rows, and retire the v0.5.2
  canonical path only after owner admission and v2 readiness. A durable v1
  rollback artifact plus an atomically published non-SQLite guard must make the
  actual older adapter block. Rollback requires stopped owners plus
  pre-migration restore or the documented derived-store rebuild; in-place
  downgrade is not supported.
- Missing parser, LSP, or ecosystem tooling must be reported as degraded
  capability with explicit next actions.
- Runtime output must be compact by default and include source sections only
  when requested or clearly high value.
- Mixed-language repositories must report per-language and per-platform
  capability coverage even when only one adapter has partial-semantic support.
- Command execution is plan-only by default until the command runner and
  allowlist policy are implemented.
- Generated reports and usage analytics are post-MVP.
- Agent-specific plugin/extension packaging is post-MVP unless a
  fixture-backed integration test requires it.
- Markdown quality executable tools and formatting mutation are post-MVP unless
  promoted by fixture-backed scope decision; any future formatting mutation is
  preview/apply only.

## Non-Requirements

- The first implementation does not need a graphical IDE UI.
- The first implementation does not need cloud-hosted multi-user orchestration.
- The MVP does not need vector search.
- The MVP does not need graph reports, communities, god nodes, or usage-gap
  analytics.
- The MVP does not need C# or CloudFormation/SAM semantic support.
- The MVP does not need semantic support for every language or platform.
- The MVP does not run validation commands by default.
- Advanced refactors and coverage reporting are deferred until foundational
  semantic evidence is reliable.
- The MVP does not need to package plugins/extensions for every supported
  coding agent.
- The MVP does not need prose rewriting or cross-document semantic contradiction
  detection.

## Evidence

- Code:
- Config:
- Tests:
- Runbooks:
- Technical designs:
- Proof matrix: [MVP proof matrix](../reference/mvp-proof-matrix.md)

## Related Docs

- [System architecture](../architecture/system-architecture.md)
- [Graph store design](../design/graph-store-design.md)
- [Runtime contracts](../reference/runtime-contracts.md)
- [Workspace safety contract](../reference/workspace-safety-contract.md)
- [MVP proof matrix](../reference/mvp-proof-matrix.md)
- [MCP surface design](../design/mcp-surface-design.md)
- [Coding agent integration design](../design/coding-agent-integration-design.md)
- [Markdown document quality design](../design/markdown-document-quality-design.md)
- [Language adapter design](../design/language-adapter-design.md)
- [Spec closure log](../history/spec-closure-log.md)
