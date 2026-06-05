---
title: Runtime contracts
doc_type: reference
status: draft
owner: platform
last_reviewed: 2026-06-05
---

# Runtime Contracts

## Purpose

Define the shared vocabulary and response shapes used by the Agent IDE runtime.
This is the canonical source for enums and envelope fields used by MCP tools,
resources, adapters, graph edges, attention items, and edit contracts.

## Contract Versioning

Every MCP response must include a contract version.

```json
{
  "contract_version": "0.1",
  "data": {},
  "meta": {},
  "warnings": [],
  "errors": []
}
```

Breaking schema changes require a new contract version. Non-breaking additions
may add optional fields but must not change enum meanings.

## Capability Levels

Use these values only:

- `semantic`: exact symbol lookup, references, impact, diagnostics or validation
  routing, freshness, and degraded behavior are fixture-proven.
- `partial_semantic`: declarations, outlines, imports, project structure, or
  some references are available, but agents must verify before relying on broad
  impact or mutation safety.
- `resource_backed`: file, config, project, or infrastructure resources are
  available for routing and context only.
- `unsupported`: files may exist, but no useful adapter evidence is configured.

Do not use `routing_evidence`, `infra_semantic`, or `resource_only` as
capability levels. Use `evidence_kind` or `adapter_domain` instead.

## Evidence Kinds

Evidence kind explains where a claim came from. Multiple values may apply.

- `parser`
- `lsp`
- `compiler_api`
- `sqlite`
- `fts`
- `docs`
- `tests`
- `direct_read`
- `config`
- `infra_parser`
- `heuristic`
- `text_fallback`
- `executed_command`

## Adapter Domains

Adapter domain describes what kind of surface an adapter covers.

- `language`
- `config`
- `infrastructure`
- `documentation`
- `test`
- `tooling`

## Freshness

- `fresh`: evidence matches the current watcher-clean snapshot.
- `stale`: evidence is known to lag current files or config.
- `cold`: no usable index exists yet.
- `refreshing`: refresh is in progress.
- `unknown`: freshness cannot be determined.

## Analysis Validity

- `valid`: evidence is usable for the requested operation.
- `partial`: evidence is useful but incomplete.
- `invalid`: evidence cannot support the requested operation.
- `invalid_due_to_environment`: missing tools, permissions, command failures, or
  environment mismatch prevent the operation.

## Verification Status

- `done`: validation has executed or equivalent evidence is available.
- `planned`: validation commands or checks are identified but not executed.
- `needed`: validation is required before relying on the result.
- `blocked`: validation could not proceed.
- `not_applicable`: validation does not apply to this result.

## Response Metadata

Every non-trivial MCP response should include:

```json
{
  "meta": {
    "analysis_validity": "valid",
    "freshness": "fresh",
    "scope": {
      "repo_root": "/repo",
      "indexed_roots": ["src", "tests"],
      "skipped_roots": ["node_modules"],
      "languages": ["python"]
    },
    "capability_level": "partial_semantic",
    "evidence_kinds": ["parser", "sqlite"],
    "verification_status": "planned",
    "truncated": false,
    "budget": {
      "time_ms": 100,
      "row_limit": 100,
      "traversal_depth": 2
    }
  }
}
```

## Error Shape

Errors must be structured and actionable.

```json
{
  "code": "stale_preview",
  "message": "The preview was created for an older file version.",
  "retryable": true,
  "next_action": {
    "tool": "preview_workspace_edit",
    "args": {"files": ["src/example.ts"]}
  }
}
```

## Attention Item Shape

Attention is MVP-limited to blockers and warnings.

```json
{
  "severity": "blocker",
  "kind": "stale_preview",
  "scope": {
    "files": ["src/auth/session.ts"],
    "symbols": ["UserSession"]
  },
  "message": "The edit preview is stale.",
  "why_this_matters": "Applying it could overwrite unrelated changes.",
  "evidence_kinds": ["sqlite"],
  "freshness": "fresh",
  "next_action": {
    "tool": "preview_workspace_edit",
    "args": {"files": ["src/auth/session.ts"]}
  },
  "expires_when": "new_preview_created"
}
```

Allowed MVP severities:

- `blocker`
- `warning`

Deferred severities:

- `nudge`
- `context`

Allowed MVP kinds:

- `stale_preview`
- `syntax_error`
- `missing_tool`
- `low_confidence`
- `validation_blocked`
- `path_refused`
- `command_refused`

Post-MVP documentation-quality kinds:

- `markdown_heading_level`
- `markdown_numbering`
- `markdown_table_readability`
- `markdown_frontmatter`
- `markdown_link`
- `markdown_format_preview`

## Graph Evidence Labels

`symbol_search` exact mode first checks exact `name` and `qualified_name`
matches. If no exact symbol exists, the result may be empty or may contain
bounded fuzzy matches. An empty exact result is not a tool failure. It means the
requested symbol was not present in the current snapshot, and `next_actions`
should route the agent back to `context_for_task` or source inspection rather
than `find_references`.

