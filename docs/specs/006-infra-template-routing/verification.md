---
title: Infrastructure template routing verification
doc_type: spec
artifact_type: verification
status: active
owner: platform
last_reviewed: 2026-06-05
---

# Verification

## Quality Gates

- `pnpm typecheck`
- Focused graph extraction, context, impact, and verification-plan tests
- `pnpm test` before closure
- `git diff --check`

## Evidence Log

| Date | Check | Result |
| --- | --- | --- |
| 2026-06-05 | Spec created from durable infrastructure-template backlog | Pending implementation |

## Residual Risks

- CloudFormation/SAM semantics are broad; first implementation should remain
  routing evidence only.
- Handler string conventions vary by runtime and framework.
