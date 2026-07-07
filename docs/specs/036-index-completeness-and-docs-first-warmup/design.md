---
title: Index completeness and docs-first warmup design
doc_type: spec
artifact_type: design
status: draft
owner: platform
last_reviewed: 2026-07-07
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Technical Design

## Overview

The current implementation performs one bounded startup scan and uses that same
file list for both graph extraction and docs FTS indexing. This design splits
warmup into evidence-specific phases and makes incomplete coverage explicit.

The target architecture is:

1. Docs/config seed phase: index `AGENTS.md`, `README.md`, durable `docs/**`,
   spec docs, and selected config manifests early.
2. Graph seed phase: run bounded parser/resource extraction for fast first-use
   symbol and routing evidence.
3. Completion phase: resume background indexing over files not covered by the
   seed phases, or explicitly keep the affected evidence class partial/blocked
   until completion is available.
4. Metadata phase: expose separate docs and graph coverage state through
   response metadata and tool outputs.

The implementation should avoid hidden fallbacks. If an index is incomplete,
the response must say so and route the agent to direct reads or refresh where
appropriate.

## Requirement Coverage

| Requirement | Acceptance Criteria | Design Coverage | Validation Approach |
| --- | --- | --- | --- |
| Requirement 1 | AC1, AC2, AC3 | Add partial/truncated coverage state for docs and graph evidence; prevent truncated warmup from being published as complete freshness. | Large-repo truncation tests; response metadata tests; status/MCP golden tests. |
| Requirement 2 | AC1, AC2, AC3 | Add docs-first or docs-dedicated indexing independent from source graph traversal budget. | Docs FTS fixture with > budget files before `docs/`; docs search tests. |
| Requirement 3 | AC1, AC2, AC3 | Keep graph warmup budget as seed-phase resource control; add completion state or explicit partial reporting. | Runtime warmup and watcher queue tests; status metadata tests. |
| Requirement 4 | AC1, AC2, AC3 | Add coverage counts/truncation fields and clarify `result_count` semantics. | Contract tests, presenter tests, docs search tests. |
| Requirement 5 | AC1, AC2, AC3 | Add deterministic fixture emulating aws-datalake failure class. | New fixture-backed Vitest tests. |

## Correctness Property Coverage

| Property | Design Behavior | Validation Direction | Notes |
| --- | --- | --- | --- |
| CP-001 | Snapshot/tool metadata records partial coverage when scan truncates. | Contract/status/docs-search tests. | Exact field names are implementation decisions, but trust semantics are required. |
| CP-002 | Docs and graph coverage are tracked separately. | Contract tests and docs-search-vs-symbol-search fixture. | Avoid one global freshness flag masking evidence-specific state. |
| CP-003 | Docs indexing has a docs-first input set not limited to source graph seed order. | Large-repo docs fixture. | Direct docs reads remain available but are not a hidden search fallback. |
| CP-004 | Completion state is explicit and monotonic within a repository version. | Runtime queue/completion tests. | Repository changes may legitimately stale a completed index. |

## High-Level Design

### System Architecture

```text
MCP startup
  -> schedule background warmup
       -> docs/config seed phase
       -> graph seed phase
       -> optional completion phase
  -> tools read evidence-specific coverage metadata
       -> docs_search: docs index state
       -> graph tools: graph index state
       -> direct-read tools: filesystem scan/read state
```

### Components and Changes

- `src/server.ts`
  - Keep startup non-blocking.
  - Replace a single `startupWarmupMaxFiles` interpretation with phase-specific
    budgets or pass enough configuration to distinguish docs seed, graph seed,
    and completion behavior.

- `src/application/use-cases/index-repository-graph.ts`
  - Stop deriving docs-index input exclusively from the graph seed scan.
  - Return coverage metadata for graph and docs indexing.
  - Mark truncated evidence as partial rather than complete.

- `src/infrastructure/filesystem/file-catalog-scanner.ts`
  - Keep general scanner behavior stable unless a targeted docs scan mode is
    introduced.
  - If traversal priority changes, add tests showing source and docs routing
    both remain predictable.

- `src/infrastructure/sqlite/graph-store.ts`
  - Persist or expose docs-index coverage state.
  - Clarify docs search result counts and pagination metadata.
  - Ensure snapshot selection cannot hide partial docs coverage behind a global
    freshness label.

- `src/application/use-cases/response-metadata.ts`
  - Extend trust metadata derivation to communicate docs/graph partial evidence
    without overclaiming validation or completeness.

- Tests
  - Add fixture-backed large-repo docs-index tests.
  - Add response metadata/status tests for partial/truncated evidence.
  - Add runtime queue/completion tests if completion is implemented in this
    slice.

### Data Models

Implementation should choose the smallest additive model that preserves
backward compatibility. Candidate fields:

```ts
type EvidenceCoverageState = "complete" | "partial" | "refreshing" | "stale" | "blocked" | "unknown";

type IndexCoverage = {
  evidence_class: "docs" | "graph";
  state: EvidenceCoverageState;
  indexed_files?: number;
  eligible_files_seen?: number;
  scan_truncated?: boolean;
  indexed_roots?: readonly string[];
  missing_priority_roots?: readonly string[];
  reason?: string;
};
```

This may live in response metadata, snapshot metadata, or a dedicated SQLite
table. The final location must align with `docs/reference/runtime-contracts.md`
and `docs/design/graph-store-design.md`.

### Data Flow

Docs-first warmup:

```text
scan docs/config priority set
  -> read Markdown docs
  -> parse headings and selected text
  -> replace docs FTS rows for snapshot or docs index generation
  -> record docs coverage state
```

Graph seed warmup:

