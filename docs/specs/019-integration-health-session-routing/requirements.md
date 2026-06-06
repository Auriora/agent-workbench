---
title: Integration health and session routing requirements
doc_type: spec
artifact_type: requirements
status: active
owner: platform
last_reviewed: 2026-06-06
---

# Requirements

## Introduction

Agents saw mismatches between configured, advertised, discovered, and callable
MCP surfaces. They also followed `next_actions` for tools that were unavailable
in the active session. This spec promotes EB001, EB002, and EB011 into one
implementation package because integration health, session-aware next actions,
and contextual routing are tightly coupled.

## Durable Source Baseline

- [Agent Workbench executable backlog](../../requirements/agent-workbench-executable-backlog.md)
- [MCP surface design](../../design/mcp-surface-design.md)
- [Coding agent integration design](../../design/coding-agent-integration-design.md)
- [Runtime contracts](../../reference/runtime-contracts.md)

## Goals

- Add an integration-health packet that distinguishes configured, registered,
  advertised, discovered, callable, unavailable, and blocked surfaces.
- Make `next_actions` session-aware so executable follow-ups only name callable
  tools and readable resources.
- Decide the contextual routing shape: one stable router, startup-time
  registration, session-time registration, or a hybrid.

## Non-Goals

- Do not hide advanced tools without a discoverable explanation.
- Do not add a second MCP runtime path or plugin-provided copied server.
- Do not execute tools from the health packet.
- Do not implement language-specific semantic promotion in this spec.

## Requirements

### Requirement 1: Integration Health Packet

**User Story:** As a coding agent, I want to know which Agent Workbench MCP
surfaces are actually callable in this session, so that I do not follow stale
or unavailable next actions.

#### Acceptance Criteria

1. GIVEN configured MCP surfaces, WHEN integration health is requested, THEN
   the system SHALL report configured, registered, advertised, and callable
   resources/tools where evidence exists.
2. WHEN a surface is unavailable, THEN the system SHALL report a reason such as
   not registered, not discovered, blocked by runtime state, unsupported by repo
   shape, or unavailable in the active client session.
3. IF caller-discovered tool evidence is not available, THEN the system SHALL
   label the discovery state unknown instead of assuming all registered tools
   are callable.

### Requirement 2: Session-Aware Next Actions

**User Story:** As a coding agent, I want next actions to reflect my active
tool surface, so that runtime guidance does not send me to missing tools.

#### Acceptance Criteria

1. GIVEN session capability evidence, WHEN a presenter emits `next_actions`,
   THEN executable actions SHALL only include callable tools or readable
   resources.
2. IF a useful action is unavailable, THEN the response SHALL include a compact
   unavailable action or caveat with missing evidence rather than presenting it
   as executable.
3. WHERE no session evidence exists, THE SYSTEM SHALL prefer conservative next
   actions and label callable-state assumptions.

### Requirement 3: Contextual Tool Routing Decision

**User Story:** As a maintainer, I want a documented contextual routing model,
so that the public MCP surface can become easier for agents without losing
specialized capabilities.

#### Acceptance Criteria

1. WHEN the design closes, THEN it SHALL choose one of: stable router tool,
   startup-time tool shaping, session-time tool shaping, or a documented
   hybrid.
2. The chosen model SHALL explain hidden, available, unavailable, and blocked
   capabilities for the current repo/task/session.
3. The model SHALL preserve a way to ask why a tool is hidden or what evidence
   would make it available.

## Correctness Properties

- Health and routing outputs must be read-only.
- Unknown caller discovery must not be treated as positive callable evidence.
- Next actions must not name unavailable tools as executable.
- Contextual routing decisions must be deterministic for the same repo, task,
  runtime state, and session evidence.

## Success Criteria

- Golden MCP responses prove full, partial, unknown, and unavailable sessions.
- Presenters suppress or label unavailable next actions consistently.
- The Codex integration profile matches registered public MCP tools.
