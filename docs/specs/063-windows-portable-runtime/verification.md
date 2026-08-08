---
title: Windows portable runtime verification
doc_type: spec
artifact_type: verification
status: active
owner: platform
last_reviewed: 2026-08-08
---

# Verification

## Scope

Spec 063 Windows x64 portable bundle, configuration, release workflow, and
durable installation guidance.

## Quality Gates

| Gate | Required? | Status | Evidence |
|---|---|---|---|
| Requirements and design reviewed | yes | pass | lifecycle lint/readiness completed; independent security findings were resolved and revalidated |
| Focused contract tests | yes | pass | portable configuration, build, smoke, MCP launch, and release-workflow tests pass |
| Windows artifact consumer smoke | yes | pending | the non-publishing `windows-2022` preflight must pass before a release tag is created |
| `pnpm typecheck` and `pnpm test` | yes | pass | typecheck passed; final full suite passed 129 files/1,369 tests |
| Plugin, skill, contract, and package validation | yes | pass | all local gates passed |
| Durable documentation promotion | yes | pass | README, install runbook, packaging README, documentation map, and EB047 backlog routing updated |

## Validation Commands

| Command | Purpose | Result |
|---|---|---|
| focused Vitest files for portable configuration/workflow | contract behavior | pass: 45 portable/configuration/hook/MCP/workflow tests |
| `pnpm typecheck` | TypeScript integrity | pass |
| `pnpm test` | full regression | pass: 129 files and 1,369 tests |
| `pnpm check:contracts` | packaged contract drift | pass |
| `pnpm validate:plugin` | plugin/package metadata | pass |
| `pnpm validate:skills` | packaged skills | pass: 6 files, no errors or warnings |
| `pnpm pack:dry-run` | source tarball unchanged | pass: portable configurator included and no bundled dependencies added |
| Non-publishing Windows preflight | exact locked construction and consumer smoke without a tag or release | pending |

## Agent Readiness Evidence

| Field | Evidence | Residual risk |
|---|---|---|
| Scope | Windows x64 ZIP; npm and GHCR preserved | hosted execution remains |
| Permissions | repository edits and non-publishing CI preflight authorized; release publication and signing not authorized | external run remains |
| Validation | local contracts complete; Windows Actions smoke defined | Windows proof cannot be produced on Linux |
| Review | independent security review completed; three findings fixed and targeted gates rerun | hosted Windows behavior remains the external proof boundary |
| Durable impact | README, install runbook, packaging README, documentation map, backlog | promoted; hosted evidence pending |

## Residual Risks

- Authenticode signing requires an externally managed certificate and secret;
  this slice supplies a checksum release asset and GitHub artifact attestation
  but must not claim code signing or a downloadable attestation release asset.
- Windows arm64 and installer UX remain outside scope.

## Evidence Log

| Date | Evidence | Result | Notes |
|---|---|---|---|
| 2026-08-08 | T001; REQ-001 to REQ-003; lifecycle preflight, spec creation plan, and package lint | partial | `lint_spec_package` reported zero errors and one non-blocking canonical-context advisory. |
| 2026-08-08 | T002-T004; REQ-001 to REQ-003; focused portable configuration, hook, build, smoke, MCP, and workflow tests | pass | Final focused rerun passed eight integration files and 45/45 tests after review fixes. |
| 2026-08-08 | T002 and T005; REQ-001 and REQ-002; typecheck, plugin/skill/contract validation, and package dry-run | pass | Source npm package behavior remains supported. |
| 2026-08-08 | T005; REQ-001 to REQ-003; full Vitest regression | pass | Final post-review run passed 129 files and 1,369 tests. |
| 2026-08-08 | T002-T005; REQ-001 to REQ-003; independent security review | pass | Three findings were resolved: percent-safe Windows hook commands, real-path deployment containment, and release-time checksum-sidecar verification. The affected 45 focused tests, typecheck, and workflow lint passed afterward. |
| 2026-08-08 | T003-T005; REQ-001 to REQ-003; non-publishing hosted Windows construction and consumer smoke | pending | No Actions run URL or artifact digest exists yet; required after commit/push and before creating a release tag. |

## Readiness Decision

- **Ready for promotion:** yes
- **Ready for release:** no
- **Ready for closure:** no

Do not create or publish a release until the non-publishing workflow has built
the ZIP on `windows-2022` from the locked commit, the extracted bundle has
passed its bundled-Node consumer smoke, and a separate governed release can
generate provenance and publish every channel without replacing existing
assets.
