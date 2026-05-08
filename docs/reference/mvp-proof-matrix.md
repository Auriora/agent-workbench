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
| `fixture-degraded-tools` | Prove degraded behavior | missing `tree-sitter` parser/grammar, parser failure, missing optional enrichment, and missing test runner cases |
| `fixture-workspace-safety` | Prove path and command refusal | symlink escape, generated root, `.env`, shell-looking command args |
| `fixture-runtime-operations` | Prove cache, warm-up, and concurrency behavior | cold start, watcher update, queued extraction, parser timeout, obsolete result, concurrent read |
| `fixture-runtime-boundaries` | Prove runtime context, registries, argument parsing, and OTEL boundaries | malformed MCP inputs, registry entries, runtime context fields, OTEL span/metric assertions |

TypeScript/JavaScript may be added as the second language fixture after the
Python path passes the MVP gates. C#, CloudFormation/SAM, graph reports, and
community analysis are post-MVP proof areas unless explicitly reduced to
resource-backed discovery fixtures.

## Tool Proof Gates

| Surface | Fixture | Required Evidence | Pass Gate |
| --- | --- | --- | --- |
| `repo:///status` | all fixtures | repo root, scope, freshness, capability coverage | fresh or degraded state is correct |
| `repo:///status` | `fixture-runtime-operations` | warm-up phase, queued work, active workers, degraded background work | cold, refreshing, fresh, stale, and degraded states are visible |
| `repo:///scope` | all fixtures | indexed roots, skipped roots, generated/vendor caveats | path scope matches fixture expectations |
| `repo:///overview` | `fixture-basic-python` | compact repo summary and language coverage | no source dump, no broad report |
| `context_for_task` | `fixture-basic-python` | ranked files/symbols, direct-read caveats, trust metadata | includes expected edit target and excludes unrelated files |
| `symbol_search` | `fixture-basic-python` | exact and fuzzy symbol lookup | expected symbols found under row/time budget |
| `find_references` | `fixture-basic-python` | references with confidence and unresolved caveats | expected references found; ambiguous refs labeled |
| `impact` | `fixture-basic-python` | bounded file/symbol impact | traversal depth and result cap enforced |
| `preview_workspace_edit` | `fixture-workspace-safety` | preview token, base hashes, affected files | no mutation before apply |
| `apply_workspace_edit` | `fixture-workspace-safety` | drift check, path containment, result metadata | stale or unsafe edits rejected |
| `verification_plan` | `fixture-basic-python` | planned diagnostics/tests with blocked states | plan names expected commands without executing by default |
| MCP registry | `fixture-runtime-boundaries` | tool/resource definitions, typed parsers, use-case binding, presenter binding | handlers do not hand-coerce raw MCP input |
| OTEL instrumentation | `fixture-runtime-boundaries` | dispatch, use-case, graph/query, worker, cache, presentation spans or metrics | operational telemetry exists without durable usage records |

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
| `tree-sitter` parser or grammar missing | code-language capability becomes `resource_backed` or `unsupported`; response explains missing primary parser |
| parser timeout or crash | stale or partial parser evidence is not trusted; response reports degraded extraction |
| optional enrichment missing | primary extraction remains available; no `semantic` label depends on the missing enrichment |
| test runner missing | `verification_status: blocked`; command is not invented as proven |
| stale watcher snapshot | freshness is `stale` or `refreshing`; mutation requires fresh preview |
| cold warm-up | reads expose cold/refreshing status instead of hidden broad work |
| concurrent refresh read | read uses last valid snapshot or reports refreshing/stale metadata |
| obsolete extraction result | result is rejected when file hash or snapshot id no longer matches |
| cache invalidation | add, modify, delete, rename, and config changes invalidate affected cache entries |
| malformed MCP input | shared argument parser returns structured invalid-input response before use case execution |
| runtime owner active | observer runtime reports owner state and does not start duplicate warm-up work |
| prewarm cache reuse | fresh prewarm snapshot is reused only when repo fingerprint and config still match |
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
- warm-up, cache invalidation, obsolete work rejection, concurrent reads, and
  single-writer graph transactions have fixture-backed tests
- registry, typed argument parser, runtime context, and OTEL boundary behavior
  have fixture-backed tests
- durable usage records are absent from MVP unless a fixture-backed workflow
  history query is added
- no MVP requirement depends on graph reports, usage analytics, C#, or
  CloudFormation/SAM semantic behavior

## Related Docs

- [Runtime contracts](runtime-contracts.md)
- [Workspace safety contract](workspace-safety-contract.md)
- [Agent IDE runtime MVP spec](../specs/001-agent-ide-runtime/spec.md)
