---
title: TypeScript JavaScript partial semantic routing requirements
doc_type: spec
artifact_type: requirements
status: active
owner: platform
last_reviewed: 2026-06-06
---

# Requirements

## Introduction

TypeScript/JavaScript is the next priority language after the first Python path.
Dogfood against a large JS/TS repository showed that Agent Workbench must avoid
classifying mixed web repositories as Python-heavy because of incidental
utility scripts. It also needs stronger package, route, import/export, and
nearest-test routing before deeper compiler-backed semantics.

This spec promotes the TypeScript/JavaScript backlog into active planning. It
must use one parser-backed implementation path for declarations and imports and
must keep runtime contracts language-neutral.

## Durable Source Baseline

- Language order and promotion gates:
  [Language adapter design](../../design/language-adapter-design.md)
- Priority table:
  [Language capability matrix](../../reference/language-capability-matrix.md)
- Runtime response vocabulary:
  [Runtime contracts](../../reference/runtime-contracts.md)
- MCP context and validation behavior:
  [MCP surface design](../../design/mcp-surface-design.md)

## Goals

- Recognize JS/TS-heavy and mixed JS/TS repositories from `package.json`,
  workspace files, `tsconfig` files, source roots, and test roots.
- Add fixture-backed parser extraction for JS/TS declarations, exports, imports,
  route/controller/service/component anchors, and unresolved references.
- Improve `symbol_search`, `context_for_task`, `find_references`, `impact`, and
  `verification_plan` routing for JS/TS without adding compiler or LSP
  fallbacks.
- Preserve compact confidence, provenance, freshness, and direct-read caveats.

## Non-Goals

- Do not add `tsserver`, TypeScript compiler API, bundler execution, or package
  manager command execution.
- Do not infer framework semantics without fixture-backed evidence.
- Do not implement cross-language symbols between JS/TS, Python, infra, or
  generated API clients.
- Do not add repository-specific rules for any sampled project.

## Requirements

### Requirement 1: JS/TS Project Shape

**User Story:** As a coding agent, I want JS/TS repositories to be classified
from their real project shape, so that context and validation are not polluted
by incidental scripts.

#### Acceptance Criteria

1. GIVEN a repository has `package.json`, workspace files, `tsconfig` files, or
   JS/TS source roots, WHEN scope and overview are requested, THEN the system
   SHALL report JS/TS evidence with repo-relative package and source paths.
2. WHERE a repository also has Python, shell, docs, or infra files, THE SYSTEM
   SHALL preserve mixed-language evidence without treating incidental scripts as
   primary.
3. IF package-manager or test-runner evidence is ambiguous, THEN validation
   planning SHALL return planned evidence with caveats rather than executable
   claims.

### Requirement 2: Parser-Backed Declaration And Import Evidence

**User Story:** As a maintainer, I want JS/TS symbols to come from one approved
parser path, so that search and routing evidence is repeatable.

#### Acceptance Criteria

1. GIVEN JS/TS files, WHEN graph extraction runs, THEN the system SHALL extract
   declarations for functions, classes, methods, exported constants, React-like
   components, and default exports where parser evidence supports them.
2. WHEN imports and exports are extracted, THEN unresolved references SHALL
   carry language, path, package, provenance, and confidence metadata.
3. IF syntax, module format, or framework conventions are not understood, THEN
   the extractor SHALL keep evidence resource-backed or partial-semantic with a
   clear caveat instead of inventing references.

### Requirement 3: Context, Reference, And Impact Routing

**User Story:** As a coding agent, I want JS/TS context packets and impact
results to prioritize likely source, tests, and package-local dependencies, so
that daily coding tasks can start from relevant files.

#### Acceptance Criteria

1. GIVEN a seeded JS/TS file or symbol, WHEN `context_for_task` runs, THEN the
   system SHALL include adjacent tests, package-local config, imports, exports,
   and route/component/service peers ahead of generated or dependency files.
2. WHEN `symbol_search`, `find_references`, or `impact` uses JS/TS evidence,
   THEN each result SHALL expose confidence and provenance without claiming
   semantic certainty before promotion fixtures justify it.
3. IF references cross package, framework, generated-client, or language
   boundaries, THEN the system SHALL keep those edges unresolved or low
   confidence until a later spec defines cross-boundary semantics.

## Correctness Properties

- All paths returned to MCP clients are repo-relative.
- Parser evidence is deterministic for a fixed file snapshot.
- Generated, vendor, dependency, build, hidden cache, and package-manager cache
  paths are skipped or downranked by shared catalog policy.
- JS/TS support must not add language-specific fields to shared runtime
  contracts.

## Success Criteria

- Fixture-backed tests prove JS/TS repository-shape classification, declaration
  extraction, imports/exports, nearest tests, reference confidence, impact
  caveats, and validation planning.
- Read-only dogfood against at least one JS/TS-heavy sample repository shows
  Agent Workbench is no longer Python-biased for that repo.
