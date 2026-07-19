---
title: Provider-aware integration health change impact
doc_type: spec
artifact_type: change-impact
status: draft
owner: platform
last_reviewed: 2026-07-19
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Change Impact

## Durable Source Mapping

| Source | Current behavior relied on | Confidence |
| --- | --- | --- |
| `docs/design/coding-agent-integration-design.md` | Provider boundaries and packaged integrations | high |
| `docs/design/mcp-surface-design.md` | Public resource/tool semantics | high |
| `docs/reference/runtime-contracts.md` | Integration-health/profile contracts | high |
| `docs/backlog/README.md` EB001 and EB040 | Residual health/version evidence | high |

## Change Type

- **Primary type:** bug_fix and contract extension
- **Breaking change:** no; additive compatibility required
- **Durable docs required:** yes
- **External behavior affected:** yes

## Proposed Changes

| Change | Type | Current source | Durable destination | Promotion required |
| --- | --- | --- | --- | --- |
| Replace common Codex-derived profile with common/current model | bug_fix | server/profile use case | integration design; runtime contracts | yes |
| Carry per-connection provider/client identity | add | launcher/daemon/server composition | integration design | yes |
| Make static health honest and add caller-input tool | bug_fix/add | integration-health resource | MCP surface; runtime contracts | yes |
| Separate runtime/plugin/cache/client identities | add | health contract/package metadata | runtime contracts; runbook | yes |
| Validate required metadata agreement | modify | package/plugin validator | runbook/changelog | yes |

## Promotion Targets

| Spec content | Durable destination | Promotion status |
| --- | --- | --- |
| common/current/provider model | coding-agent integration design | pending |
| static/tool health semantics | MCP surface design | pending |
| typed identities/provenance/mismatch | runtime contracts | pending |
| operator recovery | install/plugin runbooks and README | pending |
| delivery/residual state | backlog, changelog, history | pending |

## Bug Fix Details

- **Observed behavior:** Claude-launched health reports profile `codex`; static
  resource arguments cannot be supplied; ordinary reads classify all caller
  discovery unknown; one runtime version cannot explain plugin/cache drift.
- **Expected behavior:** per-connection effective provider or explicit unknown,
  honest server versus caller evidence, and separated artifact identities.
- **Root cause evidence:** `src/server.ts` hard-codes Codex and derives registered
  surfaces from the Codex descriptor; resource tests bypass real MCP read shape;
  health contracts contain only `runtime_version` and `profile`.
- **Regression risk:** high across public contracts, daemon connections,
  packaging, and cross-client compatibility.
- **Durable doc update needed:** yes.

## Unchanged Durable Areas

| Durable area | Reviewed source | Reason unchanged |
| --- | --- | --- |
| repository analysis/runtime core | layered architecture docs | Provider identity must not change graph/application behavior. |
| automatic updates | installation runbook | Explicitly out of scope. |
| general capability inventory | EB019 | Broader inventory remains separately owned. |

## Related Artifacts

- Requirements: `requirements.md`
- Design: `design.md`
- Tasks: `tasks.md`
- Verification: `verification.md`
