---
title: Multi-file post-edit repair requirements
doc_type: spec
artifact_type: requirements
status: active
owner: platform
last_reviewed: 2026-06-06
---

# Requirements

## Introduction

Hook logs show deferred diagnostics for multi-file edits, especially
`too_many_files`. Agents need bounded repair feedback that stays quiet when
clean but provides actionable diagnostics, queued checks, or skipped-state
evidence when a multi-file edit cannot be fully checked inline.

## Durable Source Baseline

- [Agent Workbench executable backlog](../../requirements/agent-workbench-executable-backlog.md)
- [Edit and validation loop design](../../design/edit-and-validation-loop-design.md)
- [Coding agent integration design](../../design/coding-agent-integration-design.md)
- [MCP surface design](../../design/mcp-surface-design.md)

## Goals

- Improve post-edit repair behavior for common multi-file edits.
- Keep clean, errored, unsupported, and optional diagnostic outcomes quiet.
- Return structured skipped or queued evidence instead of noisy hook text.
- Preserve `diagnostics_for_files` and `verification_plan` as explicit MCP
  follow-up surfaces.

## Non-Goals

- Do not execute validation commands in hooks.
- Do not make hooks blocking.
- Do not emit noisy success messages.
- Do not add language-specific diagnostic providers without fixture evidence.

## Requirements

### Requirement 1: Bounded Multi-File Feedback

**User Story:** As a coding agent, I want post-edit feedback to handle
multi-file edits without noisy failure, so that I know when diagnostics were
checked, queued, or skipped.

#### Acceptance Criteria

1. GIVEN a multi-file edit within configured budgets, WHEN post-edit feedback
   runs, THEN the system SHALL return actionable diagnostics or silent clean
   output.
2. GIVEN a multi-file edit above inline budgets, WHEN post-edit feedback runs,
   THEN the system SHALL return structured skipped or queued evidence without a
   user-facing success message.
3. IF diagnostics are unavailable or optional providers fail, THEN hook output
   SHALL remain quiet while telemetry/logger output records the reason.

### Requirement 2: Repair-Oriented Next Steps

**User Story:** As a coding agent, I want concise repair guidance only when
there is something to address, so that hooks do not distract from successful
edits.

#### Acceptance Criteria

1. WHEN diagnostics find actionable issues, THEN output SHALL include compact
   repo-relative paths, severity, message, and suggested action.
2. WHEN diagnostics cannot prove correctness, THEN the internal result SHALL
   route to `diagnostics_for_files` or `verification_plan` without forcing hook
   text unless configured.
3. WHERE results are clean, errored, or optional-only, THE SYSTEM SHALL produce
   no user-facing hook message.

## Correctness Properties

- Hooks are advisory-only and non-blocking.
- Paths in hook-facing output are repo-relative.
- Clean results stay silent.
- Failures are logged or emitted to telemetry, not user-facing noise.

## Success Criteria

- Hook tests cover clean, actionable, timeout, unavailable, and multi-file
  cases.
- Provider tests prove bounded diagnostics and skipped states.
- Telemetry captures deferred diagnostic reasons.
