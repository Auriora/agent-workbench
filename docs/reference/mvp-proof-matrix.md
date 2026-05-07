---
title: MVP proof matrix
doc_type: reference
status: draft
owner: platform
last_reviewed: 2026-05-07
---

# MVP Proof Matrix

## Purpose

Define the minimum fixture-backed proof required before the Agent IDE runtime
MVP is considered implementation-ready.

## MVP Claim

For a local repository, the runtime provides fresh scoped context,
symbol/reference evidence, bounded edit preview/apply behavior, and a validation
plan without hidden broad scans or unsafe workspace behavior.

## Fixture Set

| Fixture | Purpose | Required Contents |
| --- | --- | --- |
| `fixture-basic-python` | Prove one partial-semantic language path | package/module structure, imports, duplicate symbol names, tests, one edit target |
| `fixture-markdown-config` | Prove routing evidence | Markdown links, path mentions, config files, ignored/generated roots |
| `fixture-degraded-tools` | Prove degraded behavior | missing parser/LSP/test runner cases |
| `fixture-workspace-safety` | Prove path and command refusal | symlink escape, generated root, `.env`, shell-looking command args |

TypeScript/JavaScript may be added as the second language fixture after the
Python path passes the MVP gates. C#, CloudFormation/SAM, graph reports, and
community analysis are post-MVP proof areas unless explicitly reduced to
resource-backed discovery fixtures.

## Tool Proof Gates

| Surface | Fixture | Required Evidence | Pass Gate |
| --- | --- | --- | --- |
| `repo:///status` | all fixtures | repo root, scope, freshness, capability coverage | fresh or degraded state is correct |
| `repo:///scope` | all fixtures | indexed roots, skipped roots, generated/vendor caveats | path scope matches fixture expectations |
| `repo:///overview` | `fixture-basic-python` | compact repo summary and language coverage | no source dump, no broad report |
| `context_for_task` | `fixture-basic-python` | ranked files/symbols, direct-read caveats, trust metadata | includes expected edit target and excludes unrelated files |
| `symbol_search` | `fixture-basic-python` | exact and fuzzy symbol lookup | expected symbols found under row/time budget |
| `find_references` | `fixture-basic-python` | references with confidence and unresolved caveats | expected references found; ambiguous refs labeled |
| `impact` | `fixture-basic-python` | bounded file/symbol impact | traversal depth and result cap enforced |
| `preview_workspace_edit` | `fixture-workspace-safety` | preview token, base hashes, affected files | no mutation before apply |
| `apply_workspace_edit` | `fixture-workspace-safety` | drift check, path containment, result metadata | stale or unsafe edits rejected |
| `verification_plan` | `fixture-basic-python` | planned diagnostics/tests with blocked states | plan names expected commands without executing by default |

## Initial Budgets

Budgets are draft targets for fixture tests and should be revised with real
measurements.

| Operation | Warm Budget | Required Limit |
| --- | --- | --- |
| status/scope read | 50 ms | no source scan |
| symbol search | 100 ms | max 100 rows |
| reference lookup | 150 ms | max depth 1 unless requested |
| context build | 250 ms | max 5 files, max source byte cap |
| impact | 250 ms | max depth 2, max 100 nodes |
| preview/apply | 250 ms | touched files only |
| verification plan | 250 ms | no command execution by default |

## Degraded-Mode Gates

| Case | Expected Behavior |
| --- | --- |
| parser missing | capability becomes `resource_backed` or `unsupported`; response explains missing tool |
| LSP missing | no `semantic` label; references are partial or unavailable |
| test runner missing | `verification_status: blocked`; command is not invented as proven |
| stale watcher snapshot | freshness is `stale` or `refreshing`; mutation requires fresh preview |
| generated/vendor target | write is refused unless explicitly allowed |
| possible secret | value is skipped or redacted from index/report output |

## Query Budget Evidence

Tests must capture enough trace evidence to prove hot-path tools use targeted
indexed reads. Acceptable evidence includes SQL trace assertions, query-plan
assertions, row-count caps, traversal-depth caps, and source-byte caps.

## Acceptance Gate

The MVP docs are implementation-ready when:

- every MVP surface has at least one fixture-backed golden response
- every enum in responses comes from [Runtime contracts](runtime-contracts.md)
- every mutating path has a negative safety test
- every hot-path query has a budget test
- every degraded mode returns structured metadata and next action
- no MVP requirement depends on graph reports, usage analytics, C#, or
  CloudFormation/SAM semantic behavior

## Related Docs

- [Runtime contracts](runtime-contracts.md)
- [Workspace safety contract](workspace-safety-contract.md)
- [Agent IDE runtime MVP spec](../specs/001-agent-ide-runtime/spec.md)
