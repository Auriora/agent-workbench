---
title: Language adapter design
doc_type: design
status: draft
owner: platform
last_reviewed: 2026-06-06
---

# Language Adapter Design

## Purpose

Define how language, config, and infrastructure adapters provide deterministic
evidence to the Agent IDE runtime.

## Scope

This design covers adapter capability levels, extraction output, promotion
gates, implementation order, and post-MVP infrastructure support.

## Design Summary

Adapters convert workspace files and optional tool output into graph nodes,
edges, unresolved references, diagnostics hints, test hints, and capability
metadata. The runtime must distinguish semantic evidence from routing evidence so
agents do not mistake useful context for proof.

This is a core restart difference from `agent-ide`: the runtime must support
multiple coding languages, frameworks, project systems, test runners, CI,
containers, infrastructure platforms, and documentation surfaces through common
adapter contracts. Python is the first fixture-backed adapter, not a privileged
runtime model.

The `tree-sitter` parse pipeline is the canonical extraction path for all
supported code languages. Native AST and LSP outputs are optional enrichers only:
they can add metadata and confidence context, but must not replace parser
output for symbol or reference extraction.

Adapters are infrastructure providers behind extraction ports. A syntax
extractor parses files and emits an `ExtractionBatch` containing declarations,
outlines, imports, unresolved references, diagnostics hints, test hints,
provenance, confidence, and capability metadata. It must not resolve cross-file
references, write graph rows, construct MCP responses, or decide attention
items.

Optional enrichers emit enrichment records against existing extracted entities.
They do not become alternate primary parsers.

Shared graph rows, context packets, validation plans, edit contracts, and MCP
responses must not gain language-specific fields. Language-specific details
belong in adapter-domain metadata with explicit provenance and capability.

## Capability Levels

Capability levels are defined canonically in
[Runtime contracts](../reference/runtime-contracts.md). This design applies
those levels to adapters.

Do not mark a language `semantic` because a parser can extract declarations.
Semantic support requires trustworthy references, impact, diagnostics/test
routing, freshness behavior, and degraded-mode reporting.

## Initial Capability Targets

| Area | Initial level | Backend direction |
| --- | --- | --- |
| Markdown/config | `resource_backed` | deterministic parsers, path/link extraction, project config discovery, documentation-quality structure checks |
| Python | `partial_semantic`, then `semantic` | `tree-sitter` (mandatory), optional Python AST enrichment, Pyright/LSP, Ruff, pytest |
| TypeScript/JavaScript | `partial_semantic`, then `semantic` | `tree-sitter` (mandatory), optional TypeScript compiler API or `tsserver`, `package.json`, `tsconfig` |
| C#/.NET | `resource_backed`, then `partial_semantic`, then `semantic` | `.sln`/`.csproj`/`.fsproj`/`.vbproj` project metadata, NuGet and test project discovery, generated-output policy, then `tree-sitter` and optional C# LSP |
| CloudFormation/SAM | `resource_backed`, then `partial_semantic` | YAML/JSON parser plus intrinsic resolver and source handler linking |
| Go | `partial_semantic`, then `semantic` | `tree-sitter-go` declarations/references, `go.mod`/Makefile/CI/Docker validation evidence, optional `gopls`, `go list`, `go test` enrichers only after promotion fixtures |
| C/C++ | `resource_backed`, then `partial_semantic` | `tree-sitter` (mandatory), clangd/libclang when `compile_commands.json` exists |
| Rust | `partial_semantic`, then `semantic` | `tree-sitter` (mandatory), optional Rust parser/enrichment, Cargo metadata, `rust-analyzer`, `cargo test` |
| SQL | `resource_backed`, then `partial_semantic` | dialect-aware parser, migration-tool integration, schema/table/column references |
| Bash/Shell | `partial_semantic` | shell parser, ShellCheck, sourced-file and command/function references |
| Terraform/HCL | `partial_semantic` | HCL parser, provider/module/resource/variable/output graph |
| Docker/Compose | `resource_backed` | Dockerfile and Compose parsers, service/env/port/volume graph |
| CI YAML | `resource_backed` | GitHub Actions and workflow parsers, jobs, steps, validation commands |
| Kubernetes/Helm | `resource_backed`, then `partial_semantic` | Kubernetes YAML and Helm chart parsing, resource/service/config relationships |
| Vue/Svelte | `partial_semantic`, then `semantic` | framework language services, SFC parsing, route/component/template links |
| PowerShell | `partial_semantic` | PowerShell parser, script/function/module references |
| Ruby/PHP | `resource_backed`, then `partial_semantic` | `tree-sitter` parser, optional LSP where project demand exists |
| Swift/Kotlin/Dart | `resource_backed`, then `partial_semantic` | `tree-sitter` parser, optional LSP adapters when relevant repos appear |
| Java | `resource_backed`, then `partial_semantic` | `tree-sitter` parser plus Maven/Gradle, optional Java LSP support, deferred until last |

