---
title: Rails routing concern identity design
doc_type: spec
artifact_type: design
status: draft
owner: platform
last_reviewed: 2026-08-02
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Technical Design

## Overview

Extend the existing Ruby tree-sitter extraction and graph resolution path with
one new declaration kind and one specialized Rails route-reference form. A
static `concern :name do` block becomes a `rails_route_concern` node. Static
reuse names become `ruby_route` references carrying
`route_form: "concerns"`. Existing graph resolution creates an edge only for a
single matching concern node; references, impact, search, and task context then
consume the same graph without Rails-specific query code.

## Requirement Coverage

| Requirement | Acceptance criteria | Design coverage | Validation approach |
| --- | --- | --- | --- |
| R1 | AC1-AC4 | Source-distinct declaration nodes; unsupported declarations emit dynamic evidence. | Parser and extractor fixtures. |
| R2 | AC1-AC5 | Direct, array, and resource-option reuse extraction; unique candidate resolution. | Parser plus graph tests. |
| R3 | AC1-AC3 | Reuse metadata copies current route context; the incoming reuse edge and outgoing contained-route edges form one provenance-preserving path through the concern node. | Scoped fixture assertions and multi-hop graph traversal. |
| R4 | AC1-AC4 | Existing graph store and query use cases consume normal nodes and edges. | Reference, impact, symbol/task-context evidence. |
| R5 | AC1-AC3 | No recursive expansion; nested reuse is a finite parsed edge set; parser errors follow existing behavior. | Nested/cycle fixture and regression suite. |

## Correctness Property Coverage

| Property | Design behavior | Validation direction |
| --- | --- | --- |
| CP-001 | Node identity includes repository path, declaration kind, static name, and source start position. | Repeated extraction equality and duplicate-node test. |
| CP-002 | Resolver selects only `rails_route_concern` nodes with matching static names and resolves exactly one. | Unique, missing, and duplicate graph cases. |
| CP-003 | Declaration and reuse metadata include parser, source range, static flag, and route scope; a traversal path combines reuse-edge provenance with contained-route edges originating at the declaration node. | Metadata and multi-hop traversal assertions. |
| CP-004 | Candidate count controls resolution; adding a duplicate leaves the reference unresolved. | Ambiguity regression. |
| CP-005 | Extraction records relationships only and performs no concern expansion or recursive traversal. | Cyclic concern fixture terminates with finite edges. |
| CP-006 | All new evidence is emitted by `RubyParserAdapter` and resolved by the existing graph indexer. | Code review and full regression suite. |

## High-Level Design

```text
tree-sitter Ruby call
  -> static concern declaration node
     -> contained route/reuse references use declaration as source
  -> static concerns reuse reference + current route scope
     -> existing resolver -> exactly one concern node, or unresolved evidence
        -> existing find-references / impact / ranked-symbol context
```

### Components and changes

- `ruby-parser.ts`: recognize concern syntax before generic call extraction,
  parse only non-interpolated symbol operands, and carry an explicit concern
  scope while visiting a declaration block.
- `ruby-extractor.ts`: no special branch is required; the generic declaration
  and unresolved-reference conversion accepts string node kinds and metadata.
- `index-repository-graph.ts`: add a concern-specific `ruby_route` candidate
  pool and kind guard before controller/action route handling.
- Query surfaces: no code change planned. The new node and edge participate in
  existing name search, reference lookup, impact traversal, and ranked symbol
  selection.

### Data model

Concern declaration nodes use:

```text
kind: rails_route_concern
name: <plain symbol name>
qualified_name: RailsRoutes.Concern.<name>@<line>:<column>
metadata.declaration_kind: rails_route_concern
metadata.route_concern_name: <plain symbol name>
metadata.declaration_source: tree-sitter-ruby
```

Reuse references use `kind: ruby_route`, the plain concern name, and metadata:

```text
route_form: concerns
route_concern_name: <plain symbol name>
route_concern_source: direct | resource_option
route_namespace / route_path_prefix / route_scope: current static context
```

Dynamic operands remain `ruby_dynamic` references with a bounded reason.

### Provenance across reuse and contained routes

The system does not synthesize a direct reuse-to-controller edge. Instead, the
existing graph represents an explainable two-edge path:

```text
reuse source --ruby_route concerns edge with reuse scope--> concern node
concern node --contained ruby_route edge with declaration range--> controller
```

The first edge retains the reuse file, range, namespace, path prefix, resource
scope, and parser provenance. The second retains the declaration file, range,
concern identity, and parser provenance. Existing bounded impact traversal over
both edges therefore exposes both origins without pretending to have composed a
runtime route set. Different reuse scopes remain separate incoming edges.

## Low-Level Design

### Algorithms and logic

1. On a `concern` call, accept exactly one symbol-literal name and a block.
2. Emit a source-distinct declaration and visit the block with its qualified
   name on the extraction scope stack. Do not also emit a generic `ruby_call`.
3. On `concerns`, accept one or more direct symbol operands and flatten a
   literal array operand; emit one static reference per symbol and one dynamic
   reference per unsupported operand.
4. On `resource` or `resources`, preserve the ordinary resource reference and
   additionally parse the `concerns:` pair through the same operand helper.
5. During graph resolution, select only matching concern nodes. Resolve one,
   retain zero as missing, and retain more than one as ambiguous.

### Error handling

- Unsupported declarations and operands produce existing structured dynamic or
  unresolved evidence; no source execution or alternate parse occurs.
- Malformed tree-sitter output follows the current parser failure path.
- Static cycles are harmless because extraction and graph resolution do not
  recursively expand concern bodies.

### Security, trust, and access

Repository source remains untrusted data parsed in-process. The design adds no
process execution, network access, credentials, writes outside the workbench
repository, or Rails application boot.

### Migration and compatibility

No migration or feature flag is needed. Existing snapshots are replaced by the
normal indexing workflow. Public graph shapes already allow string node and
edge kinds. Existing route behavior remains unchanged because concern
resolution is selected only by explicit metadata.

### Slice boundary and residual architecture

| Design target | In this slice | Out of this slice | Follow-up | Blocks closure? |
| --- | --- | --- | --- | --- |
| Routing concern identity | Symbol block declarations and static reuse | Callable/string/computed declarations | EB010 | no |
| Reuse composition | Relationship and contained-route traversal | Runtime option evaluation and cloned route expansion | EB010 | no |
| Rails route DSL | `concern`, `concerns`, `concerns:` | Engines, mounts, redirects, `resolve`, runtime route sets | EB010 | no |
| Query integration | Existing graph search/reference/impact/context routes | Rails-specific endpoint | none | no |

## Validation Strategy

| Validation | Covers | Evidence location | Residual risk |
| --- | --- | --- | --- |
| Focused parser tests | R1-R3, CP-001, CP-003, CP-005 | `verification.md` | Grammar variants outside fixtures. |
| Focused graph tests | R2-R5, CP-002, CP-004 | `verification.md` | Query evidence remains bounded. |
| Focused task-context test | R4 AC4 | `verification.md` | Context ranks the node and routes graph follow-up; it does not inline traversal results. |
| Typecheck and full Vitest suite | CP-006 and regressions | `verification.md` | None known. |
| Two read-only Rails dogfood runs | SC-004 | Ephemeral verification plus bounded ledger summary | Project samples are not universal. |
| MoE implementation review | Architecture, QA, lifecycle/evidence | `verification.md` | Findings must be dispositioned. |

## Downstream Task Guidance

- Review this design before drafting tasks.
- Give one implementation worker ownership of the tightly coupled parser,
  resolver, fixture, and focused tests; keep spec and durable-doc integration in
  the parent agent.
- Map all six correctness properties in traceability.
- Re-review any implementation change that adds schema, public-contract, or
  query-surface work because those are not part of this design.

## Operational Considerations

No deployment or migration operation is introduced. Index rebuilds naturally
pick up the new evidence. Dogfood targets must remain read-only.

## Open Questions

None blocking. Option-dependent route expansion and callable concerns remain
explicit EB010 follow-up work.

## Related Artifacts

- Requirements: `requirements.md`
- Research: `research.md`
- Change impact: `change-impact.md`
- Tasks: `tasks.md`
- Verification: `verification.md`

Post-implementation reconciliation on 2026-08-02 confirmed the delivered
route-file domain guard, public graph-query evidence, and fail-closed behavior
remain within this accepted design.
