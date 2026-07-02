---
title: Doc currency routing canonical context
doc_type: spec
artifact_type: canonical-context
status: active
owner: platform
last_reviewed: 2026-07-02
---

# Canonical Context

## Purpose

Define the current implementation authority for document currency routing so
agents do not treat older docs, archived specs, or frontmatter alone as
implementation truth.

## Authority Hierarchy

1. System, developer, user, and repository instructions.
2. Durable documentation owners listed in the documentation map.
3. Source contracts, implementation code, and fixture-backed tests.
4. Active spec artifacts for this implementation package.
5. Historical docs, archived specs, and delivery records as background only.

## Always-Canonical External Sources

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

## Always-Canonical Sources

Same as Always-Canonical External Sources above, plus source-code contracts and
fixture-backed tests for runtime behavior.

## Spec-Canonical Working Sources

- `requirements.md`
- `design.md`
- `tasks.md`
- `traceability.md`
- this file

## Imported Sources

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

## Imported Background Sources

Same imported sources as above. They inform this spec but do not override
durable docs, source contracts, or current implementation evidence.

## Non-Canonical Background Sources

- Historical evaluation notes, closure logs, archived specs, and old design
  records are useful evidence of past behavior, but they are not implementation
  authority unless this spec or a durable canonical owner explicitly imports
  them.
- Filesystem creation time and `ctime` are not valid authority or recency
  signals for this spec. Linux `ctime` is inode metadata change time, not
  creation time. Optional birth time evidence is out of scope unless a future
  fixture proves reliable cross-platform semantics.

## Non-Canonical Background

Same as Non-Canonical Background Sources above.

## Promotion Map

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

## Promotion Routes

Same as Promotion Map above.
