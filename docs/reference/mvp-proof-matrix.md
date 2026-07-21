---
title: MVP proof matrix
doc_type: reference
status: draft
owner: platform
last_reviewed: 2026-07-21
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
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
| daemon refresh integration | Prove one daemon controller and crash recovery | two clients, requester disconnect, generation catch-up, activity/idle race, ownership conflict, five publication crash barriers |
| installed-package MCP smoke | Prove packed runtime convergence below agent-CLI level | isolated tarball install, installed bin provenance, Codex- and Claude-labelled MCP sessions, deletion refresh, exact graph/docs queries, cleanup |
| `fixture-runtime-boundaries` | Prove runtime context, registries, argument parsing, and OTEL boundaries | malformed MCP inputs, registry entries, runtime context fields, OTEL span/metric assertions |
| `fixture-agent-integration-profile` | Prove common integration contract shape | Codex, Claude Code, Kiro, Augment, Gemini, and Junie target surfaces; unsupported-surface reasons; MCP binding metadata |
| `fixture-markdown-quality` | Prove post-MVP Markdown quality contract shape | skipped heading levels, inconsistent numbering, ambiguous nested lists, wide tables, frontmatter violations, broken links, unchanged documents |
| `fixture-go-service-repo` | Prove first-slice Go routing evidence | `.go` source files, `.gocache` skip behavior, `go.mod`, `Makefile`, package/function/type/method declarations, low-confidence impact when edges are absent |
| `fixture-cmake-cpp-repo` | Prove first-slice C/C++ and CMake routing evidence | C++ source/header files, `.pyi` stubs, local `CMakeLists.txt`, CMake targets, classes/methods/includes, incidental `package.json` that must not dominate validation planning |

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
| daemon refresh diagnostics | daemon integration fixtures | one controller/diagnostic identity, worker count, generations, target/visible snapshots, publication/freshness, lease, termination, failure | every client observes one legal awaited receipt; invalid receipts lower trust |
| refresh controller | runtime controller fixtures | linearized admission, reuse, newest-generation catch-up, finite deadline, one-result protocol, no automatic retry | at most one pass runs; one later ordinary request may recover a terminal failure |
| snapshot publication | graph-store fixtures plus tagged v0.5.2 adapter probe | versioned v1 seed, owner-gated rollback artifact and atomic legacy guard, transactional migration, generation-fenced publication, explicit unpublished reads, partial coverage, retention, reopen | actual v0.5.2 blocks on the guard; only published v2 rows are selectable; prior publication survives every pre-publication failure |
| crash and owner recovery | daemon and graph-store fixtures | positive death, bounded recovery chain, orphan disposition, five real process barriers, exact cleanup | orphan builds remain invisible and one later request converges without overlapping workers |
| installed package convergence | isolated packed install | installed bin realpath, two labelled clients, one daemon, worker delta, replacement snapshot, exact surviving/deleted evidence, cleanup | proves installed-bin MCP behavior; provider labels are not real Codex or Claude CLI execution proof |
| installed provider plugins | isolated packed install plus real Codex and Claude Code CLIs | installed manifests/launchers/hooks/skill provenance, runtime/plugin version, direct MCP evidence, exact SessionStart oracle, process/daemon/socket/install cleanup | both named CLIs load the packed `0.6.1` plugin, call its MCP surface, return the exact twelve unresolved occurrences, and pass all nine cleanup checks |
| `repo:///scope` | all fixtures | indexed roots, skipped roots, generated/vendor caveats | path scope matches fixture expectations |
| `repo:///scope` | `fixture-mixed-language-platform` | language/platform ids and unsupported/resource-backed areas | mixed repo scope is represented without Python-specific assumptions |
| `repo:///overview` | `fixture-basic-python` | compact repo summary and language coverage | no source dump, no broad report |
| `context_for_task` | `fixture-basic-python` | ranked files/symbols, direct-read caveats, trust metadata | includes expected edit target and excludes unrelated files |
| `context_for_task` | `fixture-basic-python` and `fixture-markdown-config` | complete-enough markers, skipped-work metadata, exact next actions | routes ambiguous or partial evidence to symbol/reference/impact or direct reads |
| `context_for_task` | `fixture-mixed-language-platform` | language-neutral routing and capability caveats | unsupported/resource-backed files appear as routing evidence only |
| `context_for_task` | `fixture-cmake-cpp-repo` | file-seeded ranking for headers, sources, local CMake files, tests, and stubs | adjacent build/test/source evidence ranks ahead of incidental repository matches |
| `symbol_search` | `fixture-basic-python` | exact and fuzzy symbol lookup | expected symbols found under row/time budget |
| `symbol_search` | `fixture-go-service-repo`, `fixture-cmake-cpp-repo` | routing-only Go and C/C++ declarations | expected symbols found with `resource_backed` capability and heuristic evidence |
| `find_references` | `fixture-basic-python` | references with confidence and unresolved caveats | expected references found; ambiguous refs labeled |
| `find_references` bounded completeness | `fixture-reference-completeness` | parser route exhaustion, ordered catalog continuation, exact count basis, candidate classification, authenticated cursors, and complete/partial trust | complete scan returns the exact twelve JS/TS occurrences; smaller budgets expose callable continuation; missing/changed/unreadable/oversized candidates prevent complete absence while policy exclusions stay outside the universe |
| `impact` | `fixture-basic-python` | bounded file/symbol impact | traversal depth and result cap enforced |
| `impact` | graph query and MCP error fixtures | unknown versus known-empty start-node behavior | an unknown published-snapshot node returns public `domain_error` with internal `impact_start_node_not_found` cause and callable same-snapshot symbol-search recovery; a known zero-edge node remains valid low-confidence evidence |
| `impact` | `fixture-go-service-repo`, `fixture-cmake-cpp-repo` | missing semantic-edge behavior | impact remains low confidence with `empty` or `local_only` scope when no parser-backed edges exist |
| public symbol presentation | `fixture-redaction-boundary` | shared redaction across signature, docstring, and source text | `symbol_search`, `find_references`, `impact`, and `context_for_task` redact protected values consistently without changing stored graph evidence or safe route text |
| `diagnostics_for_files` | `fixture-workspace-safety` | secret, excluded, and truly missing requested paths | safety exclusions block before provider invocation; other exclusions keep their reason; only absent safe paths report missing |
| `preview_workspace_edit` | `fixture-workspace-safety` | preview token, base hashes, affected files | no mutation before apply |
| `apply_workspace_edit` | `fixture-workspace-safety` | drift check, path containment, result metadata | stale or unsafe edits rejected |
| `verification_plan` | `fixture-basic-python` | planned diagnostics/tests with blocked states | plan names expected commands without executing by default |
| `verification_plan` | `fixture-basic-python` | planned versus proven runnable checks, test-discovery confidence, exact next actions | does not imply nearest-test proof when discovery is low confidence |
| `verification_plan` | `fixture-go-service-repo`, `fixture-cmake-cpp-repo` | repository-shape validation planning | Go and CMake/C++ evidence outrank incidental tooling; planned or blocked checks explain their evidence |
| Codex replacement readiness | `fixture-basic-python`, `fixture-markdown-config`, `fixture-mixed-language-platform` | first-pass context, docs/config routing, validation planning, test planning, and post-edit static feedback | workflows are discoverable through `context_for_task` and `verification_plan` without predecessor tool names or backend payloads |
| MCP registry | `fixture-runtime-boundaries` | tool/resource definitions, typed parsers, use-case binding, presenter binding | handlers do not hand-coerce raw MCP input |
| OTEL instrumentation | `fixture-runtime-boundaries` | dispatch, use-case, graph/query, worker, cache, presentation spans or metrics | operational telemetry exists without durable usage records |
| Integration profile contract | `fixture-agent-integration-profile` | target agents, MCP bindings, artifacts, unsupported surfaces, provenance | executable behavior remains MCP-first and vendor emitters stay outside core runtime |
| Markdown quality contract | `fixture-markdown-quality` | finding shape, formatter plan shape, source ranges, preview/apply safety metadata | executable tools remain post-MVP unless explicitly promoted |

