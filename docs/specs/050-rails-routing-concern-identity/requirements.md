---
title: Rails routing concern identity requirements
doc_type: spec
artifact_type: requirements
status: draft
owner: platform
last_reviewed: 2026-08-02
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Requirements

## Introduction

Agent Workbench extracts bounded Rails route and controller relationships but
does not give `concern` declarations a first-class identity. Consequently a
static `concerns` reuse site cannot link to the exact shared routing definition,
and navigation or impact analysis cannot explain which resources depend on that
definition. This spec adds only the static identity and reuse evidence that the
Ruby tree-sitter parse can prove.

## Goals

- Give each statically named Rails routing-concern declaration a stable,
  provenance-rich graph identity.
- Link statically named concern reuse sites to one unambiguous first-party
  declaration.
- Preserve surrounding resource, namespace, scope, path, module, and controller
  context in the extracted evidence.
- Make existing reference, impact, and task-context surfaces expose the new
  relationship without introducing a Ruby- or Rails-specific public fallback.
- Keep dynamic, missing, duplicate, recursive, and otherwise ambiguous forms
  explicit and unresolved.

## Non-Goals

- Booting Rails, evaluating `routes.rb`, or inspecting the runtime route set.
- Expanding Rails engines, mounts, redirects, `resolve`, configurable
  inflections, or dynamically generated concern names.
- General `ActiveSupport::Concern`, model concern, controller concern, or Ruby
  mixin semantics.
- Claiming that concern reuse proves runtime route availability, ordering,
  constraints, defaults, or dispatch.
- Adding AST, Prism, LSP, Rails runner, shell execution, lexical parsing, or any
  alternate parser or semantic fallback.
- Adding a second graph-query or compatibility path for the same capability.

## Glossary

| Term | Definition |
| --- | --- |
| Routing concern declaration | A Rails routes DSL `concern` block with a statically recoverable name. |
| Routing concern reuse | A Rails routes DSL `concerns` call that names one or more reusable routing concerns. |
| Concern identity | A stable graph identity tied to the declaration name, file, source range, parser provenance, and repository snapshot. |
| Static reuse edge | Parser-backed evidence from a reuse site to exactly one first-party declaration. |
| Expanded route evidence | Route relationships derived from statically bounded content inside a linked concern while retaining both declaration and reuse provenance. |
| Supported declaration name | A non-interpolated Ruby symbol literal in the block form `concern :name do ... end`. String names, callable declarations, and computed names are unsupported in this slice. |
| Supported reuse name | A non-interpolated Ruby symbol literal supplied to `concerns`, either directly, in a literal array, or through the `concerns:` option of `resource` or `resources`. |

## Durable source baseline

| Source | Current behavior relied on | Confidence | Notes |
| --- | --- | --- | --- |
| `docs/design/language-adapter-design.md` | Ruby uses one tree-sitter path; Rails relationships are bounded static navigation evidence. | high | Canonical adapter and fail-closed policy. |
| `docs/reference/language-capability-matrix.md` | Ruby/Rails is `partial_semantic`; concern identity is not currently claimed. | high | Capability must remain `partial_semantic`. |
| `docs/backlog/README.md` EB010 | Owns deeper Ruby/Rails semantics and the post-Spec-049 concern-identity residual. | high | This spec promotes only the bounded routing-concern slice. |
| `docs/reference/runtime-contracts.md` | Existing graph, provenance, confidence, coverage, and unresolved-reference vocabulary. | high | No public contract change is assumed. |
| `docs/reference/dogfood-evidence-ledger.md` | Owns bounded real-repository evidence and its limitations. | medium | Update only after fresh verification. |

## Durable impact

| Durable area | Action | Target | Notes |
| --- | --- | --- | --- |
| adapter design | modify | `docs/design/language-adapter-design.md` | Record delivered declaration/reuse forms and fail-closed boundaries. |
| capability reference | clarify | `docs/reference/language-capability-matrix.md` | Keep `partial_semantic`; add only verified concern support. |
| agent-visible behavior | modify | `docs/reference/agent-readable-changelog.md` | Explain new navigation evidence and limits. |
| product backlog | modify | `docs/backlog/README.md` | Mark this EB010 slice delivered and retain deeper/runtime forms. |
| dogfood evidence | modify after verification | `docs/reference/dogfood-evidence-ledger.md` | Record fresh results for both Rails repositories without universal claims. |

