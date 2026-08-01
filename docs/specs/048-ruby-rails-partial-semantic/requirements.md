---
title: Ruby and Rails partial-semantic requirements
doc_type: spec
artifact_type: requirements
status: draft
owner: platform
last_reviewed: 2026-08-01
---

# Requirements

## Introduction

After Spec 047 establishes resource-backed Ruby/Rails discovery, Agent
Workbench needs one canonical parser-backed path for Ruby declarations,
references, conservative impact, and selected Rails framework relationships.
This slice promotes Ruby to `partial_semantic` without executing application
code or overstating the behavior of Ruby metaprogramming and Rails DSLs.

## Goals

- Add a mandatory tree-sitter Ruby extractor through the existing extraction
  port and graph pipeline.
- Expose Ruby declarations and bounded static references through symbol,
  reference, impact, context, and orientation surfaces.
- Add conservative, provenance-rich Rails route and model relationship evidence
  where fixtures prove a deterministic static form.
- Preserve degraded and unsupported states when parsing or resolution cannot
  support a claim.

## Non-Goals

- Full Ruby or Rails semantic support.
- Loading Rails, evaluating Ruby, resolving autoloading at runtime, connecting
  to a database, or executing Bundler/Rails/Rake/test commands.
- Using Ruby AST, Prism, Sorbet, RuboCop, Solargraph, Ruby LSP, Rails runner, or
  lexical/shell fallback as an alternate primary path.
- Claiming complete dynamic dispatch, mixin, concern, callback, route,
  association, scope, STI, engine, or monkey-patch resolution.
- Cross-language semantic edges or automated refactoring operations.

## Glossary

| Term | Definition |
|------|------------|
| Static Ruby form | A syntax form whose identity and operands are present in the parsed source without executing Ruby. |
| Rails DSL evidence | Parser-backed evidence for a bounded, fixture-approved Rails declaration form, not runtime Rails semantics. |
| Route exhaustion | Completion for the selected parser/reference route, explicitly bounded by supported forms and indexed files. |

## Durable Source Baseline

| Source | Current behavior relied on | Confidence | Notes |
|--------|----------------------------|------------|-------|
| `docs/history/spec-closure-log.md` (Spec 047, final commit `2f0b160`) | Ruby identity, Rails shape, fixtures and validation planning. | spec dependency | Must be reconciled against delivered code before this spec starts. |
| `docs/design/language-adapter-design.md` | Tree-sitter primary-path rule and semantic promotion gates. | high | Canonical adapter design. |
| `docs/reference/language-capability-matrix.md` | Ruby target is resource-backed then partial-semantic. | high | Updated by Spec 047 before this package closes. |
| `docs/reference/runtime-contracts.md` | Graph, capability, provenance, trust, coverage, and degraded-state vocabulary. | high | Public schemas stay language-neutral. |
| `docs/backlog/README.md` EB010 and EB061 | Fixture-gated language promotion and parser-route coverage disclosure. | high | Both concerns constrain this spec. |

## Durable Impact

| Durable area | Action | Target | Notes |
|--------------|--------|--------|-------|
| design | modify | `docs/design/language-adapter-design.md` | Record delivered Ruby/Rails partial-semantic forms and limits. |
| reference | modify | `docs/reference/language-capability-matrix.md` | Set current Ruby/Rails level only after verification. |
| contracts | clarify or modify | `docs/reference/runtime-contracts.md` | Coverage-domain disclosure must remain generic. |
| graph design | clarify if needed | `docs/design/graph-store-design.md` | Only for new generic resolution or metadata behavior. |
| backlog | modify | `docs/backlog/README.md` | Update EB010 and EB061 disposition; route deeper semantics. |

## Staged Readiness

- **Current stage:** implementation
- **Next stage:** native grammar integration, then parser extraction
- **Ready to implement when:** satisfied by the Spec 047 closure reconciliation
  recorded in T001. Tree-sitter Ruby dependency/build viability is the first
  implementation proof in T002, not a prerequisite hidden outside the task.
- **Design-first exception:** no
- **Optional artifacts included:** `canonical-context.md`, `change-impact.md`,
  `traceability.md`, `verification.md`
- **Downstream review needed:** design and traceability were refreshed after
  this requirements revision; architecture, implementation, security/trust,
  and verification review remain required against the implemented diff.

## Requirements

### Requirement 1: Canonical Ruby parser path

**User Story:** As a maintainer, I want one tree-sitter Ruby extraction path so
that Ruby evidence follows the same architecture and failure rules as existing
parser-backed languages.

**Priority:** must-have

#### Acceptance Criteria

1. GIVEN a supported `.rb` file, WHEN graph extraction runs, THEN the system
   SHALL use the registered tree-sitter Ruby adapter as the only primary Ruby
   parser.
2. IF the grammar is unavailable, incompatible, times out, or crashes, THEN the
   system SHALL return structured degraded or blocked evidence and SHALL NOT
   substitute another parser, lexical scan, Ruby process, LSP, or partial
   success.
3. THE SYSTEM SHALL keep parser lifecycle, source ranges, provenance,
   capability, and error behavior consistent with existing extraction ports.

### Requirement 2: Ruby declaration extraction

