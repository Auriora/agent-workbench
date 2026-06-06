---
title: Plugin discoverability and drift hardening requirements
doc_type: spec
artifact_type: requirements
status: active
owner: platform
last_reviewed: 2026-06-06
---

# Requirements

## Introduction

Agent Workbench now installs through a Codex plugin that bundles skill
guidance, hooks, and MCP configuration. Comparison with Alcove and Codebase
Recon shows useful next steps: make the plugin easier to discover and install,
publish machine-readable MCP metadata, prevent skill and docs drift from the
actual MCP registry, improve first-run operator guidance, and harden CI around
plugin/package correctness.

## Durable Source Baseline

- [Codex Agent Workbench plugin and MCP setup](../../runbooks/codex-agent-workbench-plugin.md)
- [Coding agent integration design](../../design/coding-agent-integration-design.md)
- [MCP surface design](../../design/mcp-surface-design.md)
- [Observability and debugging design](../../design/observability-debugging-design.md)
- [Runtime contracts](../../reference/runtime-contracts.md)
- [Documentation map](../../reference/documentation-map.md)

## External Reference Baseline

- [Research notes](research.md)
- Alcove: <https://github.com/epicsagas/alcove>
- Codebase Recon Skill: <https://github.com/yujiachen-y/codebase-recon-skill>

## Goals

- Add repo-level plugin marketplace metadata where appropriate.
- Add MCP discoverability metadata such as a server card, with drift checks.
- Add tests that detect drift between plugin skill guidance, default prompts,
  integration profiles, durable docs, and actual MCP registry surfaces.
- Improve plugin README and runbook first-run, update, verification, and
  uninstall guidance.
- Add CI gates for plugin validation, installer dry-run, package manifest
  consistency, and normal TypeScript/Vitest validation.
- Preserve external-plugin references for deeper analysis during
  implementation.

## Non-Goals

- Do not add network-install or auto-update behavior to plugin hooks.
- Do not make plugin hooks perform setup repair.
- Do not add a new public history-recon MCP tool until command-execution
  boundaries are explicitly designed.
- Do not replace the MCP runtime with plugin-cache runtime code.
- Do not broaden target-repo command execution in the MCP tool sweep.

## Requirements

### Requirement 1: Repo-Level Plugin Discoverability

**User Story:** As an Agent Workbench user, I want plugin marketplace metadata
to be available in the repository, so that I can inspect and install the
plugin using standard Codex marketplace flows.

#### Acceptance Criteria

1. GIVEN the repository checkout, WHEN a maintainer inspects plugin metadata,
   THEN the system SHALL expose a repo-level marketplace entry for
   `agent-workbench` or document why installer-owned personal marketplace
   creation remains the selected model.
2. IF a repo-level marketplace is added, THEN it SHALL point at the checked-in
   plugin source with the correct policy, category, and display metadata.
3. WHEN `codex plugin list` is used after installation, THEN
   `agent-workbench` SHALL appear as installed and enabled from the intended
   marketplace.
4. IF repo-level marketplace metadata is not added, THEN the runbook SHALL
   include the exact installer-owned marketplace behavior and verification
   commands.

### Requirement 2: MCP Discoverability Metadata

**User Story:** As an integrator, I want a machine-readable MCP server card,
so that Agent Workbench tools and resources can be discovered outside the
Codex session.

#### Acceptance Criteria

1. GIVEN the current MCP registry, WHEN discoverability metadata is generated
   or validated, THEN every public MCP tool and resource SHALL be represented
   or explicitly excluded with a reason.
2. WHERE a server card or equivalent metadata file is added, THE SYSTEM SHALL
   include stable names, descriptions, capability class, and privacy/locality
   expectations.
3. WHEN MCP registry entries change, THEN tests SHALL fail if the metadata is
   stale.
4. The metadata SHALL NOT claim support for tools, prompts, resources, or
   protocols that are not registered by Agent Workbench.

