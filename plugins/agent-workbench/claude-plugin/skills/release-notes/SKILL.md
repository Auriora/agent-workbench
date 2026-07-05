---
name: release-notes
description: Generate and refine consumer-readable Agent Workbench release notes from Git evidence. Use when Codex needs to create, review, or update docs/release-notes/vX.Y.Z.md, prepare notes for a GitHub release, or run the awb release notes workflow before tagging a release.
---

# Release Notes

## Overview

Use this skill to turn local Git history into reviewed release notes for Agent
Workbench. The `awb release notes` command gathers evidence; an LLM-backed agent
must refine that evidence into the standard open source release-note format used
by `docs/release-notes/v0.4.0.md`.

## Workflow

1. Identify the target release version and previous stable release tag.
   Prefer `package.json#/version` for the target version unless the user gives a
   version explicitly. Prefer the previous reachable stable `vX.Y.Z` tag for
   `--from`.

2. Generate evidence and a draft:

```bash
awb release notes \
  --from vPREVIOUS \
  --to HEAD \
  --version X.Y.Z \
  --output docs/release-notes/vX.Y.Z-draft.md \
  --evidence-output docs/release-notes/vX.Y.Z-evidence.json \
  --agent-instructions docs/release-notes/vX.Y.Z-agent.md
```

3. Read the generated agent instructions and JSON evidence before editing final
   notes. Treat the evidence as source material, not final prose.

4. Write the reviewed note to `docs/release-notes/vX.Y.Z.md`. Do not keep the
   draft, evidence, or agent instruction files unless the user explicitly asks to
   preserve them.

5. Run the relevant validation after editing release notes. At minimum, check
   `git diff --check`; for release process changes also run `pnpm test:devcli`
   and `pnpm run validate:skills`.

## Release Note Format

Use this structure unless the existing release-note file for the version already
establishes a better one:

```markdown
---
title: Agent Workbench vX.Y.Z release notes
doc_type: release-notes
status: published
owner: platform
last_reviewed: YYYY-MM-DD
---

# Agent Workbench vX.Y.Z

## Highlights

- Summarize the release by user-visible outcomes.

## Added

- List new capabilities, commands, workflows, or packaged surfaces.

## Changed

- List behavioral, process, packaging, or documentation changes.

## Fixed

- List bug fixes and corrected contracts.

## Documentation

- List durable documentation and lifecycle updates.

## Validation

- List validation that actually ran or durable validation coverage added.

## Known Issues

- List remaining limitations, uncertainty, or follow-up work.
```

## Writing Rules

- Group by consumer impact rather than by commit.
- Do not paste the git log or summarize every commit line.
- Do not claim validation unless it appears in evidence or was run in the current
  session.
- Keep low-confidence items in `Known Issues` or omit them rather than guessing.
- Mention upgrade, install, packaging, CLI, MCP, plugin, compatibility, and
  validation impacts when the evidence supports them.
- Preserve concrete command and path names where they help users act.