`find_references` returns parser-backed, unresolved-parser, and bounded lexical
evidence in the same reference-hit shape. Every hit includes `evidence_kinds`:

- resolved parser edges use `["parser"]`
- unresolved parser candidates use `["parser", "heuristic"]`
- lexical fallback hits use `["text_fallback", "heuristic"]` and lower
  confidence

Lexical hits are routing evidence only. Agents must directly verify source
before treating them as semantic references.

Routing-only language extractors, such as the first-slice Go and C/C++ paths,
may return symbols with `capability_level: "resource_backed"` and
`evidence_kinds: ["heuristic"]`. These symbols are valid for navigation and
context routing, but they do not imply parser-backed references, impact, or
safe refactoring. `find_references` and `impact` must keep confidence low when
no semantic edges exist.

`impact` includes a `confidence` object with:

- `level`: `high`, `medium`, or `low`
- `scope`: `graph`, `local_only`, or `empty`
- `reason`: compact explanation for blast-radius trust
- `evidence_kinds`: evidence supporting the confidence label

When traversal stays within one file or finds no edges, `scope` must be
`local_only` or `empty` and the reason must state that broad edit planning needs
additional verification.

## Edit Token Shape

Preview/apply tokens must include enough identity to reject stale mutations.

```json
{
  "preview_token": "opaque-token",
  "created_at": "2026-05-07T00:00:00Z",
  "expires_at": "2026-05-07T00:10:00Z",
  "files": [
    {
      "path": "src/example.ts",
      "base_hash": "sha256:...",
      "after_hash": "sha256:...",
      "change_count": 1
    }
  ],
  "operation": "bounded_text_edit",
  "mutation_class": "workspace_write"
}
```

## Tool Capability Classes

- `read_only`: reads runtime state or source-derived evidence.
- `planning`: proposes edits or validation without mutating files or running
  commands.
- `workspace_write`: mutates workspace files and requires preview/drift checks.
- `process_execute`: runs local commands and requires the workspace safety
  contract.
- `generated_write`: writes generated cache or report artifacts only.

## Integration Profile Shape

Integration profiles describe how common runtime capabilities map to coding
agent surfaces. MCP bindings are the executable source of truth; plugins,
commands, hooks, instructions, skills, extensions, and ACP packaging are
artifacts around those bindings.

```json
{
  "runtime_version": "0.1",
  "target_agents": ["codex", "claude_code", "kiro"],
  "mcp_bindings": [
    {
      "name": "context_for_task",
      "kind": "tool",
      "capability_class": "read_only"
    }
  ],
  "artifacts": [
    {
      "target_agent": "codex",
      "surface": "skills",
      "path": ".agents/skills/runtime-context/SKILL.md",
      "status": "supported",
      "provenance": "generated_from_runtime_contracts",
      "regeneration_safe": true,
      "notes": []
    }
  ],
  "unsupported_surfaces": [
    {
      "target_agent": "junie",
      "surface": "hooks",
      "reason": "No hook emitter is defined for MVP."
    }
  ]
}
```

## Markdown Quality Shapes

Markdown quality findings are post-MVP executable tool outputs, but their
contract shape is defined up front so checker and formatter work remains
previewable and presentation-compatible.

```json
{
  "category": "table_readability",
  "severity": "warning",
  "code": "markdown_table_readability",
  "path": "docs/design/example.md",
  "start_line": 12,
  "start_column": 0,
  "end_line": 20,
  "end_column": 0,
  "message": "The table is hard to read as plain text.",
  "suggested_action": "Preview a table-to-definition-list rewrite.",
  "evidence_kinds": ["parser", "docs"]
}
```

```json
{
  "path": "docs/design/example.md",
  "strategy": "table_to_definition_list",
  "rationale": "The table contains definition-style rows and exceeds the text readability budget.",
  "preserves_rendered_meaning": true,
  "requires_preview": true,
  "findings": [],
  "preview_token": "optional-preview-token"
}
```

## MVP Tool Classes

| Surface | Class | MVP |
| --- | --- | --- |
| `repo:///status` | `read_only` | yes |
| `repo:///scope` | `read_only` | yes |
| `repo:///overview` | `read_only` | yes |
| `context_for_task` | `read_only` | yes |
| `symbol_search` | `read_only` | yes |
| `find_references` | `read_only` | yes |
| `impact` | `read_only` | bounded MVP |
| `preview_workspace_edit` | `planning` | yes |
| `apply_workspace_edit` | `workspace_write` | yes |
| `verification_plan` | `planning` | yes |
| `run_nearest_tests` | `process_execute` | post-MVP |
| graph community/report tools | `read_only` or `generated_write` | post-MVP |

## Related Docs

- [Documentation map](documentation-map.md)
- [MCP surface design](../design/mcp-surface-design.md)
- [Language adapter design](../design/language-adapter-design.md)
- [Workspace safety contract](workspace-safety-contract.md)
