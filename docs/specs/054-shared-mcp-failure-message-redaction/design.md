---
title: Shared MCP failure-message redaction design
doc_type: spec
artifact_type: design
status: draft
owner: platform
last_reviewed: 2026-08-03
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Technical Design

## Overview

Use the existing presentation redaction implementation as the only algorithm
for public MCP failure text. Add a clearly named failure-message sanitizer that
redacts first and then bounds output to 512 UTF-8 bytes. Apply it at the final
shared tool-envelope boundary, the shared resource-provider helper, and the
small number of public presenter/manual-adapter sinks that bypass those paths.

Classification and cause-code extraction continue to inspect the internal raw
error. Only the outward free text is sanitized. No public contract shape or
version changes.

## Requirement Coverage

| Requirement | Acceptance Criteria | Design Coverage | Validation Approach |
| --- | --- | --- | --- |
| Requirement 1 | AC1-AC5 | canonical redaction plus fixed post-redaction byte bound | redaction unit tests and serialized envelope sentinels |
| Requirement 2 | AC1-AC5 | classify/extract internally, sanitize only public free text | before/after structure golden tests |
| Requirement 3 | AC1-AC5 | shared wrapper, resource helper, presenter/manual-adapter inventory | source inventory and representative parity tests |
| Requirement 4 | AC1-AC5 | hostile-message matrix across surface families | MCP, presenter, and resource tests |
| Requirement 5 | AC1-AC4 | contract `0.1` and current schemas retained | contract, typecheck, and compatibility tests |

## Canonical Context

- **Decision:** use the embedded Durable Source Baseline in `requirements.md`;
  a separate `canonical-context.md` would duplicate rather than clarify it.
- **Always-canonical external sources:** `docs/backlog/README.md`,
  `docs/reference/runtime-contracts.md`, `docs/design/mcp-surface-design.md`, and
  `docs/reference/workspace-safety-contract.md` retain authority for their
  documented areas.
- **Spec-local role:** this package coordinates the proposed change and must be
  reconciled when any durable source changes; it does not supersede those
  sources before T005 promotion.
- **Imported or background sources:** none. The package summarizes current
  durable behavior and links to direct source rather than copying an external
  authority snapshot.

## Correctness Property Coverage

| Property | Design Behavior | Validation Direction | Notes |
| --- | --- | --- | --- |
| CP-001 | final public free text is sanitized before serialization | assert serialized responses omit all fixture sentinels | check nested data as well as `errors[]` |
| CP-002 | sanitizer composes existing redaction with UTF-8 bounding | table tests, repeated application, multi-byte boundary | fixed maximum 512 bytes |
| CP-003 | structural failure fields are assembled independently of sanitized text | exact envelope golden comparison | free text is the only allowed difference |
| CP-004 | sink inventory classifies every raw-message use | `rg` inventory plus targeted tests | debug-only/non-public sinks remain out of scope |
| CP-005 | cause code is captured before sanitization | unknown-impact regression | no parsing of redacted text for typed behavior |

## High-Level Design

```text
internal provider error
        |
        +--> classify error / read cause code ----> typed data and metadata
        |
        +--> select safe fallback/context
                    |
                    v
          shared public failure sanitizer
          redact -> UTF-8 bound -> schema
                    |
                    v
              MCP serialization
```

### Components And Changes

- `src/presentation/redaction.ts`
  - Export one canonical public failure-message sanitizer and its fixed byte
    limit, reusing `redactAndBoundPresentationText` with message context.
- `src/interface-adapters/mcp/envelope.ts`
  - Sanitize the final `errors[].message` in `classifiedFailureEnvelope`.
  - Keep raw text available only for classification and cause-code extraction.
- `src/interface-adapters/mcp/registries/resources/provider-failure.ts`
  - Retain fixed typed SQLite wording and sanitize other provider reasons
    through the shared helper.
- Public presenters and manual adapters
  - Inventory `errors`, warnings, reasons, and blocker fields. Route unsafe
    exception-derived text through the same helper before schema validation.
  - Expected seams include docs, repository orientation/status/scope/overview,
    integration health, and diagnostics.
- Tests
  - Extend the shared error-envelope golden suite and representative resource,
    diagnostics, graph, docs, workspace-edit, and presenter suites.

### Data Models

No public schema changes. `RuntimeError`, `McpFailureClass`, response metadata,
trust calibration, and contract version `0.1` remain unchanged. The byte limit
is an internal presentation constant with public behavioral tests.

### Data Flow

1. A provider throws an unknown value or `Error`.
2. The owning wrapper classifies the raw internal error and extracts any stable
   cause code.
3. The builder selects the existing typed data skeleton, metadata, trust, and
   recovery action.
4. Immediately before public schema validation or serialization, arbitrary
   failure free text is passed through the canonical sanitizer.
5. The sanitizer replaces secret-like values, host paths, and workspace
   escapes, then truncates without splitting a UTF-8 character.
