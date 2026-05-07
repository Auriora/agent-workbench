---
title: Agent IDE runtime MVP plan
doc_type: spec
status: draft
owner: platform
last_reviewed: 2026-05-07
---

# Implementation Plan

## Summary

Build a TypeScript MCP runtime with SQLite graph storage, language adapter
contracts, targeted graph/context tools, attention items, edit contracts, and
validation routing.

## Technical Context

- **Language/Version**: TypeScript on Node.js.
- **Primary Dependencies**: MCP server framework, SQLite, FTS, tree-sitter,
  language services and ecosystem tools per adapter.
- **Storage**: Local SQLite database under generated runtime cache.
- **Testing**: Unit, contract, fixture, integration, and command-routing tests.
- **Target Platform**: Local developer workstations and agent workspaces.
- **Project Type**: Local-first MCP runtime.
- **Performance Goals**: Hot-path tools use targeted indexed queries; broad
  topology work is explicit.
- **Constraints**: Source files remain authoritative; results carry trust and
  freshness metadata.
- **Scale/Scope**: One repository per runtime instance.

## Governance Check

Complete before implementation and re-check after design changes.

- [ ] SOLID boundaries defined for runtime, graph store, adapters, MCP,
  attention, edits, validation, and reports.
- [ ] DRY plan defined for response metadata, graph edge provenance, and adapter
  capability labels.
- [ ] Test strategy maps fixture repos to graph, adapter, MCP, edit, and
  validation behavior.
- [ ] UX consistency impact assessed for agent-facing response shapes and
  attention items.
- [ ] Performance budgets defined for hot-path query latency and explicit broad
  report generation.

## Project Structure

### Documentation

```text
docs/specs/001-agent-ide-runtime/
|-- spec.md
|-- plan.md
|-- research.md
|-- design.md
|-- quickstart.md
`-- tasks.md
```

### Source Code

Replace with concrete implementation paths when source exists.

```text
src/
tests/
docs/
```

**Structure Decision**: Keep runtime, adapters, graph schema, MCP contracts,
attention, edits, validation, and reports in separately testable modules.

## Phases

1. Define schema, adapter output, MCP metadata, and fixture strategy.
2. Implement runtime binding, SQLite schema, scan, watcher, and graph writes.
3. Implement Markdown/config, Python, TypeScript/JavaScript, C#, and
   CloudFormation/SAM thin slices.
4. Implement targeted MCP resources and tools.
5. Implement edit preview/apply/rollback and validation planning.
6. Implement graph report, attention, and usage-gap evidence.
7. Validate performance, freshness, degraded modes, and docs.

## Dependencies

- MCP server framework.
- SQLite library with FTS support.
- Tree-sitter and language-specific parsers/services.
- Representative fixture repositories.

## Risks

- Parser/LSP reliability varies by language; mitigate with capability levels and
  degraded-mode tests.
- Hidden broad scans can creep into compact tools; mitigate with query budgets.
- Edit contracts can become unsafe without drift checks; mitigate with preview
  tokens and rollback tests.
- Graph confidence can be overclaimed; mitigate with ADR-0004 gates.

## Validation Strategy

Use fixture repositories to test schema migration, extraction, reference
resolution, MCP schemas, hot-path query budgets, edit contracts, attention
items, and validation planning.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| None yet |  |  |
