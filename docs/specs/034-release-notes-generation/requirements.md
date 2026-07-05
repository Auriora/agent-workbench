---
title: Release notes generation requirements
doc_type: spec
artifact_type: requirements
status: active
owner: platform
last_reviewed: 2026-07-05
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Requirements

## Introduction

Agent Workbench now has release preflight, version bumping, and GitHub release
commands. The remaining manual step is authoring consumer-readable release
notes. A useful release note should summarize outcomes across a range of
commits, not mirror each commit line. The workflow needs deterministic evidence
collection from Git history and a clear synthesis contract that can be used by
an LLM-backed agent to refine consumer-facing wording without overstating
unverified work.

## Durable Source Baseline

- [Agent-readable changelog](../../reference/agent-readable-changelog.md)
- [Agent Workbench Dev CLI](../../../tools/devcli/README.md)
- [Codex Agent Workbench plugin runbook](../../runbooks/codex-agent-workbench-plugin.md)
- [Install Agent Workbench runbook](../../runbooks/install-agent-workbench.md)
- [Agent Workbench executable backlog](../../requirements/agent-workbench-executable-backlog.md#eb035-agent-readable-changelog)
- `tools/devcli/src/auriora_dev/commands/release.py`
- `tools/devcli/tests/test_cli.py`

## Goals

- Add a release-notes workflow that builds an evidence packet from a Git range.
- Group changes by consumer impact instead of listing every commit.
- Preserve traceable evidence for generated notes.
- Let release publishing consume the generated notes file.
- Define an LLM-agent synthesis prompt or skill contract that can refine the
  evidence packet into consumer-readable notes and later be used across
  repositories.

## Non-Goals

- Do not make an LLM-only workflow that invents release content without Git
  evidence.
- Do not require the first-pass command to produce final prose without agent or
  human refinement.
- Do not publish releases automatically from release-note generation.
- Do not replace the agent-readable changelog or durable runbooks.
- Do not create a separate Codex plugin until reuse across multiple
  repositories proves the need.
- Do not require GitHub PR access for the first implementation; PR metadata may
  be an optional enrichment.

## Requirements

### Requirement 1: Build Release Evidence From A Git Range

**User Story:** As a maintainer preparing a release, I want tooling to build a
release evidence packet from the changes since the previous release, so that an
LLM-backed agent or human can refine accurate release notes without manually
reviewing every commit.

#### Acceptance Criteria

1. GIVEN a `--from` ref and `--to` ref, WHEN release evidence is generated,
   THEN THE SYSTEM SHALL inspect Git history and changed files in that range.
2. GIVEN no `--to` ref is provided, WHEN release evidence is generated, THEN THE
   SYSTEM SHALL use `HEAD`.
3. GIVEN no `--from` ref is provided, WHEN release evidence is generated, THEN
   THE SYSTEM SHALL identify the latest reachable release tag when possible and
   otherwise return a blocked state naming the missing range.
4. IF the Git range is invalid or empty, THEN THE SYSTEM SHALL report a
   structured failure and SHALL NOT create misleading release notes.
5. THE evidence collection MAY be implemented through `awb`, scripts, or another
   repo-owned command surface, but the resulting evidence format SHALL be usable
   by an LLM-backed agent for refinement.

### Requirement 2: Refine Consumer-Visible Outcomes

**User Story:** As a release consumer, I want notes grouped by user-visible
outcomes, so that I can understand what changed and whether I need to upgrade.

#### Acceptance Criteria

1. WHEN an LLM-backed agent or human refines generated evidence, THEN THE
   workflow SHALL group related commits into release-note entries by impact
   area.
2. WHEN implementation-only churn does not affect users, installation,
   operators, agent workflow, contracts, or validation, THEN THE SYSTEM SHOULD
   omit it or keep it under internal maintenance.
3. WHEN package, install, plugin, command, MCP contract, migration, or
   compatibility behavior changes, THEN THE SYSTEM SHALL call out upgrade or
   operator impact.
4. WHERE validation evidence is available, THE workflow SHALL include
   validation commands or quality gates relevant to release confidence.
5. IF the agent cannot confidently infer consumer impact from evidence, THEN it
   SHALL preserve that uncertainty in a review-needed or known-issues section.

### Requirement 3: Produce A Consumable Release Notes Artifact

**User Story:** As a release manager, I want a Markdown release notes file that
can be passed directly to GitHub release creation, so that publishing remains a
single reliable workflow.

#### Acceptance Criteria

1. WHEN an output path is provided, THEN THE workflow SHALL write Markdown
   release notes to that path.
2. WHEN `awb release github --notes-file <path>` is run, THEN the generated
   release notes SHALL be accepted as the GitHub release notes input.
3. THE release notes SHALL include a title, highlights, grouped changes,
   upgrade notes, validation evidence, and known issues or residual risks when
   present.
4. THE release notes SHALL avoid raw commit spam unless a diagnostic or
   traceability section is explicitly requested.
5. THE workflow SHALL distinguish draft/generated notes from maintainer- or
   agent-reviewed final notes so release publishing does not accidentally use
   unreviewed first-pass prose.

### Requirement 4: Preserve Evidence And Reviewability

**User Story:** As a maintainer reviewing generated notes, I want to see the
evidence behind the summary, so that I can correct omissions before publishing.

#### Acceptance Criteria

1. WHEN notes are generated, THEN THE workflow SHALL preserve a compact
   evidence section or sidecar with range, commits, changed files, tags, and
   grouping rationale.
2. IF optional GitHub PR metadata is unavailable, THEN THE SYSTEM SHALL continue
   with Git evidence and record that PR enrichment was skipped.
3. IF the generator cannot classify important changes, THEN THE SYSTEM SHALL
   add a review-needed section instead of silently dropping them.
4. THE workflow SHALL support dry-run output before writing files.
5. Candidate note entries SHALL preserve a short grouping rationale so reviewers
   can see why commits and file changes were grouped together.

### Requirement 5: Define Reusable LLM-Agent Guidance

**User Story:** As an agent using release tooling in other repositories, I want
portable guidance for turning evidence into notes, so that release-note quality
is consistent without coupling every repo to Agent Workbench internals.

#### Acceptance Criteria

1. THE SYSTEM SHALL define a release-note synthesis prompt or skill contract
   that explains how an LLM-backed agent uses evidence, tone, grouping,
   omissions, upgrade notes, validation, and residual-risk handling.
2. THE first implementation SHALL live in the Agent Workbench repo-local CLI
   and docs unless implementation review chooses a smaller script plus guidance.
3. WHEN at least two other repositories need the workflow, THEN reusable
   guidance SHOULD be extracted into a separate skill.
4. A separate plugin SHALL be deferred until a shared executable CLI/MCP surface
   is needed across repositories.

## Correctness Properties

- **P1 Evidence boundedness:** Generated notes are derived only from the
  requested Git range and explicitly supplied enrichment sources.
- **P2 No commit spam:** Multiple commits can collapse into one outcome entry
  when they implement one consumer-visible change.
- **P3 Upgrade visibility:** Package, install, plugin, command, API, contract,
  and compatibility changes cannot be hidden under internal maintenance.
- **P4 Reviewable uncertainty:** Unclassified or low-confidence changes are
  surfaced for review instead of omitted.
- **P5 Publish compatibility:** The generated Markdown can be passed to
  `awb release github --notes-file`.

## Success Criteria

- A repo-owned command can produce release evidence for
  `--from <tag> --to HEAD`.
- An LLM-backed agent can refine the release evidence into usable Markdown
  release notes.
- Generated notes group changes by release impact and include upgrade,
  validation, and known-issue sections when applicable.
- `awb release github <version> --notes-file <file>` works with the generated
  artifact.
- A reusable release-note authoring prompt or skill contract exists, with a
  documented decision to defer a separate plugin.
