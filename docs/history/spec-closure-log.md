---
title: Spec closure log
doc_type: history
status: active
owner: platform
last_reviewed: 2026-07-05
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Spec Closure Log

## Purpose

Record closed implementation spec packages after their accepted behavior has
been promoted to durable docs, backlog items, roadmap entries, tests, or code.
Closed packages are removed from `docs/specs/` so that directory only contains
active implementation scaffolding.

The final pre-removal tree commit for Specs 001-018 is `77e0fda`. Later rows
name their own final pre-removal tree commits.

## Closed Specs

| Spec | Closure action | Durable destination |
| --- | --- | --- |
| Spec 001: Agent IDE runtime | Removed from `docs/specs/` on 2026-06-06 after MVP completion and durable promotion. | Runtime requirements, layered/runtime/design docs, MCP surface design, graph store design, runtime contracts, workspace safety contract, ADRs, runbooks, and MVP proof matrix. |
| Spec 002: Early dogfood follow-ups | Removed from `docs/specs/` on 2026-06-06 after follow-up behavior was routed into later cross-repo work. | Documentation map, backlog, and cross-repo runtime design/reference docs. |
| Spec 003: Cross-repo trust discovery | Removed from `docs/specs/` on 2026-06-06 after trust, scope, and first-slice routing behavior was promoted. | MCP surface design, runtime operations design, workspace safety contract, language adapter design, and backlog. |
| Spec 004: Overview ranking polish | Removed from `docs/specs/` on 2026-06-06 after overview ranking behavior was promoted. | MCP surface design and documentation map. |
| Spec 005: .NET repository shape hardening | Removed from `docs/specs/` on 2026-06-06 after generated-output and validation-planning behavior was promoted. | Language adapter design, MCP surface design, runtime operations design, and language capability matrix. |
| Spec 006: Infrastructure template routing | Removed from `docs/specs/` on 2026-06-06 after infrastructure routing behavior was promoted. | Language adapter design, MCP surface design, and backlog. |
| Spec 007: Redaction boundary polish | Removed from `docs/specs/` on 2026-06-06 after presentation redaction behavior was promoted. | MCP surface design and workspace safety contract. |
| Spec 008: Lambda result presentation | Removed from `docs/specs/` on 2026-06-06 after Lambda grouping behavior was promoted. | MCP surface design and language adapter design. |
| Spec 009: CMake C++ routing and validation | Removed from `docs/specs/` on 2026-06-06 after CMake/C++ routing behavior was promoted. | Language adapter design, MCP surface design, and language capability matrix. |
| Spec 010: Agent IDE capability analysis | Removed from `docs/specs/` on 2026-06-06 after portable lessons were promoted. | Durable design docs, backlog, and follow-up specs. |
| Spec 011: Diagnostics and post-edit feedback | Removed from `docs/specs/` on 2026-06-06 after diagnostics and quiet hook feedback behavior was promoted. | MCP surface design, edit and validation loop design, and coding agent integration design. |
| Spec 012: Docs query and read surfaces | Removed from `docs/specs/` on 2026-06-06 after docs query/read behavior was promoted. | MCP surface design and Markdown document quality design. |
| Spec 013: FTS-backed docs search | Removed from `docs/specs/` on 2026-06-06 after FTS docs search behavior was promoted. | MCP surface design, graph store design, and runtime operations design. |
| Spec 014: TypeScript/JavaScript partial semantic routing | Removed from `docs/specs/` on 2026-06-06 after JS/TS routing behavior was promoted. | Language adapter design, MCP surface design, and language capability matrix. |
| Spec 015: Go reference and impact promotion | Removed from `docs/specs/` on 2026-06-06 after Go reference/impact behavior was promoted. | Language adapter design, MCP surface design, and language capability matrix. |
| Spec 016: SAM CloudFormation intrinsic routing | Removed from `docs/specs/` on 2026-06-06 after SAM/CloudFormation routing behavior was promoted. | Language adapter design, MCP surface design, and language capability matrix. |
| Spec 017: Markdown quality MCP surface | Removed from `docs/specs/` on 2026-06-06 after Markdown quality behavior was promoted. | Markdown document quality design, MCP surface design, and edit and validation loop design. |
| Spec 018: History mining for agent IDE signals | Removed from `docs/specs/` on 2026-06-06 after mining taxonomy and routed follow-up work were promoted. | Agent Workbench executable backlog and history-mining reference notes. |
| Spec 019: Integration health and session routing | Removed from `docs/specs/` on 2026-06-06 after final pre-removal tree commit `787ec81` completed integration health, session-aware next-action filtering, and conservative contextual routing. | MCP surface design, coding agent integration design, executable backlog, runtime contracts, integration profiles, and presenter tests. |
| Spec 020: Multi-file post-edit repair | Removed from `docs/specs/` on 2026-06-13 after final pre-removal tree commit `a4b66ae` completed structured post-edit outcomes, deferred-check evidence, quiet hook behavior, hook-log and telemetry observability, and durable promotion. | Edit and validation loop design, coding agent integration design, runtime contracts, documentation map, executable backlog, feedback tests, hook fixture tests, Kiro integration tests, MCP telemetry tests, telemetry helper tests, and final full Vitest validation. |
| Spec 021: Spec task traceability lookup | Removed from `docs/specs/` on 2026-06-13 after final pre-removal tree commit `d31e5c8` completed `context_for_task.lifecycle_context`, `lifecycle_evidence`, bounded local spec routing, non-authoritative active/archived/malformed spec evidence, caller-supplied lifecycle context consumption, nested companion routing hints, and durable promotion. | Runtime contracts, MCP surface design, coding agent integration design, documentation map, executable backlog, lifecycle bridge contract, packaged Agent Workbench skill and Kiro Power guidance, context task tests, contract tests, integration-profile tests, Kiro integration tests, and final full Vitest validation. |
| Spec 022: MCP server repository support | Removed from `docs/specs/` on 2026-06-13 after final pre-removal tree commit `62db46c` completed MCP-server repo-shape detection, overview/context routing, safe initialize/tools-list/call-tool validation planning, fixture coverage for stdio, HTTP/SSE, streamable HTTP, Docker/devcontainer, and ambiguous evidence, plus durable promotion. | MCP surface design, coding agent integration design, documentation map, executable backlog, MCP server fixture repos, overview/context/verification-plan tests, typecheck, lifecycle lint, closure check, and final serial full Vitest validation. |
| Spec 023: MCP tool sweep quality | Removed from `docs/specs/` on 2026-06-11 after final pre-removal tree commit `7922693` completed sweep quality semantics, sandbox-only write validation, progress-report RCA, pagination, docs FTS warmup, and final eight-repo committed-sandbox validation. | Observability and debugging design, runtime operations design, runtime contracts, documentation map, debug harness tests, docs/query tests, graph/query tests, verification-plan tests, and final committed-sandbox sweep evidence. |
| Spec 024: Plugin discoverability and drift hardening | Removed from `docs/specs/` on 2026-06-13 after final pre-removal tree commit `90b70bc` completed Codex marketplace metadata, MCP server-card metadata, drift tests, operator docs, CI workflow, repo-owned plugin/package validation, installer dry-run, package dry-run, and durable promotion. | Agent Workbench plugin README, Codex plugin runbook, documentation map, marketplace metadata, MCP server card, CI workflow, plugin/package validator, package metadata tests, focused integration tests, lifecycle lint, closure check, and final full Vitest validation. |
| Spec 025: Brooks-Lint findings tracker | Removed from `docs/specs/` on 2026-06-11 after final pre-removal tree commit `539f174` completed architecture boundary remediation, tech-debt extraction splits, runtime contract modularization, MCP test harness hardening, focused validation/resource rule tests, broad fixture helper annotation, and durable test-maintainability gates. | Layered runtime architecture, system architecture, runtime contracts, MVP proof matrix, documentation map, architecture tests, MCP/integration tests, focused validation/resource tests, broad fixture tests, and final closure traceability. |
| Spec 027: Workspace watcher ignore sync | Removed from `docs/specs/` on 2026-07-05 after final pre-removal tree commit `73fa695` completed shared root ignore policy, filesystem watcher adapter, debounced change queue, hook routing, stale-rescan scheduling, no parallel per-file indexer guard, and watcher freshness surfaces. | Runtime operations design, runtime contracts, graph store design, workspace safety contract, runtime requirements, documentation map, watcher/queue/status/MCP tests, archive index, and closure log. |
| Spec 029: Repo-root authority | Removed from `docs/specs/` on 2026-07-04 after final pre-removal tree commit `5a8b098` completed launch-root authority for public MCP resources and tools, debug-only root override gating, public `repo_root` metadata hiding, integration-health root policy reporting, and durable promotion. | Workspace safety contract, MCP surface design, runtime contracts, threat model, documentation map, root-authority policy and MCP registry tests, response metadata tests, integration-health tests, focused MCP/contract validation, and final full Vitest validation. |
| Spec 030: MCP error envelope consistency | Removed from `docs/specs/` on 2026-07-04 after final pre-removal tree commit `8e66d18` completed the shared MCP envelope wrapper, representative tool migrations, distinct recoverable failure classes, durable contract/design promotion, and registry consistency tests. | Runtime contracts, MCP surface design, documentation map, executable backlog, shared MCP envelope wrapper, representative MCP registry tests, typecheck, plugin/package validation, full Vitest validation, lifecycle lint, scan, and closure-check. |
| Spec 031: Shared path policy | Removed from `docs/specs/` on 2026-07-05 after final pre-removal tree commit `686270d` completed shared path classification, workspace safety migration, scanner/docs routing alignment, hook vocabulary drift coverage, secret-path fixtures, and durable promotion. | Workspace safety contract, threat model, executable backlog EB033 boundary, path-policy consistency tests, workspace safety tests, scanner/docs/hook/MCP validation tests, typecheck, plugin validation, full Vitest validation, lifecycle lint, closure-check, and closure-risk review. |
| Spec 032: Per-repo runtime daemon and shared cache | Removed from `docs/specs/` on 2026-07-05 after final pre-removal tree commit `878392f` completed per-repo daemon startup, local IPC proxying, daemon-owned graph-store access, shared startup warmup, daemon health diagnostics, and parallel sub-agent cold-start coverage. | Runtime operations design, graph store design, MCP surface design, runtime contracts, executable backlog EB036, daemon launcher tests, daemon entrypoint integration tests, stdio/resource regression tests, docs metadata tests, package integration checks, MCP smoke, closure log, and archive index. |
| Spec 033: Cross-platform packaging | Removed from `docs/specs/` on 2026-07-04 after final pre-removal tree commit `0d2cc48` completed shell-free npm package install, Codex/Claude MCP launch shims, shell-free hook entry points, package-scoped marketplaces, supported platform matrix documentation, and routed macOS/Windows runner evidence. | Codex Agent Workbench plugin runbook, packaging README, plugin README, cross-platform packaging workflow, install/MCP/hook smoke scripts, Codex/Claude package metadata tests, backlog follow-ups for Kiro launcher and turnkey core `tree-sitter`, documentation map, spec closure log, and archive index. |
| Spec 034: Doc currency routing | Removed from `docs/specs/` on 2026-07-02 after final pre-removal tree commit `8657e9e` completed document currency classification, docs search/inventory metadata, `context_for_task` ranking, `docs_current_for_task`, durable docs promotion, and spec-lifecycle-manager handoff. | MCP surface design, graph store design, runtime contracts, documentation map, spec-lifecycle-manager doc currency handoff, MCP server card, Codex integration profile, docs/context/MCP tests, lifecycle lint, closure check, and closure-risk review. |
| Spec 034: Release notes generation | Removed from `docs/specs/` on 2026-07-05 after final pre-removal tree commit `5b40e6d` completed `awb release notes`, Git range/tag evidence collection, per-commit file evidence, candidate grouping, validation inputs, Markdown/JSON/agent outputs, draft/final boundaries, release-note skill guidance, and durable release-process documentation. | Agent Workbench Dev CLI README, Codex Agent Workbench plugin runbook, agent-readable changelog, backlog EB035, documentation map, dev CLI tests, package/plugin validation, typecheck, full Vitest validation, archive index, and closure log. |
| Spec 035: Trust calibration in tool outputs | Removed from `docs/specs/` on 2026-07-06 after final pre-removal tree commit `86e4a81` completed additive `meta.trust` response metadata, shared trust policy derivation, public presenter and registry coverage, direct-read and integration-profile remediation, golden MCP trust tests, durable docs promotion, and post-reload smoke verification. | Runtime contracts, MCP surface design, documentation map, backlog EB023, response metadata contracts, shared response metadata helpers, public MCP presenter and registry tests, trust golden tests, lifecycle lint, full Vitest validation, live MCP smoke, cross-repo local smoke, archive index, and closure log. |
| Spec 036: Index completeness and docs-first warmup | Removed from `docs/specs/` on 2026-07-07 after final pre-removal tree commit `6240281` completed docs-first and docs-dedicated indexing, partial/truncated warmup coverage metadata, `docs_search` coverage-state exposure, and route-graph warmup completion routed to EB014. | Runtime operations design, graph store design, MCP surface design, runtime contracts, agent-readable changelog, and executable backlog EB014. |

