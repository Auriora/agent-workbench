---
title: Infrastructure template routing requirements
doc_type: spec
artifact_type: requirements
status: active
owner: platform
last_reviewed: 2026-06-05
---

# Requirements

## Introduction

This spec promotes AWS/SAM/CloudFormation follow-up backlog into active work.
The first slice already extracts logical IDs and Lambda handler strings as
resource-backed routing evidence and plans non-executed `cfn-lint`, `sam
validate`, and nearby infrastructure tests. Remaining work should connect
templates to handlers, tests, and validation evidence without claiming full
CloudFormation semantics.

## Durable Source Baseline

- Infrastructure-template backlog:
  [MCP surface design](../../design/mcp-surface-design.md)
- Adapter capability gates:
  [Language adapter design](../../design/language-adapter-design.md)
- Validation planning contract:
  [Edit and validation loop design](../../design/edit-and-validation-loop-design.md)

## Goals

- Connect templates to handler files and nearby tests as resource-backed routing
  evidence.
- Improve template-aware context, impact, and validation planning.
- Keep all infrastructure commands non-executed and policy-aware.

## Non-Goals

- No full CloudFormation/SAM semantic engine.
- No AWS, SAM, Docker, or test command execution.
- No external-repository dependency in automated tests.

## Requirements

### Requirement 1: Template-To-Handler Routing

**User Story:** As a coding agent, I want SAM/CloudFormation templates linked
to likely handler files, so that impact and context calls do not return isolated
template evidence.

#### Acceptance Criteria

1. GIVEN a template with Lambda handler strings, WHEN extraction runs, THEN the
   graph SHALL expose resource-backed template-to-handler routing evidence when
   the handler file can be resolved within the repository.
2. IF a handler string cannot be resolved, THEN unresolved evidence SHALL be
   reported with low confidence and provenance.

### Requirement 2: Template-Aware Context And Impact

**User Story:** As a coding agent, I want context and impact for templates to
include handlers and nearby tests, so that changes can be validated without
manual broad search.

#### Acceptance Criteria

1. GIVEN a selected template, WHEN `context_for_task` runs, THEN ranked files
   SHALL include relevant handler files and infrastructure tests where evidence
   exists.
2. GIVEN a template symbol or logical ID, WHEN impact runs, THEN routing edges
   SHALL be low-confidence/resource-backed unless parser-backed semantics exist.

### Requirement 3: Validation Planning

**User Story:** As a coding agent, I want infrastructure validation planning to
use repo-approved commands and nearby tests, so that agents do not guess unsafe
deployment commands.

#### Acceptance Criteria

1. WHERE repo policy provides SAM/CloudFormation commands, THE SYSTEM SHALL use
   configured planned commands.
2. WHERE host commands are not proven safe, THE SYSTEM SHALL return planned or
   blocked evidence rather than executing or implying deploy safety.
3. Nearby infrastructure tests SHALL rank before broad Python test commands when
   template evidence is selected.

## Correctness Properties

- Template edges are resource-backed until semantic promotion gates exist.
- No deployment command is executed.
- Handler resolution is repo-relative and workspace-safe.

## Success Criteria

- Fixtures prove template-to-handler/test routing, low-confidence impact
  evidence, and policy-aware validation planning.
- Durable docs record accepted behavior and remaining semantic gaps.
