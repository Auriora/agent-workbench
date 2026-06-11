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
| 2026-06-11 | Sweep `needed` quality classifier correction | Changed the harness classifier so `verification_status: needed` remains an action state in the envelope but no longer downgrades successful, complete results to degraded sweep quality. `pnpm test tests/mcp/debug-harness.test.ts` and `pnpm typecheck` passed. Eight-repo sandbox report `.tmp/agent-workbench-tool-sweep-committed-sandboxes-after-needed-quality/mcp-tool-sweep-2026-06-11T06-42-53-083Z.json` returned 126 full, 46 partial, 2 degraded, 2 blocked, and 0 invalid results. The 2 remaining degraded rows are FreeCAD markdown-quality skipped prerequisites caused by no scanner-visible Markdown under the current scan budget. |
| 2026-06-11 | Catalog scan budget partial/degraded reduction | Raised normal runtime scan and docs/context request budgets for large committed-tree sandbox repositories while keeping graph warmup bounded. `pnpm test tests/runtime/orientation-budget.test.ts tests/runtime/orientation-golden.test.ts tests/integration/usage-informed-mvp.test.ts tests/docs/query-docs.test.ts tests/docs/markdown-quality.test.ts tests/mcp/debug-harness.test.ts` and `pnpm typecheck` passed. Eight-repo sandbox report `.tmp/agent-workbench-tool-sweep-committed-sandboxes-after-row-limit-bounded-graph/mcp-tool-sweep-2026-06-11T07-00-20-829Z.json` returned 161 full, 13 partial, 0 degraded, 2 blocked, and 0 invalid results. Remaining partial rows are docs list/section budget truncation in TimeLocker, aws-datalake, OneMount, and one CrealityPrint reference truncation. The 2 blocked rows remain FreeCAD and LibreChat `docs_search` cold/missing FTS evidence under bounded graph warmup. |
| 2026-06-11 | Direct requested docs reads | Changed `docs_outline` and `docs_read_section` to validate the requested path through the scanner and then read the requested Markdown file directly, so broad docs-map truncation no longer makes requested-path results partial. Raised the sweep harness docs-read byte budget to avoid manufacturing clipped-section partials. `pnpm test tests/docs/query-docs.test.ts tests/mcp/docs-surfaces.test.ts tests/mcp/debug-harness.test.ts` and `pnpm typecheck` passed. Focused committed-tree subset report `.tmp/agent-workbench-tool-sweep-committed-sandboxes-after-direct-doc-reads-subset-2/mcp-tool-sweep-2026-06-11T07-10-51-234Z.json` covered TimeLocker, aws-datalake, and OneMount with 60 full, 6 partial, 0 degraded, 0 blocked, and 0 invalid results. The 6 remaining subset partials are only `docs-overview` and `docs-map` broad list caps. A full eight-repo rerun did not write a report because the PTY session went stale after the process exited, so this row is focused/subset evidence only. |
| 2026-06-11 | Pagination, reference truncation, and docs FTS warmup split | Added cursor-backed pagination to docs overview/map and `find_references`; the sweep classifier now treats cursor-backed truncated responses as complete pages. Fixed graph query metadata so catalog language sampling does not mark graph answers partial, and changed `find_references` to use max-plus-one result evidence before setting `truncated`. Split graph warmup scan and extraction limits so docs FTS can index Markdown across the larger scan window while symbol extraction remains bounded. `pnpm test tests/docs/query-docs.test.ts tests/mcp/docs-surfaces.test.ts tests/graph/query-tools.test.ts tests/graph/extraction-pipeline.test.ts tests/mcp/debug-harness.test.ts`, `pnpm test tests/graph/query-tools.test.ts tests/mcp/query-tools.test.ts`, and `pnpm typecheck` passed. Timelocker no-warmup pagination sweep `.tmp/agent-workbench-tool-sweep-timelocker-pagination-no-warmup/mcp-tool-sweep-2026-06-11T07-42-16-383Z.json` showed docs overview/map as full cursor-backed pages. Direct FreeCAD and LibreChat docs-index checks returned usable docs FTS states with `blocked: false`; direct CrealityPrint reference check returned `truncated: false` with zero references. Multi-repo warmup sweep attempts did not write reports due a recurring stale PTY/process-report issue and need separate harness reliability follow-up. |
| 2026-06-11 | Sweep progress report reliability | Added deterministic `mcp-tool-sweep-progress.json` flushing under the sweep output directory. The progress report is written before the final timestamped report and includes `running`/`complete`/`failed` state, cumulative results, quality summary, and phase events for sweep, repo, warmup, discovery, resource, and tool calls. `pnpm test tests/mcp/debug-harness.test.ts` passed with a regression that forces an unreadable sandbox file to make `preview_workspace_edit` fail while still recording the failed tool event and invalid summary in the progress report. `pnpm typecheck` passed. Fixture warmup sweep `.tmp/agent-workbench-tool-sweep-t009-progress/` wrote both the progress report and final report with 22 full, 0 partial, 0 degraded, 0 blocked, and 0 invalid results. Bounded committed-sandbox warmup sweep `.tmp/agent-workbench-tool-sweep-t009-committed-subset/` across TimeLocker and LibreChat completed cleanly with 44 full, 0 partial, 0 degraded, 0 blocked, and 0 invalid results; the stale PTY/missing-report condition was not reproduced after reload and is currently classified as historical terminal/PTY observation risk unless a future progress report shows process failure before final report write. |
| 2026-06-11 | Fresh eight-repo committed-sandbox sweep | Created fresh committed-tree sandboxes under `.tmp/tool-sweep-sandboxes-committed-t010/` from each original repository with `git archive HEAD`, keeping target repositories read-only and excluding `.git`, ignored/generated files, dependency folders, caches, and uncommitted local changes by construction. Ran `pnpm debug:mcp-tool-sweep -- --repo ... --output-dir .tmp/agent-workbench-tool-sweep-t010-full --start-graph-warmup`. Final report `.tmp/agent-workbench-tool-sweep-t010-full/mcp-tool-sweep-2026-06-11T10-03-36-626Z.json` covered all eight repos and 176 rows with 176 full, 0 partial, 0 degraded, 0 blocked, and 0 invalid results. The progress report state was `complete`. `preview_workspace_edit` and `apply_workspace_edit` were full/ok for all eight sandbox copies only. There are no remaining non-full rows in the current dogfood report. |

