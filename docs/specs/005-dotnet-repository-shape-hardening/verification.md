---
title: .NET repository shape hardening verification
doc_type: spec
artifact_type: verification
status: active
owner: platform
last_reviewed: 2026-06-05
---

# Verification

## Quality Gates

- `pnpm typecheck`
- Focused scanner, graph, overview/context, and verification-plan tests
- `pnpm test` before closure
- `git diff --check`

## Evidence Log

| Date | Check | Result |
| --- | --- | --- |
| 2026-06-05 | Spec created from durable .NET backlog | Pending implementation |

## Residual Risks

- .NET project files vary widely across SDK and legacy project styles.
- Resource-backed project metadata must not imply semantic C# or Razor support.
