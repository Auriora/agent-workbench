---
title: Agent IDE runtime MVP research
doc_type: spec
status: draft
owner: platform
last_reviewed: 2026-05-07
---

# Research

## Question

Which ideas from the existing `agent-ide` proof of concept, `codegraph`, and
`graphify` should shape the restart?

## Findings

- `agent-ide` proves the runtime-first model: long-lived repo MCP runtime,
  background indexing, compact resources, edit feedback, validation routing, and
  trust/freshness metadata.
- `agent-ide` also shows a key failure mode: compact output can hide broad work,
  causing latency and pushing agents back to direct file reads.
- `codegraph` provides the strongest deterministic local code-intelligence
  model: tree-sitter extraction, SQLite graph storage, FTS, reference
  resolution, traversal, file watching, and targeted MCP tools.
- `graphify` provides the strongest knowledge-product model: communities, god
  nodes, surprising connections, ambiguous edges, gaps, suggested questions, and
  generated reports.

## Sources

- Existing PoC: `/home/bcherrington/Projects/Auriora/agent-ide`
- Graph product/reference workflow: `/home/bcherrington/Projects/Webstorm/graphify`
- Cross-language code graph reference: `/home/bcherrington/Projects/Webstorm/codegraph`

## Recommendation

Start with a TypeScript local-first runtime that borrows `codegraph`'s graph
core, keeps Agent IDE's edit/validation semantics, and adapts `graphify`'s
knowledge report as an explicit orientation layer.
