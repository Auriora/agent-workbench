/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
import fs from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";
import { createRefreshBaselineFixture, type RefreshBaselineFixture } from "./fixtures/refresh-baseline-fixture.js";
import {
  createRefreshProfileRuntime, measureRefreshGeneration, semanticEvidence,
  distribution, hash, isOwningCheckout, runtimeFingerprint, sourceFingerprint, writeJson,
  type RefreshProfileRun, type RefreshProfileRuntime, type RefreshProfileWorkerMetrics
} from "./refresh-profile.js";
import { RepositoryRefreshTriggerCoordinator } from "../application/use-cases/repository-refresh-triggers.js";
import { SnapshotValidityService, classifySnapshotCompositionFreshness, DEFAULT_SNAPSHOT_VALIDITY_MAX_PATHS } from "../application/use-cases/validate-snapshot-paths.js";
import { discoverRepositoryComposition } from "../application/use-cases/repository-composition.js";
import { GitMetadataCommandAdapter } from "../infrastructure/commands/index.js";
import { FilesystemWorkspaceWatcherAdapter, FilesystemSnapshotPathValidatorAdapter, WorkspaceFileAdapter } from "../infrastructure/filesystem/index.js";
import { SystemClockAdapter } from "../infrastructure/time/index.js";
import { createRepositoryWorkspaceRefreshService } from "../server.js";
import { resolveWorkspaceWatcherConfig } from "../domain/models/index.js";
import { captureRefreshSemanticEvidence, compareRefreshSemanticEvidence, type RefreshSemanticEvidence } from "./refresh-profile-comparison.js";

export const REFRESH_PROFILE_SCENARIOS = [
  "cold_complete_generation", "persisted_reuse", "settled_idle", "single_edit", "burst_edits", "interrupted_resume"
] as const;
export type RefreshProfileScenario = typeof REFRESH_PROFILE_SCENARIOS[number];
export type RefreshScenarioConfig = { output_root: string; runs: number; python_files: number; scenarios?: readonly RefreshProfileScenario[] };
export type RefreshScenarioMeasurement = RefreshProfileRun & {
  source_fingerprint: string;
  input_revision: string;
  input_mutations: Array<{ path: string; before_sha256: string; after_sha256: string; mtime: string }>;
  observation?: Record<string, unknown>;
};
export type RefreshScenarioSuiteResult =
  | { schema_version: 1; state: "complete"; identity: Record<string, unknown>; measurements: RefreshScenarioMeasurement[];
      summaries: Array<{ scenario: RefreshProfileScenario; repetitions: number; wall_ms: ReturnType<typeof distribution>; generation_process_cpu_us: ReturnType<typeof distribution>; worker_cpu_us: ReturnType<typeof distribution> }>;
      limits: string[] }
  | { schema_version: 1; state: "blocked" | "failed"; code: string; completed_measurements: number; identity?: Record<string, unknown> };
const IDLE_WINDOW_MS = 60_000;
const WATCHER_CALIBRATION = { debounce_ms: 25, event_budget: 2000, poll_interval_ms: 25 } as const;
const ZERO_WORK: RefreshProfileWorkerMetrics["work_counts"] = { directory_enumerations: 0, directory_entries_considered: 0, file_stat_attempts: 0, wildcard_regex_compilations: 0 };

