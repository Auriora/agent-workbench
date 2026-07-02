---
title: Doc currency routing change impact
doc_type: spec
artifact_type: change-impact
status: active
owner: platform
last_reviewed: 2026-07-02
---

# Change Impact

## Durable Source Mapping

| Durable source | Change class | Impact |
| --- | --- | --- |
| [MCP surface design](../../design/mcp-surface-design.md) | modify | Document accepted docs currency routing behavior for `context_for_task`, docs search, docs overview/map, direct-read caveats, and agent-facing currency verification. |
| [Graph store design](../../design/graph-store-design.md) | modify | Document any accepted storage/indexing behavior for document currency fields, optional Git recency evidence, and no-`ctime` policy if runtime storage changes. |
| [Runtime contracts](../../reference/runtime-contracts.md) | modify if contracts change | Add public currency fields, enum values, evidence semantics, or caveat vocabulary only if implementation exposes them in contracts. |
| [Documentation map](../../reference/documentation-map.md) | modify | Keep Spec 034 and eventual durable currency-routing owners discoverable. |
| spec-lifecycle-manager plugin docs or handoff artifact | external handoff | Route lifecycle-rule changes for active specs, closure, promotion, canonical context, and stale durable-doc warnings outside Agent Workbench runtime policy. |

## Proposed Changes

### Additions

- Add task-focused document currency labels and caveats to implementation
  routing surfaces.
- Add frontmatter input parsing for `status`, `doc_type`, `last_reviewed`,
  `authority`, `canonical_owner`, `superseded_by`, `review_after`, and
  `applies_to`.
- Add documentation-map owner lookup as a first-class currency signal.
- Add optional local Git first/last touch recency evidence for bounded final
  candidates.
- Add an agent-facing verifier workflow, either as a packaged skill/prompt
  first or as an MCP tool.

### Clarifications

- Frontmatter is input evidence, not standalone authority.
- `mtime_ms` is modified-time evidence only.
- Filesystem `ctime` is not a creation-time, lifecycle, or document-currency
  signal.
- Missing Git evidence is non-blocking optional enrichment.
- Agent Workbench consumes lifecycle labels as routing evidence but does not own
  spec lifecycle truth.

### Removals

- Remove any future implementation temptation to infer creation or currency
  from filesystem `ctime`.

## Promotion Targets

- Promote accepted public runtime behavior to
  [MCP surface design](../../design/mcp-surface-design.md).
- Promote accepted storage/index behavior to
  [Graph store design](../../design/graph-store-design.md).
- Promote accepted public contract changes to
  [Runtime contracts](../../reference/runtime-contracts.md).
- Promote lifecycle-rule feedback to spec-lifecycle-manager documentation or a
  plugin-local follow-up artifact.
