---
title: Stdio bridge resource lifecycle verification
doc_type: spec
artifact_type: verification
status: draft
owner: platform
last_reviewed: 2026-07-30
---

# Verification

## Scope

This record covers Spec 045 Requirements 1-4 and tasks T001-T007: lightweight
daemon client extraction, stdio bridge teardown, compatibility tests, durable
documentation, packaging, and expert review.

## Quality Gates

| Gate | Required? | Status | Evidence |
|------|-----------|--------|----------|
| Spec package lint | yes | passed | zero errors; one non-blocking canonical-context advisory |
| Requirements/design/trace review | yes | passed | lifecycle preflight ready |
| Blocking MoE findings reconciled | yes | passed | native diagnostics, public profile, import boundary, package truth, and package-marketplace command drift findings reconciled |
| Targeted lifecycle and architecture tests | yes | passed | final post-review run passed 10 files and 144 tests |
| Typecheck and full tests | yes | passed | typecheck passed; 102 files and 1,096 tests passed |
| Plugin and package validation | yes | passed | plugin validation, package dry-run, source launcher smoke, and installed-package smoke passed |
| Durable documentation promotion | yes | passed | all three canonical owners updated |
| Implementation review and scope reconciliation | yes | passed | final read-only code and lifecycle review found no remaining blockers after evidence reconciliation |

The earlier 2026-07-30 implementation review invalidated completion claims for
Requirement 2 boundary completeness, Requirement 3 native-failure and package
truth, and Requirement 4 evidence consistency. T006-T007 reconciled those
issues and reran the evidence package; the results below are the post-
reconciliation record.

## Validation Commands

| Command | Purpose | Result |
|---------|---------|--------|
| `lint_spec_package docs/specs/045-stdio-bridge-resource-lifecycle` | package structure and traceability | passed; zero errors and one non-blocking `CANONICAL_CONTEXT_MISSING` advisory |
| `pnpm exec vitest run tests/mcp/stdio-bridge-session.test.ts tests/mcp/daemon-launch.test.ts tests/mcp/daemon-entrypoint-integration.test.ts tests/mcp/stdio-entrypoint.test.ts tests/architecture/stdio-bridge-import-boundary.test.ts tests/integration/codex-integration-profile.test.ts tests/integration/mcp-launch.test.ts tests/integration/claude-plugin.test.ts tests/integration/kiro-power.test.ts tests/integration/repo-local-codex-install.test.ts` | deterministic lifecycle, election compatibility, native startup, subprocess behavior, launch surfaces, profile truth, and transitive import graph | passed; 10 files and 144 tests |
| `pnpm typecheck` | TypeScript contracts | passed |
| `pnpm exec vitest run --maxWorkers=1 --reporter=dot` | full regression without concurrent resource-contention timeouts | passed; 102 files and 1,096 tests |
| `pnpm validate:plugin` | packaged plugin launchers and manifests | passed |
| `pnpm pack:dry-run` | npm package contents | passed; tarball `auriora-agent-workbench-0.6.2.tgz` built from an `unreleased` worktree candidate |
| `CXXFLAGS=-std=c++20 node scripts/ci/installed-package-mcp-smoke.mjs` | packs, installs, invokes the real installed bin, proves daemon sharing, and requires stdin EOF process exit | passed; installed tarball smoke and cleanup succeeded; provider-labelled sessions only, not live Codex/Claude plugin proof |
| `node scripts/ci/mcp-launch-smoke.mjs` | plugin shim resolves the canonical wrapper and initializes | passed |
| `git diff --check` | patch formatting | passed |
| Agent Workbench Markdown set check | edited durable/spec docs | warnings only; table-readability warnings are non-blocking and pre-existing in large tables |

## Requirement and Property Coverage

| Item | Covered by | Evidence | Residual risk |
|------|------------|----------|---------------|
| Requirement 1 / CP-001 | T003 lifecycle, subprocess, and installed-bin EOF tests | targeted and installed-package smoke passed | open clients intentionally remain connected by design |
| Requirement 2 / CP-003 | T002 transitive import-boundary test | targeted and full regressions passed | exact RSS remains environment-specific |
| Requirement 3 / CP-002 / CP-004 | existing and targeted daemon launch/integration, profile, source-launcher, and installed-package tests | targeted tests, full regression, source smoke, and installed-package smoke passed | live Codex/Claude CLI plugin proof remains outside this implementation scope |
| Requirement 4 | T004 durable docs and Markdown/evidence checks | durable docs updated; evidence tables reconciled; Markdown warnings non-blocking | spec stays active until commit/closure is separately authorized |

## Agent Readiness Evidence

| Field | Evidence | Residual risk |
|-------|----------|---------------|
| Scope | `requirements.md` goals/non-goals and `design.md` slice boundary | none |
| Context | direct source/docs reads, `research.md`, Agent Workbench routing | optional semantic enrichment is incomplete; direct reads govern |
| Permissions | local source/tests/docs edits authorized; no release, install, commit, or process killing authorized | installed 0.6.2 remains unchanged |
| Validation | Agent Workbench verification plan, commands above, and lifecycle lint before evidence reconciliation | Markdown set returned non-blocking readability warnings only |
| Review | architecture, QA, and operations MoE before implementation; final code, lifecycle, and evidence review after | every finding was implemented or reconciled with direct evidence |
| Closure | promote three durable owners; retain active until commit/closure is separately authorized | no closure claim in this task |

