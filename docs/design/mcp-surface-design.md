---
title: MCP surface design
doc_type: design
status: draft
owner: platform
last_reviewed: 2026-07-21
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# MCP Surface Design

## Purpose

Define the agent-facing MCP resources and tools for the Agent IDE runtime.

## Scope

This design covers MVP resources/tools, post-MVP resources/tools, tool
capability classes, and tool budget behavior. Shared response envelopes and enum
definitions are owned by [Runtime contracts](../reference/runtime-contracts.md).

## Design Summary

The MCP surface separates cheap state reads from computation. Agents should be
able to begin with compact resources, use targeted workflow tools for routine
coding, and invoke broad graph analysis only when intentionally exploring.

Responses must label trust, freshness, scope, verification, and evidence so
agents know when direct source verification or additional validation is needed.
They must not make MCP tool state the center of the interaction. The default
presentation should be quiet and task-focused: return only actionable blockers,
warnings, next actions, or compact metadata that helps the agent continue the
current work.

Predecessor `agent-ide` usage showed that agents most often used first-pass
context, docs/search style routing, diagnostics/lint/validation planning, and
post-edit feedback, while symbol/reference tools were rarely selected without
workflow guidance. The MVP surface therefore stays small and makes
`context_for_task` and `verification_plan` responsible for routing agents to
`symbol_search`, `find_references`, `impact`, direct reads, or follow-up
validation when that evidence would reduce broad shell fallback.

MCP is an interface adapter, not the presentation layer and not an application
service. Each MCP handler validates transport input, calls one application use
case, and delegates output construction to presenters.

Tool handlers should use the shared MCP envelope wrapper for normal registry
failure paths. The wrapper owns argument parsing, launch-root authority checks,
provider availability checks, exception classification, and JSON text
serialization. Registries still own their schema, provider binding, use-case
invocation, and presenter binding. Recoverable parse, provider, use-case, and
presentation failures return structured response envelopes with the failure
classes defined in [Runtime contracts](../reference/runtime-contracts.md);
they must not leak raw exceptions to MCP callers or collapse stale state,
workspace-safety refusal, missing provider, and environment failure into one
invalid-input bucket.

Tools, resources, and prompts are declared through registries. A registry
definition owns the input schema, shared argument parser, use-case binding,
presenter binding, budget policy, and capability policy. It also owns the
public name, description, parameter descriptions, and expected return
structure. Names should describe the action in agent terms, not backend
implementation terms.

Contextual routing uses a conservative hybrid model. Public resources and tools
remain explicitly registered at startup for discoverability, while a stable
integration-health surface reports configured, registered, advertised,
caller-discovered, callable, unavailable, blocked, hidden, and unknown states.
Presenters must use shared session-aware filtering before emitting executable
`next_actions`; useful unavailable actions are labeled as unavailable caveats
instead of being presented as callable. A generic dynamic invocation router is
deferred until fixture evidence proves it improves agent outcomes without
becoming a fallback shell.

Shared argument parsers must handle repo paths, file paths, line/column pairs,
booleans, enums, limits, payload modes, and usage context. Invalid input returns
structured contract errors before any use case runs.

Normal public MCP resources and tools are anchored to the server launch root.
They must not advertise `repo_root` in normal metadata or tool schemas, and a
caller-supplied `repo_root` request field must return a structured blocked or
invalid-input envelope before the use case runs. Maintainer diagnostics may
enable debug root overrides only through
`AGENT_WORKBENCH_DEBUG_REPO_ROOT_OVERRIDE=1`; when enabled, integration health
reports `root_policy.authority: launch_root` and
`root_policy.debug_repo_root_override: true`.

For packaged agent integrations, the launch root is the target workspace or an
explicit fixed target supplied by the host integration. Plugin cache paths are
artifact caches for skills, hooks, manifests, and launch shims; they must not
become the analyzed repository root and must not be used as an alternate
runtime source tree. Codex source plugin config uses `${PLUGIN_ROOT}` only as
package input; npm `postinstall` materializes the installed config to an
absolute `mcp-launch.mjs` shim path and must not set `cwd`. Codex's session cwd
therefore remains the target workspace and the shim forwards that cwd as the
default repo root. Claude, Kiro, and future plugin bindings must make their
equivalent handoff explicit instead of deriving repository scope from an
artifact cache path.

Backend tools and workers are not part of the MCP contract. Parser payloads,
diagnostic provider output, lint output, test discovery records, worker state,
or internal tool names must be translated into the MCP resource/tool schema by
application use cases and presenters. If a backend result has no schema-owned
field, it is not returned.

MCP is also the primary cross-agent integration contract. Agent-specific
plugins, skills, hooks, commands, steering files, rules, guidelines, extensions,
and ACP packaging should be generated around MCP definitions, not implemented as
parallel tool surfaces. The canonical integration guidance lives in
[Coding agent integration design](coding-agent-integration-design.md).

## Presentation Boundary

Presenters own response consistency across every MCP resource and tool:

- shared response envelope construction
- metadata composition for freshness, capability, evidence, verification,
  budgets, and truncation
- shared helpers for metadata labels, trust calibration, and compact
  next-action lists, so trust labels are generated in one place and only
  included when they calibrate agent behavior
- warning, blocker, and error formatting
- source section packing and stable ordering
- retryable `next_action` mapping
- quiet-feedback suppression for no-op, no-finding, and non-blocking optional
  backend failures

Use cases must return application result objects, not MCP envelopes. MCP
handlers must not query SQLite, parse source, or assemble warnings/errors
directly.

Presenters decide whether a backend result is actionable enough to show. A file
with no findings should normally produce no feedback. A backend that cannot
process an optional file should be silent unless the current tool promised that
analysis or the failure changes the recommended next action.

Public standard-envelope presenters must use the shared trusted-envelope path.
The presenter selects a typed trust surface policy, finishes data sanitization,
and passes final warnings and errors to the shared response helper so
`meta.trust` reflects the complete envelope. MCP adapters and registries remain
thin: they validate input, bind providers, call use cases, and call presenters;
they do not hand-write trust caveats or create fallback trust routes.

The public surface policy coverage is:

