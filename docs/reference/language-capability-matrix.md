---
title: Language capability matrix
doc_type: reference
status: draft
owner: platform
last_reviewed: 2026-08-01
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
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
| 3 | TypeScript/JavaScript | `partial_semantic`, then `semantic` | `tree-sitter-javascript` and `tree-sitter-typescript` declaration/import/export extraction, package/workspace/`tsconfig` routing, package-local validation planning, optional TypeScript compiler API or `tsserver` only after promotion fixtures |
| 4 | Ruby/Rails | current `resource_backed`; next `partial_semantic` | Delivered Ruby and Rails catalog/project-shape/context/validation planning from Spec 047; Spec 048 owns the one tree-sitter Ruby parser path and bounded Rails DSL semantics |
| 5 | PHP/Laravel | `resource_backed`, then `partial_semantic` | Level 1 dogfood priority because an identified PHP/Laravel user can test and give feedback; use `tree-sitter` parser, Composer metadata, Laravel app/route/controller/model discovery, PHPUnit/Pest planning, optional PHP LSP where project demand exists |
| 6 | Nuxt/Vue Web Apps | `resource_backed`, then `partial_semantic`, then `semantic` | Level 1 dogfood priority for the same tester's JS/TS Nuxt workflow; detect Nuxt/Vue app shape, package/workspace boundaries, routes/pages/components, SSR/runtime config, Vite/Vitest/Playwright planning, optional framework language services after fixtures |
| 7 | C#/.NET | `resource_backed`, then `partial_semantic`, then `semantic` | `.sln`/`.csproj`/`.fsproj`/`.vbproj` project metadata, NuGet and test project discovery, generated-output policy, then `tree-sitter` and optional C# LSP |
| 8 | CloudFormation/SAM | `resource_backed`, then `partial_semantic` | YAML/JSON template traversal, logical resources, Lambda handler/file routing, explicit SAM event sources, intrinsic/dependency edges with low-confidence provenance, policy-aware non-executed validation planning, deeper stack semantics deferred |
| 9 | Go | `partial_semantic`, then `semantic` | `tree-sitter-go` package/import/function/type/method extraction, parser-backed selector and identifier references, low-confidence impact traversal, `go.mod`/Makefile/CI/Docker validation planning, optional `gopls`, `go list`, and `go test` enrichers only after promotion fixtures |
| 10 | C/C++ | `resource_backed`, then `partial_semantic` | C/C++ header/source classification, Python stub routing where applicable, routing-only classes/functions/methods/includes, heuristic include/local-call edges with low confidence, CMake target membership, non-executed CMake configure/build/test planning, `tree-sitter` (mandatory), clangd/libclang when `compile_commands.json` exists |
| 11 | Rust | `partial_semantic`, then `semantic` | `tree-sitter` (mandatory), optional Rust parser/enrichment, Cargo metadata, `rust-analyzer`, `cargo test` |
| 12 | SQL | `resource_backed`, then `partial_semantic` | dialect-aware parser, migration-tool integration, schema/table/column references |
| 13 | Bash/Shell | `partial_semantic` | shell parser, ShellCheck, sourced-file and command/function references |
| 14 | Terraform/HCL | `partial_semantic` | HCL parser, provider/module/resource/variable/output graph |
| 15 | Docker/Compose | `resource_backed` | Dockerfile and Compose parsers, service/env/port/volume graph |
| 16 | CI YAML | `resource_backed` | GitHub Actions and workflow parsers, jobs, steps, validation commands |
| 17 | Kubernetes/Helm | `resource_backed`, then `partial_semantic` | Kubernetes YAML and Helm chart parsing, resource/service/config relationships |
| 18 | Svelte | `partial_semantic`, then `semantic` | framework language services, SFC parsing, route/component/template links |
| 19 | PowerShell | `partial_semantic` | PowerShell parser, script/function/module references |
| 20 | Swift/Kotlin/Dart | `resource_backed`, then `partial_semantic` | `tree-sitter` parser, optional LSP adapters when relevant repos appear |
| 21 | Java | `resource_backed`, then `partial_semantic` | `tree-sitter` parser plus Maven/Gradle, optional Java LSP support, deferred until last |

## How To Update

Update this reference when the adapter design changes, when representative repo
evidence changes the priority order, or when an adapter reaches a promotion
gate.

## Related Docs

- [Language adapter design](../design/language-adapter-design.md)
- [Runtime contracts](runtime-contracts.md)
- [Runtime requirements](../requirements/runtime-requirements.md)
