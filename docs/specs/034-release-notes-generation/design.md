---
title: Release notes generation design
doc_type: spec
artifact_type: design
status: active
owner: platform
last_reviewed: 2026-07-05
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Design

## Overview

Add a repo-owned release evidence collector, likely surfaced as
`awb release notes`, plus an LLM-agent synthesis contract for refining that
evidence into consumer-readable release notes. Keep the executable evidence
workflow repo-local for the first implementation. Add reusable synthesis
guidance for agents that review or improve the generated notes.

The workflow is:

```text
git range
  -> collect commits and changed files
  -> classify changed paths by impact area
  -> emit evidence packet and first-pass outline
  -> LLM agent or human refines consumer-readable notes
  -> pass notes file to awb release github --notes-file
```

## High-Level Design

### Components

```text
Release notes CLI
  -> resolves version and Git range
  -> calls ReleaseEvidenceCollector
  -> calls ReleaseImpactClassifier
  -> calls ReleaseOutlineRenderer
  -> writes Markdown and optional JSON evidence

LLM-agent synthesis guidance
  -> consumes the evidence packet and first-pass outline
  -> refines wording, grouping, upgrade notes, and residual risks
  -> produces final Markdown for --notes-file

Release publisher
  -> awb release github <version> --notes-file <file>
  -> packages tarball, tags/pushes if requested, creates or updates GitHub release
```

The CLI should own evidence collection and deterministic formatting. The LLM
agent should own editorial synthesis. This keeps the executable path testable
while allowing a model to do the work it is better suited for: collapsing
implementation detail into release-reader language.

Implementation should keep the existing release publisher module thin. Add the
release-note collector, classifier, data structures, grouping, renderers, and
file-writing helpers in `tools/devcli/src/auriora_dev/commands/release_notes.py`.
`tools/devcli/src/auriora_dev/commands/release.py` should register
`awb release notes` and delegate to that helper module. This avoids coupling the
new evidence workflow to existing preflight, version-bump, and GitHub release
publishing code.

### CLI Surface

Prefer a release subcommand:

```bash
awb release notes \
  --from v0.3.0 \
  --to HEAD \
  --version 0.4.0 \
  --output docs/release-notes/v0.4.0.md
```

Options:

- `--from <ref>`: lower bound for the release range. Optional when latest
  reachable `v*` tag can be detected.
- `--to <ref>`: upper bound, default `HEAD`.
- `--version <version>`: display version, default `package.json#/version`.
- `--output <path>`: Markdown notes or first-pass outline file to write.
- `--format draft|github|markdown|agent`: default `draft`.
- `--include-evidence`: include compact evidence in the Markdown.
- `--evidence-output <path>`: write sidecar JSON evidence.
- `--validation-note <text>`: include a manually supplied validation summary.
- `--validation-file <path>`: include validation evidence from a local text or
  Markdown file.
- `--final`: mark generated notes as reviewed/final. This is intended for
  maintainer use after editing or agent-assisted refinement, not for the
  deterministic first pass.
- `--dry-run`: print generated notes without writing.
- `--agent-instructions <path>`: optionally write an agent-ready prompt that
  references the evidence file and outlines refinement rules.

If implementation review finds that a smaller script is cleaner for the first
slice, the same behavior may start as a repo-owned script and later be wrapped
by `awb`.

### Output Modes

- `draft`: first-pass Markdown with review state and candidate entries.
- `github`: concise Markdown shaped for GitHub Releases. It still remains a
  draft unless `--final` is passed or a maintainer separately reviews the file.
- `markdown`: fuller Markdown with review notes and compact evidence.
- `agent`: evidence-heavy handoff with explicit instructions for an LLM-backed
  agent to refine the notes.

The default should be `draft` because the command is an evidence and outline
generator, not a final prose authority. `agent` should be used when the
maintainer wants an explicit review/refinement pass before publishing. A file
passed to `awb release github --notes-file` should be the reviewed final notes,
not the unreviewed default draft.

### Evidence Collector

The first implementation should collect:

