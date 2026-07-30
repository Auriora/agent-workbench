---
title: Compiled stdio runtime tasks
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
T001 -> T002 -> T003 -> T004 -> T005 -> T006 -> T007 -> T008 -> T009
```

## Specification and review

- [x] T001 Create and reconcile the implementation-ready spec through
  architecture, packaging, and QA review.
  - Depends on: none
  - Requirements: Requirement 1, Requirement 2, Requirement 3, Requirement 4
  - Files: `docs/specs/046-compiled-stdio-runtime/`
  - Acceptance: lifecycle lint passes; reviewers classify every finding; all
    blocking findings are implemented in the spec or rejected with evidence.
  - Evidence mode: validation
  - Evidence: Drafted from live process/module measurements, direct launch and
    packaging reads, Spec 045 boundaries, npm lifecycle documentation, and
    esbuild build API documentation. Architecture, packaging, and QA review
    findings were reconciled into a mandatory stale-build receipt, POSIX
    repo-local boundary, full launch-surface inventory, and negative failure
    tests.

## Implementation

- [x] T002 Implement deterministic compiled runtime output.
  - Depends on: T001
  - Requirements: Requirement 1, Requirement 2
  - Properties: CP-002, CP-003, CP-004
  - Files: build script, package scripts/dependencies, ignored build output,
    runtime entrypoints, focused tests
  - Acceptance: one build command emits sibling compiled stdio and daemon
    entrypoints, the daemon-owned graph worker, and a deterministic receipt;
    output contains no `tsx`; stale/missing output fails validation; compiled
    cold refresh completes through the worker; compiled native bootstrap
    failure preserves bounded rebuild guidance.
  - Validation: targeted runtime build, lifecycle, architecture, and daemon
    tests.
  - Evidence: `pnpm build-runtime` emitted compiled stdio, daemon, and graph
    worker artifacts plus a receipt; `pnpm build-runtime:check`, typecheck,
    focused build/boundary/daemon tests, and installed-package cold refresh
    passed.

- [x] T003 Migrate every distributed launch surface and repository-local
  installer.
  - Depends on: T002
  - Requirements: Requirement 2, Requirement 3
  - Property: CP-001
  - Files: npm bin, plugin launchers/config, package/container manifests,
    integration profile, materializer/installer, integration tests
  - Acceptance: all distributed surfaces resolve the compiled entrypoint and
    preserve provider/root/argument/cross-platform behavior.
  - Validation: plugin validation, path-contract tests, repo-local install test,
    package dry-run.
  - Evidence: npm bin, plugin/Claude/Kiro launchers, package/container
    manifests, integration profile, and POSIX repo-local installer target
    `dist/mcp/stdio-entrypoint.mjs`; plugin validation, package dry-run,
    launch smoke, repo-local install tests, and installed-package smoke passed.

- [x] T004 Promote durable behavior and record resource evidence.
  - Depends on: T003
  - Requirements: Requirement 4
  - Files: canonical runtime/integration design, Codex runbook, verification
  - Acceptance: durable owners describe compiled distribution, build/recovery,
    and the provider-owned open-session boundary; host-local observation records
    module and RSS evidence plus configured Codex concurrency/depth inputs
    without a universal threshold or fixed bridge-count invariant.
  - Evidence: Three canonical owners now describe compiled distribution,
    provider-owned thread cardinality, failure recovery, and rollback.
    Same-host controlled observation measured 94,412 KiB for the source `tsx`
    bridge and 56,092 KiB for the compiled bridge. Codex configuration was
    recorded as `max_threads = 6`, `max_depth = 1`.

## Verification and review

- [x] T005 Run final validation, work-product review, and scope reconciliation.
  - Depends on: T004
  - Requirements: Requirement 1, Requirement 2, Requirement 3, Requirement 4
  - Files: implementation, tests, packaging, durable docs, spec evidence
  - Acceptance: targeted and full tests, typecheck, plugin/package checks,
    installed tarball smoke, Markdown/lifecycle checks, and final independent
    review pass or have explicit residual dispositions.
  - Evidence mode: validation
  - Evidence: Four-discipline work-product review findings were reconciled:
    packaging now enforces post-build receipt validation, the receipt covers
    `tsconfig.json`, runtime cleanup is limited to owned output directories,
    build failure stops repo-local registration under test, npm-bin failures are
    bounded, and durable guidance matches the implementation. Typecheck,
    targeted tests, the 103-file/1,109-test serial suite, plugin/package checks,
    installed/package launch smokes, repo-local installation, patch quality,
    and lifecycle evidence checks passed.

- [x] T006 Isolate daemon admission state across installed runtime identities.
  - Depends on: T005
  - Requirements: Requirement 5
  - Property: CP-005
  - Files: daemon client path derivation, daemon launch tests, durable runtime
    contracts, Spec 046 traceability and verification
  - Acceptance: current-runtime startup ignores but does not mutate a live
    legacy receipt; different daemon identities use different receipt and lock
    paths; same-identity parallel clients retain one launch.
  - Validation: focused daemon launch and entrypoint integration tests.
  - Evidence mode: validation
  - Evidence: Runtime logs from 2026-07-30 show installed v0.6.4 bridges exiting
    before MCP initialize because a shared legacy v0.6.2 receipt was classified
    as `blocked: ambiguous_process`. Identity-scoped receipt/lock paths and
    legacy non-interference coverage passed in the 49-test daemon-launch suite
    and the broader 75-test daemon/stdio suite.

- [x] T007 Validate, independently review, package, and live-test the regression
  fix.
  - Depends on: T006
  - Requirements: Requirement 5
  - Property: CP-005
  - Files: implementation, tests, package artifact, durable docs, verification
  - Acceptance: targeted and full validation pass; installed-package concurrent
    handshakes pass with legacy admission state present; independent review has
    no unresolved blocker.
  - Evidence mode: validation
  - Evidence: `pnpm typecheck`, the 103-file/1,111-test serial suite, plugin
    validation, package dry-run, and the installed-tarball smoke passed. The
    installed smoke seeded positively live unsuffixed legacy admission files,
    initialized two concurrent compiled sessions through tools/resources/call
    probes, proved both shared one current daemon, preserved both legacy files
    byte-for-byte, and completed cleanup. Independent architecture review had
    no finding; QA and operations review findings about evidence state,
    released-versus-worktree wording, and identity-input coverage were
    reconciled before completion.

- [x] T008 Decouple rolling-upgrade endpoint readiness from refresh ownership.
  - Depends on: T007
  - Requirements: Requirement 5
  - Property: CP-006
  - Files: daemon bootstrap, ownership-gated refresh authority integration,
    daemon launch tests, durable runtime contracts/design/runbook, verification
  - Acceptance: a current identity daemon initializes and serves the published
    graph while an older live owner retains the repository refresh lease;
    refresh admission is structured `owner_active` with no local `planned`
    state; same-identity duplicate startup cannot unlink the healthy endpoint.
  - Validation: focused daemon launch tests and typecheck.
  - Evidence mode: validation
  - Evidence: The daemon now prepares the existing lazy ownership-gated
    authority during bootstrap. Free ownership preserves synchronous orphan
    reconciliation; `owner_active` publishes a ready observer with concrete
    diagnostics and no local activity lease. Typecheck, 52 daemon-launch tests,
    all 18 real daemon-entrypoint integration tests, and a live checkout
    handshake beside the retained v0.6.4 owner passed. Architecture re-review
    found no remaining blocker.

- [ ] T009 Review, package, and live-test observer readiness.
  - Depends on: T008
  - Requirements: Requirement 5
  - Property: CP-006
  - Files: implementation, tests, package artifact, durable docs, verification
  - Acceptance: full serial regression and package checks pass; independent
    architecture review has no unresolved blocker; a published installed
    artifact initializes while an older live daemon retains refresh ownership.
  - Validation: full serial suite, package/plugin validation, installed
    rolling-upgrade handshake, and independent architecture review.
  - Evidence mode: validation

## Execution Rules

- Read linked requirements, design, research, change impact, traceability, and
  verification before each task.
- Keep only one implementation task in progress.
- Do not add source-runtime fallback, launch-time compilation, task-state
  heuristics, or idle reaping.
- Preserve unrelated Spec 045 work and generated `.cache/` data.
- Do not commit `dist/` or package tarballs.

## Related Artifacts

- Requirements: `requirements.md`
- Change Impact: `change-impact.md`
- Design: `design.md`
- Verification: `verification.md`
