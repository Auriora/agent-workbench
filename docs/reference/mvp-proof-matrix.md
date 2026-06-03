---
title: MVP proof matrix
doc_type: reference
status: draft
owner: platform
last_reviewed: 2026-06-03
---

# MVP Proof Matrix

## Purpose

Define the minimum fixture-backed proof required before the Agent IDE runtime
MVP is considered implementation-ready.

## MVP Claim

For a local repository, the runtime provides fresh scoped context,
symbol/reference evidence, bounded edit preview/apply behavior, and a validation
plan without hidden broad scans or unsafe workspace behavior.

The MVP also proves the usage-heavy first-pass loop identified in the
predecessor `agent-ide` traces: status/scope, bounded task context, docs/config
routing evidence, validation planning, and edit safety metadata. Targeted
symbol/reference/impact tools must be callable directly and also surfaced as
exact next actions from first-pass context or validation responses.

The MVP must also prove the key restart difference from `agent-ide`: the core
runtime is language-, framework-, and platform-neutral. Python is the first
partial-semantic adapter, but unsupported or resource-backed non-Python areas
must appear in status, scope, and context with explicit capability metadata.

## Fixture Set

| Fixture | Purpose | Required Contents |
| --- | --- | --- |
| `fixture-basic-python` | Prove one partial-semantic language path | package/module structure, imports, duplicate symbol names, tests, one edit target |
| `fixture-markdown-config` | Prove routing evidence | Markdown links, path mentions, config files, ignored/generated roots |
| `fixture-mixed-language-platform` | Prove language-neutral core behavior | Python plus TypeScript/JavaScript, shell/config, CI/container or infrastructure files with unsupported/resource-backed capability expectations |
| `fixture-degraded-tools` | Prove degraded behavior | missing `tree-sitter` parser/grammar, parser failure, missing optional enrichment, and missing test runner cases |
| `fixture-workspace-safety` | Prove path and command refusal | symlink escape, generated root, `.env`, shell-looking command args |
| `fixture-runtime-operations` | Prove cache, warm-up, and concurrency behavior | cold start, watcher update, queued extraction, parser timeout, obsolete result, concurrent read |
| `fixture-runtime-boundaries` | Prove runtime context, registries, argument parsing, and OTEL boundaries | malformed MCP inputs, registry entries, runtime context fields, OTEL span/metric assertions |
| `fixture-agent-integration-profile` | Prove common integration contract shape | Codex, Claude Code, Kiro, Augment, Gemini, and Junie target surfaces; unsupported-surface reasons; MCP binding metadata |
| `fixture-markdown-quality` | Prove post-MVP Markdown quality contract shape | skipped heading levels, inconsistent numbering, ambiguous nested lists, wide tables, frontmatter violations, broken links, unchanged documents |

TypeScript/JavaScript may be added as the second language fixture after the
Python path passes the MVP gates. C#, CloudFormation/SAM, graph reports, and
community analysis are post-MVP proof areas unless explicitly reduced to
resource-backed discovery fixtures.

## Tool Proof Gates