## Implementation Sequence

The MVP slice must exercise the full runtime path for Markdown/config plus one
partial-semantic language path. TypeScript/JavaScript should be the next
language once the first path proves the contracts. C# and CloudFormation/SAM are
post-MVP unless reduced to resource-backed discovery fixtures.

```text
scan files
-> detect language or infra type
-> extract nodes, edges, and unresolved references
-> normalize extraction result
-> store graph/index rows
-> resolve references
-> query symbols/resources/references
-> build task context
-> emit blocker or warning metadata
-> plan diagnostics/tests
-> expose through MCP
```

After the MVP slice works, deepen support in this order:

1. first language path to `semantic` only after promotion fixtures pass
2. TypeScript/JavaScript to `partial_semantic`
3. TypeScript/JavaScript to `semantic` after promotion fixtures pass
4. CloudFormation/SAM resource-backed discovery
5. C#/.NET project discovery
6. Go, C/C++, Rust, then the extended backlog

JavaScript/TypeScript dogfood against a large web monorepo confirmed that the
first useful slice should start with repository-shape and package-boundary
evidence before deep semantic navigation. A JS/TS-heavy repository must not be
classified as Python-primary because of incidental utility scripts. The first
slice should identify package/workspace roots, root and package-local scripts,
client/server/e2e boundaries, `tsconfig` files, route/controller/service
conventions, React page/component areas, and nearby tests. Symbol, export,
import, and route-level navigation should be promoted only after fixture-backed
adapter tests prove the extracted evidence and confidence labels.

The delivered TypeScript/JavaScript partial-semantic slice uses
`tree-sitter-javascript` for JS/JSX and `tree-sitter-typescript` for TS/TSX.
It classifies `.js`, `.jsx`, `.mjs`, `.cjs`, `.ts`, `.tsx`, `.mts`, and `.cts`
files as parser-backed `partial_semantic` evidence, extracts module, function,
class, method, constant, and type declarations, and records import/export
references with parser provenance, confidence, and module-specifier metadata.
Relative import references are resolved by the shared graph resolver when the
target name is unique; ambiguous or unresolved imports remain explicit
unresolved references. Query and context surfaces use the common graph path for
`symbol_search`, `find_references`, `impact`, and `context_for_task`, including
low-confidence parser-backed impact caveats when an edge is useful but not
semantic proof. Package-manager validation planning uses package-local
`package.json`, lockfile, workspace, and `tsconfig` evidence, and repo-local
validation policy or blocked host-command evidence takes precedence over
generic package-manager commands. Compiler APIs, `tsserver`, bundler execution,
framework-specific route/component hierarchy edges, and cross-language JS/TS
symbols remain deferred until separate fixture-backed promotion gates exist.

OneMount dogfood confirmed the first Go slice should start before deep
reference/impact work with file identity, project discovery, and basic routing
symbols. A Go-heavy repository must surface `.go` files in scope, recognize
`go.mod` and test/build configuration, and expose package-level declarations
such as functions, types, methods, and `main` as routing evidence.

The delivered Go promotion slice uses `tree-sitter-go` for parser-backed
`partial_semantic` extraction. It records package names, imports, functions,
types, methods with receiver metadata, selector references, and identifier
references with parser provenance. The shared resolver may resolve same-package
references and explicit import-selector references when first-party indexed
files make the candidate unambiguous. Receiver-style method references and
other parser-only edges remain low confidence, and unresolved ambiguity stays
explicit rather than being promoted to whole-program Go semantics.

Go query surfaces now consume the common graph path for `symbol_search`,
`find_references`, `impact`, and `context_for_task`. `find_references` can
return direct parser-backed Go references for package symbols. `impact`
traverses those edges conservatively and labels low-confidence local or graph
scope caveats. Build tags, generated symbols, type-inferred method calls, and
compiler-backed package loading remain deferred until a separate promotion gate
introduces optional `gopls`, `go list`, or compiler evidence.

