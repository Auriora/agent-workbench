---
title: Ranked documentation readiness and first-read trust design
doc_type: spec
artifact_type: design
status: draft
owner: platform
last_reviewed: 2026-07-21
---

# Technical Design

## Overview

Use one snapshot-bound readiness path. The existing
`DocumentationConcernIndexPort` remains authoritative for concern state.
`getSnapshotRepoStatus` reads that bounded state for the selected visible
snapshot, status presents it, and orientation consumes status rather than
opening the store independently. `docs_search` keeps its current blocked
variant, but the status action becomes genuinely diagnostic. A repository-real
test invokes the production extractor against `docs/reference/documentation-map.md`.

## Requirement Coverage

| Requirement | Acceptance Criteria | Design Coverage | Validation Approach |
| --- | --- | --- | --- |
| Requirement 1 | AC1-AC6 | Repository-real extractor regression and bounded metadata protocol | Focused Vitest and Markdown validation |
| Requirement 2 | AC1-AC6 | Snapshot-bound readiness in status use case and contracts | Status/store/MCP tests |
| Requirement 3 | AC1-AC3 | Orientation blocker aggregation and recovery semantics | Orientation and docs-search integration tests |
| Requirement 4 | AC1-AC4 | Published-snapshot and installed-client acceptance | Daemon fixture plus Codex/Claude smoke |

## Correctness Property Coverage

| Property | Design Behavior | Validation Direction | Notes |
| --- | --- | --- | --- |
| CP-001 | One selected snapshot ID is passed to status and concern-state reads | Cross-snapshot mismatch regression | Never use latest independently twice. |
| CP-002 | Orientation consumes readiness embedded in status | Table-driven readiness states | Ready is the only blocker-free state when ranking is required. |
| CP-003 | Readiness carries one exhaustive recovery kind | Contract and next-action tests | Avoid refresh loops. |

## High-Level Design

### System Architecture

```text
published snapshot
  -> DocumentationConcernIndexPort.getDocumentationConcernIndexState(snapshot)
  -> getSnapshotRepoStatus
  -> repo status presenter/resource
  -> getRepoOrientation

docs_search(snapshot)
  -> same concern state
  -> success or ranking_unavailable
  -> repo:///status recovery evidence
```

### Components and Changes

- `document-currency-routing.ts`: remain the production validation authority.
  Resolve owner content through `content_by_path` when the graph indexer has
  already loaded its bounded docs prefix; otherwise use the containment-checked
  `WorkspaceFilePort.readTextPrefix`. Oversized docs reads stop at 120,000
  bytes, direct owner reads stop at 16,384 bytes, and classification admits only
  the 16,384-byte metadata prefix. Persist actual owner byte count and
  truncation when indexed content came from a prefix; never fall back to
  `readText` or raise a whole-owner ceiling.
- `get-repo-status.ts`: accept bounded concern readiness for the selected snapshot.
- runtime status/orientation contracts: add explicit ranking-readiness evidence
  and decouple `orientation_reusable` from `refresh_required`.
- MCP composition: inject the existing concern-index port into status assembly;
  keep registry adapters thin.
- tests: add real-map, store/status, orientation, recovery, and installed-client coverage.

### Data Models

Add a status-owned receipt with this semantic shape:

```text
documentation_ranking:
  snapshot_id: string
  state: ready | invalid | unavailable
  recovery: none | refresh | source_repair | request_repair | environment_repair
  authority_map: present | absent | unknown
  reason?: bounded safe string
```

The exact public schema name may change during contract review, but it must be
one canonical contract reused by status and orientation. Do not duplicate the
store's internal state type into presentation modules.

### Data Flow

Resolve publication once, read concern state for that exact snapshot, then
build status. Orientation derives its blocker and reusability from status.
`docs_search` independently reads the same persisted state for the same selected
snapshot; tests assert agreement rather than sharing connection-local state.

## Low-Level Design

### Algorithms and Logic

```text
state = concernIndex.getState(selectedSnapshotId)
readiness = classify(state)
status.documentation_ranking = readiness

if readiness != ready:
    orientation_reusable = false
    material_blockers += ranked documentation blocker
    refresh_required = existing_refresh_blocker OR readiness.recovery == refresh
```

The mapping is exhaustive and normative:

| Concern evidence | Public state | Recovery | Status/orientation trust | Orientation | `docs_search` |
| --- | --- | --- | --- | --- | --- |
| ready `complete` | `ready`, map `present` | `none` | `analysis_validity: valid` | reusable, no ranking blocker, no ranking refresh | success; `complete_ranked_universe` |
| ready `no_map` | `ready`, map `absent` | `none` | `analysis_validity: partial` with `authority_map_absent` caveat | reusable, no material blocker, no ranking refresh | success; complete universe with no owner-intent evidence and a must-verify caveat |
| ready `invalid` | `invalid`, map `unknown` | `source_repair` | `analysis_validity: invalid`, verification blocked | non-reusable, material blocker, `refresh_required: false` for this cause | blocked `ranking_unavailable` |
| unavailable `concern_index_invalid` | `invalid`, map `unknown` | `source_repair` | `analysis_validity: invalid`, verification blocked | non-reusable, material blocker, `refresh_required: false` for this cause | blocked `ranking_unavailable` |
| unavailable `snapshot_not_published` | `unavailable`, map `unknown` | `refresh` | `analysis_validity: invalid_due_to_environment`, verification blocked | non-reusable, material blocker, `refresh_required: true` | blocked `ranking_unavailable` |
| unavailable `snapshot_schema_incompatible` | `unavailable`, map `unknown` | `refresh` | `analysis_validity: invalid_due_to_environment`, verification blocked | non-reusable, material blocker, `refresh_required: true` | blocked `ranking_unavailable` |
| unavailable `concern_index_state_missing` | `unavailable`, map `unknown` | `refresh` | `analysis_validity: invalid_due_to_environment`, verification blocked | non-reusable, material blocker, `refresh_required: true` | blocked `ranking_unavailable` |
| unavailable `snapshot_not_found` | `unavailable`, map `unknown` | `request_repair` | `analysis_validity: invalid`, verification blocked | non-reusable, material blocker, `refresh_required: false` | blocked snapshot/ranking-unavailable variant selected by the requesting surface; never success |
| concern-store read/connection failure | `unavailable`, map `unknown` | `environment_repair` | `analysis_validity: invalid_due_to_environment`, verification blocked | non-reusable, material blocker, `refresh_required: false` for this cause | blocked environment envelope; never zero-hit success |

