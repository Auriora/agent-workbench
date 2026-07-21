---
title: Agent Workbench backlog
doc_type: backlog
status: draft
owner: platform
last_reviewed: 2026-07-21
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Agent Workbench Backlog

## Purpose

This backlog turns the Agent Workbench principles and mined product signals
into scoped work that can be promoted into specs, fixtures, implementation
tasks, and validation evidence.

A backlog item is executable when it has:

- a friction signal from history, smoke tests, hooks, telemetry, or dogfood;
- an agent-facing runtime surface or behavior to change;
- fixture-backed acceptance criteria;
- validation evidence that can prove success or expose a blocked state;
- a promotion target such as an active spec, follow-up spec, durable design
  document, or implementation task.

## Mining Taxonomy

Chat-history mining should classify repeated agent friction into these product
signals:

- repeated user corrections, such as wrong repo, wrong file, wrong test,
  missing MCP use, unsafe command choice, or edits the user did not ask for;
- try/fail/change loops caused by missing dependencies, wrong package manager,
  wrong Docker context, wrong command surface, or fallback to another tool;
- validation uncertainty, such as unclear test choice, insufficient evidence,
  skipped tests, missing native builds, or blocked local environments;
- repo orientation waste, including repeated `ls`, `find`, broad `rg`, README
  reads, and `AGENTS.md` reads before useful task work begins;
- wrong-surface use, such as shell use when a domain MCP is available, or
  choosing one agent IDE surface when the requested surface is another;
- dirty worktree and wrong-repo mistakes, including generated artifacts,
  temporary docs, `.cache/`, unrelated reversions, and accidental target-repo
  edits;
- broad routing failures where generated, vendor, wrong-language, or irrelevant
  docs dominate useful first-party evidence;
- subagent handoff problems, including repeated setup, unclear file ownership,
  duplicated work, missing validation packets, and weak blocker transfer;
- tool trust failures, including incomplete MCP startup, unexposed tools,
  stale caches, wrong repo roots, timeouts, misleading green results, and
  unavailable next actions;
- human process encoded in chat, including repeated spec lifecycle, PR review,
  deployment, smoke-test, release, and dogfood workflows that should become
  agent-facing tools or packets.

## Evidence Sources To Mine

Use multiple evidence sources because chat transcripts only show the visible
part of the workflow:

- hook logs for deferred diagnostics, timeout reasons, unknown tool failures,
  cache refresh volume, and quiet-success behavior;
- local runtime traces for slow MCP tools, common call sequences, degraded
  spans, and shell fallback after a tool should have helped;
- git history for fixes to agent mistakes, generated-artifact cleanup,
  validation-policy changes, and recurring repair commits;
- PR review comments for bugs, stale docs, missing tests, generated artifacts,
  and risky diffs that an agent IDE could catch before review;
- CI failures for wrong validation slices, missing generated or native setup,
  environment mismatch, and package-manager mistakes;
- `AGENTS.md` files across repositories, because repeated instructions are
  product requirements for agent support;
- spec and task docs for traceability pain, closure checks, open decisions,
  design/requirements mismatches, and implementation drift;
- shell history or command logs when available, to learn what agents and users
  actually run to verify work;
- MCP server logs for tool visibility, session lifecycle, protocol errors,
  long calls, malformed arguments, and transport mismatch;
- issue trackers and backlogs for repeated "agent forgot", "tool timed out",
  "needs better validation", and "wrong docs" reports;
- existing human IDE features such as symbol outline, problems panel, test
  explorer, source-control view, call hierarchy, refactor preview, task runner,
  and extension marketplace;
- comparable agent tooling patterns, translated into local, fixture-backed
  Agent Workbench requirements instead of copied by name.

### Evidence Source Decisions

These sources are approved for future mining only when the implementation stays
local-first, read-only by default, bounded, and redacted. They are planning
evidence, not proof, until confirmed by direct repo inspection, fixture tests,
or runtime telemetry.

| Source | Decision | First automation shape | Guardrails | Backlog route |
| --- | --- | --- | --- | --- |
| Codex chat history and sessions | Mine now | Existing local JSONL scanner with repo filtering, category counts, and bounded excerpts | Do not emit full transcripts; keep generated reports under `.tmp/` unless manually promoted | EB009 |
| Codex hook logs | Mine now | Existing scanner status/reason counts plus category matching | Clean and errored hooks remain quiet; use aggregate reasons, not noisy per-event output | EB005, EB009 |
| Local runtime traces | Mine next | Span summary for slow tools, degraded states, skipped evidence, retry/fallback chains, and shell fallback after tool availability | Local/exported traces only; redact attributes; never require a live trace service for normal validation | EB001, EB003, EB009 |
| MCP server logs | Mine next | Transport/session/tool-list error summaries and long-call aggregates | Treat protocol logs as operational evidence; redact arguments and paths outside the repo | EB001, EB007, EB009 |
| `AGENTS.md` files | Mine next | Repo instruction inventory for repeated validation, safety, dependency, and workflow requirements | Read-only scan; preserve repository scope and precedence; do not rewrite instructions automatically | EB004, EB008, EB009 |
| Spec and task docs | Mine next | Active/archived spec inventory, traceability gaps, stale open decisions, missing verification evidence | Defer generic lifecycle ownership to spec-lifecycle-manager; Agent Workbench only consumes task context | EB006, EB009 |
| Git history | Mine later | Commit-message and changed-file summaries for generated-artifact cleanup, validation fixes, and recurring agent repair commits | Avoid mining private author intent; classify only local repo metadata and bounded diffs | EB008, EB009 |
| Review comments | Mine later | Review finding categories for missing tests, stale docs, risky diffs, and generated artifacts | Require explicit review context; do not make network access part of local default scans | EB005, EB008, EB009 |
| CI logs | Mine later | Failed-check summaries for wrong validation slices, missing native builds, environment mismatch, and package-manager errors | Use bounded logs from explicit local files or approved CI context; redact secrets | EB004, EB009 |
| Shell command logs | Defer | Optional command-frequency and failure-pattern summary when a reliable local source exists | Do not scrape interactive shell history by default; require explicit opt-in and redaction design | EB004, EB009 |
| Issue trackers and backlogs | Defer | Category summary when a project provides exported local issue/backlog data | No network default; treat external tracker content as advisory planning evidence | EB009 |
| Human IDE feature references | Mine manually | Reference matrix for problems panel, test explorer, SCM, call hierarchy, refactor preview, and task runner patterns | Do not copy product-specific UX; translate only agent-facing workflow needs | EB001, EB004, EB005, EB010 |
| Other agent tools and MCPs | Mine manually | Capability comparison notes for portable behavior that Agent Workbench should match or exceed | Do not import Python-specific or deprecated implementations; use fixture-backed portable lessons only | EB007, EB010, EB016 |

## Sequencing

1. Integration health and session-aware next actions.
2. Contextual tool exposure and dynamic routing.
3. First-read reliability and bounded tool behavior.
4. Edit, diagnostics, validation, and repair loop.
5. Spec/task traceability and MCP-server repo support.
6. Fallback telemetry and mined evidence automation.
7. Language and ecosystem semantic depth.

## Backlog Items

### EB001: Integration Health Surface

- Priority: P0
- Status: closed Spec 019
- Friction signal: agents saw mismatches between advertised, discovered, and
  callable MCP surfaces, and received next actions for tools unavailable in the
  active session.
- Runtime surface: MCP integration health packet for resources, tools,
  profiles, repo root, and runtime version.
- Acceptance:
  - Report advertised, registered, and caller-discovered MCP resources and
    tools.
  - Include repo root, default profile, active profile, and runtime version.
  - Mark unavailable surfaces with reasons instead of presenting them as next
    actions.
  - Present a compact next workflow that only names callable surfaces unless an
    unavailable surface is explicitly labeled as missing.
- Validation:
  - Contract tests for full, partial, and missing tool/resource registration.
  - Codex-profile fixture tests for discovered versus callable surfaces.
  - Golden MCP responses that suppress unavailable tools from executable next
    actions.
- Promotion target: closed
  [Spec 019](../history/spec-closure-log.md),
  combined with EB002 and EB011.
- Residual follow-up (2026-07-19): delivered by closed
  [Spec 040](../history/spec-closure-log.md). Provider-aware health now reports
  configured, registered, caller-proven, and unknown state without inferring a
  client from the server process; caller discovery is accepted only by the
  argument-bearing health tool.

### EB002: Session-Aware Next Actions

- Priority: P0
- Status: closed Spec 019
- Friction signal: agents follow runtime next actions literally; unavailable
  next actions weaken trust and force shell fallback.
- Runtime surface: presenters for `context_for_task`, verification planning,
  docs, symbol tools, diagnostics, and integration profile.
- Acceptance:
  - Next actions only include callable tools, readable resources, or explicit
    unavailable actions with missing-evidence reasons.
  - Responses explain whether the gap is session configuration, runtime
    capability, repo indexing, or blocked validation.
  - Golden responses cover full, partial, and unknown session capability.
- Validation:
  - Golden MCP responses with and without symbol search, references, impact,
    diagnostics, and docs surfaces.
  - Contract tests ensuring unavailable actions are not presented as executable
    commands.
- Promotion target: closed
  [Spec 019](../history/spec-closure-log.md),
  combined with EB001 and EB011.

### EB003: First-Read Reliability And Bounded Tool Behavior

- Priority: P0
- Status: delivered by closed Spec 037
- Friction signal: smoke tests exposed status timeouts, verification-plan
  timeouts, resource timeouts, and a need for tools to be callable only when
  timely evidence exists.
- Runtime surface: status, scope, overview, context, docs, diagnostics, and
  verification resources/tools.
- Acceptance:
  - Return valid, stale, degraded, or blocked envelopes rather than partial
    results for timeout, crash, or unavailable evidence.
  - Surface slow hidden work as skipped, queued, stale, or missing evidence.
  - Add budget tests and timeout fixtures for first-read resources.
- Validation:
  - Runtime fixtures for cold, refreshing, stale, failed, and
    permission-limited repos.
  - Cross-repo smoke summaries for representative repo shapes.
  - Local trace spans for latency, degraded state, and skipped evidence.
- Promotion target: closed
  [Spec 037](../history/spec-closure-log.md) delivered current-state first-read
  metadata, bounded hidden-work evidence,
  provider-limited diagnostics handling, non-executed validation-plan trust
  boundaries, and durable documentation promotion.
- Residual routing: persisted graph completion beyond the first-pass graph
  budget remains in EB014. Telemetry/reporting evidence remains in EB009.

### EB004: Policy-Aware Validation Planning

- Priority: P0
- Status: active implementation surface
- Friction signal: agents repeatedly try commands, discover missing tools or
  wrong environments, then change validation strategy manually. On 2026-07-19,
  Claude Code asked `verification_plan` how to validate a Claude SessionStart
  hook payload change; the planned result contained only `pnpm typecheck` and
  `pnpm test`, omitting the repository's plugin, skill, and package-payload CI
  gates. The same response expanded roughly 50 generated/vendor paths around
  the two useful commands instead of summarizing the skipped work.
- Runtime surface: `verification_plan`, repo policy discovery, command safety,
  and validation protocol.
- Acceptance:
  - Prefer repo scripts, docs, and policy files before generic validation
    commands.
  - For plugin and package changes, discover and rank task-relevant
    repository-owned package and CI gates alongside language-wide checks; do
    not return only generic commands when more specific policy evidence exists.
  - Summarize repeated skipped paths by reason, count, and a bounded sample
    rather than emitting one entry per generated or vendor path.
  - Detect Docker, devcontainer, Nix, Bazel, package-manager, host-blocked, and
    missing-tool constraints where evidence exists.
  - Distinguish planned, blocked, and executed validation.
  - Explain why each proposed command is relevant.
- Validation:
  - Fixtures for host-allowed, Docker-required, missing-tool, package-manager,
    CMake, .NET, SAM, Go, Python, JavaScript, and docs-only repos.
  - Golden responses for blocked and low-confidence validation plans.
  - A SessionStart plugin-hook regression includes typecheck, test,
    `validate:plugin`, `validate:skills`, and `pack:dry-run` exactly once with
    repository-backed reasons; a 50-path generated/vendor fixture returns one
    counted summary with a bounded sample.
- Promotion target: continue current `verification_plan` work and promote weak
  ecosystem evidence into focused adapter specs.

### EB005: Multi-File Post-Edit Repair Loop

- Priority: P1
- Status: closed Spec 020
- Friction signal: hook logs show `too_many_files` and
  `too_many_files_for_inline_hook`; Agent IDE diagnostics and post-edit
  feedback were high-value signals.
- Runtime surface: `diagnostics_for_files`, internal post-edit feedback,
  hooks, and validation planning.
- Acceptance:
  - Common multi-file edits produce bounded diagnostics, queued checks, or a
    structured skipped state.
  - Clean results stay quiet.
  - Optional or unavailable diagnostics stay quiet unless explicitly requested
    or actionable.
  - Output includes concise next verification actions when diagnostics cannot
    prove correctness.
- Validation:
  - Hook tests for clean, actionable, timeout, unavailable, and multi-file
    cases.
  - Provider tests for bounded diagnostics and structured skipped results.
  - Telemetry for deferred diagnostic reasons.
- Promotion target: closed
  [Spec 020](../history/spec-closure-log.md).

### EB006: Spec And Task Traceability Lookup

- Priority: P1
- Status: closed Spec 021
- Friction signal: spec-driven work needs fast mapping from task IDs to
  requirements, design sections, files, validation gates, open decisions, and
  closure requirements.
- Runtime surface: Agent Workbench task context, with optional
  spec-lifecycle-manager MCP or skill integration.
- Acceptance:
  - Given a spec path or task ID, route agents to the authoritative
    spec-lifecycle-manager task context or traceability lookup when that MCP or
    skill is available.
  - Consume lifecycle preflight, task detail, validation plan, evidence
    quality, task-state audit, and closure-risk outputs as upstream context
    before broad Agent Workbench repo search when the companion runtime is
    discovered and callable.
  - When spec-lifecycle-manager is unavailable, return bounded local routing
    evidence and clearly label it as non-authoritative.
  - Distinguish active specs from archived delivery records without suggesting
    migration, closure, or task-status changes.
  - Keep lifecycle ownership, Kiro-style templates, reconciliation, promotion,
    closure checks, and spec transition hooks in spec-lifecycle-manager.
  - Do not move generic spec-template ownership into Agent Workbench.
- Validation:
  - Fixture specs for active, archived, malformed, and traceability-rich
    packages.
  - Golden task-context responses that route agents to spec-lifecycle-manager
    tools plus files and checks.
- Promotion target: closed
  [Spec 021](../history/spec-closure-log.md).

### EB007: MCP Server Repository Support

- Priority: P1
- Status: closed Spec 022
- Friction signal: MCP server repos require transport, session, tool-list,
  HTTP/SSE, stdio, Docker, and log debugging context.
- Runtime surface: repo-shape detection, context packets, docs routing,
  validation planning, and future MCP diagnostics.