Go validation planning reads repo-local guidance and validation policy before
generic language defaults. It prefers non-executed commands from GitHub Actions
run steps, Makefile evidence, or explicit validation policy before suggesting
generic host `go test ./...`. If repo guidance requires Docker, devcontainer,
Nix, Bazel, or another constrained environment and no approved replacement
command is available, the plan blocks generic host commands and reports the
governing evidence. Docker Compose and devcontainer files are environment
evidence, not proof that host commands are forbidden by themselves.

The Modena AEC .NET dogfood comparison in
[`docs/reference/dotnet/modena-aec-dotnet-evaluation-2026-06-05.md`](../reference/dotnet/modena-aec-dotnet-evaluation-2026-06-05.md)
is the current concrete reference for the C#/.NET slice. It shows that the
first useful .NET step is likely resource-backed project graph extraction:
solution/project files, target frameworks, SDK type, package/project
references, app roles, generated-output policy, and validation planning. C# and
Razor symbol/reference semantics should follow only with fixture-backed design.
The delivered resource-backed slice classifies `.sln`, `.csproj`, `.fsproj`,
`.vbproj`, C#, and Razor files as routing evidence, skips common .NET
build/test/publish outputs, promotes solution/project/app/controller/Razor/EF
anchors in overview and context, and extracts declaration-only project metadata
from solution and project files. Project metadata includes SDK, target
frameworks, output type, package references, project references, and test-project
markers when cheaply parseable. Validation planning returns non-executed
`dotnet build`/`dotnet test` candidates from nearest project, solution, relevant
test-project, and repo-local policy evidence. C# and Razor symbol/reference
semantics remain deferred until fixture-backed parser design promotes them.

FreeCAD dogfood confirmed the first C/C++ slice should start with reliable file
identity and project-shape evidence before broad blast-radius claims. Common
C/C++ extensions such as `.c`, `.cc`, `.cpp`, `.cxx`, `.h`, `.hh`, `.hpp`, and
`.hxx` must classify as C/C++ instead of `text`; Python stub files such as
`.pyi` must classify with Python-like routing evidence. The initial C/C++ graph
should extract classes, functions, methods, includes, and CMake target
membership before reference and impact results are promoted beyond low
confidence.

The delivered CMake/C++ slice remains `resource_backed`. Broad
`context_for_task` ranking prefers first-party C/C++ source roots, tests,
adjacent headers/sources, and local/root `CMakeLists.txt` files ahead of
third-party, vendor, generated, fixture, and installer noise unless the task
names those areas. C/C++ extractor output includes declaration-only classes,
functions, methods, includes, and routing-only unresolved references for include
stems and same-file local call names. Resolved edges from those references keep
their adapter-provided heuristic provenance, low confidence, and
resource-backed metadata. Ambiguous include or call names remain unresolved
with ambiguity metadata instead of being promoted to semantic evidence.

CMake target evidence is parsed from catalog-visible `CMakeLists.txt` files and
records target kind, name, and listed source files. Validation planning may use
that evidence to produce non-executed host command templates such as
`cmake -S . -B build`, `cmake --build build --target <target>`, and
`ctest --test-dir build` when repo-local policy allows host commands. Repo-local
validation policy, Docker/devcontainer/Nix/Bazel guidance, or explicit blocked
host-command evidence takes precedence over generic CMake templates.

Cross-language symbols are deferred. Mixed-language repositories should expose
per-language routing evidence and project-shape validation now, but references
across Python stubs, generated bindings, C/C++ extension modules, Go services,
TypeScript clients, infrastructure handlers, or other language boundaries must
not be promoted until adapter integration contracts define provenance,
identity, confidence, and fixture-backed promotion gates for those edges.

## Adapter Roles

- `SyntaxExtractor`: mandatory `tree-sitter` parser path for supported code
  languages.
- `ProjectModelProvider`: optional project/config model for imports, packages,
  modules, or framework routing.
- `SemanticEnricher`: optional AST/LSP/compiler/tool evidence attached to
  existing extraction results.
- `ImportPlanner`: post-MVP language-specific import maintenance planning.
- `ValidationProvider`: discovers diagnostics, formatters, linters, and tests
  for validation planning.

Reference resolution remains outside these roles so every language feeds a
common resolver and confidence policy.

## Markdown Document Quality