### 2026-06-13 - 022-mcp-server-repository-support

- **Spec:** docs/specs/022-mcp-server-repository-support
- **Title:** MCP server repository support
- **Final spec commit:** 62db46c
- **Closure cleanup commit:** 6ed5758
- **Closure action:** removed
- **Durable docs updated:**
  - `docs/design/mcp-surface-design.md`
  - `docs/design/coding-agent-integration-design.md`
  - `docs/reference/documentation-map.md`
  - `docs/backlog/README.md`
  - `docs/history/spec-closure-log.md`
  - `docs/history/spec-archive-index.md`

### 2026-06-13 - 024-plugin-discoverability-and-drift-hardening

- **Spec:** docs/specs/024-plugin-discoverability-and-drift-hardening
- **Title:** Plugin discoverability and drift hardening
- **Final spec commit:** 90b70bc
- **Closure cleanup commit:** ad9b27f
- **Closure action:** removed
- **Durable docs updated:**
  - `.agents/plugins/marketplace.json`
  - `.well-known/mcp/server-card.json`
  - `.github/workflows/ci.yml`
  - `scripts/validate-agent-workbench-plugin.mjs`
  - `package.json`
  - `plugins/agent-workbench/README.md`
  - `docs/runbooks/codex-agent-workbench-plugin.md`
  - `docs/reference/documentation-map.md`
  - `tests/integration/codex-integration-profile.test.ts`
