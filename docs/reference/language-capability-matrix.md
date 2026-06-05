---
title: Language capability matrix
doc_type: reference
status: draft
owner: platform
last_reviewed: 2026-06-05
---

# Language Capability Matrix

## Purpose

Provide the priority order and target capability level for language, config,
and infrastructure support.

## Source Of Truth

This matrix is the source of truth for language priority order. Capability
level definitions are owned by [Runtime contracts](runtime-contracts.md), and
promotion gates are owned by [Language adapter design](../design/language-adapter-design.md).

## Assumptions

- Capability levels describe evidence quality exposed to agents, not parser
  existence alone.
- `tree-sitter` is the canonical extraction path for supported code languages.
  AST, LSP, and ecosystem tools are optional enrichers unless a later design
  explicitly changes this policy.
- Initial support should prove language-neutral runtime contracts before
  deepening every adapter.
- Python is the first partial-semantic path for comparison with the predecessor
  PoC, not a runtime-core assumption.
- Mixed-language repositories should expose unsupported and resource-backed
  areas explicitly while semantic support matures adapter by adapter.
- Later priorities can change when representative repositories demand them.

## Reference Data

| Priority | Area | Initial level | Backend direction |
| --- | --- | --- | --- |
| 1 | Markdown/config | `resource_backed` | deterministic parsers, path/link extraction, project config discovery |
| 2 | Python | `partial_semantic`, then `semantic` | `tree-sitter` (mandatory), optional Python AST enrichment, Pyright/LSP, Ruff, pytest |
| 3 | TypeScript/JavaScript | `partial_semantic`, then `semantic` | `tree-sitter` (mandatory), optional TypeScript compiler API or `tsserver`, `package.json`, `tsconfig` |
| 4 | C# | `partial_semantic`, then `semantic` | `tree-sitter` (mandatory), optional C# LSP, `.sln`/`.csproj`, NuGet and test project discovery |
| 5 | CloudFormation/SAM | `resource_backed`, then `partial_semantic` | YAML/JSON parser plus intrinsic resolver and source handler linking |
| 6 | Go | `resource_backed`, then `partial_semantic`, then `semantic` | `.go` file identity, `go.mod`/Makefile/Docker test discovery, routing-only package/function/type/method extraction, then parser-backed references, `gopls`, `go list`, `go test` |
| 7 | C/C++ | `resource_backed`, then `partial_semantic` | C/C++ header/source classification, Python stub routing where applicable, routing-only classes/functions/methods/includes, CMake target membership, `tree-sitter` (mandatory), clangd/libclang when `compile_commands.json` exists |
| 8 | Rust | `partial_semantic`, then `semantic` | `tree-sitter` (mandatory), optional Rust parser/enrichment, Cargo metadata, `rust-analyzer`, `cargo test` |
| 9 | SQL | `resource_backed`, then `partial_semantic` | dialect-aware parser, migration-tool integration, schema/table/column references |
| 10 | Bash/Shell | `partial_semantic` | shell parser, ShellCheck, sourced-file and command/function references |
| 11 | Terraform/HCL | `partial_semantic` | HCL parser, provider/module/resource/variable/output graph |
| 12 | Docker/Compose | `resource_backed` | Dockerfile and Compose parsers, service/env/port/volume graph |
| 13 | CI YAML | `resource_backed` | GitHub Actions and workflow parsers, jobs, steps, validation commands |
| 14 | Kubernetes/Helm | `resource_backed`, then `partial_semantic` | Kubernetes YAML and Helm chart parsing, resource/service/config relationships |
| 15 | Vue/Svelte | `partial_semantic`, then `semantic` | framework language services, SFC parsing, route/component/template links |
| 16 | PowerShell | `partial_semantic` | PowerShell parser, script/function/module references |
| 17 | Ruby/PHP | `resource_backed`, then `partial_semantic` | `tree-sitter` parser, optional LSP where project demand exists |
| 18 | Swift/Kotlin/Dart | `resource_backed`, then `partial_semantic` | `tree-sitter` parser, optional LSP adapters when relevant repos appear |
| 19 | Java | `resource_backed`, then `partial_semantic` | `tree-sitter` parser plus Maven/Gradle, optional Java LSP support, deferred until last |

## How To Update

Update this reference when the adapter design changes, when representative repo
evidence changes the priority order, or when an adapter reaches a promotion
gate.

## Related Docs

- [Language adapter design](../design/language-adapter-design.md)
- [Runtime contracts](runtime-contracts.md)
- [Runtime requirements](../requirements/runtime-requirements.md)
