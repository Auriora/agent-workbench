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
| 2026-06-06 | T002 Go parser-backed extraction | Added `tree-sitter-go`, native rebuild wiring, parser-backed Go capability labels, package/import/declaration/receiver extraction, and unresolved selector/identifier references with package/import provenance. `pnpm rebuild:native`, `pnpm typecheck`, and focused Go-adjacent Vitest suite passed. |
| 2026-06-06 | T003 Go reference and impact query wiring | Added Go-aware filtering to shared reference resolution for imported package selectors and receiver-style method selectors. Proved `find_references` and low-confidence `impact` traversal with parser-backed Go evidence. Focused graph/query Vitest tests passed. |

## Residual Risks

- Go reference resolution without type checking can overclaim receiver and
  selector edges. Keep unresolved or low-confidence evidence where needed.
- Validation policy can be repository-specific; use generic policy detection
  and fixture-backed examples rather than sampled-repo special cases.
