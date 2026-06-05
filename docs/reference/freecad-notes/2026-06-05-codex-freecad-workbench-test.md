---
title: FreeCAD Agent Workbench Test - Codex - 2026-06-05
doc_type: reference
status: draft
owner: platform
last_reviewed: 2026-06-05
---

# FreeCAD Agent Workbench Test - Codex - 2026-06-05

Repository tested: `/home/bcherrington/Projects/CLion/FreeCAD`
Mode: read-only exploration of the FreeCAD checkout. No repo changes were applied.

## What Worked

- The expected Agent Workbench resources were available: `repo:///status`, `repo:///scope`, `repo:///overview`, and `integration:///profiles/codex`.
- Resource responses were fast and structured with useful metadata fields: `analysis_validity`, `freshness`, `scope`, `capability_level`, `verification_status`, `truncated`, and row-budget information.
- `repo:///scope` gave a useful high-level inventory for this checkout: C, C++, Python, YAML, Markdown, JSON, TOML, shell, config, and text categories, plus skipped generated/vendor roots.
- `context_for_task` was useful once seeded with explicit files. For `src/App/DocumentObject.cpp` and `src/App/DocumentObject.h`, it correctly found the nearby `DocumentObject*` implementation family.
- `symbol_search` can work as bounded resource/file search. Searching `DocumentObject` found `src/App/DocumentObject.h`, `.pyi`, and related headers/stubs with source snippets when requested.
- `impact` reported low confidence instead of overstating graph coverage when no parser-backed edges were available.
- `verification_plan` blocked rather than inventing validation when evidence was insufficient.
- `preview_workspace_edit` returned a preview token, base/after hashes, and change metadata without mutating the repo. `git status --short` remained clean afterward.
- The integration profile is useful for understanding the intended Codex surfaces, packaging model, and guardrails.

## What Did Not Work Well

- `repo:///status` reported `capability_level: unsupported` and `languages: []`, while `repo:///scope` and `repo:///overview` reported partial semantic/resource-backed coverage and many languages. That mismatch makes the first-call trust signal confusing.
- `repo:///overview` detected `package.json` and inferred Node validation (`pnpm typecheck`, `pnpm test`) for FreeCAD. In this checkout that is misleading; the project is primarily CMake/C++/Python, and `package.json` appears to be incidental for tooling rather than the main validation surface.
- Broad `context_for_task` routing was poor for FreeCAD. A prompt about `DocumentObject` recompute behavior returned mostly unrelated CMake Find modules, Windows installer docs, third-party README files, and JT test fixture paths.
- Even with explicit C++ files, C++ semantic coverage was effectively unavailable: `.cpp` files were often `unsupported`, `.h` files were classified as `text`, and `.pyi` files were also classified as `text` despite Python-like contents.
- `symbol_search` could not find method/function terms such as `mustExecute` or `recompute`, even though those are plausible FreeCAD code identifiers. It behaved like resource-name search rather than source symbol search for C++.
- `find_references` returned no references for `DocumentObject`, even after `symbol_search` found a matching resource node.
- `impact` on `DocumentObject.h` only returned the starting file with zero edges, so it is not yet useful for C++ blast-radius estimation in this repo.
- `verification_plan` could not plan CMake/build/test commands even when provided `src/App/DocumentObject.cpp`, `src/App/DocumentObject.h`, and `src/App/CMakeLists.txt`.
- Tool discoverability was uneven in Codex. Initial discovery exposed only `context_for_task` and `verification_plan`; `symbol_search`, `find_references`, `impact`, and workspace edit tools appeared only after a more specific tool search. The integration profile advertised them, but they were not obvious in the first tool list.
- The `context_for_task` `next_actions` recommended tools such as `symbol_search`, `find_references`, and `impact`; if those are not immediately exposed to the agent, the workflow feels broken even though the tools exist.

## Experience Notes

- The workbench is good at being honest about low confidence. That is valuable. It consistently surfaced caveats, truncation, blocked validation, and routing-evidence-only warnings.
- As an orientation layer for a large C++ monorepo, it currently needs explicit file hints to be useful. Without hints, the row-limited catalog and path-term matching produce noisy candidates.
- The strongest current value in this repo is structured guardrails and non-mutating edit preview, not semantic navigation.
- I would not rely on the workbench alone to make FreeCAD source changes yet. I would still use `rg`, direct source reads, CMake inspection, and project-specific build knowledge.

## Improvements Requested

- Make `repo:///status` consistent with `repo:///scope`; if the repo has partial coverage, status should not look fully unsupported with no languages.
- Improve language classification for common C++ repository files: `.h`, `.hpp`, `.hxx`, `.cpp`, `.cxx`, and Python stubs `.pyi`.
- Add or expose C++ parser-backed symbols at least for classes, methods, functions, includes, and CMake target membership.
- Teach validation discovery to prioritize CMake in repositories with root `CMakeLists.txt`, `tests/CMakeLists.txt`, and C++ source trees. Incidental `package.json` should not dominate validation hints.
- Add repository-shape heuristics to down-rank generated/test fixture data files and third-party vendored docs for implementation tasks unless the task mentions them.
- When a task includes known files, use local directory CMake files and nearby tests as first-class validation and context evidence.
- Ensure all advertised MCP tools are discoverable in the initial Codex tool-discovery path, or make `next_actions` only reference tools that are definitely visible.
- Consider returning a direct `confidence_reason` for broad context rankings, especially when candidates are selected only by path-term matches.
- Provide a lightweight repo-specific configuration surface for primary build/test commands and validation priorities.

## Commands/Checks Run

- Read Agent Workbench skill guidance.
- Read `repo:///status`, `repo:///scope`, `repo:///overview`, and `integration:///profiles/codex`.
- Ran `context_for_task` for broad C++ DocumentObject/recompute work.
- Ran `context_for_task` for Python-facing command/workbench behavior.
- Ran `context_for_task` seeded with `src/App/DocumentObject.cpp` and `src/App/DocumentObject.h`.
- Ran `verification_plan` for C++ `DocumentObject` changes, with and without `src/App/CMakeLists.txt`.
- Ran `symbol_search` for `DocumentObject`, `mustExecute`, and `recompute`.
- Ran `find_references` for `DocumentObject`.
- Ran `impact` on the `DocumentObject.h` resource node.
- Ran `preview_workspace_edit` against `src/App/DocumentObject.cpp` and did not apply the preview.
- Verified `git status --short` was clean afterward.
