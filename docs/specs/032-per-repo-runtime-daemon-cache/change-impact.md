---
title: Per-repo runtime daemon and shared cache change impact
doc_type: spec
artifact_type: change-impact
status: active
owner: platform
last_reviewed: 2026-07-05
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Change Impact

Spec 032 modifies runtime ownership, MCP startup behavior, graph-store access,
freshness reporting, and diagnostics. Durable docs must be promoted before the
spec closes.

## Durable Source Mapping

Current durable sources:

- `docs/design/runtime-operations-design.md`: runtime ownership, warmup,
  freshness, async queues, and operational diagnostics.
- `docs/design/mcp-surface-design.md`: MCP launch, resources, tools, request
  routing, root authority, and response metadata.
- `docs/design/graph-store-design.md`: SQLite graph schema, snapshot freshness,
  graph transaction rules, and read/write behavior.
- `docs/reference/runtime-contracts.md`: response envelope vocabulary,
  freshness, analysis validity, verification status, and error classification.
- `docs/backlog/README.md`: EB036 planning record for this active spec.

## Proposed Changes

All proposed durable changes below were promoted on 2026-07-05.

## Promoted Changes

- `docs/design/runtime-operations-design.md` records per-repo daemon runtime
  ownership, local IPC identity, stale-owner cleanup rules, idle grace, proxy
  graph-backed requests, and failure-envelope mapping.
- `docs/design/mcp-surface-design.md` records daemon diagnostics on
  `integration:///health/agent-workbench` while keeping normal agent-facing
  resources compact.
- `docs/design/graph-store-design.md` records daemon-owned graph-store access,
  shared daemon graph-store factory behavior, and once-per-daemon startup
  warmup scheduling for packaged MCP launch.
- `docs/reference/runtime-contracts.md` records the optional daemon health
  contract and maps daemon/socket/graph-store failures to existing envelope
  vocabulary.
- `docs/backlog/README.md` marks EB036 promoted by Spec 032 with implementation
  and validation evidence.

## Promotion Targets

- `docs/design/runtime-operations-design.md`: accepted daemon lifecycle,
  ownership, diagnostics, and cleanup behavior.
- `docs/design/mcp-surface-design.md`: accepted client/proxy launch flow and
  request-routing behavior.
- `docs/design/graph-store-design.md`: accepted single-writer graph ownership
  and freshness behavior.
- `docs/reference/runtime-contracts.md`: any changed response-envelope or error
  classification contract.
- `docs/backlog/README.md`: EB036 marked promoted, completed, or routed to a
  precise follow-up destination.
- Dev CLI docs: only if T005 ships a command-line doctor/debug surface.

## Deferred Or Conditional Routes

- The doctor/debug surface landed in MCP integration health only. No dev CLI
  command or dev CLI docs shipped in Spec 032.
- If a contract shape changes beyond existing metadata enums, update
  `docs/reference/runtime-contracts.md` and the matching contract tests in the
  same implementation slice.
- If package install cleanup needs stale socket handling, route that work to a
  follow-up backlog item unless it is required to satisfy T002 stale cleanup.
