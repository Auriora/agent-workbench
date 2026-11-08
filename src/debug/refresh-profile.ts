/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";
import { MessageChannel, Worker } from "node:worker_threads";
import { discoverRepositoryComposition } from "../application/use-cases/repository-composition.js";
import { RepositoryRefreshTriggerCoordinator } from "../application/use-cases/repository-refresh-triggers.js";
import { GraphBuildManifestPublicationValidator } from "../application/use-cases/validate-graph-build-manifest.js";
import { GitMetadataCommandAdapter } from "../infrastructure/commands/index.js";
import { FileCatalogScannerAdapter, readCapturedGraphBuildPathIdentity, WorkspaceFileAdapter } from "../infrastructure/filesystem/index.js";
import { GraphBuildWatchSession } from "../infrastructure/runtime/graph-build-watch-session.js";
import { restoreGraphBuildWatchCoverage } from "../infrastructure/runtime/restore-graph-build-watch-coverage.js";
import { SnapshotRefreshController } from "../infrastructure/runtime/refresh-controller.js";
import { StartupGraphRefreshExecutor } from "../infrastructure/runtime/startup-graph-refresh-executor.js";
import { openGraphStore, type GraphStore } from "../infrastructure/sqlite/index.js";
import { SystemClockAdapter } from "../infrastructure/time/index.js";
import type { RefreshExecutorPort, SnapshotRefreshControllerReceipt } from "../ports/index.js";
import { createAsyncPublicationPort, createRepositoryWorkspaceRefreshService } from "../server.js";
import { resolveWorkspaceWatcherConfig } from "../domain/models/index.js";
import { captureRefreshSemanticEvidence } from "./refresh-profile-comparison.js";

export type RefreshProfileConfig = {
  repo_root: string;
  output_root: string;
  runs: number;
  max_files: number;
};
export type RefreshProfileWorkerMetrics = {
  schema_version: 1;
  state: "complete" | "failed";
  wall_ms: number;
  thread_cpu_us: { user: number; system: number };
  observed_process_peak_rss_bytes: number;
  progress_intervals: Array<{
    progress: { phase: string; completed_units: number };
    elapsed_ms: number;
    interval_wall_ms: number;
    interval_thread_cpu_us: { user: number; system: number };
    process_rss_bytes: number;
  }>;
  interval_semantics: string;
  rss_semantics: string;
  profile_path: string;
  work_counts: { directory_enumerations: number; directory_entries_considered: number; file_stat_attempts: number; wildcard_regex_compilations: number };
  phase_timings: Array<{ phase: string; wall_ms: number; thread_cpu_us: { user: number; system: number } }>;
  work_counts_observed: true;
  thread_cpu_semantics?: string;
  work_count_semantics?: string;
  phase_semantics?: string;
};
export type RefreshProfileRun = {
  run: number;
  scenario: string;
  state: "complete";
  wall_ms: number;
  worker_cpu_us: number;
  generation_process_cpu_us: { user: number; system: number };
  observed_process_peak_rss_bytes: number;
  worker_invocations: number;
  passes: RefreshProfileWorkerMetrics[];
  semantic_digest: string;
  evidence_counts: Record<string, number>;
  format_admission: Array<{ path: string; language: string; format_evidence: "positive_qt" | "unconfirmed" }>;
  work_counts: RefreshProfileWorkerMetrics["work_counts"];
  phase_timings: RefreshProfileWorkerMetrics["phase_timings"];
};
export type RefreshProfileResult =
  | { schema_version: 1; state: "complete"; identity: Record<string, unknown>; runs: RefreshProfileRun[];
      summary: { wall_ms: Distribution; worker_cpu_us: Distribution; generation_process_cpu_us: Distribution; observed_process_peak_rss_bytes: Distribution };
      metric_limits: string[] }
  | { schema_version: 1; state: "blocked" | "failed"; code: string; completed_runs: number; identity?: Record<string, unknown> };
type Distribution = { median: number; min: number; max: number };
const checkoutRoot = fileURLToPath(new URL("../../", import.meta.url));
const PASS_TIMEOUT_MS = 60_000;

