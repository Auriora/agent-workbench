---
title: Daemon CPU investigation evidence
doc_type: spec
artifact_type: research
status: draft
owner: platform
last_reviewed: 2026-11-08
copyright: Copyright (C) 2026 Auriora
license: GPL-3.0-or-later
---

# Research

## Provenance and limits

Exploratory investigation performed on 2026-11-08 against installed Agent Workbench
0.6.12 on Node 24.8.0, Linux, 16 logical CPUs, serving FreeCAD. Thread-level pidstat,
read-only SQLite state, direct source review and inspector CPU profiles were used.
Replay wrote only a private database backup and read external sources without
editing them. The four reviewed core source hashes matched the installed receipt.
Kernel policy blocked perf sampling; there was no live stack capture or debugger
attachment. Worker attribution is an inference from the live thread load and
reproduced production build-slice hotspots, not historical stack proof.

Raw profiles, database and harnesses remain local ignored artifacts under
.tmp/cpu-investigation/. They are not portable dependencies or delivery proof.
This sanitized summary retains the baseline even if local artifacts disappear;
T001 must create reproducible repo-owned fixtures and a harness. No personal
paths, daemon identity tokens, database payloads or source contents are imported.

## Measurements

| Probe | Observation | Claim boundary |
| --- | --- | --- |
| Initial live five-second sample | 104% process CPU, 100% worker, 0.2% main | One active core; not whole-machine saturation |
| Later live sample | 103.4% process, 99.6% worker, 0% main | Sustained worker work during observation |
| Build progress | About 30 minutes in one extraction generation; roughly 4,200-4,700 extracted files | Slow advancing work; not proof of a stuck loop |
| First build-slice replay | 14.21 s wall, 13.96 s in two scans, one file extracted | Scanning can consume the cooperative extraction allowance |
| First replay profile | About 88% inclusive time in ignore matching, 76% in wildcard matching | Workload-specific sample; inclusive percentages overlap |
| Later build-slice replay | 21.53 s; two scans 7.06 s; 226 extracted files | Different slice contents; not a paired speed comparison |
| Later extraction | 82 Python files 0.89 s; one TypeScript extraction 9.62 s | Classification/parse hotspot for this input |
| Qt format evidence | Final .ts file was 333,921 bytes and had XML declaration and Qt TS root | Positive Qt XML evidence, despite extension |
| Progress counters | 250,000 scanned versus 4,738 admitted | Overlapping windows accumulate repeated work |

The experimental wildcard cache was applied only to a private source copy.
Three runs per arm, with ordering alternated, gave these two-scan results:

| Measure | Baseline | Compiled-pattern experiment |
| --- | --- | --- |
| Median wall time | 7.558 s | 1.656 s |
| Wall range | 7.406-18.828 s | 1.487-1.675 s |
| Median CPU time | 7.747 s | 1.788 s |
| Complete result comparison | Reference | Deeply equal, including cursor/order/skip evidence |

Median scan wall time improved 78.1%; CPU time improved 76.9%. An earlier single
pair measured 7.866 s versus 5.410 s, demonstrating warmup/host variability. The
live daemon remained running during experiments. These are feasibility evidence,
not a controlled complete-generation result or a promise of 78% lower daemon CPU.
The experimental unbounded Map is not an accepted production cache design.

## Source mechanisms and disposition

| Mechanism | Source | Destination |
| --- | --- | --- |
| Extension-only .ts language inference | src/infrastructure/filesystem/file-identity.ts; file-catalog-scanner.ts | Requirement 1; T002 |
| New wildcard RegExp per comparison | src/domain/policies/path-policy.ts, pathPatternMatches | Requirement 2; T003 |
| Shape scan plus catalog rediscovery each continuation | src/application/use-cases/index-repository-graph.ts; file-catalog-scanner.ts | Requirement 3; T004 |
| Full-node lookup/count and final resolution scans | index-repository-graph.ts, resolveOneReference/referenceCandidateCount | Requirement 4; T005 |
| Ten-second effective cooperative extraction window for a sixty-second pass; checks only between files | startup-graph-warmup-worker.ts; src/server.ts | Requirement 5; T006 |
| Overlapping cumulative scan counters | index-repository-graph.ts, addBuildCounters | Requirement 5; T004/T006 |
| Need for worker/full-generation performance proof | src/debug/mcp-use-case.ts profiles query-side use cases | Requirement 6; T001/T007 |
| Sustained scheduling and duty-cycle policy | No measured policy established | B014; explicitly separate from measured fixes |

Final resolution's repeated full-node name filtering is established by source
inspection; its full phase cost was not measured. SQLite/WAL size did not establish
an I/O bottleneck. A faster worker can still use one core while active; measure
total CPU, useful throughput and active duty cycle separately.
