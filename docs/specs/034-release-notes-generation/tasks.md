---
title: Release notes generation tasks
doc_type: spec
artifact_type: tasks
status: active
owner: platform
last_reviewed: 2026-07-05
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Tasks

## Task Dependency Graph

```text
T001 -> T002 -> T003 -> T004 -> T005 -> T006
T001 -> T007
T006,T007 -> T008 -> T009
T006,T007 -> T010
T009,T010 -> T011 -> T012
T012 -> T013 -> T014
T014 -> T015 -> T016
```

- [x] T001 Define release-note data structures and pure helpers.
  - Files: `tools/devcli/src/auriora_dev/commands/release_notes.py`,
    `tools/devcli/tests/test_cli.py`
  - Acceptance: Data structures or typed dictionaries exist for commits, file
    changes, validation evidence, candidates, and evidence packets; evidence
    structures include short commit hashes, selected tags, resolved revisions,
    branch, repository root, and per-commit file changes; helper tests cover
    semantic version normalization, tarball/tag naming reuse, and stable
    candidate IDs.
  - Evidence: Implemented in `tools/devcli/src/auriora_dev/commands/release_notes.py`, `tools/devcli/src/auriora_dev/commands/release.py`, dev CLI tests, and durable docs; validated with `python3 -m unittest tools/devcli/tests/test_cli.py`, `pnpm validate:plugin`, `pnpm pack:dry-run`, `pnpm typecheck`, `pnpm test`, and `git diff --check`.
  - [x] T001.1 Add release evidence data structures.
  - [x] T001.2 Add semantic version/tag helper tests.
  - [x] T001.3 Add deterministic candidate ID helper tests.

- [x] T002 Implement Git range resolution and release-tag detection.
  - Depends on: T001
  - Files: `tools/devcli/src/auriora_dev/commands/release_notes.py`,
    `tools/devcli/tests/test_cli.py`
  - Acceptance: `--to` defaults to `HEAD`; missing `--from` selects the highest
    reachable `vX.Y.Z` tag; non-semver and prerelease tags are ignored by
    default; invalid or empty ranges return clear blocked/failure output.
  - Evidence: Implemented in `tools/devcli/src/auriora_dev/commands/release_notes.py`, `tools/devcli/src/auriora_dev/commands/release.py`, dev CLI tests, and durable docs; validated with `python3 -m unittest tools/devcli/tests/test_cli.py`, `pnpm validate:plugin`, `pnpm pack:dry-run`, `pnpm typecheck`, `pnpm test`, and `git diff --check`.
  - [x] T002.1 Resolve explicit `--from`/`--to` refs.
  - [x] T002.2 Detect latest reachable stable release tag.
  - [x] T002.3 Cover no-tag, invalid-range, and empty-range failures.

- [x] T003 Collect and parse Git commit evidence.
  - Depends on: T002
  - Files: `tools/devcli/src/auriora_dev/commands/release_notes.py`,
    `tools/devcli/tests/test_cli.py`
  - Acceptance: Collector parses full hash, short hash, author, ISO date,
    subject, and body from the configured Git log format; collector also gathers
    per-commit name-status file evidence so grouping can attach commits to
    paths without guessing; malformed rows fail with actionable diagnostics.
  - Evidence: Implemented in `tools/devcli/src/auriora_dev/commands/release_notes.py`, `tools/devcli/src/auriora_dev/commands/release.py`, dev CLI tests, and durable docs; validated with `python3 -m unittest tools/devcli/tests/test_cli.py`, `pnpm validate:plugin`, `pnpm pack:dry-run`, `pnpm typecheck`, `pnpm test`, and `git diff --check`.
  - [x] T003.1 Add Git log command wrapper.
  - [x] T003.2 Parse commit rows with record/unit separators.
  - [x] T003.3 Add per-commit name-status collection.
  - [x] T003.4 Test multiline bodies, commit file evidence, and malformed commit
    rows.

- [x] T004 Collect and parse changed-file evidence.
  - Depends on: T002
  - Files: `tools/devcli/src/auriora_dev/commands/release_notes.py`,
    `tools/devcli/tests/test_cli.py`
  - Acceptance: `git diff --name-status` output is parsed for added,
    modified, deleted, rename, and copy rows; `R*` and `C*` rows preserve
    `raw_status`, `score`, `old_path`, and new `path`.
  - Evidence: Implemented in `tools/devcli/src/auriora_dev/commands/release_notes.py`, `tools/devcli/src/auriora_dev/commands/release.py`, dev CLI tests, and durable docs; validated with `python3 -m unittest tools/devcli/tests/test_cli.py`, `pnpm validate:plugin`, `pnpm pack:dry-run`, `pnpm typecheck`, `pnpm test`, and `git diff --check`.
  - [x] T004.1 Add name-status command wrapper.
  - [x] T004.2 Parse ordinary file status rows.
  - [x] T004.3 Parse `R*` and `C*` rows with scores and old/new paths.
  - [x] T004.4 Test malformed name-status rows.

