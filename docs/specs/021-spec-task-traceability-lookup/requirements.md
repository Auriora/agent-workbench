---
title: Spec task traceability lookup requirements
doc_type: spec
artifact_type: requirements
status: active
owner: platform
last_reviewed: 2026-06-06
---

# Requirements

## Introduction

Spec-driven work needs fast mapping from task IDs to requirements, design
sections, files, validation gates, open decisions, and closure requirements.
Agent Workbench should consume spec lifecycle context without taking ownership
of generic spec templates or lifecycle governance.

## Durable Source Baseline

- [Agent Workbench executable backlog](../../requirements/agent-workbench-executable-backlog.md)
- [MCP surface design](../../design/mcp-surface-design.md)
- [Coding agent integration design](../../design/coding-agent-integration-design.md)
- Spec lifecycle manager skill and MCP are external collaborators.

## Goals

- Add Agent Workbench lookup support for active and archived spec packages.
- Route task IDs to related requirements, design, files, validation gates, and
  closure evidence.
- Preserve the ownership boundary with spec-lifecycle-manager.

## Non-Goals

- Do not replace spec-lifecycle-manager.
- Do not migrate archived specs.
- Do not rewrite spec packages automatically.
- Do not enforce generic spec templates in Agent Workbench.

## Requirements

### Requirement 1: Traceability Lookup

**User Story:** As a coding agent, I want task-level traceability context, so
that implementation follows requirements and closure evidence instead of task
text alone.

#### Acceptance Criteria

1. GIVEN a spec path and task ID, WHEN lookup runs, THEN the system SHALL return
   related task text, requirements, acceptance criteria, design sections,
   files, validation gates, and closure requirements where present.
2. GIVEN archived specs, WHEN lookup runs, THEN the system SHALL label them as
   historical delivery records and avoid suggesting migration.
3. IF a spec is malformed or missing artifacts, THEN the response SHALL return
   structured missing evidence rather than inventing traceability.

### Requirement 2: Task Context Integration

**User Story:** As a coding agent, I want `context_for_task` to understand spec
task references, so that spec-driven implementation starts with the right docs
and files.

#### Acceptance Criteria

1. WHEN a task prompt mentions `Spec NNN` or `TNNN`, THEN task context SHALL
   route to the relevant spec artifacts where evidence exists.
2. WHERE spec-lifecycle-manager MCP is available, THE SYSTEM SHALL prefer its
   authoritative lifecycle reads or clearly label Agent Workbench local parsing.
3. WHEN no spec evidence is found, THEN task context SHALL report missing
   evidence without blocking unrelated repo context.

## Correctness Properties

- Active and archived specs must be distinguished.
- Missing artifacts must stay explicit.
- Agent Workbench must not own spec template governance.
- Traceability output must be bounded and repo-relative.

## Success Criteria

- Fixture specs cover active, archived, malformed, and traceability-rich
  packages.
- Golden task lookup responses route agents to files and checks.
- Durable docs document the spec-lifecycle-manager boundary.
