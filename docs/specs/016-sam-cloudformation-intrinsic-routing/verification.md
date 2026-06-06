---
title: SAM CloudFormation intrinsic routing verification
doc_type: spec
artifact_type: verification
status: active
owner: platform
last_reviewed: 2026-06-06
---

# Verification

## Quality Gates

- `pnpm typecheck`
- Focused SAM/CloudFormation extraction, graph, MCP, impact, redaction, and
  validation-planning tests
- `pnpm test` before closure
- Read-only dogfood against at least one AWS IaC sample repository
- Spec lifecycle lint or scan
- `git diff --check`

## Evidence Log

| Date | Activity | Result |
| --- | --- | --- |
| 2026-06-06 | Spec created from durable SAM/CloudFormation backlog | Pending implementation |

## Residual Risks

- CloudFormation expression semantics are broad. First-slice support must avoid
  pretending to evaluate stacks.
- IaC validation commands often require credentials, Docker, or network. Plans
  must stay non-executed and policy-aware.
