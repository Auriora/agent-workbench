/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
import fs from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";
import { FileCatalogScannerAdapter, type FileCatalogObservation } from "../infrastructure/filesystem/file-catalog-scanner.js";
import { createRefreshBaselineFixture, type RefreshBaselineFixture } from "./fixtures/refresh-baseline-fixture.js";
import { distribution, hash, isOwningCheckout, runtimeFingerprint, writeJson } from "./refresh-profile.js";

export type ScanBenchmarkConfig = { output_root: string; runs: number; python_files: number };
type WorkCounts = Record<FileCatalogObservation, number>;
export type ScanBenchmarkResult = {
  schema_version: 1; state: "complete";
  identity: {
    node: string; platform: string; arch: string; harness_sha256: string; runtime_source_sha256: string;
    fixture_revision: string; source_manifest_sha256: string;
    parameters: { runs: number; python_files: number; warmup_pairs: number; scans: Array<Record<string, unknown>> };
  };
  runs: Array<{ run: number; wall_ms: number; process_cpu_us: number; work_counts: WorkCounts; output_sha256: string }>;
  output_sha256: string;
  summary: { wall_ms: ReturnType<typeof distribution>; process_cpu_us: ReturnType<typeof distribution> };
  limits: string[];
};

export function resolveScanBenchmarkConfig(argv: readonly string[]): ScanBenchmarkConfig {
  const values = new Map<string, string>();
  for (let i = 0; i < argv.length; i += 2) {
    if (!["--output", "--runs", "--python-files"].includes(argv[i]) || argv[i + 1] === undefined || values.has(argv[i])) {
      throw new TypeError("Usage: --output <new-directory> [--runs 5] [--python-files 4000]");
    }
    values.set(argv[i], argv[i + 1]);
  }
  if (!values.has("--output")) throw new TypeError("--output is required.");
  const integer = (name: string, defaultValue: number): number => {
    const value = values.get(name) ?? String(defaultValue);
    if (!/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value))) throw new TypeError("Expected positive safe integer.");
    return Number(value);
  };
  return { output_root: path.resolve(values.get("--output")!), runs: integer("--runs", 5), python_files: integer("--python-files", 4000) };
}

/** Both arms use this unchanged harness and fresh owned deterministic fixtures. */
export async function runScanBenchmark(config: ScanBenchmarkConfig): Promise<ScanBenchmarkResult> {
  if (!isOwningCheckout(process.cwd())) throw new Error("owning_checkout_required");
  if (!Number.isSafeInteger(config.runs) || config.runs < 1 || !Number.isSafeInteger(config.python_files) ||
      config.python_files < 1 || config.python_files > 10_000) throw new Error("invalid_configuration");
  const requested = path.resolve(config.output_root);
  if (fs.existsSync(requested)) throw new Error("new_output_required");
  const output = path.join(fs.realpathSync.native(path.dirname(requested)), path.basename(requested));
  fs.mkdirSync(output, { mode: 0o700 });
  const runtime = runtimeFingerprint();
  const fixture = createRefreshBaselineFixture({ parent_root: output, python_files: config.python_files });
  writeJson(path.join(output, "fixture.json"), fixture);
  const priorityPatterns = ["**/config/routes.rb", "**/config/routes/*.rb"];
  const scans = [
    { indexed_roots: ["."], skipped_roots: [], max_files: 6000,
      priority_paths: ["Gemfile", "config/application.rb", "config/routes.rb"], priority_path_patterns: priorityPatterns },
    { indexed_roots: ["."], skipped_roots: [], max_files: 6000,
      priority_paths: ["AGENTS.md", "README.md", "Gemfile", "config/application.rb", "config/routes.rb"], priority_path_patterns: priorityPatterns }
  ];
  const identity: ScanBenchmarkResult["identity"] = {
    node: process.version, platform: process.platform, arch: process.arch,
    harness_sha256: hash(fs.readFileSync(fileURLToPath(import.meta.url), "utf8")), runtime_source_sha256: runtime,
    fixture_revision: fixture.revision, source_manifest_sha256: fixture.content_fingerprint,
    parameters: { runs: config.runs, python_files: config.python_files, warmup_pairs: 1, scans }
  };
  const runs: ScanBenchmarkResult["runs"] = [];
  let expectedOutput: string | undefined;
  try {
    assertOwnedFixture(fixture);
    for (let run = 0; run <= config.runs; run += 1) {
      const counts: WorkCounts = { directory_enumerations: 0, directory_entries_considered: 0, file_stat_attempts: 0, wildcard_regex_compilations: 0 };
      const cpu = process.cpuUsage(), started = performance.now();
      const scanner = new FileCatalogScannerAdapter({ observe: event => { counts[event] += 1; } });
      const results = [];
      for (const scan of scans) results.push(await scanner.scan({ repo_root: fixture.repo_root, ...scan }));
      const wallMs = performance.now() - started, elapsedCpu = process.cpuUsage(cpu);
      // Normalize only the generated fixture root, never arbitrary source metadata.
      const normalized = results.map(result => ({ ...result, repo_root: "owned-fixture" }));
      const digest = hash(JSON.stringify(normalized));
      if (expectedOutput !== undefined && expectedOutput !== digest) throw new Error("scanner_output_changed");
      expectedOutput = digest;
      if (run > 0) {
        runs.push({ run, wall_ms: wallMs, process_cpu_us: elapsedCpu.user + elapsedCpu.system,
          work_counts: counts, output_sha256: digest });
        writeJson(path.join(output, `run-${run}-scans.json`), normalized);
      }
      if (runtimeFingerprint() !== runtime) throw new Error("runtime_identity_changed");
    }
    assertOwnedFixture(fixture);
    const result: ScanBenchmarkResult = {
      schema_version: 1, state: "complete", identity, runs, output_sha256: expectedOutput!,
      summary: { wall_ms: distribution(runs.map(run => run.wall_ms)), process_cpu_us: distribution(runs.map(run => run.process_cpu_us)) },
      limits: [
        "Measures two broad scanner calls, including policy preparation and operation-counter overhead; no extraction, worker startup, full-generation or FreeCAD performance claim.",
        "One unmeasured warmup pair precedes all measured pairs. Each pair creates a scanner; each scan admits fresh policy. Filesystem cache is uncontrolled.",
        "CPU/wall measurement excludes fixture setup, source/runtime validation, result serialization and output writes; includes both complete scans. RSS is not measured here.",
        "Input is a newly generated private fixture only; no external mutable source or pre-existing output is accepted. Failures have no successful timing summary."
      ]
    };
    writeJson(path.join(output, "report.json"), result);
    return result;
  } catch (error) {
    writeJson(path.join(output, "report.json"), { schema_version: 1, state: "failed", code: "scan_benchmark_failed", completed_runs: runs.length });
    throw error;
  }
}

