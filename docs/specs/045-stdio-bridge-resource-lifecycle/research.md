---
title: Stdio bridge resource investigation
doc_type: spec
artifact_type: research
status: draft
owner: platform
last_reviewed: 2026-07-29
---

# Research

## Scope

This investigation separates expected multi-repository daemon topology from
unexpected stdio bridge retention and per-bridge module cost. It covers the
live host, installed Agent Workbench 0.6.2, and current source at `2f2c561`.

## Findings

1. Four repository daemons matched four active repository identities and are
   expected under the documented per-repository model.
2. A stable live snapshot contained 29 bridges connected to those daemons and
   11 additional bridges for a repository with no daemon. The 11 had been
   reparented to the user service manager, had no daemon socket, and had no
   remaining stdin writer.
3. The installed 0.6.2 `src/mcp/stdio.ts` resumes stdin and creates a maximum
   interval after connecting. Those explicit keepalives allow a disconnected
   bridge to survive indefinitely.
4. Current source at `2f2c561` removed the explicit keepalive and waits for the
   daemon socket to close. That change was not present in the installed 0.6.2
   package and does not independently handle controlling stdin ending while a
   daemon socket remains open.
5. Connected bridges corresponded to one root Codex session and its subagent
   sessions. Completed subagent bridges remained connected because the Codex
   parent still held their stdin pipe writers. Agent Workbench cannot infer
   that a still-open client session should be killed.
6. `src/mcp/stdio-launch.ts` imports `connectOrStartDaemon` from
   `src/mcp/daemon.ts`. That module also statically imports server construction,
   SQLite, graph store, parser-facing runtime, filesystem watchers, and MCP
   transport server code.
7. Observed bridge processes commonly reported approximately 60-135 MiB RSS.
   Aggregate RSS and swap are useful symptoms but overcount shared pages and
   vary with Node/native builds, so they are not a stable acceptance contract.

## Root Causes

| Symptom | Root cause | Ownership |
|---------|------------|-----------|
| Disconnected 0.6.2 bridges never exit | The released entrypoint explicitly resumes stdin and installs an effectively infinite timer. | Agent Workbench |
| Current bridge can outlive client EOF while daemon stays open | Bridge lifecycle waits only for daemon socket close and lacks symmetric, idempotent stream teardown. | Agent Workbench |
| Every bridge loads expensive runtime code | Client connection/startup arbitration and daemon server/runtime ownership share one static module. | Agent Workbench |
| Completed but still-connected subagent bridges remain | The client parent process retains the pipe/session. | Client integration; not safely killable by Agent Workbench while transport remains open |

## Options Considered

| Option | Summary | Decision |
|--------|---------|----------|
| Add an idle timer or process scavenger | Kill bridges based on elapsed time or process inspection. | Rejected: it can terminate live sessions and masks ownership. |
| Add another lightweight direct-server fallback | Bypass the daemon when resource pressure is detected. | Rejected: creates parallel implementations and loses shared ownership. |
| Only ship the existing socket-close wait | Release the current partial fix unchanged. | Rejected: it does not make client EOF own teardown and leaves the heavy import graph. |
| Split client protocol/election from daemon server and make teardown transport-owned | Preserve one daemon path while making bridges lightweight and deterministic. | Recommended. |

## Confidence And Unknowns

- **Confidence:** high for process topology, orphan mechanism, and import
  boundary; medium for exact memory savings until measured after implementation.
- **Known unknowns:** the client may retain completed session pipes by design;
  Agent Workbench must not guess that an open pipe is abandoned.
- **Evidence gap:** no portable exact RSS limit across supported Node and OS
  builds. Static dependency exclusion and lifecycle subprocess tests are the
  stable gates.

## Recommendation

Extract the daemon client protocol, identity, metadata, election, and connection
path into lightweight modules shared by the stdio bridge and daemon server.
Keep repository service construction solely behind the daemon entrypoint. Add
one idempotent bridge-session owner that tears down on either input termination
or socket termination. Verify both source and packaged entrypoints.

## Related Artifacts

- Requirements: `requirements.md`
- Design: `design.md`
- Tasks: `tasks.md`
- Open Decisions: none