- Acceptance:
  - Detect repositories that implement MCP servers.
  - Surface transport modes, server entrypoints, tool registry, protocol docs,
    smoke commands, and relevant logs where evidence exists.
  - Plan initialize, tools/list, session, and call-tool validation without
    executing unsafe commands.
- Validation:
  - Fixture MCP server repos for stdio, HTTP/SSE, and streamable HTTP shapes.
  - Golden context and validation-plan responses.
- Promotion target: closed
  [Spec 022](../history/spec-closure-log.md).

### EB008: Workspace Hygiene And Wrong-Repo Guard

- Priority: P1
- Status: proposed spec
- Friction signal: agents created or discussed work in the wrong repository,
  risked generated `.cache` artifacts, or needed correction around local
  workspace boundaries.
- Runtime surface: workspace safety, edit preview/apply, pre-final feedback,
  git status, and generated-artifact policy.
- Acceptance:
  - Surface writes outside the intended repo or docs root.
  - Detect generated runtime artifacts and local cache files before commit or
    final handoff.
  - Separate user changes from agent changes in pre-final summaries.
- Validation:
  - Fixtures for generated artifacts, nested repos, dirty user files, and
    external feedback paths.
  - Golden pre-final feedback for clean, risky, and blocked workspace states.
- Promotion target: create a future workspace-safety or edit-loop spec.

### EB009: Fallback Telemetry And History Mining

- Priority: P2
- Status: archived Spec 018 plus future follow-up work
- Friction signal: local history scans and hook logs expose repeated product
  issues that do not appear in static repo fixtures.
- Runtime surface: `src/debug/codex-history-mining.ts`, local traces, hooks,
  and future usage summaries.
- Acceptance:
  - Scanner summarizes repo categories and hook counts.
  - Telemetry captures latency, degraded, skipped, fallback, and blocked
    states.
  - Reports stay bounded and avoid publishing full transcripts.
- Validation:
  - Spec 018 scanner run against Agent Workbench.
  - Future synthetic history fixture report tests.
- Promotion target: closed
  [Spec 018](../history/spec-closure-log.md);
  defer public MCP usage resources until privacy and storage policy are
  explicit.

### EB010: Language And Ecosystem Semantic Promotion

- Priority: P2
- Status: ongoing backlog stream
- Friction signal: broad routing and impact analysis are weak when language or
  project-shape evidence is shallow.
- Runtime surface: language adapters, graph extraction, symbol search,
  references, impact, project-shape adapters, and validation planning.
- Acceptance:
  - Promote ecosystem capabilities only through fixture gates.
  - Label semantic proof, routing evidence, and heuristics distinctly.
  - Improve validation planning with project-shape evidence before command
    execution.
  - Use recent active-project evidence when reviewing roadmap priority; do not
    rank ecosystems by raw file counts, generated output, dependency trees, or
    one unusually large repository.
  - Allow identified tester availability to raise implementation priority when
    the tester can exercise the priority tools and provide concrete feedback.
  - Treat local project scans as advisory evidence until a candidate ecosystem
    has representative fixture repositories and validation expectations.
- Validation:
  - Closed delivery records and future specs for language and ecosystem
    adapters.
  - Local project scans should record broad ecosystem signals without naming
    external repositories or people.
  - Recency review should count distinct recently touched project shapes per
    ecosystem and promote only those with representative fixtures and tester
    availability.
- Promotion target: create focused language or ecosystem specs when fixture
  gates, recent project evidence, and tester availability justify promotion.

### EB011: Contextual Tool Exposure And Dynamic Router

- Priority: P0
- Status: closed Spec 019
- Friction signal: large static tool catalogs create discovery burden, while
  hidden or unavailable tools create trust failures. Agents need the currently
  relevant tool surface without losing access to advanced capabilities that are
  only useful in specific repo, task, or session contexts.
- Runtime surface: either an always-present `dynamic` router tool that exposes
  or invokes context-appropriate subtools, startup/session-time tool exposure
  that adds or hides tools based on context, or a documented hybrid of both.
- Acceptance:
  - Define whether contextual tool access is implemented through one stable
    `dynamic` tool, startup-time tool registration, session-time tool
    registration, or a hybrid.
  - The always-present surface must explain what capabilities are available,
    hidden, unavailable, or blocked for the current repo and task context.
  - Hidden tools must remain discoverable through an explicit capability
    explanation, not disappear without evidence.
  - Contextual routing must not present unavailable actions as executable.
  - Tool exposure decisions must include repo root, project shape, active
    profile, cache freshness, and relevant policy constraints.
  - Agents must be able to ask why a tool is hidden, why it is available, and
    what evidence would make another tool available.
- Validation:
  - Contract tests for always-present `dynamic` routing, context-shaped tool
    lists, and hybrid behavior.
  - Golden responses for small repos, large polyglot repos, docs-only repos,
    MCP-server repos, dirty worktrees, and degraded caches.
  - Session-profile tests proving unavailable tools are hidden or labeled
    consistently across startup and runtime surfaces.
  - Regression tests ensuring exact next actions only reference callable tools
    or explicitly labeled unavailable capabilities.
- Promotion target: closed
  [Spec 019](../history/spec-closure-log.md),
  combined with EB001 and EB002.

### EB012: TODO And Annotation Tag Surfacing

- Priority: P2
- Status: proposed spec
- Friction signal: agent orientation often misses explicit maintainer intent
  already present in source comments, docs, and config notes such as `TODO`,
  `FIXME`, `XXX`, `HACK`, `BUG`, `NOTE`, `DEPRECATED`, and project-specific
  tags.
- Runtime surface: status/scope summaries, `context_for_task`, docs/search
  surfaces, optional annotation-specific query surface, and future
  pre-final/review readiness feedback.
- Acceptance:
  - Discover common annotation tags in source, docs, and config while honoring
    ignore rules, generated/vendor boundaries, hidden-path policy, budgets, and
    redaction rules.
  - Preserve repo-relative file paths, line numbers, tag type, language, short
    snippet, and confidence/provenance without treating comments as semantic
    proof.
  - Rank annotations near selected files or task context above broad repo-wide
    tag counts.
  - Distinguish actionable tags from informational notes and stale/noisy tags.
  - Support project-local tag configuration only through explicit durable
    policy or config evidence; do not infer arbitrary uppercase words as tags.
  - Keep clean results quiet in hooks and avoid surfacing annotation noise in
    normal responses unless task context makes it relevant.
- Validation:
  - Fixtures for source comments, Markdown task notes, config comments,
    generated/vendor paths, hidden paths, redacted values, large repos, and
    project-specific tag policy.
  - Golden responses for context-adjacent annotations, repo-wide summary,
    no-results, budget-truncated, and generated/vendor-skipped states.
  - Regression tests proving annotations do not promote capability level,
    semantic confidence, or validation status by themselves.
- Promotion target: create a future context-routing or review-readiness spec
  after higher-priority integration, repair-loop, and validation-planning work.

### EB013: HTML And Web Markup Quality Support

- Priority: P2
- Status: proposed spec
- Friction signal: agents working in web repositories need fast evidence for
  HTML and related markup syntax, lint, formatter, template, and accessibility
  checks before broad test execution.
- Runtime surface: language adapters, diagnostics providers,
  `diagnostics_for_files`, `verification_plan`, post-edit feedback, and future
  web-markup quality tools.
- Acceptance:
  - Detect HTML, XHTML, SVG, and common HTML-template files as explicit
    repository evidence rather than generic text.
  - Provide parser-backed syntax diagnostics where an approved HTML/markup
    parser exists; otherwise return unsupported or blocked evidence instead of
    silently falling back to string scanning.
  - Plan repo-approved lint, formatter, template, accessibility, and browser or
    component checks from package scripts, config files, and policy docs without
    executing commands by default.
  - Distinguish static HTML from framework templates whose correctness depends
    on a specific templating engine or build step.
  - Keep formatter or auto-fix behavior behind preview/apply workspace safety;
    read-only diagnostics and validation planning must land first.
  - Preserve capability labels for syntax diagnostics, lint planning,
    formatting planning, template validation, accessibility hints, and runtime
    browser checks separately.
- Validation:
  - Fixtures for valid HTML, malformed HTML, SVG, generated/vendor markup,
    frontend package scripts, formatter/linter config, and missing-tool states.
  - Template fixtures for at least one common server-side or component-template
    shape, with engine-specific checks blocked unless repo evidence identifies
    the engine.
  - Golden diagnostics, post-edit feedback, and validation-plan responses for
    clean, finding, unsupported, blocked, and budget-truncated states.
  - Regression tests proving HTML/template evidence does not promote JavaScript
    or TypeScript semantic capability by itself.
- Promotion target: create a future language or web-markup quality spec under
  EB010 after current P0/P1 repair-loop and validation-planning work.

### EB014: Large-Repo Graph Warmup Scale And Progress

- Priority: P1
- Status: proposed spec
- Friction signal: large-repo startup warmup no longer stack-overflows after
  traversal fixes, but full graph warmup remained CPU-bound for more than four
  minutes while the snapshot stayed
  `refreshing`; the run had already written roughly 159k nodes and 247k edges
  before it was stopped. Spec 036 fixed docs-first searchability and explicit
  non-complete graph coverage for bounded first-pass warmup, but deliberately
  deferred a persisted completion executor for files beyond the first-pass graph
  budget to this backlog item.
- Runtime surface: MCP startup warmup, `repo:///status`, graph extraction,
  graph write batching, docs indexing, runtime telemetry, and cache/snapshot
  state.
- Acceptance:
  - Large repositories return first-read status promptly without hiding active
    warmup, failed warmup, or stale/cold graph evidence.
  - Startup warmup exposes progress evidence such as scanned files, extracted
    files, current phase, graph rows written, elapsed time, and next action.
  - Graph writes and reference resolution are bounded or chunked so a large
    repository cannot monopolize a session without observable progress.
  - Warmup completion, cancellation, failure, and stale partial snapshots are
    represented as structured states, not silent background work.
  - Re-running warmup after an interrupted large-repo run should either resume
    safely or replace the incomplete snapshot atomically with clear ownership
    and freshness state.
  - A bounded first-pass graph warmup that stops before all eligible files are
    indexed should have one production completion path with durable cursor,
    owner, cancellation, retry, and stale-repository semantics; until that path
    exists, public metadata must continue to report non-complete graph coverage.
  - Performance fixes must not add parser, semantic, or command-execution
    fallbacks; they should address the actual indexing/write bottleneck.
- Validation:
  - Fixture or synthetic large-repo graph warmup tests with bounded generated
    files, resource-backed templates, Markdown docs, and parser-backed source.
  - Regression using a large-repo fixture or recorded metrics for the observed
    159k-node/247k-edge warmup scale.
  - Tests for interrupted warmup, stale refreshing snapshots, progress
    reporting, and subsequent restart behavior.
  - Telemetry or debug harness output that records phase timings and row-count
    growth without requiring a live external tracing service.
- Promotion target: create a future runtime operations or graph-store scale
  spec under EB003, with telemetry evidence routed through EB009.

### EB015: Markdown Document Audit Scale And Chunking

- Priority: P1
- Status: candidate spec
- Friction signal: large documentation-set dogfooding found roughly 150 durable
  Markdown docs outside `docs/specs`. A first Markdown quality call was too
  broad for the current `check_markdown_set` limit, forcing a filesystem
  inventory pass and focused subset calls.
- Runtime surface: `check_markdown_set`, `check_markdown_document`,
  `verification_plan`, docs inventory/routing, Markdown quality metadata,
  response budgets, and telemetry.
- Acceptance:
  - Agents can audit large durable-doc sets through deterministic chunks
    without switching to an unstructured filesystem-only workflow.
  - `check_markdown_set` exposes enough continuation evidence for agents to
    continue a large audit by scope, offset, cursor, or returned next action
    without re-planning from scratch.
  - Broad document audits remain bounded and return structured partial states
    instead of invalid input, hidden truncation, or generic "too broad" advice.
  - Set checking should scan repository Markdown inventory once per set call
    and reuse that inventory for individual document checks instead of
    rescanning the repository for every selected document.
  - Results distinguish unchecked, skipped, checked-clean, checked-with-findings,
    and budget-truncated documents so final audit coverage is measurable.
  - Durable-doc audits can exclude active spec packages by intent while still
    supporting explicit `docs/specs` checks when requested.
  - Telemetry records document counts, chunk size, checked count, skipped count,
    finding count, truncation, and elapsed time without logging document bodies.
- Validation:
  - Synthetic fixture with at least 150 Markdown docs across `docs/data-flow`,
    `docs/reference`, `docs/runbooks`, and `docs/specs`.
  - Golden responses for first chunk, continuation chunk, final chunk,
    spec-excluded audit, explicit spec-included audit, and budget-truncated
    audit.
  - Regression proving a broad durable-doc audit can be completed as bounded
    structured calls without direct filesystem fallback.
  - Performance test or debug harness showing set checks do not rescan the full
    repository once per selected document.
- Promotion target: create a future Markdown document audit scale spec under
  EB003 and the Markdown quality design, with telemetry evidence routed through
  EB009.

### EB016: Portable Hook Intent Guardrails

- Priority: P1
- Status: proposed spec
- Friction signal: Kiro hook review and local hook dogfooding identified useful
  generic guardrails around pre-write policy, post-edit validation planning,
  task evidence, prompt scope, session handoff, and companion runtime
  availability. Repo-specific command hooks such as SAM validation, migration
  sequencing, and project lint commands are useful in target repositories, but
  should not become Agent Workbench defaults.
- Runtime surface: common hook intent model, agent-specific hook emitters,
  packaged Codex and Kiro hooks, post-edit feedback, `verification_plan`,
  integration health/profile output, `context_for_task`, and optional
  spec-lifecycle-manager companion routing.
- Acceptance:
  - Define portable hook intents for pre-write policy checks, post-edit
    verification planning, task evidence reminders, prompt scope
    classification, session handoff summaries, and companion runtime
    availability checks.
  - Pre-write policy checks detect hidden fallbacks, silent degraded behavior,
    obvious secret material, and broad write scope using bounded evidence; they
    must not mutate files or execute repo commands.
  - Post-edit verification planner hooks call or route to `verification_plan`
    and report the smallest useful validation set without executing commands by
    default.
  - Task evidence reminders require file, check, acceptance, or residual-risk
    evidence when an agent claims completion; spec acceptance, reconciliation,
    task selection, promotion, and closure ownership remains with
    spec-lifecycle-manager.
  - Prompt scope classifier hooks flag broad or cross-subsystem requests and
    route to `context_for_task`, repo overview, or user clarification without
    blocking narrow edits.
  - Session handoff hooks produce concise summaries for the active transcript
    or an explicit session-log destination; they must not write steering files
    or durable docs automatically.
  - Companion runtime availability hooks report Agent Workbench and companion
    MCP states as configured, discovered, callable, unavailable, or unknown,
    and keep healthy results quiet.
  - Generated agent-specific hook artifacts stay thin wrappers around common
    hook intents and MCP surfaces; they must not embed repo-specific validators,
    install or repair tooling, retry failures, or add hidden fallback behavior.
