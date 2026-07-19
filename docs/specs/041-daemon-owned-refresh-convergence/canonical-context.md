---
title: Daemon-owned refresh convergence canonical context
doc_type: spec
artifact_type: canonical-context
status: draft
owner: platform
last_reviewed: 2026-07-19
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Canonical Context

## Purpose

Define authoritative evidence, encoded implementation boundaries, and durable
promotion ownership for Spec 041 without treating this temporary package as
enduring product documentation.

## Intake

- Source: EB052 in `docs/backlog/README.md` and the 2026-07-19 entry in
  `docs/reference/dogfood-evidence-ledger.md`.
- Priority: P0 under EB003 first-read reliability.
- User-confirmed purpose: make daemon-owned refresh converge after deleted
  indexed paths are detected by any connected client.
- Accepted prerequisites: EB036 daemon ownership, closed Spec 039 snapshot-path
  validity, and closed Spec 040 provider-aware integration health.
- Scope boundary: EB014 retains large-repository throughput, incremental
  indexing, deadline tuning, and completion beyond current bounds.

## Repository Truth At Intake

- `src/mcp/daemon.ts` shares one graph-store factory across connections, but each
  accepted socket calls `createAgentWorkbenchServer`.
- `src/server.ts` constructs connection-local runtime operations, watcher, and
  change-queue state. Only the first connection may launch startup warm-up, so a
  later connection can create private planned refresh state without an executor.
- Daemon diagnostics reduce state to a startup boolean and hard-coded unknown
  graph freshness rather than controller/snapshot authority.
- `src/application/use-cases/index-repository-graph.ts` creates a replacement
  snapshot before all rows are written, while ordinary latest-snapshot selection
  can select that building snapshot. Atomic current-snapshot publication is
  planned work, not an existing implementation invariant.
- Existing standalone status tests prove one-server deletion-triggered refresh;
  they do not prove shared daemon watcher/generation ownership, requester
  disconnect survival, crash recovery, or an actually installed npm bin.

## Encoded Implementation Authority

The following boundaries are settled inputs to implementation:

1. The repository daemon owns one controller, one watcher/change queue, one
   repository ownership lease, and the sole refresh executor. Connection-specific
   servers retain provider/session identity but cannot own refresh lifecycle or
   watcher generations.
2. Standalone composition uses the same controller/watcher contracts locally
   only after acquiring repository ownership and proving no healthy daemon owner
   exists.
3. Every accepted first-read, startup, or watcher invalidation advances or joins
   one monotonic repository generation. A newer generation arriving during an
   active pass is retained as one sequential coalesced catch-up; it is not lost,
   parallelized, or treated as an automatic failure retry.
4. Entering planned state acquires one controller-owned activity lease before
   admission returns. The requester socket does not own the lease. Terminal
   notification releases it exactly once and coordinates the daemon idle timer.
5. Snapshot publication is independent of snapshot freshness and evidence-class
   coverage. Building, failed, and superseded targets remain invisible; ordinary
   latest selection advances only through an atomic published/current boundary.
   A published snapshot may be watcher-clean while retaining truthful partial
   coverage under existing bounds.
6. One awaited diagnostics operation reports execution, controller/generation,
   activity, publication, visible/target snapshot, freshness, and structured
   failure evidence. Presentation cannot synthesize or join a second authority.
7. Failure handlers, timers, health reads, and terminal callbacks do not retry.
   After failure, one later ordinary stale request may admit one new execution.
8. No manual refresh tool, provider-specific branch, partial-success fallback,
   alternate indexer, second executor, or raw adapter leakage is permitted.
9. D013 makes publication-state migration transactional: non-refreshing legacy rows
   become published, refreshing rows become failed/invisible, and schema version
   advances. Older runtimes block; supported rollback is pre-migration restore
   or the documented derived-store rebuild after all owners stop.

Private names and module decomposition may vary, but changing any boundary above
requires explicit requirements/design reconciliation before implementation.

## Authority Hierarchy

| Concern | Canonical owner |
| --- | --- |
| Daemon, watcher, generation, refresh, queue, ownership, activity, deadline, and idle lifetime | `docs/design/runtime-operations-design.md` |
| Snapshot publication/current selection, persistence, reader atomicity, and recovery | `docs/design/graph-store-design.md` |
| Source layering, operation ports, and composition boundaries | `docs/design/layered-runtime-architecture.md` |
| Execution, publication, freshness, diagnostics, failure, and trust vocabulary | `docs/reference/runtime-contracts.md` |
| Public status, health, query, and blocked-read presentation | `docs/design/mcp-surface-design.md` |
| Enduring target behavior | `docs/requirements/runtime-requirements.md` |
| Fixture and acceptance proof obligations | `docs/reference/mvp-proof-matrix.md` |
| Install, package, launcher, and operator support | `docs/runbooks/install-agent-workbench.md`; `docs/runbooks/codex-agent-workbench-plugin.md`; `packaging/agent-workbench/README.md` |
| Executable CI gates and smoke paths | `.github/workflows/ci.yml`; `scripts/ci/install-smoke.mjs`; `scripts/ci/mcp-launch-smoke.mjs`; planned installed-package acceptance |
| Agent-visible change summary | `docs/reference/agent-readable-changelog.md` |
| Intake and delivery status | `docs/backlog/README.md` |
| Closure and cleanup history | `docs/history/spec-closure-log.md`; `docs/history/spec-archive-index.md` |

