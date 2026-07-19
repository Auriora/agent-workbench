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

- [x] T001 Lock provider/profile/identity/health contracts and failing
  cross-client fixtures.
  - Depends on: none
  - Requirements: Requirement 1, Requirement 2, Requirement 3, Requirement 4,
    Requirement 5; Properties: CP-001-CP-005
  - Files: integration contracts/presenters; health/profile/resource tests;
    launcher/daemon test fixtures
  - Acceptance: Fixtures reproduce Claude-as-Codex, impossible static-resource
    inputs, unknown discovery, and unsplit identity while preserving legacy
    Codex output expectations.
  - Evidence mode: validation
  - Evidence: Contract and fixture slice completed: profile/identity/health schemas plus static-resource, tool-input, Claude, unknown, and legacy Codex cases pass in the focused 65-test run.
  - Status: Selected after Spec 039 closure in the documented sequence.
  - [x] T001.1 Define provider/common/current profile compatibility contracts.
  - Evidence: src/contracts/runtime-integration-contracts.ts defines provider/common/current compatibility schemas; tests/mcp/integration-health-contract.test.ts passed. Focused provider-health validation passed in 5 files / 45 tests.
  - Evidence mode: validation
  - [x] T001.2 Define typed identity, provenance, and mismatch contracts.
  - Evidence: src/contracts/runtime-integration-contracts.ts defines four artifact identities, four evidence states, and six provenance values; contract parsing tests passed. Focused provider-health validation passed in 5 files / 45 tests.
  - Evidence mode: validation
  - [x] T001.3 Lock static-resource and argument-bearing-tool discovery fixtures.

  - Evidence: tests/mcp/integration-health-resource.test.ts covers static no-argument and bounded tool-input behavior; direct adapter tests passed. Focused provider-health validation passed in 5 files / 45 tests.
  - Evidence mode: validation
## Phase 2: Identity And Health Implementation

- [x] T002 Extract the common binding/profile model and add the effective
  current profile.
  - Depends on: T001
  - Requirements: Requirement 1; Property: CP-001
  - Files: common profile/binding use cases, Codex compatibility use case,
    profile presenters/resources, registry metadata
  - Acceptance: Common registered surfaces no longer derive from Codex;
    existing Codex resource remains compatible; current profile reports the
    connection provider or unknown.
  - Evidence mode: validation
  - Evidence: describe-current-integration-profile.ts and current-integration-profile.ts are registered; legacy/current profile tests passed in the 45-test focused run.
  - [x] T002.1 Extract provider-neutral bindings and shared profile fields.
  - Evidence: src/interface-adapters/mcp/registries/index.ts supplies the provider-neutral binding catalog and describe-current-integration-profile.ts composes shared fields; focused tests passed.
  - Evidence mode: validation
  - [x] T002.2 Retain the Codex projection and add current/effective projection.
  - Evidence: integration:///profiles/codex remains registered and integration:///profiles/current is added; server-card/profile synchronization tests passed.
  - Evidence mode: validation
  - [x] T002.3 Prove unknown and Claude profiles do not inherit Codex labels.

  - Evidence: tests/integration/codex-integration-profile.test.ts verifies Claude and unknown providers do not inherit Codex labels; focused tests passed.
  - Evidence mode: validation
- [x] T003 Carry explicit provider/plugin evidence and initialize client
  evidence through per-connection composition.
  - Depends on: T001
  - Requirements: Requirement 2; Properties: CP-001, CP-002
  - Files: plugin configs/shims, stdio launch, daemon handshake/server factory,
    connection tests
  - Acceptance: Mixed clients on one daemon retain independent evidence;
    malformed/ambiguous metadata remains unknown; no provider state enters the
    shared daemon repository cache.
  - Evidence mode: validation
  - Evidence: src/mcp/stdio-launch.ts, src/mcp/daemon.ts, and MCP server composition carry per-connection identity; 27 Claude/daemon integration tests passed.
  - [x] T003.1 Define and validate the narrow launcher/daemon identity payload.
  - Evidence: integrationLauncherIdentitySchema and the daemon handshake validate provider/plugin/cache fields; daemon launch tests passed in the 27-test slice.
  - Evidence mode: validation
  - [x] T003.2 Capture MCP initialize client application evidence separately.
  - Evidence: src/interface-adapters/mcp/server.ts captures SDK initialize client version separately from launcher evidence; entrypoint tests passed.
  - Evidence mode: validation
  - [x] T003.3 Add mixed-client and unknown-client daemon fixtures.

  - Evidence: tests/mcp/daemon-launch.test.ts and daemon-entrypoint-integration.test.ts cover mixed Codex/Claude and unknown connection identities; 27 tests passed.
  - Evidence mode: validation
