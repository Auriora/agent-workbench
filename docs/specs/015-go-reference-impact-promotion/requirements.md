---
title: Go reference impact promotion requirements
doc_type: spec
artifact_type: requirements
status: active
owner: platform
last_reviewed: 2026-06-06
---

# Requirements

## Introduction

The first Go slice made Go files and declarations visible as routing evidence,
but dogfood still showed no useful Go references or impact guidance. This spec
promotes the next Go backlog slice: parser-backed reference extraction, package
identity, impact confidence, and safer validation planning.

## Durable Source Baseline

- Go roadmap:
  [Language adapter design](../../design/language-adapter-design.md)
- Priority table:
  [Language capability matrix](../../reference/language-capability-matrix.md)
- Validation planning rules:
  [MCP surface design](../../design/mcp-surface-design.md)

## Goals

- Add parser-backed Go reference evidence for package-local functions, types,
  methods, and imports.
- Make `find_references` and `impact` useful for package-local Go changes while
  labeling confidence and unresolved ambiguity.
- Improve validation planning so repo-local Docker, Makefile, CI, or guidance
  policy suppresses unsafe generic `go test ./...` suggestions.

## Non-Goals

- Do not add `gopls`, `go list`, or `go test` execution.
- Do not claim whole-program Go semantics.
- Do not implement cross-language references between Go services and other
  clients or infrastructure.
- Do not special-case OneMount or any sampled repository.

## Requirements

### Requirement 1: Go Package And Reference Evidence

**User Story:** As a coding agent, I want Go declarations and references to be
package-aware, so that reference lookup does not stop at declaration search.

#### Acceptance Criteria

1. GIVEN Go source files, WHEN graph extraction runs, THEN the system SHALL
   extract package names, imports, declarations, method receivers, selector
   references, and identifier references where parser evidence supports them.
2. WHEN a reference resolves within a package or explicit import, THEN the edge
   SHALL include confidence, provenance, package identity, and ambiguity state.
3. IF a reference cannot be resolved without type-checking, build tags, or
   generated code, THEN the system SHALL keep it unresolved or low confidence.

### Requirement 2: Go References And Impact Surfaces

**User Story:** As a maintainer, I want Go reference and impact results to be
honest but useful, so that agents can estimate local blast radius.

#### Acceptance Criteria

1. WHEN `find_references` is called for a Go function, type, method, or
   package-local symbol, THEN the system SHALL return direct parser-backed
   references where available.
2. WHEN `impact` is called for a Go symbol or file, THEN the system SHALL rank
   affected source, tests, imports, and package peers with explicit confidence.
3. WHERE parser evidence is incomplete, THE SYSTEM SHALL return compact caveats
   instead of empty unsupported metadata that contradicts repo scope.

### Requirement 3: Go Validation Planning Safety

**User Story:** As an agent operator, I want Go validation suggestions to honor
repo policy, so that the runtime does not suggest unsafe host commands.

#### Acceptance Criteria

1. GIVEN repo guidance requires Docker, devcontainer, CI, or another constrained
   environment, WHEN validation is planned, THEN generic host `go test` commands
   SHALL be suppressed or marked blocked.
2. WHERE Makefile, CI, Docker, or package-local evidence exists, THE SYSTEM
   SHALL plan non-executed commands with source evidence and caveats.
3. IF no safe validation path is known, THEN the plan SHALL be blocked or manual
   rather than confidently suggesting `go test ./...`.

## Correctness Properties

- Go symbols and references must be repo-relative and package-qualified where
  possible.
- Reference confidence must not exceed available parser and project evidence.
- Validation planning must prefer repo policy over generic language defaults.
- Generated/vendor/cache/test-runtime paths must remain skipped or downranked by
  shared catalog policy.

## Success Criteria

- Fixture tests prove Go package identity, declarations, references, impact,
  ambiguity handling, and validation-policy suppression.
- Read-only dogfood against a Go-heavy sample repo shows useful Go references
  or clear low-confidence caveats without unsafe generic validation commands.
