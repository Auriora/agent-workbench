---
title: Agent Workbench evaluation on agent-dev-lifecycle
doc_type: reference
status: draft
owner: platform
last_reviewed: 2026-06-05
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Agent Workbench Evaluation On Agent Dev Lifecycle

## Scope

This note records a Codex dogfood pass of the Agent Workbench MCP runtime
against `/home/bcherrington/Projects/Auriora/agent-dev-lifecycle`.

The target repository is documentation-heavy and contains Markdown specs,
durable documentation, skill templates, fixture repositories, and YAML skill
metadata. It is a useful target for testing resource-backed documentation
routing, task-context quality, and validation planning behavior.

## Surfaces Exercised

Resources:

- `repo:///status`
- `repo:///scope`
- `repo:///overview`
- `integration:///profiles/codex`

Tools:

- `context_for_task`
- `verification_plan`

The Codex-visible Agent Workbench tool surface in this session exposed only
`context_for_task` and `verification_plan`. The Codex integration profile still
advertises additional MCP tools such as `symbol_search`, `find_references`,
`impact`, `preview_workspace_edit`, and `apply_workspace_edit`.

## Positive Findings

### Fresh Resource State

`repo:///status`, `repo:///scope`, and `repo:///overview` returned valid, fresh
resource-backed results for the target repository. The runtime correctly
identified the repository as documentation/config focused:

- languages: Markdown, text, YAML;
- capability level: resource-backed;
- warmup state: complete;
- indexed root: `.`;
- generated/vendor roots skipped.

This was a good fit for this repository. The status resource included the new
spec packages, skill templates, traceability template, closure-log spec, and
fixture docs.

### Explicit Capability Limits

The resources clearly reported that Markdown and YAML were resource-backed
rather than semantic. This is the right level of confidence for a
documentation-heavy repo. The tool outputs also carried the direct-read caveat:
related files and governing docs are routing evidence, not authoritative
content.

### Seeded Task Context Was Useful

When `context_for_task` was called with explicit files for evaluating the spec
lifecycle work, it returned:

- all requested files as present;
- related spec and fixture files;
- governing docs around validation and closure;
- skipped path evidence for ignored local paths;
- a complete-enough marker with caveats.

This is useful for a lead agent preparing to write a review note or start a
bounded documentation change.

### Unseeded Task Context Found The Traceability Slice

When asked to implement `T012 traceability lookup` from the MCP spec without
explicit files, `context_for_task` found the core package files:

- `docs/specs/004-spec-management-mcp/design.md`
- `docs/specs/004-spec-management-mcp/requirements.md`
- `docs/specs/004-spec-management-mcp/tasks.md`
- `docs/specs/004-spec-management-mcp/research.md`

It also ranked `skills/spec-lifecycle-manager/references/spec-package/traceability.md`
as the top symbol/resource. That is strong behavior for the recent
task-context failure mode this repository is trying to address.

## Issues And Risks

### Finding 1: Codex Profile Advertises Tools Not Exposed In This Session

Observed fact:

- `integration:///profiles/codex` lists `symbol_search`, `find_references`,
  `impact`, `preview_workspace_edit`, and `apply_workspace_edit`.
- The discovered callable Agent Workbench tools in this Codex session were only
  `context_for_task` and `verification_plan`.
- `context_for_task` also returned next actions for `find_references` and
  `impact`.

Impact:

Agents may follow suggested next actions that are not actually callable in the
current integration surface. This weakens trust in next-action guidance.

Recommendation:

Align profile and next-action generation with the currently registered public
tool surface. If a tool is intentionally unavailable in a given session, mark
it unavailable or suppress it from next actions.

### Finding 2: Overview Key Files Overweight Fixture Docs

Observed fact:

`repo:///overview` listed many fixture files under
`tests/fixtures/skill-validation/...` as key files before some top-level docs
and skill templates.

Impact:

For this repository, fixtures are important, but first-pass overview should
prioritize the durable lifecycle docs and canonical skill source before fixture
examples. A new agent could over-index on fixture files when trying to
understand the project.

Recommendation:

For documentation-heavy repositories, rank top-level docs, durable design,
governance, skill source, and active specs above fixture packages unless the
task explicitly mentions fixtures or validation trials.

### Finding 3: Validation Plan Fails Hard On External Changed File Paths

Observed fact:

When validating a feedback note path outside the evaluated repo, using
`repo_root: agent-dev-lifecycle`, `verification_plan` returned a blocked result
with useful static feedback. When using `repo_root: agent-workbench` before the
target directory existed, it returned a raw `ENOENT` text response instead of a
structured envelope.

Impact:

The first behavior was good: structured blocked state with an explanation. The
second behavior is weaker because callers must special-case raw filesystem
errors.

Recommendation:

Normalize missing changed-file directories and missing files into the standard
response envelope with `status: blocked`, actionable static feedback, and
missing-path evidence.

### Finding 4: No Validation Hints For Documentation-Only Repo

Observed fact:

Both context calls returned zero validation hints for `agent-dev-lifecycle`.

Impact:

This repository has obvious lightweight validation options:

- `git diff --check`;
- ASCII check for edited docs;
- Markdown link checks when available;
- template metadata checks;
- installed skill sync check when `skills/spec-lifecycle-manager/` changes.

Recommendation:

Add documentation-repo validation hints from visible repository shape. Even if
no test runner exists, Agent Workbench can suggest docs/config syntax review,
link checks, and metadata/template checks.

## Suggested Follow-Ups

1. Align advertised Codex MCP bindings with actually exposed callable tools.
2. Suppress next actions for unavailable tools or mark them unavailable with a
   clear reason.
3. Improve overview ranking for documentation-heavy repos by prioritizing
   durable docs and canonical skill source above fixtures.
4. Return structured envelopes for missing changed-file directories in
   `verification_plan`.
5. Add documentation-only validation hints for repositories with Markdown,
   templates, and no code test runner.

## Validation Evidence

Manual MCP/resource checks performed on 2026-06-05:

- Read `repo:///status`.
- Read `repo:///scope`.
- Read `repo:///overview`.
- Read `integration:///profiles/codex`.
- Ran `context_for_task` with explicit files for spec lifecycle evaluation.
- Ran `context_for_task` without explicit files for `T012 traceability lookup`.
- Ran `verification_plan` against an external changed file path and observed a
  structured blocked response.
- Ran `verification_plan` against the Agent Workbench feedback path before the
  directory existed and observed a raw `ENOENT` response.

Local document checks for this note:

- `verification_plan` against the Agent Workbench repo returned `status:
  planned`, static feedback silent, and one planned docs/config syntax review.
- `git diff --check -- docs/reference/agent-dev-lifecycle/2026-06-05-agent-workbench-agent-dev-lifecycle-evaluation.md`
  passed.
- ASCII scan with `LC_ALL=C rg -n '[^ -~]'` returned no matches.

## Residual Risk

This evaluation did not run Agent Workbench's TypeScript test suite. It was a
read-only live MCP/resource dogfood pass plus this documentation write-up.
