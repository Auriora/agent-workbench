---
title: CMake C++ routing and validation requirements
doc_type: spec
artifact_type: requirements
status: archived
owner: platform
last_reviewed: 2026-06-06
---

# Requirements

## Introduction

Spec 009 closed on 2026-06-06. Accepted CMake/C++ routing and validation
behavior was promoted to [MCP surface design](../../design/mcp-surface-design.md),
[Language adapter design](../../design/language-adapter-design.md),
[Language capability matrix](../../reference/language-capability-matrix.md), and
[Documentation map](../../reference/documentation-map.md).

This spec promotes the remaining CMake/C++ routing and validation backlog into
active work. Current support classifies C/C++ files, extracts routing-only
declarations and CMake targets, and keeps impact low-confidence. Remaining work
should improve broad C++ task routing, first-party source prioritization,
heuristic include/call edges, and concrete CMake validation planning without
claiming compiler-backed semantics.

## Durable Source Baseline

- C/C++ backlog: [MCP surface design](../../design/mcp-surface-design.md)
- Adapter gates: [Language adapter design](../../design/language-adapter-design.md)
- Validation planning:
  [Edit and validation loop design](../../design/edit-and-validation-loop-design.md)
- FreeCAD dogfood reference:
  [FreeCAD reevaluation](../../reference/freecad-notes/2026-06-05-codex-freecad-workbench-reevaluation.md)

## Goals

- Improve first-party C++ source/test routing for broad tasks.
- Add clearly marked heuristic C/C++ include and same-file call/reference
  routing where fixture-backed.
- Make CMake validation planning more concrete while remaining non-executed and
  policy-aware.

## Non-Goals

- No clangd, libclang, compiler database, or C++ semantic support.
- No command execution.
- No repository-specific hard-coding from external dogfood projects.

## Requirements

### Requirement 1: First-Party C++ Routing

**User Story:** As a coding agent, I want broad C++ tasks to prioritize
first-party implementation roots and tests over third-party code, so that
context is useful before I know exact files.

#### Acceptance Criteria

1. GIVEN a CMake/C++ shaped repository with first-party, tests, and third-party
   roots, WHEN `context_for_task` handles a broad implementation prompt, THEN
   first-party source and nearby tests SHALL rank ahead of third-party/vendor
   paths unless third-party code is explicitly named.
2. WHERE exact source/symbol text matches exist, THE SYSTEM SHALL weight them
   ahead of generic path terms.

### Requirement 2: Heuristic C++ Routing Edges

**User Story:** As a coding agent, I want routing-only include and local-call
edges, so that reference and impact tools are useful without pretending to be
compiler-backed.

#### Acceptance Criteria

1. GIVEN C/C++ includes and same-file function/method calls in fixtures, WHEN
   graph extraction runs, THEN routing edges SHALL be emitted with heuristic
   provenance and low confidence.
2. IF ambiguity exists, THEN unresolved or low-confidence evidence SHALL be
   returned rather than semantic certainty.

### Requirement 3: Concrete CMake Validation Planning

**User Story:** As a coding agent, I want CMake validation planning to suggest
concrete project command templates, so that agents do not fall back to vague
manual review.

#### Acceptance Criteria

1. GIVEN CMake targets and selected C++ files, WHEN `verification_plan` runs,
   THEN planned commands SHALL name non-executed CMake configure/build/test
   templates where target evidence supports them.
2. WHERE repo policy blocks host commands, THE SYSTEM SHALL return blocked or
   policy-planned evidence instead of generic host CMake commands.

### Requirement 4: Durable Promotion

**User Story:** As a maintainer, I want CMake/C++ routing limits documented, so
that heuristic evidence is not confused with compiler-backed semantics.

#### Acceptance Criteria

1. WHEN implementation completes, THEN durable docs SHALL describe routing,
   validation, and semantic limits.

## Correctness Properties

- Heuristic C++ evidence remains `resource_backed` or low confidence.
- Third-party/vendor downranking must not remove files from scope counts.
- Planned CMake commands are never executed.

## Success Criteria

- Fixture-backed tests cover broad routing, heuristic edges, low-confidence
  impact, and concrete CMake validation planning.
- Durable docs record accepted behavior and future compiler-backed gaps.
