---
title: Compiled stdio runtime design
doc_type: spec
artifact_type: design
status: draft
owner: platform
last_reviewed: 2026-07-30
---

# Technical Design

## Overview

Build two ESM entrypoints from the existing TypeScript runtime:

```text
src/mcp/stdio.ts  --esbuild--> dist/mcp/stdio-entrypoint.mjs
                                         |
                                         | cold-start sibling
                                         v
src/mcp/daemon-entrypoint.mjs + daemon.ts
                   --esbuild--> dist/mcp/daemon-entrypoint.mjs
                                         |
                                         | graph refresh worker
                                         v
src/infrastructure/workers/startup-graph-warmup-worker.ts
                   --esbuild--> dist/workers/startup-graph-warmup-worker-entrypoint.mjs
```

All distributed surfaces execute `dist/mcp/stdio-entrypoint.mjs`. Both builds
use `platform: "node"`, `format: "esm"`, `bundle: true`, the supported Node
target, and package externalization. Bundling internal TypeScript modules makes
the bridge independent of `tsx`; external dependencies continue to resolve
from the installed package.

## High-Level Design

TypeScript source remains authoritative. One deterministic build produces the
two sibling runtime entrypoints, and every distributed launch surface consumes
that output. Source tests verify behavior and dependency boundaries; package
tests verify that the generated artifacts are current and are the files users
execute.

## Decisions

### D001: Use an explicit esbuild build script

Use `scripts/build-runtime.mjs` with named entrypoints and deterministic output
paths. Add `esbuild` as a direct development dependency instead of relying on
its transitive presence through `tsx`.

The build imports a shared `scripts/runtime-build-contract.mjs` module. That
contract enumerates all runtime `src/**/*.ts` and `src/**/*.mjs` inputs plus the
builder, package metadata, entrypoints, esbuild version, and normalized build
options. It hashes normalized relative paths and file contents with SHA-256 and
writes `dist/mcp/runtime-build-receipt.json`. Validation recomputes the same
contract and rejects a missing, malformed, or stale receipt. `prepack` always
rebuilds as well as validating the resulting receipt.

Rationale:

- esbuild supports named multiple entrypoints, Node platform, ESM format, and
  package externalization through one build API;
- direct dependency ownership makes the packaging contract explicit;
- generated output is reproducible from the source checkout and need not be
  committed.

### D002: Compile bridge and daemon together

The daemon client calculates its daemon entrypoint as a sibling of
`import.meta.url`. Building both entrypoints into `dist/mcp/` preserves this
single path and avoids an environment override or source fallback. The daemon's
refresh executor resolves a worker relative to its compiled module, so the same
build emits `dist/workers/startup-graph-warmup-worker-entrypoint.mjs`.

Neither compiled artifact imports or registers `tsx`. The source wrappers may
retain `tsx` for developer execution only. The compiled daemon externalizes
native packages and preserves the existing bounded native rebuild guidance.

### D003: Separate source authority from distributed execution

TypeScript under `src/` remains implementation authority. `dist/` is generated
distribution output. Source tests prove behavior and architecture; package and
integration tests prove that generated output matches the current source
contract and is what users execute.

### D004: Build at package and repository-local installation boundaries

- `prepack` builds before `npm pack` creates the tarball.
- The repository-local installer builds before marketplace materialization.
- The container build runs the same build command before its final entrypoint.
- Plugin launchers do not build at runtime.

There is no launch-time source fallback. Missing compiled output is a clear
installation/package defect.

### D005: Scope daemon admission state by daemon identity

Use the existing short daemon-identity hash in the repo-local lifecycle receipt
and startup-lock filenames. The IPC endpoint is already scoped by that identity;
the receipt and lock use the same boundary.

This permits an older daemon to finish serving retained older-runtime bridges
while newly started bridges elect a daemon compatible with the newly installed
runtime. The new runtime does not delete, overwrite, adopt, or signal the older
runtime's unsuffixed `daemon.json` or `startup.lock`. Same-identity clients still
share one receipt and lock, preserving the existing single-election behavior.

Daemon admission isolation does not duplicate graph refresh ownership. Daemons
for different runtime identities still use the existing repository ownership
lease and derived-store compatibility rules.

## Components and Changes

### Runtime builder

Add `scripts/build-runtime.mjs`:

- remove only the exact generated runtime output directory;
- compile named `stdio-entrypoint` and `daemon-entrypoint` outputs;
- compile the daemon-owned graph worker at its required relative output path;
- use sourcemaps only if explicitly required by current packaging policy;
- emit the mandatory deterministic build receipt defined by D001;
- fail non-zero on compilation errors.

The builder must not write outside `dist/`.

### Daemon admission paths

`daemonPaths(identity)` derives both the lifecycle receipt filename and startup
lock filename from the same short identity hash already used by the POSIX
socket directory and Windows named pipe. The metadata directory remains
`.cache/agent-workbench/daemon/`; only the files within it are identity-scoped.

Legacy unsuffixed admission files remain owned by the runtime that created
them. They are ignored by current admission and may disappear only through
that owner's normal shutdown or explicit operator cache maintenance after no
runtime is active.

### Entrypoints

The compiled stdio entrypoint is built from `src/mcp/stdio.ts`. The compiled
daemon entrypoint is built from a TypeScript daemon main module that invokes
`daemon.ts` without registering `tsx`. The source `daemon-entrypoint.mjs` and
`stdio-entrypoint.mjs` remain developer-only source runners and may continue to
register `tsx`; neither is a distributed entrypoint.