- **Verification summary:** `pnpm run validate:plugin`; installer dry-run;
  `pnpm pack:dry-run`; `pnpm typecheck`; focused integration tests; full
  `pnpm test` outside the managed sandbox; `git diff --check`; spec lifecycle
  lint; closure check.
- **Residual risks:** MCP server-card convention churn, string-based drift-test
  brittleness, and intentionally deferred history reconnaissance.

### 2026-07-02 - 034-doc-currency-routing

- **Spec:** docs/specs/034-doc-currency-routing
- **Title:** Doc currency routing
- **Final spec commit:** 8657e9e
- **Closure cleanup commit:** 7595c5b
- **Closure action:** removed
- **Durable docs updated:**
  - `.well-known/mcp/server-card.json`
  - `docs/design/mcp-surface-design.md`
  - `docs/design/graph-store-design.md`
  - `docs/reference/runtime-contracts.md`
  - `docs/reference/documentation-map.md`
  - `docs/reference/documentation-map.md`
  - `src/contracts/runtime-core-contracts.ts`
  - `src/contracts/runtime-docs-contracts.ts`
  - `tests/docs/query-docs.test.ts`
  - `tests/mcp/context-for-task-tool.test.ts`
  - `tests/mcp/docs-surfaces.test.ts`
- **Verification summary:** `pnpm typecheck`; targeted docs/MCP/contract
  Vitest suite; `git diff --check`; no-`ctime` scan; spec lifecycle lint;
  closure check; closure-risk review.
