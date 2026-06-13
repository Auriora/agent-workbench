---
title: MCP server repository support traceability
doc_type: spec
artifact_type: traceability
status: active
owner: platform
last_reviewed: 2026-06-13
---

# Traceability

## Task To Context Matrix

| Task | Requirements | Design | Verification | Durable target | Status |
| --- | --- | --- | --- | --- | --- |
| T001 | Requirements 1-4 require stdio, HTTP/SSE, streamable HTTP, Docker/devcontainer, and ambiguous MCP evidence coverage. | Fixture set in High-Level Design. | Focused MCP overview, context, and verification-plan tests. | `docs/design/mcp-surface-design.md` | Complete. |
| T002 | Requirements 1 and 4 require labeled MCP-server project-shape evidence without execution. | MCP detector, confidence, transport, entrypoint, registry, docs, and config evidence. | Focused MCP overview and verification-plan tests. | `docs/design/mcp-surface-design.md` | Complete. |
| T003 | Requirements 2 and 4 require overview and task-context routing without generated/vendor noise. | Existing platform, key-file, key-doc, reason, and related-file fields carry MCP evidence. | Focused overview and context tests. | `docs/design/mcp-surface-design.md`; `docs/design/coding-agent-integration-design.md` | Complete. |
| T004 | Requirement 3 requires initialize/tools-list/call-tool validation planning without execution. | Repo script planning plus manual MCP smoke review; host-blocked policy remains authoritative. | Focused verification-plan tests. | `docs/design/mcp-surface-design.md`; `docs/design/coding-agent-integration-design.md` | Complete. |
| T005 | Success criteria require durable docs, validation evidence, and closure readiness. | Promotion into durable MCP and coding-agent design docs. | Typecheck, focused tests, lifecycle lint, closure check, and `git diff --check`. | `docs/reference/documentation-map.md`; closure log when closed. | Complete after final validation. |

## Requirement To Delivery Matrix

| Requirement | Delivered by | Verification |
| --- | --- | --- |
| Requirement 1: MCP Server Shape Detection | `mcp-server-shape.ts`, overview routing, task-context routing, and MCP fixtures. | Focused overview/context tests. |
| Requirement 2: MCP Validation Planning | MCP validation planning commands, manual smoke guidance, and host-blocked policy handling. | Focused verification-plan tests. |
| Correctness properties | Ignored-path handling, planned/not_executed command status, and host-blocked precedence. | Focused MCP tests and typecheck. |

## Design To Implementation Matrix

| Design element | Implementation | Evidence |
| --- | --- | --- |
| MCP project-shape detector | `src/application/use-cases/mcp-server-shape.ts` | Focused MCP tests. |
| Overview routing | `src/application/use-cases/get-repo-overview.ts` | Overview fixture test. |
| Task-context routing | `src/application/use-cases/get-task-context.ts` | Context fixture test. |
| Validation planning | `src/application/use-cases/plan-verification.ts` | Verification-plan fixture tests. |
| Durable docs | `docs/design/mcp-surface-design.md`, `docs/design/coding-agent-integration-design.md`, `docs/reference/documentation-map.md` | Lifecycle lint and closure check. |

## Open Decision Impact

No open decisions remain for this slice. Live MCP protocol diagnostics, SDK
import parsing, and richer cross-language semantic proof are deferred until
separate fixture-backed specs define those capabilities.
