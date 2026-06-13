---
title: Plugin discoverability and drift hardening tasks
doc_type: spec
artifact_type: tasks
status: active
owner: platform
last_reviewed: 2026-06-13
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

- [x] T001 Reconcile external plugin references and final metadata decisions.
  - Files: `docs/specs/024-plugin-discoverability-and-drift-hardening/research.md`,
    `docs/runbooks/codex-agent-workbench-plugin.md`
  - Acceptance: Alcove and Codebase Recon patterns are reviewed deeply enough
    to decide repo marketplace, server-card, CI, and history-recon scope.
  - Evidence: Reviewed Alcove plugin manifest, hooks, server card, CI, and
    installer patterns plus Codebase Recon marketplace, skill, and design
    patterns on 2026-06-13; recorded decisions and deferrals in `research.md`
    and `design.md`.
  - [x] T001.1 Reviewed Alcove plugin manifests, hooks, server card, CI, and
    installer script; Evidence: recorded in `research.md`.
  - [x] T001.2 Reviewed Codebase Recon marketplace, skill, and design spec;
    Evidence: recorded in `research.md`.
  - [x] T001.3 Recorded decisions and explicitly deferred ideas in
    `research.md` and `design.md`; Evidence: Phase 1 decisions section.

- [x] T002 Add or document repo-level marketplace metadata.
  - Depends on: T001
  - Files: `.agents/plugins/marketplace.json`,
    `docs/runbooks/codex-agent-workbench-plugin.md`,
    `tests/integration/codex-integration-profile.test.ts`
  - Acceptance: `agent-workbench` marketplace source is either committed and
    tested, or the installer-owned personal marketplace model is documented
    with a visible decision.
  - Evidence: Added `.agents/plugins/marketplace.json`, documented repository
    versus installer-owned personal marketplace behavior in the runbook, and
    added marketplace metadata assertions in
    `tests/integration/codex-integration-profile.test.ts`.
  - [x] T002.1 Added marketplace metadata in
    `.agents/plugins/marketplace.json`; Evidence: marketplace metadata test.
  - [x] T002.2 Added tests for marketplace path, policy, and category;
    Evidence: `codex-integration-profile.test.ts`.
  - [x] T002.3 Documented `codex plugin list` verification in the runbook;
    Evidence: plugin installation section.

- [x] T003 Add MCP discoverability metadata.
  - Depends on: T001
  - Files: `.well-known/mcp/server-card.json`, `src/debug/` or `scripts/`,
    `tests/integration/`
  - Acceptance: MCP discoverability metadata lists current public surfaces and
    fails validation if registry entries drift.
  - Evidence: Added `.well-known/mcp/server-card.json`, chose manual
    maintenance with registry drift tests, documented locality/setup assumptions
    in the runbook, and added registry-to-server-card assertions in
    `tests/integration/codex-integration-profile.test.ts`.
  - [x] T003.1 Chose manual server-card maintenance with registry drift tests.
    Evidence: `design.md` and `research.md`.
  - [x] T003.2 Added `.well-known/mcp/server-card.json`; Evidence:
    committed server card.
  - [x] T003.3 Added registry-to-server-card drift tests; Evidence:
    `codex-integration-profile.test.ts`.
  - [x] T003.4 Documented locality and setup assumptions in the runbook;
    Evidence: MCP discoverability metadata section.

## Phase 2: Drift And Documentation

- [x] T004 Add skill, prompt, profile, and docs drift tests.
  - Depends on: T003
  - Files: `tests/integration/codex-integration-profile.test.ts`,
    `tests/plugin/`, `plugins/agent-workbench/`,
    `src/application/use-cases/describe-codex-integration-profile.ts`
  - Acceptance: Tests fail when skill text, plugin default prompts,
    integration profile, or discoverability metadata name stale surfaces or
    obsolete install behavior.
  - Evidence: Added focused drift tests in
    `tests/integration/codex-integration-profile.test.ts`; `pnpm exec vitest
    run tests/integration/codex-integration-profile.test.ts` passed with 17
    tests on 2026-06-13.
  - [x] T004.1 Add registry-to-integration-profile binding checks; Evidence:
    profile binding test compares registered resources/tools.
  - [x] T004.2 Add plugin default prompt mapping checks; Evidence: default
    prompt test maps prompts to registered resources or tools.
  - [x] T004.3 Add skill stale-name and obsolete-install wording checks;
    Evidence: skill guidance test rejects stale names and hook repair wording.
  - [x] T004.4 Add `.mcp.json` launcher path checks if not already covered;
    Evidence: launcher test asserts installed package prefix and rejects cache,
    source, `tsx`, and `node_modules` runtime paths.

- [x] T005 Improve first-run and operator documentation.
  - Depends on: T001
  - Files: `plugins/agent-workbench/README.md`,
    `docs/runbooks/codex-agent-workbench-plugin.md`,
    `docs/reference/documentation-map.md`
  - Acceptance: Docs cover quick install, verify, update, uninstall, hook
    trust, missing launcher recovery, and maintainer package validation.
  - Evidence: Updated `plugins/agent-workbench/README.md`,
    `docs/runbooks/codex-agent-workbench-plugin.md`, and
    `docs/reference/documentation-map.md`; focused docs drift test passed in
    `codex-integration-profile.test.ts` on 2026-06-13.
  - [x] T005.1 Update plugin README quick start and verification flow;
    Evidence: README Quick Start section.
  - [x] T005.2 Update runbook troubleshooting and hook trust guidance;
    Evidence: runbook First-Run Verification and Troubleshooting sections.
  - [x] T005.3 Update documentation map for new metadata/docs; Evidence:
    documentation map entries for plugin README and MCP server card.

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