- [x] T004 Correct static health semantics and add one argument-bearing health
  tool using the same application use case.
  - Depends on: T001
  - Requirements: Requirement 3; Property: CP-003
  - Files: integration health use case/presenter; resource and tool registries;
    contract/golden tests
  - Acceptance: Static reads expose only server-known evidence; caller
    discovery remains unknown without tool input; both paths share one health
    implementation and shared validation envelopes.
  - Evidence mode: validation
  - Evidence: The static integration health resource and integration_health tool share getIntegrationHealth; direct resource/tool adapter tests passed in the 45-test slice.
  - [x] T004.1 Remove unusable pseudo-arguments from static resource metadata.
  - Evidence: integrationHealthResource.metadata.parameters is empty and its test rejects pseudo-argument influence; focused tests passed.
  - Evidence mode: validation
  - [x] T004.2 Add validated caller-discovery tool input and shared use-case call.
  - Evidence: integration_health uses integrationHealthRequestSchema and getIntegrationHealth with connection identity; valid and oversized-input adapter tests passed.
  - Evidence mode: validation
  - [x] T004.3 Prove a health read does not imply caller discovery.

  - Evidence: tests/mcp/integration-health-resource.test.ts proves a static read leaves discovery unknown; focused tests passed.
  - Evidence mode: validation
- [x] T005 Add artifact-specific version identity, comparison, recovery
  guidance, and package drift validation.
  - Depends on: T002, T003, T004
  - Requirements: Requirement 4, Requirement 5; Properties: CP-004, CP-005
  - Files: integration contracts/use cases/presenters; runtime/package/plugin
    metadata; validator and packaging tests
  - Acceptance: Comparable observed Agent Workbench identities produce bounded
    provider recovery guidance; absent/non-comparable evidence stays unknown;
    validation rejects required metadata drift without network/update behavior.
  - Evidence mode: validation
  - Evidence: Runtime/plugin/cache identity and drift recovery are covered by contract/adapter tests, pnpm validate:plugin, and the 236-entry package dry-run; all passed.
  - [x] T005.1 Populate runtime, client, plugin, and cache identities with provenance.
  - Evidence: resolve-integration-identity.ts emits runtime, mcp_client, provider_plugin, and client_cache entries with provenance; focused tests passed.
  - Evidence mode: validation
  - [x] T005.2 Implement pure comparable-version mismatch guidance.
  - Evidence: tests/mcp/integration-health-contract.test.ts covers comparable Agent Workbench plugin/cache mismatch, matching versions, unrelated names, and excludes MCP client comparison; focused tests passed.
  - Evidence mode: validation
  - [x] T005.3 Extend plugin/package drift validation and negative fixtures.

  - Evidence: pnpm validate:plugin passed its Codex/Claude/Kiro metadata checks and negative Codex drift fixture; pnpm pack:dry-run passed with 236 entries.
  - Evidence mode: validation
## Phase 3: Validation And Promotion

- [x] T006 Run focused, mixed-client, compatibility, package, and full
  validation.
  - Depends on: T005
  - Requirements: Requirement 1, Requirement 2, Requirement 3, Requirement 4,
    Requirement 5; Properties: CP-001-CP-005
  - Files: `verification.md`, relevant tests
  - Acceptance: Focused MCP/integration/daemon tests, typecheck, plugin/skill
    validation, pack dry-run, full tests, lifecycle lint, and diff checks pass
    or retain explicit blockers.
  - Evidence mode: validation
  - Evidence: All verification.md gates passed: focused 45/65/27-test slices, typecheck, plugin/skill validators, 236-entry package dry-run, lifecycle lint, diff check, and 80-file/623-test full suite.
  - [x] T006.1 Run focused contract, resource/tool, profile, launcher, and daemon suites.
  - Evidence: Focused runs passed: 45 health/profile/Kiro/registry tests, 65 profile/launcher tests, and 27 Claude/daemon tests.
  - Evidence mode: validation
  - [x] T006.2 Run typecheck, plugin/skill validation, package dry-run, and full suite.
  - Evidence: pnpm typecheck, pnpm validate:plugin, pnpm validate:skills, pnpm pack:dry-run, and pnpm test passed; full suite was 80 files and 623 tests.
  - Evidence mode: validation
  - [x] T006.3 Run lifecycle, architecture, Markdown, and diff checks.

  - Evidence: Spec Lifecycle Manager lint returned 0 errors/warnings, Agent Workbench checked 12 edited Markdown files with no skips/tool errors, independent review findings were corrected, and git diff --check passed.
  - Evidence mode: validation
- [x] T007 Promote accepted profile, identity, health, and recovery behavior and
  prepare closure.
  - Depends on: T006
  - Requirements: Requirement 1, Requirement 2, Requirement 3, Requirement 4,
    Requirement 5
  - Files: coding-agent integration, MCP surface, runtime contracts, runbooks,
    plugin docs, changelog, backlog, and history
  - Acceptance: Durable docs match verified behavior, every residual has one
    destination, and lifecycle closure checks pass before package removal.
  - Evidence mode: validation
  - Evidence: Durable integration, MCP, contract, runbook, plugin, changelog, and backlog owners now match the 623-test verified behavior; history remains the lifecycle closure_apply destination.
  - [x] T007.1 Promote common/provider identity and honest health semantics.
  - Evidence: Promoted verified provider/current profiles, per-connection identity, and static/tool health semantics to docs/design/coding-agent-integration-design.md, docs/design/mcp-surface-design.md, and docs/reference/runtime-contracts.md.
  - Evidence mode: validation
  - [x] T007.2 Promote operator recovery guidance and reconcile residuals.

  - Evidence: Promoted recovery/install guidance to the runbook and plugin/Kiro docs; docs/backlog/README.md marks EB001 residual, EB040, and EB046 delivered by closed Spec 040 with no active next spec.
  - Evidence mode: validation
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
