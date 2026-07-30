---
title: Compiled stdio runtime requirements
doc_type: spec
artifact_type: requirements
status: draft
owner: platform
last_reviewed: 2026-07-30
---

# Requirements

## Introduction

Spec 045 made each Agent Workbench stdio bridge transport-owned and removed
daemon server, SQLite, parser, and MCP registry modules from its import graph.
Live checkout verification then showed that a retained bridge still uses about
92 MiB RSS because the canonical source wrapper registers `tsx`; a bare idle
Node process on the same host used about 41 MiB. Codex can retain a completed
subagent's still-open MCP transport, and Agent Workbench receives no trustworthy
task-completion signal with which to reap it.

This spec reduces the cost of every retained bridge by shipping compiled
JavaScript runtime entrypoints. It preserves transport-owned lifetime and does
not guess that an open provider connection is abandoned.

## Goals

- Make every distributed MCP launch surface execute compiled JavaScript without
  registering `tsx` in the bridge process.
- Compile the stdio bridge, daemon, and daemon-owned graph worker from the same
  TypeScript source graph while preserving their relative runtime paths.
- Preserve source-to-package behavior, daemon identity, repository-root
  authority, native dependency behavior, and cross-platform launch semantics.
- Make the POSIX repository-local plugin installer build and launch the same
  compiled candidate that packaging tests exercise.
- Prove the installed tarball contains and invokes the compiled runtime.

## Non-Goals

- Killing a bridge while its controlling stdin and daemon socket remain open.
- Inferring root-agent, subagent, or task-completion state from process
  heuristics.
- Replacing the one-daemon-per-repository architecture.
- Removing `tsx` from developer-only commands that still execute TypeScript
  directly.
- Adding fallback from the compiled runtime to the source/`tsx` runtime.
- Establishing a universal RSS threshold across Node versions and platforms.

## Durable Source Baseline

| Source | Current behavior relied on | Confidence | Notes |
|--------|----------------------------|------------|-------|
| `docs/design/coding-agent-integration-design.md` | `src/mcp/stdio-entrypoint.mjs` is the canonical distributed wrapper and one bridge is expected per open connection. | high | Must be promoted to the compiled-runtime contract. |
| `docs/design/runtime-operations-design.md` | The bridge path is lightweight and the daemon owns repository services. | high | Compilation must preserve this boundary. |
| `docs/runbooks/codex-agent-workbench-plugin.md` | Package, plugin, checkout, and container launch paths currently target the source wrapper. | high | Operator commands and diagnosis must change together. |
| `package.json` and packaging manifests | The package ships `src` and uses `tsx` at runtime. | high | Direct configuration evidence. |
| live process measurements on 2026-07-30 | Bare Node used 42,128 KiB RSS; `tsx` registration used 93,164 KiB; the checkout bridge used 93,916 KiB and loaded no native modules. | high | Host-specific diagnostic evidence, not a portable limit. |

## Durable Impact

| Durable area | Action | Target | Notes |
|--------------|--------|--------|-------|
| runtime design | modify | `docs/design/runtime-operations-design.md` | Define compiled distribution and source/build ownership. |
| integration design | modify | `docs/design/coding-agent-integration-design.md` | Replace the canonical distributed entrypoint contract. |
| runbook | modify | `docs/runbooks/codex-agent-workbench-plugin.md` | Document build, install, verification, and rollback. |
| package contract | modify | packaging manifests and package payload | Include compiled runtime and stop shipped launchers from using source `tsx`. |
| API/contract | unchanged | `docs/reference/runtime-contracts.md` | No MCP schema or response change. |

## Staged Readiness

- **Current stage:** requirements and design review
- **Next stage:** implementation
- **Ready to implement when:** package lint passes and architecture, packaging,
  and QA reviewers reconcile the compiled entrypoint, build lifecycle, and
  parity-test contracts.
- **Design-first exception:** no
- **Optional artifacts included:** `research.md`, `change-impact.md`,
  `traceability.md`, `verification.md`
- **Downstream review needed:** design, packaging, testing, operations

## Requirements

### Requirement 1: Compiled distributed runtime

**User Story:** As a user with multiple retained coding-agent sessions, I want
each Agent Workbench bridge to execute compiled JavaScript, so that it does not
pay the `tsx` loader cost per connection.

**Priority:** must-have

#### Acceptance Criteria

1. GIVEN a packaged, plugin, container, or repository-local MCP launch, WHEN
   the bridge starts, THEN the executed entrypoint SHALL be a generated
   JavaScript artifact and SHALL NOT import or register `tsx`.
2. THE build SHALL compile the stdio and daemon entrypoints plus every
   separately spawned daemon worker from their existing source implementations
   into output paths that preserve runtime-relative resolution.
3. THE compiled bridge import graph SHALL retain the Spec 045 exclusion of
   daemon server, SQLite, parser, native module, and MCP registry code.
4. GIVEN the compiled bridge starts a missing daemon, THEN it SHALL execute the
   compiled sibling daemon entrypoint without a source-runtime fallback.

### Requirement 2: Build and package determinism

**User Story:** As a release maintainer, I want one deterministic runtime build
contract, so that source, tarball, plugin, and container artifacts cannot drift.

**Priority:** must-have

#### Acceptance Criteria

1. `npm pack` SHALL build the runtime before tarball creation and SHALL include
   the compiled entrypoints in the package allowlist.
