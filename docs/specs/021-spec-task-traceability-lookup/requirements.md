---
title: Spec task traceability lookup requirements
doc_type: spec
artifact_type: requirements
status: active
owner: platform
last_reviewed: 2026-06-09
---

# Requirements

## Introduction

Spec-driven work needs fast mapping from task IDs to requirements, design
sections, files, validation gates, open decisions, and closure requirements.
Agent Workbench should consume spec lifecycle context without taking ownership
of generic spec templates, Kiro-style workflow ownership, lifecycle governance,
task closure, reconciliation, or promotion.

## Durable Source Baseline

- [Agent Workbench executable backlog](../../requirements/agent-workbench-executable-backlog.md)
- [MCP surface design](../../design/mcp-surface-design.md)
- [Coding agent integration design](../../design/coding-agent-integration-design.md)
- Spec lifecycle manager skill and MCP are external collaborators.

## Goals

- Add Agent Workbench lookup support for active and archived spec packages.
- Route task IDs to authoritative spec-lifecycle-manager task context or
  traceability tools when available.
- Consume spec-lifecycle-manager preflight, task detail, validation plan,
  evidence quality, task-state audit, and closure-risk outputs as upstream
  context when those companion surfaces are discovered and callable.
- Provide bounded local routing evidence only when lifecycle tools are
  unavailable, with explicit non-authoritative labels.
- Connect spec context to Agent Workbench repo evidence, including files,
  symbols, impact, edit preview, diagnostics, and validation planning.
- Preserve the ownership boundary with spec-lifecycle-manager.

## Non-Goals

- Do not replace spec-lifecycle-manager.
- Do not add Kiro-style requirements, design, tasks, reconciliation, promotion,
  closure, or spec transition workflow ownership to Agent Workbench.
- Do not add Agent Workbench MCP tools that duplicate spec-lifecycle-manager
  `task_context`, `traceability_lookup`, `closure_check`, `reconcile_spec`, or
  promotion surfaces.
- Do not migrate archived specs.
- Do not rewrite spec packages automatically.
- Do not enforce generic spec templates in Agent Workbench.

## Requirements

### Requirement 1: Lifecycle Tool Handoff

**User Story:** As a coding agent, I want Agent Workbench to hand spec-driven
work to the lifecycle tool that owns spec semantics, so that implementation uses
authoritative task context without duplicating lifecycle behavior.

#### Acceptance Criteria

1. GIVEN a spec path or task ID, WHEN spec-lifecycle-manager MCP is available,
   THEN Agent Workbench SHALL route the agent to the authoritative
   `task_context` or `traceability_lookup` surface instead of duplicating the
   lifecycle lookup.
2. GIVEN companion outputs for lifecycle preflight, task detail, validation
   plan, evidence quality, task-state audit, or closure risk, WHEN those outputs
   are supplied or callable, THEN Agent Workbench SHALL use them as upstream
   task context before broad repo search.
3. WHERE spec-lifecycle-manager is unavailable, THE SYSTEM SHALL return bounded
   local routing evidence and label it as non-authoritative.
4. GIVEN archived specs, WHEN task context runs, THEN the system SHALL label
   them as historical delivery records and avoid suggesting migration, closure,
   or task-status changes.
5. IF a spec is malformed or missing artifacts, THEN the response SHALL return
   structured missing evidence rather than inventing traceability.
6. WHEN lifecycle context includes task-state, evidence-quality, or closure-risk
   findings, THEN Agent Workbench SHALL label them as lifecycle evidence and
   avoid converting them into task-status changes, closure decisions, or
   promotion actions.

### Requirement 2: Task Context Integration

**User Story:** As a coding agent, I want `context_for_task` to understand spec
task references, so that spec-driven implementation starts with the right docs
and files.

#### Acceptance Criteria

1. WHEN a task prompt mentions `Spec NNN` or `TNNN`, THEN task context SHALL
   route to the relevant spec artifacts where evidence exists.
2. WHERE spec-lifecycle-manager MCP is available, THE SYSTEM SHALL prefer its
   authoritative lifecycle reads or clearly label Agent Workbench local parsing.
3. WHEN spec lifecycle context identifies likely implementation files, THEN
   Agent Workbench SHALL connect that context to repo status, scope, symbols,
   impact, edit preview, diagnostics, and validation planning where those
   runtime surfaces have evidence.
4. WHEN lifecycle validation-plan evidence exists, THEN Agent Workbench SHALL
   join it to repository validation policy and verification planning without
   claiming that validation has been executed.
5. WHEN no spec evidence is found, THEN task context SHALL report missing
   evidence without blocking unrelated repo context.

### Requirement 3: Integration Boundary Visibility

**User Story:** As a maintainer, I want Agent Workbench to show whether the
companion lifecycle runtime is available, so that agents can tell the
difference between authoritative lifecycle context and local routing evidence.

#### Acceptance Criteria

1. GIVEN integration profile or health output, WHEN spec-lifecycle-manager
   configuration or discovery evidence exists, THEN the system SHALL report the
   companion lifecycle surface as configured, discovered, callable,
   unavailable, or unknown using existing integration-health semantics.
2. WHERE spec-lifecycle-manager is unavailable or unknown, THE SYSTEM SHALL
   avoid presenting lifecycle next actions as proven callable.
3. WHEN emitting Kiro Power or skill guidance, THEN Agent Workbench SHALL state
   that spec creation, reconciliation, task selection, traceability, promotion,
   closure checks, and spec transition hooks belong to spec-lifecycle-manager.

## Correctness Properties

- Active and archived specs must be distinguished.
- Missing artifacts must stay explicit.
- Agent Workbench must not own spec template governance.
- Agent Workbench must not duplicate spec-lifecycle-manager lifecycle tools,
  prompts, templates, or closure semantics.
- Traceability output must be bounded and repo-relative.
- Repo evidence and lifecycle evidence must be labeled separately.

## Success Criteria

- Fixture specs cover active, archived, malformed, and traceability-rich
  packages.
- Golden task-context responses route agents to spec-lifecycle-manager tools
  plus files and checks.
- Durable docs document the spec-lifecycle-manager boundary.
