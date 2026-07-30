---
title: Compiled stdio runtime verification
doc_type: spec
artifact_type: verification
status: draft
owner: platform
last_reviewed: 2026-07-30
---

# Verification

## Scope

This record covers Spec 046 Requirements 1-4 and tasks T001-T005.

## Quality Gates

| Gate | Required? | Status | Evidence |
|------|-----------|--------|----------|
| Spec lint and readiness | yes | passed | Lifecycle lint: zero errors; one non-blocking canonical-context advisory assessed against the promoted canonical owners. |
| Architecture, packaging, and QA review | yes | passed | Three independent reviews; blocking stale-build, installer-platform, launch-inventory, and negative-test findings reconciled into the spec. |
| Compiled runtime targeted tests | yes | passed | Build, receipt, bridge boundary/lifecycle, daemon, worker, plugin, and integration tests passed. |
| Typecheck and full tests | yes | passed | `pnpm typecheck`; 103 files and 1,109 tests passed serially. |
| Plugin and package validation | yes | passed | `pnpm validate:plugin`; `pnpm pack:dry-run` included all four generated artifacts. |
| Installed tarball and repo-local smoke | yes | passed | Installed-package smoke completed compiled cold refresh and two MCP sessions; repo-local plugin installed from checkout. |
| Same-host resource/module observation | yes | passed | Source 94,412 KiB RSS; compiled 56,092 KiB RSS; configured `max_threads = 6`, `max_depth = 1`. |
| Durable documentation promotion | yes | passed | Runtime design, integration design, and Codex runbook updated. |
| Final work-product review | yes | passed | Architecture, QA, documentation, and operations reviews completed; every blocker was implemented and warnings were fixed or reconciled to the lightweight-launch boundary with explicit operator guidance. |

## Planned Validation

| Command or evidence | Purpose | Result |
|---------------------|---------|--------|
| lifecycle lint for Spec 046 | package structure and traceability | passed after evidence reconciliation; no blocking findings |
| targeted runtime/build/entrypoint/integration Vitest files | build and launch behavior | passed; final focused run included 3 files and 29 tests, with broader focused suites earlier in the slice |
| `pnpm typecheck` | TypeScript contracts | passed |
| `pnpm exec vitest run --maxWorkers=1` | full regression without concurrent resource-contention timeouts | passed; 103 files and 1,109 tests |
| `pnpm validate:plugin` | plugin and manifest parity | passed |
| `pnpm pack:dry-run` | build lifecycle and tarball payload | passed; bridge, daemon, graph worker, and receipt included |
| installed-package MCP smoke | compiled bin, daemon, lifecycle, and native behavior | passed; cold refresh, two provider-labelled sessions, EOF exits, and cleanup |
| repository-local install integration test and live installer | candidate build before registration | passed; build-failure test proves no registration mutation; checkout installed into the local Codex plugin cache |
| `/proc` module and RSS observation | host-local resource evidence | passed; source 94,412 KiB, compiled 56,092 KiB |
| Markdown set and `git diff --check` | documentation and patch quality | checked; Markdown returned non-blocking table-readability warnings only, and no patch whitespace errors |

## Agent Readiness Evidence

| Field | Evidence | Residual risk |
|-------|----------|---------------|
| Scope | requirements, design slice boundary, and change impact | none known |
| Context | Spec 045, live process/module evidence, direct launch/package reads | cross-platform memory magnitude unknown |
| Permissions | user requested separate spec and implementation; no release or commit requested | release remains out of scope |
| Validation | commands and evidence above | default parallel full run had three resource-contention timeouts; all affected files passed alone and the complete serial suite passed |
| Review | architecture, packaging, QA before implementation; four-discipline independent final review | findings reconciled; no remaining blocker |
| Closure | three durable owners promoted; keep active until separately closed | commit and lifecycle closure were not requested |

## Task Evidence

| Task | Status | Evidence |
|------|--------|----------|
| T001 | complete | package linted and architecture, packaging, and QA findings reconciled |
| T002 | complete | deterministic build/receipt and compiled daemon-worker cold refresh passed |
| T003 | complete | all distributed surfaces and POSIX repo-local installation migrated and validated |
| T004 | complete | durable owners promoted; host-local resource/cardinality evidence recorded |
| T005 | complete | final reviews reconciled; full serial regression, packaging/install smokes, local install, and lifecycle checks passed |

## Requirement and Property Coverage

| Item | Covered by | Evidence | Residual risk |
|------|------------|----------|---------------|
| Requirement 1 / CP-002 / CP-003 | T002 compiled build, import-boundary, daemon, worker, and installed-smoke checks | targeted tests, serial full regression, and installed cold refresh passed | exact RSS remains host-specific |
| Requirement 2 / CP-004 | T002-T003 receipt, missing/stale artifact, package, and installer-failure checks | post-build validation, package dry-run, and negative tests passed | checkout snapshots require reinstall after source changes |
| Requirement 3 / CP-001 | T003 launch-surface, provider, root, argv, Windows-plan, POSIX-execve, and bounded-error checks | plugin validation, focused/full tests, source launch, and installed smoke passed | live provider CLI discovery remains separate from provider-labelled MCP sessions |
| Requirement 4 | T004 controlled process observation and durable documentation | same-host module/RSS measurement and Markdown set check recorded | provider configuration determines open bridge cardinality |

## Evidence Log

