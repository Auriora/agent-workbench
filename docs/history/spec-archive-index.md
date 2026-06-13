---
title: Spec archive index
doc_type: history
status: active
owner: platform
last_reviewed: 2026-06-13
---

# Spec Archive Index

## Purpose

Index removed or retained spec packages so lifecycle tools can route agents to
history instead of active implementation scaffolding.

## Entries

| Spec ID | Title | Package path | Status | Final spec commit | Cleanup commit | Closure action | Durable destinations | Verification |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 022-mcp-server-repository-support | MCP server repository support | docs/specs/022-mcp-server-repository-support | removed | 62db46c | 6ed5758 | removed | docs/design/mcp-surface-design.md; docs/design/coding-agent-integration-design.md; docs/reference/documentation-map.md; docs/requirements/agent-workbench-executable-backlog.md; docs/history/spec-closure-log.md; docs/history/spec-archive-index.md | tests/mcp/repo-scope-overview-resource.test.ts; tests/mcp/context-for-task-tool.test.ts; tests/mcp/verification-plan-tool.test.ts |

## Legacy Gaps

| Spec ID | Reason |
| --- | --- |
| Specs 001-021, 023, 025 | Older closure records are preserved in `docs/history/spec-closure-log.md`; archive-index backfill is out of scope for Spec 022 cleanup. |