| Surface family | Trust policy |
| --- | --- |
| `repo:///orientation`, `repo:///status`, `repo:///scope`, `repo:///overview` | `repository_status` |
| `repo:///docs/overview`, `repo:///docs/map`, `docs_search`, `docs_current_for_task`, `docs_outline` | `docs_routing` |
| `docs_read_section` | `docs_direct_read`; `precise_direct_read_claim` is safe only when returned metadata includes direct-read evidence |
| `docs_scope` | `docs_session_scope` |
| `check_markdown_document`, `check_markdown_set` | `markdown_quality` with bounded direct-read evidence when present |
| `context_for_task` | `context_routing` |
| `symbol_search`, `find_references`, `impact` | graph symbol/reference/impact routing policies |
| `diagnostics_for_files` and public post-edit feedback envelopes | `diagnostics_static` |
| `verification_plan` | `validation_plan` |
| `preview_workspace_edit` | `edit_preview` |
| `apply_workspace_edit` | `edit_apply` when the use case reports an applied mutation |
| `integration:///health/agent-workbench`, `integration_health` | `integration_health`; the resource is static and the tool accepts bounded caller evidence |
| `integration:///profiles/codex`, `integration:///profiles/current` | `integration_profile`; legacy Codex configuration and connection-effective evidence respectively |

Recoverable public handler failures, including missing or failing resource
providers, return structured envelopes that still carry trust calibration.
Transport failures that prevent MCP response framing are the only expected
public exclusion.

First-read resource and planning surfaces must keep this boundary explicit.
`repo:///orientation`, `repo:///status`, `repo:///scope`, and `repo:///overview` report freshness,
adapter coverage, scanner budget, watcher caveats, skipped paths, and provider
failure envelopes through the shared response metadata and repository-status
trust policy. `context_for_task`, docs routing, diagnostics, and
`verification_plan` must preserve skipped, missing, provider-limited, and
planned-only evidence as agent-facing caveats or status fields. Planned
validation commands remain non-executed evidence; diagnostics provider
failures remain needed routing evidence rather than a clean no-op.

## MVP Resources

- `repo:///orientation`
- `repo:///overview`
- `repo:///status`
- `repo:///scope`
- `repo:///docs/overview`
- `repo:///docs/map`
- `integration:///health/agent-workbench`
- `integration:///profiles/codex`
- `integration:///profiles/current`

These resources must be cheap, bounded, and backed by current snapshot metadata.
They must not trigger broad graph analysis.
`repo:///orientation` is the default compact entry receipt. It contains only
snapshot identity, freshness, a trust summary, material blockers, explicit
refresh triggers, and links to the detailed status, scope, and overview
resources. Ordinary content edits can make analysis stale without invalidating
the orientation decision; root, scope, ignore-policy, runtime-identity, policy,
or index-validity changes require a new orientation decision.
An indexed path deletion is an explicit orientation refresh trigger. Status,
orientation, and `context_for_task` consume the same bounded snapshot-validity
receipt; scan completeness and watcher state remain separately labelled
dimensions. Graph tools preflight the paths needed by their result and return a
blocked stale envelope with refresh guidance instead of leaking filesystem
errors or useful-looking partial evidence.
`repo:///status` must expose cold, refreshing, fresh, stale, and degraded
warm-up state, including queued work counts and indexing blockers where
available.

Status and integration health consume the daemon controller's one awaited
diagnostics receipt. They expose canonical execution, invalidation, publication,
visible/target snapshot, activity, worker-termination, freshness, and bounded
failure evidence without joining connection-local coordinator state to a
separate snapshot read. Invalid combinations or diagnostics failure lower
top-level trust; they do not synthesize `scheduled`, `unknown`, or healthy
success.

A stale first read requests the same daemon-owned generation boundary used by
startup and the watcher queue. The read remains bounded and does not wait for
broad indexing. Planned or running requests reuse one execution; a newer
generation produces one sequential catch-up. There is no public manual refresh
tool, polling contract, provider-specific route, or automatic retry action.

Detailed language/platform coverage belongs to `repo:///scope` and
`repo:///overview`; the status hot path must not enumerate broad catalog rows.

`repo:///overview` key-file output is a bounded routing aid, not semantic proof.
Ranking prefers project/package descriptors, application entrypoints, first-party
source files, tests, and repository-shape build or infrastructure anchors ahead
of workflow noise. Workflow files remain visible when they are present, and they
can still be the primary key files in workflow-focused repositories. Generated,
vendor, third-party, fixture, and package-cache paths are skipped by catalog
policy where possible and downranked when they remain inside allowed catalog
paths. Equal scores are ordered by path for deterministic output.

Each key file includes a compact `reason` naming generic evidence classes such
as package configuration, application entrypoint, first-party source, test,
build configuration, infrastructure template, runtime configuration, or workflow
configuration. These reasons describe path and repository-shape routing
evidence only; capability metadata remains the trust boundary for whether a
file has semantic support.

MCP-server repository support is also project-shape routing. `repo:///overview`
may label `mcp_server` plus transport platforms such as `mcp_stdio`,
`mcp_http_sse`, `mcp_streamable_http`, `mcp_docker`, or `mcp_devcontainer` when
MCP-specific entrypoint, tool-registry, protocol-doc, or config evidence exists.
Docker and devcontainer files are transport/environment evidence only after
MCP-specific evidence is present. Generated, vendor, fixture, cache, and temp
paths must not create MCP-server detection by themselves.

`repo:///docs/overview` and `repo:///docs/map` expose bounded Markdown
documentation routing evidence. They return repo-relative paths, titles,
heading outlines, links where available, skipped/unreadable path warnings,
truncation metadata, and direct-read caveats. They are routing surfaces, not
generated documentation reports and not semantic proof for precise claims.

`repo:///docs/overview` ranks important docs such as repository guidance,
README files, durable design/reference docs, and task-relevant guides ahead of
templates, update notes, generated output, vendor docs, and fixture material.
`repo:///docs/map` returns a deterministic bounded map of docs paths and
headings. Both resources preserve skipped-path evidence for unreadable,
generated, vendor, hidden, gitignored, missing, or permission-denied docs
without failing the whole resource.

`integration:///health/agent-workbench` is the stable static read-only MCP
health resource. MCP resource reads carry no pseudo-arguments, so it reports
server-known configuration, registration, connection identity, and unknown
caller discovery. The read-only `integration_health` tool accepts validated,
bounded caller discovery lists and calls the same application health use case.
Neither surface executes tools, persists caller claims, or mutates the
workspace, and reading the resource itself never proves discovery.

When the runtime is hosted by the per-repo daemon, integration health also
includes a compact `daemon` block with PID, socket path, repo root, connected
client count, controller/diagnostic revisions, worker invocation count,
execution and invalidation identities, target and visible snapshot identities,
warm-up and publication states, graph freshness, activity/worker-termination
state, and last failure when available.

Graph and docs queries select only published snapshots. While a replacement is
building, superseded, or failed they either use the prior published evidence
with truthful stale/blocked trust metadata or return structured unpublished
evidence when that exact snapshot was requested. They never expose partial rows
from an unpublished target. After successful publication, deleted file, graph,
documentation, heading, FTS, and coverage records are absent from the selected
snapshot.

