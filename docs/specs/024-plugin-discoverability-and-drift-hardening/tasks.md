---
title: Plugin discoverability and drift hardening tasks
doc_type: spec
artifact_type: tasks
status: active
owner: platform
last_reviewed: 2026-06-06
---

# Tasks

## Task Dependency Graph

```text
T001 -> T002
T001 -> T003 -> T004
T001 -> T005
T002,T003,T004,T005 -> T006 -> T007
```

## Phase 1: Decisions And Metadata

- [ ] T001 Reconcile external plugin references and final metadata decisions.
  - Files: `docs/specs/024-plugin-discoverability-and-drift-hardening/research.md`,
    `docs/runbooks/codex-agent-workbench-plugin.md`
  - Acceptance: Alcove and Codebase Recon patterns are reviewed deeply enough
    to decide repo marketplace, server-card, CI, and history-recon scope.
  - Evidence: Pending.
  - [ ] T001.1 Re-review Alcove plugin manifests, hooks, server card, CI, and
    installer script.
  - [ ] T001.2 Re-review Codebase Recon marketplace, skill, and design spec.
  - [ ] T001.3 Record decisions and explicitly deferred ideas.

- [ ] T002 Add or document repo-level marketplace metadata.
  - Depends on: T001
  - Files: `.agents/plugins/marketplace.json`,
    `docs/runbooks/codex-agent-workbench-plugin.md`,
    `tests/integration/codex-integration-profile.test.ts`
  - Acceptance: `agent-workbench` marketplace source is either committed and
    tested, or the installer-owned personal marketplace model is documented
    with a visible decision.
  - Evidence: Pending.
  - [ ] T002.1 Add marketplace metadata or decision text.
  - [ ] T002.2 Add tests for marketplace path, policy, and category when
    metadata is committed.
  - [ ] T002.3 Validate install instructions against `codex plugin list`.

- [ ] T003 Add MCP discoverability metadata.
  - Depends on: T001
  - Files: `.well-known/mcp/server-card.json`, `src/debug/` or `scripts/`,
    `tests/integration/`
  - Acceptance: MCP discoverability metadata lists current public surfaces and
    fails validation if registry entries drift.
  - Evidence: Pending.
  - [ ] T003.1 Decide manual versus generated server-card maintenance.
  - [ ] T003.2 Add server-card metadata or generator.
  - [ ] T003.3 Add registry-to-server-card drift tests.
  - [ ] T003.4 Document locality and setup assumptions.

## Phase 2: Drift And Documentation

- [ ] T004 Add skill, prompt, profile, and docs drift tests.
  - Depends on: T003
  - Files: `tests/integration/codex-integration-profile.test.ts`,
    `tests/plugin/`, `plugins/agent-workbench/`,
    `src/application/use-cases/describe-codex-integration-profile.ts`
  - Acceptance: Tests fail when skill text, plugin default prompts,
    integration profile, or discoverability metadata name stale surfaces or
    obsolete install behavior.
  - Evidence: Pending.
  - [ ] T004.1 Add registry-to-integration-profile binding checks.
  - [ ] T004.2 Add plugin default prompt mapping checks.
  - [ ] T004.3 Add skill stale-name and obsolete-install wording checks.
  - [ ] T004.4 Add `.mcp.json` launcher path checks if not already covered.

- [ ] T005 Improve first-run and operator documentation.
  - Depends on: T001
  - Files: `plugins/agent-workbench/README.md`,
    `docs/runbooks/codex-agent-workbench-plugin.md`,
    `docs/reference/documentation-map.md`
  - Acceptance: Docs cover quick install, verify, update, uninstall, hook
    trust, missing launcher recovery, and maintainer package validation.
  - Evidence: Pending.
  - [ ] T005.1 Update plugin README quick start and verification flow.
  - [ ] T005.2 Update runbook troubleshooting and hook trust guidance.
  - [ ] T005.3 Update documentation map for new metadata/docs.

## Phase 3: CI And Closure

- [ ] T006 Add CI/plugin/package validation.
  - Depends on: T002, T003, T004, T005
  - Files: `.github/workflows/ci.yml`, `scripts/`, `tests/integration/`,
    `package.json`
  - Acceptance: CI runs typecheck, tests, plugin validation, installer
    dry-run, and package manifest consistency checks without relying on local
    user Codex config.
  - Evidence: Pending.
  - [ ] T006.1 Add CI workflow or extend existing workflow.
  - [ ] T006.2 Add repo-owned plugin validation script if local
    plugin-creator scripts are unavailable in CI.
  - [ ] T006.3 Add package manifest consistency validation.
  - [ ] T006.4 Run CI-equivalent commands locally.

- [ ] T007 Validate, promote durable docs, and prepare closure.
  - Depends on: T006
  - Files: `docs/specs/024-plugin-discoverability-and-drift-hardening/`,
    durable docs changed by this spec
  - Acceptance: Full validation passes, durable docs reflect final behavior,
    and residual risks or follow-up specs are recorded.
  - Evidence: Pending.
  - [ ] T007.1 Run `pnpm typecheck`.
  - [ ] T007.2 Run focused plugin/discoverability tests.
  - [ ] T007.3 Run `pnpm test`.
  - [ ] T007.4 Run `git diff --check`.
  - [ ] T007.5 Run spec lifecycle validation.
  - [ ] T007.6 Record closure readiness in `verification.md`.
