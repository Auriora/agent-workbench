#!/usr/bin/env node
/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// Installed-package convergence smoke (Spec 041, T008). This deliberately
// packs and installs the npm payload before launching its installed bin. The
// provider labels below identify MCP sessions only; they do not claim that the
// real Codex or Claude Code CLI loaded the plugin.
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";

const repoRoot = process.cwd();
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "agent-workbench-installed-smoke-"));
const packRoot = path.join(tempRoot, "pack");
const installRoot = path.join(tempRoot, "install");
const stateRoot = path.join(tempRoot, "state");
// Unix-domain socket paths are short (typically about 108 bytes), so keep the
// isolated runtime root separate and deliberately compact.
const runtimeRoot = fs.mkdtempSync(path.join(os.tmpdir(), "awb-runtime-"));
const npmCacheRoot = path.join(tempRoot, "npm-cache");
const workspaceRoot = path.join(tempRoot, "workspace");
const sessions = [];
let daemonPid;
let daemonSocketPath;

for (const directory of [packRoot, installRoot, stateRoot, runtimeRoot, npmCacheRoot]) {
  fs.mkdirSync(directory, { recursive: true });
}

const isolatedEnv = {
  ...process.env,
  HOME: stateRoot,
  USERPROFILE: stateRoot,
  LOCALAPPDATA: path.join(stateRoot, "AppData", "Local"),
  XDG_CACHE_HOME: path.join(stateRoot, "cache"),
  XDG_DATA_HOME: path.join(stateRoot, "data"),
  XDG_STATE_HOME: path.join(stateRoot, "state"),
  TMPDIR: runtimeRoot,
  TMP: runtimeRoot,
  TEMP: runtimeRoot,
  npm_config_cache: npmCacheRoot
};
delete isolatedEnv.AGENT_WORKBENCH_INSTALL_ROOT;
delete isolatedEnv.NODE_PATH;

let receipt;
let failure;
let cleanup = {
  clients_closed: false,
  daemon_stopped: false,
  socket_removed: false,
  metadata_removed: false,
  temporary_root_removed: false
};

try {
  receipt = await runSmoke();
} catch (error) {
  failure = error;
} finally {
  try {
    cleanup = await cleanupSmoke();
  } catch (error) {
    failure ??= error;
  }
}

