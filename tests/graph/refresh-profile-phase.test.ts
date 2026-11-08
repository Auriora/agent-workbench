/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { MessageChannel, Worker } from "node:worker_threads";
import { afterEach, describe, expect, it } from "vitest";

const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true }); });

type Cpu = { user: number; system: number };
type Metrics = {
  state: string;
  wall_ms: number;
  thread_cpu_us: Cpu;
  work_counts: Record<string, number>;
  work_counts_observed: boolean;
  phase_timings: Array<{ phase: string; wall_ms: number; thread_cpu_us: Cpu }>;
};

async function profileWorker(): Promise<{ metrics: Metrics; publicMessages: unknown[] }> {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "awb-exclusive-phase-"));
  roots.push(root);
  const source = path.join(root, "source");
  const output = path.join(root, "output");
  fs.mkdirSync(source);
  fs.mkdirSync(output);
  fs.writeFileSync(path.join(source, "a.py"), "def call():\n    return helper()\n");
  fs.writeFileSync(path.join(source, "z.py"), "def helper():\n    return 1\n");
  fs.writeFileSync(path.join(source, ".gitignore"), "unused-*.tmp\n");
  const { port1, port2 } = new MessageChannel();
  const publicMessages: unknown[] = [];
  const receipt = new Promise<Metrics>((resolve, reject) => {
    let message: unknown;
    port1.on("message", value => { message = value; });
    port1.once("close", () => message ? resolve(message as Metrics) : reject(new Error("Missing worker observation receipt")));
  });
  const worker = new Worker(new URL("../../src/debug/refresh-profile-worker-entrypoint.mjs", import.meta.url), {
    workerData: {
      executionId: "profile-exact-phases", repoRoot: source, databasePath: path.join(output, "graph.sqlite"),
      snapshotId: "74001", configIdentity: "default", maxFiles: 2000,
      retainLatestSnapshots: 3, retainLatestFreshSnapshots: 2, controllerGeneration: 7,
      invalidationGeneration: 0, deadlineAt: new Date(Date.now() + 60_000).toISOString(), timeoutMs: 60_000,
      refreshProfile: { port: port2, profile_path: path.join(output, "pass.cpuprofile") }
    }, transferList: [port2]
  });
  worker.on("message", value => { publicMessages.push(value); });
  const exit = new Promise<void>((resolve, reject) => {
    worker.once("error", reject);
    worker.once("exit", code => code === 0 ? resolve() : reject(new Error(`Worker exited ${code}`)));
  });
  await exit;
  return { metrics: await receipt, publicMessages };
}

describe("actual worker exclusive phase observations", () => {
  it.skipIf(typeof process.threadCpuUsage !== "function")("partitions all observed worker wall/CPU exactly and reports actual scanner counts", async () => {
    const { metrics, publicMessages } = await profileWorker();
    expect(metrics.state).toBe("complete");
    expect(metrics.work_counts_observed).toBe(true);
    expect(metrics.work_counts.directory_enumerations).toBeGreaterThan(0);
    expect(metrics.work_counts.directory_entries_considered).toBeGreaterThan(0);
    expect(metrics.work_counts.file_stat_attempts).toBeGreaterThan(0);
    expect(metrics.work_counts.wildcard_regex_compilations).toBeGreaterThan(0);
    const phases = metrics.phase_timings;
    expect(phases[0].phase).toBe("bootstrap");
    expect(phases.at(-1)!.phase).toBe("settlement");
    for (const phase of ["composition", "catalog", "extraction", "docs", "resolution", "graph_write", "finalizing"]) {
      expect(phases.some(item => item.phase === phase)).toBe(true);
    }
    expect(phases.every(item => item.wall_ms >= 0 && item.thread_cpu_us.user >= 0 && item.thread_cpu_us.system >= 0)).toBe(true);
    expect(phases.reduce((total, item) => total + item.wall_ms, 0)).toBeCloseTo(metrics.wall_ms, 7);
    expect(phases.reduce((total, item) => total + item.thread_cpu_us.user, 0)).toBe(metrics.thread_cpu_us.user);
    expect(phases.reduce((total, item) => total + item.thread_cpu_us.system, 0)).toBe(metrics.thread_cpu_us.system);
    expect(publicMessages.some(value => (value as { type?: string }).type === "complete")).toBe(true);
    expect(publicMessages.some(value => (value as { phase_timings?: unknown }).phase_timings !== undefined)).toBe(false);
  }, 20_000);
});