- Validation:
  - Contract tests for hook intent definitions and agent-specific emitter
    output for Codex and Kiro.
  - Fixture hook payloads for write, prompt-submit, task-stop, session-start,
    and session-stop events where client support exists.
  - Golden outputs for clean quiet results, actionable policy findings,
    blocked companion runtime states, broad prompt scope, evidence-missing task
    completion, and validation-planning-only results.
  - Regression tests proving repo-specific commands are planned through
    `verification_plan` or target-repo hooks rather than shipped as generic
    Agent Workbench hooks.
- Promotion target: create a future integration-hook-intents spec after active
  post-edit repair and spec-task routing work stabilize; route overlapping
  lifecycle behavior to spec-lifecycle-manager and overlapping workspace risk
  behavior to EB008.

### EB017: Repo-Configured Auto-Formatting Hooks

- Priority: P1
- Status: candidate spec
- Friction signal: documentation and spec edits often leave Markdown tables and
  wrapped text difficult to read in plain text. Formatter help belongs in Agent
  Workbench because it touches file edit hooks, workspace safety, formatter
  planning, repo configuration, and Markdown quality surfaces.
- Runtime surface: repo-owned Agent Workbench configuration, generated
  agent-specific hook wrappers, common hook intent model, post-edit feedback,
  Markdown formatter planning, preview/apply workspace safety, and
  `verification_plan`.
- Acceptance:
  - Auto-formatting is disabled by default and cannot mutate files unless a
    repo-owned configuration explicitly enables the formatter and hook event.
  - Formatter configuration lives in the target repository, not the plugin
    cache, so project preferences survive plugin cache cleans and package
    reinstalls.
  - The configuration shape is extensible enough for later repo-level Agent
    Workbench options without turning hook wrappers into the source of truth.
  - Markdown is the first scheduled formatter, with table alignment and other
    plain-text readability improvements prioritized over broad style churn.
  - Hook-triggered formatting is scoped to changed or explicitly selected files
    and uses the existing preview/apply safety path, stale-preview checks, and
    repo-relative path reporting.
  - Formatter failures, skipped states, missing tools, or policy conflicts are
    reported as structured feedback; they must not hide validation failures or
    silently fall back to another formatter.
- Validation:
  - Contract tests for disabled default behavior, repo-config opt-in,
    config-precedence handling, stale preview rejection, and changed-file scope.
  - Golden hook outputs for clean no-op formatting, Markdown table preview,
    configured apply, missing formatter capability, and skipped unsafe writes.
  - Fixture repositories with and without Agent Workbench config files proving
    cache cleans or plugin reinstall paths do not erase repo preferences.
  - Markdown formatter fixtures covering aligned tables, wide tables, wrapped
    prose, frontmatter preservation, fenced-code preservation, and no-op
    rendered-meaning preservation.
- Promotion target: create a future auto-formatting hook spec after EB016 hook
  intent boundaries and Markdown preview/apply formatter contracts are stable.

### EB018: Stale Documentation Filtering

- Priority: P1
- Status: delivered by closed Spec 034
- Friction signal: agents can over-trust archived specs, superseded design
  notes, removed-spec references, stale open decisions, and closure breadcrumbs
  when docs search or first-read context surfaces them without lifecycle state.
- Runtime surface: docs inventory, docs search, docs overview/map,
  `context_for_task`, spec-aware routing, and presentation ranking metadata.
- Acceptance:
  - Classify documentation as active/current, archived, superseded,
    historical, closure breadcrumb, removed-spec reference, or unknown where
    repo evidence supports that label.
  - Rank active/current durable docs ahead of archived or superseded material
    for implementation prompts unless the user explicitly asks for history.
  - Preserve historical docs as discoverable evidence while labeling them so
    agents do not treat them as current requirements.
  - Keep generic lifecycle truth, spec closure decisions, and status migration
    ownership in spec-lifecycle-manager; Agent Workbench owns only routing and
    trust labels.
  - Return missing or unknown classification evidence explicitly instead of
    inventing freshness.
  - Treat frontmatter fields such as `status`, `last_reviewed`,
    `canonical_owner`, `superseded_by`, and `authority` as input signals, not
    standalone documentation authority.
  - Use file `mtime_ms` only as modified-time evidence and never use filesystem
    `ctime` for document creation or currency.
  - Optionally enrich final doc candidates with local Git first/last touch
    evidence when available; missing Git evidence must be explicit and
    non-blocking.
  - Provide an agent-facing workflow, skill, prompt, or tool that verifies
    which docs are current for a particular task before implementation.
  - Feed active-spec, promotion, closure, and stale-durable-doc rule changes
    back to spec-lifecycle-manager rather than duplicating lifecycle authority
    inside Agent Workbench.
- Validation:
  - Fixture repositories with active specs, archived specs, closure logs,
    superseded design docs, removed-spec references, and durable current docs.
  - Golden docs/search/context responses proving stale docs are labeled and
    downranked without disappearing.
  - Regression tests proving exact historical prompts can still surface
    archived material with historical caveats.
  - Regression tests proving no `ctime` dependency and optional Git-history
    enrichment behavior.
- Promotion target: closed Spec 034 delivery evidence in the
  [Spec closure log](../history/spec-closure-log.md), with current behavior
  owned by EB003, EB006, and the documentation routing design.

### EB019: Repo Capability Inventory

- Priority: P1
- Status: proposed spec
- Friction signal: agents repeatedly rediscover local skills, MCP tools,
  prompts, hooks, `AGENTS.md` scope, validation commands, install/cache state,
  and source-vs-installed drift through shell reads or user corrections.
- Runtime surface: integration health/profile output, repo status/scope,
  validation planning, docs overview, plugin/skill packaging metadata, and a
  future read-only capability inventory packet.
- Acceptance:
  - Report repo-local and packaged skills, MCP resources/tools/prompts, hooks,
    agent instructions, validation commands, repo-local policy, and companion
    runtimes as discovered/configured/callable/unavailable/unknown where
    evidence exists.
  - Show `AGENTS.md` scope and precedence without rewriting instructions.
  - Distinguish source copy, packaged copy, installed copy, and cache copy for
    Agent Workbench-owned integration artifacts when paths are locally
    discoverable.
  - Keep the inventory read-only and bounded; it must not install, repair,
    refresh caches, execute commands, or probe external networks.
  - Label caller-provided discovery evidence separately from local filesystem
    evidence and configured profile evidence.
- Validation:
  - Fixtures for repo-local skills, packaged plugin skills, hidden or missing
    hooks, prompt lists, nested `AGENTS.md`, validation-policy files, and
    stale installed/cache copies.
  - Golden inventory responses for clean, drifted, partially installed, and
    unknown caller-discovery states.
  - Tests proving unavailable capabilities are reported as caveats rather than
    executable next actions.
- Promotion target: create a future capability-inventory spec building on
  EB001, EB002, EB004, EB016, and package discoverability work.

### EB020: Workflow-Friction Report

- Priority: P2
- Status: proposed spec
- Friction signal: repeated tool loops, user corrections, interrupted turns,
  shell fallback despite MCP tools, and rediscovered validation commands are
  product signals that should feed backlog work instead of staying in chat.
- Runtime surface: local debug mining, hook logs, MCP server logs, telemetry,
  validation planning, and future usage summaries.
- Acceptance:
  - Summarize repeated loops by category, including wrong surface, broad shell
    search after MCP guidance, missing validation policy, retry/fallback
    patterns, interruption/resume gaps, and repeated user corrections.
  - Keep reports aggregate-first with bounded excerpts and redaction; do not
    publish full transcripts or command logs.
  - Link each repeated friction category to an existing backlog item, proposed
    spec, or explicit no-action decision.
  - Treat shell-history or external tracker mining as opt-in evidence, not a
    default local scan.
  - Keep the report read-only and diagnostic; it must not mutate backlog docs
    automatically.
- Validation:
  - Synthetic history, hook, telemetry, and MCP-log fixtures covering repeated
    loops, single-event noise, redaction, and no-signal cases.
  - Golden reports proving categories, counts, representative bounded evidence,
    and backlog routing are stable.
  - Regression tests proving reports avoid full transcript emission and do not
    claim validation commands were executed.
- Promotion target: create a future workflow-friction-report spec under EB009.

### EB021: Read-Only Handoff Packet

- Priority: P1
- Status: proposed spec
- Friction signal: subagent and interrupted-session handoffs lose the selected
  task, loaded context, file ownership, changed files, validation status,
  stale-doc risk, open decisions, and next action, causing repeated setup and
  weak blocker transfer.
- Runtime surface: context routing, diagnostics/post-edit feedback,
  verification planning, workspace safety, integration health, spec-aware
  routing, and optional hook/session-stop wrappers.
- Acceptance:
  - Produce a read-only handoff packet containing selected task, context
    loaded, known changed files, validation run/not applicable/blocked,
    stale-doc risk, open decisions, companion-runtime state, limitations, and
    the next concrete action.
  - Separate agent-made changes from pre-existing dirty worktree changes where
    evidence exists; unknown ownership must stay explicit.
  - Include spec lifecycle context only as consumed evidence or next-action
    routing; do not update task state, close specs, or write durable lifecycle
    docs.
  - Keep hook-generated handoffs quiet unless explicitly requested or required
    by the client event; no durable files are written by default.
  - Preserve bounded repo-relative paths and redact sensitive values.
- Validation:
  - Fixtures for clean handoff, dirty worktree, subagent file ownership,
    blocked validation, stale docs, unavailable companion runtime, and
    interrupted-session resume.
  - Golden handoff packets proving validation status, stale-doc caveats, open
    decisions, and next actions are compact and deterministic.
  - Regression tests proving the packet is read-only and never marks lifecycle
    tasks complete.
- Promotion target: create a future handoff-packet spec under EB005, EB006,
  EB008, EB016, and EB018.

### EB022: Dogfood Evidence Ledger

- Priority: P0
- Status: documented ledger created
- Friction signal: real project dogfood drives Agent Workbench priorities, but
  evidence currently lives across smoke notes, closure logs, and chat-derived
  summaries.
- Runtime surface: durable reference docs, proof matrix, executable backlog,
  and future adoption reports.
- Acceptance:
  - Maintain a durable dogfood ledger with date, project, language/framework,
    agent used, task type, Workbench surfaces used, outcome, fallback points,
    defects avoided, defects missed, and follow-up improvement.
  - Keep raw per-agent feedback notes scoped to the originating chat session
    and stored with that session, not as standalone repository reference docs.
    Promote only distilled product signals into durable docs.
  - Treat entries as product evidence, not universal proof.
  - Link follow-up improvements to backlog items, specs, or no-action
    decisions.
- Validation:
  - Markdown review of the ledger structure and links.
  - Periodic reconciliation against smoke notes, closure records, and proof
    matrix entries.
- Promotion target: use
  [Dogfood evidence ledger](../reference/dogfood-evidence-ledger.md) as the
  durable intake surface.

### EB023: Trust Calibration In Tool Outputs

- Priority: P0
- Status: implemented and closed by Spec 035
- Friction signal: useful routing evidence can be over-read as proof by agents
  unless every major response states what it is safe for.
- Runtime surface: shared response metadata, presenters, `context_for_task`,
  docs tools, symbol/reference/impact tools, diagnostics, and validation
  planning.
- Acceptance:
  - Add centralized trust calibration metadata or caveats that state
    `safe_to_use_for`, `not_safe_to_use_for`, and `must_verify_by` without
    duplicating per-tool vocabulary.
  - Ensure routing, parser-backed, semantic, direct-read, planned validation,
    executed validation, and proof remain distinct.
  - Keep trust calibration generated by shared presenters, not copied into
    individual adapters.
- Validation:
  - Contract and shared-policy tests cover schema compatibility, deterministic
    trust derivation, and unsafe-wins behavior.
  - Public presenter and registry tests cover all public standard-envelope
    MCP resources/tools.
  - `tests/mcp/trust-golden.test.ts` asserts exact trust semantics for major
    tool families and structured failure states.
- Promotion target: current behavior is promoted to
  [Runtime contracts](../reference/runtime-contracts.md) and
  [MCP surface design](../design/mcp-surface-design.md).

### EB024: Executed Validation Status Distinction

- Priority: P0
- Status: proposed spec
- Friction signal: agents must never report planned validation as passed
  validation.
- Runtime surface: runtime contracts, validation planning, diagnostics,
  post-edit feedback, proof packets, and presenters.
- Acceptance:
  - Keep the current `done`, `planned`, `needed`, `blocked`, and
    `not_applicable` vocabulary stable until a migration spec proves a better
    model.
  - If finer statuses such as executed passed/failed or manual verified are
    needed, add them through a versioned contract migration.
  - Ensure every presenter labels planned commands as planned evidence only.
- Validation:
  - Contract tests for validation status enums.
  - Golden responses proving planned commands cannot be rendered as passed
    checks.
- Promotion target: create a future validation-status migration spec only if
  fixture evidence shows the current vocabulary is insufficient.

### EB025: Proof Bundle Export

- Priority: P1
- Status: proposed spec
- Friction signal: agents need compact evidence packets after implementation
  or review, but Workbench must not claim acceptance or closure.
- Runtime surface: future `proof_bundle_for_files` tool, diagnostics, impact,
  docs evidence, validation planning, workspace safety, and residual-risk
  presentation.
- Acceptance:
  - Given changed files and optional task context, package repo status,
    diagnostics, validation evidence, impact, docs evidence, skipped checks,
    and residual risk.
  - State that the proof bundle does not mean work is accepted, complete,
    promoted, released, or closed.
  - Distinguish planned, blocked, executed, manual, and not-applicable evidence.
- Validation:
  - Golden proof bundles for implementation, docs-only, review-only, blocked
    validation, stale evidence, and partial semantic coverage.
  - Contract tests proving proof bundles use existing enum vocabulary.
- Promotion target: create a future proof-bundle spec after trust calibration
  and validation-status hardening.

### EB026: Doctor Command

- Priority: P1
- Status: proposed spec
- Friction signal: package installs, native bindings, MCP startup, cache
  permissions, and plugin/cache drift can fail before Workbench evidence is
  trustworthy.
- Runtime surface: CLI/package entrypoint, installation metadata, native
  dependency checks, SQLite/cache health, parser availability, MCP startup, and
  integration health.
- Acceptance:
  - Provide `agent-workbench doctor` and `agent-workbench doctor --json` or an
    equivalent package-backed health check.
  - Check Node version, pnpm version, native module loadability, SQLite
    open/write, tree-sitter parser availability, MCP startup, cache directory
    writability, repo path containment, validation policy parse, and
    plugin/integration health.
  - Return structured actionable failures without repairing installs
    automatically.
- Validation:
  - Fixture or temp-directory checks for clean, missing native dependency,
    unwritable cache, invalid policy, and MCP startup failure cases.
  - Package dry-run and installer tests updated for doctor availability.
