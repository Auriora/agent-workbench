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
gates, implementation order, and CloudFormation/SAM support.

## Design Summary

Adapters convert workspace files and tool output into graph nodes, edges,
unresolved references, diagnostics hints, test hints, and capability metadata.
The runtime must distinguish semantic evidence from routing evidence so agents
do not mistake useful context for proof.

## Capability Levels

- `semantic`: symbols, references, diagnostics, test routing, freshness, and
  fallback behavior are backed by parser/LSP/tool evidence.
- `partial_semantic`: conservative declarations or config extraction exist, but
  references or flow claims need direct verification.
- `resource_backed`: files and project signals are available for routing only.
- `unsupported`: files may exist, but no meaningful adapter is configured.

Do not mark a language `semantic` because a parser can extract declarations.
Semantic support requires trustworthy references, impact, diagnostics/test
routing, freshness behavior, and degraded-mode reporting.

## Initial Capability Targets

| Area | Initial level | Backend direction |
| --- | --- | --- |
| Markdown/config | `resource_backed` / `routing_evidence` | deterministic parsers, path/link extraction, project config discovery |
| Python | `semantic` | Python AST or tree-sitter, Pyright/LSP, Ruff, pytest |
| TypeScript/JavaScript | `semantic` | tree-sitter plus TypeScript compiler API or `tsserver`, `package.json`, `tsconfig` |
| C# | `partial_semantic`, then `semantic` | Roslyn or C# LSP, `.sln`/`.csproj`, NuGet and test project discovery |
| CloudFormation/SAM | `infra_semantic` with caveats | YAML/JSON parser plus intrinsic resolver and source handler linking |
| Go | `partial_semantic`, then `semantic` | Go parser, `gopls`, `go list`, `go test` |
| C/C++ | `resource_backed`, then `partial_semantic` | tree-sitter, clangd/libclang when `compile_commands.json` exists |
| Rust | `partial_semantic`, then `semantic` | tree-sitter or Rust parser, Cargo metadata, `rust-analyzer`, `cargo test` |
| SQL | `resource_backed`, then `partial_semantic` | dialect-aware parser, migration-tool integration, schema/table/column references |
| Bash/Shell | `partial_semantic` | shell parser, ShellCheck, sourced-file and command/function references |
| Terraform/HCL | `partial_semantic` | HCL parser, provider/module/resource/variable/output graph |
| Docker/Compose | `resource_backed` / `routing_evidence` | Dockerfile and Compose parsers, service/env/port/volume graph |
| CI YAML | `resource_backed` / `routing_evidence` | GitHub Actions and workflow parsers, jobs, steps, validation commands |
| Kubernetes/Helm | `resource_backed`, then `partial_semantic` | Kubernetes YAML and Helm chart parsing, resource/service/config relationships |
| Vue/Svelte | `partial_semantic`, then `semantic` | framework language services, SFC parsing, route/component/template links |
| PowerShell | `partial_semantic` | PowerShell parser, script/function/module references |
| Ruby/PHP | `resource_backed`, then `partial_semantic` | parser/LSP where project demand exists |
| Swift/Kotlin/Dart | `resource_backed`, then `partial_semantic` | mobile/client parser or LSP adapters when relevant repos appear |
| Java | `resource_backed`, then `partial_semantic` | Maven/Gradle and Java LSP support, deferred until last |

## Implementation Sequence

The first slice must exercise the full runtime path for Markdown/config,
Python, TypeScript/JavaScript, a thin C# project/symbol slice, and a
CloudFormation/SAM resource slice.

```text
scan files
-> detect language or infra type
-> extract nodes, edges, and unresolved references
-> store graph/index rows
-> resolve references
-> query symbols/resources/usages/callers/callees
-> build task context
-> emit attention items
-> plan or run diagnostics/tests
-> expose through MCP
```

After the slice works, deepen support in this order: Python,
TypeScript/JavaScript, CloudFormation/SAM, C#, Go, C/C++, Rust, then the
extended backlog.

## CloudFormation And SAM Adapter

CloudFormation and SAM are infra adapters, not generic YAML. They should add
graph evidence that connects infrastructure resources to source code, tests,
configuration, and security posture.

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

## Related Docs

- [System architecture](../architecture/system-architecture.md)
- [Runtime requirements](../requirements/runtime-requirements.md)
- [ADR-0004](../adr/0004-semantic-evidence-gates.md)
- [Language capability matrix](../reference/language-capability-matrix.md)
