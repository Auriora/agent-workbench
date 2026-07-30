---
title: Stdio bridge resource lifecycle requirements
doc_type: spec
artifact_type: requirements
status: draft
owner: platform
last_reviewed: 2026-07-30
---

# Requirements

## Introduction

Agent Workbench intentionally runs one repository daemon and one stdio proxy
for each connected coding-agent MCP session. Live investigation found two
separate resource defects in the proxy layer: a released runtime explicitly
keeps proxies alive after both controlling stdin and the daemon socket have
gone away, and each proxy imports the combined daemon client/server module,
which loads the server, SQLite, and parser dependency graph into a process that
only forwards bytes.

This change makes proxy lifetime follow its two transports and separates the
lightweight daemon client path from daemon-owned repository services. It does
not change the one-daemon-per-repository model.

## Goals

- Terminate a stdio proxy deterministically when its client input ends or its
  daemon connection closes.
- Keep the stdio proxy import graph free of daemon server, graph store, parser,
  and MCP server implementation modules.
- Preserve current daemon identity, handshake, startup election, degraded-state,
  and repository-root authority behavior.
- Prove the source and packaged entrypoints have the same lifecycle behavior.
- Document how operators distinguish expected per-session proxies from leaked
  or disconnected processes.

## Non-Goals

- Reusing one stdio transport across independent MCP client sessions.
- Changing Codex, Claude Code, or Kiro subagent/session lifecycle behavior.
- Killing a proxy while its controlling stdin and daemon socket remain open.
- Replacing tree-sitter, SQLite, or the repository daemon architecture.
- Adding fallback transports, retry-only masking, process scavengers, or an
  absolute RSS threshold that would vary with Node and operating-system builds.

## Glossary

| Term | Definition |
|------|------------|
| Repository daemon | The expensive, shared Agent Workbench process that owns repository services for one repository identity. |
| Stdio bridge | A connection-specific process that forwards MCP bytes between client stdin/stdout and the repository daemon socket. |
| Controlling stdin | The readable stream supplied by the MCP client to the bridge. |
| Heavy runtime graph | Daemon server, MCP server implementation, SQLite, graph store, tree-sitter, and repository indexing modules. |

## Durable Source Baseline

| Source | Current behavior relied on | Confidence | Notes |
|--------|----------------------------|------------|-------|
| `docs/design/runtime-operations-design.md` | One expensive daemon is shared per repository; connection-specific servers remain isolated. | high | Canonical owner for runtime ownership and concurrency. |
| `docs/design/coding-agent-integration-design.md` | Coding-agent launchers enter through a thin stdio integration surface. | high | Canonical owner for coding-agent integration. |
| `docs/runbooks/codex-agent-workbench-plugin.md` | Codex installation, launch, and diagnosis workflow. | high | Durable operator surface. |
| `src/mcp/daemon.ts` | Current daemon client election and daemon server implementation share one module. | high | Directly read at `2f2c561`. |
| `src/mcp/stdio-launch.ts` and `src/mcp/stdio.ts` | Current proxy wiring and partial socket-close lifetime fix. | high | Directly read at `2f2c561`. |

## Durable Impact

| Durable area | Action | Target | Notes |
|--------------|--------|--------|-------|
| design | clarify | `docs/design/runtime-operations-design.md` | Define proxy ownership, transport lifetime, and lightweight dependency boundary. |
| integration design | clarify | `docs/design/coding-agent-integration-design.md` | State the per-client bridge contract and client/server module split. |
| runbook | modify | `docs/runbooks/codex-agent-workbench-plugin.md` | Add process interpretation and orphan diagnosis. |
| API/contract | unchanged | `docs/reference/runtime-contracts.md` | No MCP request or response shape changes. |

## Staged Readiness

- **Current stage:** implementation-ready after expert review
- **Next stage:** implementation
- **Ready to implement when:** the requirements, design, tasks, traceability,
  and verification artifacts pass package lint and blocking MoE findings are
  reconciled.
- **Design-first exception:** no
- **Optional artifacts included:** `research.md`, `change-impact.md`,
  `traceability.md`, `verification.md`
- **Downstream review needed:** design, tasks, verification

## Requirements

### Requirement 1: Transport-owned bridge lifetime

**User Story:** As an operator, I want each stdio bridge to live only while its
client and daemon transport are usable, so that ended sessions do not leave
Agent Workbench processes consuming resources.

**Priority:** must-have

#### Acceptance Criteria

1. GIVEN a connected bridge, WHEN controlling stdin reaches `end`, `close`, or
   an equivalent already-ended state, THEN the bridge SHALL stop forwarding,
   close its daemon socket, release its stream listeners, and allow the process
   to exit without an artificial keepalive.
2. GIVEN a connected bridge, WHEN the daemon socket closes, THEN the bridge
   SHALL stop reading controlling stdin, release its stream listeners, and
   allow the process to exit.