- **Residual risks:** Full `pnpm test` currently has a repeated startup
  warm-up race in `tests/mcp/stdio-entrypoint.test.ts` when run with the whole
  suite; that file passes standalone and the targeted doc-currency suites pass.

### 2026-07-05 - 034-release-notes-generation

- **Spec:** docs/specs/034-release-notes-generation
- **Title:** Release notes generation
- **Final spec commit:** 5b40e6d
- **Closure cleanup commit:** fe25872
- **Closure action:** removed
- **Durable docs updated:**
  - `tools/devcli/README.md`
  - `docs/runbooks/codex-agent-workbench-plugin.md`
  - `docs/reference/agent-readable-changelog.md`
  - `docs/backlog/README.md`
  - `docs/reference/documentation-map.md`
  - `docs/history/spec-closure-log.md`
  - `docs/history/spec-archive-index.md`
- **Verification summary:** Spec implementation validation recorded
  `python3 -m unittest tools/devcli/tests/test_cli.py`, package/plugin
  validation, package dry-run, `pnpm typecheck`, full `pnpm test`, and
  `git diff --check`. Closure cleanup reran lifecycle lint, archive-index check,
  docs metadata/link tests, dev CLI tests, package/plugin validation, and full
  Vitest validation before removal.
- **Residual risks:** Release-note classification is intentionally path-based
  and still requires maintainer or agent review before publishing. GitHub PR
  metadata enrichment and cross-repo extraction remain deferred until proven
  necessary. A separate plugin remains unnecessary while the repo-local `awb`
  command and packaged `release-notes` skill cover this repository.

### 2026-07-06 - 035-trust-calibration-tool-outputs