The `ready invalid` row is the current graph-store normalization for a
persisted invalid concern index. The unavailable form remains covered because
the public port union permits it; this spec does not change that port
normalization.

The status receipt carries the row's safe reason and exact snapshot ID.
Orientation projects the stated analysis validity and never changes global
freshness merely to describe ranking readiness. `refresh_required` remains the
OR of independently refreshable causes, so a source or environment repair row
does not suppress another genuine refresh requirement.

### Bounded Owner-Metadata Protocol

The owner classifier uses a maximum prefix of 16,384 UTF-8 bytes. It receives
that prefix from the resolved content route above; it never receives the
remaining body. Byte slicing must preserve complete UTF-8 code points. The
protocol is:

1. If byte zero does not begin the exact first-line `---` delimiter, classify
   frontmatter as absent and use only path/title plus the existing first 4,000
   characters of the admitted prefix for status inference.
2. If frontmatter begins, its closing `---` delimiter must end at or before byte
   16,384. A complete block is parsed normally.
3. An unterminated block in a file shorter than the bound is malformed. A block
   continuing beyond the bound is invalid with
   `frontmatter_metadata_too_large`; no status may be inferred from the body.
4. Canonical-owner and supersession signals may be inferred only from the
   completed frontmatter block. Content after the admitted prefix is never used
   for concern-owner classification.

Boundary tests cover a body over 120,000 bytes, closing delimiters immediately
before and at the bound, a delimiter crossing/after the bound, no frontmatter,
unterminated short frontmatter, oversized metadata, and a split multibyte code
point at the prefix edge.

### Function Signatures and Interfaces

Prefer extending the application input rather than letting orientation or an
MCP adapter query SQLite:

```text
getSnapshotRepoStatus({ ..., documentation_concerns })
getRepoOrientation(statusResult)
```

The status resource composition owns dependency injection. Presentation only
validates and serializes the application result.

### Error Handling

- Store read failure maps to `environment_repair` through the existing
  invalid-environment/error-envelope path.
- Persisted `invalid` state is data, not an exception.
- Reasons use the shared `redactPresentationText(..., { context: "message" })`
  policy, then truncate on a complete UTF-8 code-point boundary to at most 512
  bytes. Redaction precedes truncation so the cap cannot cut a sensitive token
  into an unrecognized fragment. Tests inject absolute workspace/host paths,
  traversal-like paths, and secret-like values through status presentation and
  assert both placeholders and the post-redaction byte cap.
- `docs_search` retains zero hits and blocked trust when ranking is unavailable.

### Security, Trust, and Access

No new filesystem, network, command, or mutation authority is introduced.
Repository paths in failure reasons remain repo-relative and redacted through
existing presentation policy where applicable.

### Migration and Compatibility

This is an additive status receipt plus a corrected interpretation of
orientation health. Existing ranking success and blocked variants remain. If
the public orientation contract must add recovery classification, update all
provider copies through the package's single runtime contract rather than add a
compatibility mode.

### Slice Boundary And Residual Architecture

| Design target | In this slice | Out of this slice | Follow-up destination | Blocks closure? |
| --- | --- | --- | --- | --- |
| Ranking readiness and first-read truth | Status, orientation, docs recovery, tests | Ranked-universe capacity | EB059 | no |
| Repository-real map validation | Production extractor regression | Generic docs lint framework redesign | backlog only if needed | no |
| Reference capability disclosure | none | Dynamic-import/member-call policy | EB061 | no |
| Node FTS batch identity | none | Duplicate node selection and FTS deduplication | EB062 | no |

## Validation Strategy

| Validation | Covers | Evidence Location | Residual Risk |
| --- | --- | --- | --- |
| Real-map concern extraction | Requirement 1, SC-001 | focused test and `verification.md` | Repository map changes after test snapshot; CI reruns it. |
| Store/status/orientation tests | Requirements 2-3, CP-001-CP-003 | focused Vitest suites | Contract wiring across entrypoint needs integration proof. |
| MCP/daemon regression | Requirements 3-4 | MCP and daemon tests | Installed clients still require reload. |
| Installed Codex/Claude acceptance | Requirement 4, SC-004 | dogfood ledger and verification | Provider availability may gate final proof. |

## Downstream Task Guidance

- Validate the immediate map repair before contract implementation.
- Restore the product backlog owner row only after bounded large-owner
  classification has focused proof.
- Add contract/store tests before changing status and orientation.
- Keep the status read bounded; no catalog or filesystem scan.
- Require independent work-product review before implementation begins and
  again before closure if public contract shape changes.

## Operational Considerations

Refreshing the repaired map must produce a new published snapshot with ready
concern state. Invalid source policy should remain visible without repeatedly
scheduling identical refresh work.

## Open Questions

- None blocking. Exact schema naming is implementation-level and must preserve
  the semantic receipt above.
