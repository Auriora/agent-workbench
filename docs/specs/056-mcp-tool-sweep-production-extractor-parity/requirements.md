---
title: MCP tool-sweep production extractor parity requirements
doc_type: spec
artifact_type: requirements
status: active
owner: platform
last_reviewed: 2026-08-04
---

# Requirements

## Introduction

Real-repository dogfood found that the checkout-only MCP tool sweep constructs
a smaller extractor registry than production startup. Production registers C,
C++, Go, JavaScript, TypeScript, Python, and Ruby, while the sweep registers
only JavaScript, TypeScript, Python, and Ruby. As a result, successful sweep
reports cannot prove the shipped Go or C/C++ graph paths.

This spec removes that proof gap without adding another parser, fallback, or
public MCP surface.

## Goals

- Give production startup and the debug sweep one canonical production
  extractor-registry composition.
- Make ecosystem-aware sweep probes select Go and C/C++ evidence when those
  project shapes are the intended target.
- Prove parity and graph-backed sweep behavior with repository-owned fixtures.

## Non-Goals

- Promoting C/C++ beyond its current resource-backed, heuristic evidence.
- Deepening Go semantics, adding compiler/LSP enrichment, or changing graph
  resolution.
- Running target-repository commands or exposing the sweep through MCP.
- Adding a second registry, compatibility mode, retry, or fallback path.

## Durable Source Baseline

| Source | Current behavior relied on | Confidence |
| --- | --- | --- |
| `docs/design/observability-debugging-design.md` | The sweep is checkout-only, read-only against external repositories, and expected to exercise promoted adapters. | high |
| `docs/design/language-adapter-design.md` | One tree-sitter extraction path and truthful capability/provenance labels govern supported languages. | high |
| `docs/reference/language-capability-matrix.md` | Go is partial-semantic; C/C++ remains resource-backed with heuristic routing. | high |
| `docs/backlog/README.md` | EB010 owns fixture-gated language and ecosystem promotion. | high |

## Requirements

### Requirement 1: Canonical production extractor composition

**Priority:** must-have

1. The runtime SHALL define one canonical factory for the complete production
   extractor registry.
2. Production startup and the MCP tool sweep SHALL use that same factory.
3. The canonical registry SHALL contain exactly C, C++, Go, JavaScript,
   TypeScript, Python, and Ruby unless a future fixture-backed change updates
   the production set.
4. The implementation SHALL NOT introduce an alternate extractor or fallback
   registry.

### Requirement 2: Ecosystem-aware sweep probing

**Priority:** must-have

1. GIVEN a Go repository with first-party Go declarations, WHEN graph warm-up
   and sweep discovery run, THEN symbol, reference, impact, and context probes
   SHALL select indexed Go evidence ahead of incidental languages.
2. GIVEN a CMake/C++ repository with first-party C/C++ declarations, WHEN the
   same sweep runs, THEN its graph-backed probes SHALL select indexed C/C++
   evidence ahead of incidental language stubs or tooling.
3. Ruby/Rails preference and existing Python and JavaScript/TypeScript behavior
   SHALL remain intact.

### Requirement 3: Truthful capability and failure behavior

**Priority:** must-have

1. Go sweep evidence SHALL retain parser provenance and partial-semantic
   capability.
2. C/C++ sweep evidence SHALL retain heuristic provenance, resource-backed
   capability, and conservative impact/reference qualifications.
3. Missing or unusable indexed evidence SHALL remain partial, degraded,
   blocked, or invalid as appropriate; the sweep SHALL NOT manufacture a
   success-shaped fallback.
4. External target repositories SHALL remain read-only and no project command
   SHALL be executed.

### Requirement 4: Drift-resistant regression evidence

**Priority:** must-have

1. A focused regression SHALL fail if production and sweep composition diverge.
2. Fixture-backed Go and C/C++ sweep tests SHALL prove that warm-up produces
   indexed declarations and that graph-backed public probes use them.
3. Typecheck, focused tests, architecture boundaries, and the bounded full suite
   SHALL pass before completion.

## Correctness Properties

- **CP-001:** Every consumer of the production registry observes the same
  sorted language set.
- **CP-002:** Ecosystem selection is deterministic for the same catalog.
- **CP-003:** Probe capability and provenance never exceed the selected
  extractor's stored evidence.
- **CP-004:** The sweep performs no writes or command execution in external
  target repositories.

## Success Criteria

- **SC-001:** Registry parity is structural rather than maintained by duplicate
  lists.
- **SC-002:** Go and C/C++ fixture sweeps use indexed language evidence.
- **SC-003:** Existing Ruby, Python, and JS/TS sweep regressions remain green.
- **SC-004:** Durable debugging guidance records the canonical parity rule.
