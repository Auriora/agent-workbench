---
title: Stdio bridge resource lifecycle design
doc_type: spec
artifact_type: design
status: draft
owner: platform
last_reviewed: 2026-07-30
---

# Technical Design

## Overview

Split the present combined daemon module at the process boundary:

```text
coding-agent stdin/stdout
        |
        v
stdio entrypoint -> bridge session -> daemon client/election -> Unix socket/pipe
                                             |
                                             | spawn when elected
                                             v
                                      daemon entrypoint
                                             |
                                             v
                               daemon server + repository services
```

The bridge path may depend on Node process, stream, filesystem, crypto, and
socket primitives plus lightweight shared contracts. It must not statically
reach daemon server or repository implementation modules. The daemon entrypoint
continues to compose both the lightweight protocol/election code and the heavy
daemon server.

## Requirement Coverage

| Requirement | Acceptance Criteria | Design Coverage | Validation |
|-------------|---------------------|-----------------|------------|
| Requirement 1 | AC1-AC4 | Idempotent bridge-session teardown owned by stdin and socket events | stream unit tests and subprocess entrypoint tests |
| Requirement 2 | AC1-AC4 | Lightweight client/protocol modules and transitive import boundary | architecture import-graph test |
| Requirement 3 | AC1-AC4 | Existing daemon election algorithms retained and re-exported from stable surface | existing daemon launch/integration tests |
| Requirement 4 | AC1-AC3 | Durable design and runbook promotion | Markdown checks and docs tests |

## Correctness Property Coverage

| Property | Design Behavior | Validation Direction |
|----------|-----------------|----------------------|
| CP-001 | Single guarded teardown function removes pipes/listeners and closes the opposite transport | table-driven event-order tests |
| CP-002 | Existing atomic startup lock and metadata lifecycle move without semantic alteration | existing parallel-client tests |
| CP-003 | Entrypoint dependency traversal rejects forbidden modules | architecture test resolving relative ESM imports |

## High-Level Design

The stdio process owns only client transport and daemon admission. The daemon
process owns repository services and native dependencies. Shared identity and
protocol modules contain data contracts, not repository implementation.

## Components and Changes

### Lightweight runtime identity contract

Place the graph-store identity version needed by daemon identity in
`src/contracts/graph-store-identity-contracts.ts`. SQLite adapters import that
constant; the bridge does not import `better-sqlite3` merely to calculate a
daemon identity.

Move the debug root-override environment name to
`src/contracts/launch-authority-contracts.ts`, used by both the launcher and
root-authority adapter. Do not duplicate either constant.

### Daemon client module

Extract the existing client-side types and functions from `src/mcp/daemon.ts`:

- daemon protocol and identity types
- identity and path calculation
- metadata parsing/classification
- startup-lock arbitration
- daemon process spawning
- wait/connect/handshake behavior
- `connectOrStartDaemon`

The algorithm and error vocabulary remain one implementation. The existing
`src/mcp/daemon.ts` surface may re-export client symbols to avoid unnecessary
internal call-site churn, but the stdio bridge must import the lightweight
module directly.

During a cold launch, the client may retain only a bounded startup-diagnostic
pipe from the detached daemon. The pipe is released when startup reaches a
terminal or ready state and must never become a long-lived bridge-to-daemon
ownership channel. Native-loader text is classified into a fixed failure hint;
raw child stderr is not copied into metadata or returned to clients.

### Daemon server module

Retain daemon server construction, repository services, socket admission,
refresh lifetime coordination, and `runDaemonFromEnv` behind the daemon
entrypoint. It imports client-side identity/protocol helpers where necessary.
No server behavior is copied into the client module.

### Bridge session

`connectAgentWorkbenchStdio` returns one `StdioBridgeSession` with explicit
completion and teardown semantics. `src/mcp/stdio-launch.ts` is the sole
production owner of that teardown. One guarded teardown routine:

1. records the first terminal cause;
2. unpipes stdin from the daemon socket and the socket from stdout;
3. removes only listeners installed by the bridge;
4. destroys/ends the socket when stdin terminates;
5. pauses or detaches stdin when the daemon socket terminates; and
6. resolves bridge completion once.

Already-ended input and already-destroyed socket states are checked immediately
after listeners are installed to close event-registration races. Socket errors
are reported once and flow through the same terminal path.

The executable awaits bridge completion. It installs no keepalive timer and
does not call `process.stdin.resume()` to manufacture liveness.

## Low-Level Design

The existing daemon admission algorithm moves as a coherent unit. Bridge
teardown uses one completion guard and named listeners so each installed
listener can be removed without affecting listeners owned by the caller.

## Interfaces

