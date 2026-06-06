---
title: Go reference impact promotion design
doc_type: spec
artifact_type: design
status: active
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

- Which Go parser package fits the existing TypeScript runtime without adding a
  parallel semantic implementation path?
- How much `go.mod` import-path normalization is safe without running `go list`?
- Should build tags be modeled now as unresolved caveats or left to a future Go
  semantic promotion spec?
