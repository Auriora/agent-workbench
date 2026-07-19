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

Define the authoritative repository evidence and promotion route for Spec 041
without treating the temporary package as enduring product documentation.

## Intake

- Source: EB052 in `docs/backlog/README.md`.
- Priority: P0 under EB003 first-read reliability.
- User-confirmed purpose: create Spec 041 to make daemon-owned refresh converge
  after deleted indexed paths are detected.
- Accepted prerequisites: EB036 daemon ownership, closed Spec 039 snapshot path
  validity, and closed Spec 040 provider-aware integration health.

## Repository Truth

- `src/mcp/daemon.ts` shares a graph-store factory across connections.
- `src/server.ts` constructs an `InMemoryRuntimeOperationsAdapter` per server.
- The daemon grants startup warm-up scheduling to only the first connection.
- A later connection can create private planned refresh state but cannot start
  its worker.
- Current daemon health is derived from a startup boolean and hard-coded
  unknown graph freshness rather than shared execution/snapshot authority.
- Existing standalone status tests prove deletion-triggered refresh only within
  one server instance; they do not prove package-entrypoint daemon behavior.

## Authority Hierarchy

| Concern | Canonical owner |
| --- | --- |
| Daemon, warm-up, refresh, queue, and lifetime ownership | `docs/design/runtime-operations-design.md` |
| Snapshot/store publication and reader atomicity | `docs/design/graph-store-design.md` |
| Health, freshness, failure, and trust vocabulary | `docs/reference/runtime-contracts.md` |
| MCP resource/tool presentation | `docs/design/mcp-surface-design.md` |
| Enduring runtime behavior | `docs/requirements/runtime-requirements.md` |
| Fixture proof obligations | `docs/reference/mvp-proof-matrix.md` |
| Intake and delivery status | `docs/backlog/README.md` |

## Always-Canonical External Sources

None. This slice depends on repository code, tests, durable docs, and local
package-entrypoint evidence; it does not import a remote standard or API.

## Spec-Canonical Working Sources

The seven artifacts in this directory jointly govern implementation while the
spec is active. `requirements.md` owns observable acceptance, `design.md` owns
the single path, and `tasks.md` plus `verification.md` own delivery evidence.

## Imported Sources

- EB052 and the 2026-07-19 dogfood ledger provide defect intake.
- Closed Specs 039 and 040 provide accepted prerequisite decisions.
- Imported evidence is summarized without restoring closed packages as active.

## Non-Canonical Background Sources

Interactive Claude/Codex transcripts and installed-runtime observations are
reproduction evidence, not contract authority. They must be converted into
fixture or durable evidence before closure claims.

## Promotion Map

| Spec truth | Durable destination |
| --- | --- |
| daemon controller and lifetime semantics | `docs/design/runtime-operations-design.md` |
| atomic snapshot/query recovery | `docs/design/graph-store-design.md` |
| canonical health/failure values | `docs/reference/runtime-contracts.md` |
| public presentation changes, if any | `docs/design/mcp-surface-design.md` |
| enduring behavior and proof | runtime requirements and MVP proof matrix |
| delivery and closure | backlog, changelog, and closure history |

## Guardrails

- One explicit controller and executor path.
- No manual refresh tool, retry loop, provider-specific branch, alternate
  indexer, partial-result fallback, or raw adapter leakage.
- MCP reads remain bounded and do not synchronously perform broad warm-up.
- Generated `.cache/` state is never committed.
- EB014 large-repository completion remains separate.

## Evidence Limits

This package is an implementation plan. Current coverage is pending. Closed
specs and durable docs establish accepted boundaries but do not prove Spec 041
implementation or live daemon convergence.