- **Spec:** docs/specs/035-trust-calibration-tool-outputs
- **Title:** Trust calibration in tool outputs
- **Final spec commit:** 86e4a81
- **Closure cleanup commit:** c90769b
- **Closure action:** removed
- **Durable docs updated:**
  - `docs/reference/runtime-contracts.md`
  - `docs/design/mcp-surface-design.md`
  - `docs/reference/documentation-map.md`
  - `docs/backlog/README.md`
  - `docs/history/spec-closure-log.md`
  - `docs/history/spec-archive-index.md`
- **Verification summary:** Spec implementation validation recorded
  `pnpm typecheck`, full `pnpm test` with 78 files and 566 tests, focused
  docs/contract/MCP validation with 8 files and 79 tests, docs metadata tests,
  lifecycle lint, `git diff --check`, and implementation review. Post-reload
  verification exercised live MCP `context_for_task`, `docs_search`,
  `diagnostics_for_files`, and `verification_plan`; the debug sample smoke
  passed on this repo and 10 local cross-repo samples, and the broader MCP tool
  sweep produced no invalid envelopes.
- **Residual risks:** Cross-repo tool-sweep blocked/degraded results were
  limited to harness verification limits and write-safety skips; no trust
  calibration regression was found. `meta.trust` remains additive, so consumers
  that ignore unknown metadata keep the previous response contract behavior.

### 2026-07-04 - 033-cross-platform-packaging

- **Spec:** docs/specs/033-cross-platform-packaging
- **Title:** Cross-platform packaging
- **Final spec commit:** 0d2cc48
- **Closure cleanup commit:** 877553a
- **Closure action:** removed
- **Durable docs updated:**
  - `docs/runbooks/codex-agent-workbench-plugin.md`
  - `packaging/agent-workbench/README.md`
  - `plugins/agent-workbench/README.md`
  - `.github/workflows/cross-platform-packaging.yml`
  - `docs/backlog/README.md`
  - `docs/reference/documentation-map.md`
  - `docs/history/spec-closure-log.md`
  - `docs/history/spec-archive-index.md`
- **Verification summary:** `git diff --check`; `pnpm typecheck`;
  `node scripts/validate-agent-workbench-plugin.mjs`; focused Spec 033 Vitest
  slice; Linux `install-smoke`, `mcp-launch-smoke`, and `hook-smoke`;
  `pnpm pack:dry-run`.
- **Residual risks:** macOS/Windows workflow legs are authored but still need
  runner history or release-readiness evidence; Kiro launcher conversion and
  turnkey core `tree-sitter` prebuild work are routed to backlog.

### 2026-07-04 - 026-agent-skills-standard-compliance

- **Spec:** docs/specs/026-agent-skills-standard-compliance
- **Title:** Agent Skills standard compliance
- **Final spec commit:** e17ce9f
- **Closure cleanup commit:** 89dd49a
- **Closure action:** removed
- **Durable docs updated:**
  - `scripts/validate-agent-skills.mjs`
  - `tests/integration/agent-skills-validation.test.ts`
  - `.github/workflows/ci.yml`
  - `package.json`
  - `plugins/agent-workbench/README.md`
  - `plugins/agent-workbench/claude-plugin/skills/agent-workbench/SKILL.md`
  - `docs/runbooks/codex-agent-workbench-plugin.md`
  - `docs/reference/documentation-map.md`
  - `docs/backlog/README.md`
  - `docs/history/spec-closure-log.md`
  - `docs/history/spec-archive-index.md`
- **Verification summary:** `pnpm run validate:skills`; focused
  `tests/integration/agent-skills-validation.test.ts`; advisory cache audit;
  `pnpm typecheck`; `pnpm run validate:plugin`; `git diff --check`; spec
  lifecycle lint; full `pnpm test` with 67 files and 488 tests.
- **Residual risks:** Advisory cache mode can report warnings for old installed
  plugin caches until the user refreshes those plugins. Those warnings remain
  observation-only and do not fail CI. Brooks-Lint remains a non-owned
  Codex-local skill set until explicitly promoted into a plugin or
  repository-owned package.

### 2026-07-05 - 027-workspace-watcher-ignore-sync

- **Spec:** docs/specs/027-workspace-watcher-ignore-sync
- **Title:** Workspace watcher ignore sync
- **Final spec commit:** 73fa695
- **Closure cleanup commit:** 4887c69
- **Closure action:** removed
- **Durable docs updated:**
  - `docs/design/runtime-operations-design.md`
  - `docs/reference/runtime-contracts.md`
  - `docs/design/graph-store-design.md`
  - `docs/reference/workspace-safety-contract.md`
  - `docs/requirements/runtime-requirements.md`
  - `docs/reference/documentation-map.md`
  - `docs/history/spec-closure-log.md`
  - `docs/history/spec-archive-index.md`