- Promotion target: create a future package doctor spec under plugin
  discoverability and runtime operations.

### EB027: Threat Model

- Priority: P0
- Status: documented threat model created
- Friction signal: local-first repository indexing handles untrusted source,
  docs, tests, comments, config, symlinks, validation policy, and MCP clients.
- Runtime surface: workspace safety, command policy, redaction, docs/source
  indexing, MCP configuration, validation policy, and edit preview/apply.
- Acceptance:
  - Document repository content as untrusted input.
  - Cover malicious repository content, prompt injection, malicious MCP clients
    or configuration, symlink workspace escape, command execution escalation,
    credential leakage, stale preview overwrite, generated artifact trust
    confusion, and repo-local validation policy abuse.
  - Route implementation gaps to security-sensitive backlog work or workspace
    safety specs.
- Validation:
  - Markdown review and future security fixture mapping.
- Promotion target: maintain
  [Threat model](../security/threat-model.md) as the durable security design
  boundary.

### EB028: Validation-Policy Trust Levels

- Priority: P1
- Status: proposed spec
- Friction signal: repo-local validation policy is useful for planning, but the
  repository controls it and it must not authorize process execution by itself.
- Runtime surface: `.agent-workbench/validation-policy.json`,
  `verification_plan`, command safety, future command execution, and
  workspace/admin policy.
- Acceptance:
  - Model trust levels such as absent, repo-local untrusted, repo-local
    trusted, user approved, and workspace-admin approved.
  - Repo-local validation policy may guide planning by default.
  - Repo-local validation policy must not authorize command execution without
    user, client, workspace, or admin approval.
- Validation:
  - Contract tests for trust-level parsing and presentation.
  - Golden validation plans for absent, untrusted, trusted, user-approved, and
    admin-approved policy evidence.
- Promotion target: create a future validation-policy trust spec before any
  broad command execution work.

### EB029: Protocol And Contract Drift Tests

- Priority: P1
- Status: proposed spec
- Friction signal: docs, MCP registries, examples, enum values, next actions,
  and safety-policy claims can drift independently as the product matures.
- Runtime surface: contract schemas, MCP registry, docs examples, package
  metadata, safety policy, and CI scripts.
- Acceptance:
  - Add a `pnpm check:contracts` or equivalent validation command.
  - Check documented enums against source enums, documented MCP tools against
    actual registry, example enum values, next-action tool existence, mutating
    tool safety policy, validation-status consistency, and capability-level
    consistency.
  - Keep checks deterministic and local; do not require network access.
- Validation:
  - CI/local script tests with fixture docs and intentional drift cases.
- Promotion target: create a future contract-drift-check spec.

### EB030: Review Mode

- Priority: P1
- Status: documented doctrine, proposed runtime spec
- Friction signal: Workbench is useful for review as well as implementation,
  but review workflows need read-only evidence, validation adequacy, and
  residual-risk framing.
- Runtime surface: future review packet, diagnostics, impact, docs evidence,
  validation planning, generated/vendor detection, security-sensitive change
  detection, and proof bundles.
- Acceptance:
  - Define a review workflow: changed files to diagnostics, impact evidence,
    docs impact, validation adequacy, and residual risk.
  - Highlight correctness risk, blast radius, missing validation, docs affected,
    generated/vendor risk, security-sensitive changes, and unverified
    assumptions.
  - Keep review mode read-only unless the user explicitly asks for fixes.
- Validation:
  - Golden review packets for code, docs, generated files, security-sensitive
    paths, stale evidence, and blocked validation.
- Promotion target: create a future review-mode spec after proof bundle and
  trust calibration work.

### EB031: Usage Gaps Resource

- Priority: P2
- Status: proposed spec
- Friction signal: fallback to `rg`, `find`, broad reads, ad hoc shell,
  blocked validation, stale indexes, low-confidence results, and unsupported
  language evidence should feed product improvement.
- Runtime surface: future `repo:///usage/gaps`, local telemetry, debug mining,
  hooks, and backlog routing.
- Acceptance:
  - Aggregate fallback and blocked-state signals without storing full
    transcripts or sensitive command output.
  - Keep usage-gap records opt-in or local-only until privacy policy is
    explicit.
  - Route repeated gaps to backlog items, specs, or no-action decisions.
- Validation:
  - Synthetic telemetry/history fixtures for each gap category.
  - Redaction and bounded-output tests.
- Promotion target: create a future usage-gaps resource spec under EB009 and
  EB020.

### EB032: Ranking Explanation Transparency

- Priority: P1
- Status: active behavior plus proposed hardening
- Friction signal: agents need to know why files/docs were recommended so they
  can avoid blind trust in lexical or low-confidence matches.
- Runtime surface: `repo:///overview`, `context_for_task`, docs search,
  validation planning, and presenters.
- Acceptance:
  - Include rank reasons such as task-term match, first-party source, adjacent
    tests, package boundary, direct symbol match, referenced durable doc, or
    validation policy evidence.
  - Include why a result was not ranked higher when useful, such as missing
    direct symbol match or partial semantic coverage.
  - Keep explanations compact and generated from scoring evidence.
- Validation:
  - Golden ranking responses for exact symbol, lexical, docs-linked,
    adjacent-test, generated/vendor, and partial-semantic cases.
- Promotion target: harden current ranking explanations through future context
  routing specs.

### EB033: Generated-File Detection And Source-Of-Truth Guidance

- Priority: P1
- Status: proposed spec
- Friction signal: agents can edit generated files, lockfiles, SDKs, compiled
  assets, generated docs, OpenAPI/protobuf outputs, or ORM artifacts instead of
  their source of truth.
- Runtime surface: catalog policy, workspace safety, context ranking,
  preview/apply, validation planning, and review mode.
- Acceptance:
  - Detect generated artifacts where repo evidence supports it.
  - Report generator and source-of-truth path when known; otherwise label the
    generator unknown.
  - Refuse or warn on edits according to workspace safety policy and recommend
    editing source templates or schemas when identifiable.
- Validation:
  - Fixtures for OpenAPI clients, protobuf outputs, ORM generated files,
    compiled assets, generated docs, lockfiles, and unknown generated files.
- Promotion target: create a future generated-artifact trust spec under EB008.

### EB034: Security-Sensitive Change Detection

- Priority: P1
- Status: proposed spec
- Friction signal: changes in auth, authorization, credentials, crypto,
  network, filesystem, subprocess, deserialization, dependencies, CI/CD, and
  infrastructure permissions require explicit validation and review.
- Runtime surface: context routing, diagnostics, validation planning, review
  mode, proof bundles, and threat-model follow-up.
- Acceptance:
  - Detect security-sensitive path, symbol, dependency, infrastructure, and
    config evidence using bounded rules.
  - Emit concise warnings that the work should not be marked complete without
    explicit validation and review.
  - Avoid claiming vulnerability presence or absence without a dedicated
    security scan.
- Validation:
  - Fixtures for security-sensitive files and false-positive controls.
  - Golden review/proof-bundle warnings.
- Promotion target: create a future security-sensitive-change spec after the
  threat model is reconciled with workspace safety.

### EB035: Agent-Readable Changelog

- Priority: P1
- Status: documented changelog and release-note evidence workflow created
- Friction signal: human changelogs do not always tell agents which behavior,
  contract, or workflow expectations changed.
- Runtime surface: durable reference docs, package metadata, integration
  guidance, release notes, and future contract drift checks.
- Acceptance:
  - Maintain a changelog with agent-visible changes, contract changes, required
    agent behavior changes, and migration notes.
  - Call out validation-status, trust-calibration, lifecycle-boundary, and
    command-policy changes in agent-readable terms.
  - Link entries to specs, commits, proof evidence, or release records when
    available.
- Validation:
  - Markdown review and package/release checklist integration through
    `awb release notes`.
- Promotion target: maintain
  [Agent-readable changelog](../reference/agent-readable-changelog.md) as a
  durable adoption surface.

## Backlog To Spec Promotion Rules

Promote a backlog item into an implementation spec when:

- it has a concrete repo, history, hook, telemetry, or smoke-test signal;
- the affected runtime surface or contract is clear;
- implementation requires code, contracts, fixtures, docs, or cross-module
  coordination;
- acceptance criteria can be proven by tests, golden responses, or documented
  blocked-state evidence.

Do not promote an item when:

- it is generic governance or project management outside coding-agent runtime
  support;
- another owner already owns the workflow and Agent Workbench only needs an
  integration boundary;
- it is parity-only work for a public tool catalog with no agent friction
  signal.

### EB036: Per-Repo Runtime Daemon And Session Sharing

- Priority: P0
- Status: delivered by closed Spec 032
- Friction signal: multiple Codex sessions in the same large repository can
  start separate Agent Workbench MCP processes that share one repo cache
  database and contend during startup graph warmup, surfacing
  `database is locked` from repo resources and graph-backed tools.
- Runtime surface: MCP stdio launcher, per-repo daemon process, Unix socket
  transport, graph warmup scheduler, SQLite store ownership, integration
  health, doctor command, and package install/cleanup behavior.
- Acceptance:
  - Start one runtime daemon per repo when the first MCP instance for that repo
    starts.
  - Route later MCP instances for the same repo to the existing daemon instead
    of opening their own graph store or starting another warmup writer.
  - Keep the daemon alive while at least one MCP client is connected.
  - Stop the daemon after the last client disconnects, with a short idle grace
    period so rapid session restarts do not thrash warmup state.
  - Serialize graph writes and allow graph reads to use the latest usable
    snapshot while a refresh is running.
  - Report `refreshing`, `blocked`, or `invalid_due_to_environment` envelopes
    when the daemon, socket, or graph store is unavailable; never return raw
    `database is locked` as non-JSON tool output.
  - Keep socket paths repo-scoped and safe for multiple repositories open in
    parallel.
  - Provide a doctor/debug surface that shows daemon PID, socket path, repo
    root, connected client count, warmup state, graph freshness, and last
    failure.
- Validation:
  - Fixture tests that start two MCP stdio clients for the same repo and prove
    only one daemon and one warmup writer are active.
  - Tests that the daemon exits only after the last client disconnects plus the
    configured idle grace period.
  - Tests that a second repo gets a separate daemon and graph store.
  - Tests for daemon crash/restart, stale socket cleanup, malformed socket
    requests, and blocked graph-store startup.
  - Dogfood post-warmup sweep against a large repository with multiple
    concurrent clients and no `database is locked` resource or tool failures.
- Promotion evidence: Spec 032 added the per-repo daemon launcher, local IPC
  handshake, stale metadata cleanup, daemon-owned shared graph-store factory,
  once-per-daemon startup warmup scheduling, daemon integration-health
  diagnostics, focused daemon tests, stdio MCP regression tests, and a
  concurrent dogfood sweep against this repository with no raw SQLite lock
  output.

### EB037: Repo-Root Authority And Debug Override Gate

- Priority: P0
- Status: closed Spec 029
- Friction signal: review and source inspection found that normal MCP
  requests can provide `repo_root`, causing workspace/safety adapters to bind
  to a caller-supplied root instead of the launched repository.
- Runtime surface: MCP registry schemas, request parsing, root resolution,
  workspace safety, integration health, debug harnesses, and generated
  integration guidance.
- Acceptance:
  - Normal agent-facing resources and tools use the launch repo root only.
  - Caller-supplied `repo_root` is blocked unless an explicit hidden debug gate
    is enabled for Agent Workbench diagnostics.
  - Normal Codex, Claude Code, Kiro, and common integration guidance does not
    advertise `repo_root`.
  - Debug mode reports root override status in diagnostic or health output
    without making it part of normal workflow guidance.
- Validation:
  - MCP tests for normal blocking and debug allowance.
  - Integration profile tests proving normal schemas and guidance omit
    `repo_root`.
  - Workspace safety tests proving effective root remains the launch root in
    normal mode.
- Promotion target: closed
  [Spec 029](../history/spec-closure-log.md). Current behavior lives in
  [Workspace safety contract](../reference/workspace-safety-contract.md),
  [MCP surface design](../design/mcp-surface-design.md), and
  [Runtime contracts](../reference/runtime-contracts.md).

### EB038: MCP Error Envelope Consistency

- Priority: P0
- Status: closed Spec 030
- Friction signal: review and source inspection found uneven error
  handling across MCP registries; some handlers wrap use-case failures while
  others can rethrow after argument/provider checks.
- Runtime surface: MCP registry helpers, presenters, runtime contracts,
  telemetry, graph-backed tools, docs tools, validation planning, and
  preview/apply edit tools.
- Acceptance:
  - Shared handler pattern covers parse, provider availability, use-case
    invocation, domain failure, unknown failure, telemetry, and JSON text
    response serialization.
  - Invalid input, provider unavailable, workspace safety blocked, stale state,
    environment unavailable, domain error, and internal error remain distinct
    enough for agents to choose the next safe action.
  - Recoverable runtime failures return structured envelopes instead of raw
    thrown MCP errors.
- Validation:
  - Registry consistency tests for representative read-only, planning, and
    workspace-write tools.
  - Golden failures for malformed args, missing providers, domain errors, and
    unknown errors.
- Promotion target: closed
  [Spec 030](../history/spec-closure-log.md). Current behavior lives in
  [Runtime contracts](../reference/runtime-contracts.md),
  [MCP surface design](../design/mcp-surface-design.md), the shared MCP
  envelope wrapper, representative tool registry tests, and closure evidence.

### EB039: Shared Path Policy And Secret Path Classification

- Priority: P0
- Status: closed Spec 031
- Friction signal: review found drift risk between scanner/catalog
  policy and workspace write safety; source inspection confirmed catalog
  policy is richer than write safety and should become the shared authority.
- Runtime surface: catalog scanner, docs/context routing, workspace safety,
  preview/apply edit, validation planning, hook feedback, threat model, and
  redaction boundaries.
- Acceptance:
  - One shared classifier returns generated, vendor, hidden, secret, ignored,
    nested-repo, configured-skip, and explicit-allowlist decisions.
  - Workspace safety derives read-only and write-refusal behavior from the
    shared classifier instead of maintaining narrower duplicate root lists.
  - Secret-bearing paths such as `.env*`, `.envrc`, private keys,
    `credentials.*`, and `secrets.*` are handled consistently while safe
    examples remain allowlistable.
- Validation:
  - Consistency tests compare scanner, workspace safety, docs/context, and hook
    decisions for representative paths.
  - Secret-path fixtures cover safe examples and denied credential paths.
- Promotion target: closed
  [Spec 031](../history/spec-closure-log.md). Current behavior lives in
  [Workspace safety contract](../reference/workspace-safety-contract.md),
  [Threat model](../security/threat-model.md), the shared path classifier, and
  path-policy consistency tests.

### EB040: Runtime Version Single Source

- Priority: P1
- Status: delivered by closed Spec 040
- Friction signal: package version, MCP server metadata, integration health,
  integration profile, and client plugin cache can drift independently. A live
  client can therefore expose an older plugin/runtime than the current package
  without health explaining which identity is stale.