if (failure !== undefined) {
  process.stderr.write(`installed-package-mcp-smoke FAIL: ${safeErrorMessage(failure)}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(`installed-package-mcp-smoke OK ${JSON.stringify({
    ...receipt,
    cleanup
  })}\n`);
}

async function runSmoke() {
  const packed = packCheckout();
  installTarball(packed.tarballPath);

  const installedPackageRoot = path.join(
    installRoot,
    "node_modules",
    "@auriora",
    "agent-workbench"
  );
  const installedManifestPath = path.join(installedPackageRoot, "package.json");
  assert(fs.existsSync(installedManifestPath), "installed package.json is present");
  const installedManifest = JSON.parse(fs.readFileSync(installedManifestPath, "utf8"));
  assert(installedManifest.name === "@auriora/agent-workbench", "installed package identity matches");
  assert(typeof installedManifest.version === "string", "installed package version is present");

  const installedBin = path.join(installRoot, "node_modules", ".bin", "agent-workbench-mcp");
  assert(fs.existsSync(installedBin), "installed agent-workbench-mcp bin is present");
  const installedBinRealPath = fs.realpathSync(installedBin);
  assert(
    isInside(installedPackageRoot, installedBinRealPath),
    "installed bin resolves inside the isolated installed package"
  );
  assert(!isInside(repoRoot, installedBinRealPath), "installed bin does not resolve into the checkout");

  createWorkspaceFixture();

  const codex = trackSession(startInstalledSession({
    binPath: installedBin,
    provider: "codex",
    pluginVersion: installedManifest.version,
    startupRefreshDelayMs: 0
  }));
  await initializeSession(codex, "codex");
  const baselineStatus = await waitForFreshStatus(codex, undefined, 60_000);
  const oldSnapshotId = requiredString(baselineStatus.data.snapshot_id, "baseline snapshot id");
  const baselineHealth = await readHealth(codex);
  const baselineDaemon = requiredDaemon(baselineHealth);
  const baselineWorkerInvocations = requiredNonNegativeInteger(
    baselineDaemon.worker_invocations,
    "baseline worker_invocations"
  );
  daemonPid = baselineDaemon.pid;
  daemonSocketPath = baselineDaemon.socket_path;
  assert(
    isInside(runtimeRoot, daemonSocketPath),
    "daemon socket is inside the isolated runtime directory"
  );

  const claude = trackSession(startInstalledSession({
    binPath: installedBin,
    provider: "claude_code",
    pluginVersion: installedManifest.version,
    startupRefreshDelayMs: 60_000
  }));
  await initializeSession(claude, "claude_code");

  const [codexInitialHealth, claudeInitialHealth] = await Promise.all([
    readHealth(codex),
    readHealth(claude)
  ]);
  assertProviderIdentity(codexInitialHealth, "codex", installedManifest.version);
  assertProviderIdentity(claudeInitialHealth, "claude_code", installedManifest.version);
  const codexInitialDaemon = requiredDaemon(codexInitialHealth);
  const claudeInitialDaemon = requiredDaemon(claudeInitialHealth);
  assert(codexInitialDaemon.pid === claudeInitialDaemon.pid, "both sessions share one daemon PID");
  assert(
    Math.max(codexInitialDaemon.connected_clients, claudeInitialDaemon.connected_clients) >= 2,
    "shared daemon observes both connected clients"
  );

  const deletedSource = path.join(workspaceRoot, "src", "deleted-evidence.py");
  const deletedDoc = path.join(workspaceRoot, "docs", "deleted-evidence.md");
  fs.rmSync(deletedSource);
  fs.rmSync(deletedDoc);

  // This is the sole post-deletion trigger. Convergence polling below uses
  // integration health, whose diagnostics operation cannot request refresh.
  const admitted = await readStatus(claude);
  assert(admitted.data.snapshot_id === oldSnapshotId, "stale admission retains the old snapshot");
  assert(admitted.data.freshness === "stale", "one non-startup status read detects deletion");

  const terminalHealth = await waitForReplacementHealth(claude, oldSnapshotId, 60_000);
  const terminalDaemon = requiredDaemon(terminalHealth);
  const finalWorkerInvocations = requiredNonNegativeInteger(
    terminalDaemon.worker_invocations,
    "final worker_invocations"
  );
  assert(
    finalWorkerInvocations - baselineWorkerInvocations === 1,
    "the non-startup stale read starts exactly one worker invocation"
  );

  const [codexFinalHealth, claudeFinalHealth] = await Promise.all([
    readHealth(codex),
    readHealth(claude)
  ]);
  assertProviderIdentity(codexFinalHealth, "codex", installedManifest.version);
  assertProviderIdentity(claudeFinalHealth, "claude_code", installedManifest.version);
  const codexFinalDaemon = requiredDaemon(codexFinalHealth);
  const claudeFinalDaemon = requiredDaemon(claudeFinalHealth);
  assertSharedTerminalDiagnostics(codexFinalDaemon, claudeFinalDaemon, oldSnapshotId);
  assertTrustedFreshMeta(codexFinalHealth.meta, "Codex health");
  assertTrustedFreshMeta(claudeFinalHealth.meta, "Claude health");
  const replacementSnapshotId = requiredString(
    codexFinalDaemon.visible_snapshot_id,
    "replacement snapshot id"
  );

  const [codexFinalStatus, claudeFinalStatus] = await Promise.all([
    readStatus(codex),
    readStatus(claude)
  ]);
  for (const [label, status] of [
    ["Codex", codexFinalStatus],
    ["Claude", claudeFinalStatus]
  ]) {
    assert(status.data.snapshot_id === replacementSnapshotId, `${label} status selects replacement`);
    assert(status.data.freshness === "fresh", `${label} status is fresh`);
    assert(status.data.snapshot_validity?.state === "valid", `${label} snapshot validity is valid`);
    assert(status.data.snapshot_validity?.complete === true, `${label} snapshot validity is complete`);
    assert(status.data.snapshot_validity?.missing_paths?.length === 0, `${label} has no missing paths`);
    assert(
      status.data.snapshot_validity?.inaccessible_paths?.length === 0,
      `${label} has no inaccessible paths`
    );
    assertTrustedFreshMeta(status.meta, `${label} status`);
  }

  const references = await callTool(codex, "find_references", {
    symbol: "helper",
    max_depth: 1,
    max_results: 10
  });
  assert(references.data.snapshot_id === replacementSnapshotId, "references use replacement snapshot");
  assertTrustedFreshMeta(references.meta, "find_references");
  const stableReferences = references.data.references.map((reference) => ({
    source_file_path: reference.source_file_path,
    target_file_path: reference.target_file_path,
    reference_name: reference.reference_name,
    reference_kind: reference.reference_kind,
    evidence_kinds: reference.evidence_kinds,
    provenance: reference.provenance,
    status: reference.status
  }));
  assertDeepEqual(stableReferences, [{
    source_file_path: "src/service.py",
    target_file_path: "src/service.py",
    reference_name: "helper",
    reference_kind: "call",
    evidence_kinds: ["parser"],
    provenance: "tree-sitter-reference-resolution",
    status: "resolved"
  }], "exact surviving helper reference");
  assert(references.data.result_count === 1, "reference result count is exact");

  const docs = await callTool(claude, "docs_search", {
    query: "Details",
    max_results: 10,
    include_snippets: true
  });
  assertTrustedFreshMeta(docs.meta, "docs_search");
  const stableDocsHits = docs.data.hits.map((hit) => ({
    path: hit.path,
    title: hit.title,
    heading_id: hit.heading_id,
    heading: hit.heading,
    evidence_kinds: hit.evidence_kinds
  }));
  assertDeepEqual(stableDocsHits, [{
    path: "docs/guide.md",
    title: "Sweep Guide",
    heading_id: "details",
    heading: "Details",
    evidence_kinds: ["docs", "fts"]
  }], "exact surviving docs hit");
  assert(docs.data.result_count === 1, "docs result count is exact");
  assert(docs.data.hits[0]?.snippet?.includes("intentionally short"), "docs snippet is exact");

  const deletedSymbol = await callTool(codex, "symbol_search", {
    query: "DeletedEvidenceSentinel",
    exact: true,
    max_results: 10
  });
  assert(deletedSymbol.data.snapshot_id === replacementSnapshotId, "deleted symbol query uses replacement");
  assert(deletedSymbol.data.symbols.length === 0, "deleted symbol evidence is absent");
  assertTrustedFreshMeta(deletedSymbol.meta, "deleted symbol query");

  const deletedDocs = await callTool(claude, "docs_search", {
    query: "deleted evidence sentinel",
    max_results: 10,
    include_snippets: true
  });
  assert(deletedDocs.data.status === "not_applicable", "deleted docs query is non-blocked and empty");
  assert(deletedDocs.data.hits.length === 0, "deleted docs evidence is absent");
  assertTrustedFreshMeta(deletedDocs.meta, "deleted docs query");

  assertSessionsQuiet();

  return {
    schema_version: "1",
    package: {
      name: installedManifest.name,
      version: installedManifest.version,
      tarball: path.basename(packed.tarballPath),
      tarball_sha256: packed.sha256,
      bin: "node_modules/.bin/agent-workbench-mcp",
      bin_resolved_inside_install: true
    },
    clients: [
      { provider_label: "codex", kind: "provider_labelled_mcp_session" },
      { provider_label: "claude_code", kind: "provider_labelled_mcp_session" }
    ],
    real_agent_cli_executed: false,
    limitation: "Provider-labelled MCP sessions are not proof that Codex or Claude Code loaded the plugin.",
    daemon: {
      pid: codexFinalDaemon.pid,
      connected_clients: Math.max(
        codexFinalDaemon.connected_clients,
        claudeFinalDaemon.connected_clients
      ),
      controller_generation: codexFinalDaemon.controller_generation,
      execution_id: codexFinalDaemon.execution_id,
      started_generation: codexFinalDaemon.started_generation,
      requested_generation: codexFinalDaemon.requested_generation,
      worker_invocations_before: baselineWorkerInvocations,
      worker_invocations_after: finalWorkerInvocations,
      worker_invocation_delta: 1
    },
    snapshots: {
      previous: oldSnapshotId,
      replacement: replacementSnapshotId,
      deleted_paths_absent: true,
      validity: "valid"
    },
    queries: {
      find_references: stableReferences,
      docs_search: stableDocsHits,
      deleted_symbol_count: deletedSymbol.data.symbols.length,
      deleted_docs_count: deletedDocs.data.hits.length
    },
    trust: {
      health: codexFinalHealth.meta.verification_status,
      status: codexFinalStatus.meta.verification_status,
      find_references: references.meta.verification_status,
      docs_search: docs.meta.verification_status
    }
  };
}

function packCheckout() {
  const result = run("npm", ["pack", "--json", "--pack-destination", packRoot], {
    cwd: repoRoot,
    env: isolatedEnv,
    timeout: 180_000
  });
  let parsed;
  try {
    parsed = JSON.parse(result.stdout);
  } catch {
    throw new Error("npm pack did not return its JSON receipt.");
  }
  const filename = parsed?.[0]?.filename;
  assert(typeof filename === "string" && filename.length > 0, "npm pack returned a tarball name");
  const tarballPath = path.join(packRoot, filename);
  assert(fs.existsSync(tarballPath), "npm pack created the tarball");
  return {
    tarballPath,
    sha256: crypto.createHash("sha256").update(fs.readFileSync(tarballPath)).digest("hex")
  };
}

function installTarball(tarballPath) {
  run("npm", [
    "install",
    "--prefix",
    installRoot,
    "--no-audit",
    "--no-fund",
    tarballPath
  ], {
    cwd: tempRoot,
    env: isolatedEnv,
    timeout: 600_000
  });
}

function createWorkspaceFixture() {
  fs.cpSync(path.join(repoRoot, "tests", "fixtures", "fixture-mcp-tool-sweep"), workspaceRoot, {
    recursive: true,
    filter: (source) => !source.includes(`${path.sep}.cache${path.sep}`)
  });
  fs.writeFileSync(
    path.join(workspaceRoot, "src", "deleted-evidence.py"),
    "def DeletedEvidenceSentinel() -> str:\n    return 'deleted'\n"
  );
  fs.writeFileSync(
    path.join(workspaceRoot, "docs", "deleted-evidence.md"),
    "# Deleted Evidence\n\nThe deleted evidence sentinel must disappear after refresh.\n"
  );
}

function startInstalledSession(input) {
  const child = spawn(input.binPath, ["--repo-root", workspaceRoot], {
    cwd: workspaceRoot,
    env: {
      ...isolatedEnv,
      AGENT_WORKBENCH_DAEMON_IDLE_GRACE_MS: "200",
      AGENT_WORKBENCH_DAEMON_STARTUP_REFRESH_DELAY_MS: String(input.startupRefreshDelayMs),
      AGENT_WORKBENCH_PROVIDER: input.provider,
      AGENT_WORKBENCH_PROVIDER_PLUGIN_NAME: "agent-workbench",
      AGENT_WORKBENCH_PROVIDER_PLUGIN_VERSION: input.pluginVersion
    },
    stdio: ["pipe", "pipe", "pipe"]
  });
  let stdout = "";
  let stderr = "";
  const nonJsonStdout = [];
  let nextId = 1;
  const pending = new Map();

  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
  });
  child.stdout.on("data", (chunk) => {
    stdout += chunk;
    const lines = stdout.split("\n");
    stdout = lines.pop() ?? "";
    for (const line of lines.filter(Boolean)) {
      let message;
      try {
        message = JSON.parse(line);
      } catch {
        nonJsonStdout.push(line);
        continue;
      }
      if (typeof message.id !== "number") continue;
      const waiter = pending.get(message.id);
      if (waiter !== undefined) {
        pending.delete(message.id);
        waiter.resolve(message);
      }
    }
  });
  child.once("error", (error) => {
    for (const waiter of pending.values()) waiter.reject(error);
    pending.clear();
  });
  child.once("exit", (code, signal) => {
    if (pending.size === 0) return;
    const error = new Error(
      `installed bin exited early (code=${code}, signal=${signal}): ${boundedText(stderr)}`
    );
    for (const waiter of pending.values()) waiter.reject(error);
    pending.clear();
  });

  return {
    child,
    stderr: () => stderr,
    stdoutRemainder: () => stdout,
    nonJsonStdout: () => [...nonJsonStdout],
    call(method, params = {}, timeoutMs = 15_000) {
      const id = nextId++;
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          pending.delete(id);
          reject(new Error(`timed out waiting for ${method} id=${id}`));
        }, timeoutMs);
        pending.set(id, {
          resolve: (message) => {
            clearTimeout(timeout);
            if (message.error !== undefined) {
              reject(new Error(`MCP ${method} returned an error response.`));
              return;
            }
            resolve(message);
          },
          reject: (error) => {
            clearTimeout(timeout);
            reject(error);
          }
        });
        child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);
      });
    },
    notify(method, params = {}) {
      child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", method, params })}\n`);
    },
    async close() {
      for (const waiter of pending.values()) {
        waiter.reject(new Error("installed MCP session closed before response"));
      }
      pending.clear();
      if (child.exitCode !== null || child.signalCode !== null) return;
      child.kill("SIGTERM");
      await new Promise((resolve) => {
        const timeout = setTimeout(() => {
          child.kill("SIGKILL");
          resolve();
        }, 2_000);
        child.once("exit", () => {
          clearTimeout(timeout);
          resolve();
        });
      });
    }
  };
}