export function resolveRefreshScenarioConfig(argv: readonly string[]): RefreshScenarioConfig {
  if (!isOwningCheckout(process.cwd())) throw new TypeError("Refresh scenario profiling requires the owning checkout root.");
  const values = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 2) {
    const option = argv[index], value = argv[index + 1];
    if (!["--output", "--runs", "--python-files", "--scenario"].includes(option) || value === undefined || values.has(option)) {
      throw new TypeError("Usage: --output <new-private-directory> [--runs 5] [--python-files 320] [--scenario <name>]. External --repo inputs are never writable scenario sources.");
    }
    values.set(option, value);
  }
  if (!values.has("--output")) throw new TypeError("--output is required.");
  const integer = (name: string, defaultValue: number): number => {
    const text = values.get(name) ?? String(defaultValue);
    if (!/^[1-9]\d*$/.test(text) || !Number.isSafeInteger(Number(text))) throw new TypeError(`${name} must be a positive safe integer.`);
    return Number(text);
  };
  const requested = values.get("--scenario");
  if (requested !== undefined && !REFRESH_PROFILE_SCENARIOS.includes(requested as RefreshProfileScenario)) throw new TypeError("Unknown scenario.");
  return { output_root: path.resolve(values.get("--output")!), runs: integer("--runs", 5), python_files: integer("--python-files", 320), scenarios: requested ? [requested as RefreshProfileScenario] : undefined };
}

