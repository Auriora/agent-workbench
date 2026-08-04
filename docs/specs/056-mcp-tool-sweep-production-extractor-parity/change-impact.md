---
title: MCP tool-sweep production extractor parity change impact
doc_type: spec
artifact_type: change-impact
status: active
owner: platform
last_reviewed: 2026-08-04
---

# Change Impact

## Change Classification

- Primary type: debug-proof repair and composition deduplication.
- Public contract change: none.
- Production behavior change: no intended behavior change; registry assembly is
  centralized without changing its adapter set.
- Debug behavior change: Go and C/C++ warm-up and graph probes become
  acceptance-capable.
- Query presentation repair: references and impact preserve stored node
  capability/provenance instead of assuming parser evidence.

## Durable Source Mapping

| Current owner | Impact | Destination |
| --- | --- | --- |
| `docs/design/observability-debugging-design.md` | clarify canonical registry and supported probe ecosystems | update |
| `docs/design/language-adapter-design.md` | capability levels and extraction rules remain unchanged | no change |
| `docs/reference/language-capability-matrix.md` | priority and capability levels remain unchanged | no change |
| `docs/backlog/README.md` | record EB010 proof repair | update |
| `docs/reference/dogfood-evidence-ledger.md` | record bounded real-repository evidence after success | update |

## Proposed Changes

| Change | Type | Current source | Durable destination |
| --- | --- | --- | --- |
| Centralize production extractor composition | modify | startup worker and debug sweep | observability/debugging design |
| Add Go/C/C++ sweep candidate selection | bug fix | debug sweep | observability/debugging design |
| Preserve node evidence in reference and impact output | bug fix | graph query presentation | observability/debugging design |
| Record bounded proof repair | clarify | real-repository dogfood | EB010 and dogfood ledger |

## Promotion Targets

| Spec content | Durable destination | Status |
| --- | --- | --- |
| canonical registry rule | `docs/design/observability-debugging-design.md` | promoted |
| EB010 proof repair | `docs/backlog/README.md` | promoted |
| real-repository evidence | `docs/reference/dogfood-evidence-ledger.md` | promoted |

## Regression Risks

- Omitting an existing production adapter from the shared factory.
- Creating a worker/debug import cycle or compiled-runtime packaging failure.
- Selecting incidental C/C++ or Go files in a different primary ecosystem.
- Presenting C/C++ evidence as stronger than resource-backed heuristic routing.

Each risk has a focused fixture or architecture assertion in T002-T005.
