---
title: Plugin discoverability and drift hardening traceability
doc_type: spec
artifact_type: traceability
status: active
owner: platform
last_reviewed: 2026-06-13
---

# Traceability

## Task To Context Matrix

| Task ID | Requirements | Design | Status |
| --- | --- | --- | --- |
| T001 | Requirements 1, 2, 6 | Metadata decisions | Complete |
| T002 | Requirement 1 | Marketplace Metadata | Complete |
| T003 | Requirement 2 | MCP Server Card | Complete |
| T004 | Requirement 3 | Drift Tests | Complete |
| T005 | Requirement 4 | Documentation Updates | Complete |
| T006 | Requirement 5 | CI Workflow | Pending |
| T007 | Success criteria | Operations | Pending |

T004 verification:
Profile, prompt, skill, docs, and `.mcp.json` drift tests are implemented in
`tests/integration/codex-integration-profile.test.ts`. Durable targets are the
integration tests and plugin/runbook guidance.

T005 verification:
Operator documentation updates are implemented in the plugin README, Codex
plugin runbook, and documentation map.

## Requirement To Delivery Matrix

Requirement 1:
Delivered by `.agents/plugins/marketplace.json` and the runbook marketplace
section. Verified by the focused marketplace metadata test.

Requirement 2:
Delivered by `.well-known/mcp/server-card.json` and the runbook MCP
discoverability section. Verified by the registry-to-server-card drift test.

Requirement 3:
Delivered by Phase 2 drift checks for profile bindings, default prompts, skill
wording, documented MCP names, and `.mcp.json` launcher ownership. Verified by
the focused Codex integration profile test.

Requirement 4:
Delivered by Phase 2 plugin README, runbook troubleshooting, hook trust,
missing launcher recovery, and documentation map updates. Verified by the
focused documented-surface drift test and Markdown checks.

Requirement 5:
Deferred to Phase 3 CI/package validation.

Requirement 6:
Delivered by the Phase 1 decision to defer history reconnaissance to a
follow-up debug command or skill workflow.

## Design To Implementation Matrix

Repo marketplace metadata:
Implemented in `.agents/plugins/marketplace.json` and verified by the
marketplace metadata test.

MCP server card:
Implemented in `.well-known/mcp/server-card.json` and verified by the
registry-to-server-card drift test.

Drift tests:
Implemented in `tests/integration/codex-integration-profile.test.ts` and
verified by the focused Vitest run.

Operator locality and setup guidance:
Implemented in `plugins/agent-workbench/README.md` and
`docs/runbooks/codex-agent-workbench-plugin.md`; verified by Markdown checks
and docs drift assertions.

Documentation ownership:
Implemented in `docs/reference/documentation-map.md` and verified by Markdown
checks.

## Open Decision Impact

Phase 1 resolved marketplace metadata, server-card maintenance, server-card
resource inclusion, and history reconnaissance scope. Phase 2 resolved the
skill, prompt, profile, docs, and `.mcp.json` drift-test approach plus
first-run/operator documentation coverage. CI and package-manifest drift
decisions remain in Phase 3.