- `git log --reverse --format=%H%x1f%h%x1f%an%x1f%aI%x1f%s%x1f%b%x1e <from>..<to>`
- `git diff --name-status <from>..<to>`
- per-commit file evidence with
  `git show --name-status --format=%H%x1f%h%x1f%s%x1e <commit>` or an equivalent
  no-patch-plus-name-status command for each commit in the resolved range
- release-tag detection when `--from` is absent:
  - list tags merged into `<to>`;
  - keep only tags matching `v<major>.<minor>.<patch>` by default;
  - exclude prerelease tags unless a later explicit prerelease option is added;
  - choose the highest semantic version reachable from `<to>`, using
    first-parent reachability as a future refinement if release history needs
    it
- current package version from `package.json#/version`
- current branch and `git rev-parse` values for traceability
- changed release metadata, package files, plugin files, docs, tests, and CI
  files

The range-level diff is the release's final changed-file set. Per-commit file
evidence is required for grouping because range-level commits plus range-level
files cannot prove which commit touched which path. The collector should keep
both views: use the range diff for the complete file inventory and per-commit
name-status rows for conservative commit-to-file attachment.

Optional later enrichment:

- `gh pr list` / `gh pr view` for PR titles, labels, merged status, and
  release-note labels
- GitHub compare URL
- validation command output captured by release preflight

Validation evidence in the first implementation:

- `--validation-note` records a maintainer-supplied validation summary.
- `--validation-file` reads a local text or Markdown file and embeds or links
  the evidence according to output mode.
- Release preflight import is deferred; the command should not claim validation
  passed unless one of these inputs or a future structured validation source is
  supplied.

### Classifier

Classify changed files into release-impact areas and audience impact. Area is
path-driven; audience impact is conservative and should only be assigned when
evidence is clear.

Release-impact areas:

- Runtime and MCP behavior: `src/`, `.well-known/mcp/`
- CLI and automation: `tools/devcli/`, `scripts/`
- Packaging and install: `package.json`, `packaging/`, `plugins/`
- Documentation and runbooks: `README.md`, `docs/runbooks/`, durable docs
- Tests and validation: `tests/`, `.github/workflows/`
- Specs and planning: `docs/specs/`, `docs/backlog/`,
  `docs/backlog/README.md`
- Internal maintenance: changes without direct consumer impact

Audience impact:

- `end_user`: install, command, plugin behavior, release package, setup docs
- `agent_user`: MCP resources/tools, skills, prompts, hooks, agent guidance
- `maintainer`: dev CLI, CI, tests, release process, packaging internals
- `operator`: runtime operations, diagnostics, cache, deployment, GHCR
- `internal`: tests, specs, refactors, docs that do not change consumer action

The classifier should be simple and deterministic at first. It should not
pretend to know semantic intent beyond path and commit evidence. Low-confidence
items should be routed to a review-needed section.

### Grouping Strategy

The first-pass grouper should form candidate entries from evidence, not final
release prose. Suggested grouping order:

1. Group file changes by impact area.
2. Attach commits using per-commit name-status evidence.
3. Collapse adjacent commits with similar subjects or identical file areas.
4. Promote groups touching package, plugin, command, MCP, install, or migration
   surfaces above internal maintenance.
5. Put low-confidence groups in `Needs Review`.

The implementation should not attempt semantic source-code analysis in this
spec. It should produce conservative candidate groups and leave fine-grained
judgment to the LLM-agent synthesis step or maintainer review.

### Agent-Assisted Synthesis

The deterministic command should produce enough structured evidence for an
LLM-backed agent to refine prose. The agent step may be performed by a prompt,
skill, or manual agent instruction, but it must use the evidence packet as the
source of truth.

Agent responsibilities:

- collapse related commits into consumer outcomes;
- translate path/commit evidence into release-note sections;
- call out uncertainty instead of guessing;
- keep install, compatibility, command, contract, and validation changes
  visible;
- write concise notes suitable for `gh release create --notes-file`.

The agent handoff should include:

- target version and release range;
- generated evidence file path if present;
- first-pass outline;
- required output section headings;
- explicit rules against unsupported claims;
- instruction to preserve `Needs Review` items when uncertainty remains.

### Markdown Renderer

