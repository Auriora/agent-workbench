---
title: Agent IDE capability analysis requirements
doc_type: spec
artifact_type: requirements
status: active
owner: platform
last_reviewed: 2026-06-05
---

# Requirements

## Introduction

This spec creates a detailed analysis plan for the predecessor
`agent-ide`/Python Agent IDE runtime. The goal is not to reuse Python-specific
implementation code. The goal is to identify which workflows, tool contracts,
runtime behaviors, feedback loops, and operational lessons worked effectively
there, determine which have already been implemented in Agent Workbench, and
turn remaining useful gaps into durable roadmap items or follow-up specs.

Agent Workbench is intended to replace `agent-ide` as the language-neutral
local IDE runtime for coding agents. Python may remain an important comparison
adapter, but the runtime, MCP surface, graph model, validation planning,
presentation, telemetry, hooks, and integration guidance must work across
languages, frameworks, infrastructure systems, and repository shapes.

## Durable Source Baseline

- Product rationale:
  [Agent IDE restart concept](../../design/agent-ide-restart-concept.md)
- MCP surface direction:
  [MCP surface design](../../design/mcp-surface-design.md)
- Language-neutral adapter direction:
  [Language adapter design](../../design/language-adapter-design.md)
- Runtime architecture:
  [Layered runtime architecture](../../design/layered-runtime-architecture.md)
- Existing replacement research:
  [Spec 001 research](../001-agent-ide-runtime/research.md)
- Current documentation index:
  [Documentation map](../../reference/documentation-map.md)

## Goals

- Build a structured inventory of `agent-ide` resources, tools, hooks, skills,
  diagnostics, validation paths, runtime status surfaces, cache behavior,
  telemetry, and edit-loop feedback.
- Classify each capability by user value, observed usage, implementation
  maturity, language specificity, and portability to Agent Workbench.
- Reconcile the inventory against Agent Workbench specs, durable backlog,
  roadmap, and implemented behavior.
- Identify reusable product lessons without copying Python-specific
  implementation assumptions.
- Create or update follow-up specs for high-value gaps that fit the
  language-neutral replacement direction.

## Non-Goals

- Do not port `agent-ide` Python implementation modules directly.
- Do not introduce Python-only contracts, response fields, runtime states, or
  validation assumptions into Agent Workbench.
- Do not expand the public MCP surface only for parity. Add or recommend tools
  only when the analysis proves agent workflow value.
- Do not implement the resulting capability gaps in this spec unless the task
  is documentation-only.
- Do not make `agent-ide` the canonical source of truth for future behavior;
  durable Agent Workbench docs remain authoritative after reconciliation.

## Requirements

### Requirement 1: Capability Inventory

**User Story:** As a platform maintainer, I want a complete capability inventory
of `agent-ide`, so that replacement planning is based on concrete behavior
rather than memory or isolated dogfood notes.

#### Acceptance Criteria

1. GIVEN the local `agent-ide` repository is available, WHEN the analysis runs,
   THEN the system SHALL inspect its documented tools, resources, hooks, skills,
   commands, telemetry docs, cache/runtime docs, and relevant tests.
2. GIVEN an `agent-ide` capability is found, WHEN it is recorded, THEN the
   inventory SHALL capture its purpose, agent-facing contract, observed or
   documented usage, dependencies, and known failure modes.
3. IF a capability is Python-specific, THEN the analysis SHALL separate the
   product lesson from the implementation mechanism.
4. IF a capability has no clear user value or usage evidence, THEN the analysis
   SHALL record it as low priority rather than promoting it for parity.

### Requirement 2: Agent Workbench Reconciliation

**User Story:** As a maintainer, I want each useful `agent-ide` capability
mapped to Agent Workbench status, so that the roadmap shows what is already
implemented, active, planned, deferred, or rejected.

#### Acceptance Criteria

1. GIVEN the inventory is complete, WHEN it is reconciled, THEN every useful
   capability SHALL be classified as implemented, active spec, backlog,
   proposed spec, deferred, or rejected.
2. GIVEN an Agent Workbench spec already covers a capability, WHEN the mapping
   is recorded, THEN the analysis SHALL link to the relevant spec and avoid
   creating duplicate work.
3. GIVEN durable docs already describe implemented behavior, WHEN the mapping is
   recorded, THEN the analysis SHALL reference the durable doc instead of
   treating the archived delivery spec as the source of truth.
4. IF a capability conflicts with the language-neutral architecture, THEN the
   analysis SHALL document the conflict and propose an architecture-compatible
   alternative or rejection.

### Requirement 3: Tool Surface Recommendations

**User Story:** As a coding agent user, I want Agent Workbench to expose the
right tools for everyday coding loops, so that it replaces `agent-ide` without
becoming noisy, Python-shaped, or bloated.

#### Acceptance Criteria

1. GIVEN a candidate tool or resource from `agent-ide`, WHEN it is recommended,
   THEN the recommendation SHALL include workflow value, input/output contract
   shape, likely presenter behavior, validation evidence needed, and language
   neutrality constraints.
2. GIVEN a candidate workflow can be handled by an existing Agent Workbench tool,
   WHEN the recommendation is made, THEN the analysis SHALL prefer improving
   that existing tool over adding a new public MCP tool.
3. WHERE a capability needs language-specific evidence, THE SYSTEM SHALL route
   that evidence through adapter/provider contracts and shared response
   envelopes rather than adding language-specific MCP fields.
4. IF a capability would require broad or expensive analysis, THEN the
   recommendation SHALL specify whether it belongs in explicit orientation,
   background warmup, planned validation, or a deferred report surface.

### Requirement 4: Roadmap and Spec Creation

**User Story:** As a project planner, I want the analysis to feed the backlog
and active specs, so that the replacement work becomes executable rather than a
loose comparison document.

#### Acceptance Criteria

1. GIVEN high-priority gaps are identified, WHEN the analysis completes, THEN
   the system SHALL create or update follow-up specs for coherent implementation
   slices.
2. GIVEN lower-priority gaps remain, WHEN the analysis completes, THEN the
   system SHALL update durable backlog or roadmap docs with the reason and
   expected evidence needed for promotion.
3. GIVEN existing active specs cover part of the replacement path, WHEN the
   analysis completes, THEN the system SHALL update their context only when it
   reduces ambiguity and does not change scope unexpectedly.
4. IF the analysis finds completed behavior that only exists in archived specs,
   THEN the system SHALL identify durable documentation promotion work.

## Correctness Properties

- Each recommended capability must trace to an observed `agent-ide` behavior,
  existing dogfood feedback, durable design goal, or explicit user need.
- No recommendation may depend on Python-specific implementation code as the
  only viable path.
- Public MCP tool additions must be justified by workflow value, not parity.
- Existing Agent Workbench specs and durable docs must not be duplicated.
- All follow-up work must preserve language-neutral contracts and capability
  labels.

## Success Criteria

- A durable analysis artifact summarizes `agent-ide` capabilities, Agent
  Workbench status, gaps, and priorities.
- The roadmap/backlog reflects replacement work in a language-neutral order.
- High-value gaps are promoted into active or proposed specs with clear
  acceptance criteria.
- The result gives a practical path for Agent Workbench to replace `agent-ide`
  across languages rather than as a Python-only successor.
