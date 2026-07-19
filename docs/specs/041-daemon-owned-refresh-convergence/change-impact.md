---
title: Daemon-owned refresh convergence change impact
doc_type: spec
artifact_type: change-impact
status: draft
owner: platform
last_reviewed: 2026-07-19
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Change Impact

## Summary

The change moves refresh lifecycle ownership from connection-local server state
to one repository-daemon service. Public tool/resource names remain stable, but
daemon health becomes authoritative and more strictly typed.

## Durable Source Mapping

| Current authority | Change responsibility |
| --- | --- |
| runtime operations design | replace connection-local refresh ownership with daemon ownership |
| graph store design | preserve atomic replacement and stale-reader semantics |
| runtime contracts | constrain diagnostic execution/freshness/failure evidence |
| MCP surface design | reflect only confirmed public presentation changes |
| runtime requirements and proof matrix | record enduring behavior and package proof |

## Proposed Changes

- Add one daemon-scoped refresh controller and narrow injected port.
- Route startup, first-read deletion, and watcher invalidation through it.
- Keep active work alive across requester disconnect and daemon idle checks.
- Replace synthetic health with authoritative canonical diagnostics.
- Prove atomic replacement and graph/docs query recovery through the package
  entrypoint.

## Code And Contract Impact

| Area | Impact | Risk | Required proof |
| --- | --- | --- | --- |
| daemon composition | Own shared controller and keep it alive through active work | high | two-client, disconnect, idle, crash tests |
| server composition | Inject refresh request/state boundaries | high | standalone and daemon compatibility tests |
| runtime coordination | Reuse one planned/running execution | high | concurrency/unit tests |
| watcher/first read | Call the same request path | medium | status and queue tests |
| graph publication | Prevent selection of a replacement until indexing is completely published | high | store selection, snapshot, and query tests |
| integration health | Await real state and constrain enums | medium | schema, presenter, resource tests |
| packaging | Exercise installed entrypoint and mixed providers | high | package-entrypoint and pack checks |

## Failure And Operational Impact

- The daemon must not idle-close while refresh is active.
- Requesting-client disconnect becomes an ordinary condition, not cancellation.
- Failure remains visible until a later successful refresh clears bounded
  diagnostic evidence.
- A failed execution may be superseded only by another ordinary stale request
  through the same service; there is no automatic retry.
- Graph-store locking, worker timeout, and snapshot retention behavior remain
  governed by existing bounds.

## Compatibility

- MCP names and provider behavior are unchanged.
- Health fields become stricter but remain additive in meaning; fixtures must
  determine whether a schema migration note is needed.
- Existing stale envelopes and next actions remain the convergence trigger and
  completion signal; no new agent-facing refresh command is introduced.

## Promotion Targets

| Target | Promotion content |
| --- | --- |
| `docs/design/runtime-operations-design.md` | daemon controller ownership, execution lifecycle, disconnect/idle semantics |
| `docs/design/graph-store-design.md` | replacement publication and stale-reader behavior |
| `docs/reference/runtime-contracts.md` | canonical health states, freshness, failure lifetime |
| `docs/design/mcp-surface-design.md` | only presentation changes confirmed by implementation |
| `docs/requirements/runtime-requirements.md` | enduring convergence requirement |
| `docs/reference/mvp-proof-matrix.md` | package two-client proof |
| backlog/changelog/history | delivered status and closure evidence |

## Out-Of-Scope Destinations

- Large-repository warm-up scale and completion: EB014.
- Incremental file-level indexing: future design-backed work only.
- General client refresh/reload operations: existing integration runbooks.
