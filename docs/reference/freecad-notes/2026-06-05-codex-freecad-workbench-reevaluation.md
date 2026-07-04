---
title: FreeCAD Agent Workbench Re-evaluation - Codex - 2026-06-05
doc_type: reference
status: draft
owner: platform
last_reviewed: 2026-06-05
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# FreeCAD Agent Workbench Re-evaluation - Codex - 2026-06-05

Repository tested: `/home/bcherrington/Projects/CLion/FreeCAD`
Mode: read-only re-evaluation after reported Agent Workbench changes. No FreeCAD repo changes were applied.
Previous note: `2026-06-05-codex-freecad-workbench-test.md`

## Summary

The changes are a real improvement for file-seeded FreeCAD workflows. The workbench now recognizes C++ headers and implementation files as `cpp`, classifies `.pyi` stubs as Python, finds local sibling files, local CMake files, and nearby test files, and can return useful heuristic C++ symbol hits for terms such as `mustExecute` and `recompute`.

The main remaining problems are broad task routing, status/overview consistency, validation specificity, and graph traversal. The tool is now useful as a heuristic context assistant when the agent already knows relevant files, but it is still not reliable as the primary source of truth for a broad FreeCAD C++ task.

## Improvements Observed

- `repo:///scope` is now fresh and includes improved language counts. It reports `cpp`, `python`, `typescript`, `json`, `markdown`, `yaml`, `shell`, `config`, `text`, and `c`.
- Header and implementation classification improved. `src/App/DocumentObject.cpp` and `src/App/DocumentObject.h` are now `cpp` with `resource_backed`/`heuristic` evidence instead of unsupported/text.
- Python stub classification improved. `src/App/DocumentObject.pyi` and related `.pyi` files are now `python` with parser evidence.
- File-seeded `context_for_task` is much better. Given `src/App/DocumentObject.cpp` and `.h`, it now surfaces:
  - `src/App/DocumentObject.pyi` as a same-stem sibling.
  - `src/App/CMakeLists.txt` as an adjacent local build file.
  - `src/App/FeatureTest.cpp`, `src/App/FeatureTest.h`, and `src/App/FreeCADTest.py` as nearby tests.
  - Related `DocumentObject*` implementation, header, stub, and Python binding files.
- Symbol extraction is substantially better. `symbol_search` now finds C++-ish symbols and snippets for `mustExecute`, `recompute`, includes of `App/DocumentObject.h`, and methods such as `Document::_recomputeFeature`.
- Validation planning improved from blocked to planned. For `DocumentObject` C++ files plus `src/App/CMakeLists.txt`, `verification_plan` now emits a `manual_review cmake-build-test` item and correctly identifies CMake/C++ as the primary validation path.
- The new caveats in `repo:///scope` are useful. They explicitly warn about unsupported coverage and missing optional enrichment.

## Still Problematic

- `repo:///status` still reports `capability_level: unsupported`, `languages: []`, and no adapter coverage, while `repo:///scope` reports partial coverage, fresh state, languages, and heuristic/parser evidence. The first resource in the recommended workflow still gives a misleading trust signal.
- `repo:///overview` still identifies only the `node` platform and still recommends `pnpm typecheck` and `pnpm test`. That remains misleading for FreeCAD’s main CMake/C++/Python validation path.
- Broad `context_for_task` remains noisy. A broad prompt about FreeCAD `DocumentObject` recompute behavior still returns many third-party files and tests, including GSL, FastSignals, lru-cache, salomesmesh, Clipper2, and third-party README docs before the primary `src/App` implementation files.
- Governing docs are still weak. For `DocumentObject` work, third-party README files are ranked as governing docs instead of project-level build/test/contribution docs or local `src/App` context.
- Heuristic C++ symbol extraction is useful but imprecise. It sometimes treats macro calls, call sites, `if` statements, or declarations as functions/methods. Example: `if (It->isTouched() || It->mustExecute() == 1)` was returned as a function named `if`.
- `symbol_search DocumentObject` still does not primarily return a `DocumentObject` class definition. It returns macros/call sites and include nodes first, which are useful as routing evidence but not ideal for semantic navigation.
- `find_references` still returns no references for symbols tested (`mustExecute`, `Document::_recomputeFeature`) even when symbol search finds candidate nodes.
- `impact` still finds only the start node/file with zero edges and low confidence. It remains unavailable for real blast-radius estimation in this repo.
- `preview_workspace_edit` still works as a non-mutating preview, but its changed-file metadata classified `src/App/DocumentObject.cpp` as `text`/unsupported, unlike context and scope, which classify it as C++.
- `verification_plan` now detects CMake conceptually, but the planned command is `manual_review cmake-build-test` rather than a concrete command. Its reason cited unrelated third-party CMake files before the explicitly supplied `src/App/CMakeLists.txt`.

## Current Practical Use

Good for:

- Quick read-only repo inventory.
- File-seeded context gathering.
- Finding nearby sibling files, local CMake files, and likely nearby tests.
- Heuristic C++ identifier search with source snippets.
- Non-mutating edit preview metadata.
- Honest caveats when evidence is incomplete.

Not yet good for:

- Starting from a broad FreeCAD C++ task with no file hints.
- Trustworthy C++ reference lookup.
- C++ graph impact / blast-radius estimation.
- Concrete validation command planning for FreeCAD.
- Ranking FreeCAD first-party source above third-party/vendor material in broad tasks.

## Recommended Next Improvements

- Align `repo:///status` with the richer scope result, or make it explicitly say it is only runtime status and not coverage status.
- Add repo-shape scoring that heavily prioritizes first-party source roots (`src/App`, `src/Base`, `src/Gui`, `src/Mod`, `tests/src`) over `src/3rdParty` for implementation prompts unless third-party code is explicitly named.
- Improve broad task routing by weighting exact domain terms (`DocumentObject`, `recompute`, `mustExecute`) in source text/symbols more heavily than generic path terms like `tests`, `engine`, or `find`.
- Make overview detect root `CMakeLists.txt` and `tests/CMakeLists.txt` as primary platform evidence despite an incidental `package.json`.
- Make `verification_plan` produce concrete suggested commands or at least repo-specific command templates, for example CMake build/test target suggestions tied to `src/App` and `tests/src/App`.
- Improve heuristic C++ symbol typing so statements and macro calls are distinguished from declarations/definitions.
- Add reference/impact edges for includes and same-file call relationships as an interim step, clearly marked heuristic, until richer compiler/LSP evidence is available.
- Keep metadata language classification consistent across `context_for_task`, `symbol_search`, and `preview_workspace_edit`.

## Checks Re-run

- Read Agent Workbench skill guidance.
- Confirmed FreeCAD `git status --short` was clean before testing.
- Read `repo:///status`, `repo:///scope`, `repo:///overview`, and `integration:///profiles/codex`.
- Re-ran broad `context_for_task` for FreeCAD `DocumentObject` recompute behavior.
- Re-ran file-seeded `context_for_task` for `src/App/DocumentObject.cpp` and `src/App/DocumentObject.h`.
- Re-ran `verification_plan` with `src/App/DocumentObject.cpp`, `src/App/DocumentObject.h`, and `src/App/CMakeLists.txt`.
- Re-ran `symbol_search` for `DocumentObject`, `mustExecute`, and `recompute`.
- Re-ran `find_references` for `mustExecute` and `Document::_recomputeFeature`.
- Re-ran `impact` for `Document::_recomputeFeature`.
- Re-ran `preview_workspace_edit` without applying it.
