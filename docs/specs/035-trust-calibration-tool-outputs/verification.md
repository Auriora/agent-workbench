---
title: Trust calibration in tool outputs verification
doc_type: spec
artifact_type: verification
status: active
owner: platform
last_reviewed: 2026-07-05
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Verification Plan

## Purpose

Define the validation evidence required before Spec 035 can claim implementation
readiness, durable promotion readiness, or closure readiness. This plan covers
the additive `meta.trust` contract, shared trust derivation, public MCP surface
coverage, representative golden responses, durable documentation promotion, and
final regression gates.

## Quality Gates

- Contract gate: trust schemas, exported types, additive compatibility, and
  deterministic generated arrays are covered by contract tests.
- Policy gate: `buildTrustCalibration` proves routing, parser-backed,
  direct-read, planned-validation, executed-validation, warning, error, stale,
  blocked, degraded, and invalid states do not overclaim.
- Envelope gate: public standard-envelope surfaces use `makeTrustedEnvelope`,
  and tests prove top-level warnings and errors affect `meta.trust`.
- Registry gate: every public resource and tool returning a standard envelope
  has a trust policy or explicit documented exclusion before presenter wiring
  begins.
- Golden gate: representative MCP and docs responses assert
  `safe_to_use_for`, `not_safe_to_use_for`, and `must_verify_by` semantics for
  each major tool family.
- Durable-doc gate: accepted behavior is promoted to runtime contracts, MCP
  surface design, documentation map, and backlog status before closure.

## Required Commands

Run focused checks as each phase completes:

```bash
pnpm exec vitest run tests/contracts/runtime-contracts.test.ts tests/contracts/response-metadata.test.ts
pnpm exec vitest run tests/mcp/registry-metadata.test.ts
pnpm exec vitest run tests/mcp/error-envelope-consistency.test.ts
```

Run family-specific tests after presenter wiring:

```bash
pnpm exec vitest run tests/mcp/repo-status-resource.test.ts tests/mcp/repo-scope-overview-resource.test.ts tests/mcp/integration-health-resource.test.ts
pnpm exec vitest run tests/docs/docs-presenter.test.ts tests/docs/markdown-quality.test.ts tests/mcp/docs-surfaces.test.ts
pnpm exec vitest run tests/mcp/context-for-task-tool.test.ts tests/mcp/query-tools.test.ts tests/mcp/diagnostics-for-files-tool.test.ts tests/mcp/verification-plan-tool.test.ts tests/mcp/workspace-edit-tools.test.ts
```

Run final checks before closure readiness:

```bash
pnpm typecheck
pnpm test
pnpm exec vitest run tests/docs/docs-links-metadata.test.ts
skills/spec-lifecycle-manager/scripts/spec_runtime.py lint docs/specs/035-trust-calibration-tool-outputs
git diff --check
```

Run Markdown quality checks for changed durable docs and spec files through the
Workbench Markdown tools when the MCP server is available.

## Evidence Log

- T001-T002: Complete on 2026-07-05. OQ001-OQ003 are resolved in requirements
  and design; direct registry inventory found 7 resources, 15 tools, 0 prompts,
  and no public standard-envelope exclusions.
- T003-T006: Complete on 2026-07-05. Added additive trust schemas, shared trust
  policy derivation, `makeTrustedEnvelope`, and focused tests. Validation:
  `pnpm exec vitest run tests/contracts/runtime-contracts.test.ts
  tests/contracts/response-metadata.test.ts` passed with 35 tests; `pnpm
  typecheck` passed.
- T011: Complete on 2026-07-06. Registry metadata now carries explicit trust
  policy for every public resource/tool and fails unmapped surfaces.
- T007-T010: Complete on 2026-07-06. Public presenters and the `docs_scope`
  registry tool now use `makeTrustedEnvelope`; focused Phase 3 tests passed
  with 150 tests and static search found no public presenter/registry
  `makeEnvelope` calls.
- T012-T013: Pending.
- T014-T016: Pending.

Record command output summaries, waivers, and review findings in `tasks.md`
before marking the corresponding task complete.

## Residual Risks

- A public surface may build an envelope through a private helper that bypasses
  trust derivation. T011 and golden tests are the mitigation.
- Existing consumers may assume the previous metadata shape. T003 must prove
  additive compatibility for consumers that parse or ignore optional fields.
- Trust arrays may become noisy or contradictory as policies expand. T004 must
  prove deterministic ordering and unsafe-wins conflict handling.
- Golden tests can become too broad to maintain. T012 should assert
  representative semantics per family instead of snapshotting unrelated output.

## Closure Readiness

The spec is ready to close only after all required commands pass or waivers are
explicitly recorded, durable docs describe the implemented current behavior, and
all review findings are fixed, rejected with rationale, or routed to a single
follow-up destination.
