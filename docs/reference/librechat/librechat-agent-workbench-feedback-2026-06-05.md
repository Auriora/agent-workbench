---
title: LibreChat Agent Workbench Feedback - 2026-06-05
doc_type: reference
status: draft
owner: platform
last_reviewed: 2026-06-05
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# LibreChat Agent Workbench Feedback - 2026-06-05

## Scope

Repository tested: `/home/bcherrington/Projects/Webstorm/LibreChat`

I exercised the Agent Workbench MCP resources and tools from Codex against LibreChat without intentionally editing the LibreChat checkout. The repo contains unreadable runtime/data directories owned by `nobody`, which are important to the observed behavior:

- `data-node/diagnostic.data` is mode `700`, owner `nobody:nogroup`
- `data-node/journal` is mode `700`, owner `nobody:nogroup`

## Agent Workbench Results

### What Worked

- `integration:///profiles/codex` returned a useful and well-structured profile. It clearly explains the active Codex surfaces, wrapper/plugin model, update model, MCP bindings, hooks, and guardrails.
- `repo:///status` returned a structured degraded/cold state instead of failing completely. It named the root cause: `EACCES: permission denied, scandir '/home/bcherrington/Projects/Webstorm/LibreChat/data-node/diagnostic.data'`.
- Tool discovery exposed `context_for_task` and `verification_plan`, and the integration profile documented additional intended surfaces such as symbol search, references, impact, preview/apply edit, and verification planning.

### What Did Not Work

- `repo:///scope` failed outright with the same `EACCES` instead of returning a structured degraded packet.
- `repo:///overview` failed outright with the same `EACCES` instead of returning a structured degraded packet.
- `mcp__agent_workbench.context_for_task` failed outright with the same `EACCES`.
- `mcp__agent_workbench.verification_plan` failed outright with the same `EACCES`.
- The Codex-discoverable Agent Workbench tool surface only exposed `context_for_task` and `verification_plan`, while `integration:///profiles/codex` advertised more MCP bindings: `symbol_search`, `find_references`, `impact`, `preview_workspace_edit`, and `apply_workspace_edit`. Either the profile is ahead of the registered surface, or discovery is not exposing the full toolset.

### Main Agent Workbench Issue

The workbench appears to recursively scan repository children without robustly skipping unreadable directories. In a real application checkout, unreadable data directories are normal enough that this should not block orientation, task context, or validation planning. The status resource handled the error better than the other resources/tools, but even status reported `skipped_roots: []`, which makes it look as if nothing was excluded despite the permission problem.

Recommended behavior:

- Treat unreadable directories as skipped paths, not fatal errors, unless the requested target is inside that path.
- Report skipped unreadable paths in `skipped_roots` or a dedicated `skipped_paths` field with the reason.
- Keep `scope`, `overview`, `context_for_task`, and `verification_plan` available in degraded mode.
- Honor `.gitignore` and common data/cache exclusions early enough that runtime data folders do not break repo scans.

## Python Agent IDE Comparison

I also tested the broader Python Agent IDE surface available in the session to separate repo-specific problems from runtime behavior.

### What Worked

- `repo_preflight` returned quickly with valid trust metadata and correctly identified the repo root and package manager as `npm`.
- It detected JS/TS project config files and useful package scripts from `package.json`, `api/package.json`, `client/package.json`, and `packages/api/package.json`.
- `repo_safe_search` worked well for broad lexical search. Searching `Login` returned relevant LibreChat paths such as:
  - `e2e/setup/authenticate.ts`
  - `packages/data-provider/src/types.ts`
  - `packages/data-provider/src/api-endpoints.ts`
  - `packages/data-provider/src/data-service.ts`
  - `packages/data-provider/src/config.ts`
  - `api/server/controllers/AuthController.js`
- `context_for_task` produced some useful routing candidates for auth/login work, including `api/server/controllers/AuthController.js`, `api/server/services/AuthService.js`, `api/strategies/openidStrategy.js`, and `api/server/routes/oauth.js`.
- The outputs consistently included trust metadata, freshness, limitations, and next-step guidance. That is good for agent discipline.