Normal agent-facing resources such as `repo:///status` remain compact and expose
only freshness or blocked-state information needed for the next safe action.

`integration:///profiles/codex` describes the configured Codex wrapper,
plugin, skill, hook, packaging, and MCP binding model. It is documentation and
configuration evidence, not proof that a specific Codex session exposed every
configured binding.

`integration:///profiles/current` is the compact effective profile for one MCP
connection. Its provider is `codex`, `claude_code`, `kiro`, or `unknown` based
only on explicit connection-scoped launcher evidence. Registered bindings come
from the MCP registry rather than the Codex descriptor. Initialize client name
and version remain a separate observed artifact identity.

## MVP Tools

- `context_for_task`
- `integration_health`
- `symbol_search`
- `find_references`
- `impact` with explicit traversal and result caps
- `diagnostics_for_files`
- `docs_search`
- `docs_current_for_task`
- `docs_outline`
- `docs_read_section`
- `verification_plan`
- `preview_workspace_edit`
- `apply_workspace_edit`

Drift checking is part of `apply_workspace_edit`; it is not a separate MVP
tool.

### Reference Completeness And Continuation

`find_references` keeps parser/graph evidence primary. Parser-backed outgoing,
incoming, and unresolved routes are disjoint, drain in that order, and use a
limit-plus-one probe plus one authenticated composite continuation. Complete
parser evidence requires all three routes to be exhausted.

When parser evidence is absent, the bounded lexical route scans the ordered
policy-eligible catalog rather than one fixed first window. It either exhausts
that declared evidence universe or returns partial/truncated evidence with an
opaque callable continuation. Searchable missing, unreadable, oversized, or
changed candidates remain unresolved and prevent complete absence; explicit
secret, generated/vendor, unsupported, configured-skip, and unsafe-path policy
exclusions remain outside the universe and are summarized by bounded reason
counts.

Files are atomic scan units. Declared bytes are checked before admission,
actual bytes and elapsed time are observed after the admitted read, and no new
file starts at or after the monotonic deadline. Structural file/byte/result
stops preserve ordered evidence, structural progress, and non-time accounting
when both executions remain inside that deadline. Elapsed accounting and the
opaque cursor token that authenticates it may differ. A
live time stop may vary with scheduling or IO latency, but it must retain
authenticated prior progress, exact admitted-work accounting, partial trust,
and a safe continuation; it can never imply absence.

An unknown target is invalid blocked evidence with a non-retryable typed error
and same-snapshot `symbol_search` recovery. No-coverage or stale results are
never presented with valid analysis metadata.

`context_for_task` is a bounded router over indexed evidence. It must not run
full topology, diagnostics execution, broad docs reports, or high-cardinality
cache validation as hidden work. It should return complete-enough markers,
skipped-work metadata, and at most three next actions with a short reason and
expected evidence. Returned actions use normal-client public schemas and omit
server-owned root arguments. The implementation reuses exact caller-requested
symbol nodes, omits graph follow-up for definition-only or unrelated candidates,
and keeps explicit edit/closure validation ahead of the three-action cap.
Callers pass completed action tool/argument pairs in `satisfied_actions` to
omit unchanged guidance without session-global state. This slice does not add a
combined navigation tool.

Validation guidance accepts explicit caller intent and task-owned changed files.
Explicit read-only, review, unknown, conflicting, or negated intent suppresses
prominent validation. Explicit edit/closure intent takes precedence, followed
by task-owned changed files, material provided/callable lifecycle evidence, and
bounded task-text inference.

When a task mentions MCP server work, `context_for_task` should rank
MCP-server entrypoints, tool registries, protocol docs, and transport evidence
above generated or vendor noise. The returned reasons are evidence labels for
where an agent should read next; they are not proof that the server implements a
specific protocol behavior.

When a task is explicitly spec-driven, `context_for_task` may consume
spec-lifecycle-manager companion evidence before broad repo search. Companion
inputs include lifecycle preflight, task detail, validation plan, evidence
quality, task-state audit, and closure-risk summaries when they are supplied by
the caller or proven callable through integration health. Agent Workbench must
label this as lifecycle evidence, join it to repository files and validation
planning where useful, and avoid turning it into task-status updates,
reconciliation, promotion, or closure decisions.

Agent Workbench does not broker spec-lifecycle-manager calls in the MVP surface.
When a prompt mentions a spec path, `Spec NNN`, or `TNNN`, `context_for_task`
may read bounded local spec artifacts as non-authoritative routing evidence and
may include a companion lifecycle next action inside `lifecycle_evidence`.
Top-level executable `next_actions` remain Agent Workbench MCP actions only.
Caller-supplied lifecycle outputs are consumed before broad repository search
and stay labeled as lifecycle evidence.

`verification_plan` plans checks but does not execute them. It must distinguish
planned checks from proven runnable checks and route low-confidence test
discovery to explicit follow-up instead of implying nearest-test proof.

For MCP-server repositories, `verification_plan` may plan configured scripts
such as `mcp:smoke`, `mcp:inspect`, `inspect:mcp`, `mcp:stdio`, and `mcp:http`,
and may add a manual planned smoke review for initialize, tools/list, and a
targeted call-tool check. It must record the transport, entrypoint, and
tool-registry evidence used to form the plan. Host-blocked validation policy
continues to take precedence, returning a blocked state instead of generic host
commands when repository guidance requires containerized validation.

`diagnostics_for_files` runs compact provider-backed diagnostics for explicit
repo-relative files. It is read-only, bounded by file count and provider
budgets, and never executes validation commands. Provider findings are
normalized to relative paths, severity, category, provider ID, capability,
evidence, blocking status, and concise fix hints. Clean results are compact;
unsupported file types report not-applicable or unsupported evidence without
claiming validation completion.

Documentation/config routing and test/validation planning are usage-proven
workflows from the predecessor system and must remain first-class. The MVP
should replicate their useful behavior through this runtime's schemas rather
than duplicating predecessor tool names or backend payloads.

`docs_search` searches documentation through the warm SQLite FTS-backed docs
index populated during repository warm-up. It is one authority-aware ranked
route, not an FTS route followed by an optional fallback. Coordinated indexing
publishes the documentation map's normalized concern labels, explicit intent
terms, and one-to-many owner evidence with the selected graph snapshot. Queries
normalize by Unicode NFKC, lowercase, punctuation/symbol/separator-to-space
conversion, and whitespace collapse. A multi-token term matches only an exact
contiguous normalized phrase; a single-token term matches only an equal query
token. Every remaining normalized query token participates; there is no hidden
stopword list or minimum token length. All matched concerns are retained and
their evidence orders by longest phrase, normalized concern key, and normalized
owner path. The runtime never invents synonyms or broad-reads the map on the
query path.