## Refresh Convergence Proof Boundary

The proof layers are intentionally distinct:

- checkout/source entrypoint tests prove source composition and daemon behavior
  from this repository;
- install and MCP-launch smokes prove runtime-root and launcher wiring only;
- installed-package acceptance packs and installs the npm artifact into isolated
  roots, invokes that installed `agent-workbench-mcp` bin, and proves two
  provider-labelled sessions share one daemon and one replacement refresh;
- provider labels prove per-connection identity, not that the real Codex or
  Claude Code CLI loaded or invoked the plugin;
- Linux installed acceptance does not prove Windows named-pipe behavior.

The installed acceptance receipt includes executable realpath, daemon PID,
controller/execution/generation/snapshot agreement, worker invocation delta,
exact surviving reference and docs hits, deleted-evidence absence, and cleanup
of clients, daemon, socket, metadata, and temporary roots. A fresh final snapshot
or an empty unblocked query alone is not sufficient proof.

## Capability Proof Status

This table is a compact product-facing summary. The detailed fixture gates
above remain the proof source of truth.

| Capability | Current level | Fixture proof | Known limitation | Promotion blocker |
| --- | --- | --- | --- | --- |
| Python symbols | `partial_semantic` | passing MVP fixtures | broad impact requires direct verification | reference ambiguity and semantic promotion gates |
| Markdown/docs routing | `resource_backed` | passing docs fixtures | search is routing evidence only | exact claims require `docs_read_section` direct-read evidence |
| TypeScript/JavaScript declarations | `partial_semantic` | passing package/workspace fixtures | references and impact remain conservative | fixture-backed semantic promotion |
| Go declarations and references | `partial_semantic` | passing Go fixture slices | impact remains low confidence outside supported parser-backed edges | deeper semantic reference graph |
| C/C++ declarations | `resource_backed` to `partial_semantic` | passing CMake/C++ fixture slices | compile-aware semantics require external metadata | clangd/libclang readiness and compile DB policy |
| SAM/CloudFormation routing | `resource_backed` to `partial_semantic` | passing SAM fixture slices | stack semantics and deployment behavior are not proven | deeper infrastructure semantic model |
| Validation planning | `planning` | passing validation fixtures | commands may be planned but not executed | allowlist command-runner policy |
| Workspace edit | `workspace_write` | passing workspace-safety fixtures | requires preview token and drift checks | rollback remains post-MVP |

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
| refresh requester disconnect | controller activity lease retains execution; daemon idle shutdown waits for terminal settlement |
| invalidation during refresh | active unpublished pass is superseded and one newest-generation catch-up runs sequentially |
| worker timeout or invalid protocol | execution fails with bounded structured evidence; worker termination is confirmed before later admission |
| publication interruption | prior published snapshot remains selected; building/superseded/failed rows stay unavailable to ordinary and explicit readers |
| dead-owner orphan | cleanup requires positive death evidence, marks matching builds failed, and preserves bounded recovery history |
| generated/vendor target | write is refused unless explicitly allowed |
| possible secret | value is skipped or redacted from index/report output |
| secret diagnostics target | request is blocked before provider invocation and no follow-up contains the refused path |
| unknown impact node | invalid blocked domain response routes to `symbol_search`; it cannot masquerade as a valid empty traversal |

