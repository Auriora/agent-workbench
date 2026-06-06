---
title: MCP tool sweep quality verification
doc_type: spec
artifact_type: verification
status: active
owner: platform
last_reviewed: 2026-06-06
---

# Verification

## Quality Gates

- `pnpm typecheck`
- Focused Vitest tests for the MCP tool sweep harness.
- Focused status, docs, graph, markdown, verification-plan, and presenter tests.
- `pnpm test` before closure.
- Eight-repo `pnpm debug:mcp-tool-sweep` dogfood run.
- `git diff --check`.
- Spec lifecycle validation or manual artifact consistency check.

## Target Repositories For Dogfood

The dogfood sweep uses these repositories as input data only:

- `/home/bcherrington/Projects/Auriora/TimeLocker`
- `/home/bcherrington/Projects/Clients/Co-foundry/aws-datalake`
- `/home/bcherrington/Projects/CLion/FreeCAD`
- `/home/bcherrington/Projects/Webstorm/LibreChat`
- `/home/bcherrington/Projects/Auriora/OneMount`
- `/home/bcherrington/Projects/Clients/Modena AEC/One-Register-Web-Application`
- `/home/bcherrington/Projects/Clients/Modena AEC/XRPPOC`
- `/home/bcherrington/Projects/CLion/CrealityPrint`

The sweep must not compile, build, test, install dependencies, start Docker, or
run target-repo commands.

## Validation Plan

1. Prove harness coverage against all registered `mcpResources` and `mcpTools`.
2. Prove positive and negative workspace-edit sweep cases with unchanged file
   content.
3. Prove docs FTS cold/refreshing output is structured and actionable.
4. Prove no-coverage status output has explicit degraded or unsupported
   evidence.
5. Prove docs outline/read-section behavior for missing, no-heading, and headed
   Markdown files.
6. Prove graph-backed calls use indexed symbols where available and report
   specific degraded causes where unavailable.
7. Prove blocked verification plans include reasons and next actions.
8. Rerun the eight-repo sweep and reconcile all invalid, blocked, partial, and
   degraded results.

## Evidence Log

| Date | Activity | Result |
| --- | --- | --- |
| 2026-06-06 | Temporary full MCP sweep across eight repos | 176 calls; 154 returned MCP output; 22 classified failed/invalid; 52 full, 39 partial, 60 degraded, 3 blocked, 22 invalid. |
| 2026-06-06 | Targeted apply rerun with real preview tokens | `apply_workspace_edit` returned valid done/applied on all eight repos using identical replacement text. |
| 2026-06-06 | Spec created | Pending implementation. |

## Known Initial Findings

- `docs_search` can return blocked invalid output while docs FTS evidence is
  cold or refreshing.
- `repo:///status` can return invalid without explicit errors when adapter
  coverage is zero.
- `docs_outline` and `check_markdown_document` need clearer missing versus
  no-heading behavior.
- Graph-backed tools need better sweep inputs and clearer degraded reasons.
- `verification_plan` blocked output needs reason and next-action clarity.
- Routine skipped-path warnings are too noisy for large repos.

## Residual Risks

- Large repositories may exceed practical sweep budgets even when individual
  calls are bounded.
- Graph warmup timing may make dogfood results nondeterministic unless the
  harness controls warmup or records cold-state evidence explicitly.
- Some target repos have dirty worktrees or generated artifacts unrelated to
  Agent Workbench; dogfood reports must avoid treating those as product
  failures unless they affect MCP output semantics.
- Contract enum changes could affect downstream agents, so semantic changes
  must be reflected in durable docs before closure.
