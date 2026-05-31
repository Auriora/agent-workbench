---
title: Agent IDE runtime MVP specification
doc_type: spec
status: draft
owner: platform
last_reviewed: 2026-05-31
---

# Feature Specification

## Summary

Build the first useful Agent IDE runtime: a local-first MCP backend that binds
to one repository, keeps a minimal SQLite graph/index, exposes scoped context
and symbol/reference tools, supports bounded preview/apply edits, and produces
validation plans without executing commands by default.

Unlike the predecessor `agent-ide` proof of concept, the runtime core must be
language-, framework-, and platform-neutral. Python is the first adapter path
for MVP comparison, not the shape of the graph model, use cases, validation
planner, or MCP contract.

## Problem

Coding agents fall back to broad shell search, broad file reads, and ad hoc
validation when they lack fast, trustworthy repository context. The MVP should
prove that indexed local evidence can reduce those fallbacks without hiding
uncertainty, broad scans, or unsafe workspace behavior.

The predecessor `agent-ide` project showed that agents most frequently used
first-pass planning, docs/search, diagnostics/lint, validation planning, and
post-edit feedback surfaces. It also showed that targeted symbol/reference tools
were underused unless a workflow explicitly routed agents toward them. This MVP
therefore optimizes the trusted first-pass loop and uses structured
`next_action` guidance to drive adoption of targeted symbol, reference, and
impact tools.

## Goals

- Provide a repo-scoped local runtime with explicit status, scope, and
  freshness.
- Persist minimal graph/index evidence in SQLite with FTS.
- Support Markdown/config routing and one fixture-backed partial-semantic
  language path.
- Keep core graph, adapter, context, validation, edit, and MCP contracts
  language-neutral so additional languages, frameworks, package managers,
  infrastructure platforms, and test ecosystems can be added without changing
  the core runtime shape.
- Expose a small MCP contract for status, scope, overview, task context, symbol
  search, references, bounded impact, preview/apply, and validation planning.
- Use the shared response envelope and canonical runtime enums.
- Enforce workspace safety for paths, generated writes, redaction, and command
  planning.
- Prove the MVP through fixtures, golden responses, budget tests, and degraded
  modes.
- Prioritize usage-proven first-pass workflows from the predecessor runtime:
  status/scope, bounded task context, docs/config routing evidence, validation
  planning, and edit safety metadata.
- Surface symbol, reference, and impact tools as exact next actions from context
  and validation responses when they would reduce direct file reads.
- Keep agent-facing feedback quiet by default. Tool responses should return
  detailed state only when it is directly actionable for the current agent task,
  while no-op, no-issue, unavailable, or backend-internal results should be
  silent or summarized as minimal metadata.
- Define every MCP resource/tool by a stable agent-facing schema, including
  clear names, descriptions, parameters, and return structure. Backend tools,
  internal workers, diagnostics providers, or parser outputs must be translated
  into that schema rather than passed through.
- Support opt-in OpenTelemetry traces for runtime debugging and performance
  work, including OTLP HTTP export to Jaeger or a collector, while keeping
  telemetry disabled by default.
- Support a host-level Codex MCP launch mode that points at this repository
  checkout so runtime code updates are picked up after restarting Codex without
  reinstalling a packaged copy.
- Define the Codex-facing MVP integration mix explicitly: `AGENTS.md` guidance,
  host-level MCP configuration, stdio launch from this checkout, repo-local
  debug CLI commands, and future skill/plugin/hook artifacts that wrap the MCP
  contract without duplicating runtime behavior.

## Non-Goals

- Full graphical IDE UI.
- Cloud-hosted multi-user orchestration.
- Full semantic support for any language before promotion fixtures pass.
- C# or CloudFormation/SAM semantic support.
- Full support for every language, framework, package manager, infrastructure
  platform, or test ecosystem in the MVP.
- Graph reports, communities, god nodes, surprising connections, or usage-gap
  analytics.
- Post-apply hooks, diagnostics execution, lint execution, docs search as a
  standalone broad surface, and durable usage analytics in the MVP.
- Required Codex plugin installation for local development. The MVP must work
  through host-level MCP configuration that points at this repository checkout;
  plugin packaging is optional distribution work after the live-checkout path is
  proven.
- Command execution by default.
- Safe rename, change signature, safe delete, move symbol, or broad refactors.
- Vector search.

## Requirements

### Functional Requirements

- **FR-001**: The runtime MUST bind to one repository and expose status, scope,
  freshness, and adapter coverage.
- **FR-002**: The runtime MUST persist MVP graph evidence in SQLite with FTS for
  files, nodes, edges, unresolved refs, and snapshots.
- **FR-003**: The runtime MUST implement Markdown/config routing and one
  fixture-backed partial-semantic language adapter.
- **FR-003A**: Runtime core models and use cases MUST be language-neutral.
  Language, framework, package-manager, infrastructure, documentation, test,
  and tooling evidence MUST enter through adapter/provider contracts with
  explicit capability metadata.
- **FR-004**: The runtime MUST expose MVP resources: `repo:///status`,
  `repo:///scope`, and `repo:///overview`.
- **FR-005**: The runtime MUST expose MVP tools: `context_for_task`,
  `symbol_search`, `find_references`, bounded `impact`,
  `preview_workspace_edit`, `apply_workspace_edit`, and `verification_plan`.
- **FR-006**: All MCP responses MUST use the shared response envelope from
  [Runtime contracts](../../reference/runtime-contracts.md).
- **FR-007**: `preview_workspace_edit` MUST return a token with file identity
  and base hashes and MUST NOT mutate files.
- **FR-008**: `apply_workspace_edit` MUST reject stale previews and unsafe paths.
- **FR-009**: `verification_plan` MUST plan validation commands without
  executing them by default.
- **FR-010**: The runtime MUST enforce the
  [Workspace safety contract](../../reference/workspace-safety-contract.md).
- **FR-011**: The implementation MUST follow the
  [Layered runtime architecture](../../design/layered-runtime-architecture.md)
  with separate interface adapter, presentation, application, domain/policy,
  port, and infrastructure responsibilities.
- **FR-012**: MVP MCP resources and tools MUST be implemented as transport
  bindings over application use cases and presenters, not direct graph,
  parser, or filesystem operations.
- **FR-013**: The runtime MUST define cache, warm-up, work queue, worker pool,
  cancellation, and snapshot coordination ports according to
  [Runtime operations design](../../design/runtime-operations-design.md).
- **FR-014**: The runtime MUST allow bounded concurrent reads against the last
  valid snapshot while background warm-up or refresh work runs, and MUST
  serialize graph writes per repository.
- **FR-015**: The runtime MUST define `RuntimeContext`, MCP registry, shared
  argument parsing, state-store, and OTEL telemetry boundaries before MCP tools
  are implemented.
- **FR-016**: OpenTelemetry MUST be the default operational telemetry mechanism.
  MVP instrumentation MUST cover traces and low-impact performance signals;
  metrics and structured operational log events may be emitted as OTEL metrics,
  span attributes, or stable instrumentation events until a dedicated metrics
  pipeline is promoted. Durable usage records MUST NOT be added unless a
  fixture-backed workflow-history query requires persisted usage events.
- **FR-017**: The runtime MUST treat MCP as the authoritative executable
  integration surface for coding agents. Agent-specific plugins, hooks,
  commands, skills, rules, steering, guidelines, extensions, and ACP packaging
  MUST be generated or configured around MCP definitions, not implemented as
  parallel runtime behavior.
- **FR-018**: The implementation MUST define common coding-agent integration
  specs for instruction packs, skill packs, hook intents, command specs, MCP
  binding specs, integration manifests, and agent capability metadata before
  adding vendor-specific emitters.
- **FR-019**: Vendor-specific integration emitters MUST stay outside
  application/domain behavior and MUST NOT depend on concrete SQLite,
  tree-sitter, filesystem watcher, or process execution implementations.
- **FR-020**: The architecture MUST define Markdown document quality contracts
  for parser-backed structure checks, repository compliance linting, and
  readability formatting. Executable Markdown quality tools are post-MVP unless
  promoted by fixture-backed scope decision.
- **FR-021**: Markdown readability formatting contracts MUST require rendered
  meaning preservation, fenced-code protection by default, non-trivial rewrite
  rationale, and the bounded edit preview/apply safety path before any future
  mutation support.
- **FR-022**: MVP first-pass read tools MUST NOT call broad orientation,
  full-topology, diagnostics execution, or high-cardinality cache validation
  paths as hidden implementation details.
- **FR-023**: `context_for_task` and `verification_plan` MUST include structured
  next actions for `symbol_search`, `find_references`, `impact`, direct reads,
  or follow-up validation when their evidence is partial, ambiguous,
  signatures-only, or routing-only.
- **FR-024**: Runtime usage analytics and fallback/direct-read tracking are
  post-MVP durable features, but MVP responses MUST expose enough
  machine-readable skipped-work and next-action metadata to support those
  analytics later.
- **FR-025**: The first Python adapter MUST NOT introduce Python-specific fields
  into shared graph, context, validation, edit, or MCP response contracts unless
  those fields are namespaced adapter metadata.
- **FR-026**: The MVP MUST include fixture or contract evidence that an
  unsupported non-Python language or platform file is reported with explicit
  `unsupported` or `resource_backed` capability rather than being silently
  ignored or coerced into Python semantics.
- **FR-027**: MCP tools MUST be named and described for agent task use rather
  than backend implementation names. Each public tool/resource definition MUST
  include a schema-owned description, parameter descriptions, capability class,
  budget policy, and expected return structure.
- **FR-028**: MCP responses MUST NOT expose raw backend tool names, internal
  worker output, parser payloads, linter output, or diagnostics provider output
  unless an MCP schema explicitly models that field. Backend results MUST be
  mapped into the public schema by use cases and presenters.
- **FR-029**: Agent-facing feedback MUST be quiet by default. Successful
  no-op results, files with no findings, unsupported optional analyzers, or
  per-file processing failures that do not affect the current task MUST be
  omitted or summarized as minimal metadata instead of producing noisy warnings.
- **FR-030**: The MVP MUST preserve the useful predecessor workflows without
  duplicating predecessor tool names or backend surfaces: docs/config routing,
  validation planning, test planning, and file-change static feedback must be
  represented through this runtime's MCP schemas.
- **FR-031**: File-change static feedback MUST be modeled as a read-only,
  optional `static_feedback` section of `verification_plan` for touched files.
  It MUST prefer silence when there are no actionable findings or when optional
  analysis cannot process a file. It MUST report only actionable findings,
  blockers, or concise next actions that help the agent continue the current
  task.
- **FR-032**: Runtime telemetry MUST be configurable and disabled by default.
  When enabled, it MUST support OpenTelemetry trace export to a configurable
  destination, including OTLP HTTP endpoints suitable for Jaeger or an
  OpenTelemetry Collector.
- **FR-033**: Debug harnesses that run MCP use cases against arbitrary target
  repositories MUST be repo-local development tools for `agent-workbench` only.
  They MUST NOT be exposed as public MCP tools/resources or emitted to other
  projects.
- **FR-034**: Profiling support MUST be considered in runtime boundaries and
  debug harnesses so slow MCP paths can be identified through spans, budgets,
  counters, and profiler runs without changing public MCP schemas.
- **FR-035**: The runtime MUST provide a stdio MCP entrypoint suitable for
  host-level Codex configuration with absolute paths to this repository
  checkout. Restarting Codex MUST be sufficient to pick up normal source changes;
  dependency changes may require `pnpm install` but MUST NOT require reinstalling
  a plugin or copied runtime package.
- **FR-036**: The MVP MUST define a Codex integration profile that states which
  Codex features are used for replacement readiness: `AGENTS.md` for repository
  guidance, host-level MCP config for executable tools/resources, stdio launch
  from this checkout for live runtime updates, and repo-local CLI/debug commands
  for profiling and MCP-use-case testing.
- **FR-037**: Codex skills MUST be implemented as guidance artifacts that teach
  agents when to call the MCP resources/tools, including status, task context,
  symbol/reference/impact, edit preview/apply, and `verification_plan`. Skills
  MUST NOT reimplement runtime logic or bypass MCP schemas.
- **FR-038**: Codex plugin packaging MUST be available as a wrapper around the
  stdio live-checkout path. The plugin MUST package MCP configuration, skills,
  optional hooks, and setup metadata only; it MUST NOT introduce a second copied
  runtime path that requires reinstalling to pick up local source changes.
- **FR-039**: Codex hooks MUST be implemented as optional quiet wrappers for
  session-start and changed-file/post-edit feedback. They MUST be silent by
  default, MUST emit only concise MCP follow-up guidance when explicitly enabled,
  and MUST NOT run analysis, hide failures, or return partial results for
  timeout/failure cases.
- **FR-040**: Runtime capabilities MUST use one explicit implementation path
  unless the spec and fixture-backed tests explicitly require a primary and
  fallback route. Timeout, crash, parser, provider, or validation failures MUST
  NOT be hidden by returning partial results as though they were successful
  evidence. Failure handling MUST perform root-cause analysis, fix the
  underlying cause where possible, and otherwise return structured degraded or
  blocked state that names the missing evidence.

### Key Entities

- **File**: repo-relative path, content identity, language, freshness, and
  indexing status.
- **Node**: symbol, outline, or resource-backed element with source range and
  metadata.
- **Edge**: relationship between nodes with confidence and provenance.
- **Unresolved Reference**: extracted reference that could not be resolved with
  enough confidence.
- **Snapshot**: repo/config identity and freshness state.
- **Preview Token**: bounded edit proposal with file identity and base hashes.
- **Validation Plan**: planned diagnostics, formatting, lint, or test commands
  with blocked/unsafe states.
- **Static Feedback**: optional `verification_plan` section for touched files
  that reports actionable static findings or blockers while omitting clean files
  and non-blocking optional analyzer failures.
- **Presenter**: response assembler that applies envelopes, metadata,
  warnings/errors, source sections, truncation, budgets, and next actions.
- **Use Case**: application operation that orchestrates domain policies and
  ports and returns application results rather than MCP envelopes.
- **Port**: interface consumed by application/domain code and implemented by
  infrastructure adapters.
- **Warm-Up**: background process that opens/migrates the graph store, scans
  scoped files, extracts changed files, resolves references, refreshes FTS, and
  publishes a fresh snapshot.
- **Cache**: derived in-memory or persisted acceleration state scoped by
  snapshot id, file hash, query parameters, or explicit invalidation rules.
- **RuntimeContext**: per-call context containing repo/workspace identity,
  snapshot/freshness, budget/deadline, cancellation, OTEL trace context, and
  optional usage context.
- **Registry Definition**: declarative tool, resource, or prompt definition
  containing schema, argument parser, use-case binding, presenter binding,
  budget policy, and capability policy.
- **Integration Manifest**: common description of agent-facing artifacts,
  target agents, supported surfaces, provenance, runtime version, regeneration
  policy, and unsupported capabilities.
- **Instruction Pack**: generated or maintained repository guidance for
  AGENTS.md-style, Claude, Gemini, Kiro, Augment, Junie, or future instruction
  targets.
- **Skill Pack**: portable workflow package that teaches agents how to use
  runtime capabilities without duplicating runtime logic.
- **Hook Intent**: vendor-neutral lifecycle intent that can be emitted as an
  agent-specific hook only at the integration boundary.
- **Codex Integration Profile**: Codex-specific mapping from common integration
  contracts to `AGENTS.md`, host-level MCP config, stdio launch, optional
  skills, optional plugin packaging, optional hooks, and repo-local debug
  commands.
- **Codex Skill**: optional guidance package that teaches preferred MCP
  workflows without duplicating runtime logic.
- **Codex Plugin Package**: optional distribution artifact that may bundle MCP
  config, skills, hook declarations, and setup metadata while preserving the
  repository-checkout runtime as the update source during local development.
- **Markdown Quality Finding**: structured documentation finding with source
  range, severity, check category, evidence, and suggested action.
- **Markdown Format Plan**: proposed documentation rewrite for text readability
  and renderability, including rationale, affected ranges, and preview/apply
  safety metadata.
- **Adapter Evidence**: language, framework, config, infrastructure,
  documentation, test, or tooling evidence emitted through a common adapter
  contract with capability level, domain, provenance, confidence, and optional
  namespaced metadata.
- **Platform Model**: resource-backed or partial-semantic evidence about
  package managers, build systems, test runners, CI, containers, infrastructure,
  framework routing, or project configuration.
- **Quiet Feedback Policy**: presentation rule that suppresses no-op,
  no-finding, unsupported optional analyzer, and backend-internal details unless
  the information is actionable for the current task.
- **Schema Translation Boundary**: MCP contract rule that maps all backend
  provider output into public tool/resource schemas and prevents raw backend
  payloads from leaking to agents.

## Acceptance Criteria

1. **Given** `fixture-basic-python`, **When** the runtime initializes, **Then**
   `repo:///status` reports repo scope, freshness, skipped roots, and
   `partial_semantic` adapter coverage.
2. **Given** a known fixture symbol, **When** `symbol_search` runs, **Then** the
   response matches the golden output and stays within the warm budget in
   [MVP proof matrix](../../reference/mvp-proof-matrix.md).
3. **Given** a known fixture reference, **When** `find_references` runs, **Then**
   resolved and ambiguous references are labeled with confidence and evidence.
4. **Given** a bounded edit, **When** `preview_workspace_edit` runs, **Then** no
   file changes and the preview token includes base hashes.
5. **Given** a stale preview, **When** `apply_workspace_edit` runs, **Then** the
   edit is rejected with a `stale_preview` blocker.
6. **Given** missing `tree-sitter` parser/grammar, parser failure, missing
   future optional enrichment evidence, or missing test tooling, **When**
   context or validation is requested, **Then** the response reports the
   affected capability and blocked validation instead of semantic proof or an
   alternate parser fallback.
7. **Given** unsafe paths, symlink escapes, generated/vendor targets, or
   secret-like content, **When** a tool attempts to index, report, or mutate
   them, **Then** the workspace safety contract is enforced.
8. **Given** the implementation source tree, **When** architecture boundary
   checks run, **Then** domain/application/presentation code do not import
   concrete MCP, SQLite, tree-sitter, filesystem watcher, or process execution
   implementations.
9. **Given** a cold repository runtime, **When** warm-up runs, **Then**
   `repo:///status` reports cold/refreshing/fresh state, queued work, and
   degraded blockers without hiding broad work inside a read tool.
10. **Given** file changes during background refresh, **When** concurrent read
   tools run, **Then** they read the last valid snapshot or report stale/
   refreshing metadata, while obsolete extraction results are rejected.
11. **Given** malformed MCP arguments, **When** a tool or resource handler is
   called, **Then** shared argument parsing returns a structured invalid-input
   response before any use case executes.
12. **Given** runtime operations execute with telemetry enabled, **When** traces
   and performance signals are inspected, **Then** OTEL spans and low-impact
   metrics or instrumentation events cover dispatch, use case, graph/query,
   worker, cache, and presentation boundaries.
13. **Given** coding-agent integration artifacts are generated or described,
   **When** the integration profile is inspected, **Then** MCP bindings are the
   executable source of truth and unsupported agent-specific surfaces are
   reported explicitly rather than silently replaced by alternate behavior.
14. **Given** the common coding-agent integration contracts, **When** MVP
   architecture checks run, **Then** agent-specific integrations are described
   as generated or configured artifacts around MCP definitions rather than as
   parallel runtime behavior.
15. **Given** the post-MVP Markdown quality contracts, **When** architecture
   checks run, **Then** documentation findings and formatter plans are modeled
   as read-only or previewable contracts that cannot bypass workspace safety.
16. **Given** a broad task prompt, **When** `context_for_task` returns routing
   evidence, **Then** it reports whether the packet is complete enough for a
   narrow edit and includes exact next actions for symbol/reference/impact or
   direct source verification when target confidence is insufficient.
17. **Given** a validation plan for changed files, **When** test discovery is
   uncertain, **Then** the response distinguishes planned checks from proven
   runnable checks and does not imply command execution or nearest-test proof.
18. **Given** a fixture containing supported Python, Markdown/config, and
   unsupported or resource-backed non-Python files, **When** status, scope, and
   context are requested, **Then** every language/platform area is represented
   with explicit capability metadata and no Python-specific contract fields leak
   into shared response shapes.
19. **Given** a backend diagnostic, parser, validation, or worker provider
   returns raw implementation output, **When** an MCP response is produced,
   **Then** the response contains only fields defined by the public MCP schema
   and no backend tool names or raw provider payloads leak through.
20. **Given** file-change feedback has no actionable findings, or optional
   analysis cannot process a file without affecting the current task, **When**
   `verification_plan` presents `static_feedback`, **Then** the response is
   silent or minimal rather than distracting the agent with backend state.
21. **Given** host-level Codex is configured to launch the stdio MCP entrypoint
   from this repository checkout, **When** runtime source code changes and Codex
   is restarted, **Then** the launched MCP process uses the updated repository
   code without requiring plugin or package reinstall.
22. **Given** the Codex integration profile is generated or inspected, **When**
   the profile lists Codex features, **Then** it identifies `AGENTS.md`,
   host-level MCP config, stdio live-checkout launch, repo-local debug CLI,
   optional skills, optional plugin packaging, and optional hooks with clear
   MVP/post-MVP status and no parallel runtime behavior.
23. **Given** a Codex skill or plugin artifact is generated in a later slice,
   **When** architecture checks run, **Then** the artifact points agents to MCP
   schemas and does not duplicate tool logic, backend provider output, or static
   feedback behavior outside the runtime presenters.

## User Scenarios And Testing

### User Story 1 - Repository Status And Context (Priority: P1)

An agent starts work and needs scoped, trustworthy context before reading files
or editing.

**Independent Test**: `fixture-basic-python` and `fixture-markdown-config`
return golden `status`, `scope`, `overview`, and `context_for_task` responses,
including complete-enough markers and exact next-action guidance.

### User Story 2 - Targeted Symbol And Reference Evidence (Priority: P1)

An agent needs symbol and reference evidence without scanning the whole repo.

**Independent Test**: known fixture symbols and references match golden graph
rows, stay within query budgets, and are reachable from first-pass context
responses through structured next actions.

### User Story 3 - Bounded Edit And Validation Plan (Priority: P1)

An agent previews a bounded edit, applies it safely, and receives a validation
plan.

**Independent Test**: fixture edits prove preview token shape, stale apply
rejection, path refusal, planned validation commands, and clear planned versus
blocked validation status.

## Edge Cases

- Unsupported languages should be listed as unsupported, not silently ignored.
- Mixed-language repositories should report per-language and per-platform
  capability coverage without requiring every language to be semantically
  supported.
- Generated/vendor roots should be scoped and read-only by default.
- `tree-sitter` parser crashes should produce degraded evidence, not corrupt
  graph state.
- Dynamic references should remain ambiguous unless a resolver proves them.
- Validation commands may be unavailable, blocked, unsafe, or too broad.
- Secret-like values should be skipped or redacted.
- Broad task prompts may rank the wrong files if generic terms dominate; tests
  must prove domain/path/symbol evidence outranks generic terms and unrelated
  high-frequency files.
- Usage-heavy paths from the predecessor runtime, especially context,
  docs/config routing, validation planning, and edit safety metadata, must stay
  bounded even before post-MVP diagnostics or hooks exist.
- Static feedback hooks may fail to process a subset of files; unless that
  failure blocks the current edit or validation plan, the `verification_plan`
  `static_feedback` section should be omitted or summarized without
  interrupting the agent.
- Codex plugin packaging may cache copied files by design; local development
  must keep the host-level MCP live-checkout path authoritative so runtime
  source changes do not require reinstall.
- Codex skills can become stale if they duplicate schemas or tool behavior; they
  should describe workflows and cite MCP surfaces instead of restating contract
  details.
- Codex hooks can distract agents if they emit noisy lifecycle state; they must
  reuse quiet-feedback policy and never become required for core MCP behavior.
- Backend provider output may be verbose, unstable, or provider-specific; it
  must be normalized before crossing the MCP boundary.

## Success Criteria

- **SC-001**: Every MVP surface has a fixture-backed golden response.
- **SC-002**: Every enum in responses comes from [Runtime contracts](../../reference/runtime-contracts.md).
- **SC-003**: Every hot-path query has a row, traversal, source-byte, or time
  budget test.
- **SC-004**: Every mutating path has negative safety tests.
- **SC-005**: Degraded modes return structured metadata and next actions.
- **SC-006**: No MVP requirement depends on graph reports, usage analytics, C#,
  or CloudFormation/SAM semantic behavior.