The application requests two same-snapshot candidate sources: up to 501 ordered
FTS candidates without page offset and up to 501 distinct repository-present,
in-scope owners of the exact matched concerns. It deduplicates the sources by
canonical repo-relative POSIX document ID. Source row 501 or distinct-union row
501 returns `candidate_universe_exceeds_limit`, zero hits, no cursor, and a
callable narrower-scope `docs_search` action. No partial page is emitted from an
incomplete universe.

A complete union of at most 500 documents is ordered by one deterministic
tuple: relevance band, governing-owner tier, authority, currency, optional raw
lexical score, normalized path, then stable document ID. Relevance is
established before ownership or authority, so a governing owner can reorder a
comparably relevant set but an irrelevant canonical document cannot outrank an
exact relevant result solely through authority. Valid and draft mapped owners
receive the valid-owner tier while retaining truthful status; missing,
archived, superseded, and conflicting owners retain bounded governance caveats
and receive no valid-owner promotion. Multiple owners are valid by themselves;
conflict requires a mapped document whose `canonical_owner` names another path.

Before returning page one, the route persists the complete ordered universe and
its count receipt for 15 minutes. The cursor authenticates universe ID, next
position, snapshot, normalized query, optional normalized scope, bound 500,
ranking schema, and ranking-policy version. Continuations slice only that
stored universe: they never re-query FTS, broad-read owners, rerank, restart at
page one, or rebuild missing state. Concatenated pages therefore equal one
sufficiently large page over the same universe without duplicates or omissions.
`include_snippets` is a post-slice projection on both first and continuation
pages and cannot change admission, order, identity, or cursor validity.

Successful results expose ranked hits, matched concern and owner evidence,
ranking reasons/components, named count and filter bases, priority-scan coverage,
optional bounded snippets/headings, an optional cursor, and a direct-read
caveat. Deprecated `score`, `result_count`, `result_count_basis`,
`indexed_docs_count`, and docs-coverage aliases keep their shipped meanings;
agents use response order/final rank components and the canonical count receipt
for new behavior. Search results remain routing evidence only, so agents must
use `docs_read_section` before making precise documentation claims.
Callers may pass `scope_path` to constrain results to one repo-relative
documentation subtree. For spec implementation work, pass the active spec
package path, such as `docs/specs/NNN-short-name`, so `docs_search` only
returns hits from that package when resolving canonical spec evidence.
`docs_scope` can set the same docs `scope_path` as an in-memory default for
the current MCP server session. The default applies to `docs_search`,
`repo:///docs/overview`, and `repo:///docs/map` when a request omits
`scope_path`; an explicit per-call `scope_path` takes precedence, and
`docs_scope` can clear the session default.

If no valid snapshot can be selected for a valid request, `docs_search` returns
the snapshot-less `selected_snapshot_unavailable` blocker and a
`repo:///status` action; it never fabricates snapshot identity. An unavailable
or incompatible concern/ranking index returns `ranking_unavailable` and the
same status route. An expired/missing frozen universe returns
`ranked_universe_expired`; a tampered or identity-mismatched cursor returns
`ranking_cursor_invalid`. Both cursor failures provide a callable cursor-free
`docs_search` restart action rather than rebuilding implicitly. These blocked
variants carry zero hits, explicit trust downgrade, and no success-shaped count
or cursor evidence that the unavailable variant cannot prove.

Cold, stale, invalid, refreshing, incomplete, overflow, cursor, and selection
failures remain structured and visible. The route never falls back to broad
Markdown scanning or presents sparse evidence as absence. Standard trust
metadata keeps ranked routing safe for navigation and next-read selection, not
for precise claims, implementation completion, closure, or safe mutation; a
direct section read and relevant validation remain required.

Each frozen universe is bounded to 500 hits and 15 minutes. The separate EB059
decision owns a repository-wide live-universe population cap, deterministic
capacity eviction, cursor semantics after such eviction, and remaining detailed
freeze/page/eviction metrics; this surface does not hide an arbitrary cap or
implicit eviction policy.

`docs_outline` reads a bounded heading outline for one repo-relative Markdown
document and returns stable heading identifiers. `docs_read_section` reads one
bounded section by repo-relative path and heading identifier. Both tools refuse
workspace escapes and generated/vendor paths through structured blocked
responses rather than best-effort reads.

`repo:///docs/overview`, `repo:///docs/map`, `docs_outline`, and
`docs_read_section` remain direct scanner/read surfaces. The docs overview and
map resources accept the same `scope_path` prefix for bounded documentation
subtree inventories. They are separate from the FTS search hot path because
outline and section reads are precise direct evidence rather than search
ranking evidence. Documentation crosslink graphs, broad docs reports, and
generated architecture answers remain post-MVP.

Spec 034 adds documentation currency routing for active, current, archived,
superseded, closure breadcrumb, removed-spec reference, and unknown states.
`context_for_task`, `docs_search`, `repo:///docs/overview`, and
`repo:///docs/map` expose currency labels and caveats for document routing.
Docs results remain routing evidence with direct-read caveats and must not
invent lifecycle freshness.

The currency model treats frontmatter as input evidence, not as standalone
documentation authority. Useful input fields include `status`, `last_reviewed`,
`canonical_owner`, `superseded_by`, and `authority`, but repository instructions,
documentation-map owners, source contracts, active lifecycle context, and
accepted durable docs remain stronger evidence when they conflict. File
`mtime_ms` may be used as modified-time evidence. Filesystem `ctime` must not
be used as creation-time or documentation-currency evidence. Local Git history
may optionally enrich final doc candidates with first/last touch evidence when
available, but missing Git evidence is non-blocking and must be reported as
missing optional enrichment rather than hidden.

Task-oriented surfaces such as `context_for_task` should expose a small
agent-facing workflow or next action for checking which docs are current for a
particular task. The read-only `docs_current_for_task` tool is that executable
workflow. It accepts a task, optional files, optional `scope_path`, and
`max_docs`, then returns canonical docs, supporting docs, non-authoritative
docs, unknown docs, caveats, and current-source next actions. Lifecycle-specific
rules for active specs, promotion, closure, and stale durable-doc warnings
belong in spec-lifecycle-manager; Agent Workbench consumes those labels as
routing evidence but does not own lifecycle truth.

