---
title: MCP surface design
doc_type: design
status: draft
owner: platform
last_reviewed: 2026-06-05
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

Tools, resources, and prompts are declared through registries. A registry
definition owns the input schema, shared argument parser, use-case binding,
presenter binding, budget policy, and capability policy. It also owns the
public name, description, parameter descriptions, and expected return
structure. Names should describe the action in agent terms, not backend
implementation terms.

Shared argument parsers must handle repo paths, file paths, line/column pairs,
booleans, enums, limits, payload modes, and usage context. Invalid input returns
structured contract errors before any use case runs.

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
- shared helpers for metadata labels and compact next-action lists, so trust
  labels are generated in one place and only included when they calibrate agent
  behavior
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

## MVP Resources

- `repo:///overview`
- `repo:///status`
- `repo:///scope`
- `repo:///docs/overview`
- `repo:///docs/map`

These resources must be cheap, bounded, and backed by current snapshot metadata.
They must not trigger broad graph analysis.
`repo:///status` must expose cold, refreshing, fresh, stale, and degraded
warm-up state, including queued work counts and indexing blockers where
available.
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

## MVP Tools

- `context_for_task`
- `symbol_search`
- `find_references`
- `impact` with explicit traversal and result caps
- `diagnostics_for_files`
- `docs_search`
- `docs_outline`
- `docs_read_section`
- `verification_plan`
- `preview_workspace_edit`
- `apply_workspace_edit`

Drift checking is part of `apply_workspace_edit`; it is not a separate MVP
tool.

`context_for_task` is a bounded router over indexed evidence. It must not run
full topology, diagnostics execution, broad docs reports, or high-cardinality
cache validation as hidden work. It should return complete-enough markers,
skipped-work metadata, and exact next actions.

`verification_plan` plans checks but does not execute them. It must distinguish
planned checks from proven runnable checks and route low-confidence test
discovery to explicit follow-up instead of implying nearest-test proof.

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
index populated during repository warm-up. It searches repo-relative path,
title, headings, and bounded selected body text, then applies deterministic
phrase, title, path, heading, body, and generic path/category scoring. It
returns ranked hits with `docs` and `fts` evidence labels, scores, optional
bounded snippets, optional heading evidence, `result_count`, truncation
metadata, an opaque continuation cursor when more results exist, and a
direct-read caveat. Search results are routing evidence only; agents must use
`docs_read_section` before making precise documentation claims.

If the docs FTS index is cold, stale, invalid, or unavailable, `docs_search`
returns a compact structured blocked response naming the missing evidence. It
must not silently fall back to broad Markdown scanning. This visible failure is
intentional so warm-up, schema, or storage issues are fixed rather than hidden.

`docs_outline` reads a bounded heading outline for one repo-relative Markdown
document and returns stable heading identifiers. `docs_read_section` reads one
bounded section by repo-relative path and heading identifier. Both tools refuse
workspace escapes and generated/vendor paths through structured blocked
responses rather than best-effort reads.

`repo:///docs/overview`, `repo:///docs/map`, `docs_outline`, and
`docs_read_section` remain direct scanner/read surfaces. They are separate from
the FTS search hot path because outline and section reads are precise direct
evidence rather than search ranking evidence. Documentation crosslink graphs,
broad docs reports, and generated architecture answers remain post-MVP.

## Post-MVP Resources And Tools

- `repo:///mcp-surface`
- `repo:///graph/summary`
- `repo:///graph/report`
- `repo:///graph/communities`
- `repo:///validation-surface`
- `repo:///agent-integration-profile`
- `repo:///attention/current`
- `repo:///usage/gaps`
- `symbol_context`
- `callers`
- `callees`
- `check_markdown_document`
- `check_markdown_set`
- `plan_markdown_format`
- `preview_markdown_format`
- `apply_markdown_format`
- `post_edit_feedback`
- `run_nearest_tests`

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

TimeLocker dogfood after Spec 002 left two MCP-resource polish items:

- Done: align `repo:///scope` and `repo:///overview` freshness metadata with
  snapshot-backed `repo:///status` when a fresh graph snapshot exists. Scope and
  overview may still scan for counts and rankings, but their response metadata
  should not report `freshness: unknown` when status proves a fresh completed
  warmup for the same repository.
