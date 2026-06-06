---
title: Multi-file post-edit repair verification
doc_type: spec
artifact_type: verification
status: active
owner: platform
last_reviewed: 2026-06-06
---

# Verification

## Quality Gates

- `pnpm typecheck`
- Focused feedback, hook, diagnostics, and telemetry tests
- `pnpm test` before closure
- `git diff --check`
- Spec lifecycle scan

## Validation Plan

- Prove clean hooks are silent.
- Prove actionable findings are concise and repo-relative.
- Prove too-many-files and unavailable providers are logged/telemetried without
  user-facing hook noise.

## Evidence Log

| Date | Activity | Result |
| --- | --- | --- |
| 2026-06-06 | Spec created from EB005 | Pending implementation |

## Residual Risks

- Hook payload shapes can change across Codex versions.
- Queued diagnostics may need runtime state not currently persisted.