6. The normal response envelope is serialized.

## Low-Level Design

### Algorithm

```text
sanitizePublicMcpFailureMessage(message, fallback):
  require fallback to be fixed, non-empty, and recovery-oriented
  safeFallback = redactPresentationText(fallback, context = message)
  candidate = message is non-empty ? message : fallback
  safe = redactPresentationText(candidate, context = message)
  selected = safe contains actionable text beyond redaction markers
    ? safe
    : safeFallback
  return truncate selected to at most 512 UTF-8 bytes by code point
```

Callers must not reclassify errors from the selected public text or inspect
redaction markers to select typed behavior. Marker-only output is not
actionable and therefore uses the caller's fixed fallback; a hostile message
that retains safe context keeps that context alongside the redaction markers.

### Proposed Interface

Names may be refined during implementation, but responsibility remains single:

```ts
export const PUBLIC_MCP_FAILURE_MESSAGE_MAX_UTF8_BYTES = 512;

export function sanitizePublicMcpFailureMessage(
  message: string,
  fallback: string
): string;
```

Repeated application must be safe. Call sites may defensively sanitize at a
final public boundary without introducing a second algorithm.

### Error Handling

- Non-`Error` thrown values continue through the existing fallback conversion.
- Empty, marker-only, or otherwise fully unusable text becomes a fixed,
  non-empty recovery-oriented fallback owned by the caller and sanitized by the
  same helper.
- Typed fixed domain messages may bypass arbitrary exception interpolation only
  when tests prove the entire final message safe.
- A sanitization defect is an internal contract failure; callers must not emit
  the raw message as a fallback.

### Security, Trust, And Access

- Repository contents, provider exceptions, database paths, and environment
  fragments are untrusted presentation input.
- Internal error objects are not mutated, persisted, or returned by the
  sanitizer.
- Redaction is not authorization and does not weaken workspace containment.
- No process execution, network access, filesystem read, telemetry expansion,
  or new secret handling is introduced.
- Security review must inspect the actual serialized response, not only the
  intermediate `errors` object.

### Migration And Compatibility

- Contract version remains `0.1`.
- Error codes, schemas, retryability, metadata, trust, and typed recovery data
  remain stable.
- Exception-derived message text is not a compatibility guarantee; replacing
  unsafe substrings with established markers is the intended bug fix.
- No rollout flag, dual output, alternate sanitizer, or backward-compatibility
  branch is permitted.

### Slice Boundary And Residual Architecture

| Design target | In this slice | Out of this slice | Follow-up destination | Blocks closure? |
| --- | --- | --- | --- | --- |
| public MCP failures | shared tool, resource, presenter, and manual-adapter response sinks | debug-only CLI/telemetry/stderr with no MCP response path | new backlog evidence if a public path is proven | no |
| failure vocabulary | preserve current classes and shapes | new error classes or redaction metadata | versioned contract spec if later required | no |
| internal diagnostics | raw error remains available internally | new debug storage or observability | EB009 or owning observability work | no |
| transport errors | normal response framing remains structured | failures that prevent response framing | existing MCP transport ownership | no |

## Validation Strategy

| Validation | Covers | Evidence Location | Residual Risk |
| --- | --- | --- | --- |
| redaction table and UTF-8 tests | Requirement 1, CP-002 | `tests/presentation/redaction-boundary.test.ts` | regex coverage requires representative sentinels |
| shared envelope golden tests | Requirements 1-4, CP-001, CP-003, CP-005 | `tests/mcp/error-envelope-consistency.test.ts` | wrapper-only tests do not cover resources |
| resource/presenter/manual-adapter parity | Requirement 3, CP-004 | representative MCP and presenter tests | inventory completeness requires review |
| contract and trust regressions | Requirements 2 and 5 | contract/trust test suites | none expected |
| repository gates | integration and packaging | task evidence | environment recorded truthfully |

No new property-test dependency is required. Deterministic table-driven Vitest
cases cover the finite redaction categories and multi-byte boundaries.

## Downstream Task Guidance

- Complete the public failure-sink inventory before changing source.
- Add failing hostile-message tests before implementing the sanitizer.
- Treat a new public field, enum, fallback redactor, or feature flag as a design
  deviation requiring reconciliation.
- Require security review of final serialized responses and contract review of
  classification/cause-code preservation.

## Operational Considerations

- Message work is bounded to the exception string and adds no provider calls.
- Redaction markers remain stable and agent-readable.
- Internal logging behavior is unchanged unless it is proven to feed a public
  MCP response.
- Rollback is the single shared change plus migrated call sites; no stored data
  or schema migration exists.

## Open Questions

No product decision currently blocks implementation. The fixed message bound is
512 UTF-8 bytes, the public contract remains `0.1`, and all arbitrary public
failure text uses one sanitizer.

## Related Artifacts

- Requirements: `requirements.md`
- Tasks: `tasks.md`
- Traceability: `traceability.md`
- Verification: `verification.md`