- Done: improve `repo:///overview` key-file ranking so application
  entrypoints, representative source files, test roots, and package/test
  configuration rank ahead of large groups of workflow/config files such as
  `.github/workflows/*`. The delivery record is
  [Spec 004](../specs/004-overview-ranking-polish/requirements.md).

OneMount dogfood left Go and broad-scan follow-up items:

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
  `resource_backed` routing symbols while keeping references and impact low
  confidence until semantic edges exist.

FreeCAD dogfood left C++ monorepo and Codex-discoverability follow-up items:

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
  [Spec 005](../specs/005-dotnet-repository-shape-hardening/requirements.md).
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
  [Spec 005](../specs/005-dotnet-repository-shape-hardening/requirements.md).
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
- Done: make the Codex plugin install path skill/hook-only for local
  development. Host-level Codex MCP configuration is the single executable
  runtime path; the plugin manifest must not register a copied or cache-relative
  MCP server for Agent Workbench.
- Done: improve docs-heavy repository overview ranking so durable docs and
  canonical skill guidance rank ahead of fixture/example documents in first-read
  key-doc results.
- Done: add documentation/config-only validation hints and plans. Repositories
  with Markdown/config evidence but no stronger code project shape now get a
  non-executed docs/config syntax/readability review hint; `verification_plan`
  also plans the docs/config review when no explicit files are selected.
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
  [Spec 007](../specs/007-redaction-boundary-polish/requirements.md).
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
  [Spec 006](../specs/006-infra-template-routing/requirements.md).
- Done: add first-slice SAM/Lambda overview and context routing for template
  files, handler source files, and infrastructure tests.
- Done: connect SAM/CloudFormation templates to source handlers, tests, and
  validation evidence. Impact from a Lambda handler binding now exposes
  low-confidence resource-backed template-to-handler-file routing rather than
  isolated zero-edge template evidence. Event-source, intrinsic-function, and
  dependency semantics remain future work.
- Done: add Lambda-heavy repository presentation that groups generic
  `handler` results by template path, logical ID, handler binding, and resolved
  handler file while preserving the compact graph contract. Grouping uses
  existing resource-backed metadata and bounded handler-file routing edges; it
  does not infer stack, event-source, dependency, IAM, or deployment semantics.
  The delivery record is
  [Spec 008](../specs/008-lambda-result-presentation/requirements.md).
- Done: add first-slice AWS validation planning evidence for SAM/CloudFormation
  repositories, including non-executed `cfn-lint`, `sam validate`, and nearby
  infrastructure pytest candidates when template/test evidence exists.
- Done: deepen AWS validation planning evidence for SAM/CloudFormation
  repositories. Repo-approved validation policy commands are planned before
  generic template checks, generic `cfn-lint`/`sam validate` and nearby
  infrastructure pytest candidates remain non-executed planned evidence, and
  host-blocking policy suppresses generic host commands.
- Done: add first-slice resource-backed `.sln`/`.csproj` discovery as project
  graph routing and validation evidence.
- Done: deepen resource-backed `.sln`/`.csproj` extraction for SDK type, target
  frameworks, package references, project references, output type, and likely
  app role before deeper C# semantics. The delivery record is
  [Spec 005](../specs/005-dotnet-repository-shape-hardening/requirements.md).
- Future: add C# and Razor fixture-backed partial semantic support for
  controllers, services, Razor/Blazor components, EF contexts, migrations, and
  shared models using one approved implementation path.
- Future: add Go parser-backed symbols and C/C++ reference/impact edges after
  the language-adapter contract defines confidence, provenance, and integration
  boundaries. Routing-only hits must stay clearly marked until then.
- Done: improve CMake/C++ routing and validation by prioritizing first-party
  source, adding heuristic include/same-file routing edges, and identifying
  likely CMake target command templates without executing commands or guessing
  unsafe build directories. The delivery record is
  [Spec 009](../specs/009-cmake-cpp-routing-validation/requirements.md).
- Done: performed a detailed predecessor `agent-ide` capability analysis,
  mapped which lessons are already implemented, and promoted only
  language-neutral replacement gaps into tool, presenter, provider, roadmap, or
  follow-up spec work. The delivery record is
  [Spec 010](../specs/010-agent-ide-capability-analysis/requirements.md).
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
  FTS-backed docs index and recorded objective Python Agent IDE parity evidence
  for docs-routing queries. Remaining broad-query ranking caveats belong to
  durable docs search tuning, not a scanner fallback.
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
