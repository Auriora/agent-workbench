---
title: Lifecycle bridge contract
doc_type: reference
status: draft
owner: platform
last_reviewed: 2026-06-13
---

# Lifecycle Bridge Contract

## Purpose

Define the generic boundary between Agent Workbench and lifecycle systems such
as `ai-spec-lifecycle`, issue trackers, ad hoc task packets, or project
governance tools.

Agent Workbench is aware of lifecycle context when provided, but it must not
depend on any specific lifecycle tool and must not become a lifecycle engine.

## Boundary

Lifecycle systems own:

- intent
- risk triage
- selected task
- acceptance criteria
- durable promotion
- closure
- governance decision gates

Agent Workbench owns:

- repo status and scope
- indexed code and documentation evidence
- symbol and reference routing
- impact evidence
- diagnostics
- validation planning
- bounded edit preview/apply support
- workspace safety metadata

Shared interfaces may include:

- durable docs
- active spec paths if present
- task/context packets
- validation expectations
- changed-file evidence
- diagnostics evidence
- residual risk

Workbench may consume active spec context when provided, rank files/docs using
active spec links, and expose evidence useful to lifecycle tasks. Workbench must
not decide whether a spec is complete, promote durable docs automatically, close
specs, or require the lifecycle repo, skill, or MCP server.

## Input Packet

The lifecycle bridge input is task context, not authority transfer. Use existing
runtime enum vocabulary where possible.

```json
{
  "task_id": "optional stable task id",
  "task_title": "short description",
  "task_description": "bounded task description",
  "active_spec_path": "optional path",
  "durable_doc_paths": [],
  "known_affected_files": [],
  "validation_expectations": [],
  "risk_level": "direct_patch | lightweight_spec | full_spec | governance_gate | unknown",
  "mutation_permissions": {
    "may_edit": [],
    "must_not_edit": [],
    "requires_preview": true,
    "process_execution": "disabled | planned_only | allowlisted"
  }
}
```

This shape is a planned bridge contract, not a new MCP schema yet. If promoted
to runtime contracts, it must use the existing response envelope and enum
modules in `src/contracts/`.

## Output Packet

The output returns repository evidence and validation planning. It must not
report lifecycle acceptance, completion, promotion, release, or closure.

```json
{
  "repo_status": "fresh | stale | cold | refreshing | unknown",
  "context": {
    "recommended_files": [],
    "recommended_docs": [],
    "symbols": [],
    "caveats": []
  },
  "evidence": {
    "capability_level": "semantic | partial_semantic | resource_backed | unsupported",
    "evidence_kinds": [],
    "freshness": "fresh | stale | cold | refreshing | unknown",
    "analysis_validity": "valid | partial | invalid | invalid_due_to_environment"
  },
  "diagnostics": {
    "status": "done | planned | needed | blocked | not_applicable",
    "items": []
  },
  "validation_plan": {
    "status": "planned | done | needed | blocked | not_applicable",
    "commands": [],
    "manual_checks": [],
    "blocked_reason": null
  },
  "residual_risk": []
}
```

`validation_plan.status: "done"` is allowed only when validation has executed
or equivalent evidence is available. Planned commands remain planned evidence.

## Planned MCP Surface

`context_for_lifecycle_task` is a planned MCP surface, not an implemented tool
in the current slice.

Purpose:

- accept a lifecycle bridge input
- combine task/spec/durable-doc hints with repo evidence
- return bounded context, relevant files, relevant docs, symbols, warnings,
  capability/freshness metadata, and validation suggestions

It must not:

- read the entire repo
- decide completion
- mutate files
- execute commands unless policy explicitly allows it
- treat docs-search snippets as exact truth
- treat lexical hits as semantic references

Until this surface exists, agents should combine lifecycle task packets with
`context_for_task`, `docs_read_section`, `symbol_search`, `find_references`,
`impact`, `diagnostics_for_files`, and `verification_plan`.

## Evidence Semantics

- Routing evidence helps an agent decide where to look.
- Parser-backed evidence supports stronger claims about declarations and
  syntax.
- Semantic evidence supports stronger claims only when fixture-proven for that
  language and operation.
- Direct source reads remain necessary when confidence is partial, degraded,
  stale, or heuristic.
- Planned validation is not completed validation.
- Executed tests/checks or equivalent evidence are required before claiming
  proof.

## Related Docs

- [Runtime contracts](runtime-contracts.md)
- [MCP surface design](../design/mcp-surface-design.md)
- [Coding agent integration design](../design/coding-agent-integration-design.md)
- [Workspace safety contract](workspace-safety-contract.md)
- [Spec task traceability lookup requirements](../specs/021-spec-task-traceability-lookup/requirements.md)