```ts
type StdioBridgeSession = {
  socket: Socket;
  completed: Promise<void>;
  close(): void;
};

function connectAgentWorkbenchStdio(
  config?: StdioLaunchConfig,
  io?: BridgeIo
): Promise<StdioBridgeSession>;
```

`close()` is idempotent. `src/mcp/stdio.ts` only awaits `session.completed`; it
does not install a second lifecycle implementation or expose a second
production connection shape.

### Canonical launch entrypoint

`src/mcp/stdio-entrypoint.mjs` is the single distributed stdio launch
entrypoint. It registers tsx and imports `src/mcp/stdio.ts`.

- `package.json` `mcp`, `packaging/agent-workbench/mcp-bin.mjs`, and each plugin
  launcher resolve `stdio-entrypoint.mjs`.
- `packaging/agent-workbench/Containerfile` and
  `packaging/agent-workbench/package-manifest.json` must be changed from direct
  `stdio.ts` launch to the canonical wrapper.
- Validation must enumerate all of those launch artifacts so no shipped surface
  bypasses the lifecycle owner.

## Error Handling

- Daemon election, metadata, handshake, and blocked-state errors propagate as
  they do today.
- Native module load failure in the detached daemon preserves the existing
  terminal failure-code vocabulary and adds one optional, bounded
  `native_module_rebuild_required` hint. Import-time child termination remains
  observable as `child_exit`; bootstrap-time daemon failures remain
  `bootstrap_failed`. The launch owner and concurrent waiters map the hint to
  the same actionable rebuild guidance. Older metadata without the optional
  hint remains valid.
- A daemon socket error writes one bounded message to stderr and terminates the
  bridge; it does not retry through an alternate route.
- Normal stdin EOF or socket close is a successful bridge completion.
- Cleanup must not swallow daemon-start failures or turn them into partial MCP
  output.

## Security, Trust, and Access

Repository-root authority and bounded integration identity handling remain
unchanged. The split must not introduce new environment inputs, shell
evaluation, filesystem deletion scopes, network listeners, or credential
handling.

## Migration and Compatibility

No metadata, protocol, configuration, or MCP contract migration is required.
The optional startup failure hint is additive and does not change daemon
identity or successful handshake shape.
Installed packages receive the fix on the next release; already-running 0.6.2
orphan bridges are not modified in place. Operators may terminate confirmed
disconnected old bridges using the runbook after resolving exact PIDs.

Until that release exists, package manifests identify the checkout as
`unreleased` while retaining `latest_released_version: 0.6.2` and the published
0.6.2 install command. Local installed-tarball smoke is candidate evidence, not
evidence that the published 0.6.2 artifact contains the fix.

## Slice Boundary and Residual Architecture

| Design target | In this slice | Out of this slice | Follow-up destination | Blocks closure? |
|---------------|---------------|-------------------|-----------------------|-----------------|
| Transport-owned bridge lifetime | source and packaged stdio paths | client-owned still-open completed sessions | client integration owner if later required | no |
| Lightweight bridge graph | daemon client/server split and boundary test | absolute cross-platform RSS guarantee | none; intentionally rejected | no |
| Shared repository daemon | preserved startup/election path | changing daemon cardinality | none | no |

## Validation Strategy

| Validation | Covers | Evidence |
|------------|--------|----------|
| Bridge stream lifecycle tests | Requirement 1, CP-001 | targeted Vitest output |
| Subprocess/package entrypoint tests | Requirements 1 and 3 | targeted MCP tests |
| Transitive import boundary test | Requirement 2, CP-003 | architecture test |
| Existing daemon concurrency/failure tests | Requirement 3, CP-002 | daemon launch test |
| Native-loader child failure and waiter tests | Requirement 3, CP-004 | daemon launch and subprocess tests |
| `pnpm typecheck`, `pnpm test` | integration regression | verification log |
| `pnpm validate:plugin`, `pnpm pack:dry-run` | packaged surface | verification log |
| `CXXFLAGS=-std=c++20 node scripts/ci/installed-package-mcp-smoke.mjs` | actual tarball install, installed bin, shared daemon, and stdin EOF exit | verification log |
| MoE design and implementation reviews | architecture, QA, operations | review notes in verification |

## Operational Considerations

One bridge per open client session remains expected, including subagent
sessions whose parent retains the pipe. A bridge is suspect only when transport
evidence shows that neither controlling stdin nor the repository daemon socket
is owned. Process RSS is diagnostic because native and shared pages can be
counted in multiple processes.

## Open Questions

None. The MoE selected `StdioBridgeSession` owned by
`src/mcp/stdio-launch.ts` and `stdio-entrypoint.mjs` as the single distributed
launch surface.

## Related Artifacts

- Requirements: `requirements.md`
- Change Impact: `change-impact.md`
- Tasks: `tasks.md`
- Verification: `verification.md`
