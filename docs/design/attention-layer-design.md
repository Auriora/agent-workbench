---
title: Attention layer design
doc_type: design
status: draft
owner: platform
last_reviewed: 2026-05-07
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Attention Layer Design

## Purpose

Define how the runtime surfaces timely, scoped guidance that changes an agent's
next action.

## Scope

This design covers MVP blocker/warning attention, lifecycle, ranking,
deduplication, and post-MVP attention expansion.

## Design Summary

Human IDEs guide attention with visual cues. Agents need the underlying facts as
machine-readable guidance. The MVP should emit only blockers and warnings when
the information changes the safe next action. Clean edits with complete
validation plans should remain quiet.

## Attention Item Shape

Attention item shape is owned by
[Runtime contracts](../reference/runtime-contracts.md).

## Severities

- `blocker`: continuing would be unsafe or misleading, such as syntax failure,
  stale edit preview, or unresolved required target.
- `warning`: continuing is possible, but the result needs caveats or
  validation, such as heuristic references or unresolved dynamic usage.
Post-MVP severities:

- `nudge`: low-cost repair or cleanup, such as import cleanup or formatting.
- `context`: a relevant planning fact, such as generated-source ownership or
  public API surface.

## Kinds

- `stale_preview`
- `syntax_error`
- `missing_tool`
- `low_confidence`
- `validation_blocked`
- `path_refused`
- `command_refused`

Post-MVP kinds include ambiguity, broad scope changes, nudges, rollback
availability, and refactoring-specific risks.

## Lifecycle And Noise Control

- Emit an item only when it changes the next safe action.
- Deduplicate by severity, kind, scope, and next action.
- Expire stale preview items when a new preview is created.
- Expire missing-tool and validation-blocked items when the validation plan is
  regenerated.
- Do not emit attention for clean edits with complete validation plans.
- Keep default MVP visibility to blockers and warnings.

## Injection Points

- `context_for_task`: missing language support, low confidence, generated/vendor
  boundaries, and required direct reads.
- `preview_workspace_edit`: unsafe paths, generated/vendor writes, or broad
  replacement fallbacks.
- `apply_workspace_edit`: drift, refused paths, and parse blockers.
- `verification_plan`: blocked validation, missing tools, and commands that are
  planned but not executed.

## Refactoring Examples

- Rename: detected usages, unresolved possible usages, templates, route names,
  string literals, or config keys.
- Change signature: callers missing required parameters, overrides that no
  longer match, and interface implementations that need updates.
- Safe delete: live non-test references, exported symbols, public API mentions,
  or unresolved dynamic references.
- Move symbol: imports requiring update, package boundary changes, generated
  source ownership, and affected tests.

## Related Docs

- [MCP surface design](mcp-surface-design.md)
- [Edit and validation loop design](edit-and-validation-loop-design.md)
- [Runtime requirements](../requirements/runtime-requirements.md)
- [Runtime contracts](../reference/runtime-contracts.md)
- [MVP proof matrix](../reference/mvp-proof-matrix.md)
