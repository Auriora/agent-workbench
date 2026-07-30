---
title: Stdio bridge resource lifecycle change impact
doc_type: spec
artifact_type: change-impact
status: draft
owner: platform
last_reviewed: 2026-07-30
---

# Change Impact

## Durable Source Mapping

| Source | Current behavior relied on | Confidence |
|--------|----------------------------|------------|
| `docs/design/runtime-operations-design.md` | One shared daemon per repository and connection-local isolation | high |
| `docs/design/coding-agent-integration-design.md` | Thin coding-agent launcher integration | high |
| `docs/runbooks/codex-agent-workbench-plugin.md` | Codex launch and diagnosis workflow | high |
| `src/mcp/daemon-client.ts`, `src/mcp/daemon.ts` | Split daemon launch client, daemon server runtime, and launch lifecycle metadata | high |
| `src/mcp/stdio-launch.ts`, `src/mcp/stdio.ts`, `src/mcp/stdio-entrypoint.mjs` | Current bridge wiring, canonical launch wrapper, and lifetime | high |

## Change Type

- **Primary type:** bug_fix
- **Breaking change:** no
- **Durable docs required:** yes
- **External behavior affected:** yes, only process lifetime and resource use

## Proposed Changes

| Change | Type | Current source | Durable destination | Promotion required |
|--------|------|----------------|---------------------|-------------------|
| End bridge lifetime when either transport terminates | bug_fix | `src/mcp/stdio.ts`, `src/mcp/stdio-launch.ts` | `docs/design/runtime-operations-design.md` | yes |
| Separate daemon client startup path from daemon server runtime graph | modify | `src/mcp/daemon.ts` | `docs/design/runtime-operations-design.md` | yes |
| Clarify per-session bridge expectations | clarify | coding-agent launcher design | `docs/design/coding-agent-integration-design.md` | yes |
| Add bridge/orphan diagnosis | add | live investigation | `docs/runbooks/codex-agent-workbench-plugin.md` | yes |

## Bug Fix Details

- **Observed behavior:** disconnected released bridges remain indefinitely, and
  live bridges import daemon-owned native/runtime modules.
- **Expected behavior:** a bridge follows its transports and contains only the
  client-side daemon launch/connection graph.
- **Root cause evidence:** `research.md`.
- **Regression risk:** daemon cold-start arbitration is complex and must remain
  covered by existing concurrency, failure, and entrypoint integration tests.
- **Durable doc update needed:** runtime ownership, integration behavior, and
  operator diagnosis.

## Unchanged Durable Areas

| Durable area | Reviewed source | Reason unchanged |
|--------------|-----------------|------------------|
| MCP request/response contracts | `docs/reference/runtime-contracts.md` | No tool, resource, schema, or response changes. |
| Repository daemon cardinality | `docs/design/runtime-operations-design.md` | One daemon per repository remains the intended model. |
| Parser implementation | repository architecture and AGENTS instructions | Parser work remains daemon-owned and tree-sitter based. |

## Promotion Targets

| Spec content | Durable destination | Promotion status |
|--------------|---------------------|------------------|
| Proxy ownership and dependency boundary | `docs/design/runtime-operations-design.md` | complete |
| Integration lifecycle | `docs/design/coding-agent-integration-design.md` | complete |
| Process diagnosis | `docs/runbooks/codex-agent-workbench-plugin.md` | complete |
| Native bootstrap diagnostics | `docs/design/coding-agent-integration-design.md`, `docs/runbooks/codex-agent-workbench-plugin.md` | complete |
| Released versus candidate package truth | packaging manifests and packaging/runbook guidance | complete |

## Related Artifacts

- Requirements: `requirements.md`
- Design: `design.md`
- Tasks: `tasks.md`
- Verification: `verification.md`
