---
title: Spec closure log
doc_type: history
status: active
owner: platform
last_reviewed: 2026-07-04
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
| Spec 002: TimeLocker dogfood follow-ups | Removed from `docs/specs/` on 2026-06-06 after follow-up behavior was routed into later cross-repo work. | Documentation map, executable backlog, and cross-repo runtime design/reference docs. |
| Spec 003: Cross-repo trust discovery | Removed from `docs/specs/` on 2026-06-06 after trust, scope, and first-slice routing behavior was promoted. | MCP surface design, runtime operations design, workspace safety contract, language adapter design, and executable backlog. |
| Spec 004: Overview ranking polish | Removed from `docs/specs/` on 2026-06-06 after overview ranking behavior was promoted. | MCP surface design and documentation map. |
| Spec 005: .NET repository shape hardening | Removed from `docs/specs/` on 2026-06-06 after generated-output and validation-planning behavior was promoted. | Language adapter design, MCP surface design, runtime operations design, and language capability matrix. |
| Spec 006: Infrastructure template routing | Removed from `docs/specs/` on 2026-06-06 after infrastructure routing behavior was promoted. | Language adapter design, MCP surface design, and executable backlog. |
| Spec 007: Redaction boundary polish | Removed from `docs/specs/` on 2026-06-06 after presentation redaction behavior was promoted. | MCP surface design and workspace safety contract. |
| Spec 008: Lambda result presentation | Removed from `docs/specs/` on 2026-06-06 after Lambda grouping behavior was promoted. | MCP surface design and language adapter design. |
| Spec 009: CMake C++ routing and validation | Removed from `docs/specs/` on 2026-06-06 after CMake/C++ routing behavior was promoted. | Language adapter design, MCP surface design, and language capability matrix. |
| Spec 010: Agent IDE capability analysis | Removed from `docs/specs/` on 2026-06-06 after portable lessons were promoted. | Agent IDE capability analysis reference, executable backlog, and follow-up specs. |
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
| Spec 029: Repo-root authority | Removed from `docs/specs/` on 2026-07-04 after final pre-removal tree commit `5a8b098` completed launch-root authority for public MCP resources and tools, debug-only root override gating, public `repo_root` metadata hiding, integration-health root policy reporting, and durable promotion. | Workspace safety contract, MCP surface design, runtime contracts, threat model, documentation map, root-authority policy and MCP registry tests, response metadata tests, integration-health tests, focused MCP/contract validation, and final full Vitest validation. |
| Spec 033: Cross-platform packaging | Removed from `docs/specs/` on 2026-07-04 after final pre-removal tree commit `0d2cc48` completed shell-free npm package install, Codex/Claude MCP launch shims, shell-free hook entry points, package-scoped marketplaces, supported platform matrix documentation, and routed macOS/Windows runner evidence. | Codex Agent Workbench plugin runbook, packaging README, plugin README, cross-platform packaging workflow, install/MCP/hook smoke scripts, Codex/Claude package metadata tests, backlog follow-ups for Kiro launcher and turnkey core `tree-sitter`, documentation map, spec closure log, and archive index. |
| Spec 034: Doc currency routing | Removed from `docs/specs/` on 2026-07-02 after final pre-removal tree commit `8657e9e` completed document currency classification, docs search/inventory metadata, `context_for_task` ranking, `docs_current_for_task`, durable docs promotion, and spec-lifecycle-manager handoff. | MCP surface design, graph store design, runtime contracts, documentation map, spec-lifecycle-manager doc currency handoff, MCP server card, Codex integration profile, docs/context/MCP tests, lifecycle lint, closure check, and closure-risk review. |

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
  - `docs/requirements/agent-workbench-executable-backlog.md`
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
  - `docs/reference/spec-lifecycle-manager-doc-currency-handoff.md`
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
  - `docs/backlog/033-npm-tarball-install-flow.md`
  - `docs/backlog/033-codex-npm-marketplace.md`
  - `docs/backlog/033-turnkey-tree-sitter-core-build.md`
  - `docs/backlog/033-kiro-shell-free-launcher.md`
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

## Closure Notes

The packages remain available through Git history at the final pre-removal tree
commit. New implementation work should use active packages under `docs/specs/`,
durable docs, or backlog items instead of restoring removed packages unless a
historical audit explicitly needs the original scaffolding.
