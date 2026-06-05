---
title: TimeLocker dogfood follow-up verification
doc_type: spec
status: archived
owner: platform
last_reviewed: 2026-06-05
---

# Verification

## Closure Record

Spec 002 closed on 2026-06-05. All closure criteria below are satisfied with
documented caveats. Caveats that remain relevant across repositories are routed
to [Spec 003](../003-cross-repo-trust-discovery/requirements.md).

## Validation Plan

Required automated gates:

- `pnpm typecheck`
- `pnpm test`
- Focused MCP tests for status, context, symbol search, references, impact,
  verification planning, overview, and workspace edit behavior.
- Budget tests proving `repo:///status` returns without broad catalog
  enumeration.
- Fixture tests with TimeLocker-shaped Python classes, methods, validation
  services, and nearest-test layouts.
- Contract tests for any new public trust or intended-use metadata.
- Golden or snapshot tests for compact next-action ordering.

Manual dogfood gate:

- Restart Agent Workbench MCP in TimeLocker.
- Read `repo:///status`, `repo:///scope`, and `repo:///overview`.
- Run `context_for_task` for:
  - RepositoryResolver code/test task
  - validation-service static-analysis task
  - documentation-only update task
- Run `symbol_search` for:
  - `RepositoryResolver`
  - `RepositoryResolver.resolve_repository`
  - `ConfigValidationService`
- Run `find_references` and `impact` for at least one implementation class.
- Run `verification_plan` for representative Python and docs changes.
- Confirm preview/apply safety behavior remains unchanged.

## Evidence Log

| Date | Scope | Evidence | Result |
|------|-------|----------|--------|
| 2026-06-03 | Spec intake | TimeLocker evaluation note reviewed from `/home/bcherrington/Projects/Auriora/TimeLocker/docs/updates/2026-06-03-095911-agent-workbench-python-agent-ide-evaluation.md` | Follow-up requirements captured |
| 2026-06-05 | T001-T004, T006-T007 implementation | `pnpm typecheck`; `pnpm exec vitest run tests/runtime/status.test.ts tests/mcp/repo-status-resource.test.ts tests/mcp/verification-plan-tool.test.ts tests/mcp/repo-scope-overview-resource.test.ts tests/graph/query-tools.test.ts tests/architecture/layer-boundaries.test.ts` | Passed |
| 2026-06-05 | T005 implementation | `pnpm exec vitest run tests/graph/query-tools.test.ts tests/contracts/runtime-contracts.test.ts tests/mcp/query-tools.test.ts` | Passed |
| 2026-06-05 | T008 TimeLocker dogfood retest | `/home/bcherrington/Projects/Auriora/TimeLocker/docs/updates/2026-06-05-105635-agent-workbench-retest.md` | Accepted with caveats |

## Residual Risks

- TimeLocker is an external dogfood repository and should not become a required
  automated fixture dependency.
- Lexical reference evidence can improve recall but may create false positives
  if not clearly labeled.
- Nearest-test inference can be wrong in nonstandard test layouts; broad-suite
  fallback must remain available.
- More trust metadata may require public contract changes and compatibility
  review.
- TimeLocker status returned promptly but reported `warmup_state: failed` with
  `Unknown snapshot id: 1780653277649`; this should become a follow-up bugfix
  rather than being treated as a timeout regression.
- TimeLocker validation-service context still ranked matching tests ahead of
  implementation definitions for one URI task; follow-up ranking work should
  prefer explicit implementation files when supplied.
- `ConfigValidationService` did not resolve because TimeLocker uses
  `ValidationService`; non-existent symbol behavior should be documented
  separately from failed exact lookup.

## Closure Criteria

This spec can close when:

- All tasks are marked done or explicitly deferred with rationale. Completed on
  2026-06-05.
- Required automated gates pass. `pnpm typecheck` and `pnpm test` passed on
  2026-06-05 after implementation.
- TimeLocker dogfood confirms `repo:///status` no longer times out. Confirmed
  with degraded warmup caveat.
- TimeLocker dogfood confirms nearest-test planning, exact symbol discovery,
  and graph confidence labels are materially improved. Confirmed with caveats
  recorded above.
- Accepted behavior is promoted to durable design/reference docs listed in
  [Design](design.md#promotion-targets). Runtime contracts, MCP surface,
  coding-agent integration, ADR/research cleanup, and restart concept docs were
  updated during this implementation.
