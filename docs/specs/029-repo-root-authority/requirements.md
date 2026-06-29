---
title: Repo-root authority requirements
doc_type: spec
artifact_type: requirements
status: active
owner: platform
last_reviewed: 2026-06-18
---

# Requirements

## Introduction

Agent Workbench is launched for a repository, but many MCP surfaces currently
accept a caller-provided `repo_root`. That parameter is useful for local debug
and diagnostics, but it weakens the normal agent safety boundary when exposed
as a public option. Normal agent-facing resources and tools should be anchored
to the launched repository. Alternate roots are allowed only for this project
through an explicit debug gate.

## Durable Source Baseline

- [Workspace safety contract](../../reference/workspace-safety-contract.md)
- [MCP surface design](../../design/mcp-surface-design.md)
- [Runtime operations design](../../design/runtime-operations-design.md)
- [Agent Workbench threat model](../../security/threat-model.md)
- `src/server.ts`
- `src/interface-adapters/mcp/registries/`
- `src/mcp/stdio-launch.ts`

## Goals

- Make the launched repository root the default and only normal agent-facing
  root.
- Hide or reject `repo_root` overrides outside debug/diagnostics mode.
- Keep project-local debug tooling able to target arbitrary repositories when
  explicitly enabled.
- Report root policy in diagnostic or integration health surfaces without
  advertising unsafe parameters to ordinary agents.

## Non-Goals

- Do not remove repo-targeted debug harnesses used by Agent Workbench maintainers.
- Do not create multi-repo public runtime support in this spec.
- Do not add fallback roots, implicit parent searches, or automatic allowlists.

## Requirements

### Requirement 1: Normal Surfaces Use The Launch Root

**User Story:** As a normal coding agent, I want Workbench tools to be anchored
to the launched repository, so that a confused or compromised agent cannot move
the runtime boundary by passing a different root.

#### Acceptance Criteria

1. GIVEN a normal MCP resource or tool, WHEN the caller omits `repo_root`, THEN
   THE SYSTEM SHALL use the launch root.
2. GIVEN a normal MCP resource or tool, WHEN the caller provides `repo_root`,
   THEN THE SYSTEM SHALL reject the override unless debug root override mode is
   enabled.
3. WHEN the override is rejected, THEN THE SYSTEM SHALL return a structured
   blocked or invalid-input envelope instead of silently using the alternate
   root.

### Requirement 2: Debug Root Override Is Explicit And Hidden

**User Story:** As an Agent Workbench maintainer, I want root override
available only through an explicit debug gate, so that diagnostics can still
exercise external repositories without exposing that capability broadly.

#### Acceptance Criteria

1. GIVEN Agent Workbench starts without debug root override configuration, THEN
   THE SYSTEM SHALL NOT advertise `repo_root` parameters in normal tool or
   resource metadata.
2. GIVEN debug root override mode is enabled by a hidden parameter flag or
   environment variable, WHEN a request includes `repo_root`, THEN THE SYSTEM
   MAY allow it if it passes the configured debug policy.
3. WHERE debug mode is enabled, THE SYSTEM SHALL mark root override capability
   as debug-only in integration health or doctor output.
4. IF the override is not configured, malformed, or outside the debug policy,
   THEN THE SYSTEM SHALL return a structured blocked result.

### Requirement 3: Debug Override Scope Is This Project Only

**User Story:** As a maintainer, I want debug override support to be scoped to
Agent Workbench development, so that integration packages for other agents do
not learn or repeat the parameter.

#### Acceptance Criteria

1. GIVEN generated Codex, Claude Code, Kiro, or common integration artifacts,
   WHEN they describe Workbench usage, THEN they SHALL omit normal `repo_root`
   override guidance.
2. WHEN debug diagnostics mention alternate roots, THEN the wording SHALL state
   that the feature is maintainer/debug-only.
3. IF a public next action or prompt references `repo_root`, THEN tests SHALL
   fail unless the surface is explicitly classified as debug.

## Correctness Properties

- **P1 Root immutability:** For normal surfaces, effective repository root is
  always equal to the launch root regardless of request payload.
- **P2 Debug explicitness:** Alternate roots are usable only when a debug gate
  is enabled and observable in debug health output.
- **P3 No public leakage:** Normal integration artifacts and next actions do
  not advertise root override parameters.

## Success Criteria

- Normal MCP schemas and generated integration guidance no longer surface
  `repo_root`.
- Requests that include `repo_root` in normal mode receive a structured blocked
  response.
- Debug override mode is explicit, hidden from normal agents, and covered by
  tests.
