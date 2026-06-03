---
title: TimeLocker dogfood follow-up verification
doc_type: spec
status: draft
owner: platform
last_reviewed: 2026-06-03
---

# Verification

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

## Residual Risks

- TimeLocker is an external dogfood repository and should not become a required
  automated fixture dependency.
- Lexical reference evidence can improve recall but may create false positives
  if not clearly labeled.
- Nearest-test inference can be wrong in nonstandard test layouts; broad-suite
  fallback must remain available.
- More trust metadata may require public contract changes and compatibility
  review.

## Closure Criteria

This spec can close when:

- All tasks are marked done or explicitly deferred with rationale.
- Required automated gates pass.
- TimeLocker dogfood confirms `repo:///status` no longer times out.
- TimeLocker dogfood confirms nearest-test planning, exact symbol discovery,
  and graph confidence labels are materially improved.
- Accepted behavior is promoted to durable design/reference docs listed in
  [Design](design.md#promotion-targets).
