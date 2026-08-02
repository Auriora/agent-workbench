---
title: Ruby/Rails semantic correctness and static DSL expansion
doc_type: spec
artifact_type: package-readme
status: draft
owner: platform
last_reviewed: 2026-08-02
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Spec 049: Ruby/Rails semantic correctness and static DSL expansion

## Scope

This package delivers conservative Ruby/Rails improvements in parser-backed static
analysis only. All changes are bounded to static extraction and graph evidence.

- Canonical singleton scope identity for `def self.x` and `class << self`.
- Rails namespace resolution for path scope and module scope.
- `has_many :through` and `source_type` association safety.
- Ecosystem-neutral validation block label handling.
- Static controller/action resource options in routing.
- Member/collection/on custom action routing edges.
- HABTM association handling.
- `draw` route-file links and routing concern reuse when statically bounded.
- Ruby `load`/`autoload`/alias/visibility as conservative optional evidence.

## Explicitly excluded in this package

- Redirects, mount, resolve, engines, and direct engine composition.
- Runtime dispatch, route set evaluation, and boot execution.
- Runtime-aware inflection overrides and configurable inflection execution.
- Lexical-only parsing, AST/LSP, shell/command-based extraction, and alternate
  parser fallbacks.
- Any change in runtime behavior not justified by parser output.

## Baseline note

This package starts with a recorded pre-existing follow-up baseline:
root/through/source Docker-orientated validation and overview work exists in the
worktree but is not treated as completed Spec 049 evidence until verification is
captured inside this package.

## Package status

- Spec ID: 049
- Owner: platform
- Start date: 2026-08-02
- Current state: active package draft
- Scope owner: `docs/specs/049-ruby-rails-semantic-correctness-and-static-dsl-expansion/`
