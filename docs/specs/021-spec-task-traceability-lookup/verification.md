---
title: Spec task traceability lookup verification
doc_type: spec
artifact_type: verification
status: active
owner: platform
last_reviewed: 2026-06-06
---

# Verification

## Quality Gates

- `pnpm typecheck`
- Focused spec fixture, parser, task-context, and MCP tests
- `pnpm test` before closure
- `git diff --check`
- Spec lifecycle scan

## Validation Plan

- Validate active, archived, malformed, and traceability-rich fixture specs.
- Validate task prompts mentioning `Spec NNN` and `TNNN`.
- Validate caller-supplied lifecycle context for preflight, task detail,
  validation plan, evidence quality, task-state audit, and closure risk.
- Validate that lifecycle validation-plan evidence is joined to
  `verification_plan` as planned or blocked evidence, not executed proof.
- Validate missing evidence and external ownership boundaries.
- Validate `traceability.md` rows for T001-T005 against requirements, design,
  tasks, and verification expectations.

## Evidence Log

| Date | Activity | Result |
| --- | --- | --- |
| 2026-06-06 | Spec created from EB006 | Pending implementation |
| 2026-06-13 | Lifecycle context bridge feedback reconciled into requirements, design, tasks, and traceability | Pending lint and implementation |

## Residual Risks

- Spec formats may vary across repositories.
- Direct integration with spec-lifecycle-manager MCP may not be available in
  all sessions.
- Caller-supplied lifecycle context shape still needs fixture-backed contract
  decisions before implementation.