| Surface | Fixture | Required Evidence | Pass Gate |
| --- | --- | --- | --- |
| `repo:///status` | all fixtures | repo root, scope, freshness, capability coverage | fresh or degraded state is correct |
| `repo:///status` | `fixture-mixed-language-platform` | per-language/platform capability coverage | non-Python areas are explicit, not silently ignored |
| `repo:///status` | `fixture-runtime-operations` | warm-up phase, queued work, active workers, degraded background work | cold, refreshing, fresh, stale, and degraded states are visible |
| `repo:///scope` | all fixtures | indexed roots, skipped roots, generated/vendor caveats | path scope matches fixture expectations |
| `repo:///scope` | `fixture-mixed-language-platform` | language/platform ids and unsupported/resource-backed areas | mixed repo scope is represented without Python-specific assumptions |
| `repo:///overview` | `fixture-basic-python` | compact repo summary and language coverage | no source dump, no broad report |
| `context_for_task` | `fixture-basic-python` | ranked files/symbols, direct-read caveats, trust metadata | includes expected edit target and excludes unrelated files |
| `context_for_task` | `fixture-basic-python` and `fixture-markdown-config` | complete-enough markers, skipped-work metadata, exact next actions | routes ambiguous or partial evidence to symbol/reference/impact or direct reads |
| `context_for_task` | `fixture-mixed-language-platform` | language-neutral routing and capability caveats | unsupported/resource-backed files appear as routing evidence only |
| `symbol_search` | `fixture-basic-python` | exact and fuzzy symbol lookup | expected symbols found under row/time budget |
| `find_references` | `fixture-basic-python` | references with confidence and unresolved caveats | expected references found; ambiguous refs labeled |
| `impact` | `fixture-basic-python` | bounded file/symbol impact | traversal depth and result cap enforced |
| `preview_workspace_edit` | `fixture-workspace-safety` | preview token, base hashes, affected files | no mutation before apply |
| `apply_workspace_edit` | `fixture-workspace-safety` | drift check, path containment, result metadata | stale or unsafe edits rejected |
| `verification_plan` | `fixture-basic-python` | planned diagnostics/tests with blocked states | plan names expected commands without executing by default |
| `verification_plan` | `fixture-basic-python` | planned versus proven runnable checks, test-discovery confidence, exact next actions | does not imply nearest-test proof when discovery is low confidence |
| Codex replacement readiness | `fixture-basic-python`, `fixture-markdown-config`, `fixture-mixed-language-platform` | first-pass context, docs/config routing, validation planning, test planning, and post-edit static feedback | workflows are discoverable through `context_for_task` and `verification_plan` without predecessor tool names or backend payloads |
| MCP registry | `fixture-runtime-boundaries` | tool/resource definitions, typed parsers, use-case binding, presenter binding | handlers do not hand-coerce raw MCP input |
| OTEL instrumentation | `fixture-runtime-boundaries` | dispatch, use-case, graph/query, worker, cache, presentation spans or metrics | operational telemetry exists without durable usage records |
| Integration profile contract | `fixture-agent-integration-profile` | target agents, MCP bindings, artifacts, unsupported surfaces, provenance | executable behavior remains MCP-first and vendor emitters stay outside core runtime |
| Markdown quality contract | `fixture-markdown-quality` | finding shape, formatter plan shape, source ranges, preview/apply safety metadata | executable tools remain post-MVP unless explicitly promoted |

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
| next-action routing | 50 ms | uses existing response evidence; no extra graph traversal |

## Degraded-Mode Gates

| Case | Expected Behavior |
| --- | --- |
| `tree-sitter` parser or grammar missing | code-language capability becomes `resource_backed` or `unsupported`; response explains missing primary parser |
| parser timeout or crash | stale or partial parser evidence is not trusted; response reports degraded extraction |
| optional enrichment missing | primary extraction remains available; no `semantic` label depends on the missing enrichment |
| unsupported language/platform | capability is `unsupported` or `resource_backed`; response includes direct-read caveat or adapter-next-action metadata |
| test runner missing | `verification_status: blocked`; command is not invented as proven |
| stale watcher snapshot | freshness is `stale` or `refreshing`; mutation requires fresh preview |
| cold warm-up | reads expose cold/refreshing status instead of hidden broad work |
| concurrent refresh read | read uses last valid snapshot or reports refreshing/stale metadata |
| obsolete extraction result | result is rejected when file hash or snapshot id no longer matches |
| cache invalidation | add, modify, delete, rename, and config changes invalidate affected cache entries |
| compact hidden broad work | compact/default responses report skipped work or use targeted indexed evidence only |
| low-confidence routing | response gives exact next action for direct read, symbol search, references, impact, or validation follow-up |
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
- first-pass context and validation responses include complete-enough markers,
  skipped-work metadata, and exact next actions
- mixed-language/platform fixtures prove core contracts are language-neutral
  and unsupported/resource-backed areas are explicit
- every degraded mode returns structured metadata and next action
- warm-up, cache invalidation, obsolete work rejection, concurrent reads, and
  single-writer graph transactions have fixture-backed tests
- registry, typed argument parser, runtime context, and OTEL boundary behavior
  have fixture-backed tests
- integration profile and Markdown quality contract shapes have fixture-backed
  tests when those architecture contracts are included in the implementation
  slice
- durable usage records are absent from MVP unless a fixture-backed workflow
  history query is added
- no MVP requirement depends on graph reports, usage analytics, C#, or
  CloudFormation/SAM semantic behavior

## Related Docs

- [Runtime contracts](runtime-contracts.md)
- [Workspace safety contract](workspace-safety-contract.md)
- [Agent IDE runtime MVP requirements](../specs/001-agent-ide-runtime/requirements.md)
