---
title: Agent Skills standard compliance design
doc_type: spec
artifact_type: design
status: active
owner: platform
last_reviewed: 2026-06-07
---

# Design

## Overview

This spec adds a lightweight validation and documentation layer for Agent
Skills compatibility. The implementation should focus on repository-owned
skills first, then record portability decisions for adjacent local skills such
as Brooks-Lint without mutating third-party caches.

## High-Level Design

The work has three parts:

- compliance decision: define how strictly Agent Workbench follows the open
  Agent Skills standard
- validation: add a repo-owned check for checked-in skills
- documentation: update plugin/runbook guidance with the compatibility model

### Validation Scope

Owned paths:

- `plugins/agent-workbench/skills/**/SKILL.md`
- any future checked-in skill paths under this repository

Observed but not owned:

- `~/.codex/skills/**/SKILL.md`
- `~/.codex/plugins/cache/**/SKILL.md`
- curated or marketplace plugin caches

### Compliance Levels

The design should choose one level during implementation:

- `strict`: all owned skills follow the Agent Skills specification and
  recommended portability guidance, including skill-root-relative references.
- `codex-local`: owned skills satisfy core `SKILL.md` structure, but Codex
  plugin packaging can provide additional local behavior.
- `hybrid`: checked-in Agent Workbench skills are strict, while Brooks-Lint
  remains a documented Codex-local skill set until repackaged.

The recommended starting point is `hybrid`: keep Agent Workbench's checked-in
plugin skill strict, document Brooks-Lint as local/non-owned unless it is moved
into this repository, and add validation that only gates owned paths.

## Low-Level Design

### Validator

Add a small script or Vitest test that:

- discovers owned `SKILL.md` files
- parses YAML frontmatter
- verifies required `name` and `description`
- checks name pattern, length, consecutive hyphens, and parent directory match
- checks description length
- reports line count over the selected threshold
- optionally warns on non-root-relative references depending on compliance
  target

The validator should not scan or mutate user-level cache paths during CI.

### Documentation

Update durable docs to explain:

- which skill paths are owned by Agent Workbench
- the selected compliance level
- how to run the validator
- why third-party cached skills are observations only
- how Brooks-Lint portability is being handled

Likely targets:

- `docs/runbooks/codex-agent-workbench-plugin.md`
- `docs/reference/documentation-map.md`
- `plugins/agent-workbench/README.md`

### Brooks-Lint Portability Decision

Brooks-Lint currently lives outside this repository under the user's Codex
skills directory. It should not be changed as part of Agent Workbench plugin
validation unless the user explicitly promotes it into this repository or a
plugin. The spec should record one of these outcomes:

- leave as local Codex skill set with documented non-portable shared references
- package as a plugin with shared references inside the plugin bundle
- duplicate or vendor shared references under each skill root

The likely best fit is plugin packaging with shared references inside the
plugin bundle, because it avoids duplication while keeping references
portable within the distributed artifact.

## Operational Considerations

- CI should validate only checked-in paths.
- Local audit commands may optionally inspect user caches, but their output
  should be advisory.
- Validation should fail with clear file paths and rule names.
- Do not add installation or repair behavior to hooks.

## Open Questions

- Should Agent Workbench maintain a generic skill validator script, or should
  the check be embedded as a Vitest integration test?
- Should Brooks-Lint be packaged as an Agent Workbench-adjacent plugin or kept
  as a separate user-level skill collection?
