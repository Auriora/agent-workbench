---
title: Public failure redaction vocabulary expansion design
doc_type: spec
artifact_type: design
status: active
owner: platform
last_reviewed: 2026-08-04
---

# Technical Design

## Overview

Extend `src/presentation/redaction.ts`, the existing presentation authority,
with additional deterministic token forms. Preserve the deliberate distinction
between filesystem roots and slash-prefixed routes: Unix path detection remains
root-aware and adds the evidenced `/srv` and `/data` roots rather than treating
all `/...` tokens as host paths. Add explicit tilde, UNC, and extended Windows
recognition before the current drive-letter rule.

Structured secret assignments are recognized by a bounded key vocabulary and
separator grammar. Authorization headers are handled explicitly. No decoding,
entropy guessing, or recursive parsing is introduced.

For diagnostics, add one presenter-owned failure builder accepting only
`provider_unavailable` or `internal_error`. The manual adapter selects the
classification before presentation. Invalid requests continue using the
existing invalid-input builder.

## Requirement Coverage

| Requirement | Criteria | Design coverage | Validation |
| --- | --- | --- | --- |
| Requirement 1 | AC1-AC2 | canonical path token rules | redaction boundary tests |
| Requirement 2 | AC1-AC3 | assignment/header token rules and marker fallback | hostile message tests |
| Requirement 3 | AC1-AC3 | explicit false-positive fixtures and unchanged bounding path | boundary and full regression tests |
| Requirement 4 | AC1-AC4 | typed diagnostics provider-failure presenter | diagnostics MCP tests and trust assertions |

## Correctness Property Coverage

| Property | Design behavior | Validation direction |
| --- | --- | --- |
| CP-001 | replacement markers do not rematch as hostile input | sanitize twice assertions |
| CP-002 | root-aware paths and bounded secret keys | safe fixture equality assertions |
| CP-003 | existing code-point iteration remains authoritative | existing and expanded byte-bound test |
| CP-004 | one failure builder owns matching data, meta, error, and trust | table-driven diagnostics expectations |

## High-Level Design

The existing presentation module remains the single security boundary for
public free text. The diagnostics registry remains responsible only for
request validation, provider selection, invocation, and choosing the internal
failure class; the presenter owns the complete public envelope.

## Components and Changes

- `src/presentation/redaction.ts`: expand only the canonical vocabulary.
- `tests/presentation/redaction-boundary.test.ts`: add hostile and safe
  boundary cases.
- `src/presentation/diagnostics-presenter.ts`: construct classified provider
  failure envelopes with matching metadata and trust.
- `src/interface-adapters/mcp/registries/tools/diagnostics-for-files.ts`: select
  provider-unavailable or internal-error before calling the presenter.
- `tests/mcp/diagnostics-for-files-tool.test.ts`: prove error-class parity and
  redaction.
- durable contracts and backlog: record resulting current behavior and remove
  the stale instruction to schedule EB063.

## Low-Level Design

Embedded path matching runs from the most specific Windows forms to the
existing drive-letter and root-aware Unix forms. Secret handling first removes
private-key blocks, then authorization credentials, then the bounded
assignment-key vocabulary. Replacement markers are deliberately outside the
matching value grammar, making repeated sanitation stable.

## Data Flow

```text
raw internal evidence
  -> choose typed failure class
  -> canonical presentation sanitizer
  -> presenter builds matching data/meta/error/trust
  -> schema validation and MCP JSON serialization
```

## Error Handling

| Condition | Code | Retryable | Analysis validity | Public summary |
| --- | --- | --- | --- | --- |
| invalid arguments/root | `invalid_input` | no | `invalid` | Diagnostics input was invalid. |
| provider missing | `provider_unavailable` | no | `invalid_due_to_environment` | Diagnostics provider is unavailable. |
| provider throws | `internal_error` | yes | `invalid_due_to_environment` | Diagnostics failed before completion. |

Provider failures expose no checked files, findings, provider statuses, or
validation claim. Recovery text is fixed or sanitized; raw exceptions are
never copied after classification.

## Security, Trust, and Access

The sanitizer remains a presentation boundary, not a secret detector or path
containment authority. Safe routes such as `/api/orders` remain visible.
Credential patterns are deliberately constrained to established sensitive keys
and authorization schemes to reduce destructive false positives. No network,
filesystem, process, or permission behavior changes.

## Migration and Compatibility

There is no schema or persisted-data migration. Contract `0.1` and
`RuntimeError` remain unchanged. The diagnostics repair changes previously
incorrect public codes and retryability for only the missing-provider and
provider-exception paths.

## Slice Boundary And Residual Architecture

| Design target | In this slice | Out of this slice | Destination | Blocks closure? |
| --- | --- | --- | --- | --- |
| evidenced path forms | tilde, srv/data, UNC, extended Windows | arbitrary semantic path inference | future fixture-backed backlog item | no |
| evidenced credentials | assignments and Authorization Bearer/Basic | entropy detection and arbitrary vendor credential formats | future fixture-backed backlog item | no |
| diagnostics classification | missing and throwing provider paths | conversion of manual adapter to shared registration helper | EB038 only if separately justified | no |

## Validation Strategy

Run focused redaction and diagnostics tests first, then typecheck, full Vitest,
plugin validation, package dry run, Markdown checks, lifecycle traceability and
closure checks, and independent security/correctness review.

## Operational Considerations

No rollout switch, migration, network access, or background processing is
needed. A regression is reversible by reverting the presentation vocabulary or
diagnostics presenter/adapter change; raw internal evidence remains unchanged.

## Open Questions

None. Further vocabulary requires hostile fixtures plus safe counterexamples.