## Staged readiness

- **Current stage:** implementation complete; awaiting closure decision
- **Next stage:** closure review only when separately requested
- **Ready for final implementation handoff when:** architecture, requirements/QA,
  and lifecycle reviewers have no unresolved blocker and verification matches
  the delivered source, tests, dogfood limits, and durable promotion.
- **Design-first exception:** no
- **Optional artifacts recommended:** `research.md`, `change-impact.md`,
  `canonical-context.md`, `traceability.md`, and `verification.md`
- **Downstream review needed:** closure reconciliation only

## Requirements

### Requirement 1: First-class static declaration identity

**User Story:** As a coding agent, I want a routing concern declaration to have
its own identity, so that I can navigate to the shared route definition rather
than only seeing its contained controller targets.

**Priority:** must-have

#### Acceptance criteria

1. GIVEN a Rails routing `concern` declaration with a supported literal name,
   WHEN the Ruby file is indexed, THEN THE SYSTEM SHALL emit one declaration
   identity with source range, file path, parser provenance, and static evidence.
2. WHERE two declarations use the same name in the indexed first-party route
   domain, THE SYSTEM SHALL preserve both declarations and SHALL NOT select one
   as the unique target of reuse evidence.
3. IF a declaration name is dynamic or otherwise unsupported, THEN THE SYSTEM
   SHALL emit bounded unresolved evidence and SHALL NOT invent a declaration.
4. THE SYSTEM SHALL support only the block declaration form
   `concern :name do ... end`; callable declarations, string names,
   interpolated values, variables, and computed expressions SHALL remain
   unsupported and SHALL NOT be evaluated.

### Requirement 2: Static concern reuse links

**User Story:** As a coding agent, I want a static `concerns` use to link to its
declaration, so that references and impact analysis reveal shared routing
dependencies.

**Priority:** must-have

#### Acceptance criteria

1. GIVEN a reuse call containing one or more supported literal names, WHEN
   exactly one first-party declaration exists for a name, THEN THE SYSTEM SHALL
   emit a static reference from the reuse site to that declaration.
2. IF a named declaration is missing or ambiguous, THEN THE SYSTEM SHALL retain
   an unresolved reference with a bounded reason and SHALL NOT emit a hard edge.
3. IF any reuse operand is dynamic, THEN THE SYSTEM SHALL keep that operand
   unresolved without suppressing independently supported literal operands in
   the same call.
4. THE SYSTEM SHALL support symbol names in `concerns :name`, multiple direct
   symbol operands such as `concerns :first, :second`, literal symbol arrays
   such as `concerns [:first, :second]`, and symbol or literal-symbol-array
   values in the `concerns:` option of `resource` and `resources`.
5. String, interpolated, variable, method-call, splatted, and computed reuse
   operands SHALL remain unresolved; syntactically present option hashes MAY be
   retained as metadata but SHALL NOT be evaluated to claim route expansion.

### Requirement 3: Scope and provenance preservation

**User Story:** As a coding agent, I want concern reuse to retain its surrounding
route scope, so that affected resources are explainable without claiming a
booted route set.

**Priority:** must-have

#### Acceptance criteria

1. GIVEN concern reuse inside a supported resource, namespace, path scope,
   module scope, or controller scope, WHEN evidence is extracted, THEN THE
   SYSTEM SHALL retain the surrounding static scope metadata on the reuse
   evidence.
2. WHERE route relationships inside the concern are exposed at a reuse site,
   THE SYSTEM SHALL retain declaration and reuse provenance and SHALL avoid
   conflating homonymous controller or resource scopes.
3. IF scope composition cannot be bounded statically, THEN THE SYSTEM SHALL
   expose the declaration/reuse relationship only and SHALL NOT manufacture
   expanded controller or route targets.

### Requirement 4: Reference and impact integration

**User Story:** As a coding agent, I want existing navigation surfaces to expose
routing concern relationships, so that changing a shared concern produces a
bounded affected-site view.

**Priority:** must-have

#### Acceptance criteria

