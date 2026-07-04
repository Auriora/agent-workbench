---
title: Agent Skills standard compliance verification
doc_type: spec
artifact_type: verification
status: active
owner: platform
last_reviewed: 2026-06-07
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Verification

## Validation Plan

This spec starts as a documentation and validation-planning package. Creating
the package requires spec lifecycle lint. Implementation will require a
repo-owned skill validation command or test and targeted documentation checks.

## Quality Gates

- Spec lifecycle lint passes for this package.
- Owned skill validation passes for checked-in skill paths.
- Validation does not scan or mutate user-level cache paths in CI.
- Documentation identifies the selected compatibility model.
- Brooks-Lint portability is resolved or routed to explicit follow-up work.

## Evidence Log

- 2026-06-07: `research.md` records the agentskills.io overview,
  specification, and best-practices requirements used by this spec.
- 2026-06-07: `research.md` records a local audit snapshot with 72 discovered
  skill files, no core frontmatter/name/description problems, and two
  over-500-line third-party cached skills.
- 2026-07-04: `pnpm run validate:skills` passed for the three
  repository-owned packaged Agent Workbench skills with 0 errors and 0
  warnings.
- 2026-07-04: `pnpm exec vitest run
  tests/integration/agent-skills-validation.test.ts` passed, covering valid
  owned skill validation and actionable failure output for invalid frontmatter
  and non-portable references.
- 2026-07-04: `pnpm run validate:skills -- --advisory-cache --json` passed with
  78 advisory warnings, 0 errors, and no user cache mutation.
- 2026-07-04: `pnpm typecheck` passed after adding the validator integration
  test.
- 2026-07-04: `pnpm run validate:plugin` passed after skill validation changes.
- 2026-07-04: `pnpm test` passed the full Vitest suite: 67 files and 488 tests.
- 2026-07-04: `git diff --check` passed, and `spec_runtime.py lint
  docs/specs/026-agent-skills-standard-compliance` reported 0 diagnostics.

## Required Gates For Implementation

### Skill Validation

- Run the selected owned-skill validator.
- If implemented as Vitest, run the targeted test file.
- If integrated into package scripts, run the package script and `pnpm
  typecheck` if TypeScript code is added.

### Documentation

- Manually verify links to Agent Skills references.
- Check that docs distinguish owned skills from user cache observations.
- Update the documentation map if new durable docs or scripts are added.

## Residual Risks

- The Agent Skills standard may evolve; validation should avoid hardcoding
  advisory guidance as a permanent failure without a documented target.
- Brooks-Lint may remain useful in Codex-local form even if not strictly
  portable. Treat portability as a packaging decision, not a reason to break
  current workflows.
- Advisory cache mode can report warnings for old installed plugin caches until
  the user refreshes those plugins. Those warnings are intentionally
  observation-only and do not fail CI.
