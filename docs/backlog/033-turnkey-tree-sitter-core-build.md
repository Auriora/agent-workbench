---
title: Turnkey core tree-sitter native build
doc_type: backlog
status: proposed
owner: platform
source_spec: docs/specs/033-cross-platform-packaging
last_reviewed: 2026-06-29
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Turnkey core `tree-sitter` native build

## Context

Spec 033 (cross-platform packaging) made install/launch/run shell-free, but left
one bounded native-build prerequisite in place (Decision 1, resolved): the core
`tree-sitter` runtime binding compiles from source and therefore requires a
C++20 toolchain (Linux `make`+`g++`/`clang++`, macOS Xcode CLT, Windows MSVC
build tools) plus Python 3 when no packaged `node_modules` is present.

This is already bounded — the four grammar packages (`tree-sitter-go`,
`-javascript`, `-python`, `-typescript`) and `better-sqlite3` ship prebuilt
binaries for all targets, so only the core binding needs a compiler. The
installer fails loud with per-OS remediation when the toolchain is missing. This
follow-up removes the remaining "developers need a C++ toolchain" caveat so the
package is fully turnkey on a clean machine.

## Scope

A bounded follow-up spec to make the core `tree-sitter` binding install without a
local compiler. Two candidate options to evaluate:

- **(b1) Pin to a prebuild-publishing line.** Pin core `tree-sitter` (and, if
  required for ABI compatibility, the grammars) to a release line that publishes
  prebuilt binaries (e.g. the 0.22.x line, which shipped prebuilds), gated behind
  an ABI/parser-behavior regression pass against the current 0.25.x usage.
- **(b2) Add a `prebuildify` matrix to release CI.** Build and publish our own
  prebuilt binaries for the supported OS/arch targets as part of release
  automation, so consumers never compile the core binding.

## Acceptance (for the follow-up spec, not this routing note)

- A decision between (b1) and (b2) with the regression/ABI evidence behind it.
- On a clean machine without a C++ toolchain, `npx @auriora/agent-workbench
  install` succeeds and the MCP server launches (graph extraction works).
- The platform matrix in the runbook updates the native-toolchain column to
  reflect that the compiler is no longer required on supported targets.

## References

- Spec 033 Requirement 5.1 (turnkey native build follow-up), Decision 1.
- `docs/specs/033-cross-platform-packaging/verification.md` (Residual Risks).
- `docs/runbooks/codex-agent-workbench-plugin.md` (Supported Platform Matrix).