- **SC-007**: Every MVP MCP surface has separate use-case and presenter tests.
- **SC-008**: Architecture boundary tests prove dependency direction for
  domain, application, presentation, interface adapter, and infrastructure
  layers.
- **SC-009**: Runtime operation tests prove cache invalidation, warm-up,
  obsolete work rejection, concurrent reads during refresh, and single-writer
  graph transactions.
- **SC-010**: Registry and argument-parser tests prove tool/resource definitions
  use shared parsing and do not hand-coerce raw MCP input.
- **SC-011**: OTEL instrumentation tests or contract checks prove runtime
  boundary spans and low-impact performance signals exist without adding durable
  usage records to MVP.
- **SC-012**: Integration boundary tests prove common integration specs can
  describe target agent surfaces without core runtime dependencies on
  vendor-specific emitters. Concrete vendor emitters remain post-MVP.
- **SC-013**: Markdown quality boundary tests prove future structure checks,
  compliance checks, and readability formatter previews cannot bypass
  preview/apply safety. Executable Markdown tools remain post-MVP unless
  explicitly promoted.
- **SC-014**: First-pass context and validation responses include exact
  next-action metadata for symbol/reference/impact follow-up or direct reads,
  and tests prove broad orientation work is not hidden inside compact/default
  responses.
- **SC-015**: MVP docs and proof gates reflect predecessor usage evidence:
  context, docs/config routing, validation planning, and edit safety are
  optimized before adding post-MVP hooks, diagnostics execution, or usage
  analytics.
- **SC-016**: Shared graph, adapter, context, validation, edit, and MCP
  contracts are language-neutral; Python-specific evidence is confined to the
  Python adapter or namespaced metadata.
- **SC-017**: Fixture tests prove unsupported or resource-backed non-Python
  language/platform files are reported explicitly with capability metadata.
- **SC-018**: MCP schema tests prove every public tool/resource has an
  agent-facing name, description, parameter descriptions, expected return
  structure, capability class, and budget policy.
- **SC-019**: Translation-boundary tests prove backend diagnostic/parser/worker
  outputs are mapped into public schemas and raw backend names or payloads do
  not appear in MCP responses.
- **SC-020**: Quiet-feedback tests prove no-finding static feedback and
  non-blocking optional analyzer failures produce silent or minimal responses.
- **SC-021**: Telemetry tests prove OTEL export is disabled by default,
  configurable by environment, and can target console or OTLP HTTP endpoints
  without changing MCP responses.
- **SC-022**: Debug harness tests prove repo-local debug commands can target
  external repos only when launched from this project and are not registered as
  MCP surfaces.
- **SC-023**: Host-level Codex launch tests or smoke checks prove the stdio MCP
  entrypoint runs from this repository checkout, supports explicit `repo_root`
  arguments when cwd is not the target repo, and can be updated by restarting
  Codex after source changes.
- **SC-024**: Codex integration profile tests prove MVP feature usage is
  explicit: `AGENTS.md`, host-level MCP config, stdio live-checkout launch, and
  repo-local debug CLI are in scope, while skills, plugin packaging, and hooks
  are implemented wrappers around MCP with no duplicated runtime behavior.
- **SC-025**: Codex skill/plugin/hook artifact tests prove generated guidance
  points to MCP schemas, stays quiet by default, and preserves the live-checkout
  update path for local development.

## Related Artifacts

- Design: [../../design/mcp-surface-design.md](../../design/mcp-surface-design.md)
- Research: [research.md](research.md)
- Layered architecture: [../../design/layered-runtime-architecture.md](../../design/layered-runtime-architecture.md)
- Runtime contracts: [../../reference/runtime-contracts.md](../../reference/runtime-contracts.md)
- Language adapter design: [../../design/language-adapter-design.md](../../design/language-adapter-design.md)
- Language capability matrix: [../../reference/language-capability-matrix.md](../../reference/language-capability-matrix.md)
- Workspace safety: [../../reference/workspace-safety-contract.md](../../reference/workspace-safety-contract.md)
- Proof matrix: [../../reference/mvp-proof-matrix.md](../../reference/mvp-proof-matrix.md)
- Plan: [plan.md](plan.md)
- Tasks: [tasks.md](tasks.md)
