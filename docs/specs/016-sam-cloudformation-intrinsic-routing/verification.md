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
| 2026-06-06 | T001 intrinsic fixture coverage | Added a dedicated SAM/CloudFormation intrinsic fixture with YAML/JSON templates, short/long intrinsics, nested expressions, dependencies, events, handlers, tests, secret-like dynamic reference material, and validation policy evidence. Focused fixture test passed. |
| 2026-06-06 | T002 intrinsic and dependency extraction | Added parser-backed YAML/JSON template traversal for CloudFormation/SAM resources. Intrinsic and `DependsOn` references now resolve to resource-backed graph edges when logical IDs are unambiguous, while parameters/imports remain unresolved with provenance and confidence metadata. `pnpm typecheck` and focused graph extraction tests passed. |
| 2026-06-06 | T003 event-source and handler grouping | Added `lambda_event_source` routing nodes and direct event-source edges for explicit SAM function events. Handler binding and handler-file grouping now includes compact event summaries. Focused graph/query tests passed. |

## Residual Risks

- CloudFormation expression semantics are broad. First-slice support must avoid
  pretending to evaluate stacks.
- IaC validation commands often require credentials, Docker, or network. Plans
  must stay non-executed and policy-aware.
