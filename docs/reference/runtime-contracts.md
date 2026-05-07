---
title: Runtime contracts
doc_type: reference
status: draft
owner: platform
last_reviewed: 2026-05-07
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
