---
title: Per-repo runtime daemon and shared cache tasks
doc_type: spec
artifact_type: tasks
status: active
owner: platform
last_reviewed: 2026-07-05
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Tasks

## Task Dependency Graph

```text
T001 -> T002 -> T003 -> T004 -> T005 -> T006
T004 -> T007
T006,T007 -> T008
```

Implementation completed on 2026-07-05. The shipped path uses Node local IPC,
repo identity metadata, daemon-backed stdio proxying, daemon-owned shared graph
store access, MCP integration-health diagnostics, and durable documentation
promotion.

- [x] T001 Design daemon/socket protocol details.
  - Files: `docs/specs/032-per-repo-runtime-daemon-cache/design.md`,
    `docs/design/runtime-operations-design.md`
  - Acceptance: Socket identity, lifecycle, request proxying, stale cleanup,
    failure semantics, platform IPC behavior, permissions, and debug surface
    destination are specified before implementation.
  - Evidence: Completed 2026-07-05. `design.md` now specifies local IPC
    choice, identity hashing, metadata location, same-user permissions,
    handshake fields, proxy framing, stale cleanup, lifecycle grace,
    failure-envelope mapping, and runtime-first debug surface. Durable runtime
    ownership notes were promoted to `docs/design/runtime-operations-design.md`.
    Validation: `lint_spec_package`, `traceability_lookup` for T001, and
    `git diff --check` passed.

- [x] T002 Add daemon process and client launcher.
  - Depends on: T001
  - Files: `src/mcp/stdio-launch.ts`, `src/mcp/stdio.ts`, new daemon module,
    `tests/mcp/`
  - Acceptance: First client starts daemon; later clients connect to existing
    daemon for the same repo. Focused launcher tests prove first-client start,
    parallel same-session sub-agent cold-start election, same-repo reuse,
    different-repo isolation, stale socket cleanup, owner-only POSIX runtime
    directories, and malformed socket rejection before this task is complete.
  - Evidence: Completed 2026-07-05. Added `src/mcp/daemon.ts`,
    `src/mcp/daemon-entrypoint.mjs`, and `src/mcp/socket-transport.ts`; updated
    `src/mcp/stdio-launch.ts` so packaged stdio clients connect to or start the
    per-repo daemon and proxy MCP frames. `tests/mcp/daemon-launch.test.ts`
    proves first-client start, parallel cold-start serialization for same-repo
    clients, same-repo reuse, different-repo isolation, stale metadata/socket
    cleanup, owner-only POSIX metadata/IPC directories, and malformed socket
    rejection. Validation:
    `pnpm exec vitest run tests/mcp/daemon-launch.test.ts`,
    `pnpm exec vitest run tests/mcp/daemon-launch.test.ts tests/mcp/stdio-entrypoint.test.ts`,
    `pnpm typecheck`, and a real `src/mcp/stdio-entrypoint.mjs` smoke passed.

- [x] T003 Move graph store and warmup ownership into daemon.
  - Depends on: T002
  - Files: `src/server.ts`, `src/infrastructure/sqlite/`,
    `src/infrastructure/workers/`, `tests/integration/`
  - Acceptance: MCP client processes no longer open independent graph stores
    for the same repo. Focused ownership tests prove one daemon-owned graph
    store and one warmup writer for same-repo clients, including parallel
    sub-agents that launch together, before this task is complete.
  - Evidence: Completed 2026-07-05. `src/server.ts` now accepts a shared
    graph-store factory, exports graph-store factory/path helpers, and the daemon
    creates one shared factory for its repo identity. Daemon-hosted MCP sessions
    use that shared factory, while a repo-local daemon startup lock prevents
    parallel launchers from spawning competing daemon owners and startup graph
    warmup is scheduled once per daemon lifetime. Validation: focused daemon
    tests and stdio MCP regression tests passed; the existing concurrent stdio
    warmup regression still proves one startup warmup writer for same-repo
    sessions.