1. GIVEN a uniquely resolved routing concern, WHEN references or impact are
   queried through the existing graph route, THEN THE SYSTEM SHALL return its
   declaration and static reuse relationships with parser provenance.
2. THE SYSTEM SHALL use existing graph storage and query paths and SHALL NOT add
   a Rails-specific public query fallback or adapter-side parallel result path.
3. WHERE query coverage is complete only for supported parser forms, THE SYSTEM
   SHALL preserve the existing route-exhaustion boundary and SHALL NOT imply
   whole-program caller completeness.
4. GIVEN a task-context query seeded by a uniquely resolved declaration or
   reuse site, WHEN the existing graph path supplies related evidence, THEN THE
   SYSTEM SHALL expose the bounded concern relationship with its parser
   provenance and SHALL NOT use a Rails-specific task-context path.

### Requirement 5: Recursive and failure-safe behavior

**User Story:** As a tooling consumer, I want nested or malformed concerns to
fail safely, so that static navigation remains deterministic and trustworthy.

**Priority:** should-have

#### Acceptance criteria

1. GIVEN statically nested concern reuse, WHEN the relationship is acyclic and
   bounded, THEN THE SYSTEM SHALL preserve each declaration/reuse edge without
   duplicating identities.
2. IF concern reuse is recursive or cyclic, THEN THE SYSTEM SHALL terminate
   deterministically, retain bounded relationship evidence, and SHALL NOT loop
   or emit unbounded expansion.
3. IF tree-sitter cannot parse the relevant file, THEN THE SYSTEM SHALL retain
   the existing structured parser failure behavior and SHALL NOT invoke a
   lexical, executable, or alternate-parser fallback.

## Correctness properties

- **CP-001 Identity uniqueness:** Re-indexing identical source in the same
  snapshot produces the same concern declaration identities without duplicate
  nodes.
- **CP-002 Resolution soundness:** A hard reuse edge exists only when exactly
  one supported first-party declaration matches the static name.
- **CP-003 Provenance preservation:** Every declaration, reuse, and expanded
  relationship retains enough source and scope metadata to explain its origin.
- **CP-004 Fail-closed monotonicity:** Adding an ambiguous declaration may turn
  a resolved reuse into unresolved evidence but cannot silently select a
  different target.
- **CP-005 Bounded traversal:** Nested or cyclic concern reuse cannot create
  unbounded extraction, graph expansion, or query work.
- **CP-006 Single-path behavior:** All delivered evidence originates from the
  existing tree-sitter Ruby extraction and graph path with no fallback.

## Technical context

- **Language/version:** TypeScript ESM; Ruby parsed by `tree-sitter-ruby`
- **Primary dependencies:** existing Ruby parser adapter, extraction pipeline,
  graph store, reference resolver, and query use cases
- **Target platform:** local Agent Workbench runtime on supported Node.js hosts
- **Constraints:** no Ruby/Rails execution, no schema/public-contract change
  unless design review proves it necessary, no fallback, deterministic bounded
  evidence
- **Performance goals:** linear extraction in relevant syntax nodes; bounded
  graph resolution and query work under existing budgets

## Success criteria

- **SC-001:** Fixture tests prove declaration identity, one and multiple static
  reuse names, scoped reuse, missing/duplicate/dynamic forms, nesting, and cycle
  safety.
- **SC-002:** Graph tests prove unique resolved edges and conservative unresolved
  outcomes through existing reference and impact paths.
- **SC-003:** Existing Ruby/Rails regression tests, typecheck, and the bounded
  full suite pass without parser or query fallback.
- **SC-004:** Fresh read-only dogfood against two current Rails repositories of
  distinct project shape records supported-form coverage, indexing errors,
  partial or degraded surfaces, and unchanged target worktrees. Exact local
  checkout paths belong in ephemeral verification evidence, not durable
  ecosystem claims.
- **SC-005:** Durable docs describe delivered behavior as bounded static
  `partial_semantic` evidence and retain deeper/runtime semantics under EB010.

## Related artifacts

- Research: `research.md`
- Canonical context: `canonical-context.md`
- Change impact: `change-impact.md`
- Design: `design.md`
- Tasks: pending after design review
- Verification: pending
