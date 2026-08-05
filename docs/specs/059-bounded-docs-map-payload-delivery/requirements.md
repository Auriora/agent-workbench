---
title: Bounded docs map payload delivery requirements
doc_type: spec
artifact_type: requirements
status: active
owner: platform
last_reviewed: 2026-08-05
---

# Requirements

## Introduction

`repo:///docs/map` currently serializes the default 50-document page with full
heading, link, currency, authority, and provenance detail. On this repository
the raw MCP payload is valid JSON but is approximately 228 KB, so the Codex
resource wrapper truncates the response and delivers invalid JSON. The map must
be a compact routing surface whose complete detail remains reachable through
an explicit continuation call.

## Goals

- Keep every `repo:///docs/map` response valid and within a 32 KiB UTF-8
  delivery bound.
- Preserve truthful total counts, truncation state, and cursor continuation.
- Keep document paths and authority/currency routing useful while moving
  detailed reads to the existing targeted documentation surfaces.
- Prove the source and packaged MCP routes with fixture-backed tests.

## Non-Goals

- Changing documentation ranking or `docs_search` semantics.
- Limiting documentation discovery, indexing, or extraction to the first map
  page.
- Adding command execution, retries, alternate parsers, or hidden fallbacks.
- Resolving pre-existing Markdown table-readability advisories, adding MCP
  prompts without a use case, or expanding debug-sweep parameter coverage.

## Canonical Context Waiver

- Advisory waived for this spec package. The durable canonical sources were
  read directly, so copying them here would duplicate authority instead of
  adding new evidence.
- The reviewed canonical sources are `docs/design/mcp-surface-design.md`,
  `docs/reference/runtime-contracts.md`, and
  `docs/design/coding-agent-integration-design.md`.

## Durable Source Baseline

- `docs/design/mcp-surface-design.md`: The docs map is bounded routing
  evidence, not precise semantic proof. Confidence is high. Canonical
  public-surface design.
- `docs/reference/runtime-contracts.md`: Truncation must be truthful and
  continuation cursors must represent remaining evidence. Confidence is high.
  Canonical contract vocabulary.
- `docs/design/coding-agent-integration-design.md`: Packaged agents consume
  the installed MCP runtime. Confidence is high. Governs client delivery.

## Durable Impact

- Design: clarify `docs/design/mcp-surface-design.md` to define the compact
  map projection and continuation tool.
- API/contract: modify `docs/reference/runtime-contracts.md` to define the
  byte bound, counts, truncation, and recovery.
- Agent change record: modify `docs/reference/agent-readable-changelog.md` to
  record consumer-visible map delivery behavior.

## Requirements

### Requirement 1: Client-safe resource delivery

**User Story:** As a coding agent, I want the documentation map resource to be
valid bounded JSON, so that resource delivery cannot be corrupted by the
client's output limit.

**Priority:** must-have

#### Acceptance Criteria

1. GIVEN a repository whose legacy default map exceeds the client delivery
   limit, WHEN `repo:///docs/map` is read, THEN the serialized resource text
   SHALL be valid JSON no larger than 32,768 UTF-8 bytes.
2. THE SYSTEM SHALL compact at a typed docs-map boundary and SHALL NOT return
   an arbitrary byte-sliced JSON document.
3. IF a valid map page cannot be represented within the bound, THEN THE SYSTEM
   SHALL return a bounded structured blocked response that names the missing
   evidence and a recovery action.

### Requirement 2: Complete continuation without extraction limits

**User Story:** As a coding agent, I want to continue a truncated map, so that
payload compaction does not become an unextendable discovery budget.

**Priority:** must-have

#### Acceptance Criteria

1. WHEN a map page omits documents because of row or byte bounds, THEN it SHALL
   report `truncated: true`, preserve the complete result count, and return a
   cursor for the first unreturned document.
2. THE SYSTEM SHALL expose a read-only `docs_map` tool that accepts the cursor
   and the established session/per-call documentation scope.
3. WHEN successive cursors are followed, THEN every eligible document SHALL be
   reachable once in deterministic order without rescanning a smaller corpus
   or silently skipping an oversized entry.
4. Payload compaction SHALL NOT reduce the documentation scan, index, or
   extraction universe.

### Requirement 3: Compact routing contract

**User Story:** As a coding agent, I want the first map page to retain useful
routing facts, so that I can select targeted follow-up reads cheaply.

**Priority:** must-have

#### Acceptance Criteria

1. Each returned map entry SHALL preserve its exact repo-relative path and
   bounded title/heading routing information, document/authority/currency state,
   canonical-owner or supersession paths when present, and truthful source
   counts for omitted heading/link detail.
2. Repeated direct-read guidance SHALL be represented once at map level.
3. Detailed heading and source evidence SHALL remain available through
   `docs_outline` and `docs_read_section`.
4. Warning compaction SHALL preserve total warning counts and declare whether
   warning samples were truncated.

### Requirement 4: Packaged and regression proof

**User Story:** As a maintainer, I want transport-level regression evidence, so
that a source-only size improvement is not mistaken for client-safe delivery.

**Priority:** must-have

#### Acceptance Criteria

1. Fixture-backed tests SHALL cover an over-bound legacy-shaped corpus,
   multi-page continuation, UTF-8-safe field compaction, warning conservation,
   and structured blocked behavior.
2. MCP registry tests SHALL prove the resource default and the `docs_map` tool
   share the compact contract while only the tool accepts cursor parameters.
3. Validation SHALL include typecheck, focused tests, the full Vitest suite,
   plugin/package validation, and an installed or packaged stdio MCP smoke that
   parses `repo:///docs/map` as JSON.

## Correctness Properties

- **CP-001**: Every emitted docs-map resource/tool text is parseable JSON and
  its UTF-8 byte length is at most 32,768.
- **CP-002**: Concatenating pages by cursor yields the same ordered exact paths
  as the eligible map universe, with no duplicates or omissions.
- **CP-003**: Compaction changes projection and page delivery only; total
  document and warning counts continue to describe the pre-compaction universe.

## Technical Context

- **Language/Version:** TypeScript ESM on Node.js 24.
- **Primary Dependencies:** MCP SDK, Zod, Vitest.
- **Target Platform:** Source runtime and packaged Codex/Claude/Kiro MCP paths.
- **Constraints:** Thin MCP adapters; no parser fallback; no partial JSON; no
  discovery dead end.
- **Performance Goals:** At most 32 KiB per docs-map response with deterministic
  cursor continuation.

## Success Criteria

- **SC-001**: The current repository's `repo:///docs/map` response falls from
  approximately 228 KB to at most 32 KiB and parses through the client wrapper.
- **SC-002**: All eligible paths remain reachable through `docs_map` cursor
  continuation.
- **SC-003**: All required source, contract, package, and transport checks pass.

## Related Artifacts

- Design: `design.md`
- Tasks: `tasks.md`
- Traceability: `traceability.md`
- Verification: `verification.md`