`check_markdown_document` and `check_markdown_set` are read-only documentation
quality tools. They parse direct Markdown content through the Markdown quality
subsystem, apply catalog and workspace safety policy, return compact findings
with repo-relative paths and bounded evidence, and report skipped or blocked
states for generated, hidden, oversized, missing, or unsafe paths. They do not
format, mutate, generate reports, or replace `docs_read_section` as precise
source evidence.

## Post-MVP Resources And Tools

- `repo:///mcp-surface`
- `repo:///graph/summary`
- `repo:///graph/report`
- `repo:///graph/communities`
- `repo:///validation-surface`
- `repo:///agent-integration-profile`
- `repo:///capability-inventory`
- `repo:///attention/current`
- `repo:///usage/gaps`
- `symbol_context`
- `callers`
- `callees`
- `plan_markdown_format`
- `preview_markdown_format`
- `apply_markdown_format`
- `post_edit_feedback`
- `run_nearest_tests`
- `workflow_friction_report`
- `handoff_packet`

Documentation crosslink graphs, broad docs reports, generated architecture
answers, and `docs_crosslinks` remain post-MVP. Promote them only when dogfood
or usage evidence shows the bounded overview/map/search/outline/read-section
flow is insufficient, and add fixture-backed budget tests proving that the new
surface does not become hidden broad orientation work.

Post-MVP graph exploration tools:

- `graph_query`
- `shortest_path`
- `neighbors`
- `community`
- `god_nodes`
- `surprising_connections`
- `graph_stats`

Post-MVP edit and attention tools:

- `rollback_workspace_edit`
- `attention_current`
- `attention_acknowledge`
- `attention_for_files`

## Tool Capability Classes

Tool capability classes are defined in
[Runtime contracts](../reference/runtime-contracts.md). MVP includes
`read_only`, `planning`, and `workspace_write`. `process_execute` and
`generated_write` are post-MVP unless explicitly approved by the workspace
safety contract.

## Response Metadata

Every result must use the shared response envelope from
[Runtime contracts](../reference/runtime-contracts.md).

## Data And Control Flow

```text
agent request
-> MCP schema validation
-> runtime state and graph freshness check
-> targeted graph/context/validation operation
-> presentation layer metadata and warning/error composition
-> compact response envelope with optional source sections
```

## Tool Budget Rules

- Lightweight tools return locations and metadata by default.
- Source sections appear only when requested or when the context engine ranks
  them as high value.
- Heavy exploration tools have project-size-aware budgets.
- Hot-path tools must use targeted SQLite queries.
- Compact/default tools must not hide broad orientation, full topology,
  diagnostics execution, or high-cardinality cache validation behind small
  payloads.
- Responses that skip expensive evidence must report the skipped work and the
  exact follow-up call that would recover it.
- Broad topology/community reports are explicit orientation calls.
- MVP `verification_plan` does not execute commands by default.
- MVP tools must publish row limits, traversal limits, source-byte caps, and
  timeout behavior through response metadata.
- Docs resources/tools must publish truncation metadata and keep all document
  paths repo-relative. Search snippets and section reads are source-byte
  bounded; exact section claims require `docs_read_section` evidence.
- MVP responses should fail quietly for non-essential backend failures. Only
  task-blocking failures, actionable findings, or required follow-up should be
  promoted to warnings or errors.
- Backend provider names, command names, and raw outputs are debug evidence, not
  MCP response fields, unless the public schema explicitly defines them.

## Tool Naming And Descriptions

Public MCP names must be stable, obvious, and task-oriented. Descriptions should
answer:

- when the agent should call the tool
- what parameters are required or optional
- what the tool will not do
- what shape the agent should expect in the response
- what follow-up actions may be returned

Avoid names inherited from internal backend workers, caches, parsers, or
diagnostic providers. If an internal component is replaced, the public name and
schema should not change unless the agent-facing capability changes.

## Repo-Local Validation Policy

`verification_plan` may read `.agent-workbench/validation-policy.json` as
repo-local validation evidence. The first supported shape is intentionally
small:

```json
{
  "validation": {
    "environment": "docker",
    "host_commands": "blocked",
    "commands": [
      {
        "command": "docker",
        "args": ["compose", "run", "--rm", "app", "pnpm", "test"],
        "reason": "Project validation must run inside the app service container."
      }
    ]
  }
}
```

Supported `environment` values are `host`, `docker`, `devcontainer`, `nix`, and
`bazel`. Supported `host_commands` values are `allowed` and `blocked`.
Configured commands are planned evidence only; the MVP does not execute them.
Unsafe command parts with shell metacharacters are refused by the existing
command-safety policy.

## Cross-Repo Dogfood Follow-Up Status

Early dogfood after Spec 002 left two MCP-resource polish items:

- Done: align `repo:///scope` and `repo:///overview` freshness metadata with
  snapshot-backed `repo:///status` when a fresh graph snapshot exists. Scope and
  overview may still scan for counts and rankings, but their response metadata
  should not report `freshness: unknown` when status proves a fresh completed
  warmup for the same repository.
- Done: improve `repo:///overview` key-file ranking so application
  entrypoints, representative source files, test roots, and package/test
  configuration rank ahead of large groups of workflow/config files such as
  `.github/workflows/*`. The delivery record is
  [Spec closure log](../history/spec-closure-log.md).

Go repository dogfood left broad-scan follow-up items:

- Done: add `.gocache` to the default skipped roots so Go build/test cache files do
  not consume scan budget or crowd out source files.
- Done: ensure `repo:///scope` reports source-language files even when no
  semantic adapter exists yet. A row cap or routing-only adapter must not make a
  Go-heavy repository look like it contains only config, Markdown, JSON, YAML,
  or text.
- Done: remove `prewarm_graph` from
  `next_action` values. Recovery actions must only name public MCP tools that
  are actually available in the Codex integration profile.
- Done: improve `verification_plan` for Go repositories so it detects `go.mod`,
  `Makefile`, Docker test configuration, and repository-specific test
  conventions as planning evidence. When checks cannot be proven runnable, the
  result should return blocked/planned validation evidence rather than zero
  commands with no useful explanation.
- Done: expose Go package, function, type, method, and `main` declarations as
  parser-backed partial-semantic routing symbols with package/import metadata.
- Done: promote Go reference lookup and impact from declaration-only routing to
  parser-backed low-confidence graph evidence. `find_references` can return
  direct references for same-package and explicit import-selector cases, while
  `impact` keeps local or graph-scope caveats instead of claiming whole-program
  Go semantics.

Large C++ repository dogfood left monorepo and Codex-discoverability follow-up
items:

- Done: make `repo:///status` capability and language metadata consistent with
  `repo:///scope` for large mixed-language repositories. Status may stay cheap,
  but it should not report `capability_level: unsupported` and `languages: []`
  when scope has already identified partial/resource-backed coverage.
- Done: improve broad `context_for_task` ranking for implementation tasks by
  down-ranking generated data, third-party vendored docs, installer docs, and
  fixture blobs unless the prompt names those areas. When ranking is driven only
  by path-term matches, include a compact `confidence_reason`.
- Done: when the caller supplies known files, rank same-directory build files,
  adjacent headers/sources, and nearby tests ahead of broad repository matches.
- Done: expose C/C++ classes, functions, methods, includes, Python stubs, and
  CMake target declarations as routing evidence while keeping references and
  impact low confidence until semantic edges exist.
- Done: rank first-party C/C++ source, tests, adjacent headers/sources, and
  local/root `CMakeLists.txt` files ahead of third-party, vendor, generated,
  fixture, and installer noise for broad CMake/C++ implementation prompts.
- Done: emit C/C++ include-stem and same-file local-call routing references
  with heuristic provenance, resource-backed evidence, and low confidence.
  Ambiguous names stay unresolved; resolved edges preserve the adapter-provided
  low-confidence labels rather than becoming compiler-backed semantics.
- Done: plan concrete non-executed CMake validation templates from bounded
  target evidence when host commands are allowed: `cmake -S . -B build`,
  `cmake --build build --target <target>`, and `ctest --test-dir build`.
  Repo-local validation policy and environment guidance still suppress generic
  host CMake commands when they require Docker, devcontainer, Nix, Bazel, or
  another non-host workflow.
- Done: ensure `next_action` values only reference tools visible in the active Codex
  discovery path, or adjust the integration profile/tool metadata so advertised
  tools are discoverable on first use.
- Done: verify the live MCP startup path after reload. The current session
  reports `runtime_state: fresh`, `freshness: fresh`, and
  `warmup_state: complete` for the Agent Workbench checkout.

Future multi-language repository work:

- Add cross-language symbol/reference concepts only after language adapters
  define how symbols, generated bindings, stubs, foreign-function interfaces,
  build targets, and framework routing are integrated. Until then, MCP symbol,
  reference, impact, and validation tools should remain language-aware at the
  repository-shape level but must not claim cross-language semantic proof.

Post-closure dogfood caveats from large mixed-language repositories:

- Done: keep `repo:///status` aligned with `repo:///scope` by summarizing a
  bounded slice of persisted catalog evidence when a snapshot exists. Status
  should remain cheap, but it must not imply `unsupported`/no-language coverage
  when the catalog already proves Go, C/C++, Python, or other first-slice
  evidence.
- Done: validation planning must read bounded repo-local guidance before
  generic language defaults. If guidance requires Docker-based validation or
  forbids host test commands, suppress direct commands such as `go test ./...`
  and return a blocked plan with the governing evidence.
- Done: skip common hidden runtime/test artifact directories such as `.home`,
  `.sandbox`, `.gocache`, hidden `*-tests` folders, build outputs, and generated
  caches before applying row caps.
- Done: apply a centralized hidden-path policy during catalog scans. Hidden
  directories are skipped by default unless allowlisted as repository-shape
  evidence, including `.github/` and `.devcontainer/`; high-signal dotfiles
  such as `.gitignore`, `.dockerignore`, `.editorconfig`, `.env.example`,
  `.env.sample`, `.env.template`, `.prettierrc*`, `.eslintrc*`, `.npmrc`,
  `.nvmrc`, and runtime-version files remain visible. Secret-bearing `.env`
  files and local hidden state remain excluded from catalog evidence.
- Done: parse root `.gitignore` as an additional skip signal for catalog scans,
  including simple glob, anchored, directory-only, and negated patterns. The
  hardcoded generated/vendor/secret policy remains authoritative for safety;
  `.gitignore` augments it rather than replacing it.
- Done: allow explicit requested hidden config files through direct safe stat
  hydration when they are allowlisted, while refusing secret/local hidden paths
  such as `.env`. Verification plans surface refused explicit paths as blocked
  missing evidence instead of silently indexing them.
- Done: skip common language environment and dependency roots, including Python
  tox/nox/venv, Node package/cache stores, JVM/Gradle/Maven caches, Terraform
  caches, Rust-style `target`, vendored dependency roots, and nested git
  checkouts. These should not consume catalog budget or rank as first-party
  implementation evidence.
- Done: prevent graph warmup from reading oversized text/resource files; record
  skipped catalog evidence instead of crashing the snapshot with low-level
  memory errors.
- Done: make file metadata presentation share one capability/language policy
  across scope, context, symbol/search results, preview/apply edit metadata, and
  validation planning.
- Done: surface Docker and `.devcontainer` files as environment evidence in
  overview. Devcontainer presence alone is not treated as Docker-only validation
  proof; explicit repo guidance is still required before suppressing generic
  host commands.
- Done: add a repo-local, read-only sample smoke harness that can run bounded
  status, scope, overview, and optional context checks across explicit sample
  repositories or discovered git repositories under `~/Projects`. Reports are
  written under ignored `.tmp/` paths in this repository; external sample
  repositories must not be modified.
- Done: improve broad task routing for large monorepos by ranking first-party
  implementation roots and exact source/symbol text above third-party, fixture,
  installer, generated, or package-manager noise unless those areas are named.
- Done: improve `repo:///overview` platform scoring so root/local CMake and
  source/test topology outrank incidental `package.json` files in CMake/C++
  repositories.
- Done: parse Docker Compose, Dockerfile stages, and devcontainer
  features/customizations as validation-environment evidence. The planner uses
  this evidence to explain likely container workflows, but still requires repo
  guidance or explicit Agent Workbench config before marking host commands
  unsafe.
- Done: add a first-slice explicit repo-local validation policy/config surface
  at `.agent-workbench/validation-policy.json` for allowed command templates and
  environment requirements across languages. This is the reliable path for
  Docker-only, Nix-only, devcontainer-only, Bazel-only, or other
  project-specific validation rules.
- Done: make first-read resources reliable on large AWS/IaC repositories. If
  `repo:///status`, `repo:///scope`, `repo:///overview`, or
  `integration:///profiles/codex` can time out while direct tools remain fast,
  either fix the resource path budget or adjust the skill first-call guidance
  to use a cheap direct status path.
- Done: fix query-result scope metadata so responses that return Python
  symbols do not report only `json`/`text` languages. Result metadata should
  distinguish repository coverage, queried adapter coverage, and returned
  evidence languages clearly.
