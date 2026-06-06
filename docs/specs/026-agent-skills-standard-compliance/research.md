---
title: Agent Skills standard compliance research
doc_type: spec
artifact_type: research
status: active
owner: platform
last_reviewed: 2026-06-07
---

# Research

## External Standard Summary

Sources reviewed on 2026-06-07:

- <https://agentskills.io/home>
- <https://agentskills.io/specification>
- <https://agentskills.io/skill-creation/best-practices>

Key requirements and guidance:

- A skill is a directory containing `SKILL.md`.
- `SKILL.md` must contain YAML frontmatter followed by Markdown body content.
- Required frontmatter fields are `name` and `description`.
- `name` must be 1-64 characters, lowercase alphanumeric plus hyphens, not
  start or end with a hyphen, avoid consecutive hyphens, and match the parent
  directory.
- `description` must be non-empty, no more than 1024 characters, and describe
  what the skill does and when to use it.
- Optional fields include `license`, `compatibility`, `metadata`, and
  experimental `allowed-tools`.
- Optional directories include `scripts/`, `references/`, and `assets/`.
- Progressive disclosure is expected: discovery loads metadata, activation
  loads `SKILL.md`, and references/scripts/assets load only when needed.
- `SKILL.md` should generally stay below 500 lines or 5000 tokens.
- File references should be relative from the skill root.

## Local Audit Snapshot

Command-style audit on 2026-06-07 found:

- 72 discovered local/cached `SKILL.md` files.
- No missing `name` or `description` frontmatter in the discovered set.
- No name pattern violations in the discovered set.
- No name-vs-parent-directory mismatches in the discovered set.
- No descriptions over 1024 characters in the discovered set.
- Two third-party cached `SKILL.md` files exceeded the recommended 500-line
  size:
  - `figma-code-connect/SKILL.md`: 528 lines
  - `writing-skills/SKILL.md`: 656 lines

## Owned Skill Snapshot

Checked-in owned skill:

- `plugins/agent-workbench/skills/agent-workbench/SKILL.md`

Observed status:

- valid frontmatter
- parent directory matches `name: agent-workbench`
- description is within the standard limit
- body is short and does not require extraction for progressive disclosure

## Portability Concern

Brooks-Lint skills are outside this repository and use shared references such
as `../_shared/common.md`. That is convenient locally, but it is weaker for
strict Agent Skills portability because the referenced file is not inside the
individual skill root. If Brooks-Lint becomes a maintained plugin or repository
artifact, the shared references should move inside a distributable bundle.

## Recommendation

Adopt a hybrid target:

- strict validation for checked-in Agent Workbench skills
- advisory reporting for user-level and third-party cached skills
- separate decision for Brooks-Lint packaging before changing its layout
