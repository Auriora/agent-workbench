---
title: Attention layer design
doc_type: design
status: draft
owner: platform
last_reviewed: 2026-05-07
---

# Attention Layer Design

## Purpose

Define how the runtime surfaces timely, scoped guidance that changes an agent's
next action.

## Scope

This design covers attention item shape, severity, kinds, injection points, and
refactoring-specific examples.

## Design Summary

Human IDEs guide attention with visual cues. Agents need the underlying facts as
machine-readable guidance. The runtime should emit attention items only when the
information changes the safe or efficient next action. Clean edits with complete
validation should remain quiet.

## Attention Item Shape

```json
{
  "severity": "blocker|warning|nudge|context",
  "kind": "syntax_error|rename_risk|verification_gap|scope_change",
  "scope": {
    "files": ["src/auth/session.ts"],
    "symbols": ["UserSession"],
    "ranges": [{"file": "src/auth/session.ts", "line": 84}]
  },
  "message": "Edited file no longer parses.",
  "why_this_matters": "Later symbol and test results are unreliable until syntax is fixed.",
  "evidence": {
    "source": "parser",
    "freshness": "fresh",
    "trust_level": "semantic"
  },
  "next_action": {
    "tool": "diagnostics_for_files",
    "args": {"files": ["src/auth/session.ts"]}
  }
}
```

## Severities

- `blocker`: continuing would be unsafe or misleading, such as syntax failure,
  stale edit preview, or unresolved required target.
- `warning`: continuing is possible, but the result needs caveats or
  validation, such as heuristic references or unresolved dynamic usage.
- `nudge`: low-cost repair or cleanup, such as import cleanup or formatting.
- `context`: a relevant planning fact, such as generated-source ownership or
  public API surface.

## Kinds

- `ambiguity`: multiple plausible files, symbols, commands, or test targets.
- `blocker`: syntax errors, parse failures, stale previews, or missing required
  tooling.
- `risk_flag`: dynamic references, framework bindings, generated source,
  exported/public API changes, or non-semantic language coverage.
- `scope_change`: touched files or affected files expanded beyond the planned
  validation slice.
- `staleness`: index, diagnostics, test discovery, or preview state is stale.
- `verification_gap`: diagnostics, tests, or dependency checks have not proven
  the current change.
- `rollback_available`: a mutation can be reverted with a known token.

## Injection Points

- `context_for_task`: planning ambiguity, generated/vendor boundaries, missing
  language support, risky files, likely tests, and required direct reads.
- `preview_workspace_edit`: missed rename surfaces, dynamic references, public
  API changes, stale targets, or broad replacement fallbacks.
- `apply_workspace_edit`: drift, unexpected touched files, parse errors, and
  rollback tokens.
- `post_edit_feedback`: syntax errors, diagnostics, import cleanup, formatting
  changes, test gaps, and repair order.
- `verification_plan`: what is proven, what is planned, and which validation
  command gives the cheapest useful evidence.
- Pre-final response checks: unvalidated touched files, blocked tests, stale
  diagnostics, or caveats the agent should mention.

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
