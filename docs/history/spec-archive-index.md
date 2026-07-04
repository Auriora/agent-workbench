---
title: Spec archive index
doc_type: history
status: active
owner: platform
last_reviewed: 2026-07-02
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Spec Archive Index

## Purpose

Index removed or retained spec packages so lifecycle tools can route agents to
history instead of active implementation scaffolding.

## Entries

| Spec ID | Title | Package path | Status | Final spec commit | Cleanup commit | Closure action | Durable destinations | Verification |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 022-mcp-server-repository-support | MCP server repository support | docs/specs/022-mcp-server-repository-support | removed | 62db46c | 6ed5758 | removed | docs/design/mcp-surface-design.md; docs/design/coding-agent-integration-design.md; docs/reference/documentation-map.md; docs/requirements/agent-workbench-executable-backlog.md; docs/history/spec-closure-log.md; docs/history/spec-archive-index.md | tests/mcp/repo-scope-overview-resource.test.ts; tests/mcp/context-for-task-tool.test.ts; tests/mcp/verification-plan-tool.test.ts |
| 024-plugin-discoverability-and-drift-hardening | Plugin discoverability and drift hardening | docs/specs/024-plugin-discoverability-and-drift-hardening | removed | 90b70bc | ad9b27f | removed | .agents/plugins/marketplace.json; .well-known/mcp/server-card.json; .github/workflows/ci.yml; scripts/validate-agent-workbench-plugin.mjs; package.json; plugins/agent-workbench/README.md; docs/runbooks/codex-agent-workbench-plugin.md; docs/reference/documentation-map.md; tests/integration/codex-integration-profile.test.ts | scripts/validate-agent-workbench-plugin.mjs; tests/integration/codex-integration-profile.test.ts; .github/workflows/ci.yml; docs/history/spec-closure-log.md |
| 034-doc-currency-routing | Doc currency routing | docs/specs/034-doc-currency-routing | removed | 8657e9e | 7595c5b | removed | .well-known/mcp/server-card.json; docs/design/mcp-surface-design.md; docs/design/graph-store-design.md; docs/reference/runtime-contracts.md; docs/reference/documentation-map.md; docs/reference/spec-lifecycle-manager-doc-currency-handoff.md; src/contracts/runtime-core-contracts.ts; src/contracts/runtime-docs-contracts.ts; tests/docs/query-docs.test.ts; tests/mcp/context-for-task-tool.test.ts; tests/mcp/docs-surfaces.test.ts; docs/history/spec-closure-log.md; docs/history/spec-archive-index.md | tests/docs/query-docs.test.ts; tests/mcp/context-for-task-tool.test.ts; tests/mcp/docs-surfaces.test.ts; tests/mcp/registry-metadata.test.ts; tests/mcp/debug-harness.test.ts; tests/integration/codex-integration-profile.test.ts |

## Legacy Gaps

| Spec ID | Reason |
| --- | --- |
| Specs 001-021, 023, 025 | Older closure records are preserved in `docs/history/spec-closure-log.md`; archive-index backfill is out of scope for Spec 022 cleanup. |
