---
title: Per-repo runtime daemon and shared cache tasks
doc_type: spec
artifact_type: tasks
status: active
owner: platform
last_reviewed: 2026-06-18
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

- [ ] T001 Design daemon/socket protocol details.
  - Files: `src/mcp/`, `docs/design/runtime-operations-design.md`
  - Acceptance: Socket identity, lifecycle, request proxying, stale cleanup,
    and failure semantics are specified before implementation.
  - Evidence: Pending.

- [ ] T002 Add daemon process and client launcher.
  - Depends on: T001
  - Files: `src/mcp/stdio-launch.ts`, `src/mcp/stdio.ts`, new daemon module
  - Acceptance: First client starts daemon; later clients connect to existing
    daemon for the same repo.
  - Evidence: Pending.

- [ ] T003 Move graph store and warmup ownership into daemon.
  - Depends on: T002
  - Files: `src/server.ts`, `src/infrastructure/sqlite/`,
    `src/infrastructure/workers/`
  - Acceptance: MCP client processes no longer open independent graph stores
    for the same repo.
  - Evidence: Pending.

- [ ] T004 Serialize writes and expose snapshot freshness.
  - Depends on: T003
  - Files: runtime operations, graph use cases, presenters
  - Acceptance: Reads use latest usable snapshot during refresh; writes are
    serialized; failures produce structured freshness/blocker envelopes.
  - Evidence: Pending.

- [ ] T005 Add daemon doctor/debug surface.
  - Depends on: T004
  - Files: `src/`, `tools/devcli/` if available, docs
  - Acceptance: Debug output reports daemon PID, socket, clients, warmup,
    graph freshness, and last failure.
  - Evidence: Pending.

- [ ] T006 Add concurrency and lifecycle tests.
  - Depends on: T005
  - Files: `tests/mcp/`, `tests/integration/`
  - Acceptance: Tests prove two clients share one daemon/writer, second repo
    gets separate daemon, idle grace works, crash restart works, and malformed
    socket requests are blocked.
  - Evidence: Pending.

- [ ] T007 Dogfood multi-client warmed sweep.
  - Depends on: T004
  - Files: `src/debug/`, `docs/specs/032-per-repo-runtime-daemon-cache/`
  - Acceptance: A warmed sweep against a large repo with concurrent clients has
    no raw `database is locked` resource or tool failures.
  - Evidence: Pending.

- [ ] T008 Promote durable docs and close readiness.
  - Depends on: T006, T007
  - Files: `docs/design/runtime-operations-design.md`,
    `docs/design/mcp-surface-design.md`, `docs/backlog/README.md`
  - Acceptance: Durable docs describe accepted daemon/cache behavior and EB036
    is marked promoted or routed.
  - Evidence: Pending.