### What Did Not Work Well

- `repo_preflight`, `repo:///status`, and `repo:///overview` classified the repo primarily as Python because of `utils/update_env.py`, even though LibreChat is predominantly JavaScript/TypeScript.
- Semantic/indexed navigation was effectively limited to the Python root `utils`. `find_symbol("Login")` returned zero results despite many JS/TS login-related files.
- `orient_repo` for “LibreChat TypeScript React Express monorepo architecture and validation commands” returned only `utils/update_env.py` and had low confidence. That is technically honest, but not useful for this repo.
- `context_for_task` mixed relevant auth files with noisy candidates such as `api/server/services/MCP.js`, `api/server/services/Tools/mcp.js`, `packages/api/src/flow/manager.ts`, and `api/app/clients/prompts/artifacts.js`. The ranking appears overly influenced by broad token overlap instead of repo structure, route/controller/service conventions, and package boundaries.
- `verification_plan` returned zero recommended checks for concrete JS/TS files, even though `repo_preflight` and `context_for_task` had already found package scripts like `npm run lint`, `npm run test`, `npm run typecheck`, `npm run test:api`, and `npm run test:client`.
- `run_nearest_tests` is pytest-oriented and suggested a Python smoke path for a TypeScript file, which is not useful for LibreChat.
- Some path previews redacted ordinary URL substrings as `<outside-repo>`, for example in `repo_safe_search` output around login endpoints and Playwright URLs. That makes previews harder to read and can obscure the exact match context.

## Experience Notes

The most useful part of the experience was the consistent trust metadata: `analysis_validity`, `freshness`, `confidence`, `partial_reasons`, `verification_status`, and explicit limitations. That helped avoid over-trusting weak routing output.

The least useful part was that the Agent Workbench surface itself failed before it could provide task context, while the companion runtime degraded but treated LibreChat as a Python project. For a JS/TS monorepo, I still needed shell `rg`, direct file reads, and manual interpretation to do real work.

The workbench would be much more valuable on LibreChat if it provided a repo-wide resource-backed mode for JS/TS even when semantic indexing is incomplete. Lexical search plus package-script-aware validation planning would already be enough to help a coding agent.

## Concrete Improvements Requested

1. Make unreadable directories non-fatal and visible as skipped paths.
2. Align the advertised MCP bindings in `integration:///profiles/codex` with the tools actually exposed to Codex discovery.
3. Add first-class JS/TS repo classification so one incidental Python script does not dominate orientation.
4. Index JS/TS symbols, exports, imports, and test files, or clearly report that semantic coverage is unavailable for those languages.
5. Make validation planning package-manager-aware for JS/TS files. For LibreChat, useful defaults would include root `npm run lint`, `npm run test:client`, `npm run test:api`, `client` `npm run typecheck`, and package-local `npm run test` where applicable.
6. Improve task-context ranking for common web app structures: routes, controllers, services, strategies, data-provider API endpoints, React auth pages/components, and e2e auth setup.
7. Avoid redacting normal in-repo string snippets such as URL paths as `<outside-repo>` unless they are actually filesystem paths outside the repo.
8. Consider exposing a simple “why this file ranked here” explanation with actual matched snippets for each implementation candidate. Some candidates had no excerpts, which made the ranking hard to trust.
9. Provide a clean degraded-mode contract for each resource/tool: what evidence was skipped, what is still trustworthy, and what the agent should do next.
10. Avoid recommending Python-specific tools such as pytest for non-Python targets unless Python tests are actually discovered near the target.

## LibreChat Repo Side Effects Observed

After testing, `git status --short` in LibreChat showed:

```text
?? .cache/
?? simple-ca-root.crt
```

I did not intentionally edit LibreChat files. The untracked `.cache/` is likely from the agent/runtime indexing surface, but I did not remove it because the instruction was not to make changes and I do not know whether it existed before this test. `simple-ca-root.crt` was also untracked and pre-existing from the perspective of this run.
