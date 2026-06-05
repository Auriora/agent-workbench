---
title: TimeLocker dogfood follow-up design
doc_type: spec
status: archived
owner: platform
last_reviewed: 2026-06-05
---

# Technical Design

## Closure Record

Spec 002 closed on 2026-06-05. Accepted behavior was promoted into durable
design/reference docs; cross-repo dogfood gaps from TimeLocker, OneMount, and
FreeCAD are handled by
[Spec 003](../003-cross-repo-trust-discovery/requirements.md).

## Overview

This spec extends the closed MVP with targeted reliability and workflow
improvements discovered by dogfooding Agent Workbench against TimeLocker. The
design keeps the existing architecture: MCP handlers stay thin, application
use cases own orchestration, presenters own public envelopes, ports define
runtime boundaries, and infrastructure adapters remain replaceable.

The work should improve daily coding usefulness without adding hidden parser,
semantic, diagnostics, or command-execution fallbacks. Where recall needs
lexical assistance, the result must label that evidence explicitly and avoid
presenting it as semantic proof.

## High-Level Design

### Fast Status

`repo:///status` should become a lightweight health packet. It should read only
metadata that is already cheap:

- repo root
- snapshot id and freshness
- warmup state and owner state
- schema/config identity
- coarse adapter coverage from persisted summary rows or bounded cached
  evidence
- pending work and degraded blockers
- row/time budget metadata

Detailed language counts, key files, and scanned scope remain owned by
`repo:///scope` and `repo:///overview`. Status must not enumerate thousands of
catalog rows on the hot path.

If persisted summaries do not exist yet, status should return cold or
refreshing state with explicit pending work, not block behind warmup.

### Trust Labels

The shared response metadata already contains `freshness`, `capability_level`,
`evidence_kinds`, `verification_status`, and caveats. This spec should make the
labels more consistent and useful by:

- mapping tool-specific evidence to the strongest safe capability level
- adding caveats when graph data is stale, refreshing, lexical-assisted, or
  local-only
- ensuring presenters preserve trust metadata instead of flattening it
- keeping row-level evidence where mixed evidence appears in one result

If a new field is required for intended use, add it to runtime contracts first
and update contract tests before changing presenters.

### Nearest-Test Planning

`verification_plan` should add a nearest-test discovery phase before broad
command planning. Discovery sources, in priority order:

1. Explicit test files from `files` and `changed_files`.
2. Direct sibling and convention matches such as `tests/**/test_<name>.py`.
3. Same-package tests that import or mention the implementation module.
4. Graph-backed references from tests to changed symbols.
5. Broad pytest or package-manager commands as fallback.

The planner should preserve the current plan-only behavior. It must not run
pytest, linters, formatters, or diagnostics in this slice.

### Symbol Discovery

Exact symbol discovery should query both `name` and `qualified_name` with
case-sensitive exact lookup first, then case-insensitive exact lookup, then FTS
or fuzzy lookup. Results should include why a result matched and whether exact
matching failed.

Fixture coverage should include TimeLocker-shaped class and method names:

- `RepositoryResolver`
- `RepositoryResolver.resolve_repository`
- `ConfigValidationService`
- URI or validation-service function names that previously produced weak
  rankings

### References And Impact

Parser-backed edges remain primary. The reference tool should improve recall by
combining:

- resolved parser edges
- unresolved parser references with candidate metadata
- bounded lexical identifier hits when parser evidence is incomplete

Lexical hits must carry lower confidence and `evidence_kinds` that make them
visibly different from parser-backed evidence. Impact should report confidence
and insufficiency clearly when traversal is local-only or edge counts are zero.

### Next Action Ranking

Next actions should be a small ranked guide, not a backlog. The ranking policy
should prefer:

1. direct source verification for selected edit targets when evidence is weak
2. `verification_plan` after enough context is gathered
3. exact `symbol_search` when a named symbol is unresolved
4. `find_references` only when a target symbol is resolved
5. `impact` only when reference evidence is strong enough to make traversal
   meaningful

Limit default next actions to three unless a tool-specific contract justifies a
different cap.

### Overview Ranking

Overview should boost durable guidance and repo-entry docs:

- `AGENTS.md`
- `README.md`
- `docs/guides/**`
- architecture, developer, runbook, or operational guidance docs

It should downrank:

- templates
- archived specs
- update logs
- project-management notes
- generated/cache docs

Task-specific tools may still surface update notes when task terms match them.

## Low-Level Design Notes

- Add fixture repositories or fixture slices that model the TimeLocker
  scenarios without depending on the external TimeLocker checkout.
- Keep TimeLocker external dogfood as manual validation evidence, not as a
  required automated test dependency.
- Add budget tests for status to prove it does not enumerate the full catalog.
- Add contract tests before adding any new public metadata field.
- Keep lexical reference support behind an explicit evidence label and row cap.
- Use structured parsers or existing graph/file APIs; avoid ad hoc broad shell
  search in application use cases.

## Operational Considerations

- Startup warmup may still be running when the first status read occurs; status
  must treat that as a normal state.
- Multiple Codex sessions may start Agent Workbench against the same repo.
  Ownership and observer state should be reported without blocking reads.
- Existing MCP clients must continue to work when new metadata is added.
- Broad validation and diagnostics execution remain post-MVP unless explicitly
  designed with command safety.

## Promotion Targets

When implemented, accepted behavior should be promoted to:

- [MCP surface design](../../design/mcp-surface-design.md)
- [Runtime operations design](../../design/runtime-operations-design.md)
- [Graph store design](../../design/graph-store-design.md)
- [Edit and validation loop design](../../design/edit-and-validation-loop-design.md)
- [Runtime contracts](../../reference/runtime-contracts.md), if public schema
  fields change
- [MVP proof matrix](../../reference/mvp-proof-matrix.md), if new fixtures or
  proof gates are added
