---
title: Agent Skills standard compliance traceability
doc_type: spec
artifact_type: traceability
status: active
owner: platform
last_reviewed: 2026-07-04
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Traceability

## Task To Context Matrix

| Task | Requirements | Design Sections | Durable Targets | Verification |
| --- | --- | --- | --- | --- |
| T001 | R1, R3, R4 | Compliance Levels, Brooks-Lint Portability Decision | Plugin runbook | Design review |
| T002 | R2, R3 | Validator | Validator script | Script rule review |
| T003 | R2, R3, R4 | Validator | CI workflow, package scripts | `pnpm run validate:skills`, focused Vitest |
| T004 | R4 | Validation Scope, Operational Considerations | Plugin runbook | Advisory cache smoke |
| T005 | R1, R2, R3, R4 | Documentation | Plugin README, runbook, documentation map | Docs review |
| T006 | R3, R4 | Brooks-Lint Portability Decision | Plugin runbook, research record | Docs review |
| T007 | All | All | Verification record | Final validation suite |

## Requirement To Delivery Matrix

| Requirement | Delivery Tasks | Validation |
| --- | --- | --- |
| R1 Compliance Target Decision | T001, T005, T007 | Durable docs state hybrid target |
| R2 Owned Skill Validation | T002, T003, T007 | `pnpm run validate:skills` |
| R3 Progressive Disclosure | T002, T003, T005, T006 | Size and reference checks plus docs |
| R4 Third-Party Skill Boundary | T001, T004, T005, T006 | Advisory cache mode exits non-failing |

## Design To Implementation Matrix

| Area | Files | Notes |
| --- | --- | --- |
| Owned validator | `scripts/validate-agent-skills.mjs`, `package.json`, `.github/workflows/ci.yml` | Default CI path checks only repository-owned packaged skills. |
| Validator tests | `tests/integration/agent-skills-validation.test.ts` | Covers success and actionable failure output. |
| Packaged skills | `plugins/agent-workbench/**/skills/agent-workbench/SKILL.md` | Codex, Claude, and Kiro copies use standard `name` and `description` frontmatter. |
| Durable docs | `plugins/agent-workbench/README.md`, `docs/runbooks/codex-agent-workbench-plugin.md`, `docs/reference/documentation-map.md` | Describes hybrid target, owned paths, validation commands, advisory cache boundary, and Brooks-Lint routing. |

## Open Decision Impact

- No open decisions block implementation.
- Brooks-Lint remains outside this repository. A future promotion into a plugin
  or repository-owned package should keep shared references inside that
  distributable bundle.
