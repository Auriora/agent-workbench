---
title: Plugin discoverability and drift hardening verification
doc_type: spec
artifact_type: verification
status: active
owner: platform
last_reviewed: 2026-06-13
---

# Verification

## Quality Gates

- `pnpm typecheck`
- Focused plugin/discoverability Vitest tests.
- Plugin validation for `plugins/agent-workbench`.
- `scripts/install-agent-workbench-package.sh --dry-run`
- Package manifest consistency check.
- `pnpm test`
- `git diff --check`
- Spec lifecycle validation.

## Validation Plan

1. Validate plugin manifest and required companion files.
2. Validate marketplace metadata or documented marketplace decision.
3. Validate MCP server-card metadata against actual registry surfaces.
4. Validate skill, default prompts, integration profile, and docs do not claim
   stale MCP surfaces or obsolete install behavior.
5. Validate installer dry-run does not mutate local config and advertises
   plugin-owned install steps.
6. Validate CI workflow steps can run in a clean checkout.
7. Validate durable docs describe install, verify, update, uninstall, hook
   trust, discoverability metadata, and CI gates.

## Evidence Log

2026-06-06:
Reviewed Alcove and Codebase Recon plugin patterns. Candidate improvements were
identified for marketplace metadata, server-card metadata, drift tests,
README/runbook guidance, CI, and the history-recon decision.

2026-06-06:
Spec created. Implementation was pending.

2026-06-13:
Phase 1 metadata implementation added repo marketplace metadata, an MCP server
card, registry drift tests, and documented external-reference decisions.

2026-06-13:
`pnpm exec vitest run tests/integration/codex-integration-profile.test.ts`
passed: 1 file, 13 tests.

2026-06-13:
`pnpm typecheck` passed.

2026-06-13:
`git diff --check` passed.

2026-06-13:
Spec lifecycle lint passed with zero diagnostics.

2026-06-13:
Agent Workbench Markdown set check passed for the changed runbook and Spec 024
documents with zero findings.

2026-06-13:
`scripts/install-agent-workbench-package.sh --dry-run --skip-codex-config`
passed.

2026-06-13:
`codex plugin list` passed; `agent-workbench@auriora-local` is installed and
enabled.

2026-06-13:
The local plugin-creator skill no longer ships `validate_plugin.py`, so the
old runbook validator command was not run. Phase 1 metadata is covered by
repo-owned integration tests.

2026-06-13:
Phase 2 drift implementation added checks for integration-profile MCP binding
sync, plugin default prompt mappings, skill stale-name and obsolete-install
wording, durable documented MCP names, and `.mcp.json` launcher ownership.
`pnpm exec vitest run tests/integration/codex-integration-profile.test.ts`
passed: 1 file, 17 tests.

2026-06-13:
Phase 2 operator documentation updated the plugin README quick start, runbook
first-run verification, troubleshooting, hook trust, missing launcher recovery,
and the documentation map entries for plugin quick start and MCP server-card
metadata.

2026-06-13:
`pnpm typecheck` passed.

2026-06-13:
Spec lifecycle lint passed with zero diagnostics.

2026-06-13:
Agent Workbench Markdown checks passed with zero findings for the changed
runbook, Spec 024 task, traceability, and verification docs. The plugin README
Markdown check passed with zero findings after adding repository-standard
frontmatter.

2026-06-13:
`git diff --check` passed.

2026-06-13:
`pnpm test` timed out in the sandbox for two spawned stdio entrypoint tests.
The targeted stdio entrypoint suite passed outside the sandbox: 1 file, 12
tests. The full `pnpm test` suite then passed outside the sandbox: 62 files,
432 tests.

2026-06-13:
Phase 3 added `.github/workflows/ci.yml`, the repo-owned
`scripts/validate-agent-workbench-plugin.mjs` validator, `validate:plugin`,
and focused integration-test assertions for the CI/package validation contract.

2026-06-13:
`pnpm run validate:plugin` passed. The validator checked the Codex plugin
manifest, `.mcp.json`, hooks, skill, repo marketplace metadata, MCP server
card, package manifest dependency lists, and package component paths without
reading user-local Codex config.

2026-06-13:
`scripts/install-agent-workbench-package.sh --dry-run --skip-codex-config`
passed.

2026-06-13:
`pnpm pack:dry-run` passed and produced a dry-run npm package file list.

2026-06-13:
`pnpm typecheck` passed.

2026-06-13:
`pnpm exec vitest run tests/integration/codex-integration-profile.test.ts`
passed: 1 file, 17 tests.

2026-06-13:
Full `pnpm test` passed outside the managed sandbox: 62 files, 432 tests.

2026-06-13:
`git diff --check` passed.

2026-06-13:
Spec lifecycle lint passed with zero diagnostics.

2026-06-13:
Agent Workbench Markdown checks passed with zero findings for changed durable
and spec docs.

## Durable Promotion Map

- Plugin discoverability, first-run, update, uninstall, hook trust, missing
  launcher recovery, validation, and CI behavior are promoted to
  `plugins/agent-workbench/README.md` and
  `docs/runbooks/codex-agent-workbench-plugin.md`.
- Documentation ownership for the runbook, server card, and CI workflow is
  promoted to `docs/reference/documentation-map.md`.
- Machine-readable marketplace and MCP server-card metadata are durable in
  `.agents/plugins/marketplace.json` and `.well-known/mcp/server-card.json`.
- CI/package validation behavior is durable in `.github/workflows/ci.yml`,
  `scripts/validate-agent-workbench-plugin.mjs`, `package.json`, and focused
  integration tests.

## Closure Readiness

Spec 024 is ready for final pre-removal commit and active package removal.
Closure action should be `removed` after the final spec commit is recorded in
`docs/history/spec-closure-log.md` and `docs/history/spec-archive-index.md`.

Follow-up work:

- Package manifest consistency remains covered by the repo-owned validator and
  integration tests; no separate follow-up spec is required.
- Dependency audit or SBOM generation was intentionally not added. It remains a
  future bounded CI enhancement if repository/package dependency audit policy
  is defined.

## Residual Risks

- MCP server-card conventions may vary across directories; a too-specific
  schema could create maintenance churn.
- Marketplace metadata could conflict with local package installer behavior if
  the source path is misunderstood.
- String-based skill drift tests can become brittle; generated metadata checks
  may be more durable.
- History reconnaissance remains intentionally deferred to a future debug
  command or skill workflow outside this spec.
