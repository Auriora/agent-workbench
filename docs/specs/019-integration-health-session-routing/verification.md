---
title: Integration health and session routing verification
doc_type: spec
artifact_type: verification
status: active
owner: platform
last_reviewed: 2026-06-06
---

# Verification

## Quality Gates

- `pnpm typecheck`
- Focused MCP registry, profile, presenter, and next-action tests
- `pnpm test` before closure
- `git diff --check`
- Spec lifecycle scan

## Validation Plan

- Test full, partial, missing, and unknown session capability evidence.
- Test presenter output with available and unavailable next actions.
- Test Codex integration profile alignment with registered MCP tools.
- Test contextual routing decision docs against accepted behavior.

## Evidence Log

| Date | Activity | Result |
| --- | --- | --- |
| 2026-06-06 | Spec created from EB001, EB002, and EB011 | Pending implementation |

## Residual Risks

- Client-discovered tool evidence may not be available in all Codex sessions.
- A generic router could become an unbounded fallback if not constrained.