function trackSession(session) {
  sessions.push(session);
  return session;
}

async function initializeSession(session, provider) {
  const response = await session.call("initialize", {
    protocolVersion: "2025-06-18",
    capabilities: {},
    clientInfo: {
      name: `agent-workbench-installed-smoke-${provider}`,
      version: "1"
    }
  }, 30_000);
  assert(response.result?.serverInfo?.name === "agent-workbench", `${provider} initialized installed bin`);
  session.notify("notifications/initialized", {});
}

async function readStatus(session) {
  return parseEnvelope(await session.call("resources/read", { uri: "repo:///status" }, 30_000));
}

async function readHealth(session) {
  return parseEnvelope(await session.call(
    "resources/read",
    { uri: "integration:///health/agent-workbench" },
    30_000
  ));
}

async function callTool(session, name, args) {
  return parseEnvelope(await session.call("tools/call", { name, arguments: args }, 30_000));
}

function parseEnvelope(message) {
  const text = message.result?.content?.[0]?.text ?? message.result?.contents?.[0]?.text;
  assert(typeof text === "string", "MCP response contains a JSON envelope");
  return JSON.parse(text);
}

async function waitForFreshStatus(session, previousSnapshotId, timeoutMs) {
  const started = Date.now();
  let last;
  while (Date.now() - started <= timeoutMs) {
    last = await readStatus(session);
    if (
      last.data?.freshness === "fresh" &&
      typeof last.data?.snapshot_id === "string" &&
      last.data.snapshot_id !== previousSnapshotId
    ) {
      return last;
    }
    await sleep(100);
  }
  throw new Error(`fresh status did not arrive; last state=${safeState(last)}`);
}

