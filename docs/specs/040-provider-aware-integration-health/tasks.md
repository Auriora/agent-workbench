---
title: Provider-aware integration health tasks
doc_type: spec
artifact_type: tasks
status: draft
owner: platform
last_reviewed: 2026-07-19
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Tasks

## Task Dependency Graph

```text
T001 -> T002
T001 -> T003
T001 -> T004
T002 + T003 + T004 -> T005 -> T006 -> T007
```

## Phase 1: Contracts And Compatibility

- [ ] T001 Lock provider/profile/identity/health contracts and failing
  cross-client fixtures.
  - Depends on: none
  - Requirements: Requirement 1, Requirement 2, Requirement 3, Requirement 4,
    Requirement 5; Properties: CP-001-CP-005
  - Files: integration contracts/presenters; health/profile/resource tests;
    launcher/daemon test fixtures
  - Acceptance: Fixtures reproduce Claude-as-Codex, impossible static-resource
    inputs, unknown discovery, and unsplit identity while preserving legacy
    Codex output expectations.
  - Evidence mode: contract
  - Evidence: Pending.
  - [ ] T001.1 Define provider/common/current profile compatibility contracts.
  - [ ] T001.2 Define typed identity, provenance, and mismatch contracts.
  - [ ] T001.3 Lock static-resource and argument-bearing-tool discovery fixtures.

## Phase 2: Identity And Health Implementation

- [ ] T002 Extract the common binding/profile model and add the effective
  current profile.
  - Depends on: T001
  - Requirements: Requirement 1; Property: CP-001
  - Files: common profile/binding use cases, Codex compatibility use case,
    profile presenters/resources, registry metadata
  - Acceptance: Common registered surfaces no longer derive from Codex;
    existing Codex resource remains compatible; current profile reports the
    connection provider or unknown.
  - Evidence mode: implementation
  - Evidence: Pending.
  - [ ] T002.1 Extract provider-neutral bindings and shared profile fields.
  - [ ] T002.2 Retain the Codex projection and add current/effective projection.
  - [ ] T002.3 Prove unknown and Claude profiles do not inherit Codex labels.

- [ ] T003 Carry explicit provider/plugin evidence and initialize client
  evidence through per-connection composition.
  - Depends on: T001
  - Requirements: Requirement 2; Properties: CP-001, CP-002
  - Files: plugin configs/shims, stdio launch, daemon handshake/server factory,
    connection tests
  - Acceptance: Mixed clients on one daemon retain independent evidence;
    malformed/ambiguous metadata remains unknown; no provider state enters the
    shared daemon repository cache.
  - Evidence mode: implementation
  - Evidence: Pending.
  - [ ] T003.1 Define and validate the narrow launcher/daemon identity payload.
  - [ ] T003.2 Capture MCP initialize client application evidence separately.
  - [ ] T003.3 Add mixed-client and unknown-client daemon fixtures.

- [ ] T004 Correct static health semantics and add one argument-bearing health
  tool using the same application use case.
  - Depends on: T001
  - Requirements: Requirement 3; Property: CP-003
  - Files: integration health use case/presenter; resource and tool registries;
    contract/golden tests
  - Acceptance: Static reads expose only server-known evidence; caller
    discovery remains unknown without tool input; both paths share one health
    implementation and shared validation envelopes.
  - Evidence mode: implementation
  - Evidence: Pending.
  - [ ] T004.1 Remove unusable pseudo-arguments from static resource metadata.
  - [ ] T004.2 Add validated caller-discovery tool input and shared use-case call.
  - [ ] T004.3 Prove a health read does not imply caller discovery.

- [ ] T005 Add artifact-specific version identity, comparison, recovery
  guidance, and package drift validation.
  - Depends on: T002, T003, T004
  - Requirements: Requirement 4, Requirement 5; Properties: CP-004, CP-005
  - Files: integration contracts/use cases/presenters; runtime/package/plugin
    metadata; validator and packaging tests
  - Acceptance: Comparable observed Agent Workbench identities produce bounded
    provider recovery guidance; absent/non-comparable evidence stays unknown;
    validation rejects required metadata drift without network/update behavior.
  - Evidence mode: implementation
  - Evidence: Pending.
  - [ ] T005.1 Populate runtime, client, plugin, and cache identities with provenance.
  - [ ] T005.2 Implement pure comparable-version mismatch guidance.
  - [ ] T005.3 Extend plugin/package drift validation and negative fixtures.

## Phase 3: Validation And Promotion

- [ ] T006 Run focused, mixed-client, compatibility, package, and full
  validation.
  - Depends on: T005
  - Requirements: Requirement 1, Requirement 2, Requirement 3, Requirement 4,
    Requirement 5; Properties: CP-001-CP-005
  - Files: `verification.md`, relevant tests
  - Acceptance: Focused MCP/integration/daemon tests, typecheck, plugin/skill
    validation, pack dry-run, full tests, lifecycle lint, and diff checks pass
    or retain explicit blockers.
  - Evidence mode: validation
  - Evidence: Pending.
  - [ ] T006.1 Run focused contract, resource/tool, profile, launcher, and daemon suites.
  - [ ] T006.2 Run typecheck, plugin/skill validation, package dry-run, and full suite.
  - [ ] T006.3 Run lifecycle, architecture, Markdown, and diff checks.

- [ ] T007 Promote accepted profile, identity, health, and recovery behavior and
  prepare closure.
  - Depends on: T006
  - Requirements: Requirement 1, Requirement 2, Requirement 3, Requirement 4,
    Requirement 5
  - Files: coding-agent integration, MCP surface, runtime contracts, runbooks,
    plugin docs, changelog, backlog, and history
  - Acceptance: Durable docs match verified behavior, every residual has one
    destination, and lifecycle closure checks pass before package removal.
  - Evidence mode: validation
  - Evidence: Pending.
  - [ ] T007.1 Promote common/provider identity and honest health semantics.
  - [ ] T007.2 Promote operator recovery guidance and reconcile residuals.

## Execution Rules

- Read the full package and task traceability before implementation.
- Mark one implementation task `[~]` at a time and record concrete evidence.
- Keep provider logic at launch/interface/presentation boundaries and MCP
  adapters thin.
- Do not infer unavailable identity or add network/update/launcher fallbacks.

## Initial Reconciliation

The final initial design was reviewed against this task split on 2026-07-19.
T001 must lock compatibility and resolve the launcher-handshake field before
T002-T004 implementation begins.

## Related Artifacts

- Requirements: `requirements.md`
- Change impact: `change-impact.md`
- Design: `design.md`
- Traceability: `traceability.md`
- Verification: `verification.md`
