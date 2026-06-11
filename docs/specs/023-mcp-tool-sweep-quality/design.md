---
title: MCP tool sweep quality design
doc_type: spec
artifact_type: design
status: active
owner: platform
last_reviewed: 2026-06-06
---

# Technical Design

## Overview

Add a permanent debug harness and focused contract improvements for MCP surface
quality. The harness exercises the public MCP registry against target
repositories as read-only input data, classifies outputs, and writes local
reports. Runtime changes should make blocked, degraded, partial, and invalid
states clearer without adding fallback analysis paths that mask missing
evidence.

## High-Level Design

Components:

- MCP tool sweep debug harness.
- Sweep input selector for safe repo-relative files, docs, headings, and
  graph symbols.
- Sweep classifier for envelope quality labels and coverage gaps.
- Presenter and metadata corrections for status, docs search, docs outline,
  graph-backed tools, and verification plans.
- Fixture tests for stable positive and negative cases.
- Durable documentation for running and interpreting the sweep.

The harness lives under `src/debug/` and is exposed through a package script.
It is not an MCP resource or tool. It may call the MCP server through stdio or
through the same server construction path used by MCP tests, but it must use
the public registry as the source of truth for surface coverage.

## Data Flow

```text
target repo list
  -> repo fact discovery
  -> MCP session per repo
  -> resources/list and tools/list
  -> planned resource/tool calls
  -> response envelope parser
  -> quality classifier
  -> JSON report under .tmp/
```

Repo fact discovery uses bounded local file and index evidence:

- existing repo-relative Markdown files for docs tools;
- existing text files for edit preview/apply no-op content only when the repo
  root is a repo-owned fixture or explicit sandbox copy;
- package or manifest files for diagnostics and context;
- indexed graph symbols when a warm snapshot is available;
- explicit skip records when prerequisites are unavailable.

## Quality Classification

The sweep report uses a harness classification that is separate from the MCP
contract:

- `full`: valid analysis and complete enough for the requested sweep case.
- `partial`: useful output with truncation, budget limits, skipped evidence, or
  incomplete but actionable data.
- `degraded`: output returned but the selected input, repo shape, unsupported
  adapter, or missing optional evidence reduced usefulness.
- `blocked`: the tool correctly refused to proceed because required evidence
  or policy was missing.
- `invalid`: malformed response, unhandled error, unexplained invalid metadata,
  timeout, or invalid result without an actionable reason.

Blocked tool output is not automatically a product failure. The harness should
promote only unexplained invalid states, timeouts, malformed output, and
contract-inconsistent metadata as findings that need implementation work.

## Low-Level Design

### Debug Harness

Add `src/debug/mcp-tool-sweep.ts` with:

```ts
export type ToolSweepConfig = {
  repos: string[];
  output_dir: string;
  call_timeout_ms: number;
  include_raw: boolean;
  start_graph_warmup: boolean;
};

export type ToolSweepSurfaceResult = {
  repo_root: string;
  kind: "resource" | "tool" | "discovery";
  name: string;
  status: "ok" | "failed" | "skipped";
  quality: "full" | "partial" | "degraded" | "blocked" | "invalid";
  elapsed_ms: number;
  analysis_validity?: string;
  verification_status?: string;
  truncated?: boolean;
  errors: string[];
  warnings: string[];
  data_shape: Record<string, unknown>;
  raw_envelope?: unknown;
};
```

The harness should provide pure functions for:

- resolving repository roots;
- discovering safe files;
- building call plans from `mcpResources` and `mcpTools`;
- parsing MCP text envelopes;
- classifying quality;
- writing reports.

Keep MCP handlers thin. Do not move harness logic into the public MCP registry.

### Call Planning

Resource calls:

- `resources/list`
- `tools/list`
- all registered resources from `mcpResources`

Tool calls:

- `context_for_task` with selected existing files and bounded budgets.
- `diagnostics_for_files` with JSON or manifest files where present.
- `docs_search` with warm FTS required; blocked cold output is expected.
- `docs_outline` using an existing Markdown document, preferably one with
  headings.
- `docs_read_section` only after a heading id is available.
- `check_markdown_document` and `check_markdown_set` using existing Markdown
  files.
- `symbol_search` using an indexed symbol if available, otherwise an explicit
  degraded no-symbol case.
- `find_references` and `impact` using a node id from symbol search when
  available.
- `preview_workspace_edit` with identical file content only for repo-owned
  fixtures or sandbox copies.
- `apply_workspace_edit` once with a valid preview token and once with an
  invalid token only for repo-owned fixtures or sandbox copies. Original
  external target repositories must record these tools as skipped degraded
  coverage with a sandbox-copy instruction.
- `verification_plan` with selected existing files and no command execution.

### Metadata Corrections

Investigate and correct these cases with focused tests:

- `repo:///status` with no adapter coverage should be unsupported or degraded
  with a reason, not invalid without errors.
- `docs_search` with cold or refreshing FTS should be structured blocked with
  actionable evidence and should not be counted as malformed invalid.
- `docs_outline` should distinguish missing file, existing no-heading file,
  and existing headed file.
- `context_for_task`, `symbol_search`, `find_references`, and `impact` should
  distinguish cold graph, unsupported language, no matching symbol, and
  successful graph-backed evidence.
- `verification_plan` blocked output should include a reason and next action.

### Fixture Strategy

Add or extend fixtures under `tests/fixtures/`:

- fixture with headed Markdown.
- fixture with no-heading Markdown.
- fixture with missing requested Markdown path.
- fixture with cold docs FTS state.
- fixture with no adapter coverage.
- fixture with indexed symbols suitable for symbol, references, and impact.
- fixture with verification blocked evidence.
- fixture for positive and negative workspace edit flow.

Do not add target-repo-specific fixtures for FreeCAD, LibreChat, or client
repositories. Cross-repo dogfood remains an external validation mode.
Original external target repositories are read-only inputs for dogfood. If
workspace-write behavior needs to be exercised against a real external
repository shape, copy that repository into a sandbox under `.tmp` or an
Agent Workbench-named `/tmp` sandbox directory and run the sweep against the
copy.

## Operational Considerations

- Reports are local generated artifacts under `.tmp/` and must not be
  committed.
- The harness may be slower than unit tests and should remain a debug command,
  not part of the default `pnpm test` suite.
- Focused fixture tests should be part of `pnpm test`.
- The harness should make timeouts visible with surface name and repo root.
- No target-repo build, test, install, Docker, network commands, or
  workspace-write calls against original external repositories are allowed.

## Open Questions

- Should `docs_search` cold/refreshing output use `analysis_validity:
  invalid`, `partial`, or `invalid_due_to_environment`? The current durable MCP
  design says blocked cold output is intentional; this spec requires it to be
  actionable and not misread as an unhandled failure.
- Should no-heading Markdown be `done` with zero headings or `needed` with a
  warning? The implementation should choose one behavior and update durable
  docs.
- Should the sweep wait for graph warmup by default, or record cold graph
  output first and optionally rerun graph-backed tools after warmup?
