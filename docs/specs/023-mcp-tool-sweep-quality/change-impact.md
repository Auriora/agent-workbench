---
title: MCP tool sweep quality change impact
doc_type: spec
artifact_type: change-impact
status: active
owner: platform
last_reviewed: 2026-06-06
---

# Change Impact

## Durable Source Mapping

- [MCP surface design](../../design/mcp-surface-design.md)
- [Observability and debugging design](../../design/observability-debugging-design.md)
- [Runtime contracts](../../reference/runtime-contracts.md)
- [Agent Workbench executable backlog](../../requirements/agent-workbench-executable-backlog.md)
- [Documentation map](../../reference/documentation-map.md)

## Proposed Changes

| Change | Type | Durable Target | Notes |
| --- | --- | --- | --- |
| Add `debug:mcp-tool-sweep` harness | add | Observability and debugging design | Debug-only command, not public MCP surface; owning-checkout only and stripped from installed/containerized packages. |
| Define sweep quality labels | add | Observability and debugging design, runtime contracts if contract-facing | Harness labels are local unless MCP metadata semantics change. |
| Clarify cold docs FTS output | clarify/bug fix | MCP surface design, runtime contracts | Current design says blocked cold output is intentional; implementation must make it actionable. |
| Clarify unsupported/no-coverage status | bug fix | MCP surface design, runtime contracts | Avoid unexplained invalid metadata. |
| Clarify missing/no-heading/headed docs behavior | bug fix | MCP surface design | Stable docs tool semantics. |
| Improve graph-backed degraded reasons | clarify | Runtime contracts, MCP surface design | Distinguish cold graph, unsupported language, no match, and positive graph evidence. |
| Improve verification-plan blocked reasons | clarify/bug fix | MCP surface design, edit and validation loop design if needed | Must remain non-executing. |
| Compact skipped-path warnings | modify | MCP surface design | Preserve actionable requested-path warnings. |

## Promotion Targets

Before closing this spec:

- Update durable docs for any changed MCP metadata semantics.
- Document the tool sweep command, checkout-only packaging boundary, and
  no-build/no-test/no-write original target-repo boundary.
- Add or update documentation map entries for new durable docs.
- Record final validation evidence in `verification.md`.

## Out Of Scope

- Live protocol diagnostics.
- Target repository command execution.
- Broad direct-scan fallback for cold graph or docs FTS evidence.
- New parser or language semantic fallback routes.