### Requirement 3: Skill, Prompt, And Documentation Drift Tests

**User Story:** As a maintainer, I want automated drift checks between
published guidance and actual runtime surfaces, so that plugin instructions do
not mislead agents.

#### Acceptance Criteria

1. GIVEN the MCP resource and tool registries, WHEN tests run, THEN the
   `agent-workbench` skill SHALL mention only supported canonical workflows or
   approved generic categories.
2. GIVEN plugin default prompts, WHEN tests run, THEN each prompt SHALL map to
   at least one active resource, tool, or documented workflow.
3. GIVEN `integration:///profiles/codex`, WHEN tests run, THEN its MCP binding
   list SHALL match the registered resources and tools.
4. GIVEN durable MCP docs, WHEN registry names change, THEN a focused test or
   metadata check SHALL identify stale names or missing entries.

### Requirement 4: First-Run And Operator Guidance

**User Story:** As an operator, I want clear install, update, verify, hook
trust, and uninstall instructions, so that I can recover from plugin setup
problems without reading implementation code.

#### Acceptance Criteria

1. WHEN reading the plugin README, THEN a user SHALL see quick install,
   verification, update, and uninstall paths.
2. WHEN reading the runbook, THEN maintainers SHALL see the relationship among
   package install, marketplace entry, plugin cache, MCP config, hooks, and
   hook trust review.
3. IF the installed package launcher is missing, THEN docs SHALL point to an
   explicit reinstall or doctor command rather than suggesting hook-based
   repair.
4. Documentation SHALL distinguish user-facing quick start from maintainer
   release and package validation steps.

### Requirement 5: CI And Package Validation

**User Story:** As a maintainer, I want CI to validate plugin and package
integrity, so that broken plugin metadata or installer behavior cannot land
silently.

#### Acceptance Criteria

1. WHEN CI runs, THEN it SHALL run `pnpm typecheck` and `pnpm test`.
2. WHEN CI runs, THEN it SHALL validate the Codex plugin manifest and required
   companion files.
3. WHEN CI runs, THEN it SHALL run the package installer in dry-run mode.
4. WHEN dependencies or package metadata change, THEN CI SHALL validate package
   manifest consistency.
5. IF dependency audit or SBOM generation is added, THEN the output SHALL be
   documented and bounded to repository/package dependencies.

### Requirement 6: History Reconnaissance Decision

**User Story:** As a maintainer, I want a clear decision on repository history
reconnaissance, so that useful Codebase Recon ideas are either incorporated
responsibly or explicitly deferred.

#### Acceptance Criteria

1. GIVEN the Codebase Recon reference, WHEN design is finalized, THEN the spec
   SHALL decide whether history reconnaissance belongs in MCP, a debug command,
   a skill workflow, or a follow-up spec.
2. IF history reconnaissance is included, THEN it SHALL respect current
   command-execution boundaries and disclose that it uses git history as local
   evidence.
3. IF history reconnaissance is deferred, THEN the task list SHALL preserve a
   follow-up backlog item with rationale.

## Correctness Properties

- Plugin metadata must not advertise surfaces absent from the MCP registry.
- Plugin hooks must remain quiet and must not perform network installation or
  setup repair.
- Marketplace metadata must resolve to the intended plugin source.
- Server-card metadata must remain synchronized with registered MCP surfaces.
- Installer dry-runs must not mutate user config, package roots, or plugin
  sources.
- Guidance docs must distinguish plugin cache, installed package prefix, and
  repository checkout.

## Success Criteria

- Plugin install/discovery flow is documented and testable.
- MCP discoverability metadata exists or a documented decision explains why it
  is deferred.
- Drift tests fail on stale skill, prompt, profile, or metadata claims.
- README/runbook guidance covers install, verify, update, uninstall, and hook
  trust.
- CI covers plugin validation and package installer dry-run.
- The Alcove and Codebase Recon references remain linked for future analysis.
