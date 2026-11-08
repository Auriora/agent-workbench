---
title: Native dependency setup
doc_type: runbook
status: draft
owner: platform
last_reviewed: 2026-11-08
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
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

## Native termination policy (v0.6.15)

Version 0.6.15 requires core tree-sitter 0.25.0 to be built from source with
C++20 and NODE_API_SWALLOW_UNTHROWABLE_EXCEPTIONS. An installed package update
does not change an already running process.
The supported Node-API option prevents a fatal rethrow into an environment being
terminated by Worker.terminate. Ordinary callback exceptions still propagate;
parser replacement and successful timeout fragments remain unsupported.

The canonical builder in scripts/rebuild-native.mjs uses the pinned node-gyp
build utility and emits a receipt beside the native binary. npm postinstall,
local rebuild and portable preparation use that same core build route. A
loadable unguarded prebuild is insufficient. Core build or receipt validation
failure stops installation/packaging; runtime-pointer and plugin-config
convenience steps retain their separate best-effort policy. Portable users run
the verified compiled payload and do not rebuild on their machine.

Python and a C/C++ toolchain are required for npm/source installation on every
supported Node version, including Node 22. On Node 24, provision C++20 flags
before dependency installation when the dependency's own install step requires
them; the parent guarded builder supplies its required flags for its build.
Runtime startup and worker admission reject a missing or mismatched guarded
receipt/binding. Skipping install scripts does not establish a supported guarded
installation.
Re-run the package's install lifecycle or the canonical source rebuild before use.
Do not repair core tree-sitter with an unguarded raw dependency rebuild.

### Platform release acceptance

Source acceptance on Linux does not establish Windows portable readiness. Before
publishing a payload containing the guarded native changes, platform release
maintainers must satisfy [B017](../backlog/README.md#b017-validate-guarded-windows-portable-release-payload):
run the Windows portable workflow at the immutable candidate commit, retain the
native/build/artifact identities, and exercise actual native termination,
pre-import negative admission and the extracted portable consumer smoke. This
platform gate remains unexecuted for the Spec 072 source delivery.

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
| Package scripts | `package.json` `rebuild:native` | Builds the core with C++20 and the required termination guard; rebuilds approved grammars. | `pnpm rebuild:native` exits successfully. |
| Approved build scripts | `package.json` `pnpm.onlyBuiltDependencies` | Allows known native packages to run install scripts. | `pnpm install` does not report unapproved native scripts for listed packages. |
| Python parser adapter | `src/infrastructure/tree-sitter/python-parser.ts` | Uses `tree-sitter` and `tree-sitter-python`. | `pnpm test -- tests/adapters/python-parser.test.ts` passes. |
| SQLite graph store | `src/infrastructure/sqlite/graph-store.ts` | Uses `better-sqlite3` native bindings. | `pnpm test -- tests/graph/store.test.ts` passes. |

## Procedure

1. Install dependencies.

   ```sh
   pnpm install
   ```

2. If pnpm asks to approve build scripts, approve only packages already listed
   under `pnpm.onlyBuiltDependencies` in package.json, including the admitted
   tree-sitter grammars. Do not bypass the allowlist.

3. Use the canonical native rebuild after any local binding/build change. It
   retains the required termination guard as well as the compiler standard.

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

- canonical native termination tests pass and the guarded build receipt matches
  the selected binding
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

## Native grammar package metadata

Ruby and TypeScript use sealed metadata-corrected artifacts in the v0.6.11
release package. The accepted upstream parser sources and native bindings are
unchanged. Their peer ranges and TypeScript's JavaScript dependency agree with
the runtime's Tree-sitter 0.25 path. Use ordinary npm installation; peer-bypass
flags and consumer overrides are not part of this contract. See the
[artifact provenance](../../packaging/agent-workbench/native-grammars/README.md)
for hashes, exact corrections and the condition for returning to official
registry releases. This is separate from native compiler/toolchain failures.
