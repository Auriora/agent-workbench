---
title: Compiled stdio runtime research
doc_type: spec
artifact_type: research
status: draft
owner: platform
last_reviewed: 2026-07-30
---

# Research

## Scope

Determine how to reduce the per-process cost of valid provider-retained stdio
bridges without unsafe task-state inference or idle termination.

## Findings

1. A live repository-local bridge used 93,916 KiB RSS, loaded no native module,
   and remained transport-connected.
2. On the same host, bare idle Node used 42,128 KiB RSS while registering
   `tsx/esm/api` used 93,164 KiB. The loader accounts for nearly all observed
   bridge overhead beyond baseline Node in this comparison.
3. A completed Codex subagent retained an open bridge because the parent kept
   stdin open. Root and subagent bridge environments were identical.
4. Killing only the completed probe bridge did not prevent the same subagent
   from later reaching Agent Workbench through the surviving session, but that
   does not establish a general safe idle-reaping contract.
5. The current bridge's daemon client resolves
   `./daemon-entrypoint.mjs` relative to `import.meta.url`; sibling compiled
   bridge and daemon outputs preserve this invariant.
6. npm runs `prepack` before tarball creation, and its `files` array controls
   generated payload inclusion.
7. esbuild supports named multiple entrypoints, Node platform, explicit ESM
   output, bundling, and package externalization.
8. Codex configuration changed from `agents.max_threads = 10` to `6` and
   `agents.max_depth = 1` during investigation. Current Codex documentation
   defines `max_threads` as a legacy alias for the cap on concurrently open
   spawned-agent threads, excluding the primary. Live work showed subagent
   activity creates or retains additional MCP bridge connections, so this
   configuration is a cardinality driver rather than an Agent Workbench leak.
9. Installed-package smoke exposed that the daemon graph refresh runs in a
   separately spawned worker whose URL is relative to `import.meta.url`.
   Compiling only the bridge and daemon therefore leaves installed refresh cold;
   the build must also preserve the worker's `dist/workers/` relative path.

## Options Considered

| Option | Decision | Rationale |
|--------|----------|-----------|
| Generic bridge or daemon idle timeout | rejected | No trustworthy task-completion signal; can sever a valid quiescent main or reusable subagent session. |
| Provider/process scavenger | rejected | Heuristic ownership masks the client lifecycle defect and is unsafe cross-platform. |
| Handwritten JavaScript bridge | rejected | Duplicates runtime behavior and violates the one-path constraint. |
| Node native TypeScript execution | rejected | Existing `.js` specifiers do not resolve TypeScript sources directly, and Node 22 remains supported. |
| Package-only compiled bridge | rejected | Creates checkout/package behavior split and leaves repository-local testing on the expensive path. |
| Compiled sibling bridge and daemon artifacts used by every distributed surface | recommended | Removes `tsx` from retained bridges while preserving daemon sibling lookup and source authority. |
| Pool independent stdio bridges inside Agent Workbench | deferred | A stdio process owns one stdin/stdout stream. Eliminating bridge processes requires a provider-supported shared transport, such as a separately designed streamable HTTP service; an internal broker would still require one stdio shim per Codex connection. |

## Tradeoffs

Compilation adds a build artifact and packaging gate. The cost is justified only
if all distribution paths converge on it and parity validation prevents stale
output. External package imports keep the bundle smaller and leave native
dependencies owned by the daemon's installed dependency graph.

## Sources

- Direct process, `/proc`, module-map, and environment evidence from
  2026-07-30.
- Spec 045 source, tests, durable docs, and verification.
- npm CLI lifecycle and package-files documentation.
- esbuild JavaScript API documentation.
- Current Codex manual configuration and multi-agent sections, plus the
  operator-supplied configuration change and live process observations.

## Confidence and Unknowns

- **Confidence:** high for `tsx` attribution on this host and current launch
  topology; medium for cross-platform memory improvement magnitude.
- **Known unknowns:** exact Windows/macOS RSS, the precise mapping between every
  Codex thread state and retained MCP transport, and whether a future shared
  HTTP MCP topology can preserve dynamic repository-root authority.
- **Evidence gaps:** installed compiled candidate and cross-platform CI evidence
  do not exist until implementation.

## Recommendation

Build and distribute compiled stdio, daemon, and daemon-worker ESM entrypoints.
Keep TypeScript source authoritative, prohibit runtime fallback, update all
launch surfaces together, and validate source/package parity. Treat configured
agent concurrency as aggregate capacity evidence, not a reason to reap valid
bridges.

## Related Artifacts

- Requirements: `requirements.md`
- Design: `design.md`
- Tasks: `tasks.md`
