---
title: Overview ranking polish requirements
doc_type: spec
artifact_type: requirements
status: active
owner: platform
last_reviewed: 2026-06-05
---

# Requirements

## Introduction

This spec promotes the open `repo:///overview` ranking backlog from
[MCP surface design](../../design/mcp-surface-design.md) into an active
implementation package. The current overview can still over-prioritize workflow
configuration, incidental package files, fixture documents, generated metadata,
or third-party source ahead of application entrypoints, representative source
files, tests, and package/test configuration.

## Durable Source Baseline

- Current overview contract and backlog:
  [MCP surface design](../../design/mcp-surface-design.md)
- Response vocabulary:
  [Runtime contracts](../../reference/runtime-contracts.md)
- Capability promotion limits:
  [Language adapter design](../../design/language-adapter-design.md)

## Goals

- Improve first-read `repo:///overview` usefulness across mixed repositories.
- Keep ranking generic and repo-shape based, not tied to any dogfood checkout.
- Preserve compact output budgets and explicit capability metadata.

## Non-Goals

- No semantic graph promotion for any language.
- No broad repository orientation report.
- No hard-coded external repository names or product paths.

## Success Criteria

- `repo:///overview` ranks application/test/package anchors ahead of workflow
  noise in fixture-backed tests.
- Ranking reasons remain compact and confidence-honest.
- Durable docs describe accepted behavior before closure.

## Requirements

### Requirement 1: Application-First Key Files

**User Story:** As a coding agent, I want overview key files to surface likely
implementation entrypoints before workflow noise, so that first-pass repository
orientation is actionable.

#### Acceptance Criteria

1. GIVEN a repository with source entrypoints, tests, package config, and many
   workflow/config files, WHEN `repo:///overview` ranks key files, THEN source
   entrypoints, representative source files, tests, and package/test
   configuration SHALL rank ahead of `.github/workflows/*` unless the repo is
   workflow-focused.
2. WHERE only workflow/config files exist, THE SYSTEM SHALL still report them
   as key files with honest `resource_backed` capability.
3. IF files are generated, vendored, fixture-only, or third-party paths, THEN
   THE SYSTEM SHALL downrank them unless the path is explicitly task-relevant.

### Requirement 2: Compact Ranking Reasons

**User Story:** As a coding agent, I want key-file reasons to explain why a file
was promoted, so that I can judge whether it is routing evidence or edit-proof
evidence.

#### Acceptance Criteria

1. GIVEN a promoted key file, WHEN overview returns it, THEN the reason SHALL
   name the generic evidence class such as entrypoint, package config, test,
   source, workflow, infrastructure, or documentation.
2. IF a file is ranked mainly by weak path heuristics, THEN the reason SHALL
   avoid overstating semantic confidence.

### Requirement 3: Durable Promotion

**User Story:** As a maintainer, I want the accepted ranking behavior promoted
to durable docs, so that archived dogfood specs remain historical evidence.

#### Acceptance Criteria

1. WHEN implementation completes, THEN durable docs SHALL describe current
   overview ranking behavior and residual caveats.
2. WHEN this spec closes, THEN remaining work SHALL be routed to durable backlog
   sections or a follow-up spec.

## Correctness Properties

- Ranking never hides capability metadata.
- Ranking remains deterministic for equal evidence.
- Generated/vendor/fixture downranking must not remove files from scope counts.
- Overview output stays bounded by existing response budgets.
