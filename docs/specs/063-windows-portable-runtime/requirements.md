---
title: Windows portable runtime requirements
doc_type: spec
artifact_type: requirements
status: active
owner: platform
last_reviewed: 2026-08-08
---

# Requirements

## Introduction

Windows users currently install the GitHub release npm tarball and may need
Python and Visual Studio Build Tools to compile native parser and SQLite
dependencies. This slice delivers an additional self-contained Windows x64
release asset that runs with its own pinned Node 22 runtime and prebuilt native
dependencies.

## Goals

- Let a Windows x64 user install and launch Agent Workbench without installing
  Node, npm, Python, node-gyp, or Visual Studio Build Tools.
- Build and validate the asset on a GitHub-hosted Windows runner.
- Preserve the existing npm tarball and GHCR channels unchanged.
- Make the artifact version, runtime identity, integrity, and provenance
  reviewable.

## Non-Goals

- MSI installation, automatic updates, Windows arm64, macOS/Linux portable
  bundles, or Node SEA packaging.
- Replacing tree-sitter, better-sqlite3, or their current runtime paths.
- Publishing or signing a release in this implementation slice.

## Durable Source Baseline

| Source | Current behavior relied on | Confidence | Notes |
|---|---|---|---|
| `packaging/agent-workbench/README.md` | GitHub release tarball is the supported package channel and native builds occur during npm install. | high | Must be updated when the portable channel exists. |
| `docs/runbooks/install-agent-workbench.md` | Windows installation requires Node, Python, and MSVC today. | high | Will own portable install instructions. |
| `.github/workflows/cross-platform-packaging.yml` | `windows-2022` and Node 22 can build and launch the native runtime. | high | Runner choice remains explicit. |
| `.github/workflows/release.yml` | The Ubuntu package job owns release creation and source tarball upload. | high | Windows asset upload must follow this gate. |

## Durable Impact

| Durable area | Action | Target | Notes |
|---|---|---|---|
| backlog | modify | `docs/backlog/README.md` | Route EB047 delivery to Spec 063. |
| design/reference | modify | `packaging/agent-workbench/README.md` | Define the portable artifact contract. |
| runbook | modify | `docs/runbooks/install-agent-workbench.md` | Add extract/configure/register/verify guidance. |
| front door | modify | `README.md` | Prefer the portable path for Windows users. |

## Requirements

### Requirement 1: Self-contained Windows runtime

**Requirement ID:** REQ-001

**User Story:** As a Windows user, I want one release download that contains
the runtime and native binaries, so that I do not need a development toolchain.

**Priority:** must-have

#### Acceptance Criteria

1. GIVEN the Windows x64 ZIP, WHEN it is extracted, THEN its launcher SHALL use
   the bundled Node executable and installed production package tree.
2. GIVEN no system Node, npm, Python, or MSVC on `PATH`, WHEN the artifact smoke
   runs, THEN tree-sitter grammars, better-sqlite3, hooks, and the MCP initialize
   handshake SHALL load without an install or compilation step.
3. THE ARTIFACT SHALL contain a machine-readable manifest with Agent Workbench
   version, Git commit, platform, architecture, Node version, Node module ABI,
   and payload hash information.

### Requirement 2: Explicit portable configuration

**Requirement ID:** REQ-002

**User Story:** As a plugin user, I want configuration to point at the bundled
runtime, so that Codex and Claude do not silently depend on system Node.

**Priority:** must-have

#### Acceptance Criteria

1. WHEN the portable configuration command runs, THEN it SHALL write the
   runtime-root pointer and materialize absolute bundled-Node commands for the
   supported Codex and Claude MCP/hook configurations.
2. IF configuration cannot be completed, THEN it SHALL exit non-zero with a
   precise error and SHALL NOT claim successful installation.
3. WHERE the normal npm package is installed, THE SYSTEM SHALL retain its
   existing system-Node configuration behavior.

### Requirement 3: Governed release production

**Requirement ID:** REQ-003

**User Story:** As a release maintainer, I want the Windows asset built and
tested by Actions after normal release validation, so that it corresponds to
the tagged source and cannot bypass release gates.

**Priority:** must-have

#### Acceptance Criteria

1. WHEN a governed release runs, THEN a `windows-2022` job SHALL build the x64
   bundle from the resolved tag only after the authoritative package job passes.
2. WHEN the consumer smoke passes, THEN the workflow SHALL upload the ZIP and
   SHA-256 checksum to the existing GitHub release and publish build provenance
   for the ZIP through GitHub artifact attestations.
3. IF build, artifact-local validation, or consumer smoke fails, THEN the
   Windows asset SHALL NOT be uploaded as a successful release asset.
4. GIVEN an ordinary pull request or manual preflight, WHEN the Windows path is
   selected, THEN the same build-and-consumer-smoke implementation used by a
   release SHALL run without creating a tag, release, attestation, or package.
5. WHEN a release is rerun, THEN every downstream checkout and dependency
   closure SHALL remain bound to the originally resolved commit and committed
   lockfile, and publication SHALL fail closed rather than replacing an
   existing release asset.

## Correctness Properties

- **CP-001:** Every executable path materialized for portable operation stays
  inside the extracted bundle and is absolute after configuration.
- **CP-002:** The artifact identity fields match the tagged package version and
  checked-out commit.
- **CP-003:** The consumer path never invokes npm, pnpm, node-gyp, Python, or a
  compiler.
- **CP-004:** Windows construction uses the commit SHA resolved by the package
  gate and the committed pnpm dependency graph; mutable tag names and a fresh
  registry resolution are not build inputs.
- **CP-005:** Public GitHub release publication occurs only after the Windows
  and GHCR channels succeed, and an existing release is never mutated by an
  automatic retry.

## Technical Context

- **Language/Version:** Node.js 22 LTS, TypeScript/ESM runtime, Windows cmd.
- **Primary Dependencies:** tree-sitter native bindings and better-sqlite3.
- **Target Platform:** Windows Server 2022 runner, Windows x64 consumers.
- **Constraints:** single runtime path; no parser or command fallback.

## Success Criteria

- **SC-001:** The downloaded ZIP launches the MCP server with only Windows and
  the extracted files available.
- **SC-002:** The existing npm tarball payload and install contract remain
  unchanged.
- **SC-003:** Release assets expose a checksum, and GitHub artifact
  attestations expose build provenance for the ZIP.
