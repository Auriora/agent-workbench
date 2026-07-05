---
title: Agent Workbench threat model
doc_type: security
status: draft
owner: platform
last_reviewed: 2026-07-04
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Agent Workbench Threat Model

## Purpose

Describe security assumptions and risks for a local-first IDE/runtime that
indexes repository content, exposes MCP tools, plans validation, and supports
bounded workspace edits.

Core rule:

```text
Repository content is untrusted input.
```

Agent Workbench may index source, docs, tests, comments, and config, but it
must never treat repository text as policy.

## Assets

- User workspace files and local git state.
- Runtime cache and SQLite evidence store.
- MCP tool/resource responses.
- Validation policy and planned command metadata.
- Agent instructions, skills, hooks, and plugin configuration.
- Credentials or secrets that may exist in local files, environment variables,
  command output, or repository history.

## Trust Boundaries

- Repository content is untrusted.
- MCP clients are not assumed benign.
- Repo-local validation policy is planning evidence, not command-execution
  authority.
- Agent instructions and generated integration artifacts are guidance, not
  runtime policy.
- Runtime contracts and workspace safety policy are the authority for mutation,
  command execution, redaction, freshness, and capability labels.

## Threats

| Threat | Risk | Current boundary | Follow-up |
| --- | --- | --- | --- |
| Malicious repository content | Source/docs/tests/config may try to steer agents or exploit parsers | Treat repo text as data; parser errors become structured evidence | EB034 security-sensitive change detection |
| Prompt injection in docs/comments/tests | Indexed text may instruct an agent to ignore policy or leak data | Docs/search results are routing/direct-read evidence, not policy | Trust calibration, docs caveats |
| Malicious MCP client | Client may request unsafe paths, broad reads, alternate repo roots, or mutations | MCP argument parsing, launch-root authority, workspace safety, capability gates | Contract drift tests |
| Malicious MCP configuration | Config may point agents at wrong runtime or wrapper | Integration profile separates configured/discovered/callable state | Doctor command and capability inventory |
| Workspace escape through symlinks | Path traversal or symlink targets may leave repo scope | Canonical path containment and symlink checks | Workspace safety fixtures |
| Command execution escalation | Repo-local commands may execute hostile code | MVP plans commands only; process execution requires allowlist and runner policy | Validation-policy trust levels |
| Credential leakage | Secrets may appear in files, snippets, or command output | Shared secret-path classification, secret path skipping, workspace write refusal, and presentation redaction | Redaction and path-policy regression tests |
| Stale preview overwrite | File changes after preview could overwrite user work | Apply requires preview token and drift checks | Rollback policy remains post-MVP |
| Generated artifact trust confusion | Agents may edit generated files or treat generated docs as source | Generated/vendor path policy and edit refusal where known | EB033 generated-file detection |
| Repo-local validation policy abuse | Repository may propose dangerous validation commands | Policy guides planning only; execution needs separate approval | EB028 validation-policy trust levels |

## Security-Sensitive Changes

Changes touching these areas should require explicit validation and review
before an agent reports completion:

- authentication and authorization
- credentials, secrets, tokens, certificates, or key handling
- cryptography
- network access and request routing
- filesystem reads/writes and path resolution
- subprocess or command execution
- deserialization and template rendering
- dependency manifests and lockfiles
- CI/CD workflows and release automation
- infrastructure permissions and IAM-like policy

Agent Workbench should eventually flag these areas as review-sensitive without
claiming that a vulnerability exists or does not exist.

## Non-Goals

- Agent Workbench is not a full SAST engine.
- Agent Workbench does not prove repository code is safe.
- Agent Workbench does not authorize command execution from repo-local policy
  alone.
- Agent Workbench does not treat lifecycle approval, release, or closure as a
  security decision it owns.

## Related Docs

- [Workspace safety contract](../reference/workspace-safety-contract.md)
- [Runtime contracts](../reference/runtime-contracts.md)
- [Lifecycle bridge contract](../reference/lifecycle-bridge-contract.md)
- [Agent Workbench backlog](../backlog/README.md)
