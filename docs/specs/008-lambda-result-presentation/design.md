---
title: Lambda result presentation design
doc_type: spec
artifact_type: design
status: archived
owner: platform
last_reviewed: 2026-06-06
---

# Technical Design

Spec 008 closed on 2026-06-06. Current Lambda-heavy result presentation
behavior lives in [MCP surface design](../../design/mcp-surface-design.md) and
[Language adapter design](../../design/language-adapter-design.md).

## Overview

Improve Lambda-heavy result presentation using existing resource-backed graph
metadata. The implementation should make handler search results easier to
interpret without adding new semantic extraction.

## High-Level Design

Symbol search and context ranking should prefer handler results with connected
template/logical-ID/file evidence over generic unmatched handler strings. Result
ordering and reasons should mention generic evidence classes such as logical ID,
template, handler binding, and handler file.

## Low-Level Design

Use existing `GraphNode.metadata` fields such as `logical_id`, `handler`,
`handler_file_path`, `handler_export_candidate`, and `provenance`, plus bounded
outgoing/incoming edge reads when a caller is already querying handler nodes.

Avoid schema changes unless tests prove existing `reason`, `signature`, or
qualified-name fields cannot carry compact grouping context.

## Operational Considerations

Do not expand symbol search into broad graph exploration. If grouping requires
more than the current result budget, return compact results and a follow-up
`context_for_task` or `impact` next action.

## Open Questions

- Whether handler grouping belongs in `search-symbols` ranking, presentation
  mapping, or both.
