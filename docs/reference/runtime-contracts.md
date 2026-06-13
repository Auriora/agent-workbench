---
title: Runtime contracts
doc_type: reference
status: draft
owner: platform
last_reviewed: 2026-06-13
---

# Runtime Contracts

## Purpose

Define the shared vocabulary and response shapes used by the Agent IDE runtime.
This is the canonical source for enums and envelope fields used by MCP tools,
resources, adapters, graph edges, attention items, and edit contracts.

## Source Layout

Runtime contract schemas are grouped by stable runtime context under
`src/contracts/`:

- `runtime-core-contracts.ts`: contract version, shared enums, file/document
  references, runtime caveats, errors, skipped paths, and generic action/risk
  primitives.
- `runtime-orientation-contracts.ts`: task context, repository scope, and
  repository overview contracts.
- `runtime-docs-contracts.ts`: documentation overview, map, search, outline,
  section reads, Markdown quality, and Markdown formatting contracts.
- `runtime-graph-contracts.ts`: symbol search, reference lookup, and impact
  contracts.
- `runtime-validation-edit-contracts.ts`: verification planning, diagnostics,
  post-edit feedback, and bounded workspace edit contracts.
- `runtime-response-contracts.ts`: response metadata, attention items,
  response envelopes, and envelope construction.
- `runtime-integration-contracts.ts`: MCP surface health and coding-agent
  integration profile contracts.

`src/contracts/runtime-contracts.ts` and `src/contracts/index.ts` remain
compatibility barrels for public imports. New contract definitions should live
in the context module that owns the runtime behavior, then be exported through
the existing barrels.

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

## Task Context Lifecycle Evidence

`context_for_task` separates repository evidence from lifecycle evidence.
Repository evidence remains in requested files, related files, governing docs,
ranked symbols, validation hints, risks, and top-level `next_actions`.
Lifecycle evidence lives in `lifecycle_evidence` entries with a source, kind,
status, summary, files, validation hints, and nested next actions.

Allowed lifecycle evidence kinds are preflight, task detail, validation plan,
evidence quality, task-state audit, closure risk, task context, traceability,
and local spec routing. Local spec routing is always non-authoritative routing
evidence. It may point agents to spec artifacts and companion lifecycle tools,
but it must not claim lifecycle acceptance, task completion, promotion,
reconciliation, release, or closure.

Caller-supplied lifecycle context may be passed into `context_for_task` so
Workbench can join lifecycle files and planned validation to repository routing.
Top-level executable `next_actions` remain Agent Workbench MCP actions; nested
lifecycle next actions are companion-routing hints.

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

## Evidence Semantics

Routing evidence helps an agent decide where to look. It is not proof by
itself. Parser-backed evidence supports stronger claims about declarations,
syntax, imports, and local structure when the relevant adapter has fixture
coverage. Semantic evidence supports stronger claims only for the language and
operation that have fixture-proven behavior.

Direct source reads remain necessary when confidence is partial, degraded,
stale, heuristic, or based on text fallback. Planned validation is not completed
validation. Executed tests/checks or equivalent evidence are required before a
response or final report claims proof.

Do not introduce synonyms for the core capability levels. Use
`evidence_kinds`, provenance, confidence, caveats, and verification status to
express narrower distinctions.

## Debug Sweep Result Quality

Repo-local debug sweep reports use a separate quality label from
agent-facing verification status. These labels summarize whether a debug
harness call produced enough evidence to trust that specific surface result:

- `full`: complete, usable envelope for the bounded call.
- `partial`: useful but incomplete evidence without a continuation cursor or
  equivalent recovery path.
- `degraded`: completed with non-blocking missing capability, skipped
  prerequisite, or warning evidence.
- `blocked`: required evidence was unavailable and the response names the
  blocker or next action.
- `invalid`: the call failed, returned invalid analysis, or produced a contract
  error.

`partial` and `degraded` must not be treated as routine success in dogfood
reports. They require root-cause review and either a runtime fix, a clearer
blocked/unsupported contract, or a documented follow-up.

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

Runtime status responses may include `meta.caveats` when the status envelope is
usable but attention is required before treating coverage as complete. Current
caveat kinds are:

- `no_adapter_coverage`: scanner-visible files did not produce any adapter
  evidence. This is explicit unsupported coverage, not a cold-runtime failure.
- `unsupported_language_or_platform`: scanner-visible files were found for a
  language or platform that has no useful adapter coverage.
- parser and watcher caveats such as `missing_tree_sitter_parser`,
  `missing_parser_grammar`, `parser_timeout`, `parser_crash`,
  `missing_optional_enrichment_evidence`, `missing_test_runner`, and
  `stale_watcher_snapshot`.

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

## Post-Edit Feedback Shape

Post-edit feedback is an internal application and hook-facing result, not a
public MCP tool. It uses the normal response envelope when presented through
runtime surfaces. `status` remains the verification-status vocabulary;
`outcome` describes the repair-loop classification for hook and telemetry
behavior.

Allowed post-edit outcomes are:

- `checked`: changed files were checked and no actionable findings were found
- `actionable`: findings exist and may be surfaced in basic hook mode
- `queued`: inline budgets were exceeded and explicit follow-up is needed
- `skipped`: checks did not apply or were skipped without implying failure
- `unavailable`: a required analyzer/provider was unavailable
- `errored`: a provider or triggering tool failed before checks completed
- `silent`: there was no changed-file evidence to report

Deferred checks preserve why inline evidence is incomplete without forcing hook
text:

```json
{
  "repo_root": "/repo",
  "status": "done",
  "outcome": "queued",
  "checked_files": ["src/a.ts", "src/b.ts", "src/c.ts"],
  "findings": [],
  "deferred_checks": [
    {
      "reason": "too_many_files",
      "outcome": "queued",
      "count": 1,
      "paths": ["src/c.ts"],
      "message": "Changed file count exceeds the inline post-edit diagnostics budget.",
      "follow_up_tool": "diagnostics_for_files"
    }
  ],
  "next_actions": [
    {
      "tool": "diagnostics_for_files",
      "args": {
        "repo_root": "/repo",
        "files": ["src/a.ts", "src/b.ts", "src/c.ts"]
      }
    }
  ]
}
```

Hook-facing presenters must suppress `visible_message` unless `findings` are
actionable. Telemetry may record deferred-check counts and reasons, but planned
or deferred checks must not be reported as executed validation.

Markdown quality findings are executable read-only checker outputs from
`check_markdown_document` and `check_markdown_set`. The contract shape also
keeps future formatter work previewable and presentation-compatible.

```json
{
  "category": "table_readability",
  "severity": "warning",
  "rule_id": "markdown.table.readability",
  "code": "markdown.table.readability",
  "path": "docs/design/example.md",
  "start_line": 12,
  "start_column": 0,
  "end_line": 20,
  "end_column": 0,
  "message": "The table is hard to read as plain text.",
  "evidence": "| Field | Long explanation ... |",
  "suggested_action": "Preview a table-to-definition-list rewrite.",
  "evidence_kinds": ["direct_read", "docs"]
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
