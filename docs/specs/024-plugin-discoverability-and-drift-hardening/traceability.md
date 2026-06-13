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

T001:
Requirements 1, 2, and 6. Design sections: Marketplace Metadata, MCP Server
Card, and History Reconnaissance. Verification: research decision review plus
focused metadata tests. Durable targets: runbook and spec research/design.
Status: complete for Phase 1.

T002:
Requirement 1. Design section: Marketplace Metadata. Verification:
marketplace metadata assertions in `tests/integration/codex-integration-profile.test.ts`.
Durable targets: `.agents/plugins/marketplace.json` and the Codex plugin
runbook. Status: complete for Phase 1.

T003:
Requirement 2. Design section: MCP Server Card. Verification:
registry-to-server-card assertions in `tests/integration/codex-integration-profile.test.ts`.
Durable targets: `.well-known/mcp/server-card.json` and the Codex plugin
runbook. Status: complete for Phase 1.

T004:
Requirement 3. Design section: Drift Tests. Verification and durable targets
remain pending for Phase 2.

T005:
Requirement 4. Design section: Documentation Updates. Verification and durable
targets remain pending for Phase 2.

T006:
Requirement 5. Design section: CI Workflow. Verification and durable targets
remain pending for Phase 3.

T007:
Success criteria. Verification: typecheck, focused tests, full tests,
lifecycle checks, and closure readiness. Status: pending.

## Requirement To Delivery Matrix

Requirement 1:
Delivered by `.agents/plugins/marketplace.json` and the runbook marketplace
section. Verified by the focused marketplace metadata test.

Requirement 2:
Delivered by `.well-known/mcp/server-card.json` and the runbook MCP
discoverability section. Verified by the registry-to-server-card drift test.

Requirement 3:
Deferred to Phase 2.

Requirement 4:
Partially clarified in Phase 1 runbook updates. Full quick-start work remains
deferred to T005.

Requirement 5:
Deferred to Phase 3.

Requirement 6:
Delivered by the Phase 1 decision to defer history reconnaissance to a
follow-up debug command or skill workflow.

## Design To Implementation Matrix

Repo marketplace metadata:
Implemented in `.agents/plugins/marketplace.json` and covered by the
marketplace metadata test.

MCP server card:
Implemented in `.well-known/mcp/server-card.json` and covered by the
registry-to-server-card drift test.

External reference reconciliation:
Recorded in `research.md` and `design.md` decisions.

Operator locality and setup guidance:
Recorded in `docs/runbooks/codex-agent-workbench-plugin.md`.

## Open Decision Impact

Phase 1 resolves marketplace metadata, server-card maintenance, server-card
resource inclusion, and history reconnaissance scope for this slice. Skill,
prompt, docs, CI, and package-manifest drift decisions remain in their planned
later tasks.
