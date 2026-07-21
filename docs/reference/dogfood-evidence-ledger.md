---
title: Dogfood evidence ledger
doc_type: reference
status: draft
owner: platform
last_reviewed: 2026-07-21
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
| 2026-07-20 | Agent Workbench repository after runtime upgrade | TypeScript/JavaScript/Markdown/plugin packaging | Claude Code | Healthy-snapshot rerun of the four paired navigation, policy lookup, validation-planning, and change-context tasks | `repo:///orientation`, `integration:///health/agent-workbench`, `find_references`, `docs_search`, `verification_plan`, `context_for_task` | Runtime `0.6.0` exposed one daemon-owned refresh execution that advanced and published a fresh snapshot without blockers; graph/docs queries became usable, and validation planning returned all five CI gates in repository-specific order | Direct `grep` remained the completeness comparison for exact references and governing-policy text; CI workflow inspection verified planned commands | Confirmed EB052 convergence and the EB004 SessionStart validation regression fix under a healthy installed runtime | `find_references` returned 9 low-confidence lexical hits versus 12 direct-search hits while presenting no catalog-scan incompleteness; docs relevance outweighed canonical authority; named Codex/Kiro hook scopes remained absent and generic lexical symbols still outranked first-party hook evidence in `context_for_task` | EB053 reference completeness and bounded-scan truthfulness; EB049 multi-provider routing regression; EB054 authority-aware docs ranking and counter semantics |
| 2026-07-20 | Agent Workbench repository security and error-boundary fixtures | TypeScript/JavaScript/config | Claude Code and Codex | Paired cross-client checks of symbol redaction, unknown-node impact, and secret-file diagnostics | `repo:///orientation`, `integration:///profiles/codex`, `context_for_task`, `symbol_search`, `impact`, `diagnostics_for_files` | Both clients reproduced the same runtime `0.6.0` defects on a fresh snapshot: source snippets were redacted while symbol signatures exposed the classified value; a fabricated impact node was accepted as a valid empty traversal; and an existing secret-excluded file was reported as missing | Direct fixture and source reads distinguished raw indexed evidence, path-policy exclusion, a real zero-edge node, and a fabricated node | Cross-client comparison ruled out a Claude-only adapter issue and localized the failures to shared presentation/application behavior | Trust metadata did not distinguish unknown impact input from known empty impact; diagnostics discarded path-policy evidence; redaction coverage differed across fields in one public symbol | Delivered in source on 2026-07-20 through EB055 public symbol redaction parity, EB056 impact start-node truthfulness, and EB057 diagnostics exclusion truthfulness; installed-runtime acceptance remains pending |
| 2026-07-20 | Agent Workbench repository during repo-local patch upgrade | TypeScript/JavaScript/SQLite/plugin packaging | Codex and Claude Code | Cross-client MCP startup diagnosis and same-schema upgrade recovery | repo-local Codex and Claude launchers, daemon health metadata, repository owner record, graph publication state, exact MCP initialize request | Both clients failed before initialize after `0.6.0` left a positively dead owner and owned `building` snapshot; `0.6.1` treated the version-bearing runtime identity mismatch as ambiguous despite matching repository, schema, and exact generation. The repaired runtime reconciled the orphan, preserved the published snapshot, admitted the current owner, and returned initialize as `0.6.1`. Live follow-up found retention, full-FTS rebuilding, and `VACUUM` consuming the refresh worker beyond its deadline and blocking status settlement, so interactive refresh now publishes before any explicit maintenance | Process, socket, owner-record, SQLite publication, and worker-thread inspection localized the shared runtime failure and derived-store maintenance stall; targeted and full-suite tests verified the repair | Positive-death, repository, schema, and generation checks prevented unsafe cleanup while allowing a patch upgrade to recover | MCP startup had no public error envelope because failure occurred before initialize; writable composed-server tests also polluted checked-in fixtures with ignored `.cache` state and made a golden test order-dependent | EB058 same-schema runtime upgrade orphan recovery, removal of derived-store maintenance from interactive publication, and temporary-copy isolation for writable MCP fixture tests |
| 2026-07-21 | Agent Workbench repository on installed runtime `0.6.1` | TypeScript/JavaScript/Markdown/plugin packaging | Claude Code | Installed-runtime acceptance of the EB055–EB057 truthfulness fixes and healthy-snapshot reproduction of the remaining completeness and ranking defects | `integration_health`, `repo:///orientation`, `impact`, `symbol_search`, `diagnostics_for_files`, `find_references`, `docs_search` | Runtime `0.6.1` cleared the acceptance left pending on 2026-07-20: a fabricated impact node returned `analysis_validity: invalid` with a non-retryable `domain_error` naming the absent node and a `symbol_search` recovery action; symbol `signature` and `source_section` both emitted the redaction placeholder; and the secret-excluded file returned a blocking `workspace_safety_blocked` refusal citing workspace-safety policy rather than absence. A mid-session daemon exit left `Repository index refresh failed.` across one restart, then converged to a fresh unblocked snapshot after client reconnect | Direct `grep` supplied the reference ground truth; `ps` and package metadata separated the repo-source `0.6.1` launcher from the stale global `0.6.0` install | Installed-runtime acceptance confirmed for EB055, EB056, and EB057; all three now emit typed error codes, accurate reasons, and recovery actions instead of results shaped like success | On a fresh snapshot `find_references` returned 11 of 17 direct-search occurrences, omitting a first-party `.ts` integration test and two `.js` fixture files while reporting `scope.languages` without `typescript` or `javascript`; `docs_search` ranked a `draft`/`supporting` changelog at 142.5 above every `current`/`canonical` hit at 58 and still omitted the governing design document holding the queried rule; `indexed_docs_count` 115 disagreed with `index_coverage` docs `indexed_files` 55 | EB053 and Spec 042 reference completeness; EB054 and Spec 043 authority-aware ranking and counter semantics. Retracts the earlier orphan-process hypothesis for the refresh failure: seven stale `0.6.0` processes remained running throughout the successful convergence, so EB052 and EB058 should treat daemon lifecycle, not orphan contention, as the operative signal |
| 2026-07-21 | Agent Workbench reference-completeness fixture and isolated plugin installs | TypeScript/JavaScript/plugin packaging | Codex and Claude Code | Spec 042 regression and installed-provider acceptance | `find_references`, `repo:///status`, `integration_health`, installed Codex app-server and Claude stream-JSON MCP calls | Bounded reference continuation reached the exact twelve JS/TS path/one-based-line/zero-based-column occurrence oracle; complete evidence was valid/untruncated, smaller budgets remained partial with callable continuation, and both real clients reported package/runtime/provider-plugin `0.6.1` | Direct fixture oracle was retained only as expected test evidence; no shell search or alternate parser satisfied acceptance | Prevented later TypeScript occurrences, unresolved searchable candidates, or live-time stops from being presented as complete absence; provider correlation and cleanup prevented package-labelled evidence from masquerading as real-client proof | Durable semantic caller identity remains outside lexical evidence, and live deadline scheduling can choose a different safe partial boundary | EB053 delivery verified by Spec 042; closure reconciliation remains pending under T013; current contracts and proof live in MCP surface design, runtime contracts, graph store design, language adapter design, MVP proof matrix, and plugin runbook |

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