```text
scan source/resource priority set with bounded budget
  -> run extractors/resource extraction
  -> write graph/catalog rows
  -> record graph coverage state
```

Completion phase:

```text
persist remaining scan cursor or completion request
  -> process remaining eligible files in background
  -> update coverage state
  -> mark stale or blocked on repo changes or indexing errors
```

If completion is not implemented in the first slice, partial state and a
durable follow-up destination are mandatory.

## Low-Level Design

### Algorithms and Logic

Docs input selection should not depend on the first source graph page. The
simplest acceptable algorithm is a docs-specific scan:

```text
function buildDocsIndexInput(repoRoot):
    scan repository with docs row limit and normal skip policy
    select markdown files from AGENTS.md, README.md, docs/**, and allowed docs roots
    order front-door docs first, then durable docs by canonical priority and path
    return docs files plus coverage metadata
```

Graph seed indexing can remain bounded:

```text
function buildGraphSeedInput(repoRoot, maxFiles):
    scan repository with graph seed budget
    extract symbols/resources from scanned files
    if scan truncated:
        graph coverage = partial
    else:
        graph coverage = complete
```

Snapshot freshness must not collapse evidence coverage:

```text
if docs coverage is complete and graph coverage is complete:
    snapshot freshness may be fresh
else:
    snapshot freshness or metadata must indicate partial coverage
```

### Function Signatures and Interfaces

Potential interface additions:

```ts
type IndexRepositoryGraphResult = {
  snapshot_id: string;
  repo_root: string;
  scanned_files: number;
  extracted_files: number;
  resource_backed_files: number;
  unsupported_files: number;
  node_count: number;
  edge_count: number;
  unresolved_reference_count: number;
  truncated: boolean;
  coverage?: readonly IndexCoverage[];
};
```

Potential docs search result metadata:

```ts
type DocsSearchResult = {
  // existing fields
  docs_index_state?: EvidenceCoverageState;
  indexed_docs_count?: number;
  docs_scan_truncated?: boolean;
};
```

Exact contract changes must be additive and reflected in contract schemas and
presenters.

### Error Handling

- Docs-index blocked state should remain blocked when storage is unavailable or
  schema-incompatible.
- Partial state should be used when indexing succeeded for a subset but coverage
  is incomplete.
- Do not convert partial indexed results into success without caveats.
- Do not hide docs-index incompleteness with direct filesystem search inside
  `docs_search`; direct read tools may be suggested as next actions.

### Security, Trust, and Access

- Reuse existing workspace path and skip policies.
- Do not index generated, secret, ignored, or workspace-escape paths.
- Do not expose sensitive path contents in snippets beyond existing redaction
  policy.
- Trust metadata must list what the evidence is safe and not safe to use for.

### Migration and Compatibility

- Existing SQLite snapshots may not have coverage metadata. Treat them as
  `unknown` or `partial` where needed rather than claiming complete coverage.
- Additive contract fields are preferred. Existing clients that ignore unknown
  fields must keep working.
- If schema changes are required, update schema validation and blocked-state
  behavior.

### Slice Boundary And Residual Architecture

| Design target | In this slice | Out of this slice | Follow-up destination | Blocks closure? |
| --- | --- | --- | --- | --- |
| Docs-first searchable index | Required | None | n/a | yes |
| Partial/truncated freshness semantics | Required | None | n/a | yes |
| Full resumable background completion | Prefer required; may be partial-routed only if metadata is correct | Sophisticated scheduler, worker pool tuning | `docs/backlog/README.md` if deferred | yes unless routed with accepted rationale |
| Query ranking/tokenization improvements | Only result-count and coverage semantics required | Synonym expansion, stemming, domain dictionaries | backlog if needed | no |
| All-parser semantic completeness | Not included | Alternate parser/LSP fallbacks | none | no |

## Validation Strategy

| Validation | Covers | Evidence Location | Residual Risk |
| --- | --- | --- | --- |
| Large-repo docs fixture test | Requirements 2 and 5 | `tests/docs` or `tests/graph` | Fixture must emulate traversal cap deterministically. |
| Truncated warmup metadata test | Requirements 1 and 3 | `tests/runtime`, `tests/mcp` | Exact field names may evolve during implementation. |
| Docs-search contract/presenter tests | Requirement 4 | `tests/contracts`, `tests/mcp`, `tests/docs` | Consumers ignoring metadata still need safe defaults. |
| Watcher/completion test | Requirement 3 | `tests/runtime` | If completion is deferred, partial state must be explicit. |
| `pnpm typecheck` and targeted/full `pnpm test` | Integration confidence | `verification.md` | Native dependency issues must be reported, not masked. |

## Downstream Task Guidance

- Start with failing fixture coverage before changing warmup behavior.
- Keep docs-index changes independent from parser fallback or semantic
  extraction changes.
- Prefer additive metadata contracts.
- Update durable docs before closure.
- Ask for review if implementation narrows or defers completion behavior.

## Operational Considerations

- Startup should stay non-blocking.
- Background work should not monopolize CPU, file IO, or SQLite locks.
- Partial coverage must be visible to agents during and after warmup.
- Existing per-repo caches may need refresh or schema migration.

## Open Questions

- Should completion work be implemented in this spec or should this spec first
  require partial-state correctness plus docs-first indexing?
- Should docs-index coverage live in the snapshot table, a separate coverage
  table, or only in response metadata derived during indexing?
- Should the startup graph seed budget remain `2000`, become configurable by
  repo size, or be replaced by time-sliced work?

## Related Artifacts

- Requirements: `requirements.md`
- Change Impact: `change-impact.md`
- Tasks: `tasks.md`
- Verification: `verification.md`
