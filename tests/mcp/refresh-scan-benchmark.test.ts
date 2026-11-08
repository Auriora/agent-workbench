/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { compareScanBenchmarks, resolveScanBenchmarkConfig, runScanBenchmark, type ScanBenchmarkResult } from "../../src/debug/refresh-scan-benchmark.js";
import { hash } from "../../src/debug/refresh-profile.js";

const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true }); });
const root = (): string => { const value = fs.mkdtempSync(path.join(os.tmpdir(), "awb-scan-bench-")); roots.push(value); return value; };

function report(cpu: number): ScanBenchmarkResult {
  const output = "a".repeat(64);
  return {
    schema_version: 1, state: "complete",
    identity: { node: process.version, platform: process.platform, arch: process.arch,
      harness_sha256: "b".repeat(64), runtime_source_sha256: String(cpu), fixture_revision: "c".repeat(40),
      source_manifest_sha256: "d".repeat(64), parameters: { runs: 5, python_files: 4000, warmup_pairs: 1, scans: [] } },
    runs: Array.from({ length: 5 }, (_, index) => ({ run: index + 1, wall_ms: 100, process_cpu_us: cpu,
      work_counts: { directory_enumerations: 2, directory_entries_considered: 4, file_stat_attempts: 2, wildcard_regex_compilations: 1 }, output_sha256: output })),
    output_sha256: output,
    summary: { wall_ms: { median: 100, min: 100, max: 100 }, process_cpu_us: { median: cpu, min: cpu, max: cpu } }, limits: []
  };
}

describe("controlled two-scan benchmark acceptance", () => {
  it("requires the 50 percent CPU threshold and identical output", () => {
    expect(compareScanBenchmarks(report(100), report(50))).toMatchObject({ state: "passed", median_cpu_reduction: 0.5 });
    expect(compareScanBenchmarks(report(100), report(51))).toMatchObject({ state: "failed" });
    const changed = report(40);
    changed.output_sha256 = "e".repeat(64);
    for (const run of changed.runs) run.output_sha256 = changed.output_sha256;
    expect(compareScanBenchmarks(report(100), changed)).toMatchObject({ state: "failed", identical_output: false });
  });

  it.each(["fixture_revision", "source_manifest_sha256", "harness_sha256", "node"] as const)("refuses incomparable %s", key => {
    const changed = report(40); changed.identity[key] = "changed";
    expect(() => compareScanBenchmarks(report(100), changed)).toThrow("incomparable_scan_benchmarks");
  });

  it.each(["few_runs", "duplicate_run", "nonfinite_wall", "negative_count", "extra_count", "stale_summary"])("refuses incomplete or invalid evidence: %s", failure => {
    const changed = report(40);
    if (failure === "few_runs") changed.runs.pop();
    if (failure === "duplicate_run") changed.runs[4].run = 1;
    if (failure === "nonfinite_wall") changed.runs[0].wall_ms = NaN;
    if (failure === "negative_count") changed.runs[0].work_counts.wildcard_regex_compilations = -1;
    if (failure === "extra_count") Object.assign(changed.runs[0].work_counts, { unknown: 1 });
    if (failure === "stale_summary") changed.summary.process_cpu_us.median = 1;
    expect(() => compareScanBenchmarks(report(100), changed)).toThrow("incomparable_scan_benchmarks");
  });

  it("rejects external repository arguments and preserves existing output", async () => {
    expect(() => resolveScanBenchmarkConfig(["--output", "new", "--repo", "/external"])).toThrow("Usage");
    expect(() => resolveScanBenchmarkConfig(["--output", "new", "--runs", "0"])).toThrow("positive safe integer");
    const output = root(); fs.writeFileSync(path.join(output, "sentinel"), "retain");
    await expect(runScanBenchmark({ output_root: output, runs: 1, python_files: 1 })).rejects.toThrow("new_output_required");
    expect(fs.readdirSync(output)).toEqual(["sentinel"]);
    expect(fs.readFileSync(path.join(output, "sentinel"), "utf8")).toBe("retain");
  });

  it("captures complete identical scanner outputs on newly owned fixtures", async () => {
    const output = path.join(root(), "new");
    const result = await runScanBenchmark({ output_root: output, runs: 1, python_files: 3 });
    expect(result.state).toBe("complete");
    expect(result.runs).toHaveLength(1);
    const scans = JSON.parse(fs.readFileSync(path.join(output, "run-1-scans.json"), "utf8"));
    expect(scans).toHaveLength(2);
    expect(scans.every((scan: { repo_root: string }) => scan.repo_root === "owned-fixture")).toBe(true);
    expect(hash(JSON.stringify(scans))).toBe(result.output_sha256);
    expect(scans.every((scan: { files: Array<{ path: string }> }) => scan.files.some(file => file.path === "src/callers/caller_00000.py"))).toBe(true);
    expect(fs.statSync(output).mode & 0o777).toBe(0o700);
    expect(() => compareScanBenchmarks(result, result)).toThrow("incomparable_scan_benchmarks");
  });
});
