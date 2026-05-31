---
title: Edit and validation loop design
doc_type: design
status: draft
owner: platform
last_reviewed: 2026-05-07
---

# Edit And Validation Loop Design

## Purpose

Define the safe MVP coding workflow for scoped context, bounded edits, and
validation planning.

## Scope

This design covers the normal coding workflow, bounded edit contracts,
validation planning, deferred refactors, and prioritization of IDE capabilities.

## Design Summary

The runtime should let agents use IDE-like capabilities without hiding risk.
MVP edits must be previewable and drift-checked. Rollback, command execution,
import mutation, and semantic refactors are post-MVP unless fixture-proven.
Validation should be planned from touched files, graph impact, diagnostics, and
known test hints rather than broad scans by default.
Documentation validation should also plan Markdown structure, compliance, link,
and readability checks when Markdown files or documentation policy files are
touched.
Agent-facing feedback should stay quiet unless it is actionable. Static
analysis on file change is valuable because it catches issues early, but
no-finding results should be silent and optional analyzer failures should not
interrupt the agent unless they block the requested edit or validation plan.

Edit and validation behavior is implemented through named use cases and
policies, not a shared workflow service. `PreviewWorkspaceEdit`,
`ApplyWorkspaceEdit`, and `PlanVerification` coordinate domain policies and
ports; presenters convert their results into MCP envelopes.

## Coding Workflow

```text
repo:///status and repo:///scope
-> context_for_task
-> direct source read only for selected edit targets or low-confidence context
-> preview/apply edits
-> verification_plan
-> manual or future allowlisted command execution
```

## Branch Gates

- If freshness is `stale` or `refreshing`, do not mutate until a fresh preview
  is created.
- If capability is below the requested operation's required level, return a
  warning and require direct source verification.
- If validation commands are unavailable or unsafe to execute, return a
  `blocked` validation plan instead of pretending validation is done.
- If a target path violates the workspace safety contract, refuse the edit.

## Edit Contracts

| Operation | Required Behavior | Evidence |
| --- | --- | --- |
| Preview | Show targeted file/range changes before mutation | Preview token, base hashes, affected files |
| Apply | Apply only if preview still matches current files and paths are allowed | Applied token, touched files, drift result |
| Drift check | Built into apply, based on file identity and base hash | Stale preview blocker |
| Rollback | Post-MVP unless bounded token storage is fixture-proven | Rollback token |

Preview/apply token shape is owned by
[Runtime contracts](../reference/runtime-contracts.md). Path containment and
write rules are owned by [Workspace safety contract](../reference/workspace-safety-contract.md).

## Validation Routing

Validation planning should consider:

- touched files
- graph impact
- nearest tests
- diagnostics and parser errors
- formatting and import cleanup
- capability level and degraded tooling
- public/exported API surface
- Markdown heading/list/table/link/frontmatter quality for touched
  documentation

MVP validation is plan-only by default. Command execution requires a post-MVP
allowlist and command runner safety contract.

Validation architecture is split from the start:

- validation discovery identifies available diagnostics, formatters, linters,
  and tests
- validation planning chooses commands/checks and blocked reasons
- command safety policy classifies whether execution is allowed
- validation execution and result capture are post-MVP
- validation presentation reports planned, blocked, done, or not-applicable
  status consistently
- feedback presentation suppresses no-op/no-finding results and non-blocking
  optional analyzer failures

## File-Change Feedback

File-change feedback is a retained post-edit workflow from the predecessor
runtime, but the restart should make it less distracting:

- Run static checks only through explicit provider contracts.
- Translate provider output into the public feedback schema; do not pass through
  backend tool names or raw output.
- Return actionable findings, blockers, concise next actions, and affected
  paths only.
- Return nothing, or minimal metadata, when all checked files are clean.
- Fail quietly for files an optional analyzer cannot process unless the current
  tool promised analysis for those files.
- Keep check selection focused on touched files and known impact; do not expand
  into broad diagnostics or test execution without an explicit tool call.

Candidate checks include parser syntax checks, formatter/lint planning,
type-check routing, documentation structure checks, config validation, and
future framework-specific analyzers. Each check must declare whether it is
blocking, advisory, optional, or unavailable.

Markdown formatting is handled through the same preview/apply safety path as
code edits. A formatter may plan or preview improvements for plain-text
readability, such as table alignment or table-to-list rewrites, but it must not
mutate files without a preview token and stale-preview checks.

## Fallback Evidence

Fallback to `rg`, `find`, broad file reads, or ad hoc validation is useful
product evidence. MVP may note these as local warnings; persisted usage-gap
analytics are post-MVP.

## Capability Priority

1. Indexing, FTS, file tree, generated/vendor awareness.
2. Symbol search, definitions, references, callers, callees, impact.
3. Context builder with source section packing.
4. Validation planning for diagnostics, type checking, formatting, and tests.
5. Quiet file-change static feedback for touched files.
6. Bounded edit preview/apply with drift checks.
7. TODO, docs, project config, dependency context.
8. Safe rename and change signature for mature language backends.
9. Dead code, security, and framework-specific inspections.
10. Coverage and advanced refactors.

## Deferred Capabilities

- Command execution beyond planning until allowlisted command safety exists.
- Rollback unless bounded token storage is fixture-proven.
- Import maintenance and formatting mutation unless previewed and explicitly
  applied.
- Refactor planning interfaces may exist before implementation; refactor
  semantics must not live in the edit apply path.
- Broad quick fixes and intention actions until each action has preconditions,
  preview, and validation.
- Advanced refactors such as pull up, push down, extract interface, broad move,
  or whole-project safe delete until language backends have strong evidence.
- Coverage reports until nearest-test routing and validation gaps are reliable.
- Security inspections until provenance, severity, suppressions, and advice
  boundaries are clear.

## Related Docs

- [MCP surface design](mcp-surface-design.md)
- [Attention layer design](attention-layer-design.md)
- [Runtime requirements](../requirements/runtime-requirements.md)
- [Runtime contracts](../reference/runtime-contracts.md)
- [Workspace safety contract](../reference/workspace-safety-contract.md)
- [MVP proof matrix](../reference/mvp-proof-matrix.md)
- [Markdown document quality design](markdown-document-quality-design.md)
