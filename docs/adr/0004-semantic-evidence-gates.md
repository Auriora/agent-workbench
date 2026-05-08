---
title: Require semantic evidence before semantic capability
doc_type: adr
status: accepted
owner: platform
last_reviewed: 2026-05-08
decision_date: 2026-05-08
deciders:
  - platform
supersedes:
superseded_by:
---

# ADR: Require Semantic Evidence Before Semantic Capability

## Status

Accepted

## Context

Agents need to know whether runtime output is proof, routing evidence, or a
useful guess. A parser that extracts declarations is not enough to support safe
semantic edits, impact claims, or validation routing.

## Decision

Do not mark a language adapter `semantic` unless exact-symbol lookup,
references, impact, diagnostics/test routing, cache freshness, and degraded
tooling behavior are trustworthy on representative repositories.

Adapters must report one of the supported capability levels defined in
[Runtime contracts](../reference/runtime-contracts.md).

Results must expose trust, freshness, scope, verification, and evidence source
metadata.

## Alternatives Considered

### Optimistic Semantic Labels

- Pros:
  simpler marketing and a shorter apparent support matrix.
- Cons:
  encourages unsafe agent assumptions and hides uncertainty.

### No Capability Labels

- Pros:
  simpler schemas.
- Cons:
  forces agents to infer evidence quality and repeat direct verification.

## Consequences

Adapter promotion requires explicit tests and representative fixtures. Runtime
responses become more verbose but safer. The system can still expose partial
evidence while clearly telling agents when direct source reads or validation are
required.

## Semantic Promotion Fixture Requirements

Promotion to `semantic` requires fixtures for duplicate names, imports and
aliases, generated/vendor boundaries, dynamic references, stale indexes, config
changes, missing tooling, parser/LSP failures, validation planning, and blocked
validation states.

Mutating refactors require operation-level gates beyond adapter capability.
Safe rename, change signature, safe delete, move symbol, and import mutation are
post-MVP until those gates are specified and fixture-proven.

## Related Artifacts

- Related design docs: [Language adapter design](../design/language-adapter-design.md)
- Related reference docs: [Language capability matrix](../reference/language-capability-matrix.md)
- Related contract docs: [Runtime contracts](../reference/runtime-contracts.md)
- Related code or config:
