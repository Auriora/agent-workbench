---
title: Agent Workbench executable backlog
doc_type: requirements
status: draft
owner: platform
last_reviewed: 2026-06-11
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
  - Use recent active-project evidence when reviewing roadmap priority; do not
    rank ecosystems by raw file counts, generated output, dependency trees, or
    one unusually large repository.
  - Allow identified tester availability to raise implementation priority when
    the tester can exercise the priority tools and provide concrete feedback.
  - Treat local project scans as advisory evidence until a candidate ecosystem
    has representative fixture repositories and validation expectations.
- Validation:
  - Active and archived specs for JavaScript/TypeScript, Go, SAM, CMake/C++,
    .NET, Markdown, PHP/Laravel, Nuxt/Vue, Rust, Ruby, and future ecosystems.
  - Local `/home/bcherrington/Projects` scan on 2026-06-07 recorded broad
    ecosystem signals for HTML/web markup, Node/npm, Docker/Compose, CMake,
    PlatformIO/Arduino, PHP/Laravel, Rust/Cargo, Ruby/Rails, Go, .NET, SQL,
    CloudFormation/SAM, Helm, Nix, and MCP repositories.
  - Recency review should count distinct recently touched projects per
    ecosystem. The 30-day scan favored Markdown/config, Python, Docker/Compose,
    Node/npm, HTML/CSS/JS/TS, C/C++/CMake, SQL, C#/.NET, Go, SAM, web test
    tooling, and one PlatformIO/Arduino client project. PHP/Laravel is raised
    to Level 1 priority because an identified PHP developer can test and give
    feedback. Nuxt/Vue web-app support is also Level 1 because the same tester
    works in JS/TS Nuxt and would exercise the same priority tool surfaces.
    Rust appeared in the 90-day window; Ruby/Rails was present in the wider tree
    but not recent.
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
- Friction signal: `aws-datalake` startup warmup no longer stack-overflows
  after the scalar intrinsic traversal fix, but full graph warmup remained
  CPU-bound for more than four minutes while the snapshot stayed
  `refreshing`; the run had already written roughly 159k nodes and 247k edges
  before it was stopped.
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
  - Performance fixes must not add parser, semantic, or command-execution
    fallbacks; they should address the actual indexing/write bottleneck.
- Validation:
  - Fixture or synthetic large-repo graph warmup tests with bounded generated
    files, resource-backed templates, Markdown docs, and parser-backed source.
  - Regression using an `aws-datalake`-shaped fixture or recorded metrics for
    the observed 159k-node/247k-edge warmup scale.
  - Tests for interrupted warmup, stale refreshing snapshots, progress
    reporting, and subsequent restart behavior.
  - Telemetry or debug harness output that records phase timings and row-count
    growth without requiring a live external tracing service.
- Promotion target: create a future runtime operations or graph-store scale
  spec under EB003, with telemetry evidence routed through EB009.

### EB015: Markdown Document Audit Scale And Chunking

- Priority: P1
- Status: candidate spec
- Friction signal: `aws-datalake` document-audit dogfooding found roughly 150
  durable Markdown docs outside `docs/specs`, concentrated in `docs/data-flow`,
  `docs/reference`, and `docs/runbooks`. A first Markdown quality call was too
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
  - Regression proving a broad aws-datalake-shaped durable-doc audit can be
    completed as bounded structured calls without direct filesystem fallback.
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
- Status: proposed spec
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
- Validation:
  - Fixture repositories with active specs, archived specs, closure logs,
    superseded design docs, removed-spec references, and durable current docs.
  - Golden docs/search/context responses proving stale docs are labeled and
    downranked without disappearing.
  - Regression tests proving exact historical prompts can still surface
    archived material with historical caveats.
- Promotion target: create a future docs-context trust spec under EB003,
  EB006, and the documentation routing design.

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
- Status: proposed spec
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
  - Contract/golden tests for major tool families.
  - Regression tests proving routing evidence is not labeled as proof.
- Promotion target: create a future response-metadata trust-calibration spec
  under runtime contracts and MCP surface design.

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
- Status: documented changelog created
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
  - Markdown review and future package/release checklist integration.
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
- Status: active Spec 032
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
  - Dogfood post-warmup sweep against `aws-datalake` with multiple concurrent
    clients and no `database is locked` resource or tool failures.
- Promotion target: active
  [Spec 032](../specs/032-per-repo-runtime-daemon-cache/requirements.md)
  before implementing broad graph-backed tool hardening.

### EB037: Repo-Root Authority And Debug Override Gate

- Priority: P0
- Status: active Spec 029
- Friction signal: external review and source inspection found that normal MCP
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
- Promotion target: active
  [Spec 029](../specs/029-repo-root-authority/requirements.md).

### EB038: MCP Error Envelope Consistency

- Priority: P0
- Status: active Spec 030
- Friction signal: external review and source inspection found uneven error
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
- Promotion target: active
  [Spec 030](../specs/030-mcp-error-envelope-consistency/requirements.md).

### EB039: Shared Path Policy And Secret Path Classification

- Priority: P0
- Status: active Spec 031
- Friction signal: external review found drift risk between scanner/catalog
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
- Promotion target: active
  [Spec 031](../specs/031-shared-path-policy/requirements.md).

### EB040: Runtime Version Single Source

- Priority: P1
- Status: proposed spec
- Friction signal: package version, MCP server metadata, integration health,
  and integration profile currently duplicate `0.1.0`, risking install,
  package, and health drift.
- Runtime surface: package metadata, MCP server card, integration health,
  common integration profile, Codex/Claude/Kiro packaging, tests, and release
  checks.
- Acceptance:
  - Runtime version is derived from one source of truth at build/install time.
  - Server-card metadata, health resources, integration profiles, and package
    manifests agree.
  - Tests fail when hardcoded version literals drift from package metadata.
- Validation:
  - Unit and integration tests for version propagation.
  - Package dry-run or installer dry-run evidence that emitted metadata agrees.
- Promotion target: create a focused metadata/version spec or include in the
  release-readiness spec if scope stays small.

### EB041: Claude Code Quick Guidance

- Priority: P2
- Status: proposed spec
- Friction signal: Claude Code packaging exists, but external review found that
  Claude needs a concise usage artifact instead of broad architecture docs.
- Runtime surface: Claude Code plugin package, generated skills/instructions,
  common integration profile, plugin README, and MCP call sequence guidance.
- Acceptance:
  - Provide a concise Claude-facing guide with the expected call sequence:
    status/scope/overview, `context_for_task`, targeted reads, preview/apply,
    and `verification_plan`.
  - Preserve MCP as the runtime contract and avoid Claude-specific runtime
    logic.
  - Omit normal `repo_root` override guidance.
- Validation:
  - Plugin package validation includes the Claude guide artifact.
  - Documentation review confirms guidance is concise and current.
- Promotion target: create a docs-only integration guidance spec or fold into a
  Claude packaging refresh slice.

### EB042: Operator Path Documentation

- Priority: P2
- Status: proposed spec
- Friction signal: external review found rich design docs but no small operator
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
- Friction signal: external review identified release risk across clean
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
- Friction signal: 2026-06-19 session-scoped plugin feedback from a
  Rails/spec-lifecycle phase reported that Agent Workbench was available but
  not naturally used. The agent defaulted to shell, spec-lifecycle MCP,
  subagents, and Docker validation because the visible Workbench surface did
  not provide an obvious first action after worktree changes, and the
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
  - Dogfood rerun on a Rails/spec-lifecycle task to check whether an agent uses
    the Workbench entry point before falling back to shell-only status and
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
| Per-repo runtime daemon and shared sessions | EB036, under EB003 first-read reliability and EB014 large-repo graph warmup scale. |
| Repo-root authority | EB037, under workspace safety and MCP surface hardening. |
| MCP error envelope consistency | EB038, under runtime contracts and trust calibration. |
| Shared path policy | EB039, with EB027 threat model and EB033 generated-file detection boundaries. |
| Runtime version single source | EB040, with EB001 integration health and release packaging. |
| Claude Code quick guidance | EB041, under coding-agent integration packaging. |
| Operator path documentation | EB042, under adoption and runbook usability. |
| Release-readiness gates | EB043, under package/release reliability. |
| Changed-files Workbench entry point | EB044, with EB005, EB006, EB011, and EB016 boundaries. |
| Native installer deprecation debt | EB045, with EB026 and EB043 packaging gates. |

## Immediate Next Specs

1. Spec 029: repo-root authority.
2. Spec 030: MCP error envelope consistency.
3. Spec 031: shared path policy.
4. Spec 032: per-repo runtime daemon and shared cache.
5. Spec 026: agent skills standard compliance.
