---
title: Runtime requirements
doc_type: requirements
status: draft
owner: platform
last_reviewed: 2026-05-07
---

# Runtime Requirements

## Purpose

Define the current accepted requirements for the Agent IDE restart runtime.

## Scope

These requirements cover the repo-scoped runtime, graph/index storage, adapter
capability reporting, MCP surface, context building, attention, edit management,
validation routing, trust metadata, performance behavior, and MVP scope.

## Audiences

Runtime engineers, language adapter maintainers, plugin authors, and agent
workflow designers.

## Current-State Requirements

| ID | Requirement | Applies To | Source Of Truth | Verification |
| --- | --- | --- | --- | --- |
| REQ-001 | The runtime must bind to one analyzed repository at a time. | Repo runtime | Architecture, ADR-0001 | Runtime startup tests |
| REQ-002 | Source files, repo config, parser/LSP output, and executed tests must remain authoritative over cached graph rows. | Graph store | ADR-0002, graph design | Unit tests for stale/cold states |
| REQ-003 | The graph store must persist files, nodes, edges, unresolved refs, snapshots, docs, tests, attention items, and usage events. | Graph store | Graph design | Schema migration tests |
| REQ-004 | Hot-path lookup tools must use targeted indexed queries instead of hidden whole-repo scans. | MCP tools, graph store | Architecture, performance principles | Query budget tests and traces |
| REQ-005 | Broad topology, community, and report generation must be explicit orientation operations. | Knowledge layer | Architecture, knowledge design | Tool contract review |
| REQ-006 | Each adapter must report a capability level: `semantic`, `partial_semantic`, `resource_backed`, or `unsupported`. | Language adapters | Language adapter design | Adapter contract tests |
| REQ-007 | A language must not be marked `semantic` until references, impact, diagnostics/test routing, freshness, and degraded behavior are trustworthy. | Language adapters | ADR-0004 | Capability promotion checklist |
| REQ-008 | MCP responses must label analysis validity, freshness, scope, trust level, verification status, and evidence sources. | MCP surface | MCP design, trust model | Schema tests |
| REQ-009 | Graph edges must carry confidence, provenance, and source range or explanation where available. | Graph store, resolver | Graph design | Resolver tests |
| REQ-010 | Mutating edits must support preview, apply, concurrent modification checks, and rollback tokens. | Edit manager | Edit and validation design | Edit contract tests |
| REQ-011 | Validation planning must choose diagnostics, formatting, lint, and tests based on touched files and graph impact. | Validation engine | Edit and validation design | Test targeting fixtures |
| REQ-012 | Attention items must interrupt only when they change the safe or efficient next action. | Attention layer | Attention design | Attention ranking tests |
| REQ-013 | Watcher-clean snapshots must be the freshness authority for hot reads. | Repo runtime, graph store | Graph design | Watcher freshness tests |
| REQ-014 | Parser work must run with timeouts, isolation, and recovery behavior. | Extractor registry | Language adapter design | Worker failure tests |
| REQ-015 | Large result caches must live in SQLite or compact row stores, not unbounded JSON files. | Graph store | Performance principles | Storage review |
| REQ-016 | The MVP must include Markdown/config, Python, TypeScript/JavaScript, C#, and CloudFormation/SAM thin vertical slices. | MVP | Spec package | MVP acceptance tests |
| REQ-017 | CloudFormation/SAM support must connect infrastructure resources to handlers, routes, environment variables, permissions, and tests where evidence allows. | Infra adapter | CloudFormation/SAM design | SAM fixture tests |
| REQ-018 | Agent fallback to broad shell search, broad file reads, or ad hoc validation must be captured as usage-gap evidence. | Usage events, knowledge layer | Architecture | Usage event tests |

## Configuration Requirements

| Config Source | Key Or Field | Required Behavior | Validation |
| --- | --- | --- | --- |
| Repo runtime config | analyzed roots and skipped roots | Defines the analysis scope and skipped/generated/vendor boundaries. | Startup and scope tests |
| Adapter registry config | adapter enablement and capability overrides | Controls language and infra adapters without changing core contracts. | Adapter registration tests |
| Validation config | command discovery and command budgets | Controls diagnostics, formatting, lint, and nearest-test execution. | Validation planner tests |
| MCP schema config | resource and tool schema generation | Keeps agent-facing contracts stable and machine-readable. | Schema generation tests |

## Operational Requirements

- Runtime status must expose cold, refreshing, stale, and valid analysis states.
- Index rebuilds must use locks, temporary databases, validation, and atomic
  replacement.
- Missing parser, LSP, or ecosystem tooling must be reported as degraded
  capability with explicit next actions.
- Runtime output must be compact by default and include source sections only
  when requested or clearly high value.

## Non-Requirements

- The first implementation does not need a graphical IDE UI.
- The first implementation does not need cloud-hosted multi-user orchestration.
- The MVP does not need vector search.
- Advanced refactors and coverage reporting are deferred until foundational
  semantic evidence is reliable.

## Evidence

- Code:
- Config:
- Tests:
- Runbooks:
- Technical designs:

## Related Docs

- [System architecture](../architecture/system-architecture.md)
- [Graph store design](../design/graph-store-design.md)
- [MCP surface design](../design/mcp-surface-design.md)
- [Language adapter design](../design/language-adapter-design.md)
- [MVP spec](../specs/001-agent-ide-runtime/spec.md)