- [x] T005 Classify release-impact area and audience impact.
  - Depends on: T003, T004
  - Files: `tools/devcli/src/auriora_dev/commands/release_notes.py`,
    `tools/devcli/tests/test_cli.py`
  - Acceptance: Path-driven classification covers runtime/MCP, CLI,
    packaging/install, docs/runbooks, tests/CI, specs/planning, and internal
    maintenance; audience impact covers `end_user`, `agent_user`,
    `maintainer`, `operator`, and `internal`.
  - Evidence: Implemented in `tools/devcli/src/auriora_dev/commands/release_notes.py`, `tools/devcli/src/auriora_dev/commands/release.py`, dev CLI tests, and durable docs; validated with `python3 -m unittest tools/devcli/tests/test_cli.py`, `pnpm validate:plugin`, `pnpm pack:dry-run`, `pnpm typecheck`, `pnpm test`, and `git diff --check`.
  - [x] T005.1 Implement release-impact area mapping.
  - [x] T005.2 Implement conservative audience impact mapping.
  - [x] T005.3 Add tests for representative paths in every area.

- [x] T006 Build candidate release-note groups.
  - Depends on: T005
  - Files: `tools/devcli/src/auriora_dev/commands/release_notes.py`,
    `tools/devcli/tests/test_cli.py`
  - Acceptance: Candidate groups attach commits to changed files, group by
    impact area using per-commit file evidence, promote
    package/plugin/command/MCP/install/migration surfaces, include confidence
    and `review_needed`, and preserve a short grouping rationale.
  - Evidence: Implemented in `tools/devcli/src/auriora_dev/commands/release_notes.py`, `tools/devcli/src/auriora_dev/commands/release.py`, dev CLI tests, and durable docs; validated with `python3 -m unittest tools/devcli/tests/test_cli.py`, `pnpm validate:plugin`, `pnpm pack:dry-run`, `pnpm typecheck`, `pnpm test`, and `git diff --check`.
  - [x] T006.1 Group changed files by impact area.
  - [x] T006.2 Attach commits to candidate groups.
  - [x] T006.3 Compute confidence and review-needed state.
  - [x] T006.4 Include grouping rationale in candidates.

- [x] T007 Add validation evidence inputs.
  - Depends on: T001
  - Files: `tools/devcli/src/auriora_dev/commands/release_notes.py`,
    `tools/devcli/tests/test_cli.py`
  - Acceptance: `--validation-note` and `--validation-file` populate validation
    evidence; missing files fail clearly; generated notes identify validation
    source; no validation is claimed when neither input is supplied.
  - Evidence: Implemented in `tools/devcli/src/auriora_dev/commands/release_notes.py`, `tools/devcli/src/auriora_dev/commands/release.py`, dev CLI tests, and durable docs; validated with `python3 -m unittest tools/devcli/tests/test_cli.py`, `pnpm validate:plugin`, `pnpm pack:dry-run`, `pnpm typecheck`, `pnpm test`, and `git diff --check`.
  - [x] T007.1 Parse validation note input.
  - [x] T007.2 Read validation evidence from a local file.
  - [x] T007.3 Test missing validation file and no-validation behavior.

- [x] T008 Assemble the release evidence packet.
  - Depends on: T006, T007
  - Files: `tools/devcli/src/auriora_dev/commands/release_notes.py`,
    `tools/devcli/tests/test_cli.py`
  - Acceptance: Evidence packet includes range, version, repository metadata,
    selected tag, resolved revisions, branch, repository root, generation
    timestamp, commits, range-level file changes, per-commit file changes,
    areas, candidate groups, validation evidence, and skipped enrichment notes.
  - Evidence: Implemented in `tools/devcli/src/auriora_dev/commands/release_notes.py`, `tools/devcli/src/auriora_dev/commands/release.py`, dev CLI tests, and durable docs; validated with `python3 -m unittest tools/devcli/tests/test_cli.py`, `pnpm validate:plugin`, `pnpm pack:dry-run`, `pnpm typecheck`, `pnpm test`, and `git diff --check`.
  - [x] T008.1 Add repository metadata and timestamp fields.
  - [x] T008.2 Combine commit, file, candidate, and validation evidence.
  - [x] T008.3 Snapshot-test evidence packet shape.