## Always-Canonical External Sources

None. This slice depends on repository code, tests, durable docs, and bounded
local package/install evidence; it does not import a remote standard or API.

## Spec-Canonical Working Sources

The seven artifacts in this directory jointly govern implementation while the
spec is active. `requirements.md` owns observable acceptance, `design.md` owns
the single implementation path, `tasks.md` owns bounded delivery slices,
`traceability.md` owns planned mapping, and `verification.md` owns executed
evidence. `canonical-context.md` and `change-impact.md` constrain authority,
promotion, and risk without replacing those owners.

## Imported Sources

- EB052 and the dogfood ledger provide defect intake.
- Closed Specs 039 and 040 provide accepted prerequisite decisions; their
  removed packages remain historical and are not restored as active specs.

## Non-Canonical Background Sources

- Interactive Claude/Codex transcripts and installed-runtime observations are
  reproduction evidence, not contract authority.
- Provider-labelled test sessions prove per-connection labels and shared daemon
  behavior; they do not prove that the real Codex or Claude Code CLI invoked the
  plugin.

## Promotion Map

| Verified spec truth | Durable destination |
| --- | --- |
| controller, generations, daemon watcher, ownership/activity leases, deadline, idle semantics | `docs/design/runtime-operations-design.md` |
| publication lifecycle, current selection, recovery, retention, stale-reader semantics | `docs/design/graph-store-design.md` |
| narrow ports and daemon/standalone composition ownership | `docs/design/layered-runtime-architecture.md` |
| exact enums, diagnostics receipt, publication/freshness distinction, structured failure | `docs/reference/runtime-contracts.md` |
| public status/health/query behavior and blocked unpublished reads | `docs/design/mcp-surface-design.md` |
| enduring convergence and compatibility requirements | `docs/requirements/runtime-requirements.md` |
| controller, publication, crash, query, source-entrypoint, and installed-bin proof | `docs/reference/mvp-proof-matrix.md` |
| installed package and upgrade/support steps | `docs/runbooks/install-agent-workbench.md` |
| plugin launcher diagnosis and support steps | `docs/runbooks/codex-agent-workbench-plugin.md` |
| packaged runtime behavior and install shape | `packaging/agent-workbench/README.md` |
| agent-visible behavior and recovery guidance | `docs/reference/agent-readable-changelog.md` |
| delivered/residual status | `docs/backlog/README.md` |
| final implementation/cleanup commits and closure disposition | `docs/history/spec-closure-log.md` |
| archive/removal consistency | `docs/history/spec-archive-index.md` |

If implementation leaves a candidate destination unchanged, closure evidence
must record a reasoned no-op. CI workflow and smoke scripts are executable proof
artifacts, not substitutes for durable behavior/support documentation.

## Evidence Boundaries

- Directly spawning `src/mcp/stdio-entrypoint.mjs` proves checkout/source
  composition only.
- `scripts/ci/install-smoke.mjs` proves the runtime-root pointer; it does not by
  itself prove the installed MCP bin or multi-client convergence.
- `scripts/ci/mcp-launch-smoke.mjs` proves the plugin shim can initialize against
  its configured runtime root; it does not prove a tarball was installed.
- Installed-package acceptance must pack the real tarball, install it into an
  isolated temporary project or prefix with isolated state, invoke the installed
  `agent-workbench-mcp` bin, and run the two-client deletion/query scenario.
- Provider-labelled installed-bin sessions remain below real CLI/plugin
  acceptance. Any Codex/Claude CLI-level support claim requires a separately
  recorded live receipt after install/restart.
- Linux CI does not establish Windows named-pipe behavior. Existing mocked or
  platform-specific daemon tests remain required, and unsupported live platform
  coverage must be named rather than inferred.
- No transcript, final fresh snapshot count, or non-blocked empty query alone
  proves single-writer ownership, exact query recovery, cleanup, or redaction.

## Guardrails

- One controller/executor, one daemon watcher/change queue, one repository
  owner, one activity lease chain, and one publication path.
- MCP reads remain bounded and do not synchronously perform broad warm-up.
- Source/config remain canonical; graph and diagnostic state remain derived
  evidence with explicit trust and coverage.
- Generated `.cache/`, packed tarballs, temporary installs, sockets, worker
  output, and runtime state are never committed.
- EB014 large-repository completion and performance tuning remain separate.

## Current Evidence Limit

This package is an implementation plan. Planning traceability may be complete,
but implementation/property coverage remains pending. Closed prerequisites and
durable docs constrain the solution; they do not prove Spec 041 code, installed
package behavior, real CLI support, or live daemon convergence.