Default final release-notes shape:

```markdown
# Agent Workbench vX.Y.Z

## Highlights

## Added

## Changed

## Fixed

## Packaging And Install Notes

## Upgrade Notes

## Validation

## Known Issues

## Evidence
```

Empty sections may be omitted except title and evidence metadata. The first pass
may contain a review-needed outline when agent refinement has not yet happened.
`Evidence` can be compact by default and expanded when `--include-evidence` is
passed.

First-pass outline entries should use a deliberately reviewable shape:

```markdown
## Needs Review

- Candidate: <short inferred outcome>
  - Evidence: <commit short sha>, <paths or area>
  - Confidence: low|medium|high
  - Reviewer action: confirm wording, move to another section, or omit
```

This makes the draft useful without pretending a deterministic classifier can
fully understand intent.

### Reusable Prompt Or Skill Contract

Create guidance for LLM-agent synthesis that says:

- use the generated evidence packet as the source of truth;
- group by consumer outcome, not commit count;
- include install, upgrade, compatibility, and validation notes when evidence
  indicates them;
- avoid claiming validation that was not run;
- preserve uncertainty in `Known Issues` or `Needs Review`;
- avoid marketing language and keep release notes actionable.

This can start as repo documentation, a prompt file, or a local skill. Extract
it to a shared skill after reuse is proven across multiple repositories.

## Low-Level Design

### Data Model

```python
ReleaseCommit = {
  "hash": str,
  "short_hash": str,
  "subject": str,
  "body": str,
  "author": str,
  "date": str,
  "files": list[ReleaseFileChange],
}

ReleaseFileChange = {
  "status": "A" | "M" | "D" | "R" | "C" | "...",
  "raw_status": str,
  "score": int | None,
  "path": str,
  "old_path": str | None,
  "area": str,
}

ReleaseNotesEvidence = {
  "from_ref": str,
  "to_ref": str,
  "selected_from_tag": str | None,
  "from_revision": str,
  "to_revision": str,
  "version": str,
  "repository": str,
  "repository_root": str,
  "branch": str,
  "generated_at": str,
  "commits": list[ReleaseCommit],
  "files": list[ReleaseFileChange],
  "areas": dict[str, list[str]],
  "candidate_groups": list[ReleaseNoteCandidate],
  "validation": ReleaseValidationEvidence | None,
  "skipped_enrichment": list[str],
}

ReleaseNoteCandidate = {
  "id": str,
  "section": str,
  "title": str,
  "summary": str,
  "rationale": str,
  "confidence": "low" | "medium" | "high",
  "audiences": list[str],
  "areas": list[str],
  "commit_hashes": list[str],
  "paths": list[str],
  "review_needed": bool,
}

ReleaseValidationEvidence = {
  "summary": str,
  "source": "note" | "file",
  "path": str | None,
}
```

### Command Planning

Implement evidence collection with `subprocess.run(..., capture_output=True,
text=True, check=False)` and explicit error handling. The command should return
Typer exit code `1` with a clear message when:

- Git is unavailable;
- the repo is not a Git worktree;
- the range is invalid;
- no commits or file changes are found;
- an output path parent cannot be created or is not writable.

For explicit write paths (`--output`, `--evidence-output`, and
`--agent-instructions`), the command should create missing parent directories.
This keeps the documented `docs/release-notes/...` examples usable even though
the directory may not exist yet. `--dry-run` must not create directories or
files.

The command should avoid network access by default. GitHub enrichment should be
an explicit later option because `gh` availability, authentication, and network
state are not guaranteed.

`git diff --name-status` parsing must handle rename and copy scores:

- `R100\told\tnew` maps to `status: "R"`, `raw_status: "R100"`,
  `score: 100`, `old_path: "old"`, `path: "new"`.
- `C085\told\tnew` maps to `status: "C"`, `raw_status: "C085"`,
  `score: 85`, `old_path: "old"`, `path: "new"`.
- ordinary statuses use `old_path: null` and `score: null`.

### Output Rules

- Default evidence and first-pass outline should be deterministic enough to test
  with fixture repositories.