export function resolveRefreshProfileConfig(argv: readonly string[], cwd = process.cwd()): RefreshProfileConfig {
  if (!isOwningCheckout(cwd)) throw new TypeError("Refresh profiler must run from the agent-workbench checkout root.");
  const values = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 2) {
    const name = argv[index];
    const value = argv[index + 1];
    if (!["--repo", "--output", "--runs", "--max-files"].includes(name) || value === undefined || values.has(name)) {
      throw new TypeError("Usage: --repo <source> --output <new-private-directory> [--runs 5] [--max-files 2000]");
    }
    values.set(name, value);
  }
  if (!values.has("--repo") || !values.has("--output")) throw new TypeError("--repo and --output are required.");
  return {
    repo_root: path.resolve(values.get("--repo")!), output_root: path.resolve(values.get("--output")!),
    runs: integerOption(values.get("--runs") ?? "5", "runs"),
    max_files: integerOption(values.get("--max-files") ?? "2000", "max-files")
  };
}

export async function runRefreshProfile(config: RefreshProfileConfig): Promise<RefreshProfileResult> {
  let output: string;
  let source: string;
  try {
    if (!isOwningCheckout(process.cwd())) return { schema_version: 1, state: "blocked", code: "owning_checkout_required", completed_runs: 0 };
    if (typeof process.threadCpuUsage !== "function") return { schema_version: 1, state: "blocked", code: "worker_thread_cpu_unavailable", completed_runs: 0 };
    if (!Number.isSafeInteger(config.runs) || config.runs < 1 || !Number.isSafeInteger(config.max_files) || config.max_files < 1) {
      return { schema_version: 1, state: "blocked", code: "invalid_configuration", completed_runs: 0 };
    }
    source = fs.realpathSync.native(config.repo_root);
    if (!fs.statSync(source).isDirectory()) return { schema_version: 1, state: "blocked", code: "source_not_directory", completed_runs: 0 };
    output = validateOutputRoot(source, config.output_root);
  } catch {
    return { schema_version: 1, state: "blocked", code: "unsafe_or_unavailable_source_output", completed_runs: 0 };
  }
  try {
    fs.mkdirSync(output, { mode: 0o700 });
  } catch {
    return { schema_version: 1, state: "blocked", code: "private_output_unavailable", completed_runs: 0 };
  }
  let runtimeIdentity: string;
  let sourceIdentity: Record<string, unknown>;
  let sourceFingerprintBefore: string;
  try {
    runtimeIdentity = runtimeFingerprint();
    sourceIdentity = await gitIdentity(source);
    sourceFingerprintBefore = await sourceFingerprint(source);
  } catch {
    const blocked: RefreshProfileResult = { schema_version: 1, state: "blocked", code: "source_identity_unavailable", completed_runs: 0 };
    writeJson(path.join(output, "report.json"), blocked);
    return blocked;
  }
  const identity = {
    node_version: process.version, platform: process.platform, arch: process.arch,
    runtime_source_sha256: runtimeIdentity, source: sourceIdentity, admitted_source_sha256: sourceFingerprintBefore,
    parameters: { runs: config.runs, max_files: config.max_files, pass_timeout_ms: PASS_TIMEOUT_MS },
    profiler_scope: "CPU profile captures the canonical production worker in its isolate; debug/TSX imports preceding instrumentation and final receipt cleanup are outside worker receipt timing",
    cache_state: "new database and new worker isolate per cold run; OS filesystem cache is uncontrolled"
  };
  const runs: RefreshProfileRun[] = [];
  try {
    for (let index = 1; index <= config.runs; index += 1) {
      writeJson(path.join(output, "progress.json"), { state: "running", run: index, completed_runs: runs.length });
      const runDirectory = path.join(output, `run-${index}`);
      fs.mkdirSync(runDirectory, { mode: 0o700 });
      const result = await runColdGeneration(source, runDirectory, config.max_files, index);
      if (result.state !== "complete") {
        const failed: RefreshProfileResult = { schema_version: 1, state: "failed", code: result.code, completed_runs: runs.length, identity };
        writeJson(path.join(output, "report.json"), failed);
        writeJson(path.join(output, "progress.json"), failed);
        return failed;
      }
      runs.push(result.run);
      writeJson(path.join(runDirectory, "metrics.json"), result.run);
      if (runtimeFingerprint() !== runtimeIdentity || JSON.stringify(await gitIdentity(source)) !== JSON.stringify(sourceIdentity) || await sourceFingerprint(source) !== sourceFingerprintBefore) {
        throw new Error("input_identity_changed");
      }
      if (runs[0].semantic_digest !== result.run.semantic_digest) throw new Error("cold_run_semantic_mismatch");
    }
    const report: RefreshProfileResult = {
      schema_version: 1, state: "complete", identity, runs,
      summary: {
        wall_ms: distribution(runs.map(run => run.wall_ms)),
        worker_cpu_us: distribution(runs.map(run => run.worker_cpu_us)),
        generation_process_cpu_us: distribution(runs.map(run => run.generation_process_cpu_us.user + run.generation_process_cpu_us.system)),
        observed_process_peak_rss_bytes: distribution(runs.map(run => run.observed_process_peak_rss_bytes))
      },
      metric_limits: [
        "Progress intervals are milestone observations; phase_timings are exclusive boundary intervals whose wall/thread CPU totals reconcile to each worker receipt.",
        "RSS is sampled process-wide at milestones/settlement, not exact peak or per-worker heap.",
        "Worker receipt CPU is thread-local from after debug/TSX imports until before final receipt emission/cleanup. Generation process CPU is the acceptance total: parent/controller, all worker startup/teardown, V8 helper threads, profiling and semantic capture; pre/post-run source/runtime fingerprinting is excluded.",
        "Exact work_counts cover the observed production worker scanner: directory enumerations, entries considered, file identity-stat attempts and actual ignore/priority wildcard compilations. Parent validation/watcher/fingerprint filesystem work is outside these worker counters.",
        "This command exercises cold complete generations only; persisted reuse, idle, edits and interrupted-resume remain separate scenario work."
      ]
    };
    writeJson(path.join(output, "report.json"), report);
    writeJson(path.join(output, "progress.json"), { state: "complete", completed_runs: runs.length });
    return report;
  } catch (error) {
    const failure: RefreshProfileResult = { schema_version: 1, state: "failed", code: error instanceof Error && ["input_identity_changed", "cold_run_semantic_mismatch"].includes(error.message) ? error.message : "profile_harness_failure", completed_runs: runs.length, identity };
    writeJson(path.join(output, "report.json"), failure);
    writeJson(path.join(output, "progress.json"), failure);
    return failure;
  }
}

