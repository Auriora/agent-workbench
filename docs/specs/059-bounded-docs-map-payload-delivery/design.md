---
title: Bounded docs map payload delivery design
doc_type: spec
artifact_type: design
status: active
owner: platform
last_reviewed: 2026-08-05
---

# Technical Design

## Overview

The documentation map becomes a compact typed index. The application use case
builds deterministic compact entries from the unchanged eligible-document
universe. The presenter packs only complete entries and warning samples into a
32 KiB envelope, recalculates the cursor for the first unreturned document,
and never slices serialized JSON. A new read-only `docs_map` tool exposes the
same provider with cursor and scope arguments because static MCP resources do
not have a portable argument channel.

## Requirement Coverage

- Requirement 1, AC1-AC3: typed compact entry plus envelope byte packer and
  blocked variant, validated by presenter/resource size tests and stdio smoke.
- Requirement 2, AC1-AC4: shared cursor-aware use case and public `docs_map`
  tool, validated by the multi-page fixture test.
- Requirement 3, AC1-AC4: map-specific schema with exact paths, bounded
  samples, and conserved counts, validated by contract/presenter tests.
- Requirement 4, AC1-AC3: focused, full, package, and transport validation,
  recorded in `verification.md`.

## Correctness Property Coverage

- CP-001: serialize complete typed envelopes and pack below one constant.
  Validation direction is adversarial UTF-8 and transport tests. No raw byte
  slicing.
- CP-002: cursor offset advances by emitted complete entries. Validation
  direction is the multi-page corpus equality test. Static resource starts at
  offset zero; tool continues.
- CP-003: scan/index universe is unchanged and counts precede projection.
  Validation direction is count and warning-conservation assertions. No
  scan-budget change.

## High-Level Design

### Components and Changes

- `runtime-docs-contracts.ts`: own the compact map entry, count, warning, and
  request/response schemas.
- `query-docs.ts`: project full internal documents into compact routing entries
  and retain deterministic cursor offsets over the unchanged universe.
- `docs-presenter.ts`: sanitize, pack complete entries/warnings, recalculate
  truncation metadata, and produce the structured over-limit failure.
- MCP registries: keep `repo:///docs/map` static and add `docs_map` as the
  argument-bearing continuation surface using the same provider.
- Durable docs: promote the resource/tool split and byte/truncation contract.

### Data Flow

```text
eligible docs universe
  -> deterministic path order
  -> compact map projection and requested row page
  -> presenter byte packing of complete entries
  -> repo:///docs/map first page
  -> docs_map(cursor) continuation pages
  -> docs_outline/docs_read_section for exact detail
```

### Data Models

A compact map entry retains exact `path`, bounded display samples, counts for
the full headings and links, and authority/currency routing fields. It does not
repeat links, provenance, caveats, or timestamps already available from
targeted surfaces. Map-level fields carry the direct-read caveat, total result
count, returned count, warning total/sample state, truncation, and cursor.

The 32,768-byte constant applies to the complete JSON envelope, not merely the
`docs` array. UTF-8 fields are shortened only at code-point boundaries and
declare truncation. Exact paths are never shortened.

## Low-Level Design

### Algorithms and Logic

```text
build requested deterministic page from cursor
project documents into compact entries
sanitize the complete candidate envelope
while candidate exceeds 32768 bytes:
  remove the final complete entry and point cursor to it
  if documents are exhausted, reduce warning samples and preserve warning_total
if the typed envelope scaffold still cannot fit:
  return a minimal structured blocked envelope
serialize once; never slice serialized bytes
```

### Function Signatures and Interfaces

`docs_map` accepts `scope_path`, `max_docs`, `max_headings_per_doc`, and
`cursor`. The static resource uses safe defaults and any session `docs_scope`.
Both return `ResponseEnvelope<DocsMap>` and use the same 32 KiB presenter.

### Error Handling

Invalid cursor/input and provider failures retain the shared MCP error
envelope. An unrepresentable envelope returns `status: blocked`, no partial
documents, a public bounded error code, and a next action to narrow the scope
or retry through `docs_map`. Serialization exceptions are not converted into
partial success.

### Security, Trust, and Access

The change is read-only. Existing path containment, redaction, scope, session,
and trust calibration remain in force. Compact display strings remain
untrusted repository content and pass through presentation redaction.

### Migration and Compatibility

The URI remains stable. The map entry is intentionally narrowed to routing
fields; consumers needing full headings/links must follow the advertised
targeted surfaces. `docs_map` is additive. The contract version remains `0.1`
because the public runtime contract is still pre-1.0, but the agent-readable
changelog records the projection change.

### Slice Boundary And Residual Architecture

- Bounded docs-map delivery: in this slice are the resource, continuation
  tool, tests, and docs. Out of this slice is other MCP response compaction.
  Follow-up destination is backlog only if separately evidenced. Blocks
  closure: no.
- Tool-sweep findings: in this slice is classification only. Out of this slice
  are parameter matrices and prompts. Follow-up destination is the existing
  design/backlog when justified. Blocks closure: no.
- Markdown warnings: in this slice there is no behavior change. Out of this
  slice is table cleanup. Follow-up destination is documentation maintenance.
  Blocks closure: no.

## Validation Strategy

- Contract, use-case, and presenter tests cover Requirements 1-3 and
  CP-001-CP-003. Evidence location: `verification.md`. Residual risk: none
  expected.
- MCP registry and debug harness tests cover resource/tool wiring. Evidence
  location: `verification.md`. Residual risk: none expected.
- Typecheck and full Vitest cover cross-module regression. Evidence location:
  `verification.md`. Residual risk: load sensitivity is recorded if observed.
- Plugin/package checks and stdio smoke cover Requirement 4. Evidence
  location: `verification.md`. Residual risk: the client wrapper still
  requires a post-install reload.

## Operational Considerations

No storage migration or background refresh is required. Existing daemons must
be rebuilt/reinstalled and reloaded before live client proof. Rollback is the
source/package commit reversal; no persisted state changes.

## Open Questions

- None. The user explicitly requested the spec and fix, and preserving an
  extendable continuation route resolves the prior no-dead-end constraint.

## Related Artifacts

- Requirements: `requirements.md`
- Tasks: `tasks.md`
- Traceability: `traceability.md`
- Verification: `verification.md`