async function waitForReplacementHealth(session, oldSnapshotId, timeoutMs) {
  const started = Date.now();
  let last;
  while (Date.now() - started <= timeoutMs) {
    last = await readHealth(session);
    const daemon = last.data?.daemon;
    if (
      daemon?.warmup_state === "complete" &&
      daemon.publication_state === "published" &&
      daemon.graph_freshness === "fresh" &&
      daemon.visible_snapshot_id !== oldSnapshotId
    ) {
      return last;
    }
    await sleep(100);
  }
  throw new Error(`replacement health did not arrive; last state=${safeState(last)}`);
}

function assertProviderIdentity(envelope, provider, version) {
  assert(envelope.data?.provider === provider, `${provider} provider label is preserved`);
  assert(
    envelope.data?.provider_identity?.provenance === "launcher",
    `${provider} provider identity provenance is explicit`
  );
  const plugin = envelope.data?.identities?.find((identity) => identity.artifact === "provider_plugin");
  assert(plugin?.version === version, `${provider} provider plugin version matches installed package`);
}

function assertSharedTerminalDiagnostics(first, second, oldSnapshotId) {
  const fields = [
    "pid",
    "controller_generation",
    "execution_id",
    "started_generation",
    "requested_generation",
    "target_snapshot_id",
    "visible_snapshot_id",
    "warmup_state",
    "publication_state",
    "graph_freshness",
    "worker_invocations"
  ];
  for (const field of fields) {
    assert(first[field] === second[field], `both clients agree on daemon ${field}`);
  }
  assert(first.visible_snapshot_id !== oldSnapshotId, "replacement snapshot identity advances");
  assert(first.target_snapshot_id === first.visible_snapshot_id, "published target is visible");
  assert(first.started_generation === first.requested_generation, "accepted generation is complete");
  assert(first.warmup_state === "complete", "refresh execution is complete");
  assert(first.publication_state === "published", "replacement is published");
  assert(first.graph_freshness === "fresh", "replacement graph is fresh");
  assert(first.activity_lease_held === false, "terminal execution releases activity lease");
  assert(first.last_failure === undefined, "terminal execution has no failure");
}

