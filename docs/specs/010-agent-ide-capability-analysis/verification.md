---
title: Agent IDE capability analysis verification
doc_type: spec
artifact_type: verification
status: active
owner: platform
last_reviewed: 2026-06-05
---

# Verification

## Quality Gates

- `python3 /home/bcherrington/.codex/skills/spec-lifecycle-manager/scripts/spec_runtime.py lint docs/specs/010-agent-ide-capability-analysis`
- `pnpm exec vitest run tests/docs/docs-links-metadata.test.ts`
- `git diff --check`
- Manual readback of the final analysis matrix and roadmap/spec links.

## Evidence Log

| Date | Activity | Result |
| --- | --- | --- |
| 2026-06-05 | Spec created from user request to analyze `agent-ide` capabilities and plan replacement work | Pending implementation |

## Residual Risks

- `agent-ide` usage telemetry may be stale or incomplete; findings should
  distinguish historical usage from current user preference.
- Some useful `agent-ide` behaviors may be embedded in code rather than
  documented; T001 must inspect tests and surfaces, not only prose docs.
- Parity pressure could add too many public tools. T004 must prefer existing
  Agent Workbench workflows unless a new tool has clear cross-language value.