- **Verification summary:** Spec implementation validation recorded focused
  watcher, queue, graph no-indexer, response metadata, status, MCP status,
  contract, path-policy, and full Vitest validation; `pnpm typecheck`; `git diff
  --check`; lifecycle lint; closure-check. Closure cleanup reran lifecycle lint
  and closure-check before removal.
- **Residual risks:** Per-file graph/docs/FTS refresh remains out of scope until
  a future fixture-backed spec defines explicit port contracts. Ignore-rule
  diagnostics intentionally keep one `gitignore` skip category for root
  `.gitignore` and `.aiignore` unless a later contract splits the response
  vocabulary.

### 2026-07-04 - 028-dev-cli-workflow-tools

- **Spec:** docs/specs/028-dev-cli-workflow-tools
- **Title:** Developer CLI workflow tools
- **Final spec commit:** e4a5bd7
- **Closure cleanup commit:** b1ae411
- **Closure action:** removed
- **Durable docs updated:**
  - `tools/README.md`
  - `tools/devcli/README.md`
  - `docs/runbooks/install-agent-workbench.md`
  - `docs/runbooks/codex-agent-workbench-plugin.md`
  - `docs/reference/documentation-map.md`
  - `docs/history/spec-closure-log.md`
  - `docs/history/spec-archive-index.md`
- **Verification summary:** Spec implementation validation recorded
  `pnpm test:devcli`, `awb package check`, `awb spec lint
  docs/specs/028-dev-cli-workflow-tools`, `pnpm run validate:plugin`,
  `git diff --check`, `pnpm typecheck`, `pnpm test`, and live
  `awb mcp smoke --repo . --timeout 30` outside the managed sandbox. Closure
  cleanup reran `git diff --check`, lifecycle lint, and closure-check before
  removal.
- **Residual risks:** CI does not yet run `pnpm test:devcli`; the local command
  is documented and intentionally avoids user-local Codex, Docker, GitHub, npm
  credential, and plugin-cache dependencies.

### 2026-07-04 - 029-repo-root-authority

- **Spec:** docs/specs/029-repo-root-authority
- **Title:** Repo-root authority
- **Final spec commit:** 5a8b098
- **Closure cleanup commit:** 605f542
- **Closure action:** removed
- **Durable docs updated:**
  - `docs/reference/workspace-safety-contract.md`
  - `docs/design/mcp-surface-design.md`
  - `docs/reference/runtime-contracts.md`
  - `docs/security/threat-model.md`
  - `docs/reference/documentation-map.md`
  - `docs/history/spec-closure-log.md`
  - `docs/history/spec-archive-index.md`
- **Verification summary:** Spec implementation validation recorded
  `pnpm typecheck`, focused MCP/contract Vitest slice, full `pnpm test`, and
  `git diff --check`. Closure cleanup reran `git diff --check`,
  `pnpm typecheck`, and lifecycle lint before removal.
- **Residual risks:** No known residual implementation risk. Debug root
  override remains maintainer-only through
  `AGENT_WORKBENCH_DEBUG_REPO_ROOT_OVERRIDE=1`; it is not public multi-repo
  runtime support.

### 2026-07-04 - 030-mcp-error-envelope-consistency

- **Spec:** docs/specs/030-mcp-error-envelope-consistency
- **Title:** MCP error envelope consistency
- **Final spec commit:** 8e66d18
- **Closure cleanup commit:** cddec92
- **Closure action:** removed
- **Durable docs updated:**
  - `docs/reference/runtime-contracts.md`
  - `docs/design/mcp-surface-design.md`
  - `docs/reference/documentation-map.md`
  - `docs/backlog/README.md`
  - `docs/history/spec-closure-log.md`
  - `docs/history/spec-archive-index.md`
- **Verification summary:** Spec implementation validation recorded
  `pnpm typecheck`, focused MCP error-envelope tests, broader MCP tool tests,
  full `pnpm test` with 68 files and 494 tests, `pnpm run validate:plugin`,
  `git diff --check`, lifecycle lint, active spec scan, and closure-check.
  Closure cleanup reran lifecycle closure-check before removal and will rerun
  archive validation after cleanup.