export type RefreshProfileRuntime = {
  source: string;
  database_path: string;
  controller: SnapshotRefreshController;
  triggers: RepositoryRefreshTriggerCoordinator;
  workspace_refresh: ReturnType<typeof createRepositoryWorkspaceRefreshService>;
  watcher: GraphBuildWatchSession;
  store(): GraphStore;
  passes: RefreshProfileWorkerMetrics[];
  settlements: Promise<void>[];
  profileFailed(): boolean;
  close(): Promise<void>;
  interruption?: { kind: "paused_committed_worker_continuation"; target_snapshot_id: string; cursor: string; owner_id: string; pause_ms: number; restored_cursor: string };
};

/** All benchmark scenarios share this exact controller/executor/worker wiring. */
export function createRefreshProfileRuntime(input: {
  source: string;
  output: string;
  database_path?: string;
  max_files: number;
  pause_committed_continuation?: boolean;
}): RefreshProfileRuntime {
  const sourceRoot = fs.realpathSync.native(input.source);
  const outputRoot = fs.realpathSync.native(input.output);
  const requestedDatabase = input.database_path ?? path.join(outputRoot, "graph.sqlite");
  const databasePath = path.join(fs.realpathSync.native(path.dirname(requestedDatabase)), path.basename(requestedDatabase));
  if (within(sourceRoot, outputRoot) || within(outputRoot, sourceRoot) || within(sourceRoot, databasePath) ||
      (fs.existsSync(databasePath) && fs.lstatSync(databasePath).isSymbolicLink())) {
    throw new TypeError("Source and profiling storage must be disjoint canonical paths.");
  }
  let store = openGraphStore(databasePath);
  const passes: RefreshProfileWorkerMetrics[] = [];
  const settlements: Promise<void>[] = [];
  let passNumber = 0;
  let profileReceiptFailure = false;
  let paused = false;
  const clock = new SystemClockAdapter();
  const controllerGeneration = Date.now();
  const watcher = new GraphBuildWatchSession({
    repo_root: sourceRoot,
    paths: ["."],
    skipped_roots: [],
    enabled: true,
    debounce_ms: 25,
    event_budget: 2000
  });
  // The production executor requires a ready, healthy root watch before it
  // snapshots workerData. Admission waits on this same session; no profile-only
  // observer substitutes for the daemon watcher.
  const watcherReady = watcher.start().then(async () => {
    await restoreGraphBuildWatchCoverage({
      repo_root: sourceRoot,
      store: async () => store,
      watcher,
      read_identity: async (expected) => readCapturedGraphBuildPathIdentity(sourceRoot, expected)
    });
  });
  const publication = createAsyncPublicationPort(async () => store);
  const validation = new GraphBuildManifestPublicationValidator({
    store: async () => store,
    watcher,
    read_identity: async (expected) => readCapturedGraphBuildPathIdentity(sourceRoot, expected),
    clock,
    on_published: ({ directories }) => watcher.establishCoverage({ directories })
  });
  const executor = new StartupGraphRefreshExecutor({
    database_path: databasePath, config_identity: "default", max_files: input.max_files,
    retain_latest_snapshots: 3, retain_latest_fresh_snapshots: 2, controller_generation: controllerGeneration,
    observation: watcher,
    worker_factory({ workerData }) {
      passNumber += 1;
      const { port1, port2 } = new MessageChannel();
      const profilePath = path.join(input.output, `pass-${passNumber}.cpuprofile`);
      const worker = new Worker(new URL("./refresh-profile-worker-entrypoint.mjs", import.meta.url), {
        workerData: { ...workerData, refreshProfile: { port: port2, profile_path: profilePath } }, transferList: [port2]
      });
      settlements.push(new Promise<void>(resolve => {
        let receipt: unknown;
        port1.on("message", value => { receipt = value; });
        // A transferred port drains its final message before close, including
        // worker death; Worker.exit and MessagePort.message have independent queues.
        port1.once("close", () => {
          if (validMetrics(receipt)) passes.push(receipt);
          else profileReceiptFailure = true;
          resolve();
        });
      }));
      return worker;
    }
  });
  let runtime: RefreshProfileRuntime;
  let closePromise: Promise<void> | undefined;
  const observedExecutor: RefreshExecutorPort = {
    async run(request) {
      await watcherReady;
      const result = await executor.run(request);
      if (input.pause_committed_continuation && !paused && result.results.some(value =>
        typeof value === "object" && value !== null && "outcome" in value && value.outcome === "partial"
      )) {
        paused = true;
        const before = await store.getGraphBuildProgress({ snapshot_id: request.target_snapshot_id });
        if (!before?.scan_cursor || !before.owner_id || before.phase === "complete") throw new Error("committed_continuation_missing");
        // The canonical worker has exited, but its result has not yet been
        // accepted by this same controller. No writer runs during the pause.
        store.close();
        const pauseStarted = performance.now();
        await new Promise<void>(resolve => setTimeout(resolve, 100));
        store = openGraphStore(databasePath);
        const after = await store.getGraphBuildProgress({ snapshot_id: request.target_snapshot_id });
        if (!after || after.scan_cursor !== before.scan_cursor || after.owner_id !== before.owner_id) {
          throw new Error("committed_continuation_changed");
        }
        runtime.interruption = {
          kind: "paused_committed_worker_continuation", target_snapshot_id: request.target_snapshot_id,
          cursor: before.scan_cursor, owner_id: before.owner_id, pause_ms: performance.now() - pauseStarted,
          restored_cursor: after.scan_cursor!
        };
      }
      return result;
    },
    terminate(request) { return executor.terminate(request); }
  };
  const controller = new SnapshotRefreshController({
    repo_root: input.source, controller_generation: controllerGeneration, timeout_ms: PASS_TIMEOUT_MS,
    clock, executor: observedExecutor, publication, validation
  });
  const triggers = new RepositoryRefreshTriggerCoordinator({
    repo_root: input.source,
    controller,
    publications: publication,
    // The controlled continuation pause reopens this handle. Resolve writes
    // at use time just like publication/validation reads, not against the
    // physical connection captured before the pause.
    snapshots: { markSnapshotFreshness: request => store.markSnapshotFreshness(request) }
  });
  const workspaceRefresh = createRepositoryWorkspaceRefreshService({
    repoRoot: input.source,
    triggers,
    observation: watcher,
    clock,
    config: resolveWorkspaceWatcherConfig({ enabled: true, debounce_ms: 25, event_budget: 2000 }),
    indexedRoots: ["."],
    skippedRoots: [],
    pollIntervalMs: 25
  });
  runtime = {
    source: input.source, database_path: databasePath, controller, triggers, workspace_refresh: workspaceRefresh, watcher, store: () => store,
    passes, settlements, profileFailed: () => profileReceiptFailure,
    close() {
      closePromise ??= (async () => {
        await controller.shutdown();
        await workspaceRefresh.close();
        await Promise.all(settlements);
        store.close();
        await watcher.close();
      })();
      return closePromise;
    }
  };
  return runtime;
}

