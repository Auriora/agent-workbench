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
| graph store design | establish explicit atomic publication/selection and stale-reader semantics; do not assume the current path is atomic |
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
| daemon composition | Own the shared controller, active-work lease, executor, store lifetime, and terminal cleanup | high | two-client, cross-process, disconnect, idle-race, worker-cleanup, and crash tests |
| server composition | Inject refresh request/state/diagnostic boundaries without disposing daemon-owned state on connection close | high | standalone and daemon compatibility tests |
| runtime coordination | Reuse one planned/running execution and preserve invalidation arriving during active work | high | deterministic barrier and concurrency tests |
| watcher/first read | Call the same request path and deduplicate concurrent/sequential duplicate events | medium | status, queue, and invalidation-during-running tests |
| graph publication | Add an explicit selection boundary so incomplete replacement generations are never ordinary latest evidence | high | barrier, concurrent-reader, reopen, interruption, retention, and query tests |
| integration health | Await one atomic diagnostic receipt with IDs, canonical state combinations, structured failure, and truthful top-level trust | high | schema, presenter, resource, transition, and redaction tests |
| worker lifecycle | Define timeout, hang, abnormal/zero-exit, termination, and cleanup semantics | high | controlled worker and daemon shutdown tests |
| packaging | Exercise an actually packed-and-installed bin with provider-labelled clients | high | isolated-install acceptance, pack, install-smoke, and launch-smoke checks |
| persistence compatibility | Reconcile publication metadata/schema with existing databases and downgrade behavior | high | migration, reopen, rollback, and older-database fixtures |

## Failure And Operational Impact

- The daemon must not idle-close while refresh is active.
- Active refresh is an explicit daemon lifetime lease. Completion, failure,
  requester disconnect, reconnect, and the idle timer may race without losing
  ownership or starting a second grace timer.
- Requesting-client disconnect becomes an ordinary condition, not cancellation.
- Failure remains visible until a later successful refresh clears bounded
  diagnostic evidence.
- A failed execution may be superseded only by another ordinary stale request
  through the same service; there is no automatic retry.
- Graph-store locking, file/extraction budgets, and snapshot retention remain
  governed by existing bounds. This slice must define and enforce the warm-up
  worker timeout, hang/termination behavior, graph-store close ownership, and
  cleanup because those bounds are not established merely by unreferencing a
  worker.
- Daemon crash during publication may leave an unpublished generation. Restart
  must identify it without selecting partial evidence or overlapping the prior
  owner, and must preserve the previous readable generation until one later
  ordinary request publishes a replacement.
- Failure presentation must use bounded structured codes/categories and redact
  paths, secrets, SQLite text, worker output, stacks, and control characters
  across envelopes, diagnostics, stdout/stderr, and metadata.

## Compatibility

- MCP names and provider behavior are unchanged.
- Health fields become stricter and add execution/snapshot correlation and
  structured failure semantics. Enum tightening, state-combination rejection,
  or changing top-level trust on daemon failure may affect existing consumers;
  contract fixtures and release notes must state the compatibility boundary
  rather than assuming the change is additive.
- The publication-state migration is transactional: existing non-refreshing
  rows become published, existing refreshing rows become failed and invisible,
  and schema version advances. Older runtimes must block before read/write; no
  in-place downgrade is supported. Rollback uses a pre-migration database copy
  or the documented derived-store rebuild after all owners stop.
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
| applicable integration/support runbook under `docs/runbooks/` | authoritative state diagnosis, safe metadata/socket cleanup, orphaned publication recovery, worker/store cleanup expectations, rollback and downgrade/schema compatibility, and redacted support evidence |
| backlog/changelog/history | delivered status and closure evidence |

## Package And Operational Proof Boundary

Checkout tests that spawn `src/mcp/stdio-entrypoint.mjs` prove source
composition only. Closure requires a real tarball installed into an isolated
location and the installed `agent-workbench-mcp` bin, plus the existing CI
`install-smoke.mjs` and `mcp-launch-smoke.mjs` gates. The two acceptance clients
may carry Codex and Claude Code launcher identities to prove provider-neutral
daemon behavior, but that does not prove either real agent CLI loaded the
plugin; CLI-level claims require separate live evidence.

Support and rollback guidance must identify safe observable state combinations,
how to distinguish a failed execution from an unpublished generation, when
stale daemon metadata or sockets may be removed, what cleanup evidence is
required, and whether an older runtime can reopen the post-change database. It
must not recommend deleting the graph database unless the existing positive
evidence and rebuild contract authorize that action.

## Out-Of-Scope Destinations

- Large-repository warm-up scale and completion: EB014.
- Incremental file-level indexing: future design-backed work only.
- General client refresh/reload operations: existing integration runbooks.