**User Story:** As a coding agent, I want Ruby declarations indexed so that I
can navigate repository structure without broad lexical search.

**Priority:** must-have

#### Acceptance Criteria

1. GIVEN supported static forms, WHEN extraction completes, THEN the system
   SHALL emit parser-backed nodes for modules, classes, singleton classes where
   identity is stable, instance methods, singleton methods, and constants.
2. WHERE qualified nesting or inheritance is statically present, THE SYSTEM
   SHALL retain bounded identity metadata and provenance without claiming
   runtime constant lookup or method resolution.
3. Ambiguous, anonymous, dynamic, reopened, generated, or unsupported forms
   SHALL remain explicit, bounded, and non-semantic rather than being silently
   merged into a confident symbol.

### Requirement 3: Ruby references and conservative impact

**User Story:** As a coding agent, I want useful static Ruby references so that
I can estimate local change impact with visible limitations.

**Priority:** must-have

#### Acceptance Criteria

1. GIVEN `require`, `require_relative`, inheritance, constant, or statically
   named call/reference forms approved by fixtures, WHEN extraction runs, THEN
   the system SHALL emit parser-backed references with form, provenance, source
   range, and confidence.
2. WHERE a candidate resolves uniquely within the indexed first-party graph,
   THE SYSTEM MAY create a conservative edge; ambiguity SHALL remain unresolved
   with candidate or reason evidence.
3. `find_references` and `impact` SHALL disclose the supported parser-route
   coverage domain and SHALL NOT present route exhaustion as whole-program Ruby
   or Rails completeness.

### Requirement 4: Bounded Rails framework relationships

**User Story:** As a Rails developer, I want common Rails declarations linked
conservatively so that navigation crosses framework conventions without
pretending Rails has been executed.

**Priority:** should-have

#### Acceptance Criteria

1. GIVEN fixture-approved static route declarations, WHEN parsed, THEN the
   system SHALL expose route, controller/action candidate, source-range, and
   confidence evidence without claiming the application route set is complete.
2. GIVEN fixture-approved static model association, validation, callback, or
   concern forms, WHEN parsed, THEN the system SHALL expose bounded DSL evidence
   and unresolved targets unless graph identity is unambiguous.
3. Dynamic blocks, metaprogrammed names, computed options, engine mount runtime
   behavior, and environment-dependent configuration SHALL remain unsupported
   or unresolved with explicit coverage limits.

### Requirement 5: Promotion and regression evidence

**User Story:** As a maintainer, I want representative proof and durable limits
so that `partial_semantic` is a calibrated capability rather than a parser
existence claim.

**Priority:** must-have

#### Acceptance Criteria

1. Fixtures SHALL cover nested/reopened constants, duplicate names, aliases,
   relative requires, ambiguity, dynamic forms, Rails routes, models, concerns,
   generated/vendor boundaries, add/modify/delete/rename freshness, parser
   failure, and constrained validation policy.
2. Query, context, orientation, trust, degraded-state, and response-budget tests
   SHALL agree on capability and coverage metadata.
3. Existing language, framework, workspace-safety, and MCP contracts SHALL not
   regress.
4. Full `semantic` Ruby/Rails support and deeper dynamic forms SHALL be routed
   to explicit backlog items or follow-up specs before closure.

## Correctness Properties

- **CP-001:** Every parser-backed Ruby node and reference has a valid source
  range, parser provenance, and capability metadata tied to the extracted file.
- **CP-002:** The resolver never turns two or more plausible Ruby/Rails targets
  into a unique edge.
- **CP-003:** Parser-route completion always names or identifies its supported
  coverage domain and never implies whole-program completeness.
- **CP-004:** Parser failure produces a structured non-success state without an
  alternate parser or partial-result fallback.
- **CP-005:** Rails DSL evidence is no more confident than the static form and
  indexed graph justify.

## Technical Context

- **Language/Version:** TypeScript ESM runtime; Ruby syntax parsed through a
  compatible tree-sitter Ruby grammar.
- **Primary Dependencies:** Spec 047 output, extractor registry, tree-sitter
  pipeline, graph resolver/store, query/context presenters, Vitest fixtures.
- **Target Platform:** supported Agent Workbench Node platforms with native
  parser build/load support.
- **Constraints:** no Ruby execution; one explicit parser path; no hidden
  semantic, LSP, AST, lexical, or command fallback.
- **Performance Goals:** parser and graph work remain within existing bounded
  file/query budgets; large-repository completion remains governed by EB014.

## Success Criteria

- **SC-001:** Ruby files expose calibrated `partial_semantic` declaration and
  reference evidence through common graph surfaces.
- **SC-002:** Ambiguous and dynamic Ruby/Rails forms remain unresolved or
  unsupported with actionable limits.
- **SC-003:** Representative Rails routes and model DSL forms improve navigation
  without runtime-semantic claims.
- **SC-004:** Native build, focused fixtures, typecheck, full tests, package
  gates, dogfood, and expert review complete successfully.

## Related Artifacts

- Change Impact: `change-impact.md`
- Design: `design.md`
- Tasks: `tasks.md`
- Traceability: `traceability.md`
- Verification: `verification.md`
