---
title: Spec 049 Requirements
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

This package delivers parser-backed Ruby/Rails semantic improvements while keeping
runtime dispatch and dynamic execution out of scope. The behavior is bounded to
static evidence quality that is already bounded by tree-sitter confidence and
first-party file scope.

## Goals

- Correctly collapse singleton method identity across Ruby `def self.x` and
  `class << self`.
- Improve namespace and module-scope resolution for Rails routing and model symbols.
- Strengthen static association safety for `through`, `source_type`, and HABTM.
- Normalize validation-block provenance labels without ecosystem lock-in.
- Expand static routing evidence for controller/resource/action options, member,
  collection, and custom action forms.
- Add static route-file linking through `draw` and constrained concern reuse.
- Include only conservative evidence for `load`, `autoload`, alias, and visibility.

## Non-Goals

- Ruby boot execution, runtime route-set evaluation, engine dispatch, or direct
  refinements.
- Redirects, mount, resolve, and direct engine composition behavior.
- Static Rails concern reuse edges until the graph has a first-class concern
  declaration identity; emitting a name-only hard edge would be misleading.
- Alternative parser paths, AST/LSP-driven primary extraction, or shell fallback.
- Dynamic inflection configuration execution and runtime validation routing.

## Durable Source Baseline

| Source | Current behavior relied on | Confidence | Notes |
| --- | --- | --- | --- |
| `docs/design/language-adapter-design.md` | Parser-backed Ruby extraction and partial-semantic policy | high | Canonical for adapter layering and evidence policy. |
| `docs/reference/language-capability-matrix.md` | Ruby/Rails level and boundaries | high | Existing capability level is `partial_semantic`. |
| `docs/reference/agent-readable-changelog.md` | Prior Ruby/Rails behavior deltas | medium | Use as historical evidence context, not complete source-of-truth. |
| `docs/reference/dogfood-evidence-ledger.md` | Current dogfood baseline and deferral evidence | medium | Helps prevent repeating deferred-runtime claims. |
| `docs/backlog/README.md` | Backlog routing and follow-up boundaries | medium | Needed for promotion routing. |

## Durable Impact

| Durable area | Action | Target | Notes |
| --- | --- | --- | --- |
| design | modify | `docs/design/language-adapter-design.md` | Update Ruby/Rails static behavior wording for canonical singleton and DSL evidence boundaries. |
| reference | clarify | `docs/reference/language-capability-matrix.md` | Keep Ruby/Rails `partial_semantic` while clarifying static scope. |
| reference | clarify | `docs/reference/agent-readable-changelog.md` | Add Spec 049 agent-visible behavior guidance. |
| backlog | modify | `docs/backlog/README.md` | Record follow-up and deferred areas. |
| reference | modify | `docs/reference/dogfood-evidence-ledger.md` | Add follow-up baseline or evidence entry for this repair scope only when verified. |

## Staged Readiness

- **Current stage:** closure
- **Next stage:** record closure metadata and remove the temporary package
- **Ready to close:** yes; all goals, non-goals, requirements, acceptance
  criteria, and correctness properties have implementation and verification
  evidence.
- **Design-first exception:** no
- **Optional artifacts recommended:** traceability, verification, research
- **Downstream review needed:** none within this package
- **Open readiness blocks:** none

## Requirements

### Requirement 1: Canonical singleton method identity

**User Story:** As a coding agent, I want a unified method identity for `def self.x`
and `class << self` methods, so references and impact lookups are consistent.

**Priority:** must-have

#### Acceptance Criteria
1. GIVEN a class with `def self.action`, WHEN the class defines the same method
   inside `class << self`, THEN THE SYSTEM SHALL normalize both as one canonical
   singleton identity.
2. IF one declaration is static and the receiver is unambiguous, THEN THE SYSTEM
   SHALL emit one bounded method node with confidence matching parser evidence.

### Requirement 2: Rails scope-aware static symbol resolution

**User Story:** As a runtime consumer, I want namespace and module scope to be
distinguished in static resolution, so route/controller targets do not cross-link
across unrelated scopes.

**Priority:** must-have

#### Acceptance Criteria
1. GIVEN a route or controller declaration in nested modules, WHEN resolving
   references, THEN THE SYSTEM SHALL preserve module-scope and path-scope context.
2. WHERE module nesting differs, THE SYSTEM SHALL avoid conflating homonymous
   controllers and emit unresolved evidence instead of an incorrect hard link.

### Requirement 3: Association static safety

**User Story:** As an agent, I want bounded model association evidence for
through/source_type/HABTM edges, so graph impact stays conservative and explainable.

**Priority:** must-have

#### Acceptance Criteria
1. GIVEN an association call using `through` and `source_type`, WHEN both sides are
   static and first-party, THEN THE SYSTEM SHALL emit bounded association edges.