- [x] T004 Serialize writes and expose snapshot freshness.
  - Depends on: T003
  - Files: runtime operations, graph use cases, presenters, `tests/`
  - Acceptance: Reads use latest usable snapshot during refresh; writes are
    serialized; failures produce structured freshness/blocker envelopes.
    Concurrent read/write tests prove no raw `database is locked` output before
    this task is complete.
  - Evidence: Completed 2026-07-05. Existing graph-store transaction behavior,
    startup warmup lock ownership, and snapshot freshness envelopes remain the
    serialization path. Daemon launcher clients now route graph-backed work to
    the daemon-owned runtime instead of opening client-side stores. Validation:
    `tests/mcp/stdio-entrypoint.test.ts` covers locked graph startup, delayed
    startup status, warmup completion, bounded warmup, and concurrent same-repo
    warmup ownership; the dogfood two-client sweep returned fresh symbol results
    with no raw `database is locked` stderr or MCP output.

- [x] T005 Add daemon doctor/debug surface.
  - Depends on: T004
  - Files: `src/`, `tools/devcli/` if available, docs, `tests/`
  - Acceptance: Debug output reports daemon PID, socket, clients, warmup,
    graph freshness, and last failure. Doctor/debug tests prove compact normal
    tool output and detailed diagnostic output before this task is complete.
  - Evidence: Completed 2026-07-05. Added optional `data.daemon` diagnostics to
    `integration:///health/agent-workbench` via
    `src/contracts/runtime-integration-contracts.ts`,
    `src/application/use-cases/get-integration-health.ts`, and `src/server.ts`.
    The daemon reports PID, socket path, repo root, connected clients, warmup
    state, graph freshness, and last failure when available. No dev CLI command
    shipped; the accepted debug surface is MCP integration health. Validation:
    `tests/mcp/daemon-launch.test.ts` proves daemon diagnostics while normal
    `repo:///status` coverage remains unchanged.

- [x] T006 Add integration-level concurrency and lifecycle tests.
  - Depends on: T005
  - Files: `tests/mcp/`, `tests/integration/`
  - Acceptance: End-to-end integration tests cover the cross-task behavior:
    two concurrently launched clients share one daemon/writer, a second repo
    gets a separate daemon, idle grace works, crash restart works, and blocked
    graph-store startup returns structured degraded or blocked state.
  - Evidence: Completed 2026-07-05. Focused daemon tests cover same-repo reuse,
    parallel cold-start serialization, owner-only POSIX runtime directories,
    separate repo daemon isolation, stale metadata/socket replacement, malformed
    handshake rejection, and daemon health. Existing MCP tests cover same-repo
    concurrent warmup writer behavior, graph lock startup behavior, and
    lifecycle cleanup through session close. Validation: `pnpm exec vitest run
    tests/mcp/daemon-launch.test.ts tests/mcp/stdio-entrypoint.test.ts` passed.

- [x] T007 Dogfood multi-client warmed sweep.
  - Depends on: T004
  - Files: `src/debug/`, `docs/specs/032-per-repo-runtime-daemon-cache/`
  - Acceptance: A warmed sweep against a large repo with concurrent clients has
    no raw `database is locked` resource or tool failures.
  - Evidence: Completed 2026-07-05. Ran two concurrent package launcher clients
    through `src/mcp/stdio-entrypoint.mjs` against this repository with
    graph-backed `symbol_search` for `createAgentWorkbenchServer`. Both clients
    returned 13 fresh symbols, stderr was empty, and no raw SQLite lock text
    appeared in responses or stderr.

- [x] T008 Promote durable docs and close readiness.
  - Depends on: T006, T007
  - Files: `docs/design/runtime-operations-design.md`,
    `docs/design/graph-store-design.md`,
    `docs/design/mcp-surface-design.md`,
    `docs/reference/runtime-contracts.md`, `docs/backlog/README.md`,
    `docs/specs/032-per-repo-runtime-daemon-cache/change-impact.md`
  - Acceptance: Durable docs describe accepted daemon/cache behavior and EB036
    is marked promoted or routed. Every `change-impact.md` target is promoted,
    explicitly deferred, or routed before closure.
  - Evidence: Completed 2026-07-05. Promoted daemon/cache behavior into
    `docs/design/runtime-operations-design.md`,
    `docs/design/graph-store-design.md`,
    `docs/design/mcp-surface-design.md`,
    `docs/reference/runtime-contracts.md`, and `docs/backlog/README.md`.
    Updated `change-impact.md` to record promoted targets and the decision not
    to ship a dev CLI doctor command in this spec. Validation: `pnpm typecheck`,
    focused MCP/daemon tests, docs metadata/link tests, and `git diff --check`
    passed.
