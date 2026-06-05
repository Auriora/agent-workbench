---
title: Agent IDE capability analysis research
doc_type: spec
artifact_type: research
status: active
owner: platform
last_reviewed: 2026-06-05
---

# Research

## Question

Which capabilities, workflows, and lessons from predecessor `agent-ide` should
Agent Workbench adopt, improve, reject, or defer in order to become the
language-neutral replacement runtime for coding agents?

## Known Starting Points

- Existing restart research says `agent-ide` proved long-lived repo runtimes,
  background indexing, compact status/scope/docs resources, edit feedback,
  validation routing, and trust/freshness metadata.
- Existing dogfood feedback says Agent Workbench is stronger on clean contracts,
  multi-language direction, generated/vendor policy, edit preview safety, and
  quiet hooks, but still needs deeper diagnostics, nearest-test planning,
  symbol/reference confidence, post-edit feedback, and language-specific
  semantic depth.
- Usage evidence recorded in Spec 001 suggests retained `agent-ide` usage
  concentrated around `context_for_task`, docs search/read, diagnostics,
  preflight/status, lint/validation planning, and post-apply feedback.

## Analysis Questions

- Which `agent-ide` tools should become Agent Workbench tools, and which should
  instead become better presenters, resources, hooks, or validation providers?
- Which `agent-ide` workflows were effective because of product shape rather
  than Python-specific implementation?
- Which Agent Workbench specs already implemented the lessons?
- Which active specs should remain first because they address immediate
  dogfood friction?
- Which replacement gaps deserve new specs after Specs 007-009?

## Expected Output

The final research output should be a durable analysis document and parity
matrix under `docs/reference/agent-ide-capability-analysis/`, linked from the
documentation map and summarized in the relevant roadmap/backlog sections.
