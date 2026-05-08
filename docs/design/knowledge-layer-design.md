---
title: Knowledge layer design
doc_type: design
status: draft
owner: platform
last_reviewed: 2026-05-07
---

# Knowledge Layer Design

## Purpose

Define the post-MVP graph-derived onboarding, reporting, and audit layer for
broad repository understanding.

## Scope

This design covers post-MVP graph reports, communities, god nodes, surprising
connections, ambiguous edges, knowledge gaps, suggested questions, and generated
report surfaces. These capabilities are not part of the contract MVP.

## Design Summary

The knowledge layer adapts graph-product ideas for coding-agent workflows. It is
for orientation and audit, not for hot-path edit loops. Reports should be
explicitly generated from the current graph and include caveats about coverage,
freshness, and unsupported areas.

The MVP may expose cheap persisted counts through `repo:///overview`; it should
not expose graph reports or communities as first-read resources.

## Report Contents

The graph report should include:

- corpus and repository summary
- language coverage and unsupported areas
- god nodes
- communities and cohesion
- surprising cross-file or cross-language connections
- ambiguous edges that need review
- isolated nodes and thin communities
- suggested questions
- validation and freshness caveats

## Resources And Exports

The report should be available as an explicit post-MVP MCP resource. Exporting
markdown under a tracked docs/wiki directory is deferred until an explicit export
workflow is approved.

Generated exports must be clearly marked as generated and should not be treated
as source truth. Source files and repo config remain canonical; `tree-sitter`
extraction, optional enrichment output, and executed tests are derived evidence
tied to a snapshot.

## Query Surfaces

- `repo:///graph/report`
- `repo:///graph/communities`
- `graph_query`
- `shortest_path`
- `neighbors`
- `community`
- `god_nodes`
- `surprising_connections`
- `graph_stats`

## Caveats

- Broad graph operations must have project-size-aware budgets.
- Reports must be generated explicitly or read from a persisted fresh summary;
  they must not hide broad computation behind compact resource reads.
- Inferred or ambiguous relationships must remain labeled.
- Generated reports should distinguish proof, routing evidence, and useful
  guesses.
- Reports must follow the redaction and generated-write rules in the workspace
  safety contract.

## Related Docs

- [System architecture](../architecture/system-architecture.md)
- [Graph store design](graph-store-design.md)
- [MCP surface design](mcp-surface-design.md)
- [Workspace safety contract](../reference/workspace-safety-contract.md)
