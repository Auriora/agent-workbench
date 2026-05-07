---
title: Language adapter design
doc_type: design
status: draft
owner: platform
last_reviewed: 2026-05-07
---

# Language Adapter Design

## Purpose

Define how language, config, and infrastructure adapters provide deterministic
evidence to the Agent IDE runtime.

## Scope

This design covers adapter capability levels, extraction output, promotion
gates, implementation order, and post-MVP infrastructure support.

## Design Summary

Adapters convert workspace files and tool output into graph nodes, edges,
unresolved references, diagnostics hints, test hints, and capability metadata.
The runtime must distinguish semantic evidence from routing evidence so agents
do not mistake useful context for proof.

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
| Markdown/config | `resource_backed` | deterministic parsers, path/link extraction, project config discovery |
| Python | `partial_semantic`, then `semantic` | Python AST or tree-sitter, Pyright/LSP, Ruff, pytest |
| TypeScript/JavaScript | `partial_semantic`, then `semantic` | tree-sitter plus TypeScript compiler API or `tsserver`, `package.json`, `tsconfig` |
| C# | `partial_semantic`, then `semantic` | Roslyn or C# LSP, `.sln`/`.csproj`, NuGet and test project discovery |
| CloudFormation/SAM | `resource_backed`, then `partial_semantic` | YAML/JSON parser plus intrinsic resolver and source handler linking |
| Go | `partial_semantic`, then `semantic` | Go parser, `gopls`, `go list`, `go test` |
| C/C++ | `resource_backed`, then `partial_semantic` | tree-sitter, clangd/libclang when `compile_commands.json` exists |
| Rust | `partial_semantic`, then `semantic` | tree-sitter or Rust parser, Cargo metadata, `rust-analyzer`, `cargo test` |
| SQL | `resource_backed`, then `partial_semantic` | dialect-aware parser, migration-tool integration, schema/table/column references |
| Bash/Shell | `partial_semantic` | shell parser, ShellCheck, sourced-file and command/function references |
| Terraform/HCL | `partial_semantic` | HCL parser, provider/module/resource/variable/output graph |
| Docker/Compose | `resource_backed` | Dockerfile and Compose parsers, service/env/port/volume graph |
| CI YAML | `resource_backed` | GitHub Actions and workflow parsers, jobs, steps, validation commands |
| Kubernetes/Helm | `resource_backed`, then `partial_semantic` | Kubernetes YAML and Helm chart parsing, resource/service/config relationships |
| Vue/Svelte | `partial_semantic`, then `semantic` | framework language services, SFC parsing, route/component/template links |
| PowerShell | `partial_semantic` | PowerShell parser, script/function/module references |
| Ruby/PHP | `resource_backed`, then `partial_semantic` | parser/LSP where project demand exists |
| Swift/Kotlin/Dart | `resource_backed`, then `partial_semantic` | mobile/client parser or LSP adapters when relevant repos appear |
| Java | `resource_backed`, then `partial_semantic` | Maven/Gradle and Java LSP support, deferred until last |

## Implementation Sequence

The MVP slice must exercise the full runtime path for Markdown/config plus one
partial-semantic language path. TypeScript/JavaScript should be the next
language once the first path proves the contracts. C# and CloudFormation/SAM are
post-MVP unless reduced to resource-backed discovery fixtures.

```text
scan files
-> detect language or infra type
-> extract nodes, edges, and unresolved references
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
5. C# project/symbol discovery
6. Go, C/C++, Rust, then the extended backlog

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

## Promotion Gates

- exact-symbol correctness
- duplicate-name ambiguity behavior
- reference and impact correctness
- diagnostics and nearest-test routing
- cache freshness after add, modify, delete, rename, and config changes
- cold/warm latency on representative repositories
- degraded behavior when parser/LSP/tooling is missing or slow

## Semantic Promotion Fixture Requirements

An adapter can move to `semantic` only when representative fixtures cover:

- duplicate names and qualified lookup
- imports, aliases, and re-exports
- generated/vendor boundaries
- dynamic or unresolved references
- stale index behavior
- config changes that alter resolution
- missing parser, LSP, compiler, or test tooling
- parser/LSP timeout or crash
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
