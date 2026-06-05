---
title: Lambda result presentation requirements
doc_type: spec
artifact_type: requirements
status: active
owner: platform
last_reviewed: 2026-06-05
---

# Requirements

## Introduction

This spec promotes the Lambda-heavy repository presentation backlog into active
work. The current SAM/CloudFormation resource-backed graph can expose logical
IDs, handler strings, handler-file anchors, and low-confidence routing edges,
but generic handler searches can still return a flat list that is hard for
agents to interpret in Lambda-heavy repositories.

## Durable Source Baseline

- Current backlog: [MCP surface design](../../design/mcp-surface-design.md)
- SAM/CloudFormation adapter limits:
  [Language adapter design](../../design/language-adapter-design.md)
- Runtime contracts: [Runtime contracts](../../reference/runtime-contracts.md)

## Goals

- Group generic Lambda handler results by logical ID, handler file, and template
  evidence where the graph already has resource-backed metadata.
- Preserve compact MCP response budgets and existing symbol schemas.
- Keep grouping as presentation/routing evidence, not semantic proof.

## Non-Goals

- No full CloudFormation/SAM semantic engine.
- No deployment or AWS command execution.
- No schema expansion unless existing fields cannot express the grouping safely.

## Requirements

### Requirement 1: Handler Result Grouping

**User Story:** As a coding agent, I want generic handler search results grouped
by infrastructure context, so that Lambda-heavy repositories do not return an
unhelpful flat list of `handler` matches.

#### Acceptance Criteria

1. GIVEN multiple Lambda handler bindings or handler-file anchors, WHEN
   `symbol_search` or related routing returns handler results, THEN results
   SHALL be ordered or annotated by logical ID, template path, and handler file
   evidence where available.
2. WHERE grouping evidence is absent, THE SYSTEM SHALL retain existing compact
   symbol output without inventing stack or service names.

### Requirement 2: Compact Presentation

**User Story:** As a coding agent, I want grouped results to remain small and
schema-consistent, so that first-pass navigation stays easy to consume.

#### Acceptance Criteria

1. WHERE grouping uses existing metadata, THE SYSTEM SHALL avoid broad source
   scans or unbounded graph traversal.
2. IF result budgets are exceeded, THEN truncation metadata SHALL remain
   explicit.

### Requirement 3: Durable Promotion

**User Story:** As a maintainer, I want Lambda presentation behavior documented,
so that future SAM/CloudFormation semantics do not blur routing evidence with
semantic proof.

#### Acceptance Criteria

1. WHEN implementation completes, THEN durable docs SHALL describe grouping
   behavior, confidence limits, and remaining semantic gaps.

## Correctness Properties

- Grouping must not hide capability metadata.
- Handler grouping remains deterministic.
- Grouping must not claim event-source or dependency semantics unless those are
  present as explicit resource-backed evidence.

## Success Criteria

- Synthetic fixtures prove grouped ordering/annotation for multiple handlers.
- Durable docs describe the accepted presentation behavior.
