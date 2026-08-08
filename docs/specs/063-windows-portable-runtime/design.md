---
title: Windows portable runtime design
doc_type: spec
artifact_type: design
status: active
owner: platform
last_reviewed: 2026-08-08
---

# Technical Design

## Overview

The release adds a Windows-only directory bundle, not a second runtime
implementation. Actions checks out the package gate's immutable commit and
uses `pnpm deploy --prod` with the committed lockfile and the hoisted node
linker to create an isolated, link-free production tree on `windows-2022`. It
packages that tree with
the exact Node 22 executable used to build and validate the native modules.
The extracted bundle contains launch and configure entry points that always
invoke that Node executable. The source npm tarball remains an identity input
and separate release asset; it is not reinstalled through an unlocked npm
resolution during Windows construction.

The portable ZIP is additive. The source npm tarball remains portable and
continues to build native dependencies during install; GHCR remains unchanged.

## Requirement Coverage

| Requirement | Acceptance Criteria | Design Coverage | Validation Approach |
|---|---|---|---|
| Requirement 1 | AC1-AC3 | deterministic staging script, bundled Node, manifest and checksum | unit contract plus Windows artifact smoke |
| Requirement 2 | AC1-AC3 | fail-fast portable configurator and explicit Node override | integration tests with temporary package roots |
| Requirement 3 | AC1-AC5 | reusable non-publishing Windows gate, immutable commit/lock inputs, transactional publication | workflow contract test and preflight inspection |

## Correctness Property Coverage

| Property | Design Behavior | Validation Direction | Notes |
|---|---|---|---|
| CP-001 | configurator validates and writes absolute bundle-local paths | fixture-backed path tests | reject paths outside bundle |
| CP-002 | staging reads package version and `GITHUB_SHA`; workflow resolves tag | manifest contract assertions | tag check remains in package job |
| CP-003 | consumer smoke launches only checked-in cmd wrappers and bundled Node | constrained `PATH` Windows job | no package manager call after extraction |
| CP-004 | package job exports one commit SHA; pnpm deploy consumes the committed lock | workflow and manifest assertions | no mutable tag checkout or fresh npm graph |
| CP-005 | GHCR succeeds before public release creation; existing assets are not clobbered | workflow dependency assertions | corrective versions remain the retry model |

## High-Level Design

The existing package sources remain the single application payload. One
reusable Windows workflow deploys the exact checked-out package and locked
production graph into an isolated prefix, adds the pinned Node runtime and
portable entry points, and passes the resulting archive to a separate consumer
smoke. Pull requests and manual dispatch use that same workflow without any
publication authority. A governed release reuses it, then completes
attestation and GHCR before creating the public GitHub release.

## Components and Changes

- `scripts/ci/build-windows-portable.mjs`: validate Windows/x64/Node 22,
  assemble the installed package prefix and bundled Node, write launchers and
  manifest, then produce the ZIP and checksum.
- `scripts/configure-portable.mjs`: fail-fast pointer and plugin configuration
  for an extracted bundle.
- `plugins/agent-workbench/codex-mcp-config.mjs`: accept an explicit Node
  executable while preserving `node` as the npm-install default.
- portable plugin materialization: update Codex and Claude MCP/hook command
  fields to the absolute bundled Node path before user registration.
- `scripts/ci/windows-portable-smoke.mjs`: assert artifact identity, native
  loads, configuration, hooks, launcher, MCP initialize, and cleanup.
- `.github/workflows/windows-portable-preflight.yml`: the reusable,
  non-publishing Windows build and consumer-smoke implementation used before a
  tag and during a governed release.
- `.github/workflows/release.yml`: resolve one immutable commit, stage flat
source inputs, invoke the Windows workflow, publish GHCR, attest the result,
  and create the public release last.

## Artifact Layout

```text
agent-workbench-vX.Y.Z-windows-x64/
  agent-workbench.cmd
  configure.cmd
  node.exe
  NODE-LICENSE
  manifest.json
  runtime/
    node_modules/
      @auriora/agent-workbench/
      ...production dependencies...
```

The package root is
`runtime/node_modules/@auriora/agent-workbench`. Dependency lookup can ascend
to `runtime/node_modules`; it does not depend on the source checkout or pnpm
store.

## Low-Level Design

Bundle construction and configuration are implemented as explicit Node
scripts. The build script validates its inputs, stages only allowlisted runtime
content, derives the manifest, and archives it. The configuration script
resolves the fixed layout, validates containment, records the runtime pointer,
and materializes supported plugin commands using the bundled executable.

## Interfaces

```text
pnpm --config.node-linker=hoisted --filter . deploy --prod <deployment-dir>
node scripts/ci/build-windows-portable.mjs --package <tgz> --deployment <deployment-dir> --output <dir>
configure.cmd
agent-workbench.cmd [MCP arguments]
```

The build script is Windows-only and fails closed elsewhere. It receives the
already-built source tarball for source identity and consumes the production
tree created from the committed pnpm lock. It does not invoke npm or resolve a
second dependency graph.

## Error Handling

- Missing or non-Windows runtime inputs, wrong architecture, wrong Node major,
  absent native bindings, unexpected package version, or bundle path escape
  aborts the build.
- Configuration failures propagate non-zero; this path does not inherit the
  npm postinstall's best-effort semantics.
- Process cleanup is bounded. Windows smoke terminates the complete launcher
  process tree and reports a teardown failure instead of waiting indefinitely.
- Public release creation depends on consumer smoke and GHCR. Existing release
  assets are not overwritten; a failed published version is corrected with a
  new version rather than a moved tag or clobbered asset.

## Security, Trust, and Access

- The workflow uses the package gate's resolved commit SHA, committed lockfile,
  GitHub-hosted Windows runner, minimal release permissions, SHA-256 checksum,
  and GitHub artifact attestation. Third-party actions are commit-SHA pinned.
- Bundle construction copies only the isolated production prefix and the Node
  runtime/license; it excludes checkout caches, credentials, and generated
  repository state.
- Code signing is the production target but requires a signing certificate and
  secret authority not granted by this request. The workflow and docs must not
  claim Authenticode signing until that credential exists.

## Migration and Compatibility

This is an additive release asset. Existing npm installations, runtime-root
pointers, plugin names, hooks, and GHCR behavior remain compatible. Moving or
deleting an extracted bundle invalidates its absolute configuration; rerunning
`configure.cmd` after moving it repairs the pointer and configs.

## Slice Boundary And Residual Architecture

| Design target | In this slice | Out of this slice | Follow-up destination | Blocks closure? |
|---|---|---|---|---|
| self-contained Windows distribution | x64 ZIP with Node 22 | MSI, SEA, arm64 | EB047 follow-up | no |
| release trust | checksum and GitHub attestation | Authenticode certificate acquisition | release governance backlog | no |
| integrations | Codex and Claude portable configuration | Kiro Windows install automation | EB046/packaging follow-up | no |

## Operational Considerations

- Pin the bundled Node major to 22 and record the exact patch in the manifest.
- Updating Node or native dependencies requires rebuilding and rerunning the
  artifact consumer smoke.
- The release notes must distinguish the new Windows no-toolchain path from
  the retained npm source-install path.

## Open Questions

None blocking. The user selected the self-contained ZIP approach. Signing
credential acquisition remains an external release-governance follow-up.
