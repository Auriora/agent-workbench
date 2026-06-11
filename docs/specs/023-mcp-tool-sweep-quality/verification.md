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
- Eight-repo `pnpm debug:mcp-tool-sweep` dogfood run with workspace-write
  tools skipped on original target repos or run only against committed-tree
  sandbox copies.
- `git diff --check`.
- Spec lifecycle validation or manual artifact consistency check.

## Target Repositories For Dogfood

The dogfood sweep uses these repositories as read-only input data only:

- `/home/bcherrington/Projects/Auriora/TimeLocker`
- `/home/bcherrington/Projects/Clients/Co-foundry/aws-datalake`
- `/home/bcherrington/Projects/CLion/FreeCAD`
- `/home/bcherrington/Projects/Webstorm/LibreChat`
- `/home/bcherrington/Projects/Auriora/OneMount`
- `/home/bcherrington/Projects/Clients/Modena AEC/One-Register-Web-Application`
- `/home/bcherrington/Projects/Clients/Modena AEC/XRPPOC`
- `/home/bcherrington/Projects/CLion/CrealityPrint`

The sweep must not compile, build, test, install dependencies, start Docker,
run target-repo commands, or perform workspace-write tool calls against these
original repositories. If workspace-write behavior must be tested against one
of these repository shapes, first copy the repository into a sandbox under
`.tmp` or an Agent Workbench-named `/tmp` sandbox directory and run the
write-capable sweep calls against the copy.

For broad external dogfood, prefer committed-tree sandboxes created from each
repository with `git archive HEAD`. This excludes `.git`, uncommitted files,
ignored folders, dependency folders, generated runtime data, and local cache
directories by construction while preserving the repository shape that agents
would see from committed source.

## Validation Plan

1. Prove harness coverage against all registered `mcpResources` and `mcpTools`.
2. Prove positive and negative workspace-edit sweep cases with unchanged file
   content using repo-owned fixtures or sandbox copies only.
3. Prove docs FTS cold/refreshing output is structured and actionable.
4. Prove no-coverage status output has explicit degraded or unsupported
   evidence.
5. Prove docs outline/read-section behavior for missing, no-heading, and headed
   Markdown files.
6. Prove graph-backed calls use indexed symbols where available and report
   specific degraded causes where unavailable.
7. Prove blocked verification plans include reasons and next actions.
8. Rerun the eight-repo read-only sweep and reconcile all invalid, blocked,
   partial, and degraded results. Workspace-write findings on original repos
   should be skipped degraded coverage unless a sandbox copy was used.

## Evidence Log

