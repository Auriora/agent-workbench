---
title: Go reference impact promotion verification
doc_type: spec
artifact_type: verification
status: active
owner: platform
last_reviewed: 2026-06-06
---

# Verification

## Quality Gates

- `pnpm typecheck`
- Focused Go extraction, graph, MCP, impact, and validation-planning tests
- `pnpm test` before closure
- Read-only dogfood against at least one Go-heavy sample repository
- Spec lifecycle lint or scan
- `git diff --check`

## Evidence Log

| Date | Activity | Result |
| --- | --- | --- |
| 2026-06-06 | Spec created from durable Go dogfood backlog | Pending implementation |
| 2026-06-06 | T001 Go reference and validation-policy fixtures | Expanded the Go service fixture with package/import/method/selector/ambiguous/test/CI/Makefile evidence and added a separate Docker-only policy fixture. Added fixture-shape tests and updated existing Go fixture assertions. Focused Go-adjacent Vitest suite passed. |

## Residual Risks

- Go reference resolution without type checking can overclaim receiver and
  selector edges. Keep unresolved or low-confidence evidence where needed.
- Validation policy can be repository-specific; use generic policy detection
  and fixture-backed examples rather than sampled-repo special cases.