function assertTrustedFreshMeta(meta, label) {
  assert(meta?.analysis_validity === "valid", `${label} analysis is valid`);
  assert(meta?.freshness === "fresh", `${label} metadata is fresh`);
  assert(meta?.verification_status !== "blocked", `${label} is not blocked`);
}

function requiredDaemon(envelope) {
  assert(envelope.data?.daemon !== undefined, "integration health contains daemon diagnostics");
  return envelope.data.daemon;
}

function requiredString(value, label) {
  assert(typeof value === "string" && value.length > 0, `${label} is present`);
  return value;
}

function requiredNonNegativeInteger(value, label) {
  assert(Number.isInteger(value) && value >= 0, `${label} is a non-negative integer`);
  return value;
}

function assertSessionsQuiet() {
  for (const session of sessions) {
    assert(session.stderr() === "", "installed bin stderr remains quiet");
    assert(session.stdoutRemainder() === "", "installed bin stdout has no partial line");
    assert(session.nonJsonStdout().length === 0, "installed bin stdout contains only JSON-RPC");
  }
}

async function cleanupSmoke() {
  const closeResults = await Promise.allSettled(sessions.splice(0).map((session) => session.close()));
  assert(closeResults.every((result) => result.status === "fulfilled"), "installed MCP clients close cleanly");
  const clientsClosed = true;

  let daemonStopped = daemonPid === undefined;
  if (daemonPid !== undefined) {
    daemonStopped = await waitForProcessExit(daemonPid, 10_000);
    assert(daemonStopped, "daemon exits through ordinary idle shutdown");
  }
  const socketRemoved = daemonSocketPath === undefined || !fs.existsSync(daemonSocketPath);
  assert(socketRemoved, "daemon socket is removed after shutdown");

  const metadataDir = path.join(workspaceRoot, ".cache", "agent-workbench", "daemon");
  const metadataRemoved = !fs.existsSync(metadataDir) ||
    fs.readdirSync(metadataDir).every((entry) => !entry.endsWith(".json") && !entry.endsWith(".lock"));
  assert(metadataRemoved, "daemon metadata and startup lock are removed after shutdown");

  fs.rmSync(tempRoot, { recursive: true, force: true });
  fs.rmSync(runtimeRoot, { recursive: true, force: true });
  const temporaryRootRemoved = !fs.existsSync(tempRoot) && !fs.existsSync(runtimeRoot);
  assert(temporaryRootRemoved, "isolated package, state, runtime, and workspace roots are removed");
  return {
    clients_closed: clientsClosed,
    daemon_stopped: daemonStopped,
    socket_removed: socketRemoved,
    metadata_removed: metadataRemoved,
    temporary_root_removed: temporaryRootRemoved
  };
}

