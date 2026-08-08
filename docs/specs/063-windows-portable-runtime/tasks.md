---
title: Windows portable runtime tasks
doc_type: spec
artifact_type: tasks
status: active
owner: platform
last_reviewed: 2026-08-08
---

# Tasks

**Input:** `requirements.md`, `design.md`

## Dependency Graph

```text
T001 -> T002 -> T003 -> T004 -> T005
```

- [x] T001 Establish the portable Windows contract and implementation scope.
  - Depends on: none
  - Requirements: Requirement 1, Requirement 2, Requirement 3
  - Files: `docs/specs/063-windows-portable-runtime/`
  - Acceptance: Requirements, design, traceability, verification, and durable
    promotion targets define one implementation path with no open blocker.
  - Evidence mode: contract
  - Evidence: User selected a self-contained Windows x64 ZIP with bundled Node
    22; lifecycle preflight allocated Spec 063 on 2026-08-08.

- [x] T002 Implement deterministic bundle construction and portable configuration.
  - Depends on: T001
  - Requirements: Requirement 1, Requirement 2; CP-001, CP-002
  - Files: `scripts/ci/build-windows-portable.mjs`,
    `scripts/configure-portable.mjs`, plugin configuration helpers and tests
  - Acceptance: A Windows-only staging path consumes the committed pnpm graph,
    produces the defined layout, and configuration uses absolute bundle-local
    Node paths without changing npm install behavior.
  - Evidence mode: implementation
  - Evidence: Implementation: `scripts/ci/build-windows-portable.mjs`,
    `scripts/configure-portable.mjs`, plugin configuration helpers, package
    allowlist, and focused contract tests. Validation: 45 portable,
    configuration, hook, MCP, and workflow tests passed; `pnpm typecheck`,
    contract/plugin/skill validation, and package dry-run passed on 2026-08-08.

- [/] T003 Add artifact-local and consumer smoke validation.
  - Depends on: T002
  - Requirements: Requirement 1 AC2-AC3, Requirement 2; CP-001-CP-003
  - Files: `scripts/ci/windows-portable-smoke.mjs`, integration tests
  - Acceptance: Tests cover identity, native loads, hooks, configuration, MCP
    initialize, constrained PATH operation, failure behavior, and cleanup.
  - Evidence: Implementation and Linux-hosted contract tests are complete:
    `scripts/ci/windows-portable-smoke.mjs` validates checksum/manifest
    identity, bundled Node ABI, configuration, native loads, hook execution,
    the shipped `agent-workbench.cmd`, MCP initialize/status, and daemon
    cleanup. The required hosted `windows-2022` consumer run remains pending
    after commit/push.

  - Status: partial - implementation complete; real Windows artifact execution pending
  - Evidence mode: validation
- [/] T004 Integrate governed Windows build, attestation, and release upload.
  - Depends on: T003
  - Requirements: Requirement 3; CP-002-CP-005
  - Files: `.github/workflows/release.yml`, workflow contract tests
  - Acceptance: One non-publishing Windows workflow is reused before and during
    release; construction follows the immutable package commit and lock;
    consumer smoke and GHCR precede public release creation; failures and
    reruns cannot publish or replace an asset.
  - Evidence: The release workflow now gates Windows build and bundled-Node
    consumer smoke before GHCR, then verifies the ZIP checksum, attests the ZIP,
    and creates the public release last. Existing releases fail before
    publication and cannot be edited or clobbered. Workflow lint and contract
    tests pass. A live Actions run remains pending after commit/push.

  - Status: partial - workflow contract complete; hosted execution pending
  - Evidence mode: validation
- [~] T005 Promote documentation and complete verification/review.
  - Depends on: T004
  - Requirements: all
  - Files: `README.md`, `docs/runbooks/install-agent-workbench.md`,
    `packaging/agent-workbench/README.md`, `docs/backlog/README.md`,
    `docs/specs/063-windows-portable-runtime/verification.md`
  - Acceptance: Durable docs describe current and residual behavior; focused
    and full repository gates pass; review findings are resolved or routed.
  - Evidence: README, install runbook, packaging README, documentation map, and
    EB047 backlog routing are updated. The final local suite passed 129 files
    and 1,369 tests. Independent security review findings for Windows command
    expansion, real-path containment, and checksum verification were fixed and
    the 45 focused tests, typecheck, and workflow lint passed afterward. Hosted
    Windows evidence remains.

  - Status: in progress - hosted Windows proof remains
  - Evidence mode: implementation
## Execution Rules

- Do not introduce an npm/native/parser fallback.
- Do not publish a release or acquire signing credentials in this slice.
- Mark a task complete only with recorded implementation and validation
  evidence.
