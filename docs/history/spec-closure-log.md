---
title: Spec closure log
doc_type: history
status: active
owner: platform
last_reviewed: 2026-06-06
---

# Spec Closure Log

## Purpose

Record closed implementation spec packages after their accepted behavior has
been promoted to durable docs, backlog items, roadmap entries, tests, or code.
Closed packages are removed from `docs/specs/` so that directory only contains
active implementation scaffolding.

The final pre-removal tree commit for the packages listed below is `77e0fda`.
That commit contains the completed packages before the closure cleanup removed
them from the active docs tree.

## Closed Specs

| Spec | Closure action | Durable destination |
| --- | --- | --- |
| Spec 001: Agent IDE runtime | Removed from `docs/specs/` on 2026-06-06 after MVP completion and durable promotion. | Runtime requirements, layered/runtime/design docs, MCP surface design, graph store design, runtime contracts, workspace safety contract, ADRs, runbooks, and MVP proof matrix. |
| Spec 002: TimeLocker dogfood follow-ups | Removed from `docs/specs/` on 2026-06-06 after follow-up behavior was routed into later cross-repo work. | Documentation map, executable backlog, and cross-repo runtime design/reference docs. |
| Spec 003: Cross-repo trust discovery | Removed from `docs/specs/` on 2026-06-06 after trust, scope, and first-slice routing behavior was promoted. | MCP surface design, runtime operations design, workspace safety contract, language adapter design, and executable backlog. |
| Spec 004: Overview ranking polish | Removed from `docs/specs/` on 2026-06-06 after overview ranking behavior was promoted. | MCP surface design and documentation map. |
| Spec 005: .NET repository shape hardening | Removed from `docs/specs/` on 2026-06-06 after generated-output and validation-planning behavior was promoted. | Language adapter design, MCP surface design, runtime operations design, and language capability matrix. |
| Spec 006: Infrastructure template routing | Removed from `docs/specs/` on 2026-06-06 after infrastructure routing behavior was promoted. | Language adapter design, MCP surface design, and executable backlog. |
| Spec 007: Redaction boundary polish | Removed from `docs/specs/` on 2026-06-06 after presentation redaction behavior was promoted. | MCP surface design and workspace safety contract. |
| Spec 008: Lambda result presentation | Removed from `docs/specs/` on 2026-06-06 after Lambda grouping behavior was promoted. | MCP surface design and language adapter design. |
| Spec 009: CMake C++ routing and validation | Removed from `docs/specs/` on 2026-06-06 after CMake/C++ routing behavior was promoted. | Language adapter design, MCP surface design, and language capability matrix. |
| Spec 010: Agent IDE capability analysis | Removed from `docs/specs/` on 2026-06-06 after portable lessons were promoted. | Agent IDE capability analysis reference, executable backlog, and follow-up specs. |
| Spec 011: Diagnostics and post-edit feedback | Removed from `docs/specs/` on 2026-06-06 after diagnostics and quiet hook feedback behavior was promoted. | MCP surface design, edit and validation loop design, and coding agent integration design. |
| Spec 012: Docs query and read surfaces | Removed from `docs/specs/` on 2026-06-06 after docs query/read behavior was promoted. | MCP surface design and Markdown document quality design. |
| Spec 013: FTS-backed docs search | Removed from `docs/specs/` on 2026-06-06 after FTS docs search behavior was promoted. | MCP surface design, graph store design, and runtime operations design. |
| Spec 014: TypeScript/JavaScript partial semantic routing | Removed from `docs/specs/` on 2026-06-06 after JS/TS routing behavior was promoted. | Language adapter design, MCP surface design, and language capability matrix. |
| Spec 015: Go reference and impact promotion | Removed from `docs/specs/` on 2026-06-06 after Go reference/impact behavior was promoted. | Language adapter design, MCP surface design, and language capability matrix. |
| Spec 016: SAM CloudFormation intrinsic routing | Removed from `docs/specs/` on 2026-06-06 after SAM/CloudFormation routing behavior was promoted. | Language adapter design, MCP surface design, and language capability matrix. |
| Spec 017: Markdown quality MCP surface | Removed from `docs/specs/` on 2026-06-06 after Markdown quality behavior was promoted. | Markdown document quality design, MCP surface design, and edit and validation loop design. |
| Spec 018: History mining for agent IDE signals | Removed from `docs/specs/` on 2026-06-06 after mining taxonomy and routed follow-up work were promoted. | Agent Workbench executable backlog and history-mining reference notes. |

## Closure Notes

The packages remain available through Git history at the final pre-removal tree
commit. New implementation work should use active packages under `docs/specs/`,
durable docs, or backlog items instead of restoring removed packages unless a
historical audit explicitly needs the original scaffolding.
