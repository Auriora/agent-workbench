---
title: Markdown quality MCP surface verification
doc_type: spec
artifact_type: verification
status: active
owner: platform
last_reviewed: 2026-06-06
---

# Verification

## Quality Gates

- `pnpm typecheck`
- Focused Markdown checker, presenter, MCP, skipped-path, budget, and
  validation-planning tests
- `pnpm test` before closure
- Spec lifecycle lint or scan
- `git diff --check`

## Evidence Log

| Date | Activity | Result |
| --- | --- | --- |
| 2026-06-06 | Spec created from post-MVP Markdown quality backlog | Pending implementation |

## Residual Risks

- Markdown parsing and formatting are easy to conflate. This spec must stay
  read-only.
- Repository documentation policies vary. The first slice should keep policy
  configurable and avoid hard-coded assumptions beyond fixture-backed defaults.