export async function measureRefreshGeneration(input: {
  runtime: RefreshProfileRuntime;
  output: string;
  run: number;
  scenario: string;
  action(): Promise<unknown>;
}): Promise<{ state: "complete"; run: RefreshProfileRun } | { state: "failed"; code: string }> {
  const runtime = input.runtime;
  const passOffset = runtime.passes.length;
  const settlementOffset = runtime.settlements.length;
  const invocationOffset = runtime.controller.getReceipt().worker_invocations;
  const started = performance.now();
  const generationCpu = process.cpuUsage();
  let off = (): void => {};
  let admissionTimer: ReturnType<typeof setTimeout> | undefined;
  try {
    const completion = new Promise<SnapshotRefreshControllerReceipt>((resolve, reject) => {
      off = runtime.controller.onTransition(transition => {
        if (admissionTimer !== undefined) { clearTimeout(admissionTimer); admissionTimer = undefined; }
        if (transition.state === "terminal") { off(); resolve(runtime.controller.getReceipt()); }
      });
      // This bounds observing admission, not the production worker's hard pass
      // deadline. A missing watcher trigger is failed evidence, never a retry.
      admissionTimer = setTimeout(() => { off(); reject(new Error("refresh_admission_not_observed")); }, 5_000);
    });
    const action = await input.action();
    if (typeof action === "object" && action !== null && "outcome" in action && action.outcome === "blocked") {
      if (admissionTimer !== undefined) clearTimeout(admissionTimer);
      off();
      return { state: "failed", code: "refresh_admission_blocked" };
    }
    const terminal = await completion;
    await Promise.all(runtime.settlements.slice(settlementOffset));
    if (terminal.execution_state !== "complete") {
      await writeProfileFailureEvidence(runtime, input.output, terminal);
      return { state: "failed", code: terminal.last_failure?.code ?? "refresh_failed" };
    }
    const passes = runtime.passes.slice(passOffset);
    const workerInvocations = terminal.worker_invocations - invocationOffset;
    if (runtime.profileFailed() || passes.length !== workerInvocations || passes.some(pass => pass.state !== "complete")) {
      return { state: "failed", code: "missing_or_invalid_worker_profile" };
    }
    const selected = await runtime.store().getLatestPublished({ repo_root: runtime.source });
    if (selected.status !== "selected") return { state: "failed", code: "complete_snapshot_not_published" };
    const evidence = semanticEvidence(runtime.store(), selected.snapshot.id);
    const completeEvidence = captureRefreshSemanticEvidence(runtime.store(), selected.snapshot.id);
    writeJson(path.join(input.output, "semantic-evidence.json"), completeEvidence);
    const workCounts = { directory_enumerations: 0, directory_entries_considered: 0, file_stat_attempts: 0, wildcard_regex_compilations: 0 };
    for (const pass of passes) for (const name of Object.keys(workCounts) as Array<keyof typeof workCounts>) workCounts[name] += pass.work_counts[name];
    const semanticDigest = hash(JSON.stringify(completeEvidence));
    const evidenceCounts = Object.fromEntries(Object.entries(evidence).map(([key, value]) => [key, value.length]));
    const formatAdmission = formatAdmissionEvidence(runtime.store(), selected.snapshot.id);
    const workerCpu = passes.reduce((sum, pass) => sum + pass.thread_cpu_us.user + pass.thread_cpu_us.system, 0);
    const peakRss = Math.max(process.memoryUsage.rss(), ...passes.map(pass => pass.observed_process_peak_rss_bytes));
    const phaseTimings = passes.flatMap(pass => pass.phase_timings);
    const wallMs = performance.now() - started;
    const processCpu = process.cpuUsage(generationCpu);
    return { state: "complete", run: {
      run: input.run, scenario: input.scenario, state: "complete", wall_ms: wallMs,
      worker_cpu_us: workerCpu, generation_process_cpu_us: processCpu,
      observed_process_peak_rss_bytes: peakRss, worker_invocations: workerInvocations, passes,
      semantic_digest: semanticDigest, evidence_counts: evidenceCounts,
      format_admission: formatAdmission,
      work_counts: workCounts, phase_timings: phaseTimings
    } };
  } catch (error) {
    await writeProfileFailureEvidence(runtime, input.output, runtime.controller.getReceipt(), error);
    return { state: "failed", code: error instanceof Error && error.message === "refresh_admission_not_observed" ? error.message : "refresh_measurement_failed" };
  } finally {
    off();
    if (admissionTimer !== undefined) clearTimeout(admissionTimer);
  }
}

