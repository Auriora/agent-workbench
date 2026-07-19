---
title: Provider-aware integration health verification
doc_type: spec
artifact_type: verification
status: draft
owner: platform
last_reviewed: 2026-07-19
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Verification

## Scope

Verify Spec 040 Requirement 1, Requirement 2, Requirement 3, Requirement 4,
Requirement 5, and tasks T001-T007. Direct source/live health observations are
defect evidence, not implementation or closure proof.

## Quality Gates

| Gate | Required? | Status | Evidence |
| --- | --- | --- | --- |
| Failing cross-client/health fixtures captured | yes | passed | Contract, resource/tool, launcher, and daemon fixtures cover the original defects. |
| Legacy Codex compatibility preserved | yes | passed | Legacy profile/resource fixtures remain valid while current/provider fields are additive. |
| Per-connection identity isolated across daemon clients | yes | passed | Daemon and entrypoint tests retain independent Codex/Claude/unknown evidence. |
| Static and argument-bearing health semantics proven | yes | passed | Static reads stay unknown; the bounded tool supplies validated caller evidence. |
| Identity provenance/mismatch guidance proven | yes | passed | Runtime/plugin/cache provenance and comparable-name/version tests pass. |
| Plugin/package/pack/full tests pass | yes | passed | Plugin/skill validators, package dry-run, and 623-test full suite pass. |
| Durable docs promoted and residuals owned | yes | passed | Integration/MCP/contracts/runbook/plugin/changelog/backlog docs are reconciled. |

## Validation Commands

| Command | Purpose | Result |
| --- | --- | --- |
| Focused health/profile/Kiro/registry run | Contracts, direct resource/tool adapters, comparable drift, npm package-root Kiro launch, and public metadata | passed: 5 files, 45 tests |
| Focused registry/profile/launcher run | Profiles, health, Kiro, stdio launch, and public registry behavior | passed: 6 files, 65 tests |
| Focused Claude/daemon run | Claude package isolation and per-connection daemon handoff | passed: 3 files, 27 tests |
| `pnpm typecheck` | Contract and implementation types | passed |
| `pnpm validate:plugin` | Cross-client plugin/package drift | passed |
| `pnpm validate:skills` | Skill packaging consistency | passed: 6 skills, 0 errors/warnings |
| `pnpm pack:dry-run` | Distribution contents and metadata | passed: 236 packaged entries including current profile, health tool, and Kiro launcher artifacts |
| `pnpm test` | Full regression suite | passed: 80 files, 623 tests |
| Agent Workbench `check_markdown_set` | Edited durable/spec/plugin Markdown | completed: 12 documents, no skips or tool errors; advisory table-readability findings retained as existing document-shape debt |
| Spec Lifecycle Manager `lint_spec_package` | Package structure and traceability | pending final lifecycle gate |
| `git diff --check` | Diff hygiene | passed |

## Requirement And Property Coverage

| Requirement/property | Planned evidence | Residual risk |
| --- | --- | --- |
| Requirement 1 / CP-001 | Common/current/Codex/Claude/unknown profile fixtures pass | Public additive schema must remain compact. |
| Requirement 2 / CP-001 / CP-002 | Initialize, launcher, and mixed-daemon fixtures pass | Client names remain client-controlled and variable. |
| Requirement 3 / CP-003 | Protocol-shaped static read and direct tool adapter tests pass | Caller discovery remains self-reported evidence. |
| Requirement 4 / CP-004 / CP-005 | Observed/unknown/comparable-name plugin/cache mismatch tests pass | Cache identity may remain unavailable on some clients. |
| Requirement 5 | Compatibility, validator, skill, npm package-root fixture, and package dry-run gates pass | A live Kiro-client smoke remains environment-specific. |

## Agent Readiness Evidence

| Field | Evidence | Residual risk |
| --- | --- | --- |
| Scope | Provider profiles, per-connection identity, health semantics, version provenance | Implemented and verified. |
| Out of scope | Auto-update/network checks, provider runtime policy, EB019, fallbacks | none |
| Permissions | Repository source/tests/docs/package metadata only | Installed client changes require separate authority. |
| Validation | Commands above plus task-specific fixtures | Exact focused files may grow. |
| Review | Independent final architecture/protocol/package review completed; all blocking findings corrected | No live Kiro client was available. |
| Closure impact | Promoted to integration/MCP/contracts/runbooks/plugin docs/changelog/backlog; history written by closure | ready |

## Evidence Log

| Date | Evidence | Result | Notes |
| --- | --- | --- | --- |
| 2026-07-19 | Direct source and composed-server review | defects confirmed | Server hard-codes Codex; static resource cannot receive tested pseudo-arguments. |
| 2026-07-19 | Launcher/daemon/package architecture mapping | boundaries identified | Initialize and explicit launcher context are distinct identity authorities. |
| 2026-07-19 | Requirements/design/task/traceability review | package reconciled | Verification gates reflect the final initial design and task split. |
| 2026-07-19 | Focused implementation validation | passed | 45 direct health/profile/Kiro/registry tests and 27 Claude/daemon tests passed. |
| 2026-07-19 | Independent final review | findings corrected | Added client-cache/name-aware mismatch recovery, direct bounded tool tests, correct npm package-root Kiro guidance/fixture, and complete durable surface inventories. |
| 2026-07-19 | Full validation | passed | Typecheck, plugin/skill validation, package dry-run, diff check, and 80-file/623-test suite passed. |

## Residual Risks

- MCP client names/versions are client-controlled and require bounded mapping.
- Plugin/cache identity is provider-specific and may remain unknown; no guessing
  is allowed.
- Existing Codex schema/resource compatibility is a public-contract risk.
- The daemon handshake must not expose absolute user cache paths.

## Durable Promotion And Cleanup

| Spec content | Durable destination | Status |
| --- | --- | --- |
| common/current/provider profile model | coding-agent integration design | promoted |
| health resource/tool semantics | MCP surface design; runtime contracts | promoted |
| identity/provenance/mismatch contracts | runtime contracts | promoted |
| operator recovery | plugin README and install/Codex runbooks | promoted |
| delivery/residual state | backlog, changelog, history | backlog/changelog promoted; history pending closure apply |

## Readiness Decision

- **Ready for implementation:** implemented
- **Ready for promotion:** promoted
- **Ready for closure:** yes, subject to final lifecycle lint/reconciliation and
  closure-reference checks

## Related Artifacts

- Requirements: `requirements.md`
- Change impact: `change-impact.md`
- Design: `design.md`
- Tasks: `tasks.md`
- Traceability: `traceability.md`