### Launch surfaces

Update:

- `package.json` `mcp`, `prepack`, and package `files`;
- `packaging/agent-workbench/mcp-bin.mjs`;
- plugin launch planning and copied Claude/Kiro launchers/config;
- `packaging/agent-workbench/Containerfile`;
- `packaging/agent-workbench/package-manifest.json`;
- `packaging/agent-workbench/npm-package.json`;
- public integration-profile artifact descriptions;
- repository-local materialization/install validation;
- plugin runtime-root resolution helpers and the documented install-root
  override contract.

Every distributed surface resolves `dist/mcp/stdio-entrypoint.mjs`.

### Validation

Add or update tests to prove:

- build output exists and is generated from the current source inputs;
- the compiled bridge does not contain/import `tsx`;
- compiled bridge lifecycle matches source lifecycle;
- cold launch finds the compiled daemon sibling;
- cold refresh finds and completes through the compiled graph worker;
- npm tarball includes both compiled entrypoints;
- plugin, Claude, Kiro, npm-bin, package, and container paths agree;
- the repository-local installer invokes the build before registration;
- missing compiled output fails with bounded build/install guidance and no
  source fallback;
- legacy and foreign-runtime admission state cannot collide with current
  identity startup, while same-identity parallel clients still converge;
- compiled cold-daemon native loading failures preserve the existing rebuild
  guidance without leaking raw internal stderr.

## Low-Level Design

The builder invokes esbuild once with named stdio, daemon, and graph-worker
inputs, an explicit `dist` output directory, Node ESM settings, and external
package resolution. It writes outputs atomically enough for package creation by
removing only its prior generated `dist/mcp` and `dist/workers` directories
before a successful build and by failing the caller on any compile or
post-build receipt-validation error.

Launch planners resolve one exported compiled-entrypoint constant or one
shared relative path contract instead of repeating source and distribution
paths independently. Package validation compares each declared surface with
that contract, confirms both sibling files exist, and recomputes the mandatory
receipt before accepting the generated output.

## Error Handling

- Build failures stop package creation and repository-local installation.
- Missing compiled output produces one actionable installation error naming the
  build command.
- Runtime errors do not fall back to source.
- Native dependency load failures occur in the compiled daemon and retain the
  existing bounded rebuild guidance.
- The builder removes only its exact `dist/mcp` and `dist/workers` outputs
  before writing.
- A foreign or legacy daemon receipt cannot block current-runtime admission and
  is not destructively reconciled.

## Security and Trust

Compilation introduces no network listener, credential handling, repository
command execution, or new runtime environment override. Package imports remain
external and resolve from the installed package dependency graph. The build
script uses explicit repository-relative inputs and outputs.

## Migration and Compatibility

This is an internal distribution-path change with no MCP protocol migration.
Existing running source-wrapper bridges remain until their transports close.
New distributed installs and refreshed POSIX repository-local plugins execute
compiled output. During a rolling upgrade, identity-scoped admission permits
old and new daemon processes to coexist temporarily for the same repository;
each serves only identity-compatible bridges, while graph refresh ownership
remains serialized.

Rollback is one coordinated change: restore all launchers and manifests to the
source wrapper, remove the build hook and compiled payload requirements,
reinstall or rematerialize provider state so runtime-root pointers and cached
MCP registrations no longer target `dist/`, then run package/plugin smoke
validation. Do not retain mixed compiled/source launchers.

## Slice Boundary

| Design target | In this slice | Out of this slice | Destination | Blocks closure? |
|---------------|---------------|-------------------|-------------|-----------------|
| compiled distributed bridge and daemon | build, package, plugin, container, repo-local install | removing `tsx` from developer commands | none | no |
| retained open sessions | lower per-bridge cost | task-state inference or idle reaping | provider integration owner | no |
| rolling runtime upgrade | identity-scoped receipt and startup lock | killing or adopting an older daemon | none | no |
| resource evidence | same-host diagnostic comparison | universal RSS guarantee | none | no |

## Validation Strategy

| Validation | Covers | Evidence |
|------------|--------|----------|
| runtime build tests | Requirements 1-2, CP-001-CP-004 | targeted Vitest |
| compiled MCP smoke | Requirements 1 and 3 | source/package smoke |
| plugin/package/container path tests | Requirements 2-3 | integration tests and validators |
| same-host module/RSS observation | Requirement 4 | verification evidence |
| daemon admission isolation | Requirement 5, CP-005 | identity-path, legacy-receipt, and concurrent launch tests |
| typecheck and full tests | regression | verification evidence |
| architecture, packaging, and QA review | design and implementation risk | review findings and dispositions |

## Operational Considerations

Generated `dist/` output is ignored and disposable. Operators should rebuild
through the supported command rather than editing output. One compiled bridge
per open provider connection remains expected. Codex agent-thread concurrency
and nesting configuration can multiply those connections, including retained
completed threads, so verification records the active configuration and both
per-bridge and aggregate cost. Agent Workbench does not infer a fixed bridge
count or pool independent stdio streams; process cardinality and per-process
cost remain separate concerns.

## Open Questions

None before expert review. Reviewers must challenge the exact stale-build
receipt, copied-plugin parity, and Windows/container behavior.

## Related Artifacts

- Requirements: `requirements.md`
- Change Impact: `change-impact.md`
- Tasks: `tasks.md`
- Verification: `verification.md`
