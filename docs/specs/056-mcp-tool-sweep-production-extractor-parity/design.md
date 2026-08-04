---
title: MCP tool-sweep production extractor parity design
doc_type: spec
artifact_type: design
status: active
owner: platform
last_reviewed: 2026-08-04
---

# Technical Design

## Overview

Move production extractor composition into one infrastructure factory and make
both startup warm-up and the checkout debug sweep consume it. Extend the
sweep's deterministic source-symbol discovery to understand Go and C/C++ and
to prefer the dominant project shape evidenced by `go.mod` or CMake files.

The factory composes existing adapters only. It does not change extractor
contracts, graph resolution, or parser implementation. Graph query presenters
derive capability and provenance from stored nodes so the newly exercised
heuristic C/C++ path is not mislabeled as parser-backed.

## High-Level Design

### Architecture And Ownership

- `src/infrastructure/extraction/production-extractor-registry.ts` owns the
  canonical production adapter set and returns `ExtractorRegistryAdapter`.
- `src/infrastructure/workers/startup-graph-warmup-worker.ts` remains the
  production composition consumer and no longer repeats registrations.
- `src/debug/mcp-tool-sweep.ts` remains checkout-only and consumes the same
  factory before running the normal graph-build use case.
- `src/application/use-cases/query-helpers.ts`, `find-references.ts`, and
  `compute-impact.ts` preserve stored node capability and provenance in public
  reference and impact evidence.
- `tests/mcp/debug-harness.test.ts` proves registry parity and complete
  graph-backed Go/C++ probe selection through existing fixtures.

## Requirement Coverage

| Requirement | Design coverage | Verification |
| --- | --- | --- |
| Requirement 1 | one exported production registry factory used by both composition roots | registry language-set and source-boundary tests |
| Requirement 2 | project-shape-aware language ordering and indexed-symbol discovery | Go and CMake/C++ sweep fixtures |
| Requirement 3 | unchanged extractor outputs and existing sweep quality presentation | capability/provenance assertions and regression suite |
| Requirement 4 | parity plus graph-backed fixture tests | focused, architecture, typecheck, full suite |

## Low-Level Design

### Canonical Registry

The factory registers, in explicit composition order:

1. C
2. C++
3. Go
4. JavaScript
5. TypeScript
6. Python
7. Ruby

Registry lookup remains keyed by language, and `availableLanguages()` remains
the stable sorted inspection surface. Tests assert the public language set and
that both consumers call the factory rather than constructing their own
production list.

### Sweep Ecosystem Selection

The sweep expands its supported symbol grammars with bounded declaration
patterns:

- Go: `func` and `type`
- C/C++: `class`, `struct`, and function definitions suitable for the existing
  declaration extractor

Language order is chosen deterministically:

1. Rails-shaped repositories prefer Ruby, preserving existing behavior.
2. Repositories with `go.mod` and Go files prefer Go.
3. Repositories with CMake evidence and C/C++ files prefer C++ then C.
4. Other repositories retain the existing Python, TypeScript, JavaScript,
   Ruby order, followed by Go and C/C++.

The sweep still verifies candidates against the indexed graph before selecting
the query. Regex discovery is only a bounded candidate generator; it is not a
semantic fallback.

## Data Flow

```text
canonical production registry factory
  -> startup graph warm-up worker
  -> checkout MCP tool-sweep warm-up
  -> normal repository graph-build use case
  -> indexed symbol selection
  -> symbol/reference/impact/context public probes
```

## Failure And Trust Behavior

- If no candidate maps to an indexed node, existing sweep quality assessment
  remains authoritative.
- Go continues to expose parser-backed partial-semantic evidence.
- C/C++ continues to expose resource-backed heuristic evidence; this spec does
  not promote it.
- Reference targets and impact confidence use the traversed nodes' stored
  evidence rather than a parser default.
- No target command, build, test, dependency installation, or container is
  started by the sweep.

## Compatibility And Migration

There is no schema, persisted-data, public MCP, package, or configuration
migration. The debug harness is stripped from installed packages as before.
Startup behavior is composition-equivalent, with regression evidence ensuring
the same adapter set remains present.

## Operational Considerations

No rollout switch, background service, cache migration, or target-repository
command is required. Existing graph snapshots remain readable. The change is
reversible by reverting the shared factory adoption, although the parity test
must continue to fail if consumer-local lists diverge.

## Validation Strategy

1. Registry factory unit/contract assertions.
2. Focused debug-harness Go and C/C++ fixture sweeps.
3. Existing Ruby and indexed-symbol sweep regressions.
4. Architecture boundary tests and TypeScript typecheck.
5. Bounded full Vitest run.
6. Real-repository read-only reruns against OneMount and yaml-cpp if fixture
   evidence passes.

## Durable Promotion

- Update `docs/design/observability-debugging-design.md` with the canonical
  production-registry rule and supported sweep probe ecosystems.
- Update `docs/backlog/README.md` under EB010 with the delivered dogfood proof
  boundary, without creating a separate EB item.
- Add bounded real-repository evidence to
  `docs/reference/dogfood-evidence-ledger.md` only after successful reruns.

## Open Questions

None. Future adapter additions must update the canonical factory and its parity
test rather than adding consumer-local registration.