- If no high-confidence highlights exist, omit `Highlights`.
- If package/install files changed, include `Packaging And Install Notes`.
- If command surfaces changed, include `Changed` or `Added` entries naming the
  command.
- If tests or validation files changed but no validation command was run, avoid
  saying validation passed.
- If validation evidence is supplied through `--validation-note` or
  `--validation-file`, include it under `Validation` and identify the source.
- If all candidate groups are low-confidence, put them under `Needs Review` and
  do not emit `Highlights`.
- If `--evidence-output` is used, write structured JSON before Markdown so an
  interrupted refinement step still has evidence.
- If `--agent-instructions` is used, write a prompt that references the evidence
  output path. If no evidence path was supplied, embed compact evidence directly
  in the prompt.
- Candidate entries must include `rationale` in JSON and first-pass Markdown so
  reviewers can inspect grouping decisions.

### Release Publishing Integration

`awb release github` should continue to accept `--notes-file`. It should not
implicitly invoke release-note generation or LLM refinement. That keeps the
publishing step explicit:

```bash
awb release notes --from v0.3.0 --to HEAD --version 0.4.0 \
  --output docs/release-notes/v0.4.0-draft.md \
  --evidence-output docs/release-notes/v0.4.0-evidence.json \
  --agent-instructions docs/release-notes/v0.4.0-agent.md

# agent or human refines v0.4.0-draft.md into reviewed final notes
awb release github 0.4.0 --notes-file docs/release-notes/v0.4.0.md
```

## Operational Considerations

- Release notes generation is read-only unless `--output`,
  `--evidence-output`, or `--agent-instructions` is passed.
- `awb release github` should not generate or refine notes implicitly in the
  first implementation; explicit files keep review boundaries clear.
- Generated or agent-refined notes are draftable. Maintainers may edit before
  publishing.
- `--final` is a declaration by the caller that the notes were reviewed; it is
  not proof that an agent or human actually reviewed the content.
- A separate plugin is deferred. Use a skill/prompt only for synthesis guidance
  until cross-repo executable reuse is proven.
- Generated release-note drafts should not be added to the npm package payload
  unless a separate packaging decision says release history belongs there.

## Implementation Review Decisions

The implementation-readiness review found four consequences that affect the
design:

- Range-level Git evidence is not enough for commit-to-file grouping. Without
  per-commit file evidence, the grouper would either guess or attach every
  commit to every file in an area. The selected approach adds per-commit
  name-status collection and keeps range-level diff evidence for the final file
  inventory.
- The evidence model must carry traceability fields used by the workflow:
  `short_hash`, selected tag, resolved revisions, branch, repository root, and
  per-commit file changes. Without these fields, tests would either under-prove
  the behavior or force implementers to add undocumented JSON shape.
- Output parent handling must be explicit. The selected approach creates parent
  directories for explicit output paths and keeps `--dry-run` completely
  read-only. The alternative, requiring callers to pre-create
  `docs/release-notes/`, makes the documented workflow fail on a clean checkout.
- The release-note implementation should not inflate `release.py`. The selected
  approach uses a dedicated `release_notes.py` helper module and keeps
  `release.py` as command registration and delegation.

Alternatives considered:

- Use only range-level `git log` and `git diff`. Rejected because it cannot
  support the required commit-to-file grouping without misleading inference.
- Weaken grouping to area-only correlation. Deferred because it would reduce the
  usefulness of the evidence packet and push too much reconstruction onto the
  LLM or maintainer.
- Require existing output directories. Rejected for this repo-local workflow
  because the example output directory is not currently present.
- Put all code in `release.py`. Rejected because existing release preflight,
  version bump, and GitHub publishing code already live there; adding the full
  notes pipeline would make review and testing harder.

## Open Questions

- Should `--evidence-output` be required when `--agent-instructions` is used,
  or should the prompt embed compact evidence by default?
- Should release preflight write validation evidence that `awb release notes`
  can import in a later slice?
- Should release-note sections be configurable per repo, or fixed until reuse
  pressure appears?
- Should release-tag detection use first-parent ancestry in v1, or is semantic
  version filtering enough for this repo's current release history?
