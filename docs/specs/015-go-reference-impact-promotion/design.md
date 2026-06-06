---
title: Go reference impact promotion design
doc_type: spec
artifact_type: design
status: archived
owner: platform
last_reviewed: 2026-06-06
---

# Technical Design

## Overview

Deepen Go from declaration routing toward partial-semantic reference and impact
evidence. The adapter emits parser-backed package, import, declaration, and
reference records. Shared graph resolution turns resolvable local edges into
queryable references with explicit confidence.

## High-Level Design

Components:

- Go syntax extractor for package clauses, imports, declarations, receivers,
  selectors, and identifier references.
- Package identity normalizer for file package, import path hints, and module
  root evidence from `go.mod`.
- Shared reference resolver for package-local and explicit-import candidates.
- Impact ranking updates that prefer affected Go source, tests, package peers,
  and import edges.
- Validation planning policy reader that prioritizes repo guidance, Docker,
  devcontainer, CI, and Makefile evidence before generic Go commands.

## Low-Level Design

The first implementation should resolve:

- same-package function/type/method identifier references
- receiver method references when receiver type evidence is explicit
- imported package selector references when the import alias and package symbol
  are both known from indexed files

It should not resolve:

- build-tag-specific variants without explicit catalog support
- generated symbols outside indexed first-party files
- type-inferred method calls requiring `gopls` or compiler analysis

## Operational Considerations

- Keep `go test` and `go list` out of runtime execution.
- Report blocked validation when repo policy requires Docker or another
  constrained execution surface and no matching command evidence exists.
- Use dogfood repos only for read-only validation and write reports under this
  repo's `.tmp/` when needed.

## Open Questions

- Resolved for T002: the approved parser package is `tree-sitter-go`, wired
  through the existing TypeScript tree-sitter runtime path and native rebuild
  policy.
- Resolved for T003: import-selector references may use indexed first-party
  path suffixes as low-confidence parser evidence; anything requiring
  `go list`, build tags, or type checking remains unresolved or low confidence.
- Deferred: build tags, compiler package loading, and type-inferred method
  resolution belong in a future Go semantic promotion spec.
