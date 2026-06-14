---
title: Developer CLI workflow tools verification
doc_type: spec
artifact_type: verification
status: active
owner: platform
last_reviewed: 2026-06-14
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
| 2026-06-14 | Spec creation | Requirements, design, change impact, tasks, traceability, and verification plan created. | Pending implementation |

## Residual Risks

- The plugin cachebuster helper currently lives outside this repository in a
  Codex skill path. If that path changes, `awb plugin refresh` may need a
  repo-owned helper or explicit configuration.
- MCP smoke behavior may require small additions to existing debug scripts
  before the CLI can wrap a stable bounded workflow.
- Adding Python test dependencies introduces a second toolchain for validation;
  this is acceptable only if documented and CI-safe.