/** Durable, bounded diagnostics for a failed measured generation. */
async function writeProfileFailureEvidence(
  runtime: RefreshProfileRuntime,
  output: string,
  receipt: SnapshotRefreshControllerReceipt,
  error?: unknown
): Promise<void> {
  try {
    const manifests = runtime.store().db.prepare(`
      SELECT manifests.manifest_id, manifests.state, manifests.invalid_reason,
        manifests.owner_id, manifests.controller_generation,
        manifests.invalidation_generation, manifests.watcher_epoch,
        manifests.watcher_sequence, progress.snapshot_id
      FROM graph_build_manifests AS manifests
      LEFT JOIN graph_build_progress AS progress ON progress.manifest_id = manifests.manifest_id
      WHERE manifests.repo_root = ?
      ORDER BY manifests.started_at DESC
      LIMIT 8
    `).all(runtime.source) as Array<Record<string, unknown>>;
    writeJson(path.join(output, "failure-evidence.json"), {
      schema_version: 1,
      state: "failed",
      controller_receipt: receipt,
      error: error instanceof Error ? { name: error.name, message: error.message } : undefined,
      manifests
    });
  } catch {
    // The original refresh failure remains the diagnostic authority.
  }
}

async function runColdGeneration(source: string, output: string, maxFiles: number, run: number): Promise<
  { state: "complete"; run: RefreshProfileRun } | { state: "failed"; code: string }