- Done: add first-slice .NET generated-output handling so `bin/`, `obj/`,
  `TestResults/`, `.dll`, `.pdb`, `.wasm`, `.nupkg`, and `.snupkg` artifacts
  do not consume catalog/context budgets by default.
- Done: deepen .NET generated-output handling so `TestResults/`, publish
  output, `.dll`, `.pdb`, `.wasm`, `.nupkg`, `.snupkg`, compressed framework
  assets, source maps, and test result files do not dominate context or scope
  budgets unless explicitly requested. Local `packages/` directories are not
  skipped wholesale because many JavaScript/TypeScript monorepos use that name
  for first-party source; generated package files inside them are skipped by
  artifact extension. The delivery record is
  [Spec closure log](../history/spec-closure-log.md).
- Done: promote `.sln`, `.csproj`, `Program.cs`, `appsettings*.json`, Razor
  route pages/components, controllers, EF `DbContext`/migrations, and shared
  model projects as first-class .NET routing and overview anchors.
- Done: add first-slice .NET validation planning evidence for solution,
  project, and test-project files, including non-executed `dotnet build` and
  `dotnet test` candidates.
- Done: extract resource-backed `.sln` and project-file metadata for SDK,
  target frameworks, output type, package references, project references, and
  test-project markers. These nodes use declaration-only provenance and do not
  imply C# or Razor semantic support. The delivery record is
  [Spec closure log](../history/spec-closure-log.md).
- Done: deepen .NET validation planning evidence for solution and project
  files. The planner ranks nearest `dotnet build <project>` before broader
  solution builds, includes relevant test projects when selected-project
  evidence supports them, and blocks generic host `dotnet` commands when
  repo-local policy or guidance requires containerized validation. Commands
  remain planned evidence, not executed proof.
- Done: make scanner-level skipped filesystem paths visible as skipped evidence
  across scope, overview, context, and verification surfaces. Scanner-level
  permission failures do not abort repository orientation when the requested
  task is outside the unreadable path; usable evidence is preserved and skipped
  relative paths are modeled with reasons.
- Done: add a modeled `skipped_paths` section with reasons such as
  `permission_denied`, `generated_or_vendor`, `hidden_path`, `gitignore`,
  `secret`, `nested_git_repository`, `missing`, and `not_directory`. Context
  surfaces summarize skipped-path counts through `skipped_work` to stay compact.
  Future work can add write-path `workspace_escape` and graph warmup
  `file_too_large` evidence where those subsystems own the skip.
- Done: align `integration:///profiles/codex` wording with the distinction
  between configured public MCP bindings and the subset actually discovered by
  a given Codex client session. The profile now warns callers not to treat
  configured bindings as guaranteed client-exposed tools unless the active
  session exposes them.
- Done: calibrate `integration:///profiles/codex` as static integration profile
  configuration evidence rather than live integration health, and keep
  `runtime_availability` unsafe until callers inspect live health or session
  evidence.
- Done: make the Codex plugin install path skill/hook-only for local
  development. Host-level Codex MCP configuration is the single executable
  runtime path; the plugin manifest must not register a copied or cache-relative
  MCP server for Agent Workbench.
- Done: improve docs-heavy repository overview ranking so durable docs and
  canonical skill guidance rank ahead of fixture/example documents in first-read
  key-doc results.
- Done: add documentation/config-only validation hints and plans. Selected
  Markdown files now plan `check_markdown_document`, include-all Markdown
  evidence plans `check_markdown_set`, and non-Markdown config evidence keeps a
  non-executed manual docs/config syntax/readability review hint.
- Done: wrap `verification_plan` provider failures in the standard blocked
  response envelope instead of leaking raw filesystem errors such as `ENOENT`
  to MCP callers.
- Done: add first-slice package-manager-aware validation planning for JavaScript
  and TypeScript monorepos. The planner detects root/package-local
  `package.json` files, lockfile-selected package managers, and selected-file
  package boundaries, then returns package-local scripts before root workspace
  scripts without executing commands.
- Done: deepen package-manager-aware validation planning for JavaScript and
  TypeScript monorepos. The planner detects root/package-local `package.json`,
  lockfiles, workspace config, nearby `tsconfig` files, and common
  client/server/e2e package boundaries before suggesting lint, typecheck, or
  test commands. Commands remain planned evidence until repo guidance proves
  they are safe and runnable.
- Done: add first-slice context ranking explanations for common web
  authentication implementation paths such as controllers, services, routes,
  strategies, UI pages/components, data providers, and e2e setup files.
- Done: improve context ranking explanations by including compact, non-secret
  reasons for high-ranking implementation candidates, especially when routing
  was driven by path terms, package boundaries, workspace config,
  route/controller/service conventions, or lexical snippets rather than
  semantic graph edges.
- Done: promote TypeScript/JavaScript query surfaces to parser-backed
  partial-semantic evidence. `symbol_search`, `find_references`, `impact`, and
  `context_for_task` now consume JS/TS declaration and import/export graph
  evidence through the shared presenters, with low-confidence parser-backed
  caveats instead of resource-backed infrastructure wording.
- Done: avoid redacting ordinary in-repo source snippets such as URL paths,
  route fragments, and API route strings as outside-repo filesystem paths.
  Presentation redaction preserves source text by default, redacts embedded
  absolute host paths, workspace escapes, and secret-like values in source
  sections and snippets, and treats repo-relative paths as path evidence only
  when the field is path-typed. Workspace safety path containment remains the
  authority for reads and writes. The delivery record is
  [Spec closure log](../history/spec-closure-log.md).
- Done: apply one symbol-reference sanitizer to `signature`, `docstring`, and
  `source_section.text` across `symbol_search`, `find_references`, `impact`, and
  `context_for_task`. Presentation never mutates stored graph evidence or typed
  repo-relative path fields.
- Done: distinguish an unknown `impact` start node from a known node with an
  empty traversal. Snapshot/publication failures retain precedence; a missing
  node returns a typed domain failure and routes recovery to `symbol_search`.
- Done: improve exact-first symbol filtering for caller-supplied symbols before
  broad fuzzy fallback. Exact mode now applies language filters before deciding
  whether exact evidence exists and treats SAM logical IDs and Lambda handler
  string suffixes as resource-backed exact routing evidence.
- Done: improve nearest-test ranking for service slices, especially
  infrastructure-plus-handler changes where tests live under service, infra, or
  script-specific test families rather than same-package Python paths.
- Done: add first-slice SAM/CloudFormation resource-backed extraction for
  logical IDs and Lambda handler strings. These appear as routing symbols with
  `resource_backed` capability and `infra_parser` provenance, not as semantic
  reference/impact proof.