async function waitForProcessExit(pid, timeoutMs) {
  const started = Date.now();
  while (Date.now() - started <= timeoutMs) {
    try {
      process.kill(pid, 0);
    } catch {
      return true;
    }
    await sleep(50);
  }
  return false;
}

function run(command, args, options) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    env: options.env,
    encoding: "utf8",
    timeout: options.timeout
  });
  if (result.error !== undefined) {
    throw new Error(`${command} failed to start: ${safeErrorMessage(result.error)}`);
  }
  if (result.status !== 0) {
    throw new Error(`${command} exited with status ${result.status}: ${boundedText(result.stderr)}`);
  }
  return result;
}

function isInside(root, candidate) {
  const relative = path.relative(path.resolve(root), path.resolve(candidate));
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function assertDeepEqual(actual, expected, label) {
  const actualJson = JSON.stringify(actual);
  const expectedJson = JSON.stringify(expected);
  assert(
    actualJson === expectedJson,
    `${label} matches expected evidence (actual=${boundedText(actualJson)})`
  );
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function safeState(envelope) {
  const daemon = envelope?.data?.daemon;
  return JSON.stringify({
    freshness: envelope?.data?.freshness ?? envelope?.meta?.freshness,
    verification_status: envelope?.meta?.verification_status,
    snapshot_id: envelope?.data?.snapshot_id,
    warmup_state: daemon?.warmup_state,
    graph_freshness: daemon?.graph_freshness
  });
}

function safeErrorMessage(error) {
  return boundedText(error instanceof Error ? error.message : String(error));
}

function boundedText(value) {
  return String(value ?? "").replace(/[\r\n\t]+/gu, " ").slice(0, 1000);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
