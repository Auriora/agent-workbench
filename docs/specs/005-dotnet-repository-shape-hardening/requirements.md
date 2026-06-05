---
title: .NET repository shape hardening requirements
doc_type: spec
artifact_type: requirements
status: archived
owner: platform
last_reviewed: 2026-06-05
---

# Requirements

## Closure Record

Spec 005 closed on 2026-06-05. Accepted .NET resource-backed behavior was
promoted to durable MCP surface, language adapter, and language capability docs.
C# and Razor semantic support remains deferred to future fixture-backed adapter
work.

## Introduction

This spec promotes the .NET backlog from
[MCP surface design](../../design/mcp-surface-design.md) into active work. The
first slice already recognizes `.sln`, project files, generated `bin/`/`obj/`
outputs, C#/Razor anchors, and basic `dotnet build`/`dotnet test` planning.
Remaining work should deepen generated-output handling, project-file extraction,
and validation planning without claiming semantic C#/Razor support.

## Durable Source Baseline

- Current .NET backlog:
  [MCP surface design](../../design/mcp-surface-design.md)
- Adapter capability gates:
  [Language adapter design](../../design/language-adapter-design.md)
- Language status table:
  [Language capability matrix](../../reference/language-capability-matrix.md)
- Validation planning contract:
  [Edit and validation loop design](../../design/edit-and-validation-loop-design.md)

## Goals

- Keep .NET generated outputs from consuming context and scope budgets.
- Extract resource-backed solution/project metadata for routing.
- Improve policy-aware .NET validation planning.

## Non-Goals

- No semantic C# or Razor support in this spec.
- No command execution.
- No dependency on external dogfood repositories for automated tests.

## Requirements

### Requirement 1: Generated Output Exclusion

**User Story:** As a coding agent, I want .NET build outputs treated as
generated evidence, so that context and scope budgets stay focused on source.

#### Acceptance Criteria

1. GIVEN a .NET repository with `TestResults/`, local `packages/`, publish
   output, DLL/PDB/WASM artifacts, compressed framework assets, or source maps,
   WHEN catalog, scope, overview, or context runs, THEN those paths SHALL not
   dominate budgets unless explicitly requested.
2. WHERE generated paths are skipped, THE SYSTEM SHALL expose skipped-path
   evidence instead of silently losing scope information.

### Requirement 2: Resource-Backed Project Extraction

**User Story:** As a coding agent, I want `.sln` and project files to expose
resource-backed project metadata, so that routing and validation can choose
better anchors without semantic C# analysis.

#### Acceptance Criteria

1. GIVEN `.sln`, `.csproj`, `.fsproj`, or `.vbproj` files, WHEN graph extraction
   runs, THEN resource-backed nodes SHALL expose stable project identity,
   project references, target frameworks, SDK/output type where cheaply
   parseable, and provenance.
2. IF project metadata cannot be parsed safely, THEN the result SHALL degrade to
   resource-backed file evidence with explicit caveats.

### Requirement 3: Validation Planning

**User Story:** As a coding agent, I want .NET validation planning to choose
solution, project, and test-project commands from repository evidence, so that
agents avoid broad or unsafe guesses.

#### Acceptance Criteria

1. GIVEN selected C#/Razor files, WHEN `verification_plan` runs, THEN nearest
   project and relevant test-project evidence SHALL rank ahead of broad
   solution commands.
2. WHERE repo policy blocks host commands, THE SYSTEM SHALL return blocked
   planned evidence instead of direct `dotnet` commands.
3. Commands remain non-executed planned evidence.

## Correctness Properties

- .NET evidence remains `resource_backed` or `unsupported` until semantic
  promotion gates are met.
- Generated-output skipping never hides requested explicit source files.
- Validation commands are planned, bounded, and policy-aware.

## Success Criteria

- Focused fixtures prove generated-output handling, project metadata routing,
  and validation planning.
- Durable docs record accepted .NET behavior and remaining semantic gaps.
