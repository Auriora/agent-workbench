---
title: Stdio bridge resource lifecycle tasks
doc_type: spec
artifact_type: tasks
status: draft
owner: platform
last_reviewed: 2026-07-30
---

# Tasks

**Input:** `requirements.md`, `research.md`, `change-impact.md`, `design.md`

## Task Dependency Graph

```text
T001 -> T002 -> T003 -> T004 -> T005 -> T006 -> T007 -> T008
```

## Spec and review

- [x] T001 Create and reconcile the implementation-ready spec through a
  multi-expert review.
  - Depends on: none
  - Requirement: Requirement 1
  - Related requirements: Requirement 2, Requirement 3, Requirement 4
  - Files: `docs/specs/045-stdio-bridge-resource-lifecycle/`
  - Acceptance: package lint passes; architecture, QA, and operations reviewers
    classify findings; every blocking finding is fixed or rejected with
    evidence before implementation.
  - Evidence mode: validation
  - Evidence: Spec package authored from direct live, installed-package, source, test, and durable-doc evidence. Architecture, QA, and operations MoE reviews completed. Blocking findings were reconciled by using lifecycle-resolvable requirement IDs, selecting StdioBridgeSession in src/mcp/stdio-launch.ts as the sole teardown owner, selecting src/mcp/stdio-entrypoint.mjs as the canonical distributed launcher, naming lightweight contract modules, and requiring deterministic stream, transitive-import, subprocess, and real installed-tarball/bin validation. Spec Lifecycle Manager lint reports zero errors and one non-blocking canonical-context advisory; requirements.md already records the bounded durable-source authority baseline.

## Implementation

- [x] T002 Extract the lightweight daemon client path and bridge dependency
  contracts.
  - Depends on: T001
  - Requirement: Requirement 2
  - Related requirement: Requirement 3
  - Properties: CP-002, CP-003
  - Files: `src/mcp/`, `src/contracts/graph-store-identity-contracts.ts`,
    `src/contracts/launch-authority-contracts.ts`, affected imports,
    `tests/architecture/`
  - Acceptance: stdio runtime imports no daemon server, SQLite, parser, graph,
    or MCP server implementation; daemon identity/election behavior remains one
    explicit path.
  - Validation: targeted architecture and daemon launch tests.
  - Evidence: Extracted daemon admission, identity, metadata, startup-lock, launch, and handshake client behavior into src/mcp/daemon-client.ts; src/mcp/daemon.ts retains daemon server composition and re-exports the existing client surface. Moved graph-store identity and launch-authority constants into the two named lightweight contract modules. stdio-launch.ts now imports the client module directly. Added tests/architecture/stdio-bridge-import-boundary.test.ts rooted at the actual stdio source/wrapper runtime graph. pnpm typecheck passed; the architecture plus daemon-launch suite passed 44 tests; daemon-entrypoint plus stdio-entrypoint integration passed 32 tests.

  - Evidence mode: validation
- [x] T003 Implement deterministic stdio bridge teardown and regression tests.
  - Depends on: T002
  - Requirement: Requirement 1
  - Related requirement: Requirement 3
  - Property: CP-001
  - Files: `src/mcp/stdio*.ts`, `packaging/agent-workbench/Containerfile`,
    `packaging/agent-workbench/package-manifest.json`, `tests/mcp/`,
    `tests/helpers/`, `scripts/ci/installed-package-mcp-smoke.mjs`
  - Acceptance: stdin end/close and socket close/error converge on idempotent
    teardown; open transports remain connected; source and packaged entrypoints
    are exercised; every shipped launcher targets
    `src/mcp/stdio-entrypoint.mjs`.
  - Validation: targeted stdio and daemon entrypoint tests plus
    `CXXFLAGS=-std=c++20 node scripts/ci/installed-package-mcp-smoke.mjs`.
  - Evidence: Implemented StdioBridgeSession as the sole lifecycle owner in src/mcp/stdio-launch.ts; src/mcp/stdio.ts only awaits session.completed. Deterministic tests cover open forwarding, stdin end/close/already-ended input, socket close/error, listener removal, and racing/idempotent teardown (9 tests passed with the import-boundary test). Source subprocess tests prove clean exit on stdin EOF and daemon socket close. Container and package manifest now target the canonical src/mcp/stdio-entrypoint.mjs wrapper; plugin validation and mcp-launch smoke passed. The real installed-package smoke packed and installed the tarball, invoked the installed agent-workbench-mcp bin for Codex- and Claude-labelled sessions, proved one shared daemon, and observed both bridges exit code 0 with no signal after controlling stdin EOF; cleanup was complete. Typecheck and Codex integration profile tests passed.

  - Evidence mode: validation