- Done: add SAM/CloudFormation fixture-backed resource routing for logical IDs,
  Lambda handler strings, resolved handler files, and unresolved handler-file
  candidates. This is file-level routing evidence with `resource_backed`
  capability and `infra_parser` provenance; full semantic indexing remains
  future work. The delivery record is
  [Spec closure log](../history/spec-closure-log.md).
- Done: add first-slice SAM/Lambda overview and context routing for template
  files, handler source files, and infrastructure tests.
- Done: connect SAM/CloudFormation templates to source handlers, tests, and
  validation evidence. Impact from a Lambda handler binding now exposes
  low-confidence resource-backed template-to-handler-file routing rather than
  isolated zero-edge template evidence.
- Done: add structured SAM/CloudFormation intrinsic, dependency, and event
  source routing. `Ref`, `Fn::GetAtt`, `Fn::Sub`, nested `Fn::Join` references,
  `Fn::ImportValue`, and `DependsOn` produce resource-backed reference evidence
  when structurally supported. Handler grouping includes compact event-source
  summaries, and handler impact reaches event sources and directly referenced
  template resources with low-confidence infrastructure caveats. The delivery
  record is
  [Spec closure log](../history/spec-closure-log.md).
- Done: add Lambda-heavy repository presentation that groups generic
  `handler` results by template path, logical ID, handler binding, and resolved
  handler file while preserving the compact graph contract. Grouping uses
  existing resource-backed metadata and bounded handler-file routing edges; it
  does not infer stack, event-source, dependency, IAM, or deployment semantics.
  The delivery record is
  [Spec closure log](../history/spec-closure-log.md).
- Done: add first-slice AWS validation planning evidence for SAM/CloudFormation
  repositories, including non-executed `cfn-lint`, `sam validate`, and nearby
  infrastructure pytest candidates when template/test evidence exists.
- Done: deepen AWS validation planning evidence for SAM/CloudFormation
  repositories. Repo-approved validation policy commands are planned before
  generic template checks, generic `cfn-lint`/`sam validate` and nearby
  infrastructure pytest candidates remain non-executed planned evidence, and
  host-blocking policy suppresses generic host commands.
- Done: prioritize explicitly selected SAM/CloudFormation templates before
  broader discovered templates when planning generic `cfn-lint` and
  `sam validate` commands. Nearest infrastructure tests remain conservative
  when no explicit template-to-test mapping exists.
- Done: add first-slice resource-backed `.sln`/`.csproj` discovery as project
  graph routing and validation evidence.
- Done: deepen resource-backed `.sln`/`.csproj` extraction for SDK type, target
  frameworks, package references, project references, output type, and likely
  app role before deeper C# semantics. The delivery record is
  [Spec closure log](../history/spec-closure-log.md).
- Future: add C# and Razor fixture-backed partial semantic support for
  controllers, services, Razor/Blazor components, EF contexts, migrations, and
  shared models using one approved implementation path.
- Done: add Go parser-backed symbols, direct references, and conservative
  impact edges with confidence, provenance, and ambiguity caveats. The delivery
  record is
  [Spec closure log](../history/spec-closure-log.md).
- Future: add C/C++ reference/impact edges after the language-adapter contract
  defines confidence, provenance, and integration boundaries. Routing-only hits
  must stay clearly marked until then.
- Done: improve CMake/C++ routing and validation by prioritizing first-party
  source, adding heuristic include/same-file routing edges, and identifying
  likely CMake target command templates without executing commands or guessing
  unsafe build directories. The delivery record is
  [Spec closure log](../history/spec-closure-log.md).
- Done: performed a detailed predecessor `agent-ide` capability analysis,
  mapped which lessons are already implemented, and promoted only
  language-neutral replacement gaps into tool, presenter, provider, roadmap, or
  follow-up spec work. The delivery record is
  [Spec closure log](../history/spec-closure-log.md).
- Spec 010 first-pass recommendation was delivered through Specs 011, 012, and
  013. Do not add `repo_preflight`, broad orientation, runtime-path reports,
  usage resources, semantic refactor tools, or dependency deep dives merely for
  predecessor surface parity. Improve existing resources and workflow tools
  unless a new public tool has cross-language workflow value and fixture-backed
  evidence.
- Done: Spec 011 added a language-neutral diagnostics and quiet post-edit
  feedback workflow using provider contracts and shared presenters rather than
  Python-specific analyzer output.
- Done: Spec 011 exposed `diagnostics_for_files` as the compact public MCP
  diagnostics surface and kept `post_edit_feedback` internal/hook-facing. The
  public repair loop is `diagnostics_for_files` followed by `verification_plan`;
  hooks reuse the quiet feedback presenter and emit only actionable findings.
- Done: Spec 012 added compact documentation overview, map, search, outline,
  and read-section surfaces before considering crosslink graphs or generated
  reports.
- Done: Spec 012 exposed `repo:///docs/overview`, `repo:///docs/map`,
  `docs_search`, `docs_outline`, and `docs_read_section` as bounded public MCP
  documentation surfaces. Search/overview/map remain routing evidence with
  direct-read caveats; precise documentation claims require section evidence
  from `docs_read_section`. Crosslink graphs and generated reports remain
  deferred until usage evidence proves they are needed.
- Done: Spec 013 replaced scanner-backed `docs_search` ranking with a SQLite
  FTS-backed docs index and recorded objective parity evidence for docs-routing
  queries. Remaining broad-query ranking caveats belong to durable docs search
  tuning, not a scanner fallback.
- Done: Spec 034 added document currency labels and caveats to
  `context_for_task`, `docs_search`, `repo:///docs/overview`, and
  `repo:///docs/map`, plus the read-only `docs_current_for_task` verifier
  workflow. Frontmatter and file modified time are input evidence only;
  lifecycle truth remains owned by lifecycle tooling.
- Future: investigate smoke-test feedback where Agent Workbench context worked
  but `verification_plan` timed out and the agent fell back to local
  command-surface inspection. Capture the failing repo shape, host timeout, and
  logs before changing runtime behavior; the target behavior is a bounded
  structured planned, degraded, or blocked response.

## Related Docs

- [System architecture](../architecture/system-architecture.md)
- [Runtime requirements](../requirements/runtime-requirements.md)
- [Runtime contracts](../reference/runtime-contracts.md)
- [Coding agent integration design](coding-agent-integration-design.md)
- [Markdown document quality design](markdown-document-quality-design.md)
- [Workspace safety contract](../reference/workspace-safety-contract.md)
- [Attention layer design](attention-layer-design.md)
- [Edit and validation loop design](edit-and-validation-loop-design.md)
