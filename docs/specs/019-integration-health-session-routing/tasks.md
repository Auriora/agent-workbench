---
title: Integration health and session routing tasks
doc_type: spec
artifact_type: tasks
status: active
owner: platform
last_reviewed: 2026-06-06
---

# Tasks

## Task Dependency Graph

```text
T001 -> T002 -> T003 -> T004 -> T005 -> T006
```

- [x] T001 Decide contextual routing model.
  - Files: `docs/specs/019-integration-health-session-routing/design.md`,
    `docs/design/mcp-surface-design.md`
  - Acceptance: Design records stable router/startup/session/hybrid decision
    and explains hidden, unavailable, blocked, and available capabilities.
  - Evidence: Chose a conservative hybrid in `design.md` and promoted the
    routing decision to `docs/design/mcp-surface-design.md`: keep explicit
    startup registration, add stable integration-health state, use shared
    session-aware next-action filtering, and defer generic dynamic invocation.

- [x] T002 Add integration health contracts and fixtures.
  - Depends on: T001
  - Files: `src/contracts/`, `tests/mcp/`, `tests/integration/`
  - Acceptance: Contract supports configured, registered, advertised,
    discovered, callable, unavailable, blocked, and unknown states.
  - Evidence: Added `integrationHealthSchema`,
    `integrationSurfaceHealthSchema`, session evidence, caller discovery, and
    callable-state contracts in `src/contracts/runtime-contracts.ts`; added
    contract and MCP fixture tests in
    `tests/contracts/runtime-contracts.test.ts` and
    `tests/mcp/integration-health-contract.test.ts`.
  - Evidence: Validation passed with focused contract/MCP/profile tests and
    `pnpm typecheck`.

- [x] T003 Implement integration health provider and MCP surface.
  - Depends on: T002
  - Files: `src/application/`, `src/presentation/`, `src/interface-adapters/mcp/`,
    `src/server.ts`, `tests/mcp/`
  - Acceptance: Health surface returns compact repo/session/runtime health
    without executing tools.
  - Evidence: Added `getIntegrationHealth`, integration health presenter,
    `integration:///health/agent-workbench` MCP resource, composed-server
    wiring, profile/registry alignment updates, and MCP resource tests.
    Validation passed with focused contract/MCP/profile tests and
    `pnpm typecheck`.

- [x] T004 Add shared session-aware next-action presenter helper.
  - Depends on: T002
  - Files: `src/presentation/`, `tests/contracts/`, `tests/mcp/`
  - Acceptance: Helper filters callable actions, labels unavailable actions,
    and handles unknown session evidence conservatively.
  - Evidence: Added `sessionAwareNextActions` in
    `src/presentation/metadata.ts` with callable filtering, unavailable action
    labels, and unknown-discovery assumptions while preserving existing
    `capNextActions` behavior. Validation passed with focused presentation,
    contract, and integration-health tests plus `pnpm typecheck`.

- [ ] T005 Apply helper to public presenters.
  - Depends on: T004
  - Files: `src/presentation/`, `src/application/use-cases/`,
    `tests/mcp/`, `tests/docs/`, `tests/graph/`
  - Acceptance: Golden responses for context, docs, symbols, references,
    impact, diagnostics, verification, and integration profile do not present
    unavailable tools as executable.
  - Evidence: Pending.

- [ ] T006 Promote docs, validate, and close.
  - Depends on: T003, T005
  - Files: `docs/design/mcp-surface-design.md`,
    `docs/design/coding-agent-integration-design.md`,
    `docs/reference/documentation-map.md`,
    `docs/specs/019-integration-health-session-routing/`
  - Acceptance: Durable docs describe health/routing behavior and validation
    passes before archival.
  - Evidence: Pending.