Markdown/config extraction and Markdown document quality are related but
separate capabilities. Extraction emits routing evidence such as headings,
links, document outlines, and config references. Document quality checks inspect
the Markdown structure for authoring problems such as inconsistent numbering,
skipped heading levels, broken links, frontmatter violations, and tables that
are unreadable in plain text.

The Markdown quality subsystem is defined in
[Markdown document quality design](markdown-document-quality-design.md). It may
reuse extracted outlines and links, but it must have its own parser-aware ports
for structure checks, compliance policy, link resolution, and formatting
planning. It must not be implemented as regex-only extraction or hidden inside
the generic Markdown/config adapter.

## CloudFormation And SAM Adapter

CloudFormation and SAM are infra adapters, not generic YAML. They should add
graph evidence that connects infrastructure resources to source code, tests,
configuration, and security posture.

This support is post-MVP unless scoped to resource-backed discovery fixtures.
Adapters may store environment variable names and IAM shape, but must not store
secret-like values.

Recommended nodes:

- `stack`
- `template`
- `resource`
- `lambda_function`
- `api_route`
- `event_source`
- `iam_policy`
- `env_var`
- `output`
- `parameter`
- `condition`
- `handler_symbol`

Recommended edges:

- `defines`
- `references`
- `depends_on`
- `invokes`
- `routes_to`
- `uses_env`
- `grants_permission`
- `exports`
- `imports_value`
- `handler_resolves_to`

The adapter should understand common intrinsic functions and SAM conventions:
`Ref`, `Fn::GetAtt`, `Fn::Sub`, `Fn::Join`, `Fn::ImportValue`, `DependsOn`,
Lambda events, API routes, environment variables, policies, outputs, and
handler strings.

The AWS datalake dogfood comparison in
[`docs/reference/aws-iac/aws-datalake-agent-workbench-evaluation-2026-06-05.md`](../reference/aws-iac/aws-datalake-agent-workbench-evaluation-2026-06-05.md)
is the current concrete reference for this adapter's missing behavior: SAM
logical ID lookup, template-to-handler edges, Lambda handler grouping,
template-aware impact, and AWS validation planning.

The delivered SAM/CloudFormation slice is resource-backed. It emits routing
nodes for template logical IDs, Lambda handler strings, and resolved
handler-file anchors; records unresolved handler-file candidates when the file
cannot be found; promotes SAM templates, handler files, and infrastructure tests
in overview/context; and plans non-executed repo-approved commands,
`cfn-lint`, `sam validate`, and nearby infrastructure pytest commands. Handler
routing edges are low-confidence file-level evidence. The adapter does not yet
resolve intrinsic functions, event-source dependencies, or template-to-source
handler symbols as semantic graph relationships.

Lambda-heavy result presentation groups generic handler queries using existing
resource-backed metadata. `symbol_search` and `context_for_task` order handler
binding and handler-file anchor results by template path, logical ID, and
handler file, and annotate signatures with compact routing context such as the
logical ID, template path, and resolved handler file. This grouping uses
existing graph nodes and bounded outgoing handler-file edges only; it does not
add stack, event-source, IAM, dependency, or deployment semantics.

## Promotion Gates

- exact-symbol correctness
- duplicate-name ambiguity behavior
- reference and impact correctness
- diagnostics and nearest-test routing
- cache freshness after add, modify, delete, rename, and config changes
- cold/warm latency on representative repositories
- degraded behavior when the primary parser or optional enrichers/tooling are
  missing or slow

## Semantic Promotion Fixture Requirements

An adapter can move to `semantic` only when representative fixtures cover:

- duplicate names and qualified lookup
- imports, aliases, and re-exports
- generated/vendor boundaries
- dynamic or unresolved references
- stale index behavior
- config changes that alter resolution
- missing parser, enrichers, compiler, or test tooling
- tree-sitter parser timeout or parser/enricher timeout or crash
- validation planning and blocked validation states

Mutating semantic refactors require operation-level gates in addition to adapter
capability. A `semantic` adapter does not automatically permit rename, change
signature, safe delete, or import mutation.

## Related Docs

- [System architecture](../architecture/system-architecture.md)
- [Runtime requirements](../requirements/runtime-requirements.md)
- [ADR-0004](../adr/0004-semantic-evidence-gates.md)
- [Language capability matrix](../reference/language-capability-matrix.md)
- [Runtime contracts](../reference/runtime-contracts.md)
- [MVP proof matrix](../reference/mvp-proof-matrix.md)
- [Markdown document quality design](markdown-document-quality-design.md)
