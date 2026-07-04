---
title: Agent Skills standard compliance requirements
doc_type: spec
artifact_type: requirements
status: active
owner: platform
last_reviewed: 2026-06-07
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Requirements

## Introduction

Agent Workbench now packages skills through Codex plugins and also depends on
local skills such as Brooks-Lint during repository review. The open Agent
Skills standard at <https://agentskills.io/> defines a portable `SKILL.md`
format with naming, metadata, directory, and progressive-disclosure guidance.
This spec records the compliance target and follow-up work needed to keep owned
skills portable without taking responsibility for third-party cached skills.

## Durable Source Baseline

- [Codex Agent Workbench plugin and MCP setup](../../runbooks/codex-agent-workbench-plugin.md)
- [Coding agent integration design](../../design/coding-agent-integration-design.md)
- [Agent IDE system architecture](../../architecture/system-architecture.md)
- [Documentation map](../../reference/documentation-map.md)

## External Reference Baseline

- Agent Skills overview: <https://agentskills.io/home>
- Agent Skills specification: <https://agentskills.io/specification>
- Agent Skills best practices: <https://agentskills.io/skill-creation/best-practices>

## Current Findings

- Core `SKILL.md` frontmatter compliance passed across sampled local and cached
  skills: required `name` and `description` fields were present, names matched
  parent directories, and descriptions stayed within the 1024-character limit.
- The owned checked-in `plugins/agent-workbench/skills/agent-workbench/SKILL.md`
  follows the core format and is short enough for progressive disclosure.
- Brooks-Lint skills use `../_shared/...` references outside each individual
  skill root. That works in this Codex installation but is less portable under
  the Agent Skills file-reference guidance.
- Some third-party cached skills exceed the recommended 500-line `SKILL.md`
  limit. Those are external observations, not Agent Workbench remediation
  targets.

## Goals

- Define the repository's standard for Agent Skills compatibility.
- Validate checked-in owned skills and plugin-packaged skills automatically.
- Keep owned `SKILL.md` files small and progressively disclosed.
- Record explicit exceptions for third-party cached skills and Codex-local
  compatibility behavior.
- Decide whether Brooks-Lint should remain a local skill set, be repackaged as
  a plugin, or be restructured for strict Agent Skills portability.

## Non-Goals

- Do not modify third-party cached plugin skills.
- Do not rewrite curated OpenAI or external marketplace skills.
- Do not change Agent Workbench MCP behavior.
- Do not duplicate large shared reference content into multiple skills without
  a portability decision.
- Do not make plugin hooks repair or install skills automatically.

## Requirements

### Requirement 1: Compliance Target Decision

**User Story:** As a maintainer, I want a clear Agent Skills compatibility
target, so that skill packaging changes are judged against a documented rule.

#### Acceptance Criteria

1. GIVEN the Agent Skills specification, WHEN maintainers inspect the repo,
   THEN the selected compliance target SHALL be documented as either strict
   portable Agent Skills, Codex-plugin-local compatibility, or a staged hybrid.
2. IF the target allows Codex-local behavior, THEN the exception SHALL identify
   which behavior is non-portable and why it is acceptable.
3. WHEN the target changes, THEN validation tasks and durable docs SHALL be
   updated in the same change.

### Requirement 2: Owned Skill Validation

**User Story:** As a plugin maintainer, I want owned skills validated against
the standard, so that packaging drift is caught before release.

#### Acceptance Criteria

1. GIVEN checked-in owned skills, WHEN validation runs, THEN every `SKILL.md`
   SHALL have valid YAML frontmatter with required `name` and `description`.
2. WHEN validation runs, THEN each skill name SHALL match the parent directory,
   use lowercase alphanumeric or hyphen characters, avoid consecutive hyphens,
   and stay within the standard length limit.
3. WHEN validation runs, THEN descriptions SHALL be non-empty and no more than
   1024 characters.
4. WHEN a checked-in owned `SKILL.md` exceeds the recommended size, THEN
   validation SHALL warn or fail according to the selected compliance target.

### Requirement 3: Progressive Disclosure

**User Story:** As an agent user, I want skills to load only necessary context,
so that activated skills do not crowd out repository evidence.

#### Acceptance Criteria

1. GIVEN an owned skill with detailed reference material, WHEN the skill is
   packaged, THEN detailed material SHALL live in `references/`, `scripts/`, or
   `assets/` and be loaded only when needed.
2. WHEN `SKILL.md` references companion files, THEN references SHALL be relative
   to the skill root unless an explicit non-portable exception exists.
3. IF a skill uses shared references outside its root, THEN the spec SHALL
   record whether to restructure, package as a plugin bundle, or retain the
   Codex-local layout.

### Requirement 4: Third-Party Skill Boundary

**User Story:** As a maintainer, I want external cached skill issues separated
from owned work, so that local validation does not fail on artifacts we do not
control.

#### Acceptance Criteria

1. GIVEN a validation scan, WHEN third-party cached skills are discovered, THEN
   their issues SHALL be reported as observations, not owned failures.
2. IF a third-party skill issue affects Agent Workbench usage, THEN the issue
   SHALL be routed to documentation or upstream feedback rather than local
   mutation of the cache.
3. WHEN owned validation runs in CI, THEN it SHALL target repository-owned
   skill paths, not user cache paths.

## Correctness Properties

- Every checked-in owned skill has exactly one parent-directory-matching name.
- Every checked-in owned skill has a non-empty description within the standard
  limit.
- Validation does not mutate user-level Codex caches.
- Third-party cache observations cannot fail repository CI.
- Any non-portable reference pattern has a documented exception or remediation
  task.

## Success Criteria

- The compliance target is documented.
- A validation script or test covers owned skills.
- Owned skills pass validation.
- Brooks-Lint portability is either remediated or explicitly tracked with a
  decision.
- Durable plugin/runbook docs explain the chosen skill compatibility model.