2. The POSIX repository-local Codex installer SHALL build the candidate before
   registering the plugin and SHALL fail clearly if compilation fails.
3. Package validation SHALL reject missing, stale, or incorrectly targeted
   compiled entrypoints.
4. Generated runtime artifacts SHALL remain ignored build output and SHALL NOT
   be committed.
5. The build SHALL emit a mandatory deterministic receipt covering every
   runtime source input, build-contract input, package version, esbuild version,
   entrypoint, and build option; validation SHALL recompute and compare it.

### Requirement 3: Launch-surface parity

**User Story:** As an integration maintainer, I want all launch surfaces to
resolve the same compiled runtime, so that providers do not exercise different
implementations.

**Priority:** must-have

#### Acceptance Criteria

1. The npm bin, Codex plugin, Claude plugin, Kiro Power, package script,
   container, runtime-root resolver, and documented install-root override SHALL
   resolve the compiled stdio entrypoint.
2. Existing repository-root selection, provider identity, argument forwarding,
   Windows `spawn` behavior, and POSIX `execve` behavior SHALL remain unchanged.
3. Source-level lifecycle and architecture tests SHALL remain authoritative for
   behavior, while installed-artifact tests SHALL prove build parity.
4. Native bootstrap failures SHALL retain the same bounded rebuild guidance.
5. Missing compiled output SHALL fail with bounded build or installation
   guidance and SHALL NOT fall back to the source wrapper.

### Requirement 4: Evidence-backed resource improvement

**User Story:** As an operator, I want repeatable resource evidence, so that the
change demonstrates a real per-bridge improvement without inventing a portable
memory guarantee.

**Priority:** should-have

#### Acceptance Criteria

1. Verification SHALL compare bare Node, the source `tsx` wrapper, and the
   compiled bridge on the same host using the same observation method.
2. The compiled bridge SHALL load no `tsx`, SQLite, or tree-sitter modules.
3. Verification SHALL record observed RSS and module evidence as diagnostic,
   host-specific results.
4. Durable documentation SHALL keep provider-owned open sessions distinct from
   disconnected or orphaned bridges.
5. Verification SHALL record the configured Codex agent-thread limit and
   nesting depth as cardinality inputs, distinguish them from Agent Workbench
   daemon count, and avoid treating a fixed bridge count as a runtime invariant.

### Requirement 5: Rolling runtime upgrade isolation

**User Story:** As an operator upgrading Agent Workbench while older coding-agent
sessions remain open, I want each runtime identity to own independent daemon
admission state, so that new agents can initialize without disrupting valid
older sessions.

**Priority:** must-have

#### Acceptance Criteria

1. Daemon lifecycle receipts and startup locks SHALL be scoped by the existing
   daemon identity, including runtime version, graph schema version, daemon
   protocol version, and canonical repository root.
2. GIVEN a live daemon receipt owned by a different runtime identity, WHEN a
   current-runtime bridge starts for the same repository, THEN the bridge SHALL
   elect or connect to its own identity-compatible daemon instead of returning
   `ambiguous_process`.
3. Concurrent bridges with the same daemon identity SHALL continue to converge
   on one daemon launch.
4. A current runtime SHALL neither delete nor overwrite legacy unsuffixed
   daemon receipts and startup locks that may still be owned by an older
   installed runtime.
5. Cross-version daemon admission SHALL NOT create a second graph-refresh
   ownership path; repository ownership remains serialized by the existing
   daemon-owned graph lease.

## Correctness Properties

- **CP-001:** Every distributed launch surface resolves one compiled stdio
  entrypoint generated from the current source tree.
- **CP-002:** The generated stdio entrypoint starts only the generated sibling
  daemon entrypoint for cold daemon admission, and that daemon resolves only
  generated worker artifacts for separately spawned runtime work.
- **CP-003:** The compiled stdio artifact contains no `tsx` registration or
  forbidden heavy-runtime dependency.
- **CP-004:** For any source revision, packaging validation either proves the
  generated artifacts were built from that revision or fails before packaging.
- **CP-005:** Daemon admission state for two unequal daemon identities cannot
  collide, while equal identities still share exactly one receipt and startup
  lock.

## Technical Context

- **Language/Version:** TypeScript ESM compiled to JavaScript ESM; Node.js 22+
- **Primary Dependencies:** esbuild JavaScript API, npm `prepack`, Vitest
- **Target Platform:** Linux, macOS, and Windows for distributed package/plugin
  runtime; POSIX shell for repository-local installation; Codex, Claude Code,
  Kiro, npm bin, and container
- **Constraints:** one implementation path; no source fallback; preserve native
  parser behavior in the daemon; generated output remains ignored
- **Performance Goal:** remove the measured `tsx` loader component from every
  distributed bridge; exact RSS remains diagnostic

## Success Criteria

- **SC-001:** Installed and repository-local bridges execute the compiled
  artifact and complete MCP initialize/list/call smoke checks.
- **SC-002:** Package/plugin/container validation proves every shipped surface
  points at the compiled path.
- **SC-003:** Host-local observation shows the compiled bridge does not load
  `tsx` and uses materially less RSS than the source wrapper under the same
  conditions.
- **SC-004:** Targeted tests, typecheck, full tests, plugin validation, package
  dry-run, and installed-package smoke pass.

## Related Artifacts

- Change Impact: `change-impact.md`
- Design: `design.md`
- Tasks: `tasks.md`
- Verification: `verification.md`