- [x] T009 Render draft, GitHub, Markdown, and agent output modes.
  - Depends on: T008
  - Files: `tools/devcli/src/auriora_dev/commands/release_notes.py`,
    `tools/devcli/tests/test_cli.py`
  - Acceptance: `draft` is the default and clearly marked unreviewed;
    `github` is concise but still draft unless `--final` is used; `markdown`
    includes review notes and compact evidence; `agent` is evidence-heavy and
    suitable for LLM refinement.
  - Evidence: Implemented in `tools/devcli/src/auriora_dev/commands/release_notes.py`, `tools/devcli/src/auriora_dev/commands/release.py`, dev CLI tests, and durable docs; validated with `python3 -m unittest tools/devcli/tests/test_cli.py`, `pnpm validate:plugin`, `pnpm pack:dry-run`, `pnpm typecheck`, `pnpm test`, and `git diff --check`.
  - [x] T009.1 Render default draft Markdown.
  - [x] T009.2 Render GitHub-shaped Markdown without implying final review.
  - [x] T009.3 Render fuller Markdown with compact evidence.
  - [x] T009.4 Render agent handoff content.

- [x] T010 Write JSON evidence and agent instruction files.
  - Depends on: T008
  - Files: `tools/devcli/src/auriora_dev/commands/release_notes.py`,
    `tools/devcli/tests/test_cli.py`
  - Acceptance: `--evidence-output` writes structured JSON before Markdown;
    `--agent-instructions` writes an agent-ready prompt referencing the
    evidence file or embedding compact evidence when no evidence file is
    supplied.
  - Evidence: Implemented in `tools/devcli/src/auriora_dev/commands/release_notes.py`, `tools/devcli/src/auriora_dev/commands/release.py`, dev CLI tests, and durable docs; validated with `python3 -m unittest tools/devcli/tests/test_cli.py`, `pnpm validate:plugin`, `pnpm pack:dry-run`, `pnpm typecheck`, `pnpm test`, and `git diff --check`.
  - [x] T010.1 Write evidence JSON atomically enough for local CLI use.
  - [x] T010.2 Write agent instructions referencing evidence output.
  - [x] T010.3 Write agent instructions with embedded compact evidence.

- [x] T011 Add `awb release notes` CLI command.
  - Depends on: T009, T010
  - Files: `tools/devcli/src/auriora_dev/commands/release.py`,
    `tools/devcli/src/auriora_dev/commands/release_notes.py`,
    `tools/devcli/tests/test_cli.py`
  - Acceptance: Command exposes `--from`, `--to`, `--version`, `--output`,
    `--format`, `--include-evidence`, `--evidence-output`,
    `--validation-note`, `--validation-file`, `--final`, `--dry-run`, and
    `--agent-instructions`; dry-run writes no files or directories; explicit
    write paths create missing parent directories and fail clearly when parent
    creation or writing is not possible.
  - Evidence: Implemented in `tools/devcli/src/auriora_dev/commands/release_notes.py`, `tools/devcli/src/auriora_dev/commands/release.py`, dev CLI tests, and durable docs; validated with `python3 -m unittest tools/devcli/tests/test_cli.py`, `pnpm validate:plugin`, `pnpm pack:dry-run`, `pnpm typecheck`, `pnpm test`, and `git diff --check`.
  - [x] T011.1 Register CLI options and help text.
  - [x] T011.2 Implement dry-run stdout behavior.
  - [x] T011.3 Implement file write behavior and parent-directory creation.
  - [x] T011.4 Ensure no network access is attempted by default.

- [x] T012 Add fixture-backed end-to-end CLI tests.
  - Depends on: T011
  - Files: `tools/devcli/tests/test_cli.py`
  - Acceptance: Tests create a temporary Git repository with multiple commits,
    tags, per-commit file changes, rename/copy cases where practical,
    validation input, dry-run output, parent-directory creation, Markdown
    output, evidence output, and agent instructions.
  - Evidence: Implemented in `tools/devcli/src/auriora_dev/commands/release_notes.py`, `tools/devcli/src/auriora_dev/commands/release.py`, dev CLI tests, and durable docs; validated with `python3 -m unittest tools/devcli/tests/test_cli.py`, `pnpm validate:plugin`, `pnpm pack:dry-run`, `pnpm typecheck`, `pnpm test`, and `git diff --check`.
  - [x] T012.1 Build temporary Git fixture helper.
  - [x] T012.2 Cover valid multi-commit release range.
  - [x] T012.3 Cover tag auto-detection.
  - [x] T012.4 Cover invalid and empty ranges.
  - [x] T012.5 Cover per-commit file evidence in generated JSON.
  - [x] T012.6 Cover generated Markdown, JSON, and agent instruction outputs.
  - [x] T012.7 Cover parent-directory creation and dry-run no-write behavior.

