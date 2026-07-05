---
title: Trust calibration canonical context
doc_type: spec
artifact_type: canonical-context
status: active
owner: platform
last_reviewed: 2026-07-05
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Canonical Context

## Purpose

Define the working authority map for Spec 035 so design and implementation use
current durable contracts and source files, not backlog prose or historical
delivery records as proof.

## Authority Hierarchy

1. System, developer, and user instructions in the active session.
2. Repository instructions in `AGENTS.md`.
3. Runtime contract schemas in `src/contracts/`.
4. Current implementation and tests in `src/` and `tests/`.
5. Durable docs listed under imported sources.
6. This active spec's accepted artifacts.
7. Backlog and closed-spec history as routing or background evidence only.

## Always-Canonical External Sources

- Repository instructions in `AGENTS.md`.
- Runtime contract schemas in `src/contracts/`.
- Current implementation and tests in `src/` and `tests/`.
- System, developer, and user instructions in the active agent session.

## Spec-Canonical Working Sources

- `requirements.md`: accepted goals, non-goals, requirements, correctness
  properties, and open questions for Spec 035.
- `design.md`: accepted design decisions, policy model, data flow,
  implementation boundaries, and validation strategy for Spec 035.
- `tasks.md`: implementation sequence, dependencies, acceptance checks, and
  evidence placeholders for Spec 035.
- `traceability.md`: task-to-requirement, design, verification, correctness
  property, and durable-target mapping for Spec 035.
- `change-impact.md`: durable promotion targets and deferred routes for this
  spec.

## Imported Sources

- `docs/reference/runtime-contracts.md`
  - Import mode: summarized in `requirements.md`.
  - Canonical scope: current response metadata, evidence semantics,
    capability, freshness, analysis validity, and verification status
    vocabulary.
  - Promotion target: same document.
- `docs/design/mcp-surface-design.md`
  - Import mode: summarized in `requirements.md`.
  - Canonical scope: current MCP response behavior, routing caveats,
    presenter metadata composition, graph confidence, docs/search safety, and
    validation planning boundaries.
  - Promotion target: same document.
- `docs/reference/documentation-map.md`
  - Import mode: summarized in `requirements.md`.
  - Canonical scope: durable owner routing for runtime contracts, MCP design,
    and proof/fixture documentation.
  - Promotion target: same document if ownership changes.
- `docs/backlog/README.md#eb023-trust-calibration-in-tool-outputs`
  - Import mode: summarized in `requirements.md`.
  - Canonical scope: product signal, P0 priority, acceptance baseline, and
    active Spec 035 routing.
  - Promotion target: backlog EB023 status and promotion evidence.

## Promotion Map

- Trust calibration schema and vocabulary:
  `docs/reference/runtime-contracts.md`.
- Presenter policy and MCP surface behavior:
  `docs/design/mcp-surface-design.md`.
- Durable ownership routing changes:
  `docs/reference/documentation-map.md`.
- Backlog status and promotion evidence:
  `docs/backlog/README.md`.
- Source response contract changes:
  `src/contracts/runtime-response-contracts.ts`.
- Shared trust calibration policy:
  `src/application/use-cases/response-metadata.ts`.
- Presenter behavior changes:
  `src/presentation/`.
- Contract and golden test coverage:
  `tests/contracts/`, `tests/mcp/`, and `tests/docs/`.
- Closure evidence:
  `docs/history/spec-closure-log.md` and
  `docs/history/spec-archive-index.md`.

## Non-Canonical Background Sources

- Closed spec packages and closure-log entries are history only unless a later
  review explicitly imports a specific decision.
- Backlog items outside EB023 are sequencing context only unless requirements
  or design explicitly route a deferred item to them.
- Agent Workbench `context_for_task` output is routing evidence only. It helped
  identify relevant files, but it does not prove requirements completeness.

## Refresh Points

- Before design: re-read `requirements.md`, `change-impact.md`,
  `docs/reference/runtime-contracts.md`,
  `docs/design/mcp-surface-design.md`,
  `src/contracts/runtime-response-contracts.ts`, and
  `src/application/use-cases/response-metadata.ts`.
- Before tasks: review the accepted design and map each task to requirements
  and correctness properties.
- Before implementation: use Agent Workbench `context_for_task` for the
  selected task and verify any current source changes since the design stage.
