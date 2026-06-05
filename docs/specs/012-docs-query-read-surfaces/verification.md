---
title: Docs query and read surfaces verification
doc_type: spec
artifact_type: verification
status: active
owner: platform
last_reviewed: 2026-06-05
---

# Verification

## Quality Gates

- `pnpm typecheck`
- Focused docs query, presenter, and MCP tests introduced by this spec
- `pnpm test` before closure if shared docs indexing or MCP presentation
  changes
- `python3 /home/bcherrington/.codex/skills/spec-lifecycle-manager/scripts/spec_runtime.py lint docs/specs/012-docs-query-read-surfaces`
- `git diff --check`

## Evidence Log

| Date | Activity | Result |
| --- | --- | --- |
| 2026-06-05 | Spec created from Spec 010 T005 follow-up planning | Pending implementation |

## Residual Risks

- Docs search could become another broad orientation surface if it returns too
  much content. Keep caps and direct-read caveats strict.
- Crosslink/report pressure should remain deferred until core query/read
  workflows prove useful and bounded.
