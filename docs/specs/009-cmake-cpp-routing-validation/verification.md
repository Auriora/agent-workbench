---
title: CMake C++ routing and validation verification
doc_type: spec
artifact_type: verification
status: active
owner: platform
last_reviewed: 2026-06-05
---

# Verification

## Quality Gates

- `pnpm typecheck`
- Focused C/C++ extraction, context, impact/query, and verification-plan tests
- `pnpm test` before closure if graph extraction or planning changes shared
  behavior
- `git diff --check`

## Evidence Log

| Date | Check | Result |
| --- | --- | --- |
| 2026-06-05 | Spec created from durable CMake/C++ backlog | Pending implementation |

## Residual Risks

- Heuristic C++ routing can help agents but must remain clearly below
  compiler-backed semantic confidence.
- CMake command templates vary by repository; repo-local policy must remain the
  authority for safe validation.
