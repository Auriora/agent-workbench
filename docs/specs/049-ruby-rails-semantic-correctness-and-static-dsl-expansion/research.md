---
title: Spec 049 Research
doc_type: spec
artifact_type: research
status: draft
owner: platform
last_reviewed: 2026-08-02
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Research notes

## Scope

- Clarify whether existing parser-backed Rails/Ruby DSL extraction can safely support the
  package’s singleton, namespace, routing, and association improvements before any runtime
  implementation work.

## Question

What Ruby/Rails parser-backed static extraction capability changes are safe, bounded, and
evidence-justified for Spec 049 without introducing runtime fallback paths?

## Options Considered

| Option | Summary | Pros | Cons | Notes |
|---|---|---|---|---|
| Keep route extraction unchanged | Preserve current behavior and defer all enhancements. | Low risk and fast. | Leaves known gaps in singleton/route/association coverage unresolved. | Supports strict minimal change only. |
| Extend static extraction in bounded forms | Add bounded handling for path scope, route helpers, and through/source_type/HABTM cases. | Improves analysis utility while staying parser-only. | Increases rule complexity and may defer more cases. | Chosen path with explicit deferrals. |
| Add runtime-aware execution | Use Rails boot/runtime data for complete route and association facts. | Higher completeness and certainty. | Violates repo preference for single parser path and increases fragility. | Explicitly out of scope. |

## Findings

- Prior Rails work in this repository already established the baseline for
  Ruby/Rails partial-semantic behavior in bounded parser-backed slices.
- There is an existing uncommitted follow-up area in the worktree covering root,
  through, source, and Docker validation/orientation improvements.
- That area is treated as pre-existing baseline, not as validated Spec 049 evidence.

- Singleton method canonical identity is feasible with current AST shapes.
- Namespace/path/module disambiguation is feasible with explicit nesting stacks.
- `through` and `source_type` parsing is feasible when both side targets are
  static and first-party.
- Validation-environment blocking reasons can be normalized without ecosystem coupling.
- Member/collection/on route actions are feasible in bounded static forms.
- `draw` route-file links are feasible for literal names; concern reuse also needs
  a first-class concern declaration identity and is deferred.
- HABTM edges need conservative ambiguity gating to avoid false-positive relation claims.

## Open questions

- Whether any additional route concern forms should be supported in-spec or deferred.
- Whether alias/visibility evidence should stay advisory only or be promoted to
  impact adjacency in a later package.
- Whether deeper static module loading should remain optional without parser route
  overloading.

## Defer register

- Redirects, mount/resolve, engine composition, runtime dispatch, dynamic inflection,
  and Rails boot execution remain outside Spec 049.

## Tradeoffs

- Increasing static scope and route handling adds value quickly but increases deferral surface.
- Keeping runtime paths out of scope improves determinism and lowers maintenance risk.
- Conservative advisory records reduce false positives but lower immediate coverage.

## Sources

- `docs/design/language-adapter-design.md`
- `docs/reference/language-capability-matrix.md`
- Existing fixtures and parser evidence in the Ruby/Rails extraction runtime.

## Confidence And Unknowns

- **Confidence:** medium
- **Known unknowns:**
  - Whether route-concern forms with dynamic names can be safely bounded.
  - Whether downstream durable docs require additional clarification for concern reuse.
- **Assumptions:**
  - Tree-sitter output is stable for the targeted syntax patterns.
  - No runtime parser fallback is introduced in this scope.
- **Evidence gaps:**
  - Full fixture suite for edge-case routing/action combinations.

## Recommendation

Proceed with bounded static expansion only, with explicit unresolved records for all dynamic,
ambiguous, or runtime-dependent cases.

## Decision Impact

- Requirement 5/6/7 behavior stays in this spec, with fallback-to-unresolved for unsupported forms.
- Verification remains implementation-dependent and should record any missing route edge cases as residual destinations.
- Durable documentation updates are still deferred until implementation evidence exists.

## Open questions and constraints

- Which concern-reuse edge cases are worth a follow-up spec versus remaining
  deferred.
- Whether validation-label normalization should move to a shared metadata enum.
  - Whether advisory Ruby helper-load evidence should remain in advisory channels or
  later become a dedicated contract field.

## Related Artifacts

- Requirements: `requirements.md`
- Design: `design.md`
- Tasks: `tasks.md`
