---
title: Provider-aware integration health canonical context
doc_type: spec
artifact_type: canonical-context
status: draft
owner: platform
last_reviewed: 2026-07-19
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Canonical Context

## Purpose

Keep current source/protocol/package evidence authoritative while replacing a
legacy Codex-only integration model with a provider-neutral one.

## Authority Hierarchy

Repository instructions, source/tests, MCP protocol behavior, active package
manifests, and durable docs remain higher authority than this temporary package.

## Always-Canonical External Sources

| Source | Authority reason | Handling |
| --- | --- | --- |
| `AGENTS.md` | Repository boundaries and validation rules | Read before every task. |
| MCP initialize/resources protocol and SDK behavior | Client evidence boundary | Verify with composed-server fixtures, not direct callback assumptions. |
| current launchers, daemon, server, contracts, and tests | Implementation truth | Reconcile conflicts. |
| package/plugin manifests in the active launch context | Artifact identity evidence | Report only observed values/provenance. |
| integration/MCP/runtime durable docs | Current accepted behavior | Promote verified changes back. |

## Spec-Canonical Working Sources

| Source | Role | Scope |
| --- | --- | --- |
| `requirements.md` | accepted intent | Spec 040 |
| `design.md` | implementation approach | Spec 040 |
| `tasks.md` | execution index | Spec 040 |
| `traceability.md` | task/requirement mapping | Spec 040 |

## Imported Sources

| Spec path | Source path | Revision/date | Status | Canonical scope | Promotion target |
| --- | --- | --- | --- | --- | --- |
| `requirements.md` | EB001 residual and EB040 in backlog | 2026-07-19 | adapted | observed defects and intended outcomes | backlog delivery status |
| `change-impact.md` | integration/MCP/runtime durable docs | 2026-07-19 | summarized | current behavior boundaries | same durable owners |
| `verification.md` | composed server and direct source evidence | 2026-07-19 | summarized | defect baseline only | changelog/dogfood ledger if retained |

## Non-Canonical Background Sources

| Source | Reason non-canonical | Handling |
| --- | --- | --- |
| direct resource-callback tests with invented arguments | Do not represent MCP `resources/read` | Replace with protocol-shaped fixtures. |
| daemon process/repository name | Not client/provider identity | Never infer provider from it. |
| MCP client app version | Different artifact from Agent Workbench plugin | Report separately; never compare as plugin drift. |

## Promotion Map

| Spec-local content | Durable destination | Required before closure |
| --- | --- | --- |
| provider/current profile and provenance | integration design; runtime contracts | yes |
| health resource/tool semantics | MCP surface; runtime contracts | yes |
| refresh/reload/restart guidance | runbooks/plugin docs/changelog | yes |
| completion/residual state | backlog/history | yes |