- Runtime surface: package metadata, MCP server card, integration health,
  common integration profile, Codex/Claude/Kiro packaging, tests, and release
  checks.
- Acceptance:
  - Runtime version is derived from one source of truth at build/install time.
  - Health distinguishes runtime identity from observed client plugin/package
    identity and gives bounded refresh/restart guidance when both are known and
    disagree.
  - Server-card metadata, health resources, integration profiles, and package
    manifests agree.
  - Tests fail when hardcoded version literals drift from package metadata.
- Validation:
  - Unit and integration tests for version propagation.
  - Package dry-run or installer dry-run evidence that emitted metadata agrees.
- Promotion target: closed
  [Spec 040](../history/spec-closure-log.md), combined with the EB001
  provider-health residual while keeping broader release-readiness work in
  EB043. Current behavior lives in the coding-agent integration design, MCP
  surface design, runtime contracts, plugin runbook, and package validator.

### EB041: Claude Code Quick Guidance

- Priority: P1
- Status: delivered by closed Spec 038
- Friction signal: Claude Code packaging and Agent Workbench instructions were
  exposed in recent histories, but none of the six analyser-supported Claude
  Code 2.1.206 files invoked an Agent Workbench tool or loaded its skill. Three
  files were conformance or smoke sessions, so this is a discoverability signal
  rather than a general adoption-rate claim.
- Runtime surface: Claude Code plugin package, generated skills/instructions,
  common integration profile, plugin README, and MCP call sequence guidance.
- Acceptance:
  - Provide a concise Claude-facing guide whose workflow begins with
    `repo:///orientation`, then uses `context_for_task`, targeted reads,
    preview/apply, and `verification_plan` when task evidence warrants them.
  - Make the first action executable and verify that the packaged skill name
    and invocation wording resolve naturally in Claude Code.
  - Keep activation conditional and non-automatic. SessionStart may advertise
    the packaged skill with one concise pointer, but must not invoke MCP,
    duplicate the workflow, or turn trivial tasks into Workbench tasks.
  - Preserve MCP as the runtime contract and avoid Claude-specific runtime
    logic.
  - Omit normal `repo_root` override guidance.
- Validation:
  - Plugin package validation includes the Claude guide artifact.
  - Claude fixtures prove that the activation instruction routes to the skill
    and MCP surface without adding Claude-specific runtime logic.
  - Documentation review confirms guidance is concise and current.
- Promotion target: closed
  [Spec 038](../history/spec-closure-log.md). Current behavior lives in
  [Coding agent integration design](../design/coding-agent-integration-design.md)
  and the packaged
  [Claude Code plugin guidance](../../plugins/agent-workbench/claude-plugin/README.md).

### EB042: Operator Path Documentation

- Priority: P2
- Status: delivered by closed Spec 040
- Friction signal: review found rich design docs but no small operator
  path for install, first run, normal task, edit task, review task, and
  troubleshooting.
- Runtime surface: README, runbooks, documentation map, installer docs, doctor,
  package validation, and common workflow guidance.
- Acceptance:
  - Add a short operator path that routes users through install, first run,
    normal task, edit task, review task, troubleshooting, and where to find
    deeper design docs.
  - Keep durable docs current-state oriented and avoid duplicating design
    details already owned elsewhere.
  - Include validation and native dependency notes where they affect first run.
- Validation:
  - Markdown review and link/path checks.
  - Fresh-install or dry-run evidence where operator steps reference commands.
- Promotion target: create a docs/runbook spec or pair with doctor work.

### EB043: Release-Readiness Gates

- Priority: P1
- Status: proposed spec
- Friction signal: review identified release risk across clean
  installs, Node versions, Codex plugin registration, Claude plugin loading,
  MCP startup, edit preview/apply, and uninstall/rollback.
- Runtime surface: CI, package dry-run, installer dry-run, GHCR/npm release
  packaging, Codex plugin install, Claude plugin validation, MCP smoke tests,
  doctor, and release runbooks.
- Acceptance:
  - Add a release checklist covering clean install, Node 22 and Node 24, no
    pre-existing Codex config, Codex plugin reinstall, Claude plugin local load,
    MCP startup, first `repo:///status`, basic preview/apply, and
    uninstall/rollback.
  - Keep network/publishing actions explicit and human-approved.
  - Make release blockers structured enough for agents to report without
    overclaiming.
- Validation:
  - CI or local dry-run gates for package, installer, plugin validation, and
    selected MCP smoke.
  - Manual evidence slots for environment-specific checks that cannot run in
    CI.
- Promotion target: create a release-readiness spec after EB040 or fold EB040
  into it if metadata versioning is the first release gate.

### EB044: Changed-Files Workbench Entry Point

- Priority: P1
- Status: proposed spec
- Friction signal: session-scoped plugin feedback reported that Agent Workbench
  was available but not naturally used. The agent defaulted to shell, lifecycle
  tooling, subagents, and validation commands because the visible Workbench
  surface did not provide an obvious first action after worktree changes, and the
  advertised `repo:///status`, `repo:///scope`, and `repo:///overview`
  resources did not map cleanly to the callable tool surface the agent saw.
- Runtime surface: integration health, agent-specific plugin guidance,
  `diagnostics_for_files`, `verification_plan`, repo resources,
  `context_for_task`, post-edit feedback, and optional lifecycle companion
  routing.
- Acceptance:
  - Provide one explicit "changed files" entry point for agents after edits or
    before handoff, either as a new tool or as a documented first-class
    workflow over existing resources and tools.
  - Combine bounded git/worktree state, repo freshness/scope evidence,
    changed-file diagnostics, recommended validation commands, and skipped or
    unavailable evidence into one structured packet.
  - Preserve source authority: use Workbench for repo evidence and validation
    planning, keep spec status/preflight authority in spec-lifecycle-manager,
    and label any lifecycle output as consumed companion evidence.
  - Make resource-style affordances such as `repo:///status`,
    `repo:///scope`, and `repo:///overview` discoverable from the same
    integration guidance that lists callable tools.
  - Ensure generated Codex, Claude, Kiro, and other agent guidance names the
    exact callable surface for changed-file diagnostics instead of assuming
    agents can infer it from resource names.
  - Return structured skipped, unavailable, or blocked states instead of
    partial success when git state, diagnostics, repo freshness, or validation
    planning evidence is missing.
- Validation:
  - Golden responses for clean worktrees, dirty worktrees, staged files,
    docs-only changes, code changes with diagnostics, unavailable diagnostics,
    stale repo snapshots, and spec-driven tasks with lifecycle companion
    evidence.
  - Integration-profile tests proving the changed-files workflow is surfaced as
    a first action after edits and does not advertise unavailable resources as
    callable tools.
  - Fixture tests proving lifecycle evidence is consumed read-only and never
    mutates spec status, closes tasks, or replaces spec-lifecycle-manager
    preflight.
  - Dogfood rerun on a lifecycle-driven task to check whether an agent uses the
    Workbench entry point before falling back to shell-only status and
    validation planning.
- Promotion target: create a focused post-edit or agent-adoption spec after
  active P0 MCP hardening specs, or fold into EB005 follow-up work if the
  implementation is only a presenter/guidance extension.

### EB045: Native Installer Deprecation Debt

- Priority: P2
- Status: technical debt
- Friction signal: a fresh `npx` install from the 0.1.0 release tarball emitted
  `npm warn deprecated prebuild-install@7.1.3: No longer maintained`. The
  install can continue, so this is not a release blocker, but it indicates a
  transitive native-install dependency that may become a future install or
  security-maintenance risk.
- Debt classification:
  - Risk: Dependency Disorder.
  - Intent: accidental debt.
  - Priority score: pain 1 x spread 2 = 2, monitored debt.
  - Symptom: package installation depends on a deprecated transitive native
    installer helper.
  - Source: Software Engineering at Google - dependency management and upgrade
    blockage.
  - Consequence: future Node/npm/native-addon changes may break installs or
    leave release users with noisy warnings that reduce package trust.
  - Remedy: identify the owning direct dependency, check whether an upgrade
    removes `prebuild-install`, and validate the resulting package install on
    Node 22 and Node 24 before changing dependency constraints.
- Runtime surface: dependency manifest, lockfile, native dependency setup,
  installer, package doctor, release-readiness gates, and package validation.
- Acceptance:
  - Identify which direct dependency brings in `prebuild-install@7.1.3`.
  - Decide whether the right remediation is direct dependency upgrade, upstream
    issue tracking, replacement, or documented acceptance until an upstream
    release exists.
  - Keep native dependency behavior explicit; do not add parser, SQLite, or
    command-execution fallbacks to hide the warning.
  - Make doctor or release-preflight output distinguish non-blocking deprecated
    transitive warnings from install failures.
- Validation:
  - `pnpm why prebuild-install` or equivalent dependency-tree evidence.
  - Clean package install on Node 22 and Node 24 after any dependency change.
  - Native module load checks for `better-sqlite3` and tree-sitter packages.
  - Release tarball install smoke using the documented Claude Code path.
- Promotion target: fold into EB026 doctor work or EB043 release-readiness work
  when packaging dependency hygiene is scheduled.

### EB046: Kiro Shell-Free Launcher

- Priority: P1
- Status: proposed spec
- Friction signal: cross-platform packaging converted the primary runtime
  launcher to the portable Node shim, but the Kiro package still needs a
  verified shell-free entry point.
- Runtime surface: Kiro Power metadata, MCP launch configuration, package
  install paths, integration tests, and plugin documentation.
- Acceptance:
  - Kiro launches the MCP server through the portable Node launcher without
    relying on a retired shell wrapper.
  - Kiro hook and agent commands avoid inline shell environment prefixes where
    the runtime can supply defaults.
  - Plugin documentation no longer carries a packaging caveat for Kiro launch.
- Validation:
  - Kiro integration tests assert the new launch shape.
  - Plugin validation covers Kiro metadata and packaged paths.
  - Manual or scripted launch smoke evidence proves the MCP server starts from
    an installed package.
- Promotion target: closed
  [Spec 040](../history/spec-closure-log.md). Kiro now launches the portable
  Node entrypoint directly from the explicit install root; broader packaging
  release gates remain in EB043.

### EB047: Turnkey Native Parser Install

- Priority: P2
- Status: proposed spec
- Friction signal: native parser setup still requires local compiler/toolchain
  readiness on some platforms, reducing confidence in clean installs.
- Runtime surface: package dependency constraints, native dependency setup,
  postinstall guidance, release CI, doctor command, and install smoke tests.
- Acceptance:
  - Decide whether to rely on upstream prebuilt parser packages, publish
    package-owned prebuilds, or keep the compiler prerequisite explicit.
  - Clean installs either succeed without a local compiler on supported targets
    or fail with a precise doctor/runbook explanation.
  - Parser, SQLite, and validation behavior remain explicit; do not add hidden
    parser or command-execution fallbacks to mask native setup problems.
- Validation:
  - Clean install smoke on supported Node/platform combinations.
  - Native module load checks for SQLite and parser packages.
  - Release or doctor evidence that distinguishes missing toolchain, ABI drift,
    and package metadata errors.
- Promotion target: fold into EB026 doctor work or EB043 release-readiness work
  when package install reliability is scheduled.

### EB048: Snapshot-Aware Orientation Entry Point

- Priority: P1
- Status: delivered by closed Spec 038
- Friction signal: in 100 supported Codex sessions from 2026-07-10 through
  2026-07-12, 305 reads targeted `repo:///status`, `repo:///scope`, and
  `repo:///overview`; 22 sessions read Agent Workbench resources without
  invoking an Agent Workbench tool. This indicates repeated ceremony and
  orientation-only drop-off, not proof that the resources are ineffective.
- Runtime surface: first-read resources, resource presenters, repository
  snapshot identity, `context_for_task`, skills, and integration guidance.
- Acceptance:
  - Provide one compact orientation receipt with snapshot identity,
    freshness/trust summary, material blockers, and paths to detailed evidence.
  - Let agents reuse orientation for an unchanged repository snapshot and make
    refresh conditions explicit.
  - Do not force refresh after ordinary content edits that leave root, scope,
    policy, runtime, and index-validity evidence materially unchanged.
  - Avoid hidden reads, partial-success fallbacks, or provider-specific runtime
    behavior.
- Validation:
  - Contract and golden tests cover fresh, changed-snapshot, stale, degraded,
    and blocked orientation.
  - Codex, Claude Code, and Kiro packaging tests agree on the entry path.
  - History replay can measure repeated resource calls without making an
    uncontrolled adoption improvement a closure gate.
- Promotion target: closed
  [Spec 038](../history/spec-closure-log.md). Current behavior lives in
  [MCP surface design](../design/mcp-surface-design.md) and
  [Runtime contracts](../reference/runtime-contracts.md).

### EB049: Executable Context Continuation And Bounded Navigation

- Priority: P1
- Status: delivered by closed Spec 038; named multi-provider scope regression
  repaired 2026-07-20; combined-surface comparison remains evidence-gated and
  unscheduled
- Friction signal: the same supported Codex corpus contained 70
  `context_for_task` calls but only three `symbol_search` calls, four
  `find_references` calls, and no `impact` calls. The evidence demonstrates
  low continuation usage but does not identify one cause.
  A 2026-07-19 Claude comparison also named Claude, Codex, and Kiro hook
  consistency explicitly, but `context_for_task` returned only Claude-side
  files while generic `plugin.py` symbols outranked first-party hook modules.
- Runtime surface: `context_for_task` ranking and presentation, symbol search,
  reference lookup, impact analysis, query budgets, and tool metadata.
- Acceptance:
  - Return prominent, ranked, callable continuation actions with usable
    arguments and node IDs only when they resolve a named task uncertainty;
    default to one primary and at most two secondary actions.
  - Improve progressive use of the existing symbol, reference, and impact tools
    and omit generic or already-satisfied recommendations.
  - Keep a combined navigation surface outside this slice unless a separate
    controlled comparison proves fewer decisions and lower total interaction
    cost without weaker evidence or failure attribution.
  - Report unsupported or incomplete semantic evidence explicitly rather than
    switching to an alternate parser or hidden query route.
  - When a task explicitly names multiple providers or integration scopes,
    include relevant first-party files for every named scope within the bound
    or state why a named scope was omitted. Rank exact hook/provider/artifact
    matches and source-sync relationships ahead of distant generic lexical
    matches.
- Validation:
  - Golden responses prove exact continuation arguments for supported,
    partial, and unsupported repositories.
  - Fixture tests cover symbol-to-reference-to-impact flow and any accepted
    combined surface within query budgets.
  - Cross-client metadata and skill tests keep the recommended workflow
    discoverable.
  - A Claude/Codex/Kiro SessionStart consistency regression surfaces each
    provider hook area plus the shared or sync source, and excludes or
    down-ranks generic dev-CLI `plugin.py` symbols.
