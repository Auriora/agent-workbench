---
title: TypeScript JavaScript partial semantic routing design
doc_type: spec
artifact_type: design
status: active
owner: platform
last_reviewed: 2026-06-06
---

# Technical Design

## Overview

Add a first partial-semantic JS/TS path using the shared adapter pipeline:
catalog classification, parser extraction, graph storage, common reference
resolution, common presenters, and MCP tools. Project-shape evidence comes from
package and TypeScript configuration files. Symbol and import/export evidence
comes from one parser-backed extractor.

## High-Level Design

Components:

- File catalog classification for `.js`, `.jsx`, `.ts`, `.tsx`, `.mjs`, `.cjs`,
  package files, workspace manifests, and `tsconfig` variants.
- JS/TS project model provider for package roots, workspace roots, scripts,
  source roots, and test roots.
- JS/TS syntax extractor for declarations, imports, exports, and unresolved
  references.
- Shared graph resolver and query use cases for `symbol_search`,
  `find_references`, `impact`, and `context_for_task`.
- Validation planning rules that prefer repo policy and package-local evidence
  before generic package-manager commands.

## Low-Level Design

The extractor should emit shared extraction records:

- symbol declarations with kind, name, qualified name where cheaply known, file,
  range, export/default-export metadata, and provenance
- import records with module specifier, import kind, imported names, default
  import, namespace import, and unresolved-reference metadata
- test hints from package scripts, nearby file names, and common test roots
- framework routing hints only when path and declaration evidence are explicit

Reference resolution remains shared. The JS/TS adapter may normalize relative
import specifiers and package-local aliases only when `tsconfig` or package
metadata provides enough deterministic evidence.

## Operational Considerations

- Do not execute package managers.
- Do not create files in sampled repositories during dogfood.
- Keep result budgets compact; broad JS/TS monorepos must not flood context
  packets with dependency or generated files.
- Mark parser, package-model, and framework-convention evidence separately in
  metadata so later semantic promotion can be audited.

## Open Questions

- Resolved for T002: the approved parser path is `tree-sitter-javascript`
  for JS/JSX and `tree-sitter-typescript` for TS/TSX. Both are native grammar
  dependencies and are included in `pnpm rebuild:native`; parser-backed
  declaration/import extraction remains T004.
- Should JSX/TSX component names be declaration evidence only, or should route
  and component hierarchy edges wait for a framework-specific spec?
- What package-manager policy evidence is strong enough to plan `pnpm`,
  `npm`, `yarn`, or `bun` checks without overclaiming runnable validation?