| Date | Activity | Result |
| --- | --- | --- |
| 2026-06-06 | Temporary full MCP sweep across eight repos | 176 calls; 154 returned MCP output; 22 classified failed/invalid; 52 full, 39 partial, 60 degraded, 3 blocked, 22 invalid. |
| 2026-06-06 | Historical targeted apply rerun with real preview tokens | `apply_workspace_edit` returned valid done/applied on all eight repos using identical replacement text. This is retained as historical evidence only; future external dogfood must not write-test original target repos. |
| 2026-06-06 | Spec created | Pending implementation. |
| 2026-06-11 | Added permanent fixture sweep harness | `pnpm test tests/mcp/debug-harness.test.ts` passed with 9 tests, including the external-repo workspace-write skip guard. |
| 2026-06-11 | TypeScript validation for harness slice | `pnpm typecheck` passed. |
| 2026-06-11 | Fixture-focused MCP tool sweep baseline | `pnpm debug:mcp-tool-sweep -- --repo tests/fixtures/fixture-mcp-tool-sweep --output-dir .tmp/agent-workbench-tool-sweep --start-graph-warmup` wrote a local `.tmp` JSON report with 22 planned calls: 14 full, 0 partial, 7 degraded, 1 blocked, 0 invalid. |
| 2026-06-11 | Sandboxed external subset write sweep | Copied XRPPOC, LibreChat, and One-Register-Web-Application into `.tmp/tool-sweep-sandboxes/` with generated/runtime data excluded, then ran `pnpm debug:mcp-tool-sweep -- --repo .tmp/tool-sweep-sandboxes/xrppoc --repo .tmp/tool-sweep-sandboxes/librechat --repo .tmp/tool-sweep-sandboxes/one-register --output-dir .tmp/agent-workbench-tool-sweep-sandboxed --start-graph-warmup`. Summary: 21 full, 12 partial, 29 degraded, 2 blocked, 2 invalid. `preview_workspace_edit` and `apply_workspace_edit` were full/ok for all three sandbox copies. The two invalids were LibreChat `docs_search` and `check_markdown_document`, not write-tool failures. |
| 2026-06-11 | Eight-repo committed-tree sandbox dogfood sweep | Created `.tmp/tool-sweep-sandboxes-committed/{timelocker,aws-datalake,freecad,librechat,onemount,one-register,xrppoc,crealityprint}` from each target repository with `git archive HEAD`, excluding uncommitted and ignored/generated content. Ran `pnpm debug:mcp-tool-sweep -- --repo ... --output-dir .tmp/agent-workbench-tool-sweep-committed-sandboxes --start-graph-warmup`; report `.tmp/agent-workbench-tool-sweep-committed-sandboxes/mcp-tool-sweep-2026-06-11T05-51-39-772Z.json` covered 8 repos with 58 full, 51 partial, 57 degraded, 5 blocked, and 5 invalid results. `preview_workspace_edit` and `apply_workspace_edit` were full/ok on all eight sandbox copies. Invalids were FreeCAD `docs_search` and `check_markdown_document`, LibreChat `docs_search` and `check_markdown_document`, and CrealityPrint `check_markdown_document`; none were write-tool failures. |
| 2026-06-11 | Raw envelope RCA rerun for non-full results | Reran the same eight committed-tree sandboxes with `--include-raw`; report `.tmp/agent-workbench-tool-sweep-committed-sandboxes-raw/mcp-tool-sweep-2026-06-11T06-01-40-393Z.json` reproduced the same 58 full, 51 partial, 57 degraded, 5 blocked, and 5 invalid counts. RCA below records each non-full category as a root cause to fix or explicitly justify. |
| 2026-06-11 | Scanner-visible sweep input selection | Updated the harness to select Markdown, JSON, text, and validation-plan inputs from scanner-visible files instead of raw recursive filesystem listings; markdown quality calls now skip when no scanner-visible Markdown prerequisite exists. `pnpm test tests/mcp/debug-harness.test.ts` and `pnpm typecheck` passed. Eight-repo sandbox report `.tmp/agent-workbench-tool-sweep-committed-sandboxes-after-input-selection-final/mcp-tool-sweep-2026-06-11T06-16-13-585Z.json` improved the baseline to 64 full, 46 partial, 64 degraded, 0 blocked, and 2 invalid. The only remaining invalids are FreeCAD and LibreChat `docs_search` cold/missing FTS semantics. |
| 2026-06-11 | Docs search blocked FTS metadata correction | Changed `docs_search` blocked FTS metadata from invalid analysis to valid blocked evidence. `pnpm test tests/docs/query-docs.test.ts tests/mcp/docs-surfaces.test.ts tests/mcp/debug-harness.test.ts` and `pnpm typecheck` passed. Eight-repo sandbox report `.tmp/agent-workbench-tool-sweep-committed-sandboxes-after-docs-search-meta/mcp-tool-sweep-2026-06-11T06-33-34-341Z.json` returned 64 full, 46 partial, 64 degraded, 2 blocked, and 0 invalid results. The 2 blocked rows are expected `docs_search` missing/cold FTS evidence for FreeCAD and LibreChat. |

## Non-Full Result RCA

The product direction is that `partial` and `degraded` are last-resort states,
not normal success labels. Each non-full result should be traced to a root
cause and removed where the runtime can gather better evidence.