> {
  const runtime = createRefreshProfileRuntime({ source, output, max_files: maxFiles });
  try {
    return await measureRefreshGeneration({ runtime, output, run, scenario: "cold_complete_generation", action: () =>
      runtime.triggers.startup({ source: "refresh-profile" })
    });
  } finally { await runtime.close(); }
}

/** Report selected catalog admission without another source read or detector path. */
export function formatAdmissionEvidence(store: GraphStore, snapshotId: string): RefreshProfileRun["format_admission"] {
  const files = store.db.prepare("SELECT path,language FROM files WHERE snapshot_id=? ORDER BY path")
    .all(Number(snapshotId)) as Array<{ path: string; language: string }>;
  return files.filter(file => path.extname(file.path).toLowerCase() === ".ts").map(file => ({
    ...file,
    format_evidence: file.language === "xml" ? "positive_qt" : "unconfirmed"
  }));
}

export function semanticEvidence(store: GraphStore, snapshotId: string): Record<string, string[]> {
  const files = store.db.prepare("SELECT id,path,language,content_hash,size_bytes,node_count,indexing_error FROM files WHERE snapshot_id=? ORDER BY path").all(Number(snapshotId)) as Array<Record<string, unknown>>;
  const nodes = store.db.prepare("SELECT nodes.*,files.path FROM nodes JOIN files ON files.id=nodes.file_id WHERE files.snapshot_id=? ORDER BY nodes.id").all(Number(snapshotId)) as Array<Record<string, unknown>>;
  const nodeKeys = new Map(nodes.map(node => [String(node.id), hash(JSON.stringify([node.path,node.kind,node.name,node.qualified_name,node.language,node.start_line,node.start_column,node.end_line,node.end_column]))]));
  const normalize = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(normalize);
    if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).sort(([a],[b]) => a.localeCompare(b)).map(([key,item]) => [key,normalize(item)]));
    if (typeof value === "string") return nodeKeys.get(value) ?? value.replaceAll(`${snapshotId}:`, "snapshot:");
    return value;
  };
  const rowHash = (row: Record<string, unknown>, omit: string[] = []): string => hash(JSON.stringify(normalize(Object.fromEntries(Object.entries(row).filter(([key]) => !omit.includes(key)).map(([key,value]) => [key,key.endsWith("_json") && typeof value === "string" ? JSON.parse(value) : value])))));
  const edges = store.db.prepare("SELECT edges.*,files.path FROM edges JOIN files ON files.id=edges.file_id WHERE files.snapshot_id=?").all(Number(snapshotId)) as Array<Record<string,unknown>>;
  const unresolved = store.db.prepare("SELECT unresolved_refs.*,files.path FROM unresolved_refs JOIN files ON files.id=unresolved_refs.file_id WHERE files.snapshot_id=?").all(Number(snapshotId)) as Array<Record<string,unknown>>;
  const docs = store.db.prepare("SELECT path,title,content_hash,byte_count,selected_text_truncated FROM docs_documents WHERE snapshot_id=?").all(Number(snapshotId)) as Array<Record<string,unknown>>;
  return {
    files: files.map(row => rowHash(row,["id"])).sort(),
    nodes: nodes.map(row => rowHash(row,["id","file_id"])).sort(),
    edges: edges.map(row => rowHash(row,["id","file_id"])).sort(),
    unresolved: unresolved.map(row => rowHash(row,["id","file_id"])).sort(),
    docs: docs.map(row => rowHash(row)).sort()
  };
}

