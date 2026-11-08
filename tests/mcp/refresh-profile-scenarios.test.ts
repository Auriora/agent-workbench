/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { resolveRefreshScenarioConfig, runRefreshScenarioSuite } from "../../src/debug/refresh-profile-scenarios.js";

const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true }); });
const root = (): string => { const value = fs.mkdtempSync(path.join(os.tmpdir(), "awb-refresh-scenario-test-")); roots.push(value); return value; };
const actual = it.skipIf(typeof process.threadCpuUsage !== "function");

async function measuredSuite(config: Parameters<typeof runRefreshScenarioSuite>[0]) {
  const result = await runRefreshScenarioSuite(config);
  if (result.state === "complete") return result;
  // Keep failed input paths/inodes and SQLite evidence intact. Moving or copying
  // the fixture would itself change evidence needed to diagnose identity drift.
  const output = path.resolve(config.output_root);
  const retainedRoot = roots.find(value => {
    const relative = path.relative(value, output);
    return relative === "" || relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
  });
  if (retainedRoot !== undefined) roots.splice(roots.indexOf(retainedRoot), 1);
  const diagnostic = path.resolve(".tmp", "refresh-profile-test-failures", `${path.basename(retainedRoot ?? output)}.json`);
  let diagnosticWriteError: string | undefined;
  try {
    fs.mkdirSync(path.dirname(diagnostic), { recursive: true });
    fs.writeFileSync(diagnostic, `${JSON.stringify({ output_root: output, retained_root: retainedRoot, result }, null, 2)}\n`, { mode: 0o600 });
  } catch (error) {
    diagnosticWriteError = error instanceof Error ? error.message : String(error);
  }
  throw new Error(JSON.stringify({ ...result, retained_evidence_root: retainedRoot, diagnostic, diagnostic_write_error: diagnosticWriteError }));
}

describe("owned production refresh profiling scenarios", () => {
  it("rejects external source arguments and shortened idle windows before writes", () => {
    const parent = root(), external = path.join(parent, "external"); fs.mkdirSync(external);
    fs.writeFileSync(path.join(external, "sentinel"), "retain");
    const output = path.join(parent, "output");
    expect(() => resolveRefreshScenarioConfig(["--output", output, "--repo", external])).toThrow("External --repo");
    expect(() => resolveRefreshScenarioConfig(["--output", output, "--idle-ms", "1"])).toThrow("Usage");
    expect(fs.existsSync(output)).toBe(false);
    expect(fs.readdirSync(external)).toEqual(["sentinel"]);
    expect(fs.readFileSync(path.join(external, "sentinel"), "utf8")).toBe("retain");
  });

  it("preserves existing output evidence", async () => {
    const parent = root(), output = path.join(parent, "output"); fs.mkdirSync(output);
    fs.writeFileSync(path.join(output, "sentinel"), "retain");
    expect(await runRefreshScenarioSuite({ output_root: output, runs: 1, python_files: 1 })).toMatchObject({ state: "blocked" });
    expect(fs.readdirSync(output)).toEqual(["sentinel"]);
  });

  actual("compares complete persisted evidence across independently owned repetitions", async () => {
    const output = path.join(root(), "suite");
    const result = await measuredSuite({ output_root: output, runs: 2, python_files: 3, scenarios: ["persisted_reuse"] });
    expect(result.measurements).toHaveLength(2);
    expect(result.measurements.every(value => value.worker_invocations === 0)).toBe(true);
    expect(result.measurements[0].semantic_digest).toBe(result.measurements[1].semantic_digest);
    expect(result.summaries[0].repetitions).toBe(2);
  }, 30_000);

  actual("exercises the mandatory seed continuation before the interrupted resume boundary", async () => {
    const output = path.join(root(), "suite");
    const result = await measuredSuite({ output_root: output, runs: 1, python_files: 1, scenarios: ["interrupted_resume"] });
    expect(result).toMatchObject({ state: "complete" });
    expect(result.measurements).toHaveLength(1);
    expect(result.measurements[0]?.worker_invocations).toBeGreaterThan(1);
    expect(result.measurements[0]?.observation).toMatchObject({ kind: "paused_committed_worker_continuation" });
  }, 30_000);

  actual("measures persisted first-read reuse, real watcher edits and committed same-session continuation", async () => {
    const output = path.join(root(), "suite");
    const result = await measuredSuite({ output_root: output, runs: 1, python_files: 260,
      scenarios: ["cold_complete_generation", "persisted_reuse", "single_edit", "burst_edits", "interrupted_resume"] });
    expect(result.state).toBe("complete");
    expect(result.measurements).toHaveLength(5);
    const find = (scenario: string) => result.measurements.find(row => row.scenario === scenario)!;
    expect(find("persisted_reuse").worker_invocations).toBe(0);
    expect(find("persisted_reuse").semantic_digest).toBe(find("cold_complete_generation").semantic_digest);
    expect(find("single_edit").worker_invocations).toBeGreaterThan(0);
    expect(find("single_edit").input_mutations).toHaveLength(1);
    expect(find("burst_edits").input_mutations).toHaveLength(4);
    expect(find("burst_edits").semantic_digest).not.toBe(find("cold_complete_generation").semantic_digest);
    expect(find("interrupted_resume").observation).toMatchObject({ kind: "paused_committed_worker_continuation" });
    expect(find("interrupted_resume").semantic_digest).toBe(find("burst_edits").semantic_digest);
    expect(find("interrupted_resume").work_counts.wildcard_regex_compilations).toBeGreaterThan(0);
    expect(find("interrupted_resume").phase_timings.some(value => value.phase === "resolution")).toBe(true);
    expect(result.summaries.every(value => value.repetitions === 1)).toBe(true);
    expect(fs.statSync(output).mode & 0o777).toBe(0o700);
    const receipt = JSON.parse(fs.readFileSync(path.join(output, "run-1", "fixture.json"), "utf8"));
    const expectedAdmission = [
      ...receipt.expected_positive_qt_paths.map((path: string) => ({ path, language: "xml", format_evidence: "positive_qt" })),
      ...[...receipt.expected_inconclusive_qt_paths, ...receipt.expected_typescript_paths]
        .map((path: string) => ({ path, language: "typescript", format_evidence: "unconfirmed" }))
    ].sort((a, b) => a.path.localeCompare(b.path));
    for (const measurement of result.measurements) {
      expect(measurement.format_admission).toEqual(expectedAdmission);
    }
    expect(fs.existsSync(path.join(receipt.repo_root, ".cache"))).toBe(false);
    expect(find("single_edit").observation).toMatchObject({ trigger: "real fs.watch event through canonical queue/coordinator" });
  }, 90_000);
});
