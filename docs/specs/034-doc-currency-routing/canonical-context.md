---
title: Doc currency routing canonical context
doc_type: spec
artifact_type: canonical-context
status: active
owner: platform
last_reviewed: 2026-07-02
---

# Canonical Context

## Always-Canonical Sources

- Root `AGENTS.md` and higher-priority agent instructions.
- [Documentation map](../../reference/documentation-map.md) for durable
  documentation ownership.
- [MCP surface design](../../design/mcp-surface-design.md) for public docs
  routing behavior.
- [Graph store design](../../design/graph-store-design.md) for indexed file and
  docs search storage.
- [Runtime contracts](../../reference/runtime-contracts.md) for trust,
  freshness, evidence, and response vocabulary.
- [Lifecycle bridge contract](../../reference/lifecycle-bridge-contract.md) for
  the boundary between Agent Workbench routing evidence and lifecycle systems.
- Source contracts and implementation under `src/contracts/`,
  `src/domain/policies/document-authority.ts`,
  `src/application/use-cases/query-docs.ts`,
  `src/application/use-cases/get-task-context.ts`, and
  `src/infrastructure/sqlite/graph-store.ts`.

## Spec-Canonical Working Sources

- `requirements.md`
- `design.md`
- `tasks.md`
- `traceability.md`
- this file

## Imported Background Sources

- EB018 in
  [Agent Workbench executable backlog](../../requirements/agent-workbench-executable-backlog.md)
  is the intake source for this spec.
- The current code already classifies document authority using path, title,
  status frontmatter, and selected content. This spec refines that behavior; it
  does not replace existing direct-read caveats.
- User feedback on 2026-07-02 clarified that richer frontmatter is an input to
  reference and lifecycle systems, not itself a durable documentation reference.
  Spec-lifecycle-manager should own lifecycle-rule changes for users of that
  plugin.

## Non-Canonical Background

- Historical evaluation notes, closure logs, archived specs, and old design
  records are useful evidence of past behavior, but they are not implementation
  authority unless this spec or a durable canonical owner explicitly imports
  them.
- Filesystem creation time and `ctime` are not valid authority or recency
  signals for this spec. Linux `ctime` is inode metadata change time, not
  creation time. Optional birth time evidence is out of scope unless a future
  fixture proves reliable cross-platform semantics.

## Promotion Routes

- Accepted public surface behavior promotes to
  [MCP surface design](../../design/mcp-surface-design.md).
- Accepted storage and metadata behavior promotes to
  [Graph store design](../../design/graph-store-design.md).
- Accepted trust vocabulary promotes to
  [Runtime contracts](../../reference/runtime-contracts.md) if new contract
  fields or enum values are added.
- Accepted lifecycle-rule feedback for active specs, promotion, closure, and
  stale durable-doc warnings promotes to the spec-lifecycle-manager plugin or
  its durable docs, not to Agent Workbench runtime policy.
