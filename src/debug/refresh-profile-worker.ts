/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
import fs from "node:fs";
import { channel } from "node:diagnostics_channel";
import inspector from "node:inspector/promises";
import { performance } from "node:perf_hooks";
import { workerData, type MessagePort } from "node:worker_threads";
import type { RefreshWorkerProgress } from "../contracts/index.js";

type ProfilePhase = RefreshWorkerProgress["phase"] | "bootstrap" | "settlement";
type CpuUsage = { user: number; system: number };
type PhaseTiming = { phase: ProfilePhase; wall_ms: number; thread_cpu_us: CpuUsage };
const input = workerData as { refreshProfile: { port: MessagePort; profile_path: string } };
const port = input.refreshProfile.port;
const session = new inspector.Session();
const observations: Array<Record<string, unknown>> = [];
const phaseTimings: PhaseTiming[] = [];
const workCounts = {
  directory_enumerations: 0,
  directory_entries_considered: 0,
  file_stat_attempts: 0,
  wildcard_regex_compilations: 0
};
const countKeys = Object.keys(workCounts) as Array<keyof typeof workCounts>;
const phaseNames: readonly ProfilePhase[] = [
  "bootstrap", "composition", "catalog", "extraction", "docs", "resolution",
  "graph_write", "finalizing", "settlement"
];
const started = performance.now();
const cpu = process.threadCpuUsage();
let previousWall = started;
let previousCpu = cpu;
let activePhase: ProfilePhase = "bootstrap";
let phaseStartedWall = started;
let phaseStartedCpu = cpu;
let workCountsObserved = false;
let invalidObservation = false;
let peakRss = process.memoryUsage.rss();
const progress = channel("agent-workbench.refresh.progress");
const phases = channel("agent-workbench.refresh.phase");
const work = channel("agent-workbench.refresh.work");

function delta(current: CpuUsage, previous: CpuUsage): CpuUsage {
  return { user: current.user - previous.user, system: current.system - previous.system };
}
function closePhase(now: number, currentCpu: CpuUsage): void {
  phaseTimings.push({
    phase: activePhase,
    wall_ms: now - phaseStartedWall,
    thread_cpu_us: delta(currentCpu, phaseStartedCpu)
  });
  phaseStartedWall = now;
  phaseStartedCpu = currentCpu;
}
const observePhase = (value: unknown): void => {
  if (typeof value !== "string" || !phaseNames.includes(value as ProfilePhase)) {
    invalidObservation = true;
    return;
  }
  if (value === activePhase) return;
  closePhase(performance.now(), process.threadCpuUsage());
  activePhase = value as ProfilePhase;
};
const observeWork = (value: unknown): void => {
  if (workCountsObserved || value === null || typeof value !== "object") {
    invalidObservation = true;
    return;
  }
  const counts = value as Record<string, unknown>;
  if (Object.keys(counts).length !== countKeys.length || countKeys.some(key =>
    typeof counts[key] !== "number" || !Number.isSafeInteger(counts[key]) || counts[key] < 0
  )) {
    invalidObservation = true;
    return;
  }
  for (const key of countKeys) workCounts[key] = counts[key] as number;
  workCountsObserved = true;
};
const observe = (value: unknown): void => {
  const now = performance.now();
  const currentCpu = process.threadCpuUsage();
  peakRss = Math.max(peakRss, process.memoryUsage.rss());
  observations.push({
    progress: value,
    elapsed_ms: now - started,
    interval_wall_ms: now - previousWall,
    interval_thread_cpu_us: delta(currentCpu, previousCpu),
    process_rss_bytes: process.memoryUsage.rss()
  });
  previousWall = now;
  previousCpu = currentCpu;
};
let succeeded = false;
session.connect();
progress.subscribe(observe);
phases.subscribe(observePhase);
work.subscribe(observeWork);
try {
  await session.post("Profiler.enable");
  await session.post("Profiler.start");
  // The production worker owns composition, extraction, deadlines and results.
  await import("../infrastructure/workers/startup-graph-warmup-worker.js");
  succeeded = true;
} finally {
  observePhase("settlement");
  const stopped = await session.post("Profiler.stop");
  fs.writeFileSync(input.refreshProfile.profile_path, JSON.stringify(stopped.profile), { mode: 0o600 });
  peakRss = Math.max(peakRss, process.memoryUsage.rss());
  const finished = performance.now();
  const finishedCpu = process.threadCpuUsage();
  closePhase(finished, finishedCpu);
  port.postMessage({
    schema_version: 1,
    state: succeeded && workCountsObserved && !invalidObservation ? "complete" : "failed",
    wall_ms: finished - started,
    thread_cpu_us: delta(finishedCpu, cpu),
    thread_cpu_semantics: "observed thread interval begins after TSX/debug-module imports and ends before receipt emission, unsubscribe, inspector disconnect and port close; bootstrap and settlement label only the observed production-import/profiler portions, not the entire worker lifetime; generation process CPU is measured separately",
    observed_process_peak_rss_bytes: peakRss,
    progress_intervals: observations,
    phase_timings: phaseTimings,
    phase_semantics: "exclusive contiguous intervals switched before production phase work; docs includes document reads/parsing/index writes; graph_write includes source graph/catalog/progress writes; bootstrap and profiler settlement included; observer overhead is measured in the active interval",
    work_counts: workCounts,
    work_counts_observed: workCountsObserved,
    work_count_semantics: "directory_enumerations counts successful scanner readdir operations; directory_entries_considered counts each returned entry before skips/dedup; file_stat_attempts counts scanner file-identity stat attempts only; wildcard_regex_compilations counts actual ignore-policy and priority-glob RegExp constructions; numeric callback overhead is included",
    interval_semantics: "time between aggregate progress milestones; intervals are not exclusive phase timings",
    rss_semantics: "process-wide RSS sampled at worker progress milestones and settlement; not worker-isolate heap or exact peak",
    profile_path: input.refreshProfile.profile_path
  });
  progress.unsubscribe(observe);
  phases.unsubscribe(observePhase);
  work.unsubscribe(observeWork);
  session.disconnect();
  port.close();
}
