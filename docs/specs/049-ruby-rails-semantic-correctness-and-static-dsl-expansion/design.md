---
title: Spec 049 Design
doc_type: spec
artifact_type: design
status: draft
owner: platform
last_reviewed: 2026-08-02
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Technical Design

## Source of truth

- `tree-sitter-ruby` remains the mandatory extraction path.
- Source-of-truth contracts are in runtime contracts and `docs/design/language-adapter-design.md`.

## Overview

The design extends bounded static extraction for Ruby/Rails semantics by improving
identity, namespace, and routing/association inference while preventing false
dispatch claims. No runtime boot, runtime route set evaluation, or dynamic
execution path is introduced in this slice.

## Requirement Coverage

| Requirement | Acceptance Criteria | Design Coverage | Validation Approach |
|---|---|---|---|
| Requirement 1 | AC1, AC2 | Singleton method canonicalization in parser-to-symbol mapping | Static symbol/reference fixtures |
| Requirement 2 | AC1, AC2 | Scope-aware namespace/path/module resolver | Scope-routing fixtures |
| Requirement 3 | AC1, AC2 | Association classifier with ambiguity gating | Association fixtures |
| Requirement 4 | AC1, AC2 | Ecosystem-neutral validation-environment blocking reason | Overview hint assertions |
| Requirement 5 | AC1, AC2 | Static resource/options router with literal-only guard | Route fixture checks |
| Requirement 6 | AC1, AC2 | Member/collection/on action edge emission for static actions | Route action fixtures |
| Requirement 7 | AC1, AC2 | `draw` resolver with static target and unresolved guards | Route-file fixture checks |
| Requirement 8 | AC1, AC2 | Advisory Ruby helper-load metadata with low confidence only | Metadata-focused assertions |

## Correctness Property Coverage

| Property | Design Behavior | Validation Direction | Notes |
|---|---|---|---|
| CP-001 | Canonical method identity mapping | conventional checks | Prevent duplicate method identities |
| CP-002 | Namespace boundary preservation | conventional checks | Prevent cross-scope identity collision |
| CP-003 | Association safety gates | fixture and query checks | Avoid false association edges |
| CP-004 | Unresolved handling for dynamic/ambiguous cases | fixture and query checks | Preserve trust metadata |
| CP-005 | Static defer boundary enforcement | static checks and scope assertions | Avoid unsupported behavior claims |

## High-Level Design

### System Architecture

- Parser layer emits typed Ruby/Rails nodes and metadata.
- Resolver layer converts nodes to canonical scope frames and identity keys.
- Route layer emits bounded action/edge records and unresolved markers.
- Association layer emits bounded model edges or deferred advisories.
- Reporting layer writes confidence-labeled evidence.

### Components and Changes

- `RubySingletonIdentityResolver` / equivalent: unify `def self` and `class << self`.
- `ScopeContextStack`: enforce namespace/path/module boundaries.
- `RailsRouteDslResolver`: static `resources`, `member`, `collection`, `on`, and `draw`.
- `AssociationResolver`: static association graph extraction for through/source_type/HABTM.
- Overview validation discovery: ecosystem-neutral blocked host-command wording.
- `ConservativeEvidenceEmitter`: advisory handling for `load`, `autoload`, alias, visibility.

### Data Models

- `CanonicalNodeId`: receiver + method + signature/namespace key.
- `ScopeFrame`: `[namespace, path_scope, module_stack]`.
- `EvidenceRecord`: `{kind, source_range, confidence, provenance, scope}`.
- `StaticEdge`: `{from, to, relation, constraints, confidence}`.
- `DeferredRecord`: `{kind, reason, evidence_hint, scope}`.

### Data Flow

- Parse source files with tree-sitter.
- Build scope frames from parsed declarations/modules.
- Apply each resolver (singleton, route, association, validation metadata).
- Emit either static edge records or deferred records with explicit reason.
- Preserve provenance and confidence on every output.

## Low-Level Design

### Algorithms and Logic

