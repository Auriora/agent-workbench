---
title: Native dependency setup
doc_type: runbook
status: draft
owner: platform
last_reviewed: 2026-05-07
---

# Native Dependency Setup

## Purpose

Document how to install and rebuild native Node dependencies used by the Agent
IDE runtime without adding parser fallbacks or alternate implementation paths.

## When To Use

Use this runbook after a fresh install, Node upgrade, pnpm store change, or test
failure involving native bindings.

Common failure signatures:

- `C++20 or later required`
- `No native build was found`
- missing `tree_sitter_runtime_binding.node`
- missing `better_sqlite3.node`

## Prerequisites

- Node.js 22 or newer. Node 24 requires C++20 for native addon builds.
- pnpm 10.18.1 or compatible.
- A working C/C++ build toolchain for `node-gyp`.
- Python available to `node-gyp`.

## Linked Docs

| Document | Why It Matters |
| --- | --- |
| [Runtime contracts](../reference/runtime-contracts.md) | Keeps capability and degraded-mode vocabulary stable while setup issues are fixed. |
| [Language adapter design](../design/language-adapter-design.md) | Defines Python tree-sitter as the first parser-backed adapter path. |
| [MVP proof matrix](../reference/mvp-proof-matrix.md) | Requires fixture proof instead of hidden fallback behavior. |

## Config And Code Touchpoints

| Area | Path Or Setting | How It Is Used | Required Validation |
| --- | --- | --- | --- |
| Package scripts | `package.json` `rebuild:native` | Rebuilds tree-sitter native bindings with `CXXFLAGS=-std=c++20`. | `pnpm rebuild:native` exits successfully. |
| Approved build scripts | `package.json` `pnpm.onlyBuiltDependencies` | Allows known native packages to run install scripts. | `pnpm install` does not report unapproved native scripts for listed packages. |
| Python parser adapter | `src/infrastructure/tree-sitter/python-parser.ts` | Uses `tree-sitter` and `tree-sitter-python`. | `pnpm test -- tests/adapters/python-parser.test.ts` passes. |
| SQLite graph store | `src/infrastructure/sqlite/graph-store.ts` | Uses `better-sqlite3` native bindings. | `pnpm test -- tests/graph/store.test.ts` passes. |

## Procedure

1. Install dependencies.

   ```sh
   pnpm install
   ```

2. If pnpm asks to approve build scripts, approve only the native packages
   already listed in `package.json`: `better-sqlite3`, `esbuild`,
   `tree-sitter`, and `tree-sitter-python`.

3. Rebuild native tree-sitter bindings when using Node 24 or after any native
   binding failure.

   ```sh
   pnpm rebuild:native
   ```

4. Run focused native dependency checks.

   ```sh
   pnpm test -- tests/adapters/python-parser.test.ts tests/graph/store.test.ts
   ```

5. Run the full validation suite.

   ```sh
   pnpm typecheck
   pnpm test
   ```

## Validation

The setup is healthy when:

- the Python parser test can load `tree-sitter` and `tree-sitter-python`
- the graph store test can load `better-sqlite3`
- `pnpm typecheck` passes
- `pnpm test` passes

## Rollback Or Recovery

If native bindings are stale or corrupted, remove local install artifacts and
repeat the procedure:

```sh
rm -rf node_modules
pnpm install
pnpm rebuild:native
```

Do not replace tree-sitter with Python AST, LSP, Pyright, or text parsing to
work around native setup failures. The root cause is the local native addon
build, not the parser strategy.

## Escalation

Stop and document the failing command, Node version, pnpm version, and native
build error if `pnpm rebuild:native` fails after a clean install with a working
compiler toolchain.