export function compareScanBenchmarks(baseline: ScanBenchmarkResult, candidate: ScanBenchmarkResult): {
  state: "passed" | "failed"; median_cpu_reduction: number; identical_output: boolean;
} {
  const { runtime_source_sha256: _beforeRuntime, ...before } = baseline.identity;
  const { runtime_source_sha256: _afterRuntime, ...after } = candidate.identity;
  const countKeys: FileCatalogObservation[] = ["directory_enumerations", "directory_entries_considered", "file_stat_attempts", "wildcard_regex_compilations"];
  const valid = (result: ScanBenchmarkResult): boolean => result.schema_version === 1 && result.state === "complete" &&
    Number.isSafeInteger(result.identity.parameters.runs) && result.identity.parameters.runs >= 5 &&
    result.runs.length === result.identity.parameters.runs && /^[a-f0-9]{64}$/u.test(result.output_sha256) &&
    result.runs.every((run, index) => run.run === index + 1 && run.output_sha256 === result.output_sha256 &&
      Number.isFinite(run.process_cpu_us) && run.process_cpu_us > 0 && Number.isFinite(run.wall_ms) && run.wall_ms >= 0 &&
      run.work_counts !== null && typeof run.work_counts === "object" && Object.keys(run.work_counts).length === countKeys.length &&
      countKeys.every(key => Number.isSafeInteger(run.work_counts[key]) && run.work_counts[key] >= 0 &&
        run.work_counts[key] === result.runs[0].work_counts[key])) &&
    JSON.stringify(result.summary) === JSON.stringify({
      wall_ms: distribution(result.runs.map(run => run.wall_ms)),
      process_cpu_us: distribution(result.runs.map(run => run.process_cpu_us))
    });
  if (!valid(baseline) || !valid(candidate) || JSON.stringify(before) !== JSON.stringify(after)) throw new Error("incomparable_scan_benchmarks");
  const baselineMedian = distribution(baseline.runs.map(run => run.process_cpu_us)).median;
  const candidateMedian = distribution(candidate.runs.map(run => run.process_cpu_us)).median;
  const reduction = 1 - candidateMedian / baselineMedian;
  const identical = baseline.output_sha256 === candidate.output_sha256;
  return { state: identical && reduction >= 0.5 ? "passed" : "failed", median_cpu_reduction: reduction, identical_output: identical };
}

function assertOwnedFixture(fixture: RefreshBaselineFixture): void {
  const observed: string[] = [];
  const walk = (directory: string): void => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (entry.name === ".git" && directory === fixture.repo_root) continue;
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(absolute);
      else if (entry.isFile()) observed.push(path.relative(fixture.repo_root, absolute).split(path.sep).join("/"));
      else throw new Error("fixture_unexpected_entry");
    }
  };
  walk(fixture.repo_root);
  if (JSON.stringify(observed.sort()) !== JSON.stringify(fixture.manifest.map(file => file.path).sort())) throw new Error("fixture_file_universe_changed");
  for (const file of fixture.manifest) {
    const absolute = path.join(fixture.repo_root, file.path), stat = fs.statSync(absolute);
    if (stat.size !== file.bytes || stat.mtimeMs !== Date.parse(fixture.source_timestamp) ||
        hash(fs.readFileSync(absolute, "utf8")) !== file.sha256) throw new Error("fixture_identity_changed");
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { process.stdout.write(`${JSON.stringify(await runScanBenchmark(resolveScanBenchmarkConfig(process.argv.slice(2))), null, 2)}\n`); }
  catch { process.stderr.write("Scan benchmark failed; no accepted measurement summary.\n"); process.exitCode = 1; }
}
