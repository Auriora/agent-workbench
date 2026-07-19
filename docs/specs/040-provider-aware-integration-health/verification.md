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
| Failing cross-client/health fixtures captured | yes | pending | T001 |
| Legacy Codex compatibility preserved | yes | pending | T001-T002 |
| Per-connection identity isolated across daemon clients | yes | pending | T003 |
| Static and argument-bearing health semantics proven | yes | pending | T004 |
| Identity provenance/mismatch guidance proven | yes | pending | T005 |
| Plugin/package/pack/full tests pass | yes | pending | T006 |
| Durable docs promoted and residuals owned | yes | pending | T007 |

## Validation Commands

| Command | Purpose | Result |
| --- | --- | --- |
| `pnpm exec vitest run tests/mcp/integration-health-contract.test.ts tests/mcp/integration-health-resource.test.ts tests/integration/codex-integration-profile.test.ts tests/integration/claude-plugin.test.ts tests/integration/mcp-launch.test.ts tests/mcp/daemon-launch.test.ts tests/mcp/daemon-entrypoint-integration.test.ts` | Focused contracts, profiles, health, launch, and daemon behavior | pending |
| `pnpm typecheck` | Contract and implementation types | pending |
| `pnpm validate:plugin` | Cross-client plugin/package drift | pending |
| `pnpm validate:skills` | Skill packaging consistency | pending |
| `pnpm pack:dry-run` | Distribution contents and metadata | pending |
| `pnpm test` | Full regression suite | pending |
| Spec Lifecycle Manager `lint_spec_package` | Package structure and traceability | pending |
| `git diff --check` | Diff hygiene | pending |

## Requirement And Property Coverage

| Requirement/property | Planned evidence | Residual risk |
| --- | --- | --- |
| Requirement 1 / CP-001 | Common/current/Codex/Claude/unknown profile fixtures | Public additive schema must remain compact. |
| Requirement 2 / CP-001 / CP-002 | Initialize, launcher, and mixed-daemon fixtures | Client names are client-controlled and variable. |
| Requirement 3 / CP-003 | Protocol-shaped static read and tool-input golden tests | Caller discovery remains self-reported evidence. |
| Requirement 4 / CP-004 / CP-005 | Observed/unknown/mismatch/non-comparable identity tests | Cache identity may be unavailable on some clients. |
| Requirement 5 | Compatibility, validator, skill, and package dry-run gates | Existing external consumers are unknown. |

## Agent Readiness Evidence

| Field | Evidence | Residual risk |
| --- | --- | --- |
| Scope | Provider profiles, per-connection identity, health semantics, version provenance | No implementation started. |
| Out of scope | Auto-update/network checks, provider runtime policy, EB019, fallbacks | none |
| Permissions | Repository source/tests/docs/package metadata only | Installed client changes require separate authority. |
| Validation | Commands above plus task-specific fixtures | Exact focused files may grow. |
| Review | Architecture, protocol, compatibility, and package review required | Public contract and daemon boundary. |
| Closure impact | Promote to integration/MCP/contracts/runbooks/changelog/backlog/history | pending |

## Evidence Log

| Date | Evidence | Result | Notes |
| --- | --- | --- | --- |
| 2026-07-19 | Direct source and composed-server review | defects confirmed | Server hard-codes Codex; static resource cannot receive tested pseudo-arguments. |
| 2026-07-19 | Launcher/daemon/package architecture mapping | boundaries identified | Initialize and explicit launcher context are distinct identity authorities. |
| 2026-07-19 | Requirements/design/task/traceability review | package reconciled | Verification gates reflect the final initial design and task split. |

## Residual Risks

- MCP client names/versions are client-controlled and require bounded mapping.
- Plugin/cache identity is provider-specific and may remain unknown; no guessing
  is allowed.
- Existing Codex schema/resource compatibility is a public-contract risk.
- The daemon handshake must not expose absolute user cache paths.

## Durable Promotion And Cleanup

| Spec content | Durable destination | Status |
| --- | --- | --- |
| common/current/provider profile model | coding-agent integration design | pending |
| health resource/tool semantics | MCP surface design; runtime contracts | pending |
| identity/provenance/mismatch contracts | runtime contracts | pending |
| operator recovery | plugin README and install/Codex runbooks | pending |
| delivery/residual state | backlog, changelog, history | pending |

## Readiness Decision

- **Ready for implementation:** yes, after T001 locks compatibility and resolves
  D004's narrow launcher/daemon identity field.
- **Ready for promotion:** no
- **Ready for closure:** no

## Related Artifacts

- Requirements: `requirements.md`
- Change impact: `change-impact.md`
- Design: `design.md`
- Tasks: `tasks.md`
- Traceability: `traceability.md`