## Non-Full Result RCA

The product direction is that `partial` and `degraded` are last-resort states,
not normal success labels. Each non-full result should be traced to a root
cause and removed where the runtime can gather better evidence.

| Latest / prior | Labels | Root cause | Assessment | Fix direction |
| --- | --- | --- | --- | --- |
| 0 / 49 | partial | Prior result-budget truncation after raising normal runtime catalog scan budgets. Earlier reports had docs list/section partials in TimeLocker, aws-datalake, and OneMount plus one CrealityPrint reference truncation. | Resolved in the fresh eight-repo committed-sandbox sweep: docs overview/map now have cursor-backed pagination and cursor-backed truncation is classified as a complete page; `find_references` now distinguishes real omitted result rows from catalog metadata sampling. | No current follow-up from dogfood. Keep pagination and max-plus-one reference regressions in the focused tests. |
| 0 / 20 | degraded | Graph coverage or query miss in `symbol_search`, `find_references`, and `impact`. Some sweeps selected symbols that were not indexed, and C++/C# coverage remains resource-backed or shallow. | Improved by scanner-visible input selection and current sweep inputs, but coverage remains a risk for future language fixtures. | Improve indexed-symbol selection from the warmed graph and add language coverage fixtures before accepting degraded graph output. |
| 0 / 15 | degraded | Status/scope/overview metadata reported `verification_status: needed` because skipped paths, partial-semantic evidence, or unsupported areas existed. | Classifier and metadata issue addressed for current sweep quality. Broad attention items should not degrade otherwise actionable orientation responses. | Keep attention items separate from result quality; still add explicit no-coverage status tests before closing T004. |
| 0 / 8 | degraded | Docs map/overview/outline/read-section included skipped-path warnings unrelated to the requested document result. | Current sweep no longer reports these as degraded, but remaining docs partials show the broad docs-list dependency still needs targeted lookup. | Compact routine skip warnings and keep requested-path failures explicit. |
| 0 / 5 | degraded | `context_for_task` had no graph query ports wired in the sweep path, so ranked-symbol evidence was skipped. | Current sweep quality improved after request-budget changes, but graph-backed context remains a coverage area. | Wire graph query ports into context calls or record a precise unsupported capability instead of generic degraded output. |
| 0 / 4 | blocked | `verification_plan` was blocked because the harness selected hidden/generated files as changed files, then the scanner correctly excluded them. | Harness bug fixed by building facts from scanner-visible files. | Keep sweep facts scanner-visible; add regression fixtures when new file-selection paths are introduced. |
| 0 / 3 | degraded | `diagnostics_for_files` had no applicable diagnostics provider or selected a file outside current provider coverage. | Current sweep selects provider-covered JSON files. | Select provider-covered files for sweep positives and add explicit no-provider coverage tests. |
| 0 / 3 | invalid | `check_markdown_document` selected markdown-like paths that the scanner could not validate, such as hidden/generated paths or `AGENTS.md`/root docs missed by the scanner budget. | Harness bug plus scanner coverage gap fixed for current sweep by scanner-visible markdown selection and the higher catalog budget. | Keep markdown sweep inputs scanner-visible; treat `AGENTS.md`/repo instruction docs consistently if they are valid documentation targets. |
| 0 / 3 | degraded | Real markdown-quality findings, usually missing required frontmatter in external project docs. | Product finding, not runtime failure; fixed by classifying successful quality checks with findings as full result quality plus findings. | Preserve this classifier distinction in checker-result tests. |
| 0 / 2 | blocked | `docs_search` returned blocked cold/missing FTS evidence when no markdown docs were indexed into the graph/docs FTS snapshot for FreeCAD and LibreChat under bounded graph warmup. | Resolved in the fresh eight-repo committed-sandbox sweep: graph warmup scanned enough files for docs FTS while bounding symbol extraction separately, and FreeCAD/LibreChat docs search rows were full. | No current follow-up from dogfood. Keep blocked cold-index metadata coverage because it remains the correct state if FTS evidence is genuinely unavailable. |
| 0 / 1 | blocked | `diagnostics_for_files` found a real blocking JSON syntax issue in One-Register caused by a UTF-8 BOM being passed to `JSON.parse`. | No longer present in the latest sweep, but still likely provider debt unless BOM should be rejected intentionally. | Add a BOM fixture and decide whether the JSON provider normalizes BOM or classifies it as encoding-specific. |

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
- Graph warmup timing may make dogfood results nondeterministic. The sweep
  progress report now records warmup start/completion/failure evidence, but it
  does not prevent a host-level process kill before the next flush.
- A terminal/PTY session can still become stale independently of the sweep
  process. Classify future cases from artifacts: a `complete` progress report
  plus final report is clean exit with report; a `complete` progress report
  without a final report is clean exit before final write or final write
  failure; a `failed` progress report is thrown error before final report; a
  `running` progress report with the process gone is process kill or terminal
  observation issue depending on host process evidence; no progress report means
  startup failure before harness initialization.
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