/** Creates every mutable source itself. There is deliberately no external source argument. */
export async function runRefreshScenarioSuite(config: RefreshScenarioConfig): Promise<RefreshScenarioSuiteResult> {
  let output: string;
  const scenarios = config.scenarios ?? REFRESH_PROFILE_SCENARIOS;
  try {
    if (!isOwningCheckout(process.cwd()) || typeof process.threadCpuUsage !== "function") return { schema_version: 1, state: "blocked", code: "owning_checkout_and_thread_cpu_required", completed_measurements: 0 };
    if (!Number.isSafeInteger(config.runs) || config.runs < 1 || !Number.isSafeInteger(config.python_files) || config.python_files < 1 || scenarios.length === 0 || new Set(scenarios).size !== scenarios.length || scenarios.some(value => !REFRESH_PROFILE_SCENARIOS.includes(value))) {
      return { schema_version: 1, state: "blocked", code: "invalid_configuration", completed_measurements: 0 };
    }
    const requested = path.resolve(config.output_root);
    if (fs.existsSync(requested)) throw new Error("existing_output");
    output = path.join(fs.realpathSync.native(path.dirname(requested)), path.basename(requested));
    fs.mkdirSync(output, { mode: 0o700 });
    writeJson(path.join(output, "owned-scenario-root.json"), { schema_version: 1, purpose: "refresh-profile-owned-scenarios", source_creation: "fresh fixture generator only" });
  } catch { return { schema_version: 1, state: "blocked", code: "new_private_output_required", completed_measurements: 0 }; }
  const runtimeIdentity = runtimeFingerprint();
  const identity: Record<string, unknown> = {
    node_version: process.version, platform: process.platform, arch: process.arch,
    runtime_source_sha256: runtimeIdentity, parameters: { runs: config.runs, python_files: config.python_files, scenarios, idle_window_ms: IDLE_WINDOW_MS, pass_timeout_ms: 60_000, watcher: WATCHER_CALIBRATION },
    input_policy: "each repetition creates a newly owned deterministic Git fixture; no external source is accepted or mutated",
    order: REFRESH_PROFILE_SCENARIOS,
    cpu_scope: "generation process CPU includes harness/controller/worker/V8/profiler and semantic capture; setup and post-measurement input validation excluded"
  };
  const measurements: RefreshScenarioMeasurement[] = [];
  const expectedEvidence = new Map<string, RefreshSemanticEvidence>();
  try {
    for (let run = 1; run <= config.runs; run += 1) {
      const runRoot = path.join(output, `run-${run}`); fs.mkdirSync(runRoot, { mode: 0o700 });
      const fixture = createRefreshBaselineFixture({ parent_root: runRoot, python_files: config.python_files });
      writeJson(path.join(runRoot, "fixture.json"), fixture);
      const expectedContent = new Map(fixture.manifest.map(entry => [entry.path, entry.sha256]));
      const inputMutations: RefreshScenarioMeasurement["input_mutations"] = [];
      const profileRoot = path.join(runRoot, "cold"); fs.mkdirSync(profileRoot, { mode: 0o700 });
      let runtime = createRefreshProfileRuntime({ source: fixture.repo_root, output: profileRoot, max_files: 2000 });
      let watcher: ReturnType<typeof createRepositoryWorkspaceRefreshService> | undefined;
      const progress = (scenario: string, extra: Record<string, unknown> = {}): void => writeJson(path.join(output, "progress.json"), { state: "running", run, scenario, completed_measurements: measurements.length, ...extra });
      const collect = async (measurement: RefreshProfileRun, observation?: Record<string, unknown>): Promise<void> => {
        assertOwnedContent(fixture, expectedContent);
        if (runtimeFingerprint() !== runtimeIdentity) throw new Error("runtime_identity_changed");
        const scenario = measurement.scenario as RefreshProfileScenario;
        const selection = await runtime.store().getLatestPublished({ repo_root: fixture.repo_root });
        if (selection.status !== "selected") throw new Error("published_snapshot_missing");
        const completeEvidence = captureRefreshSemanticEvidence(runtime.store(), selection.snapshot.id);
        const previousEvidence = expectedEvidence.get(scenario);
        if (previousEvidence && compareRefreshSemanticEvidence({ baseline: previousEvidence, candidate: completeEvidence }).state !== "equal") throw new Error("scenario_semantic_mismatch");
        expectedEvidence.set(scenario, completeEvidence);
        writeJson(path.join(runRoot, `${scenario}-semantic-evidence.json`), completeEvidence);
        const full: RefreshScenarioMeasurement = { ...measurement, source_fingerprint: await sourceFingerprint(fixture.repo_root), input_revision: fixture.revision, input_mutations: inputMutations.map(value => ({ ...value })), observation };
        writeJson(path.join(runRoot, `${scenario}.json`), full); measurements.push(full);
      };
      try {
        progress("cold_complete_generation");
        const cold = await measureRefreshGeneration({ runtime, output: profileRoot, run, scenario: "cold_complete_generation", action: () => runtime.controller.request({ repo_root: fixture.repo_root, reason: "startup", source: "refresh-scenario-cold", invalidation_generation: 0 }) });
        if (cold.state !== "complete") throw new Error(cold.code);
        const coldDigest = cold.run.semantic_digest;
        if (scenarios.includes("cold_complete_generation")) await collect(cold.run);
        const databasePath = runtime.database_path;
        await runtime.close();
        const warmOutput = path.join(runRoot, "warm"); fs.mkdirSync(warmOutput, { mode: 0o700 });
        runtime = createRefreshProfileRuntime({ source: fixture.repo_root, output: warmOutput, database_path: databasePath, max_files: 2000 });
        const triggers = new RepositoryRefreshTriggerCoordinator({ repo_root: fixture.repo_root, controller: runtime.controller, publications: runtime.store(), snapshots: runtime.store() });
        if (scenarios.includes("persisted_reuse")) {
          progress("persisted_reuse");
          const measured = await measureWithoutWorkers(runtime, run, "persisted_reuse", async () => {
            const selected = await runtime.store().getLatestPublished({ repo_root: fixture.repo_root });
            if (selected.status !== "selected") throw new Error("persisted_snapshot_missing");
            const validity = await new SnapshotValidityService(runtime.store(), new FilesystemSnapshotPathValidatorAdapter({ repoRoot: fixture.repo_root }), runtime.store()).validate({ snapshot: selected.snapshot, max_paths: DEFAULT_SNAPSHOT_VALIDITY_MAX_PATHS });
            const composition = await discoverRepositoryComposition({ workspace: new WorkspaceFileAdapter({ repoRoot: fixture.repo_root }), git: new GitMetadataCommandAdapter(), repo_root: fixture.repo_root, canonicalize_repo_root: root => fs.realpathSync.native(root) });
            const compositionValidity = classifySnapshotCompositionFreshness({ snapshot: selected.snapshot, current_composition_fingerprint: composition.composition_fingerprint });
            if (validity.state !== "valid" || compositionValidity.state !== "valid") throw new Error("persisted_snapshot_invalid");
          });
          if (measured.semantic_digest !== coldDigest) throw new Error("persisted_reuse_changed_graph");
          await collect(measured, { scope: "canonical persisted first-read path/composition validation; no daemon startup refresh request", database_reopened: true, refresh_workers: 0 });
        }
        if (scenarios.some(name => ["settled_idle", "single_edit", "burst_edits"].includes(name))) {
          watcher = createRepositoryWorkspaceRefreshService({ repoRoot: fixture.repo_root, triggers, watcher: new FilesystemWorkspaceWatcherAdapter(), clock: new SystemClockAdapter(), config: resolveWorkspaceWatcherConfig({ enabled: true, debounce_ms: WATCHER_CALIBRATION.debounce_ms, event_budget: WATCHER_CALIBRATION.event_budget }), indexedRoots: ["."], skippedRoots: [], pollIntervalMs: WATCHER_CALIBRATION.poll_interval_ms });
          const ready = await watcher.poll();
          if (ready?.status === "degraded") throw new Error("watcher_start_failed");
        }
        if (scenarios.includes("settled_idle")) {
          progress("settled_idle", { required_window_ms: IDLE_WINDOW_MS, elapsed_ms: 0 });
          const idle = await measureWithoutWorkers(runtime, run, "settled_idle", async () => {
            const started = performance.now();
            while (performance.now() - started < IDLE_WINDOW_MS) {
              await new Promise<void>(resolve => setTimeout(resolve, Math.min(1000, IDLE_WINDOW_MS - (performance.now() - started))));
              progress("settled_idle", { required_window_ms: IDLE_WINDOW_MS, elapsed_ms: performance.now() - started });
            }
            await watcher!.poll();
          });
          if (idle.semantic_digest !== coldDigest || idle.wall_ms < IDLE_WINDOW_MS) throw new Error("idle_observation_invalid");
          await collect(idle, { actual_idle_window_ms: idle.wall_ms, required_window_ms: IDLE_WINDOW_MS, watcher: "FilesystemWorkspaceWatcherAdapter plus canonical refresh service", refresh_workers: 0 });
        }
        const callers = fixture.manifest.filter(entry => entry.path.startsWith("src/callers/")).map(entry => entry.path);
        if (scenarios.includes("single_edit")) {
          progress("single_edit");
          const directory = path.join(runRoot, "single-edit"); fs.mkdirSync(directory, { mode: 0o700 });
          // The same runtime emits further pass numbers into its private warm directory.
          const edited = await measureRefreshGeneration({ runtime, output: directory, run, scenario: "single_edit", action: async () => {
            mutateOwnedFixture(fixture, callers[0], "\ndef profile_single_edit():\n    return 101\n", "2001-01-02T00:00:00.000Z", expectedContent, inputMutations);
          } });
          if (edited.state !== "complete") throw new Error(edited.code);
          assertPublishedDeclaration(runtime, "profile_single_edit");
          await collect(edited.run, { trigger: "real fs.watch event through canonical queue/coordinator", expected_changed_paths: [callers[0]] });
        }
        if (scenarios.includes("burst_edits")) {
          progress("burst_edits");
          const touched = callers.slice(0, Math.min(3, callers.length));
          const directory = path.join(runRoot, "burst-edits"); fs.mkdirSync(directory, { mode: 0o700 });
          const burst = await measureRefreshGeneration({ runtime, output: directory, run, scenario: "burst_edits", action: async () => {
            for (const [index, file] of touched.entries()) mutateOwnedFixture(fixture, file, `\ndef profile_burst_edit_${index}():\n    return ${201 + index}\n`, "2001-01-03T00:00:00.000Z", expectedContent, inputMutations);
          } });
          if (burst.state !== "complete") throw new Error(burst.code);
          for (let index = 0; index < touched.length; index++) assertPublishedDeclaration(runtime, `profile_burst_edit_${index}`);
          await collect(burst.run, { trigger: "real fs.watch burst through canonical debounce/queue/coordinator", expected_changed_paths: touched });
        }
        if (watcher) { await watcher.close(); watcher = undefined; }
        const normal = await currentDigest(runtime);
        await runtime.close();
        if (scenarios.includes("interrupted_resume")) {
          progress("interrupted_resume");
          const directory = path.join(runRoot, "interrupted"); fs.mkdirSync(directory, { mode: 0o700 });
          runtime = createRefreshProfileRuntime({ source: fixture.repo_root, output: directory, max_files: 2000, pause_committed_continuation: true });
          const resumed = await measureRefreshGeneration({ runtime, output: directory, run, scenario: "interrupted_resume", action: () => runtime.controller.request({ repo_root: fixture.repo_root, reason: "startup", source: "refresh-scenario-resume", invalidation_generation: 0 }) });
          if (resumed.state !== "complete") throw new Error(resumed.code);
          if (!runtime.interruption) throw new Error("continuation_pause_not_exercised");
          if (resumed.run.semantic_digest !== normal) throw new Error("resumed_graph_mismatch");
          await collect(resumed.run, { ...runtime.interruption, limitation: "controlled pause after canonical worker exit and committed durable cursor, before same controller accepts partial result; parent store handle closed/reopened; not worker-crash recovery" });
        }
      } finally {
        await watcher?.close();
        await runtime.close();
      }
    }
    const result: RefreshScenarioSuiteResult = {
      schema_version: 1, state: "complete", identity, measurements,
      summaries: scenarios.map(scenario => {
        const rows = measurements.filter(row => row.scenario === scenario);
        if (rows.length !== config.runs) throw new Error("scenario_measurement_missing");
        return { scenario, repetitions: rows.length, wall_ms: distribution(rows.map(row => row.wall_ms)), generation_process_cpu_us: distribution(rows.map(row => row.generation_process_cpu_us.user + row.generation_process_cpu_us.system)), worker_cpu_us: distribution(rows.map(row => row.worker_cpu_us)) };
      }),
      limits: [
        "All mutation is confined to newly generated owned fixtures. The scenario order is fixed: burst input includes preceding single edit when selected; interrupted input is the final fixed edited source.",
        "Persisted reuse measures the production first-read path/composition validator and zero worker admission; it does not claim daemon startup avoids its explicit startup refresh.",
        "Interrupted resume is a controlled committed-boundary dispatch pause with store-handle reopen in the same controller/session, not crash recovery.",
        "Each idle window is at least 60000ms of real elapsed time with the actual watcher service; no shortened test window satisfies this gate.",
        "work_counts and exclusive phase_timings cover observed production-worker scanner/thread work only. Zero-worker reuse/idle reports zero worker work, not zero parent validator/watcher filesystem I/O; generation-process CPU still includes that parent work.",
        "RSS is sampled process-wide, not an exact peak. Exclusive phase CPU partitions the observed worker interval after debug/TSX imports and before receipt cleanup. Generation-process CPU is the acceptance total and includes all worker startup/teardown, controller, V8 helper and profiler work. OS cache is uncontrolled."
      ]
    };
    writeJson(path.join(output, "report.json"), result); writeJson(path.join(output, "progress.json"), { state: "complete", completed_measurements: measurements.length });
    return result;
  } catch (error) {
    const code = error instanceof Error && /^[a-z_]+$/.test(error.message) ? error.message : "scenario_suite_failed";
    const failed: RefreshScenarioSuiteResult = { schema_version: 1, state: "failed", code, completed_measurements: measurements.length, identity };
    writeJson(path.join(output, "report.json"), failed); writeJson(path.join(output, "progress.json"), failed); return failed;
  }
}