```text
function normalizeSingleton(node, scope):
  canonicalReceiver = node.receiver or scope.effectiveSingletonOwner
  return CanonicalNodeId(canonicalReceiver, node.name, scope)

function resolveScopeAwareReference(ref, scopeFrame):
  candidates = lookup(ref.name, scopeFrame)
  if candidates.count == 1 and candidates[0].matchesStaticScope(scopeFrame):
    return candidates[0]
  return DeferredRecord("ambiguous_or_dynamic")

function emitRouteEdges(routeDls):
  if routeDsl.isDynamic():
    return DeferredRecord("dynamic_route_form")
  return StaticEdge(routeDls.source, routeDls.target, routeDls.action)

function emitAssociationEdge(assocNode):
  if assocNode.hasStaticThroughSourceTypeOrHabtm() and assocNode.isFirstParty():
    return StaticEdge(assocNode.owner, assocNode.target, "association")
  return DeferredRecord("association_not_statically_safe")
```

### Function Signatures and Interfaces

```text
interface Canonicalizer {
  canonicalizeSingleton(methodNode: RubyMethodNode, scope: ScopeFrame): CanonicalNodeId
}

interface RouteResolver {
  resolveRouteDsl(routeNode: RouteDslNode, scope: ScopeFrame): StaticEdge[] | DeferredRecord[]
}

interface AssociationResolver {
  resolveAssociation(node: AssocNode, scope: ScopeFrame): StaticEdge[] | DeferredRecord[]
}

interface EvidenceEmitter {
  emit(record: EvidenceRecord): void
}
```

### Error Handling

- Parsing failure: emit parser failure markers per file and continue bounded processing.
- Unambiguous target missing: emit `DeferredRecord` rather than speculative hard edges.
- Conflicting scope mapping: emit unresolved result and keep provenance.
- Partial evidence: record confidence and reason for every non-resolved case.

## Security, Trust, and Access

- No command execution is introduced in this slice.
- Evidence never implies runtime capability it cannot prove.
- Workspace trust boundaries remain explicit through parser provenance and confidence.
- No alternate parser path is used as a fallback to hide extraction failures.

## Migration and Compatibility

- No schema migration.
- No public contract changes.
- No behavior changes outside static evidence boundaries.

## Downstream Task Guidance

- Required checkpoints before implementation:
  - Confirm task dependencies from `tasks.md` and evidence prerequisites in `verification.md`.
- Properties or acceptance criteria that need explicit task coverage:
  - CP-001 to CP-005 remain explicit in requirement and task mapping.
- Optional artifacts needed before implementation:
  - None; current package docs remain the source-of-truth for the bounded implementation slice.
- Downstream review needed if this design changes after tasks are drafted:
  - Re-run `design.md` and `traceability.md` reviews and update `verification.md`.

## Slice Boundary And Residual Architecture

| Design target | In this slice | Out of this slice | Follow-up destination | Blocks closure? |
|---|---|---|---|---|
| Static Ruby/Rails behavior | Parser-backed singleton, namespace, route, association improvements | Redirects, mount, resolve, engines, runtime dispatch, inflection execution | Follow-up backlog or future spec | no |
| Confidence and deferral model | Explicit unresolved/deferred boundaries | Runtime execution proofs and dynamic graph completion | follow-up spec as needed | no |

## Validation Strategy

| Validation | Covers | Evidence Location | Residual Risk |
|---|---|---|---|
| Static fixtures | Requirements 1-8 | `verification.md` | Dynamic runtime behavior remains deferred |
| Static query assertions | Requirements 2, 3, 5, 6, 7 | `verification.md` | Potentially new route DSL forms outside scope |

## Operational Considerations

- Keep extractor deterministic for repeated review runs.
- Preserve existing confidence labels and unresolved conventions.
- Maintain no dependency on host runtime execution (Ruby/Bundler/Rails/test/db).

## Open Questions

- What first-class concern declaration identity would justify reusable concern edges in future.
- Whether advisory Ruby helper-load metadata should include symbol-shape hints.
- Whether validation labels should move to dedicated enum in a post-spec follow-up.

## Related Artifacts

- Requirements: `requirements.md`
- Tasks: `tasks.md`
- Verification: `verification.md`
- Change impact: `change-impact.md`
