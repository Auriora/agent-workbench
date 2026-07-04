---
title: Agent Skills standard compliance design
doc_type: spec
artifact_type: design
status: active
owner: platform
last_reviewed: 2026-06-07
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
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

This spec adopts one of the following levels:

- `strict`: all owned skills follow the Agent Skills specification and
  recommended portability guidance, including skill-root-relative references.
- `codex-local`: owned skills satisfy core `SKILL.md` structure, but Codex
  plugin packaging can provide additional local behavior.
- `hybrid`: checked-in Agent Workbench skills are strict, while Brooks-Lint
  remains a documented Codex-local skill set until repackaged.

**Decision:** Agent Workbench targets `hybrid`. Checked-in skills under
`plugins/agent-workbench/skills/**/SKILL.md` (and any future checked-in skill
path) are held to the `strict` Agent Skills specification. Brooks-Lint and any
other skill set that is not checked into this repository stay Codex-local and
are exempt from strict portability until explicitly promoted into this
repository. Its `../_shared/...` cross-root references are a documented,
accepted non-portability exception: they are convenient for a single local
Codex installation and are not currently distributed, so restructuring them
now has no payoff. Validation added in T002/T003 only gates owned paths.

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
skills directory. It is not changed as part of Agent Workbench plugin
validation.

**Decision:** leave Brooks-Lint as a local, non-owned Codex skill set with its
existing `../_shared/...` references documented as a non-portable exception
(see Compliance Levels above). If Brooks-Lint is later promoted into this
repository or a plugin, the pre-recorded follow-up is to package it as a
plugin with shared references kept inside the plugin bundle, rather than
duplicating or vendoring shared content under each skill root — that avoids
duplication while keeping references portable within the distributed
artifact. No restructuring happens until that promotion decision is made
explicitly in a follow-up task or spec.

## Operational Considerations

- CI should validate only checked-in paths.
- Local audit commands may optionally inspect user caches, but their output
  should be advisory.
- Validation should fail with clear file paths and rule names.
- Do not add installation or repair behavior to hooks.

## Open Questions

- Should Agent Workbench maintain a generic skill validator script, or should
  the check be embedded as a Vitest integration test?
