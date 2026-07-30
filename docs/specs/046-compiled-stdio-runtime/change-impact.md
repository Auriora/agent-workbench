---
title: Compiled stdio runtime change impact
doc_type: spec
artifact_type: change-impact
status: draft
owner: platform
last_reviewed: 2026-07-30
---

# Change Impact

## Durable Source Mapping

| Source | Current behavior relied on | Confidence | Notes |
|--------|----------------------------|------------|-------|
| `docs/design/runtime-operations-design.md` | A lightweight bridge connects to one daemon that owns repository services. | high | Compilation must retain the boundary. |
| `docs/design/coding-agent-integration-design.md` | The source wrapper is currently the canonical distributed entrypoint. | high | This accepted contract changes. |
| `docs/runbooks/codex-agent-workbench-plugin.md` | Package, plugin, container, and checkout launch/diagnosis paths. | high | All paths require coordinated promotion. |
| packaging manifests and launchers | Concrete installed artifact paths. | high | Direct configuration evidence. |

## Change Type

- **Primary type:** performance and packaging refactor
- **Breaking change:** no MCP protocol change; internal launch-path migration
- **Durable docs required:** yes
- **External behavior affected:** process memory and installed artifact path

## Proposed Changes

| Change | Type | Current source | Durable destination | Promotion required |
|--------|------|----------------|---------------------|-------------------|
| Add deterministic runtime compilation | add | source TypeScript plus `tsx` wrapper | runtime operations design | yes |
| Replace distributed source-wrapper launch | modify | package/plugin/container manifests | integration design and runbook | yes |
| Build repository-local candidate before registration | modify | repo-local installer/materializer | Codex runbook | yes |
| Add resource and module evidence | add | live verification | runbook and verification | yes |

## Affected Surfaces

- package scripts, dependency metadata, allowlisted files, and build output
- stdio, daemon, and daemon-owned worker entrypoints
- npm bin and portable plugin shims
- Codex, Claude Code, and Kiro package path assertions
- repository-local installation
- container entrypoint and build
- package/plugin integration profile and smoke tests

## Unchanged Areas

| Area | Reason unchanged |
|------|------------------|
| MCP request/response contracts | Compilation does not alter schemas or public tools/resources. |
| daemon identity and graph schema | Existing values and compatibility remain authoritative. |
| bridge lifecycle semantics | Spec 045 transport-owned teardown remains unchanged. |
| parser and SQLite behavior | Same daemon source is compiled; native dependencies remain external. |
| provider session lifecycle | Still-open connections remain provider-owned. |
| Codex agent concurrency | It remains provider configuration; validation records it as a bridge-cardinality input. |

## Promotion Targets

| Spec content | Durable destination | Status |
|--------------|---------------------|--------|
| compiled runtime/build ownership | `docs/design/runtime-operations-design.md` | complete |
| canonical distributed launch path | `docs/design/coding-agent-integration-design.md` | complete |
| install/build/diagnosis/rollback | `docs/runbooks/codex-agent-workbench-plugin.md` | complete |

## Related Artifacts

- Requirements: `requirements.md`
- Design: `design.md`
- Tasks: `tasks.md`
- Verification: `verification.md`
