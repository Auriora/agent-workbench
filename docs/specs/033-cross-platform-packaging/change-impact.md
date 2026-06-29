---
title: Cross-platform packaging change impact
doc_type: spec
artifact_type: change-impact
status: active
owner: platform
last_reviewed: 2026-06-29
---

# Change Impact

## Durable Source Mapping

- [Runtime operations design](../../design/runtime-operations-design.md) —
  describes the MCP launcher and install model.
- Install/distribution docs under `docs/` and
  `packaging/agent-workbench/README.md`.
- [Threat model](../../security/threat-model.md) — launch surface changes.

## Proposed Changes

| Change | Class | Durable doc to update before closure |
| --- | --- | --- |
| `.sh` installer → Node `installer.mjs`; `npm-install.js` no longer spawns a shell | modify | `packaging/.../README.md`, runtime operations design |
| `bin/agent-workbench-mcp` bash launcher → generated `bin/agent-workbench-mcp.mjs` | modify | runtime operations design |
| `.mcp.json` `bash -lc` → exec-form `node mcp-launch.mjs` (both copies) | modify | runtime operations design |
| `hooks.json` inline `VAR=value` → exec form + `env` field | modify | hook/plugin docs |
| New shared `install-root.mjs` resolver with Windows default | add | runtime operations design |
| Supported-platform matrix (Windows/macOS/Linux) | add | install/operations docs |
| Native `tree-sitter` build toolchain prerequisites | add/clarify | install docs (see Requirement 5) |

## Promotion Targets

- The supported platform/interpreter matrix and native-build decision promote
  into durable install/operations docs at closure (task T012).
- If native cross-platform build is deferred, open a follow-up spec and record
  it in `docs/backlog/` rather than leaving it implicit.

## Bug-Fix Corrections

- The package currently advertises installability but cannot install or launch
  on Windows. Closure must correct any durable doc that implies Windows support
  today.
