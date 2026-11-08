---
title: Daemon CPU efficiency canonical context
doc_type: spec
artifact_type: canonical-context
status: draft
owner: platform
last_reviewed: 2026-11-08
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Canonical Context

## Purpose

Preserve the distinction between current durable refresh contracts, proposed
performance behavior, and imported exploratory measurements across several owners.

## Authority Hierarchy

Applicable instructions, security/workspace rules, actual source/contracts/tests
and live evidence constrain this draft. Spec-local proposals never supersede
ownership, deadline, publication or privacy authority. Reconcile current files
before implementation; do not treat this package as an implementation receipt.

## Always-Canonical External Sources

AGENTS.md governs changes. Existing runtime-operations, graph-store, observability,
runtime-contracts and layered-runtime-architecture documents remain the canonical
owners listed and linked in requirements.md. Actual code/tests and structured
runtime evidence establish implementation truth when prose conflicts.

## Spec-Canonical Working Sources

Requirements define requested scope and proposed acceptance. Design defines the
candidate implementation path and T001 decision checkpoint. Tasks provide the
execution index; verification/traceability record evidence obligations and executed
checks. Draft proposals and task markers alone do not prove delivered behavior;
claims for completed slices require the recorded source, tests and measurements.

## Imported Sources

Durable owner summaries were read on 2026-11-08 and summarized in requirements.md
and design.md; they remain authoritative in their original locations. Research
imports sanitized local profiling observations from that date against v0.6.12.
They are background evidence, not superseding requirements or full-generation
acceptance. No durable source is copied or superseded wholesale.

## Non-Canonical Background Sources

Ignored .tmp/cpu-investigation artifacts are local supporting material only.
Closed Spec 051 and historical EB014/EB052 delivery records explain the baseline;
they are not reopened or reclassified by this package. Unrelated pending Spec 065
and release-note work remain outside this write set.

## Promotion Map

T008 promotes verified behavior to the existing durable owners in requirements.md,
records B013's actual disposition, and preserves B014's policy residual. Temporary
measurements remain research/evidence with explicit limits. Any new deferral needs
one owned destination and an explicit scope revision before closure.

## Final Promotion And Package Disposition

T008 retains the unchanged performance JSON and concise delivery/review evidence
in docs/history/072-daemon-cpu-efficiency-performance-evidence.json and
docs/history/072-daemon-cpu-efficiency-review.md. Current behavior and accepted
requirements live in the existing design, reference, requirements and runbook
owners; B013 is done in source. B014-B016 remain owned, and B017 explicitly
blocks release until actual Windows preflight passes at the immutable candidate.
This source-only disposition supersedes earlier T008 release-coordination wording
without waiving any R1-R6/SC-001-SC-004 criterion or claiming Windows execution.

The closure log and archive index identify the final verified spec commit and
actual cleanup commit. Repository policy removes completed active scaffolding;
Git retains this package's final verified tree. No live upgrade or publication
is part of this closure.

## Related Artifacts

[Requirements](requirements.md), [design](design.md), [tasks](tasks.md),
[research](research.md), [traceability](traceability.md), [verification](verification.md).
