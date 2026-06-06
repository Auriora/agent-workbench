---
title: Diagnostics and post-edit feedback requirements
doc_type: spec
artifact_type: requirements
status: archived
owner: platform
last_reviewed: 2026-06-06
---

# Requirements

## Introduction

This spec promotes the highest-priority replacement gap from
[Spec 010](../010-agent-ide-capability-analysis/requirements.md): a
language-neutral diagnostics and post-edit feedback workflow.

Predecessor `agent-ide` usage showed that diagnostics and post-apply feedback
were central to real agent workflows. Agent Workbench already has quiet hooks
and `verification_plan.static_feedback`, but it needs a clear provider-backed
diagnostics path and a post-edit feedback surface that can replace the
predecessor repair loop without becoming Python-shaped or noisy.

## Durable Source Baseline

- Capability analysis:
  [Agent IDE capability analysis](../../reference/agent-ide-capability-analysis/agent-ide-capability-analysis-2026-06-05.md)
- Edit loop behavior:
  [Edit and validation loop design](../../design/edit-and-validation-loop-design.md)
- MCP surface rules:
  [MCP surface design](../../design/mcp-surface-design.md)
- Adapter capability rules:
  [Language adapter design](../../design/language-adapter-design.md)
- Runtime contracts:
  [Runtime contracts](../../reference/runtime-contracts.md)

## Goals

- Add normalized diagnostics provider contracts that work across documentation,
  config, infrastructure, and language adapters.
- Decide and implement the minimal public surface for changed-file diagnostics
  and post-edit feedback.
- Reuse shared presenters so clean results and optional analyzer failures remain
  quiet.
- Preserve language-neutral MCP envelopes and capability labels.
- Keep command execution, full tests, broad validation, and semantic refactors
  out of this slice.

## Non-Goals

- Do not port Python Agent IDE diagnostics implementation.
- Do not add Ruff, Pyright, pytest, TypeScript, clangd, or other tool-specific
  MCP fields.
- Do not execute tests, linters, formatters, typecheckers, or build commands.
- Do not make hooks produce visible context for clean results or optional
  analyzer failures.
- Do not implement semantic rename, change signature, rollback, or code actions.

## Requirements

### Requirement 1: Normalized Diagnostics Providers

**User Story:** As a coding agent, I want diagnostics from different file types
to share one shape, so that I can interpret findings without knowing backend
tool details.

#### Acceptance Criteria

1. GIVEN a provider can analyze a changed file, WHEN diagnostics run, THEN the
   system SHALL return normalized findings with relative path, range when known,
   severity, message, source category, capability, and evidence.
2. WHERE a provider is unavailable for an optional file type, THE SYSTEM SHALL
   mark that provider unavailable in metadata only when it changes the requested
   result.
3. IF a provider fails without blocking the requested operation, THEN the system
   SHALL log or instrument the failure without adding visible no-action output.
4. IF a diagnostics result is clean, THEN the system SHALL suppress visible
   findings and return only minimal metadata where a tool response is required.

### Requirement 2: Changed-File Diagnostics Surface

**User Story:** As a coding agent, I want fast diagnostics for touched files, so
that I can repair obvious issues before planning broader validation.

#### Acceptance Criteria

1. GIVEN changed files are supplied, WHEN diagnostics run, THEN the system SHALL
   inspect only those files and known direct provider inputs.
2. GIVEN no changed files are supplied, WHEN diagnostics run, THEN the system
   SHALL return a structured invalid-input error with a next action.
3. WHERE file types have no provider, THE SYSTEM SHALL return `not_applicable`
   or `unsupported` evidence without pretending validation is complete.
4. IF diagnostics would require broad repository analysis, THEN the system SHALL
   defer that work to `verification_plan` or a future explicit validation
   surface.

### Requirement 3: Post-Edit Feedback Surface

**User Story:** As a coding agent, I want concise feedback after edits, so that
I know whether to repair, validate, or continue without noisy hook chatter.

#### Acceptance Criteria

1. GIVEN a post-edit feedback request includes touched files, WHEN feedback is
   built, THEN the system SHALL combine diagnostics findings, edit-risk
   signals, validation status, and concise next actions.
2. IF all checked files are clean and no risk signal exists, THEN the system
   SHALL return a quiet success response with no visible advisory text.
3. IF findings exist, THEN the system SHALL prioritize blockers, syntax errors,
   unsafe edit risks, and direct repair next actions before validation planning.
4. WHERE hooks call the same feedback path, THE SYSTEM SHALL preserve the quiet
   output policy: no clean-result output and no visible optional-error output.

### Requirement 4: Durable Promotion

**User Story:** As a maintainer, I want accepted diagnostics and feedback
behavior documented durably, so that future language providers use the same
contracts.

#### Acceptance Criteria

1. WHEN implementation completes, THEN durable design docs SHALL describe the
   provider contract, surface choice, presenter behavior, and hook integration.
2. WHEN implementation completes, THEN remaining diagnostics/provider gaps SHALL
   be routed to backlog or follow-up specs with promotion criteria.

## Correctness Properties

- Diagnostics findings must not include absolute paths.
- Clean diagnostics must not create noisy hook or tool guidance.
- Provider-specific raw output must not leak into MCP envelopes.
- Diagnostics must not execute commands unless a future command-runner contract
  explicitly allows it.
- Capability and evidence labels must come from shared helpers/presenters.

## Success Criteria

- Agents have a clear changed-file diagnostics and post-edit feedback workflow.
- The workflow works for at least documentation/config plus one code adapter in
  fixture-backed tests.
- Hooks reuse the same quiet feedback policy.
- The public surface remains small and language-neutral.
