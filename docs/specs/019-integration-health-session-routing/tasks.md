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

- [ ] T001 Decide contextual routing model.
  - Files: `docs/specs/019-integration-health-session-routing/design.md`,
    `docs/design/mcp-surface-design.md`
  - Acceptance: Design records stable router/startup/session/hybrid decision
    and explains hidden, unavailable, blocked, and available capabilities.
  - Evidence: Pending.

- [ ] T002 Add integration health contracts and fixtures.
  - Depends on: T001
  - Files: `src/contracts/`, `tests/mcp/`, `tests/integration/`
  - Acceptance: Contract supports configured, registered, advertised,
    discovered, callable, unavailable, blocked, and unknown states.
  - Evidence: Pending.

- [ ] T003 Implement integration health provider and MCP surface.
  - Depends on: T002
  - Files: `src/application/`, `src/presentation/`, `src/interface-adapters/mcp/`,
    `src/server.ts`, `tests/mcp/`
  - Acceptance: Health surface returns compact repo/session/runtime health
    without executing tools.
  - Evidence: Pending.

- [ ] T004 Add shared session-aware next-action presenter helper.
  - Depends on: T002
  - Files: `src/presentation/`, `tests/contracts/`, `tests/mcp/`
  - Acceptance: Helper filters callable actions, labels unavailable actions,
    and handles unknown session evidence conservatively.
  - Evidence: Pending.

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
