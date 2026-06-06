---
title: SAM CloudFormation intrinsic routing requirements
doc_type: spec
artifact_type: requirements
status: archived
owner: platform
last_reviewed: 2026-06-06
---

# Requirements

## Introduction

Agent Workbench now has resource-backed SAM/CloudFormation template and Lambda
handler routing, but intrinsic functions, event-source relationships, and
template-to-resource dependency edges remain future work. AWS infrastructure
dogfood showed this is the next useful infrastructure slice for replacing
Python Agent IDE in IaC-heavy repositories.

## Durable Source Baseline

- Infrastructure adapter direction:
  [Language adapter design](../../design/language-adapter-design.md)
- MCP routing and validation behavior:
  [MCP surface design](../../design/mcp-surface-design.md)
- Workspace safety and redaction:
  [Workspace safety contract](../../reference/workspace-safety-contract.md)

## Goals

- Parse CloudFormation/SAM intrinsic references such as `Ref`, `GetAtt`,
  `Sub`, `Join`, `ImportValue`, and `DependsOn` into resource-backed graph
  evidence.
- Add event-source edges for Lambda-related SAM resources where template
  evidence is explicit.
- Improve template-aware context, impact, and validation planning while keeping
  command execution out of scope.

## Non-Goals

- Do not execute AWS, SAM, Docker, or deployment commands.
- Do not fully emulate CloudFormation resolution or account/region behavior.
- Do not store secret-like template values.
- Do not implement cross-language symbols beyond explicit template-to-handler
  file routing already supported.

## Requirements

### Requirement 1: Intrinsic And Dependency Evidence

**User Story:** As an IaC maintainer, I want template resources connected by
explicit intrinsic references, so that context and impact are not limited to
handler file names.

#### Acceptance Criteria

1. GIVEN SAM or CloudFormation templates, WHEN extraction runs, THEN the system
   SHALL emit resource nodes and resource-backed edges for supported intrinsic
   references and `DependsOn`.
2. WHEN intrinsic expressions are nested or ambiguous, THEN the system SHALL
   preserve path/provenance metadata and keep uncertain edges low confidence.
3. IF a value may contain secrets or deployment-specific values, THEN the
   system SHALL store names and structural evidence only, not raw secret-like
   values.

### Requirement 2: Event-Source And Handler Context

**User Story:** As a coding agent, I want Lambda handlers, event sources, and
template resources grouped together, so that AWS code changes have useful
context.

#### Acceptance Criteria

1. GIVEN a SAM function has explicit events, WHEN `context_for_task` runs for
   the handler, template, or logical ID, THEN the system SHALL surface related
   event resources and template dependencies within result budgets.
2. WHEN `impact` runs for a handler, logical ID, or template resource, THEN the
   system SHALL rank directly related template resources, tests, and handler
   files with confidence labels.
3. WHERE event or dependency semantics are not supported, THE SYSTEM SHALL
   report a caveat instead of presenting a zero-edge graph as complete.

### Requirement 3: IaC Validation Planning

**User Story:** As an operator, I want SAM/CloudFormation validation plans to be
template-aware and policy-aware, so that agents do not guess unsafe checks.

#### Acceptance Criteria

1. GIVEN repo policy, Makefile, CI, Docker, or devcontainer evidence names IaC
   validation commands, WHEN validation is planned, THEN those commands SHALL be
   planned before generic `sam validate` or `cfn-lint` templates.
2. WHERE generic checks are only conventions, THE SYSTEM SHALL label them as
   non-executed planned evidence with caveats.
3. IF no safe validation path exists, THEN validation planning SHALL return a
   blocked or manual-review state rather than a runnable claim.

## Correctness Properties

- Template paths, handler paths, and logical IDs must be repo-relative or
  template-local.
- Intrinsic edges must include source expression provenance and confidence.
- Secret-like values must be redacted or omitted before storage and
  presentation.
- AWS-specific evidence must remain adapter metadata, not shared contract
  fields.

## Success Criteria

- Fixture tests prove intrinsic parsing, event-source edges, handler grouping,
  impact confidence, redaction, and validation planning.
- Read-only dogfood against at least one AWS IaC sample repository records
  improved template-aware context without modifying that repository.
