---
title: Agent IDE runtime MVP plan
doc_type: spec
status: draft
owner: platform
last_reviewed: 2026-05-07
---

# Implementation Plan

## Summary

Build a narrow TypeScript MCP runtime slice: repo binding, minimal SQLite graph
store, Markdown/config routing, one partial-semantic language adapter, a small
MCP contract, bounded preview/apply edits, and validation planning.

## Technical Context

- **Language/Version**: TypeScript on Node.js.
- **Primary Dependencies**: MCP server framework, SQLite with FTS, parser/LSP
  tooling for one initial language path.
- **Storage**: Local SQLite database under generated runtime cache.
- **Testing**: Contract, fixture, schema migration, degraded-mode, workspace
  safety, and query-budget tests.
- **Target Platform**: Local developer workstations and agent workspaces.
- **Project Type**: Local-first MCP runtime.
- **Performance Goals**: Hot-path tools use targeted indexed queries with
  explicit row, traversal, source-byte, and timeout budgets.
- **Constraints**: Source files and repo config remain canonical; commands are
  plan-only by default; workspace safety is enforced.
- **Scale/Scope**: One repository per runtime instance.

## Governance Check

Complete before implementation and re-check after design changes.

- [ ] SOLID boundaries defined for runtime binding, graph store, adapter
  extraction, MCP adapter, workflow service, edit manager, and command planner.
- [ ] DRY plan defined through [Runtime contracts](../../reference/runtime-contracts.md).
- [ ] Test strategy maps fixtures to graph rows, MCP responses, edits, safety,
  degraded modes, and budgets.
- [ ] Agent workflow consistency assessed against the MVP proof matrix.
- [ ] Performance budgets defined for every MVP hot-path surface.

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

**Structure Decision**: Keep MCP as a thin adapter over application use cases.
Keep context, blockers/warnings, and validation planning in one workflow service
until real seams emerge.

## Phases

1. Define runtime contracts, workspace safety, graph schema invariants, and MVP
   proof fixtures.
2. Implement repo binding, scope detection, SQLite schema, FTS, scan, and
   freshness state.
3. Implement Markdown/config routing and one partial-semantic language adapter.
4. Implement MVP MCP resources and tools.
5. Implement bounded preview/apply with drift checks and validation planning.
6. Validate query budgets, degraded modes, safety negatives, and golden
   responses.

## Dependencies

- MCP server framework.
- SQLite library with FTS support.
- Parser/LSP/tooling for the selected first language.
- Fixture repositories defined in [MVP proof matrix](../../reference/mvp-proof-matrix.md).

## Risks

- Parser/LSP reliability varies; mitigate with capability levels and
  degraded-mode tests.
- Hidden broad scans can creep into compact tools; mitigate with query budgets
  and trace assertions.
- Edit contracts can become unsafe; mitigate with preview tokens, path
  containment, base hashes, and stale-apply tests.
- Command execution can become unsafe; keep MVP validation plan-only.
- Contract drift can break clients; mitigate with one response envelope and
  canonical enum registry.

## Validation Strategy

Use the [MVP proof matrix](../../reference/mvp-proof-matrix.md) as the minimum
acceptance gate. Every MVP resource/tool needs golden responses, budget tests,
degraded-mode behavior, and safety negatives where applicable.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| None yet |  |  |
