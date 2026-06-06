---
title: Plugin discoverability and drift hardening verification
doc_type: spec
artifact_type: verification
status: active
owner: platform
last_reviewed: 2026-06-06
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

| Date | Activity | Result |
| --- | --- | --- |
| 2026-06-06 | Reviewed Alcove and Codebase Recon plugin patterns | Candidate improvements identified for marketplace metadata, server-card metadata, drift tests, README/runbook guidance, CI, and history recon decision. |
| 2026-06-06 | Spec created | Pending implementation. |

## Residual Risks

- Codex plugin validation tooling may not be available in GitHub Actions unless
  a repo-owned validation script is added.
- MCP server-card conventions may vary across directories; a too-specific
  schema could create maintenance churn.
- Marketplace metadata could conflict with local package installer behavior if
  the source path is misunderstood.
- String-based skill drift tests can become brittle; generated metadata checks
  may be more durable.
- History reconnaissance may require command execution policy decisions that
  exceed this spec's intended plugin/discoverability scope.
