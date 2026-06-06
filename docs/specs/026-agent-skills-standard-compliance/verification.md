---
title: Agent Skills standard compliance verification
doc_type: spec
artifact_type: verification
status: active
owner: platform
last_reviewed: 2026-06-07
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

| Date | Command | Result | Notes |
| --- | --- | --- | --- |
| 2026-06-07 | Local standard comparison | Completed | Compared installed/local skill shape against agentskills.io overview, specification, and best-practices pages. |
| 2026-06-07 | Local `SKILL.md` audit | Completed | Found 72 skill files, no core frontmatter/name/description problems, and two over-500-line third-party cached skills. |

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