## Task Evidence

| Task | Status | Evidence |
|------|--------|----------|
| T001 | complete | package lint and three-discipline MoE review reconciled |
| T002 | complete | client split, contract extraction, import-boundary and daemon tests |
| T003 | complete | deterministic lifecycle tests and real installed-bin EOF smoke |
| T004 | complete | three durable owners promoted |
| T005 | complete | final full suite, plugin/package checks, Markdown review, and scope reconciliation recorded |
| T006 | complete | native diagnostics, canonical profile, import boundary, package truth, and package-marketplace commands reconciled |
| T007 | complete | validation rerun and evidence-table reconciliation completed |

## Scope Reconciliation Before Closure

| Target | Implemented | Coverage state | Deferred/rejected work | Destination | Blocks closure? | Evidence |
|--------|-------------|----------------|------------------------|-------------|-----------------|----------|
| Transport-owned lifetime | yes | covered | none | Spec 045 T003 | no | targeted lifecycle tests, full regression, and installed-package smoke |
| Lightweight import graph | yes | covered | absolute RSS guarantee rejected as non-portable | Spec 045 T002 | no | import-boundary test plus targeted/full regressions |
| Daemon compatibility | yes | covered | none | Spec 045 T002/T003/T006 | no | daemon launch/integration, source launcher smoke, and installed-package smoke |
| Client-owned open completed sessions | no | out-of-scope | client retains a valid open transport; killing it would be unsafe | client integration owner if behavior changes | no | live process evidence |

## Evidence Log

| Date | Evidence | Result | Notes |
|------|----------|--------|-------|
| 2026-07-29 | `ps`, `/proc/<pid>/fd`, Unix-socket ownership, and parent-writer inspection grouped by resolved repository root | observed | Four daemons matched four active repository identities; 11 app-2 bridges had neither socket nor stdin writer; connected completed-session bridges retained a parent pipe writer. |
| 2026-07-29 | Installed `/home/bcherrington/.config/nvm/versions/node/v24.8.0/lib/node_modules/@auriora/agent-workbench/src/mcp/stdio.ts` compared with checkout `src/mcp/stdio.ts` at `2f2c561` | observed | Installed 0.6.2 resumes stdin and installs an effectively infinite interval; checkout waits only for socket close. |
| 2026-07-29 | Static import chain `src/mcp/stdio.ts` -> `src/mcp/stdio-launch.ts` -> `src/mcp/daemon.ts` -> `src/server.ts` and native/runtime imports | observed | Current bridge reaches combined daemon client/server and heavy repository graph. |
| 2026-07-30 | lifecycle lint, 10-file/144-test target, typecheck, 102-file/1,096-test serial full suite, plugin validation, package dry-run, source launcher smoke, installed-package smoke, Markdown set review, and direct review | passed | Post-review validation succeeded. Markdown output is limited to non-blocking table readability warnings; installed-package smoke explicitly remains provider-labelled rather than live plugin proof. |

## Residual Risks

- Moving mature startup-election code can introduce semantic drift; existing
  failure and concurrency tests must remain unchanged and pass.
- Exact RSS savings remain environment-dependent. Verification records the
  module boundary and an observation, not a misleading universal byte limit.
- A client can intentionally retain a completed subagent transport. The bridge
  remains while the transport is open by design.

## Durable Promotion and Cleanup

| Spec content | Destination | Status |
|--------------|-------------|--------|
| Runtime ownership and dependency boundary | `docs/design/runtime-operations-design.md` | complete |
| Coding-agent bridge lifecycle | `docs/design/coding-agent-integration-design.md` | complete |
| Process diagnosis and recovery | `docs/runbooks/codex-agent-workbench-plugin.md` | complete |
| MCP contracts | no change | not applicable |

### Spec Cleanup Decision

- **Cleanup action:** keep active
- **Reason:** lifecycle closure checks are now ready, but commit and closure
  authorization were not requested.
- **Final spec commit:** pending
- **Closure log path:** `docs/history/spec-closure-log.md`
- **Closure log entry updated:** no
- **Residual spec-only content:** implementation evidence until closure

## Ship or Closure Risk

- **Risk level:** medium
- **Breaking change:** no
- **Blast radius checked:** yes; targeted tests, full regression, source launcher smoke, and installed-package smoke
- **Rollback path:** reinstall the prior release tarball, refresh the plugin
  registration, start a new client session, and verify the reported runtime
  version/entrypoint provenance. Do not delete daemon metadata or caches as a
  rollback shortcut. For source-only development, revert the module split,
  lifecycle owner, and canonical-launch changes together.
- **Requires human review:** no; requested MoE review is the review gate
- **Release notes needed:** yes at release time
- **Follow-up issue or spec needed:** no known follow-up

## Readiness Decision

- **Ready for promotion:** yes
- **Ready for release:** no
- **Ready for closure:** yes, but not executed in this slice

## Related Artifacts

- Requirements: `requirements.md`
- Change Impact: `change-impact.md`
- Design: `design.md`
- Tasks: `tasks.md`