## Promotion and verification

- [x] T004 Promote accepted behavior into durable design and runbook owners.
  - Depends on: T003
  - Requirement: Requirement 4
  - Files: `docs/design/runtime-operations-design.md`,
    `docs/design/coding-agent-integration-design.md`,
    `docs/runbooks/codex-agent-workbench-plugin.md`
  - Acceptance: durable docs describe current implemented behavior and process
    diagnosis without presenting variable RSS as an exact allocation.
  - Evidence: Promoted runtime ownership and the lightweight dependency
    boundary to `docs/design/runtime-operations-design.md` under `Runtime
    Ownership`; promoted the canonical launcher, `StdioBridgeSession`, native
    startup guidance, and provider-owned bridge cardinality to
    `docs/design/coding-agent-integration-design.md`; and promoted exact
    bridge/orphan diagnosis to `docs/runbooks/codex-agent-workbench-plugin.md`
    under `Bridge process interpretation`. The 2026-07-30 Agent Workbench
    Markdown set check completed with only non-blocking table-readability
    warnings.

  - Evidence mode: implementation
- [x] T005 Run final validation, implementation review, and scope
  reconciliation.
  - Depends on: T004
  - Requirement: Requirement 3
  - Related requirements: Requirement 1, Requirement 2, Requirement 4
  - Files: implementation, tests, durable docs, `verification.md`,
    `traceability.md`
  - Acceptance: targeted tests, typecheck, full tests, plugin validation,
    package dry-run, Markdown checks, and implementation MoE review pass or
    have one explicit residual disposition; verification evidence is recorded.
  - Evidence mode: validation
  - Evidence: Final validation completed on 2026-07-30: `pnpm exec vitest run`
    across ten targeted files passed 144 tests; `pnpm typecheck`, the serial
    full suite (102 files, 1,096 tests), `pnpm validate:plugin`, `pnpm pack:dry-run`,
    `node scripts/ci/mcp-launch-smoke.mjs`,
    `CXXFLAGS=-std=c++20 node scripts/ci/installed-package-mcp-smoke.mjs`, a
    targeted `check_markdown_set` review of 10 docs, and `git diff --check`
    completed. Executable checks passed; Markdown output was limited to
    non-blocking table-readability warnings. Independent review-work-products
    passes found a real blocker set, which moved into T006 for systematic
    reconciliation.