- [x] T013 Document release notes workflow in CLI/runbook docs.
  - Depends on: T011, T012
  - Files: `tools/devcli/README.md`,
    `docs/runbooks/codex-agent-workbench-plugin.md`,
    `docs/runbooks/install-agent-workbench.md` if needed
  - Acceptance: Docs show evidence generation, optional agent refinement, and
    `awb release github --notes-file`; docs state default output is draft and
    release publishing should use reviewed final notes.
  - Evidence: Implemented in `tools/devcli/src/auriora_dev/commands/release_notes.py`, `tools/devcli/src/auriora_dev/commands/release.py`, dev CLI tests, and durable docs; validated with `python3 -m unittest tools/devcli/tests/test_cli.py`, `pnpm validate:plugin`, `pnpm pack:dry-run`, `pnpm typecheck`, `pnpm test`, and `git diff --check`.
  - [x] T013.1 Update dev CLI README command examples.
  - [x] T013.2 Update release/package runbook workflow.
  - [x] T013.3 Document draft/final review boundary.

- [x] T014 Add reusable LLM-agent synthesis guidance.
  - Depends on: T010, T013
  - Files: `docs/reference/agent-readable-changelog.md` or a new durable
    release-note guidance document; `docs/reference/documentation-map.md` if a
    new durable document is added.
  - Acceptance: Guidance tells an LLM-backed agent to use evidence as source of
    truth, group by consumer outcome, include upgrade/validation/residual-risk
    notes, preserve uncertainty, avoid unsupported claims, and defer separate
    plugin extraction until cross-repo demand exists.
  - Evidence: Implemented in `tools/devcli/src/auriora_dev/commands/release_notes.py`, `tools/devcli/src/auriora_dev/commands/release.py`, dev CLI tests, and durable docs; validated with `python3 -m unittest tools/devcli/tests/test_cli.py`, `pnpm validate:plugin`, `pnpm pack:dry-run`, `pnpm typecheck`, `pnpm test`, and `git diff --check`.
  - [x] T014.1 Choose durable guidance destination.
  - [x] T014.2 Add synthesis rules and examples.
  - [x] T014.3 Update documentation map if a new document is created.

- [x] T015 Run validation and package checks.
  - Depends on: T012, T013, T014
  - Files: package and test surfaces
  - Acceptance: `python -m unittest tools/devcli/tests/test_cli.py`,
    `pnpm validate:plugin`, `pnpm pack:dry-run`, `pnpm typecheck`, and
    `git diff --check` pass or waivers are recorded with residual risk.
  - Evidence: Implemented in `tools/devcli/src/auriora_dev/commands/release_notes.py`, `tools/devcli/src/auriora_dev/commands/release.py`, dev CLI tests, and durable docs; validated with `python3 -m unittest tools/devcli/tests/test_cli.py`, `pnpm validate:plugin`, `pnpm pack:dry-run`, `pnpm typecheck`, `pnpm test`, and `git diff --check`.
  - [x] T015.1 Run dev CLI unit tests.
  - [x] T015.2 Run plugin/package validation.
  - [x] T015.3 Run package dry-run.
  - [x] T015.4 Run TypeScript typecheck.
  - [x] T015.5 Run diff whitespace check.

- [x] T016 Promote durable docs and close readiness.
  - Depends on: T015
  - Files: `docs/reference/agent-readable-changelog.md`,
    `docs/requirements/agent-workbench-executable-backlog.md`,
    `docs/reference/documentation-map.md` if a new durable doc is added
  - Acceptance: Durable docs describe accepted release-note workflow, reusable
    guidance destination, draft/final boundary, validation inputs, and plugin
    extraction decision; EB035 is updated or routed; spec verification evidence
    is recorded.
  - Evidence: Implemented in `tools/devcli/src/auriora_dev/commands/release_notes.py`, `tools/devcli/src/auriora_dev/commands/release.py`, dev CLI tests, and durable docs; validated with `python3 -m unittest tools/devcli/tests/test_cli.py`, `pnpm validate:plugin`, `pnpm pack:dry-run`, `pnpm typecheck`, `pnpm test`, and `git diff --check`.
  - [x] T016.1 Promote accepted behavior to durable docs.
  - [x] T016.2 Update backlog/executable backlog routing.
  - [x] T016.3 Record final verification evidence.