2. IF association targets are ambiguous, dynamic, or cross-domain, THEN THE
   SYSTEM SHALL record constrained unresolved references instead of a false
   relation.

### Requirement 4: Validation-environment label normalization

**User Story:** As a tooling consumer, I want validation-environment blocking
reasons to stay ecosystem-neutral, so a mixed or Ruby repository is not
described as JavaScript/TypeScript-only.

**Priority:** should-have

#### Acceptance Criteria
1. GIVEN repository guidance that blocks generic host commands, WHEN overview
   validation hints are emitted, THEN THE SYSTEM SHALL use an ecosystem-neutral
   repository command-family label.
2. WHERE the repository contains multiple ecosystems, THEN THE SYSTEM SHALL not
   identify the blocked generic host commands as JavaScript/TypeScript commands.

### Requirement 5: Static controller/action and resource option extraction

**User Story:** As a routing analyst, I want static resource/resource-option
facts from Rails routes, so I can navigate to concrete controllers and actions
without runtime dispatch.

**Priority:** must-have

#### Acceptance Criteria
1. GIVEN a `resources` declaration with static options, WHEN options are fully
   literal, THEN THE SYSTEM SHALL record action/controller routing options as bounded
   evidence.
2. IF a resource option is dynamic or non-static, THEN THE SYSTEM SHALL not
   assert concrete routing action edges.

### Requirement 6: Custom action routing forms

**User Story:** As a reviewer, I want bounded handling of member, collection, and
`on` custom actions, so action-level navigation remains useful and safe.

**Priority:** should-have

#### Acceptance Criteria
1. GIVEN static `member`, `collection`, and `on` action declarations, WHEN
   extracting routes, THEN THE SYSTEM SHALL emit corresponding static action edges.
2. IF action symbols are dynamic or unresolved, THEN THE SYSTEM SHALL retain
   unresolved records and not produce hard dispatch claims.

### Requirement 7: Route-file linking

**User Story:** As an agent, I want static links across route files, so route
graphs are traceable without runtime boot.

**Priority:** should-have

#### Acceptance Criteria
1. GIVEN a `draw` call with a static target, WHEN parsed, THEN THE SYSTEM SHALL
   link to the resolved route file.
2. IF the `draw` target is dynamic or the matching first-party route file is
   absent or ambiguous, THEN THE SYSTEM SHALL keep the reference unresolved.

### Requirement 8: Conservative Ruby helper-load evidence

**User Story:** As a static analyst, I want parser-limited evidence for
`load`, `autoload`, alias, and visibility forms, so these do not become incorrect
dispatch claims.

**Priority:** could-have

#### Acceptance Criteria
1. GIVEN direct `load`/`autoload`/`alias`/visibility forms, WHEN parse evidence is
   static and direct, THEN THE SYSTEM SHALL record low-confidence advisory records.
2. IF forms are non-direct or ambiguous, THEN THE SYSTEM SHALL suppress
   semantic impact claims and keep advisory confidence.

## Correctness Properties

- **CP-001:** Singleton method identity is injective per receiver-class-method pair
  across syntax forms.
- **CP-002:** Namespace-resolved static route/controller identities do not cross
  module/path boundaries when scope differs.
- **CP-003:** Association edges are emitted only for unambiguous static
  association graphs.
- **CP-004:** Dynamic or ambiguous routing/action associations are preserved as
  unresolved or bounded advisory entries.
- **CP-005:** Deferred areas remain unclaimed as completed static semantic
  evidence.

## Technical Context

- **Language/Version:** TypeScript runtime with `tree-sitter-ruby` parser inputs.
- **Primary Dependencies:** `tree-sitter-ruby`, static AST extraction contracts,
  existing Ruby/Rails DSL extraction modules.
- **Target Platform:** Runtime environments currently tested for this repo
  (`Node` + `better-sqlite3`/`tree-sitter` toolchain).
- **Constraints:** No boot execution, no runtime dispatch, no alternate-parser
  fallback, no LSP/AST/shell fallback.
- **Performance Goals:** No additional cross-file passes outside existing parser
  budgets; conservative static pass only.

## Success Criteria

- **SC-001:** T001 through T007 evidence mapping exists without claiming execution
  or runtime dispatch.
- **SC-002:** Static route/controller/action/association outputs are bounded and
  avoid false-positive hard links for ambiguous inputs.
- **SC-003:** No validation claim is made for deferred areas (redirect, mount,
  resolve, engines, inflection runtime, dispatch).
- **SC-004:** Lifecycle mapping for all requirements to tasks, design sections, and
  verification coverage is complete and explicit.

## Related Artifacts

- Change Impact: `change-impact.md`
- Design: `design.md`
- Tasks: `tasks.md`
- Verification: `verification.md`