function validMetrics(value: unknown): value is RefreshProfileWorkerMetrics {
  if (!value || typeof value !== "object") return false;
  const metrics = value as Partial<RefreshProfileWorkerMetrics>;
  return metrics.schema_version === 1 && (metrics.state === "complete" || metrics.state === "failed") &&
    Number.isFinite(metrics.wall_ms) && typeof metrics.thread_cpu_us?.user === "number" &&
    typeof metrics.thread_cpu_us.system === "number" && typeof metrics.observed_process_peak_rss_bytes === "number" &&
    Array.isArray(metrics.progress_intervals) && typeof metrics.profile_path === "string" &&
    metrics.work_counts_observed === true && !!metrics.work_counts &&
    ["directory_enumerations", "directory_entries_considered", "file_stat_attempts", "wildcard_regex_compilations"].every(name => Number.isSafeInteger(metrics.work_counts![name as keyof typeof metrics.work_counts]) && metrics.work_counts![name as keyof typeof metrics.work_counts] >= 0) &&
    Array.isArray(metrics.phase_timings) && metrics.phase_timings.length > 0 &&
    metrics.phase_timings.every(phase => typeof phase.phase === "string" && Number.isFinite(phase.wall_ms) && phase.wall_ms >= 0 && Number.isFinite(phase.thread_cpu_us?.user) && phase.thread_cpu_us.user >= 0 && Number.isFinite(phase.thread_cpu_us?.system) && phase.thread_cpu_us.system >= 0) &&
    Math.abs(metrics.phase_timings.reduce((sum, phase) => sum + phase.wall_ms, 0) - metrics.wall_ms!) < 0.01 &&
    metrics.phase_timings.reduce((sum, phase) => sum + phase.thread_cpu_us.user, 0) === metrics.thread_cpu_us.user &&
    metrics.phase_timings.reduce((sum, phase) => sum + phase.thread_cpu_us.system, 0) === metrics.thread_cpu_us.system;
}
export function isOwningCheckout(cwd: string): boolean {
  try {
    return fs.realpathSync.native(cwd) === fs.realpathSync.native(checkoutRoot);
  } catch { return false; }
}
function validateOutputRoot(source: string, requested: string): string {
  const requestedOutput = path.resolve(requested);
  if (fs.existsSync(requestedOutput)) throw new Error("Output must be new.");
  const output = path.join(fs.realpathSync.native(path.dirname(requestedOutput)), path.basename(requestedOutput));
  if (within(source, output) || within(output, source)) throw new Error("Source and output must be disjoint.");
  return output;
}
function within(root: string, candidate: string): boolean {
  const relative = path.relative(root,candidate);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
}
export async function sourceFingerprint(source: string): Promise<string> {
  const composition = await discoverRepositoryComposition({
    workspace: new WorkspaceFileAdapter({ repoRoot: source }),
    git: new GitMetadataCommandAdapter(), repo_root: source,
    canonicalize_repo_root: root => fs.realpathSync.native(root)
  });
  if (composition.truncated) throw new Error("input_identity_unavailable");
  const catalog = await new FileCatalogScannerAdapter().scan({
    repo_root: source, indexed_roots: ["."], skipped_roots: [],
    max_files: Number.MAX_SAFE_INTEGER, repository_composition: composition
  });
  if (catalog.truncated) throw new Error("input_identity_unavailable");
  const digester = crypto.createHash("sha256").update(composition.composition_fingerprint);
  for (const entry of [...catalog.files].sort((a,b) => a.path.localeCompare(b.path))) {
    const absolute = fs.realpathSync.native(path.join(source, entry.path));
    if (!within(source, absolute)) throw new Error("input_identity_unavailable");
    digester.update(entry.path).update(fs.readFileSync(absolute));
  }
  return digester.digest("hex");
}
export function runtimeFingerprint(): string {
  const digester = crypto.createHash("sha256");
  const walk = (directory: string): void => {
    for (const entry of fs.readdirSync(directory,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))) {
      const file=path.join(directory,entry.name);
      if(entry.isDirectory()) walk(file);
      else if(entry.isFile() && /\.(?:ts|mjs)$/.test(entry.name)) digester.update(path.relative(checkoutRoot,file)).update(fs.readFileSync(file));
    }
  };
  walk(path.join(checkoutRoot,"src"));
  digester.update(fs.readFileSync(path.join(checkoutRoot,"package.json")));
  digester.update(fs.readFileSync(path.join(checkoutRoot,"pnpm-lock.yaml")));
  return digester.digest("hex");
}
export async function gitIdentity(source: string): Promise<Record<string, unknown>> {
  const git = new GitMetadataCommandAdapter();
  const [head, cleanliness] = await Promise.all([
    git.inspectRepositoryHead({ repo_root: source }),
    git.inspectRepositoryCleanliness({ repo_root: source })
  ]);
  return {
    state: head.status === "available" && cleanliness.status === "available" ? "available" : "blocked",
    head: head.status === "available"
      ? { status: "available", head_object_id: head.head_object_id }
      : { status: "blocked", reason: head.reason },
    cleanliness: cleanliness.status === "available"
      ? { status: "available", cleanliness: cleanliness.cleanliness, changed_paths_sha256: hash(JSON.stringify(cleanliness.changed_paths)) }
      : { status: "blocked", reason: cleanliness.reason },
    claim: head.status === "available" && cleanliness.status === "available"
      ? "bounded read-only canonical Git metadata; admitted-source content is fingerprinted separately"
      : "Git identity evidence is blocked; only admitted-source content and graph evidence are characterized"
  };
}
export function hash(value:string):string{return crypto.createHash("sha256").update(value).digest("hex");}
function integerOption(value:string,name:string):number {if(!/^[1-9]\d*$/.test(value)||!Number.isSafeInteger(Number(value)))throw new TypeError(`${name} must be a positive safe integer.`);return Number(value);}
export function distribution(values:number[]):Distribution {const sorted=[...values].sort((a,b)=>a-b);const mid=Math.floor(sorted.length/2);return {median:sorted.length%2?sorted[mid]:(sorted[mid-1]+sorted[mid])/2,min:sorted[0],max:sorted.at(-1)!};}
export function writeJson(file:string,value:unknown):void{fs.writeFileSync(file,`${JSON.stringify(value,null,2)}\n`,{mode:0o600});}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await runRefreshProfile(resolveRefreshProfileConfig(process.argv.slice(2)));
  process.stdout.write(`${JSON.stringify(result,null,2)}\n`);
  if(result.state!=="complete")process.exitCode=1;
}
