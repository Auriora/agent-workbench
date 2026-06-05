---
title: Redaction boundary polish requirements
doc_type: spec
artifact_type: requirements
status: active
owner: platform
last_reviewed: 2026-06-05
---

# Requirements

## Introduction

This spec promotes the open MCP surface backlog item about over-redaction into
active work. Some presentation paths can treat ordinary in-repository string
snippets, such as URL paths or route fragments, as if they were external
filesystem paths. That hides useful source evidence and makes routing feedback
less trustworthy.

## Durable Source Baseline

- Current backlog: [MCP surface design](../../design/mcp-surface-design.md)
- Safety policy: [Workspace safety contract](../../reference/workspace-safety-contract.md)
- Presentation boundary: [MCP surface design](../../design/mcp-surface-design.md)

## Goals

- Preserve ordinary source snippets such as URL paths, API route strings, and
  test fixture text in source sections and compact findings.
- Keep filesystem paths, workspace escapes, absolute host paths, and
  secret-like values protected.
- Make redaction behavior fixture-backed and shared across presentation paths.

## Non-Goals

- No broad secret-scanning subsystem.
- No mutation of source text.
- No weakening of workspace path containment or secret environment handling.

## Requirements

### Requirement 1: Source Snippet Preservation

**User Story:** As a coding agent, I want ordinary in-repo route and URL
snippets to remain visible, so that context results preserve useful evidence.

#### Acceptance Criteria

1. GIVEN a source file containing route fragments such as `/api/orders`, WHEN a
   source section or compact snippet is returned, THEN the route string SHALL
   not be redacted as an outside-repo path.
2. WHERE a snippet is ordinary code text and not a filesystem path or secret,
   THE SYSTEM SHALL preserve it.

### Requirement 2: Safety Redaction Boundary

**User Story:** As a maintainer, I want safety redaction to remain strict for
real filesystem and secret-like values, so that polishing false positives does
not leak sensitive data.

#### Acceptance Criteria

1. GIVEN absolute host paths, workspace escape paths, or secret-like values,
   WHEN presentation emits snippets or findings, THEN those values SHALL remain
   redacted or refused according to workspace safety policy.
2. IF a value is ambiguous, THEN the system SHALL prefer a documented safe
   classification with tests rather than ad hoc string handling.

### Requirement 3: Durable Promotion

**User Story:** As a maintainer, I want the redaction boundary documented, so
that future presentation work does not reintroduce false positives.

#### Acceptance Criteria

1. WHEN implementation completes, THEN durable docs SHALL describe the
   distinction between source snippets, filesystem paths, and secret-like
   values.
2. WHEN this spec closes, THEN residual secret-scanning or advanced redaction
   work SHALL be routed to backlog rather than left implicit.

## Correctness Properties

- Redaction must not alter stored source or graph evidence.
- Redaction policy must be deterministic for the same input.
- Path containment checks remain stricter than presentation redaction.

## Success Criteria

- Fixture-backed tests prove route strings are preserved and host/secret values
  are still protected.
- Durable docs describe the accepted boundary and caveats.
