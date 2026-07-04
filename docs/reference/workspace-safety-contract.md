---
title: Workspace safety contract
doc_type: reference
status: draft
owner: platform
last_reviewed: 2026-07-04
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Workspace Safety Contract

## Purpose

Define the minimum safety rules for a local-first Agent IDE runtime. The goal is
not enterprise security; it is predictable local workspace behavior that agents
can trust.

## Scope

This contract covers path containment, command execution, environment handling,
network behavior, credential redaction, generated writes, and MCP tool
capability gates.

## Path Containment

- Runtime operations are scoped to one launched repo root.
- Normal agent-facing MCP resources and tools must use the launched repo root.
  Caller-supplied `repo_root` request fields are blocked unless Agent Workbench
  is running in explicit maintainer debug override mode.
- Debug repo-root override mode is enabled only by
  `AGENT_WORKBENCH_DEBUG_REPO_ROOT_OVERRIDE=1` and is for local diagnostics,
  fixture work, and Agent Workbench maintainer testing. It is not public
  multi-repo runtime support.
- All requested paths must be canonicalized before use.
- Absolute paths are allowed only when they resolve inside the repo root or an
  explicitly configured generated-cache root.
- Parent-directory escapes must be rejected.
- Symlink traversal must be resolved and rejected when the target exits the repo
  or generated-cache root.
- Generated, vendor, and ignored roots are read-only unless explicitly allowed.
- Workspace writes must refuse paths outside tracked or explicitly configured
  writable roots.

## Command Execution

The MVP should plan validation commands by default. Command execution is
post-MVP unless a command is explicitly allowlisted by repo config or client
policy.

When commands are executed:

- run without shell interpolation
- use a fixed working directory
- use structured argv, not command strings
- apply timeouts and output byte limits
- scrub or define the environment
- label the command source: discovered, configured, user-requested, or inferred
- report network assumptions
- return structured failure and blocked states

Adapters must not spawn commands directly. All process execution goes through a
single command runner that enforces this contract.

## Network Policy

The local runtime should not require network access for hot-path context,
symbol, reference, edit, or validation-planning tools. Any network-using command
or integration must be explicit in the validation plan or tool metadata.

## Credential And Secret Redaction

The runtime must avoid indexing or reporting obvious secret material.

Skip or redact:

- `.env` files unless explicitly included
- private keys and certificate material
- token-like environment values
- credential-looking command output
- generated reports containing secret-looking values
- infrastructure environment variable values

Infrastructure adapters may store environment variable names and permission
shape, but not secret-like values.

Presentation-time redaction is a display boundary, not a path-containment
decision. Source sections, docs snippets, and compact findings preserve
ordinary source text such as `/api/orders`, route fragments, URL paths, and
fixture strings unless the value contains secret-like material, an absolute host
path, or a workspace-escape token. Repo-relative filesystem paths are preserved
when they come from path-typed fields. Absolute host paths, traversal-like
workspace escapes, private keys, and token/password/secret assignments are
redacted in presentation output. The stricter workspace path resolver remains
the authority for reads, writes, symlink handling, generated/vendor write
refusal, and workspace-escape blocking.

## Generated Writes

- Runtime caches should live under generated cache roots such as `.cache/`.
- Generated cache paths must remain untracked.
- Graph reports are post-MVP and should be generated on demand or stored under
  generated cache roots unless an explicit export workflow is approved.
- Generated report exports into tracked docs are deferred.

## MCP Capability Gates

| Class | Safety Rule |
| --- | --- |
| `read_only` | May read indexed runtime state and source-derived evidence within scope. |
| `planning` | May propose edits or validation commands but must not mutate files or execute commands. |
| `workspace_write` | Requires preview token, path containment, drift check, and mutation result metadata. |
| `process_execute` | Requires allowlisted command, command runner enforcement, timeout, output cap, and structured result. |
| `generated_write` | May write only approved generated cache/report roots. |

## Required Negative Tests

- path traversal is rejected
- symlink escape is rejected
- absolute path outside repo is rejected
- generated/vendor mutation is refused by default
- shell metacharacters are not interpreted
- command timeout is enforced
- command output cap is enforced
- environment is scrubbed or explicit
- secret-like text is redacted from indexed/report output
- `.cache/` artifacts are not committed

## Related Docs

- [Runtime contracts](runtime-contracts.md)
- [Edit and validation loop design](../design/edit-and-validation-loop-design.md)
- [Graph store design](../design/graph-store-design.md)
- [MVP proof matrix](mvp-proof-matrix.md)