async function measureWithoutWorkers(runtime: RefreshProfileRuntime, run: number, scenario: string, action: () => Promise<void>): Promise<RefreshProfileRun> {
  const before = runtime.controller.getReceipt().worker_invocations;
  const started = performance.now(), cpu = process.cpuUsage();
  await action();
  if (runtime.controller.getReceipt().worker_invocations !== before) throw new Error("unexpected_refresh_worker");
  const selected = await runtime.store().getLatestPublished({ repo_root: runtime.source });
  if (selected.status !== "selected") throw new Error("published_snapshot_missing");
  const evidence = semanticEvidence(runtime.store(), selected.snapshot.id);
  const completeEvidence = captureRefreshSemanticEvidence(runtime.store(), selected.snapshot.id);
  const semanticDigest = hash(JSON.stringify(completeEvidence));
  const evidenceCounts = Object.fromEntries(Object.entries(evidence).map(([key, value]) => [key, value.length]));
  const sampledRss = process.memoryUsage.rss();
  const wallMs = performance.now() - started;
  const processCpu = process.cpuUsage(cpu);
  return { run, scenario, state: "complete", wall_ms: wallMs, worker_cpu_us: 0,
    generation_process_cpu_us: processCpu, observed_process_peak_rss_bytes: sampledRss,
    worker_invocations: 0, passes: [], semantic_digest: semanticDigest, evidence_counts: evidenceCounts,
    work_counts: { ...ZERO_WORK }, phase_timings: [] };
}
async function currentDigest(runtime: RefreshProfileRuntime): Promise<string> {
  const selected = await runtime.store().getLatestPublished({ repo_root: runtime.source });
  if (selected.status !== "selected") throw new Error("published_snapshot_missing");
  return hash(JSON.stringify(captureRefreshSemanticEvidence(runtime.store(), selected.snapshot.id)));
}
function assertPublishedDeclaration(runtime: RefreshProfileRuntime, name: string): void {
  const found = runtime.store().db.prepare("SELECT count(*) AS count FROM nodes JOIN files ON files.id=nodes.file_id JOIN snapshots ON snapshots.id=files.snapshot_id WHERE nodes.name=? AND snapshots.publication_state='published'").get(name) as { count: number };
  if (found.count < 1) throw new Error("edited_declaration_missing");
}
function assertOwnedContent(fixture: RefreshBaselineFixture, expected: Map<string, string>): void {
  const observed: string[] = [];
  const walk = (directory: string): void => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (directory === fixture.repo_root && entry.name === ".git") continue;
      const absolute = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) throw new Error("owned_fixture_identity_changed");
      if (entry.isDirectory()) walk(absolute);
      else if (entry.isFile()) observed.push(path.relative(fixture.repo_root, absolute).split(path.sep).join("/"));
      else throw new Error("owned_fixture_identity_changed");
    }
  };
  walk(fixture.repo_root);
  if (observed.length !== expected.size || observed.some(value => !expected.has(value))) throw new Error("owned_fixture_identity_changed");
  for (const entry of fixture.manifest) {
    const absolute = fs.realpathSync.native(path.join(fixture.repo_root, entry.path));
    const relative = path.relative(fixture.repo_root, absolute);
    if (relative.startsWith("..") || path.isAbsolute(relative) || hash(fs.readFileSync(absolute, "utf8")) !== expected.get(entry.path)) throw new Error("owned_fixture_identity_changed");
  }
}

function mutateOwnedFixture(fixture: RefreshBaselineFixture, relative: string, addition: string, mtime: string, expected: Map<string, string>, mutations: RefreshScenarioMeasurement["input_mutations"]): void {
  if (!expected.has(relative)) throw new Error("unowned_mutation_path");
  assertOwnedContent(fixture, expected);
  const file = path.join(fixture.repo_root, relative), before = expected.get(relative)!;
  fs.appendFileSync(file, addition); const date = new Date(mtime); fs.utimesSync(file, date, date);
  const after = hash(fs.readFileSync(file, "utf8")); expected.set(relative, after); mutations.push({ path: relative, before_sha256: before, after_sha256: after, mtime });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await runRefreshScenarioSuite(resolveRefreshScenarioConfig(process.argv.slice(2)));
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`); if (result.state !== "complete") process.exitCode = 1;
}
