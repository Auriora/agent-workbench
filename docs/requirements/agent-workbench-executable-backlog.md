---
title: Agent Workbench executable backlog
doc_type: requirements
status: draft
owner: platform
last_reviewed: 2026-06-06
---

# Agent Workbench Executable Backlog

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
- Jaeger or OpenTelemetry traces for slow MCP tools, common call sequences,
  degraded spans, and shell fallback after a tool should have helped;
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
- existing agent tools such as CodeGraph, Graphify, Python Agent IDE, GitHub
  MCP, ActivityWatch MCP, spec-lifecycle MCP, Figma MCP, Context7,
  sequential-thinking, and memory.

### Evidence Source Decisions

These sources are approved for future mining only when the implementation stays
local-first, read-only by default, bounded, and redacted. They are planning
evidence, not proof, until confirmed by direct repo inspection, fixture tests,
or runtime telemetry.

| Source | Decision | First automation shape | Guardrails | Backlog route |
| --- | --- | --- | --- | --- |
| Codex chat history and sessions | Mine now | Existing local JSONL scanner with repo filtering, category counts, and bounded excerpts | Do not emit full transcripts; keep generated reports under `.tmp/` unless manually promoted | EB009 |
| Codex hook logs | Mine now | Existing scanner status/reason counts plus category matching | Clean and errored hooks remain quiet; use aggregate reasons, not noisy per-event output | EB005, EB009 |
| Jaeger/OpenTelemetry traces | Mine next | Span summary for slow tools, degraded states, skipped evidence, retry/fallback chains, and shell fallback after tool availability | Local/exported traces only; redact attributes; never require a live Jaeger server for normal validation | EB001, EB003, EB009 |
| MCP server logs | Mine next | Transport/session/tool-list error summaries and long-call aggregates | Treat protocol logs as operational evidence; redact arguments and paths outside the repo | EB001, EB007, EB009 |
| `AGENTS.md` files | Mine next | Repo instruction inventory for repeated validation, safety, dependency, and workflow requirements | Read-only scan; preserve repository scope and precedence; do not rewrite instructions automatically | EB004, EB008, EB009 |
| Spec and task docs | Mine next | Active/archived spec inventory, traceability gaps, stale open decisions, missing verification evidence | Defer generic lifecycle ownership to spec-lifecycle-manager; Agent Workbench only consumes task context | EB006, EB009 |
| Git history | Mine later | Commit-message and changed-file summaries for generated-artifact cleanup, validation fixes, and recurring agent repair commits | Avoid mining private author intent; classify only local repo metadata and bounded diffs | EB008, EB009 |
| PR review comments | Mine later | Review finding categories for missing tests, stale docs, risky diffs, and generated artifacts | Require explicit GitHub/PR context; do not make network access part of local default scans | EB005, EB008, EB009 |
| CI logs | Mine later | Failed-check summaries for wrong validation slices, missing native builds, environment mismatch, and package-manager errors | Use bounded logs from explicit local files or approved GitHub context; redact secrets | EB004, EB009 |
| Shell command logs | Defer | Optional command-frequency and failure-pattern summary when a reliable local source exists | Do not scrape interactive shell history by default; require explicit opt-in and redaction design | EB004, EB009 |
| Issue trackers and backlogs | Defer | Category summary when a project provides exported local issue/backlog data | No network default; treat external tracker content as advisory planning evidence | EB009 |
| Human IDE feature references | Mine manually | Reference matrix for problems panel, test explorer, SCM, call hierarchy, refactor preview, and task runner patterns | Do not copy product-specific UX; translate only agent-facing workflow needs | EB001, EB004, EB005, EB010 |
| Other agent tools and MCPs | Mine manually | Capability comparison notes for portable behavior that Agent Workbench should match or exceed | Do not import Python-specific or deprecated implementations; use fixture-backed portable lessons only | EB007, EB010 |

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
- Status: active principle, ongoing implementation
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
  - OpenTelemetry spans for latency, degraded state, and skipped evidence.
- Promotion target: continue through runtime operations and MCP surface work;
  create targeted specs for repeated failure classes.

### EB004: Policy-Aware Validation Planning

- Priority: P0
- Status: active implementation surface
- Friction signal: agents repeatedly try commands, discover missing tools or
  wrong environments, then change validation strategy manually.
- Runtime surface: `verification_plan`, repo policy discovery, command safety,
  and validation protocol.
- Acceptance:
  - Prefer repo scripts, docs, and policy files before generic validation
    commands.
  - Detect Docker, devcontainer, Nix, Bazel, package-manager, host-blocked, and
    missing-tool constraints where evidence exists.
  - Distinguish planned, blocked, and executed validation.
  - Explain why each proposed command is relevant.
- Validation:
  - Fixtures for host-allowed, Docker-required, missing-tool, package-manager,
    CMake, .NET, SAM, Go, Python, JavaScript, and docs-only repos.
  - Golden responses for blocked and low-confidence validation plans.
- Promotion target: continue current `verification_plan` work and promote weak
  ecosystem evidence into focused adapter specs.

### EB005: Multi-File Post-Edit Repair Loop

- Priority: P1
- Status: active Spec 020
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
- Promotion target: active
  [Spec 020](../specs/020-multi-file-post-edit-repair/requirements.md).

### EB006: Spec And Task Traceability Lookup

- Priority: P1
- Status: active Spec 021
- Friction signal: spec-driven work needs fast mapping from task IDs to
  requirements, design sections, files, validation gates, open decisions, and
  closure requirements.
- Runtime surface: Agent Workbench task context, with optional
  spec-lifecycle-manager MCP or skill integration.
- Acceptance:
  - Given a spec path or task ID, return related requirements, acceptance
    criteria, design sections, files, validation gates, open decisions, and
    closure requirements.
  - Distinguish active specs from archived delivery records.
  - Do not move generic spec-template ownership into Agent Workbench.
- Validation:
  - Fixture specs for active, archived, malformed, and traceability-rich
    packages.
  - Golden task lookup responses that route agents to files and checks.
- Promotion target: active
  [Spec 021](../specs/021-spec-task-traceability-lookup/requirements.md).

### EB007: MCP Server Repository Support

- Priority: P1
- Status: active Spec 022
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
- Promotion target: active
  [Spec 022](../specs/022-mcp-server-repository-support/requirements.md).

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
- Runtime surface: `src/debug/codex-history-mining.ts`, OpenTelemetry, hooks,
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
- Status: active multi-spec stream
- Friction signal: broad routing and impact analysis are weak when language or
  project-shape evidence is shallow.
- Runtime surface: language adapters, graph extraction, symbol search,
  references, impact, project-shape adapters, and validation planning.
- Acceptance:
  - Promote ecosystem capabilities only through fixture gates.
  - Label semantic proof, routing evidence, and heuristics distinctly.
  - Improve validation planning with project-shape evidence before command
    execution.
- Validation:
  - Active and archived specs for JavaScript/TypeScript, Go, SAM, CMake/C++,
    .NET, Markdown, and future ecosystems.
- Promotion target: continue active language and ecosystem specs.

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

## Immediate Next Specs

1. Spec 020: multi-file post-edit repair loop.
2. Spec 021: spec/task traceability integration.
3. Spec 022: MCP-server repository support.
