---
title: Dogfood evidence ledger
doc_type: reference
status: draft
owner: platform
last_reviewed: 2026-07-19
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Dogfood Evidence Ledger

## Purpose

Record real Agent Workbench use as product evidence. Dogfood entries are not
universal proof; they are dated observations that should feed fixture work,
backlog priorities, proof matrices, and adoption guidance.

## Entry Format

Each entry should include:

- Date
- Project shape
- Language/framework
- Agent used
- Task type
- Workbench tools/resources used
- Outcome
- Fallback to shell/search/direct reads
- Defects avoided
- Defects missed
- Follow-up improvement

Use bounded project descriptions rather than external repository names. Do not
include secrets, customer data, full transcripts, or unredacted command output.

## Ledger

| Date | Project shape | Language/framework | Agent used | Task type | Workbench surfaces used | Outcome | Fallback points | Defects avoided | Defects missed | Follow-up improvement |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-06-03 | Python desktop/tooling repo | Python/docs/config | Codex | Runtime evaluation and follow-up routing | status, scope, overview, context, validation planning | Follow-up behavior routed into later cross-repo specs and durable docs | Manual review of validation behavior and docs | First-call trust and freshness issues captured before broader use | Not a complete feature-delivery proof | Closed Spec 002 and related durable follow-ups |
| 2026-06-05 | Documentation-heavy lifecycle repo | Markdown/spec lifecycle docs | Codex | Read-only lifecycle/context evaluation | status, scope, overview, docs routing, task context evidence | Confirmed Workbench can help in documentation-heavy lifecycle repos while needing lifecycle-boundary clarity | Direct reads for precise lifecycle semantics | Boundary concerns captured before adding lifecycle authority | Workbench could still surface stale or non-authoritative spec context too confidently | EB006, Spec 021, lifecycle bridge contract |
| 2026-06-05 | Infrastructure-heavy service repo | Python/IaC/docs | Codex | Cross-repo infrastructure dogfood | context, docs routing, validation planning, resource-backed infra evidence | Promoted infrastructure routing and validation-planning improvements | Manual source and domain-context reads for final claims | Infrastructure routing gaps identified before claiming semantics | Full stack/deployment semantics remained unproven | Specs 006, 016, EB010 |
| 2026-06-05 | Large mixed-language native repo | C++/CMake/Python stubs | Codex | Large mixed-language repo dogfood | status, scope, overview, context, symbol routing, validation planning | Drove first-party C++/CMake ranking and validation-planning improvements | Direct source reads for semantic C++ claims | Third-party/generated noise and weak CMake ranking surfaced early | Compile-aware semantics remained unsupported | Specs 009 and C/C++ capability backlog |
| 2026-06-06 | Cross-repo smoke pass | Mixed repositories | Codex | First-read reliability smoke | status, scope, overview, integration profile, context | Confirmed first-call trust, scope visibility, and project-shape gaps | Manual inspection when validation plans timed out or were too broad | Several ranking and validation-planning gaps promoted into durable backlog | Some smoke evidence stayed partial/degraded | EB003, EB004, EB009, EB014 |
| 2026-06-13 | Product positioning docs slice | Markdown/docs/package metadata | Codex | Documentation hardening | repo status/scope/overview, docs direct reads, package dry-run, focused tests | Added README, lifecycle bridge contract, proof/status guidance, and packaging metadata | Direct file reads for precise docs edits | Lifecycle dependency confusion reduced in durable docs | No runtime trust-calibration field yet | EB023, EB025, EB029 |
| 2026-06-19 | Lifecycle-driven web app task | Web app/spec docs | Codex | Session-scoped plugin adoption feedback | None meaningfully used | Workbench was available but lost to shell, lifecycle tooling, subagents, and validation commands because the first useful Workbench action was not obvious | Shell `git status`, direct file reads, validation commands, and lifecycle tools | No Workbench-backed defects avoided in this phase | Discoverability gap between advertised `repo:///...` resources and visible tool-oriented affordances | EB044 |
| 2026-07-19 | Agent Workbench repository | TypeScript/JavaScript/Markdown/plugin packaging | Claude Code | Four paired navigation, policy lookup, validation-planning, and change-context tasks | `find_references`, `docs_search`, `verification_plan`, `context_for_task` | Context routing found high-value hook, manifest, source-sync, and governing-doc evidence with explicit trust labels; stale graph/docs queries remained blocked | Direct `grep`, `package.json`, and CI workflow reads supplied exact consumers, policy text, and complete validation gates | Structured degraded envelopes avoided false graph/docs completeness; ranked files exposed a non-obvious Claude hook sync dependency | Refresh never converged; validation planning omitted `validate:plugin`, `validate:skills`, and `pack:dry-run`; named Codex/Kiro scopes were omitted and generic lexical plugin symbols outranked first-party hook evidence | EB052 refresh convergence; EB004 repository-policy validation and skipped-path summarization; EB049 multi-provider context ranking, supported by EB032 explanations |

## Maintenance Notes

- Add entries when a coding agent uses Agent Workbench on a real repository or
  representative fixture and the result changes docs, backlog, tests, runtime
  behavior, or adoption guidance.
- Link follow-up improvements to `docs/backlog/README.md`
  entries, active specs, closure logs, or no-action decisions.
- Record fallback honestly. Fallback is product evidence, not a failure by
  itself.
- Keep raw per-agent feedback documents scoped to the chat session and stored
  with that session. Promote only distilled product signals, dated ledger
  entries, backlog items, specs, or durable design decisions into this
  repository.

## Related Docs

- [MVP proof matrix](mvp-proof-matrix.md)
- [Agent Workbench backlog](../backlog/README.md)
- [Spec closure log](../history/spec-closure-log.md)
- [Agent-readable changelog](agent-readable-changelog.md)