3. GIVEN both termination paths race, WHEN teardown runs more than once, THEN
   teardown SHALL remain idempotent and SHALL NOT emit an unhandled error.
4. GIVEN both transports remain open, THEN the bridge SHALL remain connected
   and SHALL NOT impose an independent idle timeout.

### Requirement 2: Lightweight bridge dependency boundary

**User Story:** As a user with many agent sessions, I want each bridge to load
only client-side launch and transport code, so that repository-scale services
are paid for once by the repository daemon.

**Priority:** must-have

#### Acceptance Criteria

1. THE stdio bridge transitive runtime import graph SHALL exclude the daemon
   server implementation, `src/server.ts`, SQLite adapters, `better-sqlite3`,
   tree-sitter adapters, and MCP server registries.
2. THE daemon client path SHALL retain daemon identity, metadata validation,
   startup-lock arbitration, launch, handshake, and connection behavior in one
   explicit implementation path.
3. THE daemon server entrypoint SHALL continue to load all repository services
   needed by the daemon.
4. A repeatable architecture test SHALL fail if a forbidden heavy dependency
   becomes reachable from the stdio bridge entrypoint.

### Requirement 3: Daemon and integration compatibility

**User Story:** As an integration maintainer, I want the resource fix to retain
existing daemon and launcher contracts, so that installed clients require no
configuration migration.

**Priority:** must-have

#### Acceptance Criteria

1. GIVEN simultaneous clients for one repository identity, WHEN no daemon is
   ready, THEN exactly one startup owner SHALL launch a daemon and all admitted
   clients SHALL converge on it.
2. GIVEN an existing ready daemon, WHEN multiple stdio clients connect, THEN no
   additional repository daemon SHALL be launched.
3. Daemon protocol version, metadata shape, integration identity handshake,
   repository-root authority, and structured blocked/degraded failure behavior
   SHALL remain compatible.
4. Package and plugin validation SHALL prove the distributed launcher resolves
   the implemented source entrypoint.
5. GIVEN daemon bootstrap fails because a native module is unavailable or ABI
   incompatible, WHEN the detached daemon reports terminal startup failure,
   THEN every admitted bridge SHALL receive bounded actionable rebuild guidance
   without importing the native module graph into the bridge.
6. Public integration-profile and packaging metadata SHALL identify
   `src/mcp/stdio-entrypoint.mjs` as the canonical executable entrypoint and
   SHALL distinguish an unreleased worktree package from published release
   `0.6.2`.

### Requirement 4: Operational evidence and guidance

**User Story:** As an operator, I want evidence-backed process guidance, so that
I can distinguish expected multi-repository/session processes from leaks.

**Priority:** should-have

#### Acceptance Criteria

1. The durable runtime design SHALL state that one daemon per repository and
   one bridge per live client session are expected.
2. The Codex runbook SHALL explain that disconnected bridges with neither a
   controlling stdin writer nor daemon socket are defective, while connected
   bridges can remain because the client still owns the session.
3. Verification SHALL record a repeatable process/module observation without
   treating shared-page RSS or swap totals as an exact per-process allocation.
4. Verification, traceability, promotion, and task-state artifacts SHALL record
   one consistent executed-evidence state before closure.

## Correctness Properties

- **CP-001**: For any ordering or repetition of stdin termination and socket
  termination, bridge teardown completes at most once and leaves neither
  direction piped.
- **CP-002**: Any number of concurrent bridge connection attempts for the same
  repository identity results in at most one daemon launch owner.
- **CP-003**: The stdio entrypoint transitive runtime graph has no path to the
  heavy runtime modules named by Requirement 2.
- **CP-004**: Native daemon bootstrap failure produces the same bounded
  actionable operator guidance for the launch owner and concurrent waiters,
  without retaining a child stderr pipe after startup.

## Technical Context

- **Language/Version:** TypeScript ESM on Node.js 24
- **Primary Dependencies:** Node streams and sockets, Vitest, tsx entrypoints
- **Target Platform:** packaged Codex, Claude Code, and Kiro MCP integrations
- **Constraints:** no hidden fallback path; preserve native parser and SQLite
  behavior in the daemon; keep MCP adapters thin
- **Performance Goal:** remove daemon-owned heavy modules from every bridge;
  record observed process impact diagnostically, with architecture boundaries
  as the stable acceptance gate

## Success Criteria

- **SC-001**: Lifecycle tests prove bridges exit after either controlling stdin
  termination or daemon socket termination and remain alive while both are open.
- **SC-002**: A transitive-import architecture test proves the bridge cannot
  reach daemon server, SQLite, parser, or MCP server implementation modules.
- **SC-003**: Existing daemon launch and entrypoint integration tests pass
  without weakening startup-election or blocked-state expectations.
- **SC-004**: Typecheck, full tests, plugin validation, and package dry-run pass.

## Related Artifacts

- Change Impact: `change-impact.md`
- Design: `design.md`
- Tasks: `tasks.md`
- Verification: `verification.md`
