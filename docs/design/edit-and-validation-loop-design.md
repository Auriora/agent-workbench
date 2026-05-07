---
title: Edit and validation loop design
doc_type: design
status: draft
owner: platform
last_reviewed: 2026-05-07
---

# Edit And Validation Loop Design

## Purpose

Define the safe coding workflow for agent edits, post-edit feedback, and
targeted validation.

## Scope

This design covers the normal coding workflow, exploration workflow, edit
contracts, validation routing, fallback evidence, and prioritization of IDE
capabilities.

## Design Summary

The runtime should let agents use IDE-like capabilities without hiding risk.
Edits must be previewable, drift-checked, and rollbackable. Validation should be
planned from touched files, graph impact, diagnostics, and nearest tests rather
than broad scans by default.

## Coding Workflow

```text
repo_preflight
-> context_for_task
-> direct source read only for selected edit targets or low-confidence context
-> preview/apply edits
-> post_edit_feedback
-> verification_plan
-> run_nearest_tests
```

## Exploration Workflow

```text
repo:///overview
-> repo:///graph/report
-> symbol_search, graph_query, shortest_path, or community
-> exact files only when graph confidence needs verification
```

## Edit Contracts

| Operation | Required Behavior | Evidence |
| --- | --- | --- |
| Preview | Show targeted file/range changes before mutation | Preview token and affected scope |
| Apply | Apply only if preview still matches current files | Applied token and touched files |
| Concurrent modification check | Detect drift between preview and apply | Stale preview attention item |
| Rollback | Revert known applied mutation when possible | Rollback token |

## Validation Routing

Validation planning should consider:

- touched files
- graph impact
- nearest tests
- diagnostics and parser errors
- formatting and import cleanup
- capability level and degraded tooling
- public/exported API surface

## Fallback Evidence

Fallback to `rg`, `find`, broad file reads, or ad hoc validation is useful
product evidence. The runtime should record repeated fallback as usage gaps for
future ranking, contracts, index coverage, or trust metadata improvements.

## Capability Priority

1. Indexing, FTS, file tree, generated/vendor awareness.
2. Symbol search, definitions, references, callers, callees, impact.
3. Context builder with source section packing.
4. Diagnostics, type checking, formatting, nearest tests.
5. Import maintenance and simple semantic edits with preview/apply/rollback.
6. TODO, docs, project config, dependency context.
7. Safe rename and change signature for mature language backends.
8. Dead code, security, and framework-specific inspections.
9. Coverage and advanced refactors.

## Deferred Capabilities

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
