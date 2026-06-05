---
title: Cross-repo trust and discovery design
doc_type: spec
status: draft
owner: platform
last_reviewed: 2026-06-05
---

# Technical Design

## Overview

This spec improves cross-repo daily usefulness without changing the core
architecture. It keeps MCP handlers thin, uses application use cases for
orchestration, relies on presenters for public response construction, and adds
language/project evidence through adapter and validation ports.

The work is intentionally staged: fix trust and scope visibility first, then
project-shape validation, then first-slice language identity and symbols.
Dogfood repositories are used as examples only; fixtures and implementation
must model generic repository shapes rather than product-specific behavior.

## High-Level Design

### First-Call Trust

`repo:///status`, `repo:///scope`, and `repo:///overview` should share
presentation metadata helpers so freshness, warmup state, capability, and coarse
language coverage are composed consistently. Status remains cheap and must not
enumerate broad catalog rows; it may use persisted snapshot summary rows or
bounded metadata produced during warmup.

### Scope Visibility And Skipped Roots

The file catalog should recognize common source extensions even when semantic
adapters are unavailable. Generated/cache roots such as `.gocache` should be
skipped by default. Scope should preserve representative language categories
under row caps and report truncation rather than silently hiding unsupported
source languages.

### Next-Action Visibility

Next-action construction should validate public tool names against the active
MCP registry or integration profile. Internal worker operations must not appear
as agent-callable actions. If graph warmup remains automatic only, recovery
guidance should describe freshness state or direct source verification rather
than recommending `prewarm_graph`.

### Context Ranking

Context ranking should combine prompt matches, explicit files, graph/resource
evidence, repository-shape hints, and generated/vendor policy. File-seeded
requests should boost same-directory source pairs, local build files such as
`CMakeLists.txt`, and nearby tests. Broad requests should downrank generated
data, vendored docs, installer docs, and fixture blobs unless prompted.

### Validation Planning

Validation discovery should select command families from repository shape. Go
evidence includes `go.mod`, `go.work`, `Makefile`, Docker compose/test config,
and conventional Go test locations. CMake evidence includes root and local
`CMakeLists.txt`, build directories, test CMake files, and C/C++ source trees.
Incidental Node tooling should not dominate when the primary project shape is
clearly Go or CMake/C++.

### Go First Slice

The initial Go adapter path should classify `.go` files, discover Go project
files, and extract package/function/type/method declarations. It should provide
routing evidence to context and symbol search while leaving references and
impact low confidence until fixture-backed resolution exists.

### C/C++ First Slice

The initial C/C++ adapter path should classify common source/header extensions,
route `.pyi` files as Python-like stubs, extract declarations/includes, and add
CMake target membership as resource-backed project evidence. Full C++ semantic
navigation remains later work.

## Data And Contract Impact

- Prefer existing contract fields for freshness, capability, evidence kinds,
  verification status, warnings, errors, and next actions.
- Add public fields only if existing metadata cannot express the needed trust
  or ranking reason.
- Any new language or evidence labels must be added through runtime contracts
  and covered by contract tests.

## Testing Strategy

- Fixture repositories for generic Python-service, Go-service, and CMake/C++
  cases inspired by dogfood findings.
- Budget tests proving status remains cheap and scope reports truncation.
- MCP presenter tests proving next actions are public and compact.
- Validation-plan tests for Go, CMake/C++ with incidental `package.json`, docs,
  and mixed-language repositories.
- Adapter extraction tests for Go and C/C++ first-slice symbols.

## Operational Considerations

- External dogfood repositories remain manual validation sources, not required
  test dependencies.
- Existing MCP clients must remain compatible with current response envelopes.
- Startup warmup remains automatic; this spec should not add a hidden broad
  warmup command path.
- No validation command execution is added in this spec.

## Promotion Targets

Accepted behavior should be promoted to:

- [MCP surface design](../../design/mcp-surface-design.md)
- [Runtime operations design](../../design/runtime-operations-design.md)
- [Language adapter design](../../design/language-adapter-design.md)
- [Edit and validation loop design](../../design/edit-and-validation-loop-design.md)
- [Language capability matrix](../../reference/language-capability-matrix.md)
- [Runtime contracts](../../reference/runtime-contracts.md), if public metadata
  changes
- [MVP proof matrix](../../reference/mvp-proof-matrix.md), if new fixtures
  become durable proof gates