## Query Budget Evidence

Tests must capture enough trace evidence to prove hot-path tools use targeted
indexed reads. Acceptable evidence includes SQL trace assertions, query-plan
assertions, row-count caps, traversal-depth caps, and source-byte caps.

## Test Maintainability Gates

Architecture, MCP, extraction, validation, and broad fixture tests should stay
diagnostic enough that a failure points to one behavior cluster without losing
the smoke-test value of representative repositories.

- Boundary tests must parse static import/export module specifiers through the
  TypeScript compiler API instead of line-oriented string matching. They should
  cover multiline imports and enforce the current layered-runtime dependency
  direction.
- MCP behavior tests should use typed harness helpers for composed-server
  resources, tool lookup, direct dispatch, and response parsing. Direct registry
  plumbing belongs only in tests whose subject is the registry or
  instrumentation wrapper itself.
- Extracted validation-planner and resource-extractor rules should have focused
  unit or contract tests for package-script selection, ecosystem target
  selection, validation-policy discovery, static feedback, CMake targets, .NET
  project metadata, and CloudFormation/SAM resource evidence. Broad integration
  fixtures remain useful, but they should not be the only coverage for extracted
  rules.
- Broad fixture smoke tests should use named assertion helpers, smaller
  companion tests, or scenario comments when they grow or fail. Avoid mechanical
  splitting when one fixture intentionally proves cross-cutting behavior, but
  avoid assertion roulette inside large `it(...)` blocks.

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
- daemon ownership, generation coalescing, activity/idle lifetime, finite worker
  settlement, atomic publication, transactional migration, crash barriers,
  orphan recovery, and exact cleanup have fixture-backed tests
- packed-and-installed-bin two-client acceptance is recorded separately from
  checkout/source launcher tests and from any unproven real Codex/Claude CLI use
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
- [Spec closure log](../history/spec-closure-log.md)