- Regression-repair evidence (2026-07-20): explicit coding-agent hook intent
  now reserves one bounded result for each named Claude, Codex, and Kiro scope
  plus executable source-sync evidence, counts caller-supplied paths toward
  scope coverage, and reports `named_integration_scope` when a smaller bound
  omits a named provider. Generic provider-integration language no longer
  activates hook-scope selection or hook-specific skipped-work reporting. The
  focused integration suite passed 11/11, graph query
  regressions passed 27/27, typecheck passed, and the full suite passed 80 test
  files / 754 tests. Plugin, skill, and package dry-run gates also passed.
- Promotion target: closed
  [Spec 038](../history/spec-closure-log.md). Current continuation behavior
  lives in [MCP surface design](../design/mcp-surface-design.md),
  [Runtime contracts](../reference/runtime-contracts.md), and
  [Language adapter design](../design/language-adapter-design.md). The named
  scope repair is implemented in the task-context application routing policy
  with fixture-backed Claude/Codex/Kiro proof. The combined navigation surface
  remains residual backlog work only if a controlled comparison demonstrates
  lower interaction cost without weaker evidence or failure attribution.

### EB050: Intent-Aware Validation Guidance

- Priority: P1
- Status: delivered by closed Spec 038
- Friction signal: 30 of 57 supported Codex sessions with direct Agent
  Workbench tool use invoked `verification_plan`. The corpus mixes read-only,
  edit, review, and documentation work, so the gap should be treated as a
  routing signal rather than a compliance failure.
- Runtime surface: `verification_plan`, `context_for_task`, changed-file and
  edit-intent evidence, tool descriptions, skills, and validation presenters.
- Acceptance:
  - Make validation planning prominent when changed files, edit intent, or
    closure evidence requires it.
  - Prefer explicit caller intent and task-owned edits over lifecycle evidence
    and bounded text inference; unrelated dirty files and conflicting intent
    remain neutral.
  - Keep validation guidance concise for read-only investigation and avoid
    implying that commands were executed.
  - Do not repeat unchanged guidance within one task phase.
  - Preserve repository-policy-first command selection and structured blocked
    or degraded outcomes.
- Validation:
  - Fixtures distinguish read-only, review, edit, docs-only, and closure tasks.
  - Golden responses prove recommendation prominence and trust wording without
    adding an execution fallback.
  - Plugin guidance remains consistent across Codex, Claude Code, and Kiro.
- Promotion target: closed
  [Spec 038](../history/spec-closure-log.md). Current behavior lives in
  [MCP surface design](../design/mcp-surface-design.md),
  [Edit and validation loop design](../design/edit-and-validation-loop-design.md),
  and
  [Coding agent integration design](../design/coding-agent-integration-design.md).

### EB051: Snapshot Freshness Versus Deleted Indexed Paths

- Priority: P0
- Status: closed Spec 039
- Friction signal: on 2026-07-19, dogfooding against this repository showed
  `repo:///orientation` reporting `freshness: fresh`,
  `analysis_validity: valid`, and `refresh_required: false` while snapshot
  `1783312125057` still listed all seven
  `docs/specs/035-trust-calibration-tool-outputs/*.md` paths as indexed
  Markdown. That directory was deleted at commit `c90769b`. A
  `find_references` call on a `session-start.core.js` node then failed with a
  raw `ENOENT` naming
  `docs/specs/035-trust-calibration-tool-outputs/canonical-context.md`, instead
  of returning a bounded degraded or stale envelope. In the same session
  `context_for_task` reported `freshness: unknown` for that identical
  `snapshot_id`, so first-read surfaces did not agree with each other.
- Pre-fix reproduction (2026-07-19, runtime `0.5.1`, snapshot
  `1783312125057`): the failure was
  deterministic and isolated to `find_references`. Against the same snapshot and
  the same `session-start.core.js` node id, `symbol_search` and `impact` both
  returned valid bounded envelopes, while `find_references` failed with `ENOENT`
  by node id and again by `symbol`. The error persisted unchanged across an
  intervening Markdown edit that did not advance `snapshot_id`. Separately,
  `symbol_search` emitted a `next_actions` entry recommending
  `find_references` with that symbol and snapshot, so the runtime recommended a
  call that then crashed.
- Deployment validation (2026-07-19, runtime and Claude provider plugin
  `0.5.2`): `find_references` returned a bounded blocked envelope with all seven
  missing indexed paths represented by `stale_snapshot_paths`. Orientation and
  status agreed on `freshness: stale`, `refresh_required: true`, and
  `orientation_reusable: false`; no raw filesystem error escaped.
- Post-deployment correction (2026-07-19): a refresh could advance the latest
  snapshot between validity selection and a downstream first-read or graph
  query. The application boundary now pins status, orientation,
  `context_for_task`, docs search, `symbol_search`, `find_references`, and
  `impact` to one selected snapshot per call while retaining the defensive
  mismatched-receipt blocker.
- Runtime surface: snapshot identity and freshness derivation, orientation and
  status presenters, docs inventory counts, graph node/path validity,
  `find_references` reference resolution, and `next_actions` callability
  guarantees.
- Acceptance:
  - Deleting an indexed directory or file must invalidate freshness or set
    `refresh_required: true`; path removal is not an ordinary content edit under
    the EB048 reuse rule.
  - Orientation, status, and `context_for_task` must report the same freshness
    for the same `snapshot_id`, or explain why they differ.
  - Graph traversal over an indexed path that no longer exists must return a
    structured stale or degraded envelope naming the missing evidence, not an
    unhandled filesystem error.
  - `find_references`, `symbol_search`, and `impact` must apply the same
    snapshot-validity gate and return compatible structured stale behavior for
    the same deleted-path snapshot state.
  - A `next_actions` entry must not recommend a call that fails on the snapshot
    that produced it, per EB002 callability guarantees.
  - Docs inventory counts such as `indexed_docs_count` must not include paths
    that no longer exist on disk.
  - Resolution must fix freshness derivation and path validity rather than
    wrapping traversal in catch-and-continue error suppression.
- Validation:
  - Fixtures that index a docs directory, delete it, and then re-read
    orientation, status, and `context_for_task` for freshness agreement.
  - Golden `find_references` and `impact` responses for a node whose file was
    deleted after indexing, proving a bounded envelope rather than `ENOENT`.
  - Regression proving `indexed_docs_count` and docs search results exclude
    deleted paths.
  - Contract tests proving deletion-triggered refresh conditions appear in
    `refresh_when` and are honored by `refresh_required`.