- **Residual risks:** Non-representative tools and resources keep their current
  handlers until a later wrapper expansion selects them. The closed slice
  covers representative read-only, planning, graph-backed, docs, and
  workspace-write tools.

### 2026-07-05 - 031-shared-path-policy

- **Spec:** docs/specs/031-shared-path-policy
- **Title:** Shared path policy
- **Final spec commit:** 686270d
- **Closure cleanup commit:** 93e61b5
- **Closure action:** removed
- **Durable docs updated:**
  - `docs/reference/workspace-safety-contract.md`
  - `docs/security/threat-model.md`
  - `docs/backlog/README.md`
  - `docs/history/spec-closure-log.md`
  - `docs/history/spec-archive-index.md`
- **Verification summary:** Spec implementation validation recorded focused
  path-policy, workspace safety, scanner, docs, hook, edit, and MCP validation
  tests; `pnpm typecheck`; `pnpm run validate:plugin`; full `pnpm test`;
  lifecycle lint; active-spec scan; `git diff --check`; closure-check; and
  closure-risk review with low risk and no findings before removal.
- **Residual risks:** Hook feedback intentionally mirrors the shared policy
  table because the packaged hook is plain JavaScript; drift tests cover that
  vocabulary. Broader generated-file source-of-truth inference remains routed to
  EB033.

### 2026-07-05 - 032-per-repo-runtime-daemon-cache

- **Spec:** docs/specs/032-per-repo-runtime-daemon-cache
- **Title:** Per-repo runtime daemon and shared cache
- **Final spec commit:** 878392f
- **Closure cleanup commit:** 668e21a
- **Closure action:** removed
- **Durable docs updated:**
  - `docs/design/runtime-operations-design.md`
  - `docs/design/graph-store-design.md`
  - `docs/design/mcp-surface-design.md`
  - `docs/reference/runtime-contracts.md`
  - `docs/backlog/README.md`
  - `docs/history/spec-closure-log.md`
  - `docs/history/spec-archive-index.md`
- **Verification summary:** Spec implementation validation recorded
  `pnpm typecheck`, focused daemon launcher tests, daemon entrypoint
  integration tests, stdio/resource regression tests, docs metadata tests,
  full `pnpm test`, real package-entrypoint MCP smoke, two-client dogfood
  sweep, and `git diff --check`. Pre-install verification also passed
  `pnpm run validate:plugin`, `pnpm run validate:skills`, `pnpm test:devcli`,
  `awb package check --with-integration`, `awb mcp smoke --repo . --timeout
  30`, installer dry-run, package dry-run, and isolated package install smoke
  with Node 24 `CXXFLAGS=-std=c++20`.
- **Residual risks:** Daemon diagnostics report `graph_freshness: unknown`
  until richer live graph freshness plumbing is added. The debug surface is MCP
  integration health only; no dev CLI doctor command shipped. Installer cleanup
  for stale daemon metadata remains deferred until future evidence requires it.

### 2026-07-07 - 036-index-completeness-and-docs-first-warmup

- **Spec:** docs/specs/036-index-completeness-and-docs-first-warmup
- **Title:** Index completeness and docs-first warmup
- **Final spec commit:** 6240281
- **Closure cleanup commit:** 2c0f59be1ba5
- **Closure action:** removed
- **Durable docs updated:**
  - `docs/design/runtime-operations-design.md`
  - `docs/design/graph-store-design.md`
  - `docs/design/mcp-surface-design.md`
  - `docs/reference/runtime-contracts.md`
  - `docs/reference/agent-readable-changelog.md`
  - `docs/backlog/README.md`
  - `docs/history/spec-closure-log.md`
  - `docs/history/spec-archive-index.md`
- **Verification summary:** Spec implementation validation recorded focused
  Vitest runs over `tests/contracts/response-metadata.test.ts`,
  `tests/docs/query-docs.test.ts`, `tests/graph/extraction-pipeline.test.ts`,
  and `tests/mcp/stdio-entrypoint.test.ts`. Docs-first and docs-dedicated
  indexing, partial/truncated warmup coverage metadata, and `docs_search`
  coverage-state exposure were promoted to durable docs.
- **Residual risks:** Persisted graph warmup completion executor remains future
  work under EB014 (`docs/backlog/README.md`); non-complete graph coverage is
  reported explicitly rather than as complete.

### 2026-07-10 - 037-first-read-reliability-bounded-tools