| Count | Labels | Root cause | Assessment | Fix direction |
| --- | --- | --- | --- | --- |
| 49 | partial | Scanner or result budget truncation, usually the 2,000-row catalog scan limit or small docs/tool result budgets in large repos. | Mostly implementation debt. These should not be accepted as normal; the runtime needs targeted scans for requested files/docs and compact summaries for broad skipped-path evidence. | Raise or route budgets only where justified; prefer targeted direct lookup for requested paths and compact skip summaries over returning partial broad results. |
| 20 | degraded | Graph coverage or query miss in `symbol_search`, `find_references`, and `impact`. Some sweeps selected symbols that were not indexed, and C++/C# coverage remains resource-backed or shallow. | Coverage gap. Treat as missing graph evidence unless the target language is explicitly unsupported. | Improve indexed-symbol selection from the warmed graph and add language coverage fixtures before accepting degraded graph output. |
| 15 | degraded | Status/scope/overview metadata reports `verification_status: needed` because skipped paths, partial-semantic evidence, or unsupported areas exist. | Classifier and metadata issue. Broad skipped-path facts should not degrade otherwise actionable orientation responses. | Separate attention items from result quality; only degrade when the missing evidence affects the requested answer. |
| 8 | degraded | Docs map/overview/outline/read-section include skipped-path warnings unrelated to the requested document result. | Classifier and presenter issue. Routine generated/hidden skips are being promoted into degraded quality. | Compact routine skip warnings and keep requested-path failures explicit. |
| 5 | degraded | `context_for_task` has no graph query ports wired in the sweep path, so ranked-symbol evidence is skipped. | Harness/runtime integration gap. | Wire graph query ports into context calls or record a precise unsupported capability instead of generic degraded output. |
| 4 | blocked | `verification_plan` was blocked because the harness selected hidden/generated files as changed files, then the scanner correctly excluded them. | Harness bug. Direct file discovery disagrees with scanner policy. | Build sweep facts from scanner-visible files, not raw recursive filesystem listings. |
| 3 | degraded | `diagnostics_for_files` had no applicable diagnostics provider or selected a file outside current provider coverage. | Coverage gap. | Select provider-covered files for sweep positives and add explicit no-provider coverage tests. |
| 3 | invalid | `check_markdown_document` selected markdown-like paths that the scanner could not validate, such as hidden/generated paths or `AGENTS.md`/root docs missed by the scanner budget. | Harness bug plus scanner coverage gap. | Build markdown sweep inputs from scanner-visible markdown files; treat `AGENTS.md`/repo instruction docs consistently if they are valid documentation targets. |
| 3 | degraded | Real markdown-quality findings, usually missing required frontmatter in external project docs. | Product finding, not runtime failure. The label may still be too harsh for a checker whose purpose is to report findings. | Classify successful quality checks with findings as full result quality plus findings, not degraded transport quality. |
| 2 | invalid | `docs_search` returned blocked cold FTS as `analysis_validity: invalid` when no markdown docs were indexed into the graph/docs FTS snapshot for FreeCAD and LibreChat. | Runtime semantics bug. Missing/cold docs FTS is a blocked evidence state, not invalid analysis. | Change docs search metadata to structured blocked or unsupported with actionable missing evidence; ensure graph warmup indexes docs independently of low symbol budgets. |
| 1 | blocked | `diagnostics_for_files` found a real blocking JSON syntax issue in One-Register caused by a UTF-8 BOM being passed to `JSON.parse`. | Likely provider bug unless BOM should be rejected intentionally. JSON with BOM is common enough that diagnostics should strip BOM before parsing or report a more precise encoding finding. | Add a BOM fixture and decide whether the JSON provider normalizes BOM or classifies it as encoding-specific. |

## Known Initial Findings

- `docs_search` now returns blocked, non-invalid output while docs FTS evidence
  is cold or missing. Further work remains to decide whether docs FTS warmup
  should index markdown independently of symbol warmup budgets.
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
  failures unless they affect MCP output semantics. Committed-tree sandboxes
  avoid this for broad baseline runs, but they intentionally omit uncommitted
  local-only files.
- Workspace-write behavior on real external repository shapes requires a
  sandbox copy. Running write-capable tools against original external
  repositories is out of bounds for this spec.
- Contract enum changes could affect downstream agents, so semantic changes
  must be reflected in durable docs before closure.