| Date | Evidence | Result | Notes |
|------|----------|--------|-------|
| 2026-07-30 | live Node, source-wrapper, bridge, module-map, environment, and process ownership observations | observed | `tsx` registration dominated the current bridge's host-local RSS; no safe task-completion signal exists. |
| 2026-07-30 | npm CLI and esbuild documentation | reviewed | `prepack`, package `files`, named Node ESM entrypoints, bundling, and external packages support the proposed path. |
| 2026-07-30 | architecture, packaging, and QA reviews of `requirements.md`, `design.md`, and `traceability.md` | reviewed and reconciled | Made the deterministic receipt mandatory, narrowed repo-local support to POSIX, added runtime-root/pointer inventory, and required missing-output and compiled native-failure checks. |
| 2026-07-30 | compiled runtime build and receipt | passed | Generated `dist/mcp/stdio-entrypoint.mjs`, `dist/mcp/daemon-entrypoint.mjs`, `dist/workers/startup-graph-warmup-worker-entrypoint.mjs`, and the validated receipt. |
| 2026-07-30 | `node scripts/ci/installed-package-mcp-smoke.mjs` | passed | Installed tarball exercised two provider-labelled MCP sessions, one replacement cold-refresh worker invocation, two code-0 stdin EOF exits, and complete daemon/socket/temp-root cleanup. |
| 2026-07-30 | typecheck and full Vitest suite | passed | Typecheck succeeded; the default parallel run had three resource-contention timeouts, each affected file passed alone, and the complete serial run passed 103 files and 1,109 tests. |
| 2026-07-30 | same-host controlled bridge observation | observed | Source `tsx` bridge: 94,412 KiB RSS; compiled bridge: 56,092 KiB RSS; 38,320 KiB (40.6%) lower. With configured six spawned threads plus the primary, the illustrative seven-bridge saving is about 262 MiB; exact bridge count is provider-owned. |
| 2026-07-30 | final architecture, QA, documentation, and operations review | reviewed and reconciled | Enforced post-build receipt checking, added `tsconfig.json`, narrowed cleanup, added installer and npm-bin negative tests, corrected Windows/container docs, and clarified that checkout currency is established by reinstall rather than per-connection rehashing. |
| 2026-07-30 | final validation and repo-local installation | passed | Focused 29-test run, typecheck, 103-file/1,109-test serial regression, plugin validation, package dry-run, installed/package launch smokes, repo-local Codex installation, and patch-quality check passed; Markdown findings were non-blocking table-readability warnings. |

## Scope Reconciliation Before Closure

| Target | Implemented | Coverage | Deferred/rejected work | Destination | Blocks closure? |
|--------|-------------|----------|------------------------|-------------|-----------------|
| compiled bridge, daemon, and graph worker | yes | covered | none | Spec 046 | no |
| all distributed launch surfaces | yes | covered | none | Spec 046 | no |
| provider-owned session cleanup | no | out-of-scope | task-completion lifecycle belongs to provider | provider integration owner | no |
| portable exact RSS limit | no | out-of-scope | environment-dependent and misleading | rejected with rationale | no |

## Residual Risks

- Resource savings vary by host and Node version; the observed 40.6% RSS
  reduction is evidence for this host, not a universal threshold.
- A client intentionally retaining an open subagent transport retains one
  lightweight bridge. Bridge cardinality remains provider-owned.
- Checkout overrides are snapshots of the last successful repo-local install;
  rerun the installer after source changes. Per-connection source hashing was
  rejected because it would add work to every lightweight bridge.
- The repository-local checkout installer is explicitly POSIX-only. Windows
  behavior is covered through packaged launch contracts and requires live
  release validation when a release is authorized.

## Ship or Closure Risk

- **Risk level:** medium
- **Breaking change:** no public MCP contract change
- **Blast radius checked:** yes; targeted/full tests, every launch manifest,
  installed tarball smoke, source-launch smoke, and local installation
- **Rollback path:** reinstall the prior release tarball, refresh plugin
  registration, and start a new client session. For source-only development,
  restore the source wrapper, build hook, and launch surfaces together.
- **Requires human review:** no; the requested independent review is complete
- **Release notes needed:** yes at release time
- **Follow-up issue or spec needed:** provider-side shared/multiplexed transport
  only if a client later exposes that capability; it is not an internal stdio
  pooling change
- **Ready for promotion:** yes
- **Ready for release:** no
- **Ready for closure:** yes, but not executed in this slice

## Durable Promotion and Cleanup

| Spec content | Destination | Status |
|--------------|-------------|--------|
| Compiled distribution and runtime ownership | `docs/design/runtime-operations-design.md` | complete |
| Provider bridge cardinality and launch behavior | `docs/design/coding-agent-integration-design.md` | complete |
| Install, rebuild, diagnosis, and rollback | `docs/runbooks/codex-agent-workbench-plugin.md` | complete |

### Spec Cleanup Decision

- **Cleanup action:** keep active
- **Reason:** lifecycle closure checks are ready, but commit and closure
  authorization were not requested.
- **Final spec commit:** pending
- **Closure log path:** `docs/history/spec-closure-log.md`
- **Closure log entry updated:** no
- **Residual spec-only content:** implementation evidence until closure

## Related Artifacts

- Requirements: `requirements.md`
- Change Impact: `change-impact.md`
- Design: `design.md`
- Tasks: `tasks.md`
