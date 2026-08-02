---
title: Validation-plan skipped-path payload compaction change impact
doc_type: spec
artifact_type: change-impact
status: draft
owner: platform
last_reviewed: 2026-08-02
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Change Impact

## Purpose

Map the EB065 public payload repair, scanner population truth, cross-surface
summary policy, proof obligations, and residual ownership to durable sources.

## Durable Source Mapping

| Source | Current behavior relied on | Confidence | Notes |
| --- | --- | --- | --- |
| `docs/backlog/README.md` | EB004 validation planning and EB065 acceptance/sequencing | high | mark delivered only after evidence |
| `docs/design/mcp-surface-design.md` | scanner skip visibility and current task-context summary behavior | high | public surface owner |
| `docs/reference/runtime-contracts.md` | contract versioning, raw skipped path schema, verification plan | high | schema/count/truncation owner |
| `docs/requirements/runtime-requirements.md` | durable validation-planning requirements | high | add accepted target behavior |
| `docs/reference/mvp-proof-matrix.md` | validation-plan fixture evidence | high | add compaction/conservation proof |
| `docs/reference/agent-readable-changelog.md` | agent-visible response behavior | high | promote after implementation |
| `docs/reference/dogfood-evidence-ledger.md` | dated installed/source runtime evidence | high | update only with executed evidence |

## Change Type

- **Primary type:** bug_fix
- **Breaking change:** no
- **Durable docs required:** yes
- **External behavior affected:** yes, additive `verification_plan` output

## Proposed Changes

| Change | Type | Source of truth | New durable destination | Promotion required |
| --- | --- | --- | --- | --- |
| exact scanner skip population beyond raw retention | bug_fix | scanner and port tests | runtime contracts; MCP surface design | yes |
| structured reason/count/sample receipt | add | Spec 053 requirements/design | runtime contracts; MCP surface design | yes |
| retire raw validation-plan skip emission | modify | Spec 053 compatibility decision | runtime contracts; changelog | yes |
| shared context/validation summary semantics | refactor | shared policy tests | MCP surface design | yes |
| generated/vendor-heavy five-gate proof | add | fixture/MCP tests | MVP proof matrix | yes |
| EB065 delivery and residual scope | modify | implementation/verification evidence | backlog | yes |
| installed/source dogfood observation | add | executed runtime receipt | dogfood ledger | if executed |

## Promotion Targets

| Spec content | Durable destination | Promotion status | Notes |
| --- | --- | --- | --- |
| no-extraction-limit and exact-population requirement | `docs/requirements/runtime-requirements.md` | pending | distinguish source and sample truncation |
| scanner-to-plan/context data flow | `docs/design/mcp-surface-design.md` | pending | no duplicate grouping |
| public receipt and compatibility | `docs/reference/runtime-contracts.md` | pending | additive `0.1` field |
| fixture and invariant proof | `docs/reference/mvp-proof-matrix.md` | pending | include five gates and over-100 accounting |
| delivery and exclusions | `docs/backlog/README.md` | pending | EB065 delivered; other owners unchanged |
| agent consumption guidance | `docs/reference/agent-readable-changelog.md` | pending | prefer summary counts/samples |
| runtime evidence | `docs/reference/dogfood-evidence-ledger.md` | pending if executed | do not invent evidence |

## Unchanged Durable Areas

| Durable area | Reviewed source | Reason unchanged |
| --- | --- | --- |
| workspace/path admission policy | `docs/reference/workspace-safety-contract.md` | classification meanings do not change |
| layered architecture | `docs/design/layered-runtime-architecture.md` | work stays in existing policy/use-case/presenter boundaries |
| runtime operations and scanner completion | `docs/design/runtime-operations-design.md` | traversal/max-files/continuation policy is not changed |
| graph-store persistence | `docs/design/graph-store-design.md` | summary is invocation-local and not persisted |
| documentation ranking | `docs/design/mcp-surface-design.md` EB059 boundary | ranked-universe capacity is unrelated |

## Bug Fix Details

- **Observed behavior:** useful validation commands are wrapped in up to 50 raw
  skipped-path records, while the scanner itself silently stops retaining raw
  skip evidence after 100 records.
- **Expected behavior:** exact scanner-observed population counts, bounded
  reason-group samples, visible actionable exclusions, and prominent commands.
- **Root cause evidence:** separate planner mapping and task-context grouping
  consume a raw scanner list whose retention bound is not represented in the
  plan contract.
- **Regression risk:** false exact counts, accidental scan limiting, hidden
  actionable blockers, strict-schema incompatibility, or context/plan drift.
- **Durable doc update needed:** yes, every promotion target above.

## Open Questions

None. Sample size, compatibility direction, population basis, and residual
scanner ownership are fixed in `design.md` and require review before source
implementation.

## Related Artifacts

- Requirements: `requirements.md`
- Design: `design.md`
- Tasks: `tasks.md`
- Verification: `verification.md`
