---
title: Developer CLI workflow tools verification
doc_type: spec
artifact_type: verification
status: active
owner: platform
last_reviewed: 2026-07-04
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Verification

## Validation Plan

The implementation must prove both command composition and local safety. Tests
should prefer mocked external commands, dry-run modes, and fixture databases.
Validation must not require user-local Codex configuration, Docker, GitHub
credentials, npm credentials, or package publishing access.

## Required Checks

| Check | Purpose | Required before closure |
| --- | --- | --- |
| CLI unit tests | Prove command plans, failure propagation, dry-run, and path handling | Yes |
| Cache inspect fixture tests | Prove read-only SQLite diagnostics and schema tolerance | Yes |
| CLI help snapshot or assertions | Prove template placeholder commands are gone | Yes |
| `pnpm typecheck` | Prove TypeScript runtime was not broken by any debug/helper changes | Yes if TypeScript files changed |
| `pnpm test` or targeted Vitest | Prove existing runtime/package behavior still passes | Yes for broad changes |
| `pnpm run validate:plugin` | Prove plugin/package metadata remains valid | Yes if packaging docs/scripts changed |
| Spec lifecycle lint | Prove this package remains coherent | Yes |
| Installer dry-run | Prove package install wrapper command remains aligned | Yes if installer wrapper is changed |

## Quality Gates

- Mutating commands must have dry-run coverage.
- Tests must not invoke `codex plugin add` against the user's real plugin
  registry.
- Tests must not run Docker build or release publish flows.
- Tests must not write to real repository caches outside temporary fixtures.
- Cache inspection must be read-only by default.

## Evidence Log

| Date | Task IDs | Evidence | Result |
| --- | --- | --- | --- |
| 2026-06-14 | Spec creation | Requirements, design, change impact, tasks, traceability, and verification plan created. | Superseded by implementation evidence |
| 2026-07-04 | T002-T014 | `pnpm test:devcli` ran 10 unit tests covering help, command plans, package install pass-through, MCP smoke plan, cache fixture/missing database handling, and release no-publish behavior. | Passed |
| 2026-07-04 | T005, T006 | `awb package check` via the Python CLI app ran `pnpm run validate:plugin`, `scripts/install-agent-workbench-package.sh --dry-run --skip-codex-config`, and `pnpm pack:dry-run`. | Passed |
| 2026-07-04 | T008 | `awb mcp smoke --repo . --timeout 30` passed outside the managed sandbox. The sandbox-only `tsx` IPC `listen EPERM` limitation is documented as an execution-environment constraint, not an implementation failure. | Passed |
| 2026-07-04 | T012.3 | CI integration was deferred because the local `pnpm test:devcli` command is already documented and avoids user-local Codex, Docker, GitHub, npm credential, and plugin-cache dependencies. | Deferred by design |
| 2026-07-04 | T010, T013 | `awb spec lint docs/specs/028-dev-cli-workflow-tools` and `lint_spec_package` reported 0 diagnostics. | Passed |
| 2026-07-04 | T013 | `pnpm typecheck`, `pnpm test`, `pnpm run validate:plugin`, and `git diff --check` passed. | Passed |

## Residual Risks

- The plugin cachebuster helper currently lives outside this repository in a
  Codex skill path. If that path changes, `awb plugin refresh` may need a
  repo-owned helper or explicit configuration.
- CI does not yet run `pnpm test:devcli`; this slice documents the local command
  and keeps it free of user-local Codex, Docker, GitHub, npm credential, or
  plugin-cache dependencies.
