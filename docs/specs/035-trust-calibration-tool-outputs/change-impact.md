---
title: Trust calibration in tool outputs change impact
doc_type: spec
artifact_type: change-impact
status: active
owner: platform
last_reviewed: 2026-07-05
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Change Impact

Spec 035 is expected to add a shared trust-calibration contract to public Agent
Workbench response surfaces, with explicit exclusions where a surface is out of
scope for the first implementation slice. It affects response contracts, shared
metadata helpers, MCP presenter behavior, tests, and durable documentation.

## Durable Source Mapping

Current durable sources:

- `docs/reference/runtime-contracts.md`: owns response metadata, evidence
  semantics, capability levels, evidence kinds, freshness, analysis validity,
  verification status, and error vocabulary.
- `docs/design/mcp-surface-design.md`: owns MCP surface behavior, routing
  caveats, presenter metadata composition, docs/search safety, graph confidence,
  validation planning boundaries, and response budget behavior.
- `docs/reference/documentation-map.md`: owns durable routing for runtime
  contracts, MCP surface design, and proof/fixture documentation.
- `docs/backlog/README.md`: owns EB023 backlog signal and proposed acceptance
  until this active spec supersedes it for implementation.

## Proposed Changes

- Add or clarify a durable trust-calibration contract in
  `docs/reference/runtime-contracts.md`.
- Add or clarify MCP surface rules for trust calibration in
  `docs/design/mcp-surface-design.md`.
- Update `docs/reference/documentation-map.md` if ownership or routing changes.
- Mark EB023 as active, implemented, or closed in `docs/backlog/README.md`
  according to final outcome.
- Add or update source contracts and shared metadata policy in
  `src/contracts/runtime-response-contracts.ts` and
  `src/application/use-cases/response-metadata.ts`.
- Update affected presenters under `src/presentation/` and MCP registry
  metadata or tests where trust calibration is surfaced.
- Add contract and golden tests for trust calibration across major tool
  families.

## Promotion Targets

- `docs/reference/runtime-contracts.md`: accepted trust calibration schema,
  vocabulary, evidence semantics, and non-breaking migration notes.
- `docs/design/mcp-surface-design.md`: accepted presenter behavior, covered
  tool families, compactness expectations, and exclusions.
- `docs/reference/documentation-map.md`: routing updates if new durable owner
  text or proof gates are introduced.
- `docs/backlog/README.md`: EB023 status and promotion evidence.
- `src/contracts/runtime-response-contracts.ts`: source contract schema for
  additive trust calibration or the selected migration path.
- `src/application/use-cases/response-metadata.ts`: shared trust calibration
  derivation and policy inputs.
- `src/presentation/`: affected presenter output policy for covered surfaces.
- `tests/contracts/`, `tests/mcp/`, and `tests/docs/`: schema, golden response,
  and regression coverage for safe/unsafe/must-verify semantics.
- `docs/history/spec-closure-log.md` and `docs/history/spec-archive-index.md`:
  closure breadcrumb after implementation and durable promotion.

## Deferred Or Conditional Routes

- If design finds that executed-validation vocabulary needs migration beyond
  trust calibration, route that work to EB024 instead of expanding this spec.
- If broad review packets or proof bundle exports are needed, route those to
  EB030 or EB025 rather than expanding this spec.
- If a public MCP surface cannot support trust calibration in the first slice,
  record an explicit exclusion and follow-up destination in `tasks.md` and
  `verification.md`.
