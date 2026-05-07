---
title: MCP surface design
doc_type: design
status: draft
owner: platform
last_reviewed: 2026-05-07
---

# MCP Surface Design

## Purpose

Define the agent-facing MCP resources and tools for the Agent IDE runtime.

## Scope

This design covers first-read resources, workflow tools, graph exploration
tools, edit tools, attention tools, response metadata, and tool budget behavior.

## Design Summary

The MCP surface separates cheap state reads from computation. Agents should be
able to begin with compact resources, use targeted workflow tools for routine
coding, and invoke broad graph analysis only when intentionally exploring.

Responses must label trust, freshness, scope, verification, and evidence so
agents know when direct source verification or additional validation is needed.

## First-Read Resources

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

## Primary Workflow Tools

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

## Graph Exploration Tools

- `graph_query`
- `shortest_path`
- `neighbors`
- `community`
- `god_nodes`
- `surprising_connections`
- `graph_stats`

## Edit Tools

- `preview_workspace_edit`
- `apply_workspace_edit`
- `check_concurrent_modifications`
- `rollback_workspace_edit`

## Attention Tools

- `attention_current`
- `attention_acknowledge`
- `attention_for_files`

## Response Metadata

Every result should label:

- `analysis_validity`: valid, partial, invalid, or invalid_due_to_environment
- `freshness`: fresh, stale, cold, refreshing, or unknown
- `scope`: analyzed repo, indexed roots, language coverage, skipped roots
- `trust_level`: semantic, partial_semantic, resource_only, routing_evidence,
  unsupported
- `verification_status`: done, planned, needed, blocked
- `evidence_sources`: parser, LSP, SQLite, FTS, docs, tests, direct read,
  inferred topology, text fallback

## Data And Control Flow

```text
agent request
-> MCP schema validation
-> runtime state and graph freshness check
-> targeted graph/context/validation operation
-> attention and trust metadata merge
-> compact response with optional source sections
```

## Tool Budget Rules

- Lightweight tools return locations and metadata by default.
- Source sections appear only when requested or when the context engine ranks
  them as high value.
- Heavy exploration tools have project-size-aware budgets.
- Hot-path tools must use targeted SQLite queries.
- Broad topology/community reports are explicit orientation calls.

## Related Docs

- [System architecture](../architecture/system-architecture.md)
- [Runtime requirements](../requirements/runtime-requirements.md)
- [Attention layer design](attention-layer-design.md)
- [Edit and validation loop design](edit-and-validation-loop-design.md)
