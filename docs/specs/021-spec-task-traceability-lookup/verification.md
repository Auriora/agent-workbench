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
- Validate missing evidence and external ownership boundaries.

## Evidence Log

| Date | Activity | Result |
| --- | --- | --- |
| 2026-06-06 | Spec created from EB006 | Pending implementation |

## Residual Risks

- Spec formats may vary across repositories.
- Direct integration with spec-lifecycle-manager MCP may not be available in
  all sessions.
