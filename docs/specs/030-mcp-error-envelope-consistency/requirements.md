---
title: MCP error envelope consistency requirements
doc_type: spec
artifact_type: requirements
status: active
owner: platform
last_reviewed: 2026-06-18
---

# Requirements

## Introduction

Agent Workbench contracts require structured, actionable results. Current MCP
registries handle argument and provider errors unevenly, and some use-case
failures can still escape as handler exceptions. Agents need a consistent
recovery signal that distinguishes invalid input, unavailable provider,
blocked safety policy, stale state, domain failure, and unexpected internal
failure.

## Durable Source Baseline

- [Runtime contracts](../../reference/runtime-contracts.md)
- [MCP surface design](../../design/mcp-surface-design.md)
- [Workspace safety contract](../../reference/workspace-safety-contract.md)
- `src/interface-adapters/mcp/registries/`
- `src/presentation/`

## Goals

- Add one shared MCP handler wrapper for parse, provider, use-case, telemetry,
  and exception handling.
- Preserve tool-specific response envelope shapes where contracts require them.
- Classify failures by recovery action instead of collapsing them into invalid
  input.
- Avoid raw thrown errors for recoverable runtime states.

## Non-Goals

- Do not change MCP transport-level failures that truly prevent response
  framing.
- Do not rewrite all presenters into one generic payload.
- Do not add retry logic or fallback execution paths.

## Requirements

### Requirement 1: Shared Handler Wrapper

**User Story:** As an MCP tool maintainer, I want one handler pattern, so that
all tools classify errors consistently.

#### Acceptance Criteria

1. GIVEN a registry handler, WHEN argument parsing fails, THEN THE SYSTEM SHALL
   return an invalid-input envelope.
2. WHEN a required provider is unavailable, THEN THE SYSTEM SHALL return an
   unavailable or blocked envelope with a recovery hint.
3. WHEN the use case returns a domain result, THEN THE SYSTEM SHALL present it
   through the normal presenter.
4. WHEN the use case throws a known domain error, THEN THE SYSTEM SHALL return
   a structured domain-failure envelope.
5. WHEN an unknown error occurs, THEN THE SYSTEM SHALL return a structured
   internal-error envelope and record telemetry.

### Requirement 2: Failure Classes Stay Distinct

**User Story:** As an agent recovering from a failed tool call, I want distinct
failure classes, so that I can choose the next safe action.

#### Acceptance Criteria

1. GIVEN stale preview state, WHEN `apply_workspace_edit` fails, THEN THE
   SYSTEM SHALL report stale preview rather than invalid input.
2. GIVEN path refusal, WHEN preview or apply fails, THEN THE SYSTEM SHALL
   report blocked workspace safety rather than provider failure.
3. GIVEN missing graph/provider state, WHEN graph-backed tools fail, THEN THE
   SYSTEM SHALL report unavailable or invalid_due_to_environment.
4. GIVEN malformed arguments, WHEN any tool fails parse, THEN THE SYSTEM SHALL
   report invalid input.

### Requirement 3: Tests Cover Registry Consistency

**User Story:** As a maintainer, I want contract tests across tools, so that new
registries do not reintroduce thrown or misclassified failures.

#### Acceptance Criteria

1. WHEN a representative set of MCP tools is tested with invalid arguments,
   missing providers, domain failures, and unknown failures, THEN every result
   SHALL be JSON envelope text.
2. WHEN a tool is read-only, planning, or workspace-write, THEN failure
   metadata SHALL preserve the tool's capability and verification status.
3. IF a handler intentionally throws, THEN the test SHALL prove it is
   transport-level and not a recoverable runtime failure.

## Correctness Properties

- **P1 Envelope completeness:** Recoverable MCP handler failures produce JSON
  envelopes.
- **P2 Recovery classification:** Failure class matches the next safe agent
  action.
- **P3 No fallback masking:** Wrapping errors must not retry, alternate, or
  return partial results as success.

## Success Criteria

- Representative MCP tools use a shared handler wrapper.
- Recoverable failures return JSON envelopes with distinct recovery semantics.
- Contract tests fail if a migrated handler rethrows a recoverable use-case
  failure.
