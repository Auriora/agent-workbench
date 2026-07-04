---
title: Make the npm-tarball install flow actually work
doc_type: backlog
status: resolved
owner: platform
source_spec: docs/specs/033-cross-platform-packaging at final spec commit 0d2cc48
last_reviewed: 2026-07-04
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Make the npm-tarball install flow actually work

## Resolution (2026-06-30)

Resolved by switching to a **normal npm package** (spec 033, v0.3.0). The
copy-to-prefix installer (`installer.mjs`), its npm bin (`npm-install.mjs`), the
archive installers (`install.sh`/`install.ps1`), and the bash delegator were all
removed. `npm install -g @auriora/agent-workbench` now builds the native modules
the normal way, and the runtime launches in place:

1. **Lockfile strip** — no longer relevant. The install builds from
   `package.json` dependencies; `pnpm-lock.yaml` was dropped from the `files`
   allowlist and from every required-paths expectation.
2. **Dependency hoisting** — no longer relevant. Nothing copies `node_modules`
   to a prefix; the package is launched from wherever npm installed it, and bare
   specifiers (`tsx`, `tree-sitter`) resolve from the hoisted tree normally.
3. **tree-sitter C++20 on Node 24** — declared the **user's toolchain** to
   resolve, with hints at server launch and in `postinstall`/README (use Node 22,
   or rebuild with `CXXFLAGS=-std=c++20` / `CL=/std:c++20`). It is no longer the
   project's job to orchestrate the native build for the npm channel.

Verified end to end: `npm pack` → `npm install <tarball>` into a throwaway
project → `postinstall` wrote the runtime-root pointer → the plugin shim resolved
it (no override) → MCP `initialize` handshake succeeded against the installed
copy. `npm_publish_status` can move past `pack-ready-not-published` once a
registry publish is performed.

---

## Original routing note (superseded by the resolution above)

## Context

Spec 033 made `installer.mjs` shell-free and cross-platform, and it works against
a git checkout / unpacked source tree. But end-to-end testing of the **npm
distribution** path (`npm install <tarball>` → `agent-workbench install`) — never
done before (`npm_publish_status: pack-ready-not-published`) — surfaced several
breakages that affect **all platforms**, not just Windows:

1. **npm strips `pnpm-lock.yaml`** from any package tarball regardless of the
   `files` allowlist. The installer's `REQUIRED_PATHS` lists `pnpm-lock.yaml`, so
   the shipped installer fails immediately with "Missing package component:
   pnpm-lock.yaml".
2. **npm hoists dependencies.** The installer's model is "copy the package and its
   `node_modules` to a prefix," but npm hoists deps to the consumer's top-level
   `node_modules`, so the package dir has no self-contained `node_modules`. The
   `nativeRebuildNeeded` heuristic (presence of `node_modules/tsx` under the
   source) is unreliable under hoisting.
3. **Core `tree-sitter` C++20 build on Node 24.** `npm install` builds
   `tree-sitter` itself (before the installer runs) without the C++20 flag, so on
   Node 24 it fails in the `cppgc` headers. On Node 22 it builds. The installer's
   C++20 fix (`scripts/rebuild-native.mjs`) only runs in the installer's pnpm
   path, which the npm flow bypasses.

Net: the attached tarball cannot be `npm install`-ed today. The working path is a
git checkout + `pnpm install` + `pnpm rebuild:native`.

## Scope

Decide and implement a coherent npm-distribution model. Candidate directions:

- **(a) Self-contained install via `postinstall`.** Have the package's own
  `postinstall`/`prepare` run the native build with the C++20 wrapper, and have
  the installer copy from the consumer's resolved `node_modules` (handle
  hoisting) rather than assuming a nested `node_modules`. Drop `pnpm-lock.yaml`
  from `REQUIRED_PATHS` and fall back to `pnpm install` (non-frozen) when no
  lockfile is present.
- **(b) Bundle a prebuilt runtime.** Ship platform-specific prebuilt native
  binaries (ties into `033-turnkey-tree-sitter-core-build`) so no build runs on
  install at all.

Pin the minimum to **Node 22** until the Node 24 C++20 path is verified end to
end, or make `rebuild:native` run unconditionally on supported Node versions.

## Acceptance (for the follow-up, not this routing note)

- `npm install -g <tarball>` then `agent-workbench install` succeeds on
  Linux/macOS/Windows (Node 22, and Node 24 once C++20 is wired through the npm
  path), producing a launchable MCP server.
- `npm_publish_status` can move past `pack-ready-not-published`.

## References

- Removed Spec 033 verification at final spec commit `0d2cc48` (Residual Risks).
- `packaging/agent-workbench/installer.mjs` (`REQUIRED_PATHS`,
  `nativeRebuildNeeded`), `scripts/rebuild-native.mjs`.
- Related: `docs/backlog/033-turnkey-tree-sitter-core-build.md`.
