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

This design covers MVP resources/tools, post-MVP resources/tools, tool
capability classes, and tool budget behavior. Shared response envelopes and enum
definitions are owned by [Runtime contracts](../reference/runtime-contracts.md).

## Design Summary

The MCP surface separates cheap state reads from computation. Agents should be
able to begin with compact resources, use targeted workflow tools for routine
coding, and invoke broad graph analysis only when intentionally exploring.

Responses must label trust, freshness, scope, verification, and evidence so
agents know when direct source verification or additional validation is needed.

MCP is an interface adapter, not the presentation layer and not an application
service. Each MCP handler validates transport input, calls one application use
case, and delegates output construction to presenters.

Tools, resources, and prompts are declared through registries. A registry
definition owns the input schema, shared argument parser, use-case binding,
presenter binding, budget policy, and capability policy.

Shared argument parsers must handle repo paths, file paths, line/column pairs,
booleans, enums, limits, payload modes, and usage context. Invalid input returns
structured contract errors before any use case runs.

MCP is also the primary cross-agent integration contract. Agent-specific
plugins, skills, hooks, commands, steering files, rules, guidelines, extensions,
and ACP packaging should be generated around MCP definitions, not implemented as
parallel tool surfaces. The canonical integration guidance lives in
[Coding agent integration design](coding-agent-integration-design.md).

## Presentation Boundary

Presenters own response consistency across every MCP resource and tool:

- shared response envelope construction
- metadata composition for freshness, capability, evidence, verification,
  budgets, and truncation
- warning, blocker, and error formatting
- source section packing and stable ordering
- retryable `next_action` mapping

Use cases must return application result objects, not MCP envelopes. MCP
handlers must not query SQLite, parse source, or assemble warnings/errors
directly.

## MVP Resources

- `repo:///overview`
- `repo:///status`
- `repo:///scope`

These resources must be cheap, bounded, and backed by current snapshot metadata.
They must not trigger broad graph analysis.
`repo:///status` must expose cold, refreshing, fresh, stale, and degraded
warm-up state, including queued work counts and indexing blockers where
available.

## MVP Tools

- `context_for_task`
- `symbol_search`
- `find_references`
- `impact` with explicit traversal and result caps
- `verification_plan`
- `preview_workspace_edit`
- `apply_workspace_edit`

Drift checking is part of `apply_workspace_edit`; it is not a separate MVP
tool.

## Post-MVP Resources And Tools

- `repo:///mcp-surface`
- `repo:///graph/summary`
- `repo:///graph/report`
- `repo:///graph/communities`
- `repo:///docs/overview`
- `repo:///validation-surface`
- `repo:///agent-integration-profile`
- `repo:///attention/current`
- `repo:///usage/gaps`
- `symbol_context`
- `callers`
- `callees`
- `check_markdown_document`
- `check_markdown_set`
- `plan_markdown_format`
- `preview_markdown_format`
- `apply_markdown_format`
- `diagnostics_for_files`
- `post_edit_feedback`
- `run_nearest_tests`

Post-MVP graph exploration tools:

- `graph_query`
- `shortest_path`
- `neighbors`
- `community`
- `god_nodes`
- `surprising_connections`
- `graph_stats`

Post-MVP edit and attention tools:

- `rollback_workspace_edit`
- `attention_current`
- `attention_acknowledge`
- `attention_for_files`

## Tool Capability Classes

Tool capability classes are defined in
[Runtime contracts](../reference/runtime-contracts.md). MVP includes
`read_only`, `planning`, and `workspace_write`. `process_execute` and
`generated_write` are post-MVP unless explicitly approved by the workspace
safety contract.

## Response Metadata

Every result must use the shared response envelope from
[Runtime contracts](../reference/runtime-contracts.md).

## Data And Control Flow

```text
agent request
-> MCP schema validation
-> runtime state and graph freshness check
-> targeted graph/context/validation operation
-> presentation layer metadata and warning/error composition
-> compact response envelope with optional source sections
```

## Tool Budget Rules

- Lightweight tools return locations and metadata by default.
- Source sections appear only when requested or when the context engine ranks
  them as high value.
- Heavy exploration tools have project-size-aware budgets.
- Hot-path tools must use targeted SQLite queries.
- Broad topology/community reports are explicit orientation calls.
- MVP `verification_plan` does not execute commands by default.
- MVP tools must publish row limits, traversal limits, source-byte caps, and
  timeout behavior through response metadata.

## Related Docs

- [System architecture](../architecture/system-architecture.md)
- [Runtime requirements](../requirements/runtime-requirements.md)
- [Runtime contracts](../reference/runtime-contracts.md)
- [Coding agent integration design](coding-agent-integration-design.md)
- [Markdown document quality design](markdown-document-quality-design.md)
- [Workspace safety contract](../reference/workspace-safety-contract.md)
- [Attention layer design](attention-layer-design.md)
- [Edit and validation loop design](edit-and-validation-loop-design.md)