- Promotion target: closed
  [Spec 039](../history/spec-closure-log.md) under EB003 first-read
  reliability. Current behavior lives in
  [runtime operations design](../design/runtime-operations-design.md),
  [graph store design](../design/graph-store-design.md),
  [MCP surface design](../design/mcp-surface-design.md), and
  [runtime contracts](../reference/runtime-contracts.md), resolving the defect against
  [EB048](#eb048-snapshot-aware-orientation-entry-point) orientation reuse and
  [EB023](#eb023-trust-calibration-in-tool-outputs) trust calibration, with
  error-envelope consistency routed through
  [EB038](#eb038-mcp-error-envelope-consistency).

### EB052: Daemon-Owned Refresh Convergence

- Priority: P0
- Status: closed by Spec 041
- Friction signal: post-deployment Claude dogfooding on runtime `0.5.2`
  confirmed that Spec 039 correctly detects deleted indexed paths, but the
  coordinated refresh did not converge. Daemon PID `434059` remained
  `warmup_state: scheduled` with `graph_freshness: unknown`, while the
  per-client coordinator remained `planned` and repeated status reads continued
  to report the same seven missing paths.
  Four paired follow-up tasks confirmed the user impact: exact-reference and
  documentation searches both remained blocked and returned no usable hits,
  while direct repository search remained complete enough to answer them.
- Root cause: the daemon shares the graph store but each connected MCP server
  creates its own in-memory warm-up coordinator. Only the first connection may
  run startup warm-up, so a later client can request a `planned` deletion
  refresh that no daemon-owned executor consumes.
- Runtime surface: daemon ownership, shared warm-up coordination and execution,
  integration health diagnostics, and status-triggered refresh.
- Acceptance:
  - One daemon-owned coordinator and executor must own startup and subsequent
    refresh work for every client connected to the repository daemon.
  - A stale-path status read from any client must schedule exactly one
    executable refresh, and repeated reads must reuse or observe that execution
    rather than create stranded per-client `planned` state.
  - Daemon health must report actual `planned`, `running`, `complete`, or
    `failed` execution state plus current graph freshness and bounded last
    failure evidence; it must not leave `scheduled/unknown` as permanent
    synthetic diagnostics.
  - The existing `repo:///status` next action must provide a convergent trigger
    and completion signal; do not add a second manual refresh tool or retry
    loop.
  - Historical snapshot inventory may continue to describe what that snapshot
    indexed, but stale coverage must not be presented as current or complete.
- Validation:
  - Package-entrypoint regression with two MCP clients sharing one daemon:
    complete startup, delete an indexed file, trigger status from the
    non-startup client, and prove exactly one refresh reaches completion.
  - Prove the snapshot advances, excludes the deleted path, converges to fresh
    for both clients, and makes integration health leave `scheduled/unknown`.
  - After convergence, execute `find_references` and `docs_search` against the
    refreshed snapshot and prove both return usable, non-blocked envelopes.
  - Failure and disconnect regressions proving refresh ownership survives the
    requesting client and reports structured failure without adding a fallback
    execution path.
- Promotion target: closed
  [Spec 041](../history/spec-closure-log.md) under EB003 first-read
  reliability. Current behavior lives in
  [runtime operations design](../design/runtime-operations-design.md),
  [graph store design](../design/graph-store-design.md),
  [MCP surface design](../design/mcp-surface-design.md), and
  [runtime contracts](../reference/runtime-contracts.md), with EB036 daemon
  ownership and EB051 snapshot validity as accepted prerequisites. Large-repo
  completion scale and progress remain independently owned by
  [EB014](#eb014-large-repo-graph-warmup-scale-and-progress).

### EB053: Reference Completeness And Bounded-Scan Truthfulness

- Priority: P0
- Status: closed by Spec 042
- Friction signal: a healthy runtime `0.6.0` Claude Code rerun asked
  `find_references` for consumers of `buildSessionStartContext`. The response
  returned nine low-confidence `bounded_lexical_identifier_scan` hits and did
  not report truncation, while direct repository search returned twelve. The
  omitted occurrences were three TypeScript integration-test references that
  exercise the Codex hook twin. Source inspection confirmed the lexical path
  accepts TypeScript but reads only the first bounded catalog window, then
  derives completeness from hits inside that window rather than from catalog
  exhaustion.
- Runtime surface: `find_references`, file-catalog pagination, graph/reference
  contracts, response metadata, query cursors, and trust presentation.
- Acceptance:
  - A reference response SHALL claim complete results only when the selected
    parser/graph evidence or lexical candidate universe is demonstrably
    exhausted for the resolved snapshot and request scope.
  - A bounded lexical scan that stops before catalog exhaustion SHALL expose
    partial/truncated analysis, inspected-versus-eligible evidence, scanned
    language coverage derived from actually inspected files, a stop reason,
    and a callable continuation rather than an apparently complete count.
  - `result_count` and any count-basis field SHALL distinguish page hits,
    inspected-window matches, and complete indexed matches without implying
    unseen files contain no references.
  - The Agent Workbench SessionStart fixture SHALL include all twelve known
    lexical identifier occurrences, including the three TypeScript
    integration-test occurrences, or SHALL return an explicitly partial page
    whose continuation reaches them. Lexical occurrences SHALL remain
    explicitly distinct from resolved semantic consumers.
  - Files SHALL be whole-file atomic scan units under the current workspace
    port. Declared-size admission, monotonic time deadlines, file/byte/result
    bounds, atomic overruns, and replay reads SHALL remain observable. Scan
    progress SHALL advance only after a fully accounted file; a separate result
    cursor MAY page multiple occurrences from that completed file.
  - Searchable oversized, unreadable, missing, or changed indexed candidates
    SHALL prevent valid absence, while explicit policy exclusions remain
    outside the declared evidence universe.
  - Resolution SHALL use the existing parser/graph route and paginated catalog
    boundary. It SHALL NOT add shell search, an alternate parser, an unbounded
    read, or a hidden fallback.
- Validation:
  - Contract tests for complete parser evidence, complete lexical exhaustion,
    partial catalog windows, continuation, stable count bases, and stale
    snapshot handling.
  - Fixture-backed TypeScript/JavaScript regression using the SessionStart hook
    twins and `tests/integration/codex-integration-profile.test.ts` references.
  - Query-budget tests proving deterministic pagination, bounded file and byte
    reads, stable deduplication, and honest trust metadata.
- Promotion target: Spec 042 delivery is complete and current behavior lives in
  [MCP surface design](../design/mcp-surface-design.md),
  [Runtime contracts](../reference/runtime-contracts.md),
  [Graph store design](../design/graph-store-design.md),
  [Language adapter design](../design/language-adapter-design.md), the
  [MVP proof matrix](../reference/mvp-proof-matrix.md), and the
  [plugin runbook](../runbooks/codex-agent-workbench-plugin.md). Closure proof
  is recorded in the [spec closure log](../history/spec-closure-log.md).

### EB054: Authority-Aware Documentation Intent Ranking And Count Semantics

- Priority: P1
- Status: closed through Spec 043 on 2026-07-21
- Friction signal: a healthy runtime `0.6.0` documentation-intent query for the
  rule governing SessionStart behavior returned a draft supporting install
  guide as the top result with roughly three times the score of later hits,
  while the canonical coding-agent integration design containing the governing
  rule did not appear on page one. The response correctly exposed authority and
  currency labels, but ranking used them as small additive boosts that lexical
  score could overwhelm. The same response reported
  `indexed_docs_count: 100` and `index_coverage.docs.indexed_files: 40`; source
  review showed these are valid counts for different universes whose names do
  not disclose their bases.
- Runtime surface: `docs_search`, documentation-map ownership, document
  authority and currency classification, FTS candidate selection and ranking,
  cursor pagination, documentation inventory contracts, and docs coverage
  presentation.
- Acceptance:
  - Documentation-intent ranking SHALL first establish query relevance, then
    prefer the documentation-map governing owner and stronger authority within
    the relevant set; an irrelevant canonical document SHALL NOT outrank an
    exact relevant result solely because of status.
  - Governing ownership SHALL remain distinct from truthful `doc_status` and
    authority labels. A draft owner may rank first with an explicit draft
    caveat; an archived or superseded owner SHALL surface a governance
    inconsistency rather than become authoritative.
  - Ranking SHALL be deterministic across pages and cursors SHALL bind the
    snapshot, query, scope, and ranking-policy identity so pagination cannot
    duplicate, omit, or reorder final ranked results.
  - The runtime SHALL freeze and persist a complete ranked universe of at most
    500 candidates before returning page one. A 501st candidate SHALL block
    with zero hits and no cursor rather than continuing from an incomplete
    universe.
  - Documentation-map owner signals SHALL be available to bounded indexed
    reranking without an unbounded per-query repository read.
  - Documentation counts SHALL expose their universe and basis, distinguishing
    searchable snapshot documents from dedicated priority-scan coverage and
    scoped counts without presenting near-identical names as interchangeable.
- Validation:
  - Fixture-backed intent query with a governing design owner, highly lexical
    supporting install guide, archived exact match, and irrelevant current
    canonical document.
  - Ownership-conflict and archived/superseded-owner tests preserve truthful
    authority and explicit governance caveats.
  - Stable multi-page ranking tests plus global, scoped, merged-scan, and
    partial-priority-scan count contracts.
- Promotion target: delivered through Spec 043, with closure proof in the
  [spec closure log](../history/spec-closure-log.md) and durable contracts in
  [MCP surface design](../design/mcp-surface-design.md),
  [Graph store design](../design/graph-store-design.md),
  [Runtime contracts](../reference/runtime-contracts.md), and the
  [Documentation map](../reference/documentation-map.md).

### EB055: Public Symbol Redaction Parity

- Priority: P0
- Status: delivered as a direct regression repair on 2026-07-20; source and
  fixture-backed tests are complete, and installed-runtime acceptance was
  confirmed in Claude Code on 2026-07-21; pending commit/release flow
- Friction signal: Claude Code and Codex independently queried runtime `0.6.0`
  against `fixture-redaction-boundary`. In the same `symbol_search` response,
  `source_section.text` replaced a workspace-escape or host-path value with a
  redaction marker while `signature` returned the classified value verbatim.
  Codex also observed the raw signature through `context_for_task`, and the
  same incomplete symbol sanitizer is used by `impact`.
- Runtime surface: symbol-reference presentation for `symbol_search`,
  `context_for_task`, and `impact`; shared presentation redaction; redaction
  fixtures and MCP envelopes.
- Acceptance:
  - One shared symbol-reference presentation sanitizer SHALL cover
    `signature`, `docstring`, and `source_section.text` on every public surface.
  - A value classified as a workspace escape, Unix or Windows host path,
    token-like secret, or other protected source content SHALL never appear raw
    in one symbol field while another field reports its redaction marker.
  - Corresponding fields SHALL use consistent redaction classification while
    ordinary route strings and safe repo-relative evidence remain readable.
  - Presentation redaction SHALL NOT mutate stored graph evidence or replace
    typed repo-relative path fields.
- Validation:
  - Extend `tests/presentation/redaction-boundary.test.ts` across signature,
    docstring, and source-section cases.
  - Extend `tests/mcp/query-tools.test.ts` and task-context/impact coverage so
    all three public surfaces reject raw protected fixture values.
- Promotion target: direct repair against the accepted workspace-safety and
  MCP-surface contracts delivered by closed Spec 007. Create a new spec only if
  implementation requires new public redaction vocabulary rather than complete
  use of the existing policy.
- Delivery evidence: `src/presentation/redaction.ts` now owns shared symbol
  sanitization used by every public symbol presenter, including the optional
  `find_references` target. Presentation and MCP tests cover
  traversal-like values, Unix and Windows host paths, token-like content, safe
  route strings, and unchanged stored graph evidence. Durable behavior is owned
  by the workspace-safety contract and MCP surface design.

### EB056: Impact Start-Node Truthfulness

- Priority: P1
- Status: delivered as a direct regression repair on 2026-07-20; source and
  fixture-backed tests are complete, and installed-runtime acceptance was
  confirmed in Claude Code on 2026-07-21; pending commit/release flow
- Friction signal: Claude Code and Codex both passed a fabricated node ID to
  `impact`. Runtime `0.6.0` returned `analysis_validity: valid`, no errors, and
  the same low/empty confidence reason used for a real symbol with no graph
  edges. A real terminal node remains distinguishable through its returned
  symbol/file, but the trust channel does not distinguish invalid input from a
  known empty blast radius and the fabricated case recommends
  `verification_plan` with no files.
- Runtime surface: `computeImpact`, graph target lookup, impact presentation,
  MCP error classification, recovery actions, and trust metadata.
- Acceptance:
  - After snapshot/publication validity succeeds and before traversal, `impact`
    SHALL prove the requested start node exists in the selected snapshot.
  - An unknown node SHALL return a non-retryable typed domain error with invalid
    analysis, blocked verification, empty impact evidence, and a callable
    `symbol_search` recovery action. It SHALL NOT recommend validation over an
    empty file set.
  - A known zero-edge node SHALL remain a valid low-confidence result containing
    its start symbol/file and a targeted validation action.
  - Stale, invalid, or unpublished snapshot failures SHALL retain precedence
    over node-existence classification.
- Validation:
  - Add known-empty versus unknown-node cases to
    `tests/graph/query-tools.test.ts`.
  - Add public envelope and recovery-action proof to
    `tests/mcp/query-tools.test.ts` or
    `tests/mcp/error-envelope-consistency.test.ts`.
- Promotion target: direct repair under EB038 and the accepted runtime/graph
  contracts. Create a new spec only if the existing domain-error vocabulary
  cannot represent an unknown published-snapshot node truthfully.
- Delivery evidence: `computeImpact` proves start-node existence after snapshot
  validity and before traversal; MCP failure classification preserves the typed
  domain code and presents an exact `symbol_search` recovery action. Graph and
  envelope tests distinguish unknown, known-empty, and stale-snapshot cases.

### EB057: Diagnostics Exclusion Truthfulness

- Priority: P1
- Status: delivered as a direct regression repair on 2026-07-20; source and
  fixture-backed tests are complete, and installed-runtime acceptance was
  confirmed in Claude Code on 2026-07-21; pending commit/release flow
- Friction signal: Claude Code and Codex both requested diagnostics for the
  existing `tests/fixtures/fixture-workspace-safety/.env`. The scanner correctly
  classified the path as secret, but `diagnostics_for_files` discarded that
  evidence and returned a non-blocking `not found` warning with valid analysis
  plus a follow-up containing the refused path.
- Runtime surface: `diagnoseChangedFiles`, shared path policy, catalog skipped
  evidence, diagnostics presentation, provider invocation, and MCP trust/error
  envelopes.
- Acceptance:
  - Requested diagnostics paths SHALL be reconciled with shared path-policy and
    scanner exclusion evidence before a true-missing finding is constructed.
  - An existing secret path SHALL return non-retryable
    `workspace_safety_blocked`, invalid analysis, and blocked verification; it
    SHALL NOT invoke a diagnostics provider, say the file is missing, or emit a
    follow-up containing the refused path.
  - A truly absent safe path SHALL retain the current non-blocking missing-path
    behavior.
  - Generated/vendor, configured, ignored, and other excluded paths SHALL keep
    their actual bounded reason instead of masquerading as missing.
- Validation:
  - Add secret, excluded, genuinely missing, and provider-not-called cases to
    `tests/diagnostics/diagnose-changed-files.test.ts`.
  - Add public trust/error consistency coverage to
    `tests/mcp/diagnostics-for-files-tool.test.ts` and
    `tests/mcp/error-envelope-consistency.test.ts`.
- Promotion target: direct repair under EB005, EB038, and EB039 plus the
  workspace-safety contract. Create a new spec only if implementation requires
  a new public exclusion or refusal vocabulary.
- Delivery evidence: diagnostics request reconciliation now preserves scanner
  and shared path-policy classifications before provider dispatch. Use-case and
  MCP tests prove secret blocking, provider suppression, exact exclusion
  reasons, and the distinct safe missing-path behavior.

### EB058: Same-Schema Runtime Upgrade Orphan Recovery

- Priority: P0
- Status: delivered as a direct regression repair on 2026-07-20; source,
  fixture-backed tests, and repo-local runtime initialization are complete
- Friction signal: after the repo-local runtime advanced from `0.6.0` to
  `0.6.1`, both Codex and Claude Code closed the MCP connection before the
  initialize response. The prior daemon was positively dead, but its owner and
  `building` snapshot named runtime identity `0.6.0:2`; orphan reconciliation
  required identity equality with `0.6.1:2` and therefore rejected an otherwise
  exact same-repository, same-schema recovery chain as ambiguous.
  Live recovery then exposed a second startup-path defect: snapshot retention,
  full-FTS rebuilding, and `VACUUM` ran inside the bounded refresh worker. On
  the repository cache that work outlived the 60-second deadline, consumed a
  worker thread, left the target `building`, and serialized status diagnostics
  behind settlement.
- Runtime surface: per-repository daemon admission, repository ownership,
  orphaned graph builds, same-schema upgrades, and MCP initialize readiness.
- Acceptance:
  - A replacement runtime SHALL reconcile a positively dead prior-runtime
    owner when repository identity and schema match and every orphaned build
    names an exact recovered owner generation.
  - Runtime-version inequality alone SHALL NOT make a same-schema positive
    dead-owner chain ambiguous.
  - A live or inconclusive owner, repository mismatch, schema mismatch, or
    incomplete generation chain SHALL remain blocked without mutating the
    derived store.
  - Recovery SHALL mark matching orphaned builds failed, preserve the last
    published snapshot, install the current active owner without retaining a
    stale recovered-owner chain, and allow MCP initialize to complete.
  - Interactive refresh retention SHALL delete only retired snapshot rows and
    their exact FTS evidence. It SHALL NOT rebuild or optimize the full FTS
    universe or compact the database on the publication path; status and
    diagnostics SHALL remain responsive while refresh is active.
- Validation:
  - Graph-store tests cover compatible cross-runtime recovery plus incompatible
    schema and incomplete-chain refusal.
  - Daemon-entrypoint integration starts from a prior-version owner record and
    proves terminal orphan disposition, current ownership, and initialize
    success.
  - Live process/thread and publication evidence proves the prior refresh was
    spending its deadline in derived-store maintenance; the replacement runtime
    publishes without scheduling those maintenance operations.
  - Repo-local Codex and Claude launchers share the corrected `0.6.1` runtime;
    an exact cached-launcher initialize request returns server version `0.6.1`.
- Promotion target: direct repair under EB036 daemon ownership and EB052 refresh
  convergence. Durable behavior is owned by the runtime operations design and
  install runbook; create a new spec only if cross-schema migration recovery is
  introduced.

### EB059: Ranked Documentation Universe Population And Observability

- Priority: P1
- Status: proposed; discovered during Spec 043 Phase 4 independent operational
  review and intentionally excluded from T006 pending a normative storage policy
- Friction signal: Spec 043 bounds every frozen documentation universe to 500
  hits and 15 minutes, but concurrent first-page searches can create an
  unbounded number of still-live universe rows. Phase 4 telemetry records safe
  aggregate candidate counts and terminal blockers, but not matched-concern
  totals, freeze duration, first-page versus continuation reads, eviction, or
  live-population pressure.
- Runtime surface: ranked documentation universe persistence, cursor lifetime,
  daemon-shared query state, and aggregate-only operational telemetry.
- Acceptance:
  - Choose and document the maximum live universes per repository or snapshot;
    do not introduce an implicit or environment-dependent limit.
  - Define deterministic eviction scope and order. The implementation review
    recommends `expires_at ASC`, `created_at ASC`, then `universe_id ASC` after
    the normative cap is chosen.
  - Decide whether capacity eviction may invalidate an otherwise-live cursor and
    map that outcome explicitly to structured stale evidence.
  - Emit bounded metrics for live population, eviction, matched-concern count,
    freeze duration, and first-page/continuation reads without recording raw
    query text.
  - Add concurrency, boundary, deterministic eviction, cursor-staleness, and
    telemetry tests against the persisted store and daemon-shared runtime.
- Promotion target: create a focused persistence/operations spec because the
  cap and cursor-eviction semantics are product decisions; promote the result to
  graph-store design, MCP surface design, runtime contracts, and operator
  observability guidance.

### EB060: Ranked Documentation Readiness And First-Read Trust

- Priority: P1
- Status: closed through Spec 044 on 2026-07-21; accepted behavior is promoted
  to the runtime contracts, MCP surface, graph-store and runtime-operations
  designs, proof matrix, changelog, and dogfood ledger
- Friction signal: after Spec 043 closed, Claude Code and Codex independently
  called `docs_search` on runtime `0.6.1` against the same published fresh
  snapshot. Both received `blocked_ranking_unavailable`, while
  `repo:///orientation` reported `orientation_reusable: true`, no material
  blockers, and docs evidence. Read-only persisted-state inspection showed the
  concern index was present but invalid with `Mapped owner is not a file:
  docs/adr.` A directory link added to the documentation-map canonical-owner
  table during promotion violated the file-owner contract. Removing it exposed
  a second deterministic blocker: the canonical backlog owner had grown beyond
  the 120,000-byte whole-owner classification limit even though owner state is
  derived from bounded frontmatter/status evidence. The recovery action pointed
  to `repo:///status`, but status exposed neither concern-index readiness nor
  either failure reason.
- Runtime surface: documentation-map validation, concern-index publication,
  `repo:///status`, `repo:///orientation`, `docs_search` recovery actions,
  first-read trust, and real-repository closure validation.
- Acceptance:
  - The checked-in documentation map SHALL pass the same owner-resolution
    validation used by snapshot indexing; a directory owner or other invalid
    mapped target SHALL fail focused repository validation before promotion or
    closure.
  - Canonical owner classification SHALL read only the bounded metadata needed
    for owner state. A large indexed Markdown owner SHALL NOT invalidate the
    complete concern index solely because unrelated body content exceeds the
    metadata bound, and the implementation SHALL NOT raise an arbitrary
    whole-file ceiling as the repair.
  - Status SHALL expose bounded documentation-ranking readiness for the visible
    snapshot, distinguishing ready, invalid, and unavailable states and naming
    a safe actionable reason when readiness is blocked.
  - Orientation SHALL include required documentation-ranking invalidity in its
    first-read trust decision. It SHALL NOT report reusable/no-blocker health
    over a `docs_search` route that is deterministically blocked.
  - `refresh_required` SHALL indicate only a condition that coordinated refresh
    can clear. Invalid repository-authored ranking policy SHALL route to source
    repair without creating a refresh loop.
  - A `docs_search` `ranking_unavailable` recovery action SHALL lead to a status
    receipt that explains the blocker and next repair or refresh boundary.
  - A fixture-backed regression and a real-repository acceptance check SHALL
    prove a published fresh snapshot has ready concern evidence and returns a
    non-blocked authority-aware ranked result for the SessionStart intent query.
- Promotion target: delivered through removed Spec 044 under EB003 and EB048
  first-read reliability, with EB054 ranking semantics retained and EB059
  capacity/eviction policy explicitly unchanged. Durable authority lives in
  [runtime contracts](../reference/runtime-contracts.md),
  [MCP surface design](../design/mcp-surface-design.md),
  [runtime operations design](../design/runtime-operations-design.md),
  [graph-store design](../design/graph-store-design.md), and the
  [proof matrix](../reference/mvp-proof-matrix.md); closure history is recorded
  in the [spec closure log](../history/spec-closure-log.md).

### EB061: Parser-Route Coverage-Domain Disclosure

- Priority: P1
- Status: proposed; implementation awaits the support-versus-disclosure design
  decision described below
- Friction signal: runtime `0.6.1` correctly replaced noisy lexical
  `find_references` results with five real parser import/export records and a
  complete parser-route exhaustion receipt. Three developer-relevant calls in
  a TypeScript integration test load the module through dynamic import and call
  `sessionStart.buildSessionStartContext(...)`; those forms are outside the
  indexed parser route. The response truthfully claims completion for the
  selected route but exposes no supported-reference-form boundary,
  `languages_inspected: []`, zero inspected files, and response metadata that
  reports resource-backed config/docs evidence despite parser-backed hits.
- Runtime surface: JS/TS reference extraction, parser-route coverage receipts,
  response metadata, supported-form capability disclosure, and dynamic-import
  member-call policy.
- Acceptance:
  - Parser-route completion SHALL name the indexed reference forms or an
    equivalent bounded coverage-domain identifier so agents cannot interpret
    route exhaustion as whole-program caller completeness.
  - Parser-backed results SHALL retain parser capability/evidence metadata even
    when no workspace files are reread during the query. Workspace scan
    accounting and graph-evidence scope SHALL remain distinct.
  - The design SHALL explicitly choose whether dynamic-import member calls are
    unsupported-but-disclosed or promoted into the canonical JS/TS extractor;
    no lexical or shell fallback may be added to mask the decision.
  - Tests SHALL cover static import/export references, dynamic-import member
    calls, empty parser routes, and metadata/coverage agreement.
- Promotion target: create a focused follow-up spec only after the
  support-versus-disclosure decision. Do not reopen Spec 042 or weaken its
  route-exhaustion and bounded-scan truthfulness guarantees.

### EB062: Node FTS Batch Identity Deduplication

- Priority: P2
- Status: proposed; discovered during Spec 044 Phase 4 publication timeout RCA
- Friction signal: after failed snapshots were pruned, the live graph store
  retained 58,190 `node_fts` rows for 42,348 distinct node identities. An
  extraction batch can upsert one node identity repeatedly into `nodes` while
  appending every occurrence to contentless FTS, inflating search storage and
  future rebuild work.
- Runtime surface: graph extraction batch normalization, node persistence,
  node FTS identity, and snapshot storage accounting.
- Acceptance:
  - Define one deterministic node record per node identity within an extraction
    batch before both relational and FTS writes.
  - Preserve the selected declaration metadata explicitly when duplicate
    identities disagree; do not silently rely on SQLite upsert order.
  - Prove node and `node_fts` cardinality agree for duplicate-ID fixtures,
    replacement, failed-build retention, and snapshot pruning.
  - Add bounded store telemetry or diagnostics only if an existing aggregate
    surface owns it; do not expose raw symbol content.
- Promotion target: direct graph-store/extraction repair under EB014 scale and
  graph-store design. Create a focused spec only if duplicate selection policy
  requires a new public semantic contract.

### EB063: Shared MCP Failure-Message Redaction

- Priority: P1
- Status: proposed; discovered during Spec 044 Phase 5 operations/security review
- Friction signal: ranked-documentation readiness reasons and the new
  mid-route environment blocker are bounded and redacted, but the generic MCP
  failure wrapper copies an arbitrary provider exception message directly into
  `errors[].message`. A provider or store exception can therefore expose an
  absolute host path or secret-like fragment even when its surface-specific
  data presenter is safe.
- Runtime surface: shared MCP failure classification, presentation redaction,
  error-envelope consistency, and cross-surface trust metadata.
- Acceptance:
  - Every generic MCP failure message SHALL pass through the shared public
    presentation redactor before entering `errors[]` or public data.
  - Redaction SHALL preserve typed failure class, cause code, retryability, and
    actionable bounded context without echoing workspace escapes, host paths,
    or secret-like values.
  - Representative docs, graph, diagnostics, and workspace-edit provider
    failures SHALL have golden parity tests at the shared wrapper boundary.
  - Surface-specific typed domain messages may remain more precise only when
    their schemas and tests prove equivalent safety; no per-tool hidden
    fallback redactors.
- Promotion target: direct shared-envelope repair under EB038 error-envelope
  consistency and the workspace-safety contract; create a spec only if public
  error vocabulary or compatibility must change.

### EB064: Production Documentation Corpus Isolation And Governing-Owner Priority

- Priority: P1
- Status: proposed; discovered during Codex dogfood on installed runtime
  `0.6.1` against fresh snapshot `1784672461549`
- Friction signal: `docs_search` returned `complete_ranked_universe` for
  `rule governing SessionStart behavior`, but ranked the draft/supporting
  dogfood ledger and backlog ahead of the current/canonical governing owner at
  rank 3. In the same session, `docs_current_for_task` admitted test-fixture
  documentation into the repository's canonical results, where fixture
  documents occupied three of the first four positions. Authority metadata is
  present, but production-corpus eligibility and governing-owner precedence do
  not yet protect first-page routing from fixture and mention-heavy evidence.
- Runtime surface: documentation catalog inclusion policy, documentation-map
  ownership, `docs_search`, `docs_current_for_task`, authority-aware ranking,
  corpus counters, and ranked-universe trust.
- Acceptance:
  - Define one explicit production-document eligibility policy shared by
    `docs_search` and `docs_current_for_task`. Documentation below fixture roots
    SHALL be excluded when indexing the containing product repository, while
    remaining eligible when that fixture is itself the selected repository
    root; do not add a query-time filename heuristic.
  - A current/canonical documentation-map owner that governs the requested
    concern SHALL rank ahead of draft/supporting documents that merely contain
    stronger lexical mentions. Supporting evidence may remain discoverable
    after the governing owner and SHALL retain its authority/status labels.
  - Complete ranked-universe receipts and documentation counters SHALL describe
    the same eligible corpus. Policy exclusions SHALL be bounded and
    attributable without leaking fixture content.
  - Add a production-repository regression proving no fixture document appears
    in `docs_current_for_task`, plus the exact SessionStart intent regression
    proving the current/canonical coding-agent integration owner ranks before
    the dogfood ledger and backlog.
  - Add a fixture-root regression proving the same fixture documentation is
    indexed normally when the fixture root is opened as the repository, so
    corpus isolation cannot erase fixture-backed documentation tests.
- Promotion target: promote corpus isolation and governing-owner priority
  together into one focused documentation-ranking spec under EB018, EB054, and
  EB060. Promote the accepted policy to the documentation map, MCP surface
  design, runtime contracts, graph-store design, and proof matrix; do not fold
  EB059 universe-capacity policy into that spec.

### EB065: Validation-Plan Skipped-Path Payload Compaction

- Priority: P2
- Status: proposed; discovered during Codex dogfood on installed runtime
  `0.6.1`
- Friction signal: `verification_plan` correctly selected and ordered all five
  repository CI gates, but wrapped the useful plan in roughly 50 individual
  `skipped_paths` records. `context_for_task` already demonstrates the desired
  bounded pattern by grouping skipped paths into a count and representative
  sample.
- Runtime surface: validation-plan presentation, skipped-path reason taxonomy,
  response budgets, truncation metadata, and MCP payload consistency.
- Acceptance:
  - Group skipped paths by stable reason with an exact count and a deterministic
    bounded representative sample; do not emit one public record per generated,
    vendor, cache, or archive path.
  - Preserve individually actionable requested-path exclusions and material
    validation blockers even when routine skipped paths are summarized.
  - Report whether samples were truncated and prove grouped counts equal the
    underlying classification decisions without exposing unbounded path lists.
  - Add a generated/vendor-heavy fixture regression that returns all expected
    repository-specific validation commands, including the five Agent
    Workbench CI gates, within the response budget and with deterministic
    skipped-path summaries.
  - Add presenter parity coverage so `verification_plan` and
    `context_for_task` use compatible bounded summary semantics rather than
    separate ad hoc shapes.
- Promotion target: schedule as an independent EB004 validation-planning and
  EB009 payload-observability repair. Create a spec only if compacting the
  public shape requires a compatibility or schema-version decision.

## Extension Idea Coverage

| Extension idea | Backlog coverage |
| --- | --- |
| Repo readiness packet | EB003, with EB001 and EB002 for capability visibility. |
| Integration health | EB001 and EB002. |
| Dynamic/contextual tool exposure | EB011, with EB001 and EB002 as prerequisites. |
| Validation planner with policy | EB004. |
| Post-edit repair panel | EB005, with EB008 for workspace risk. |
| Spec/task context | EB006. |
| PR/review readiness | EB005 and EB008; promote a dedicated review-readiness spec when PR evidence is mined. |
| Agent handoff packet | EB005, EB006, and EB008; promote a dedicated handoff spec when subagent evidence is mined. |
| MCP-server development support | EB007. |
| Fallback telemetry | EB009. |
| Generated/noise guard | EB008. |
| TODO/FIXME annotation surfacing | EB012. |
| HTML and web markup quality | EB013, under EB010. |
| Large-repo graph warmup scale and progress | EB014, under EB003 and EB009. |
| Large durable-doc audits | EB015, under EB003 and Markdown document quality. |
| Portable generic hook guardrails | EB016, with EB005, EB006, and EB008 boundaries. |
| Repo-configured auto-format hooks | EB017, with EB016, EB005, EB008, and Markdown document quality boundaries. |
| Stale-doc filtering | EB018, with EB006 and docs routing boundaries. |
| Repo capability inventory | EB019, with EB001, EB002, EB004, EB016, and packaging boundaries. |
| Workflow-friction report | EB020, under EB009. |
| Read-only handoff packet | EB021, with EB005, EB006, EB008, EB016, and EB018 boundaries. |
| Dogfood evidence ledger | EB022. |
| Trust calibration in tool outputs | EB023, with runtime contracts and presenter ownership. |
| Strong validation-status distinction | EB024, before proof bundles or command execution. |
| Proof bundle export | EB025, after trust calibration and validation-status hardening. |
| Doctor command | EB026, under runtime operations and package discoverability. |
| Threat model | EB027, with workspace safety and command policy boundaries. |
| Validation-policy trust levels | EB028, before command execution promotion. |
| Protocol and contract drift tests | EB029. |
| Review mode | EB030, with proof bundles and security-sensitive change detection. |
| Usage gaps resource | EB031, under EB009 and EB020. |
| Ranking explanations | EB032, with context/docs ranking surfaces. |
| Generated-file detection | EB033, under workspace hygiene and safety. |
| Security-sensitive change detection | EB034, after threat-model reconciliation. |
| Agent-readable changelog | EB035. |
| Per-repo runtime daemon and shared sessions | EB036, with EB052 owning refresh convergence and EB014 owning large-repo graph warmup scale. |
| Repo-root authority | EB037, under workspace safety and MCP surface hardening. |
| MCP error envelope consistency | EB038, under runtime contracts and trust calibration. |
| Shared path policy | EB039, with EB027 threat model and EB033 generated-file detection boundaries. |
| Runtime version single source | EB040, with EB001 integration health and release packaging. |
| Claude Code quick guidance | EB041, under coding-agent integration packaging. |
| Operator path documentation | EB042, under adoption and runbook usability. |
| Release-readiness gates | EB043, under package/release reliability. |
| Changed-files Workbench entry point | EB044, with EB005, EB006, EB011, and EB016 boundaries. |
| Native installer deprecation debt | EB045, with EB026 and EB043 packaging gates. |
| Kiro shell-free launcher | EB046, with EB043 packaging gates. |
| Turnkey native parser install | EB047, with EB026 and EB043 packaging gates. |
| Snapshot-aware orientation entry point | EB048, with EB003 first-read trust and EB001 integration health boundaries. |
| Executable context continuation and bounded navigation | EB049, with EB002, EB010, and EB011 routing boundaries. |
| Intent-aware validation guidance | EB050, with EB004 and EB024 validation trust boundaries. |
| Snapshot freshness versus deleted indexed paths | EB051, under EB003 first-read reliability, with EB048 orientation reuse, EB023 trust calibration, and EB038 error-envelope boundaries. |
| Daemon-owned refresh convergence | EB052, under EB003 first-read reliability, with EB036 daemon ownership and EB051 snapshot validity as prerequisites. |
| Reference completeness and bounded-scan truthfulness | EB053, under EB010 navigation quality and EB023 trust calibration. |
| Authority-aware documentation intent ranking and count semantics | EB054, under EB018 stale-doc filtering, EB032 ranking explanations, and documentation governance. |
| Public symbol redaction parity | EB055, under workspace safety and the closed Spec 007 redaction boundary. |
| Impact start-node truthfulness | EB056, under EB038 error-envelope consistency and graph trust semantics. |
| Diagnostics exclusion truthfulness | EB057, under EB005 diagnostics, EB038 error envelopes, and EB039 shared path policy. |
| Same-schema runtime upgrade orphan recovery | EB058, under EB036 daemon ownership and EB052 refresh convergence. |
| Ranked documentation universe population and observability | EB059, under EB054 authority-aware docs ranking, EB009 telemetry, and EB036 daemon ownership. |
| Ranked documentation readiness and first-read trust | EB060, delivered through removed Spec 044 under EB003, EB048, and EB054 without absorbing EB059 capacity policy. |
| Parser-route coverage-domain disclosure | EB061, under EB053 and JS/TS capability truthfulness. |
| Node FTS batch identity deduplication | EB062, under EB014 large-repository scale and graph-store storage invariants. |
| Shared MCP failure-message redaction | EB063, under EB038 error-envelope consistency and workspace safety. |
| Production documentation corpus isolation and governing-owner priority | EB064, under EB018 stale-doc filtering, EB054 authority-aware ranking, and EB060 first-read trust. |
| Validation-plan skipped-path payload compaction | EB065, under EB004 validation planning and EB009 bounded observability. |

## Immediate Next Specs

- Promote EB064 next as one focused documentation-ranking spec. Establish
  production-versus-fixture corpus eligibility before further ranking tuning,
  then prove the governing SessionStart owner precedes draft/supporting mention
  evidence on a complete ranked universe.
- Schedule EB065 independently as a bounded validation-plan presentation repair;
  it must preserve the five-gate plan and material exclusions while compressing
  routine skipped paths.
- Complete the normal commit/release flow for the delivered EB055, EB056,
  EB057, and EB058 direct repairs without folding them into active spec scope;
  installed-runtime acceptance is already recorded for EB055 through EB057.
- EB053/Spec 042 and EB054/Spec 043 are closed with durable reference and
  authority-aware documentation-discovery contracts and evidence.
- EB060/Spec 044 is closed with fresh snapshot readiness and truthful first-read
  recovery. Promote EB059 only after choosing the live-universe cap and
  cursor-eviction semantics; do not fold an arbitrary capacity constant into
  the closed Spec 043 scope.
  EB014 remains the separate candidate for large-repository completion scale
  and progress.
- Keep EB061 in backlog until the parser capability decision chooses explicit
  unsupported-form disclosure or canonical dynamic-import member-call
  extraction.
- Schedule EB063 as a direct shared-envelope hardening repair before treating
  generic provider exception messages as uniformly redacted.