- [x] T006 Reconcile implementation-review blockers.
  - Depends on: T005
  - Requirement: Requirement 3
  - Related requirements: Requirement 2, Requirement 4
  - Properties: CP-003, CP-004
  - Files: `src/mcp/daemon-client.ts`, daemon launch tests,
    `src/application/use-cases/describe-codex-integration-profile.ts`,
    integration-profile and architecture tests, package manifests, packaging
    README, durable runbook, and spec package.
  - Acceptance: native child bootstrap failures retain bounded actionable
    guidance for launch owners and waiters; startup diagnostic handles do not
    survive readiness; the public profile and all shipped launchers name the
    wrapper; the boundary test rejects every named MCP server path; worktree
    metadata is unreleased while published 0.6.2 remains explicit.
  - Evidence mode: validation
  - Evidence: Added bounded detached-daemon startup stderr capture in
    `src/mcp/daemon-client.ts`, mapped recognized native-loader failures to the
    existing terminal failure-code vocabulary plus optional
    `native_module_rebuild_required`, released the pipe after readiness or
    terminal failure, and made `daemon-entrypoint.mjs` write its terminal stderr
    synchronously. Added fake-child and real-child native failure tests plus
    cleanup coverage in `tests/mcp/daemon-launch.test.ts`. Updated the public
    Codex integration profile to name `src/mcp/stdio-entrypoint.mjs` as the
    canonical executable while retaining `src/mcp/stdio.ts` as an implementation
    artifact, tightened the transitive import-boundary test to reject bare
    `@modelcontextprotocol/sdk` and `src/interface-adapters/mcp/server.ts`,
    marked package metadata as `release_status: unreleased` while preserving
    `0.6.2` as the latest published baseline, and fixed the runbook's
    package-marketplace add/remove commands with regression coverage.

- [x] T007 Re-run final validation, review, promotion, and scope reconciliation.
  - Depends on: T006
  - Requirement: Requirement 4
  - Related requirements: Requirement 1, Requirement 2, Requirement 3
  - Files: implementation, tests, package metadata, durable docs,
    `change-impact.md`, `traceability.md`, `verification.md`
  - Acceptance: targeted and full tests, typecheck, plugin/package checks,
    installed-candidate smoke, Markdown checks, lifecycle lint, and final
    implementation review pass; every evidence table records the same state.
  - Evidence mode: validation
  - Evidence: Re-ran lifecycle lint, ten-file targeted validation (144 tests),
    `pnpm typecheck`, the serial full suite (102 files, 1,096 tests),
    `pnpm validate:plugin`, `pnpm pack:dry-run`,
    `node scripts/ci/mcp-launch-smoke.mjs`,
    `CXXFLAGS=-std=c++20 node scripts/ci/installed-package-mcp-smoke.mjs`,
    Markdown set review, and `git diff --check` on 2026-07-30. Direct re-read
    and read-only review confirmed the package-marketplace drift and missing
    real-child native regression were reconciled; remaining Markdown findings
    are non-blocking table readability warnings.

- [x] T008 Reconcile final release, criterion mapping, and closure evidence.
  - Depends on: T007
  - Requirement: Requirement 4
  - Related requirement: Requirement 3
  - Files: `requirements.md`, `design.md`, `tasks.md`, `traceability.md`,
    `verification.md`, release notes, package manifest, and durable promotion
    targets.
  - Acceptance: the historical `0.6.2` candidate evidence remains explicit;
    delivery in `v0.6.3`, the Spec 046 compiled-entrypoint supersession, and the
    current `v0.6.7` release/install state are recorded; every acceptance
    criterion has named evidence; and T004 promotion evidence is concrete.
  - Evidence mode: validation
  - Evidence: Direct reads confirmed the three durable promotion sections,
    `docs/release-notes/v0.6.3.md` attributes the lightweight bridge and
    transport-lifetime fix to Specs 045/046, `git tag --contains c14bf60`
    returned `v0.6.3` through `v0.6.7`, package metadata reports released
    `0.6.7` with `dist/mcp/stdio-entrypoint.mjs`, and
    `npm list -g @auriora/agent-workbench --depth=0` reported installed
    `@auriora/agent-workbench@0.6.7`. Design, traceability, task, and
    verification artifacts were reconciled before closure.

## Execution Rules

- Read the linked requirements, design, research, and traceability row before
  starting each task.
- Mark a task `[~]` before implementation and `[x]` only after evidence is
  recorded.
- Do not add fallback transports, parser paths, partial-result guards, or
  process scavengers.
- Preserve unrelated work and do not commit generated `.cache/` artifacts.

## Related Artifacts

- Requirements: `requirements.md`
- Change Impact: `change-impact.md`
- Design: `design.md`
- Verification: `verification.md`