- **Spec:** docs/specs/037-first-read-reliability-bounded-tools
- **Title:** First-read reliability and bounded tools requirements
- **Final spec commit:** 9557470
- **Closure cleanup commit:** f4d8d60
- **Closure action:** removed
- **Durable docs updated:**
  - `docs/reference/runtime-contracts.md`
  - `docs/design/runtime-operations-design.md`
  - `docs/design/mcp-surface-design.md`
  - `docs/design/graph-store-design.md`
  - `docs/backlog/README.md`
  - `docs/history/spec-closure-log.md`
  - `docs/history/spec-archive-index.md`
- **Verification summary:** Spec implementation validation recorded focused
  Vitest runs over first-read status, scope, overview, context, docs,
  diagnostics, verification-plan, and response-metadata behavior; docs metadata
  validation; `pnpm run typecheck`; full `pnpm run test`; `git diff --check`;
  lifecycle lint; task-state audit; and closure check with no blockers.
- **Residual risks:** Persisted graph completion beyond the first-pass graph
  budget remains future work under EB014 (`docs/backlog/README.md`).
  Telemetry and reporting evidence remains future work under EB009.

### 2026-07-12 - 038-agent-workbench-adoption-flow

- **Spec:** docs/specs/038-agent-workbench-adoption-flow
- **Title:** Agent Workbench adoption flow requirements
- **Final spec commit:** c19ad81
- **Closure cleanup commit:** 7401e9b
- **Closure action:** removed
- **Durable docs updated:**
  - `docs/design/coding-agent-integration-design.md`
  - `docs/design/mcp-surface-design.md`
  - `docs/design/edit-and-validation-loop-design.md`
  - `docs/reference/runtime-contracts.md`
  - `docs/backlog/README.md`
  - `docs/history/spec-closure-log.md`
  - `docs/history/spec-archive-index.md`
- **Verification summary:** Plugin validation, typecheck, 75 focused tests, 33
  intent/context tests, the full 597-test suite, lifecycle lint, task-state
  audit, Markdown checks, and closure check passed.
- **Residual risks:** Provider-history samples remain observational and small;
  a later bounded history replay should report coverage limits rather than infer
  effectiveness from invocation counts.

## Closure Notes

The packages remain available through Git history at the final pre-removal tree
commit. New implementation work should use active packages under `docs/specs/`,
durable docs, or backlog items instead of restoring removed packages unless a
historical audit explicitly needs the original scaffolding.

## Entries

### 2026-07-19 - 040-provider-aware-integration-health

- **Spec:** `docs/specs/040-provider-aware-integration-health/`
- **Title:** Provider-aware integration health requirements
- **Final spec commit:** `6430fda`
- **Closure cleanup commit:** `5d460ac`
- **Closure action:** removed
- **Durable docs updated:**
  - `docs/design/coding-agent-integration-design.md`
  - `docs/reference/runtime-contracts.md`
  - `docs/design/mcp-surface-design.md`
  - `docs/backlog/README.md`
  - `docs/runbooks/codex-agent-workbench-plugin.md`
  - `plugins/agent-workbench/README.md`
  - `plugins/agent-workbench/kiro-power/POWER.md`
  - `plugins/agent-workbench/kiro-power/README.md`
  - `docs/reference/agent-readable-changelog.md`
- **Verification summary:** Typecheck, plugin and skill validation, a 236-entry
  package dry-run, focused 45/65/27-test slices, the full 80-file/623-test
  suite, lifecycle lint, task-state audit, independent review, and diff checks
  passed.
- **Residual risks:**
  - none
- **Follow-up:** none

### 2026-07-19 - 039-snapshot-path-validity

- **Spec:** `docs/specs/039-snapshot-path-validity/`
- **Title:** Snapshot path validity requirements
- **Final spec commit:** `9f620de`
- **Closure cleanup commit:** `a6919da`
- **Closure action:** removed
- **Durable docs updated:**
  - `docs/design/graph-store-design.md`
  - `docs/design/runtime-operations-design.md`
  - `docs/design/mcp-surface-design.md`
  - `docs/reference/runtime-contracts.md`
  - `docs/backlog/README.md`
  - `docs/reference/agent-readable-changelog.md`
  - `docs/history/spec-closure-log.md`
  - `docs/history/spec-archive-index.md`
- **Verification summary:** Typecheck, plugin validation, nine focused files / 109
  tests, the full 80-file / 610-test suite, lifecycle lint, task-state audit,
  archive-index validation, and diff hygiene passed.
- **Residual risks:**
  - Valid-receipt caching remains prohibited until a material generation can
    detect deletions that predate watcher observation.
- **Follow-up:** none
