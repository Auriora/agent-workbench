---
title: Rails routing concern identity change impact
doc_type: spec
artifact_type: change-impact
status: draft
owner: platform
last_reviewed: 2026-08-02
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Change Impact

## Durable Source Mapping

| Current authority | Relied-on contract |
| --- | --- |
| `docs/design/language-adapter-design.md` | Tree-sitter-only, fail-closed Ruby semantics. |
| `docs/reference/runtime-contracts.md` | Generic graph nodes, references, ambiguity, and traversal. |
| `docs/reference/language-capability-matrix.md` | Ruby/Rails remains `partial_semantic`. |
| `docs/backlog/README.md` EB010 | Owns residual Rails semantic depth. |

## Proposed Changes

## Runtime delta

| Area | File | Change |
| --- | --- | --- |
| Ruby syntax extraction | `src/infrastructure/tree-sitter/ruby-parser.ts` | Emit concern declarations, contained-reference ownership, reuse references, and bounded scope metadata. |
| Ruby graph resolution | `src/application/use-cases/index-repository-graph.ts` | Restrict concern reuse candidates to matching concern declaration nodes. |

No SQLite schema, public request/response schema, MCP adapter, command execution,
or parser dependency changes are planned.

## Test delta

| Area | File | Evidence |
| --- | --- | --- |
| Parser/extractor | `tests/adapters/ruby-parser.test.ts` | Supported forms, metadata, dynamic exclusions, source ownership. |
| Graph/query | `tests/graph/ruby-semantic-extraction.test.ts` | Unique edges, ambiguity, references, impact, bounded cycles. |
| Task context | Existing focused `get-task-context` test seam | Ranked concern identity and graph follow-up routing without a Rails-specific path. |
| Fixture | `tests/fixtures/fixture-ruby-semantic-repo/config/routes.rb` | Integrated Rails route examples where useful. |

## Documentation delta

The adapter design, language matrix, agent-readable changelog, EB010, and
dogfood ledger change only after implementation evidence exists.

## Promotion Targets

| Target | Promotion condition |
| --- | --- |
| Adapter design | Focused and full regression tests pass. |
| Language matrix | Supported and unsupported forms are fixture-proven. |
| Agent-readable changelog | Existing graph surfaces expose the new nodes and edges. |
| EB010 | Delivered slice and retained residuals are reconciled. |
| Dogfood ledger | Both target worktrees remain unchanged and evidence is bounded. |

## Risks

- Duplicate declaration nodes could collapse if their qualified identities are
  not source-distinct.
- Generic Ruby calls could be emitted in addition to specialized concern
  evidence if traversal ownership is not explicit.
- Resource options could suppress ordinary resource references if concern
  parsing is coupled to existing route-option validation.
- A broad `ruby_route` resolver could accidentally select controller classes
  for concern reuse; candidate-kind filtering must be explicit.
