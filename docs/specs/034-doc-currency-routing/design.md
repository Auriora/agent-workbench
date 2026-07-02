---
title: Doc currency routing design
doc_type: spec
artifact_type: design
status: active
owner: platform
last_reviewed: 2026-07-02
---

# Design

## Overview

Add a document currency layer on top of the existing document authority policy.
The layer classifies document authority for a specific task, combines static
signals with optional recency evidence, and presents implementation-safe
defaults while preserving historical access.

The design keeps lifecycle truth outside Agent Workbench. Workbench labels and
ranks evidence; spec-lifecycle-manager decides spec lifecycle, closure, and
promotion policy for users of that plugin.

## High-Level Design

### Currency Signal Model

Extend the existing document authority model with task-currency inputs:

```text
DocumentCurrencySignal
  doc_status
  authority
  authority_caveat
  currency_state: current | stale | superseded | historical | unknown
  currency_caveats[]
  canonical_owner?
  superseded_by?
  last_reviewed?
  modified_at?
  git_first_seen?
  git_last_touched?
  evidence_kinds[]
```

`modified_at` derives from existing `FileIdentity.mtime_ms`. Git fields derive
from local Git commands only when available. Filesystem `ctime` is deliberately
absent.

### Frontmatter Parsing

Add a small parser that reads only the first YAML frontmatter block for
Markdown candidates. Supported keys are inputs, not authority by themselves:

- `status`
- `doc_type`
- `last_reviewed`
- `authority`
- `canonical_owner`
- `superseded_by`
- `review_after`
- `applies_to`

Unknown keys remain ignored by the runtime. spec-lifecycle-manager may adopt
or enforce additional rules for specs and durable-doc promotion.

### Task Context Integration

`context_for_task` should classify candidate docs using frontmatter and, where
cheap enough, selected content. The current path/title-only doc priority is not
enough because `status: archived` in frontmatter should affect governing-doc
ranking even when the path does not include `archive` or `history`.

Implementation-oriented `context_for_task` defaults:

- include current canonical and supporting docs first;
- include draft or unknown docs only with caveats;
- exclude or strongly downrank archived, legacy, superseded, template, and
  sample docs unless they are exact requested paths or explicitly historical;
- add next actions to canonical owners or `superseded_by` targets.

### Docs Search And Overview Integration

`docs_search` already classifies hits in the SQLite graph store. This spec
extends the mapped hit metadata with currency fields and optional recency
evidence. Ranking should continue to use FTS relevance, path category, and
authority priority, then add task-currency boosts or penalties.

`repo:///docs/overview` and `repo:///docs/map` should expose the same currency
fields for scanner-backed documents. They remain routing and inventory
surfaces; `docs_read_section` remains the precise direct-read evidence surface.

### Git History Evidence

Git history is easy to obtain for tracked files with local commands:

```text
git log -1 --format=%cI -- path/to/file
git log --follow --diff-filter=A --format=%H%x09%cI -- path/to/file
```

The latest-touch command is cheap for one file. First-introduced history can be
more expensive for renamed files because `--follow` walks history, so it should
be optional, bounded, and skipped when unavailable. No network access is
required.

Git recency is corroborating evidence only. It can explain "this historical
file has not changed since June" or "this runbook was updated yesterday", but
it does not override explicit lifecycle or canonical-owner evidence.

### Agent Verification Workflow

Add either:

- a packaged skill/prompt such as `doc-currency-check`, or
- an MCP tool such as `docs_current_for_task`.

The first implementation can be a skill/prompt if that is faster to ship and
dogfood. The eventual executable surface should return structured results with
the same currency model as docs search and task context.

Prompt contract:

```text
Input: task, optional files, optional docs_scope, optional include_history.
Output: canonical docs, supporting docs, non-authoritative docs, unknown docs,
currency caveats, and next actions.
```

### Spec-Lifecycle-Manager Feedback

Prepare a handoff for spec-lifecycle-manager with these requested rule changes:

- treat frontmatter `status`, `last_reviewed`, `canonical_owner`,
  `superseded_by`, and lifecycle state as routing inputs;
- warn when active specs or durable docs point at archived/superseded sources
  without a canonical context entry;
- prohibit `ctime` as a lifecycle or currency signal;
- allow Git first/last touch evidence as optional corroboration;
- encourage `canonical-context.md` for stale-doc-risk specs.

## Low-Level Design

- Extend `document-authority.ts` or a sibling policy module with currency
  classification that accepts path, title, content/frontmatter, file identity,
  optional Git evidence, and task intent.
- Add structured frontmatter extraction in the Markdown docs use-case layer or
  domain policy layer. Avoid ad hoc line matching outside the shared parser.
- Update docs contracts only if new currency fields need to be public. If
  fields are added, update runtime contract docs and contract tests together.
- Update `get-task-context.ts` to read frontmatter for candidate governing docs
  before ranking.
- Update `graph-store.ts` docs hit mapping to include the same currency caveats
  and optional Git evidence when supplied by the indexer or a bounded
  per-result enrichment step.
- Add a small Git history port if executable Git evidence lands in runtime
  code. The port must return structured unavailable states for non-Git repos,
  untracked files, shallow history, missing `git`, and command failures.

## Operational Considerations

- Default docs routing must not execute Git for broad result sets unless a
  budget explicitly allows it.
- Git evidence collection should be opt-in or limited to the small final result
  set.
- Missing Git evidence is not a degraded docs search state. It is a missing
  optional enrichment caveat.
- `mtime_ms` can be shown as "modified" but should not be described as
  reviewed, accepted, or current.

## Open Questions

- Should the first shipped verifier be a packaged skill/prompt or an MCP tool?
- Should `superseded` become a distinct public `doc_status`, or stay represented
  as `legacy` plus `superseded_by` metadata?
- What default age threshold, if any, should trigger stale `last_reviewed`
  warnings for durable docs?
