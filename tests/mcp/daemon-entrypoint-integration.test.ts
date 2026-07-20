/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  createDaemonIdentity,
  daemonPaths
} from "../../src/mcp/daemon.js";
import { graphStorePath, repositoryOwnershipPath } from "../../src/server.js";
import { openGraphStore, SCHEMA_VERSION } from "../../src/infrastructure/sqlite/graph-store.js";
import { indexRepositoryGraph } from "../../src/application/use-cases/index-repository-graph.js";
import {
  FileCatalogScannerAdapter,
  WorkspaceFileAdapter
} from "../../src/infrastructure/filesystem/index.js";
import {
  ExtractorRegistryAdapter,
  ResourceExtractorAdapter
} from "../../src/infrastructure/extraction/index.js";
import { PythonTreeSitterExtractorAdapter } from "../../src/infrastructure/tree-sitter/index.js";
import { SystemClockAdapter } from "../../src/infrastructure/time/index.js";
import { AGENT_WORKBENCH_RUNTIME_VERSION } from "../../src/runtime/version.js";
import {
  initializeSession,
  parseEnvelope,
  startEntryPointSession,
  type EntryPointSession,
  type McpMessage
} from "../helpers/mcp-entrypoint-session.js";
import { holdExclusiveSqliteLockUntilReleased } from "../helpers/sqlite-lock.js";

const sessions: EntryPointSession[] = [];
const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.allSettled(sessions.splice(0).map((session) => session.close()));
  for (const root of tempRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe("daemon-backed stdio entrypoint integration", () => {
  it("starts through the checkout/source entrypoint and reports daemon health without expanding normal status", async () => {
    const repoRoot = createCleanFixtureCopy("agent-workbench-entrypoint-status-");
    const session = trackSession(await startEntryPointSession(repoRoot));
    await initializeSession(session);

    const status = parseEnvelope(await session.call("resources/read", { uri: "repo:///status" })) as {
      data: { repo_root: string; runtime_state: string; daemon?: unknown };
    };
    const health = parseEnvelope(await session.call("resources/read", {
      uri: "integration:///health/agent-workbench"
    })) as {
      data: {
        daemon?: {
          pid: number;
          socket_path: string;
          repo_root: string;
          connected_clients: number;
        };
      };
    };

    expect(status.data).toMatchObject({
      repo_root: repoRoot
    });
    expect(status.data.runtime_state).toEqual(expect.any(String));
    expect(status.data.daemon).toBeUndefined();
    expect(health.data.daemon).toMatchObject({
      socket_path: daemonPaths(createDaemonIdentity(repoRoot)).socketPath,
      repo_root: repoRoot,
      connected_clients: 1
    });
    expect(health.data.daemon?.pid).toBeGreaterThan(0);
    expect(session.stderr()).toBe("");
  }, 15_000);

  it("shares one daemon across concurrent checkout/source clients", async () => {
    const repoRoot = createCleanFixtureCopy("agent-workbench-entrypoint-shared-");
    const first = trackSession(await startEntryPointSession(repoRoot));
    const second = trackSession(await startEntryPointSession(repoRoot));
    await Promise.all([initializeSession(first), initializeSession(second)]);

    const firstHealth = parseEnvelope(await first.call("resources/read", {
      uri: "integration:///health/agent-workbench"
    })) as { data: { daemon?: { pid: number; connected_clients: number } } };
    const secondHealth = parseEnvelope(await second.call("resources/read", {
      uri: "integration:///health/agent-workbench"
    })) as { data: { daemon?: { pid: number; connected_clients: number } } };

    expect(firstHealth.data.daemon?.pid).toBe(secondHealth.data.daemon?.pid);
    expect(Math.max(
      firstHealth.data.daemon?.connected_clients ?? 0,
      secondHealth.data.daemon?.connected_clients ?? 0
    )).toBeGreaterThanOrEqual(2);
  }, 15_000);

  it("shares one authoritative refresh diagnostic identity across checkout/source clients", async () => {
    const repoRoot = createCleanFixtureCopy("agent-workbench-entrypoint-shared-refresh-");
    const first = trackSession(await startEntryPointSession(repoRoot));
    const second = trackSession(await startEntryPointSession(repoRoot));
    await Promise.all([initializeSession(first), initializeSession(second)]);

    const [firstHealth, secondHealth] = await Promise.all([
      first.call("resources/read", { uri: "integration:///health/agent-workbench" }),
      second.call("resources/read", { uri: "integration:///health/agent-workbench" })
    ]);
    const firstDiagnostics = refreshDiagnostics(firstHealth);
    const secondDiagnostics = refreshDiagnostics(secondHealth);

    // Undefined must not accidentally establish equality: both identities
    // must be present before the shared-daemon assertion is meaningful.
    expect(firstDiagnostics.controller_generation).toEqual(expect.any(Number));
    expect(firstDiagnostics.diagnostic_revision).toEqual(expect.any(Number));
    expect(secondDiagnostics).toMatchObject({
      controller_generation: firstDiagnostics.controller_generation,
      diagnostic_revision: firstDiagnostics.diagnostic_revision,
      execution_state: firstDiagnostics.execution_state
    });
    expect(secondDiagnostics.target_snapshot_id).toBe(firstDiagnostics.target_snapshot_id);
    expect(secondDiagnostics.visible_snapshot_id).toBe(firstDiagnostics.visible_snapshot_id);
  }, 15_000);

  it("executes a refresh requested by a non-startup checkout/source client", async () => {
    const repoRoot = createCleanFixtureCopy("agent-workbench-entrypoint-non-startup-refresh-");
    const startupClient = trackSession(await startEntryPointSession(repoRoot, {
      startupRefreshDelayMs: 0
    }));
    await initializeSession(startupClient);
    await waitForSymbolSearch(startupClient, "Runner");
    const before = repoStatus(await startupClient.call("resources/read", { uri: "repo:///status" }));
    expect(before.data.snapshot_id).toEqual(expect.any(String));
    expect(before.data.freshness).toBe("fresh");
    const previousSnapshotId = before.data.snapshot_id as string;

    // Starting only after the first client's graph is fresh proves this is a
    // reused-daemon, non-startup connection rather than a startup race winner.
    const laterClient = trackSession(await startEntryPointSession(repoRoot));
    await initializeSession(laterClient);
    fs.rmSync(path.join(repoRoot, "src/sample_pkg/service.py"));

    // This second-client status read is the stale-request admission barrier.
    const admitted = repoStatus(await laterClient.call("resources/read", { uri: "repo:///status" }));
    expect(admitted.data).toMatchObject({
      snapshot_id: previousSnapshotId,
      freshness: "stale"
    });

    let observed = admitted;
    for (let attempt = 0; attempt < 40; attempt += 1) {
      observed = repoStatus(await laterClient.call("resources/read", { uri: "repo:///status" }));
      if (observed.data.snapshot_id !== previousSnapshotId && observed.data.freshness === "fresh") {
        break;
      }
      await new Promise<void>((resolve) => setTimeout(resolve, 25));
    }

    expect(observed.data).toMatchObject({ freshness: "fresh" });
    expect(observed.data.snapshot_id).not.toBe(previousSnapshotId);
  }, 20_000);

  it("keeps explicit Codex and Claude launcher identity isolated on one daemon", async () => {
    const repoRoot = createCleanFixtureCopy("agent-workbench-entrypoint-mixed-provider-");
    const codex = trackSession(await startEntryPointSession(repoRoot, {
      env: {
        AGENT_WORKBENCH_PROVIDER: "codex",
        AGENT_WORKBENCH_PROVIDER_PLUGIN_NAME: "agent-workbench",
        AGENT_WORKBENCH_PROVIDER_PLUGIN_VERSION: "0.5.2"
      }
    }));
    const claude = trackSession(await startEntryPointSession(repoRoot, {
      env: {
        AGENT_WORKBENCH_PROVIDER: "claude_code",
        AGENT_WORKBENCH_PROVIDER_PLUGIN_NAME: "agent-workbench",
        AGENT_WORKBENCH_PROVIDER_PLUGIN_VERSION: "0.5.2"
      }
    }));
    await Promise.all([initializeSession(codex), initializeSession(claude)]);

    const [codexHealth, claudeHealth] = await Promise.all([
      codex.call("resources/read", { uri: "integration:///health/agent-workbench" }),
      claude.call("resources/read", { uri: "integration:///health/agent-workbench" })
    ]);
    const codexEnvelope = parseEnvelope(codexHealth) as {
      data: { provider: string; identities: Array<{ artifact: string; version?: string }> };
    };
    const claudeEnvelope = parseEnvelope(claudeHealth) as {
      data: { provider: string; identities: Array<{ artifact: string; version?: string }> };
    };

    expect(codexEnvelope.data.provider).toBe("codex");
    expect(claudeEnvelope.data.provider).toBe("claude_code");
    expect(codexEnvelope.data.identities).toContainEqual(expect.objectContaining({
      artifact: "provider_plugin",
      version: "0.5.2"
    }));
    expect(claudeEnvelope.data.identities).toContainEqual(expect.objectContaining({
      artifact: "provider_plugin",
      version: "0.5.2"
    }));
  // Two real entrypoint children may serialize native-module startup under the
  // full-suite worker load; their individual I/O waits remain independently bounded.
  }, 30_000);

  it("returns graph-backed results for concurrent checkout/source clients without raw lock output", async () => {
    const repoRoot = createCleanFixtureCopy("agent-workbench-entrypoint-concurrent-");
    const first = trackSession(await startEntryPointSession(repoRoot, { startupRefreshDelayMs: 0 }));
    const second = trackSession(await startEntryPointSession(repoRoot, { startupRefreshDelayMs: 0 }));
    await Promise.all([initializeSession(first), initializeSession(second)]);

    const [firstSearch, secondSearch] = await Promise.all([
      waitForSymbolSearch(first, "Runner"),
      waitForSymbolSearch(second, "Runner")
    ]);
    const combinedOutput = [
      JSON.stringify(firstSearch),
      JSON.stringify(secondSearch),
      first.stderr(),
      second.stderr(),
      first.stdoutRemainder(),
      second.stdoutRemainder()
    ].join("\n");

    expect(firstSearch.data.symbols.length).toBeGreaterThan(0);
    expect(secondSearch.data.symbols.length).toBeGreaterThan(0);
    expect(combinedOutput).not.toMatch(/database is locked/i);
  }, 25_000);

  it("keeps the daemon alive during idle grace and reuses it for a quick reconnect", async () => {
    const repoRoot = createCleanFixtureCopy("agent-workbench-entrypoint-idle-");
    const first = trackSession(await startEntryPointSession(repoRoot, { idleGraceMs: 3000 }));
    await initializeSession(first);
    const firstDaemon = daemonHealth(await first.call("resources/read", {
      uri: "integration:///health/agent-workbench"
    }));
    await first.close();
    await waitForDaemonMetadata(repoRoot, true, 500);

    const second = trackSession(await startEntryPointSession(repoRoot, { idleGraceMs: 3000 }));
    await initializeSession(second);
    const secondDaemon = daemonHealth(await second.call("resources/read", {
      uri: "integration:///health/agent-workbench"
    }));

    expect(secondDaemon.pid).toBe(firstDaemon.pid);
    await second.close();
    await waitForDaemonMetadata(repoRoot, false, 7000);
  }, 12_000);

  it("replaces a crashed daemon that left stale metadata and socket state", async () => {
    const repoRoot = createCleanFixtureCopy("agent-workbench-entrypoint-crash-");
    const first = trackSession(await startEntryPointSession(repoRoot, { idleGraceMs: 5000 }));
    await initializeSession(first);
    const firstDaemon = daemonHealth(await first.call("resources/read", {
      uri: "integration:///health/agent-workbench"
    }));
    process.kill(firstDaemon.pid, "SIGTERM");
    await waitForProcessExit(firstDaemon.pid);
    await first.close();

    const replacement = trackSession(await startEntryPointSession(repoRoot, { idleGraceMs: 100 }));
    await initializeSession(replacement);
    const replacementDaemon = daemonHealth(await replacement.call("resources/read", {
      uri: "integration:///health/agent-workbench"
    }));

    expect(replacementDaemon.pid).not.toBe(firstDaemon.pid);
    expect(replacement.stderr()).toBe("");
  }, 15_000);

  it("reconciles a crashed owner's orphan build before admitting replacement work", async () => {
    const repoRoot = createCleanFixtureCopy("agent-workbench-entrypoint-orphan-");
    const databasePath = graphStorePath(repoRoot);
    const store = openGraphStore(databasePath);
    try {
      await store.upsertSnapshot({ snapshot: integrationSnapshot(repoRoot, "80", "fresh") });
      await store.createBuildSnapshot({
        snapshot: integrationSnapshot(repoRoot, "81", "refreshing"),
        controller_generation: 4,
        invalidation_generation: 2,
        created_at: "2026-07-20T09:00:00.000Z"
      });
    } finally {
      store.close();
    }
    fs.writeFileSync(repositoryOwnershipPath(databasePath), `${JSON.stringify({
      repo_root: repoRoot,
      runtime_identity: `${AGENT_WORKBENCH_RUNTIME_VERSION}:${SCHEMA_VERSION}`,
      schema_version: SCHEMA_VERSION,
      owner_id: "crashed-daemon",
      owner_pid: 999999999,
      owner_generation: 4,
      heartbeat_at: "2026-07-20T09:00:00.000Z",
      state: "active"
    })}\n`);

    const replacement = trackSession(await startEntryPointSession(repoRoot, {
      idleGraceMs: 3000,
      startupRefreshDelayMs: 60_000
    }));
    await initializeSession(replacement);
    const health = parseEnvelope(await replacement.call("resources/read", {
      uri: "integration:///health/agent-workbench"
    })) as {
      data: { daemon?: { warmup_state?: string; worker_invocations?: number; last_failure?: { code: string; target_snapshot_id?: string } } };
    };
    expect(health.data.daemon).toMatchObject({
      warmup_state: "failed",
      worker_invocations: 0,
      last_failure: { code: "orphaned_build", target_snapshot_id: "81" }
    });

    const reopened = openGraphStore(databasePath);
    try {
      expect(reopened.db.prepare(`
        SELECT id, publication_state FROM snapshots ORDER BY id
      `).all()).toEqual([
        { id: 80, publication_state: "published" },
        { id: 81, publication_state: "failed" }
      ]);
      await expect(reopened.getLatestPublished({ repo_root: repoRoot })).resolves.toMatchObject({
        status: "selected",
        snapshot: { id: "80" }
      });
    } finally {
      reopened.close();
    }
  }, 15_000);

  it.each([
    "generation",
    "catalog",
    "docs",
    "graph",
    "prepublication"
  ] as const)("recovers one orphaned real-worker build after a %s barrier crash", async (barrier) => {
    const repoRoot = createCrashBarrierRepository(`agent-workbench-entrypoint-${barrier}-crash-`);
    const databasePath = graphStorePath(repoRoot);
    await seedPublishedBarrierSnapshot(repoRoot, databasePath);

    const probeRoot = path.join(repoRoot, ".cache", "agent-workbench", "test-crash");
    const markerPath = path.join(probeRoot, `${barrier}.json`);
    const releasePath = path.join(probeRoot, `${barrier}.release`);
    const first = trackSession(await startEntryPointSession(repoRoot, {
      idleGraceMs: 5000,
      startupRefreshDelayMs: 60_000,
      env: {
        NODE_ENV: "test",
        AGENT_WORKBENCH_TEST_REFRESH_CRASH_BARRIER: barrier,
        AGENT_WORKBENCH_TEST_REFRESH_CRASH_MARKER: markerPath,
        AGENT_WORKBENCH_TEST_REFRESH_CRASH_RELEASE: releasePath
      }
    }));
    let firstDaemonPid: number | undefined;
    let replacementDaemonPid: number | undefined;

    try {
      await initializeSession(first);
      const firstHealth = daemonRefreshHealth(await first.call("resources/read", {
        uri: "integration:///health/agent-workbench"
      }));
      firstDaemonPid = firstHealth.pid;
      const watcherBaseline = repoStatus(await first.call("resources/read", { uri: "repo:///status" }));
      expect(watcherBaseline.data).toMatchObject({ snapshot_id: "80", freshness: "fresh" });
      fs.rmSync(path.join(repoRoot, "stale-sentinel.py"));
      const admitted = repoStatus(await first.call("resources/read", { uri: "repo:///status" }));
      expect(admitted.data).toMatchObject({ snapshot_id: "80", freshness: "stale" });
      const marker = await waitForCrashBarrierMarker(markerPath);
      expect(marker).toMatchObject({
        barrier,
        controller_generation: firstHealth.controller_generation,
        invalidation_generation: 1,
        daemon_pid: firstDaemonPid
      });
      expect(marker.snapshot_id).not.toBe("80");
      const executing = daemonRefreshHealth(await first.call("resources/read", {
        uri: "integration:///health/agent-workbench"
      }));
      expect(executing.worker_invocations).toBe(1);
      expect(executing.visible_snapshot_id).toBe("80");

      const atBarrier = openGraphStore(databasePath);
      try {
        expect(readSnapshotPublication(atBarrier, 80)).toMatchObject({
          publication_state: "published",
          freshness: "fresh"
        });
        expect(readSnapshotPublication(atBarrier, Number(marker.snapshot_id))).toMatchObject({
          publication_state: "building",
          controller_generation: marker.controller_generation,
          invalidation_generation: marker.invalidation_generation
        });
        expect(readBarrierEvidence(atBarrier, Number(marker.snapshot_id))).toEqual(
          expectedBarrierEvidence(barrier)
        );
      } finally {
        atBarrier.close();
      }

      process.kill(firstDaemonPid, "SIGTERM");
      await waitForProcessExit(firstDaemonPid);
      await first.close();

      const replacement = trackSession(await startEntryPointSession(repoRoot, {
        idleGraceMs: 100,
        startupRefreshDelayMs: 60_000,
        env: { NODE_ENV: "test" }
      }));
      await initializeSession(replacement);
      const recovered = daemonRefreshHealth(await replacement.call("resources/read", {
        uri: "integration:///health/agent-workbench"
      }));
      replacementDaemonPid = recovered.pid;
      expect(recovered.pid).not.toBe(firstDaemonPid);
      expect(recovered).toMatchObject({
        warmup_state: "failed",
        worker_invocations: 0,
        last_failure: { code: "orphaned_build", target_snapshot_id: marker.snapshot_id }
      });

      await sleep(150);
      const stillAwaitingRequest = daemonRefreshHealth(await replacement.call("resources/read", {
        uri: "integration:///health/agent-workbench"
      }));
      expect(stillAwaitingRequest).toMatchObject({
        warmup_state: "failed",
        worker_invocations: 0,
        last_failure: { code: "orphaned_build", target_snapshot_id: marker.snapshot_id }
      });

      const afterRecovery = openGraphStore(databasePath);
      try {
        expect(readSnapshotPublication(afterRecovery, Number(marker.snapshot_id))).toMatchObject({
          publication_state: "failed"
        });
        expect(countBuildingSnapshots(afterRecovery, repoRoot)).toBe(0);
        await expect(afterRecovery.getLatestPublished({ repo_root: repoRoot })).resolves.toMatchObject({
          status: "selected",
          snapshot: { id: "80" }
        });
      } finally {
        afterRecovery.close();
      }
      expect(JSON.parse(fs.readFileSync(repositoryOwnershipPath(databasePath), "utf8"))).toMatchObject({
        owner_pid: replacementDaemonPid,
        state: "active"
      });

      const successorAdmission = repoStatus(await replacement.call("resources/read", {
        uri: "repo:///status"
      }));
      expect(successorAdmission.data).toMatchObject({ snapshot_id: "80", freshness: "stale" });
      const completed = await waitForRefreshCompletion(replacement, marker.snapshot_id);
      expect(completed).toMatchObject({
        warmup_state: "complete",
        worker_invocations: 1,
        visible_snapshot_id: completed.target_snapshot_id
      });
      expect(completed.target_snapshot_id).not.toBe("80");
      expect(completed.target_snapshot_id).not.toBe(marker.snapshot_id);

      const finalStatus = repoStatus(await replacement.call("resources/read", { uri: "repo:///status" }));
      expect(finalStatus.data).toMatchObject({
        snapshot_id: completed.target_snapshot_id,
        freshness: "fresh"
      });

      await replacement.close();
      await waitForProcessExit(replacementDaemonPid);
      await waitForDaemonMetadata(repoRoot, false, 3000);
      expect(fs.existsSync(repositoryOwnershipPath(databasePath))).toBe(false);
      const daemonState = daemonPaths(createDaemonIdentity(repoRoot));
      expect(fs.existsSync(daemonState.socketPath)).toBe(false);

      const finalStore = openGraphStore(databasePath);
      try {
        expect(readSnapshotPublication(finalStore, 80).publication_state).toBe("published");
        expect(finalStore.db.prepare("SELECT id FROM snapshots WHERE id = ?")
          .get(Number(marker.snapshot_id))).toBeUndefined();
        expect(readSnapshotPublication(finalStore, Number(completed.target_snapshot_id)).publication_state).toBe("published");
        expect(countBuildingSnapshots(finalStore, repoRoot)).toBe(0);
        await expect(finalStore.getLatestPublished({ repo_root: repoRoot })).resolves.toMatchObject({
          status: "selected",
          snapshot: { id: completed.target_snapshot_id }
        });
      } finally {
        finalStore.close();
      }
      expect(fs.existsSync(`${databasePath}-wal`)).toBe(false);
      expect(fs.existsSync(`${databasePath}-shm`)).toBe(false);
    } finally {
      fs.mkdirSync(path.dirname(releasePath), { recursive: true });
      fs.writeFileSync(releasePath, "release\n");
      terminateIfRunning(firstDaemonPid);
      terminateIfRunning(replacementDaemonPid);
    }
  }, 30_000);

  it("does not expose raw SQLite lock text when graph startup is blocked", async () => {
    const repoRoot = createCleanFixtureCopy("agent-workbench-entrypoint-locked-");
    const lock = await holdExclusiveSqliteLockUntilReleased(graphStorePath(repoRoot));
    const session = trackSession(await startEntryPointSession(repoRoot, { idleGraceMs: 100 }));

    try {
      await expect(initializeSession(session)).rejects.toThrow(/Timed out waiting for initialize/);
      const serialized = [
        session.stderr(),
        session.stdoutRemainder()
      ].join("\n");

      expect(serialized).not.toMatch(/database is locked/i);
      expect(serialized).toMatch(/Timed out connecting to Agent Workbench daemon/i);
      expect(lock.released).toBe(false);
    } finally {
      lock.release();
      await lock.done;
    }
  }, 30_000);
});

function trackSession(session: EntryPointSession): EntryPointSession {
  sessions.push(session);
  return session;
}

async function waitForSymbolSearch(
  session: EntryPointSession,
  query: string
): Promise<{ data: { symbols: unknown[] }; meta?: { freshness?: string } }> {
  let lastEnvelope: unknown;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const envelope = parseEnvelope(await session.call("tools/call", {
      name: "symbol_search",
      arguments: {
        query
      }
    }, 10_000)) as { data: { symbols: unknown[] }; meta?: { freshness?: string } };
    lastEnvelope = envelope;
    if (envelope.data.symbols.length > 0) {
      return envelope;
    }
    await sleep(100);
  }
  throw new Error(`Timed out waiting for symbol_search(${query}): ${JSON.stringify(lastEnvelope)}`);
}

function daemonHealth(message: McpMessage): {
  pid: number;
  socket_path: string;
  repo_root: string;
  connected_clients: number;
} {
  const envelope = parseEnvelope(message) as {
    data: {
      daemon?: {
        pid: number;
        socket_path: string;
        repo_root: string;
        connected_clients: number;
      };
    };
  };
  if (envelope.data.daemon === undefined) {
    throw new Error(`Missing daemon health: ${JSON.stringify(envelope)}`);
  }
  return envelope.data.daemon;
}

function refreshDiagnostics(message: McpMessage): {
  controller_generation?: number;
  diagnostic_revision?: number;
  execution_state?: string;
  target_snapshot_id?: string;
  visible_snapshot_id?: string;
} {
  const envelope = parseEnvelope(message) as {
    data: {
      daemon?: {
        controller_generation?: number;
        diagnostic_revision?: number;
        warmup_state?: string;
        target_snapshot_id?: string;
        visible_snapshot_id?: string;
      };
    };
  };
  if (envelope.data.daemon === undefined) {
    throw new Error(`Missing daemon health: ${JSON.stringify(envelope)}`);
  }
  return {
    ...envelope.data.daemon,
    execution_state: envelope.data.daemon.warmup_state
  };
}

function repoStatus(message: McpMessage): {
  data: { snapshot_id?: string; freshness: string };
} {
  return parseEnvelope(message) as {
    data: { snapshot_id?: string; freshness: string };
  };
}

function createCleanFixtureCopy(prefix: string): string {
  const destination = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  fs.cpSync(path.resolve("tests/fixtures/fixture-basic-python"), destination, {
    recursive: true,
    filter: (source) => !source.includes(`${path.sep}.cache${path.sep}`)
  });
  tempRoots.push(destination);
  return destination;
}

type TestGraphStore = ReturnType<typeof openGraphStore>;
type CrashBarrierMarker = {
  barrier: "generation" | "catalog" | "docs" | "graph" | "prepublication";
  snapshot_id: string;
  controller_generation: number;
  invalidation_generation: number;
  daemon_pid: number;
};

function createCrashBarrierRepository(prefix: string): string {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  fs.writeFileSync(path.join(repoRoot, "app.py"), "def run():\n    missing_dependency()\n");
  fs.writeFileSync(path.join(repoRoot, "stale-sentinel.py"), "def sentinel():\n    return True\n");
  fs.writeFileSync(path.join(repoRoot, "unsupported.java"), "class Unsupported {}\n");
  fs.writeFileSync(path.join(repoRoot, "README.md"), "# Barrier repository\n\nPublication barrier evidence.\n");
  tempRoots.push(repoRoot);
  return repoRoot;
}

async function seedPublishedBarrierSnapshot(repoRoot: string, databasePath: string): Promise<void> {
  const store = openGraphStore(databasePath);
  const extractors = new ExtractorRegistryAdapter();
  extractors.register(new PythonTreeSitterExtractorAdapter());
  try {
    await indexRepositoryGraph({
      repo_root: repoRoot,
      scanner: new FileCatalogScannerAdapter(),
      workspace: new WorkspaceFileAdapter({ repoRoot }),
      extractors,
      resource_extractor: new ResourceExtractorAdapter(),
      graph: store,
      catalog: store,
      docs_index: store,
      snapshots: store,
      clock: new SystemClockAdapter(),
      schema_version: SCHEMA_VERSION,
      snapshot_id: "80"
    });
  } finally {
    store.close();
  }
}

async function waitForCrashBarrierMarker(markerPath: string): Promise<CrashBarrierMarker> {
  const started = Date.now();
  while (Date.now() - started <= 10_000) {
    if (fs.existsSync(markerPath)) {
      return JSON.parse(fs.readFileSync(markerPath, "utf8")) as CrashBarrierMarker;
    }
    await sleep(25);
  }
  throw new Error(`Timed out waiting for refresh crash barrier marker: ${markerPath}`);
}

function daemonRefreshHealth(message: McpMessage): {
  pid: number;
  controller_generation: number;
  warmup_state: string;
  worker_invocations: number;
  target_snapshot_id?: string;
  visible_snapshot_id?: string;
  last_failure?: { code: string; target_snapshot_id?: string };
} {
  const envelope = parseEnvelope(message) as {
    data: {
      daemon?: {
        pid: number;
        controller_generation: number;
        warmup_state: string;
        worker_invocations: number;
        target_snapshot_id?: string;
        visible_snapshot_id?: string;
        last_failure?: { code: string; target_snapshot_id?: string };
      };
    };
  };
  if (envelope.data.daemon === undefined) {
    throw new Error(`Missing daemon refresh health: ${JSON.stringify(envelope)}`);
  }
  return envelope.data.daemon;
}

async function waitForRefreshCompletion(
  session: EntryPointSession,
  orphanSnapshotId: string
): Promise<ReturnType<typeof daemonRefreshHealth>> {
  let lastHealth: ReturnType<typeof daemonRefreshHealth> | undefined;
  for (let attempt = 0; attempt < 200; attempt += 1) {
    lastHealth = daemonRefreshHealth(await session.call("resources/read", {
      uri: "integration:///health/agent-workbench"
    }));
    if (
      lastHealth.warmup_state === "complete" &&
      lastHealth.worker_invocations === 1 &&
      lastHealth.target_snapshot_id !== undefined &&
      lastHealth.target_snapshot_id !== orphanSnapshotId
    ) {
      return lastHealth;
    }
    await sleep(50);
  }
  throw new Error(`Timed out waiting for replacement refresh completion: ${JSON.stringify(lastHealth)}`);
}

function readSnapshotPublication(store: TestGraphStore, snapshotId: number): {
  publication_state: string;
  freshness: string;
  controller_generation: number;
  invalidation_generation: number;
} {
  const row = store.db.prepare(`
    SELECT publication_state, freshness, controller_generation, invalidation_generation
    FROM snapshots
    WHERE id = ?
  `).get(snapshotId) as ReturnType<typeof readSnapshotPublication> | undefined;
  if (row === undefined) throw new Error(`Missing snapshot publication row: ${snapshotId}`);
  return row;
}

function readBarrierEvidence(store: TestGraphStore, snapshotId: number): {
  catalog: boolean;
  docs: boolean;
  graph: boolean;
  unresolved: boolean;
  freshness: string;
} {
  const count = (sql: string): number => (store.db.prepare(sql).get(snapshotId) as { count: number }).count;
  const freshness = (store.db.prepare("SELECT freshness FROM snapshots WHERE id = ?")
    .get(snapshotId) as { freshness: string }).freshness;
  return {
    catalog: count("SELECT COUNT(*) AS count FROM files WHERE snapshot_id = ?") > 0,
    docs: count("SELECT COUNT(*) AS count FROM docs_documents WHERE snapshot_id = ?") > 0,
    graph: count(`
      SELECT COUNT(*) AS count FROM nodes
      WHERE file_id IN (SELECT id FROM files WHERE snapshot_id = ?)
    `) > 0,
    unresolved: count(`
      SELECT COUNT(*) AS count FROM unresolved_refs
      WHERE file_id IN (SELECT id FROM files WHERE snapshot_id = ?)
    `) > 0,
    freshness
  };
}

function expectedBarrierEvidence(
  barrier: CrashBarrierMarker["barrier"]
): ReturnType<typeof readBarrierEvidence> {
  if (barrier === "generation") {
    return { catalog: false, docs: false, graph: false, unresolved: false, freshness: "refreshing" };
  }
  if (barrier === "catalog") {
    return { catalog: true, docs: false, graph: false, unresolved: false, freshness: "refreshing" };
  }
  if (barrier === "docs") {
    return { catalog: true, docs: true, graph: false, unresolved: false, freshness: "refreshing" };
  }
  if (barrier === "graph") {
    return { catalog: true, docs: true, graph: true, unresolved: true, freshness: "refreshing" };
  }
  return { catalog: true, docs: true, graph: true, unresolved: true, freshness: "fresh" };
}

function countBuildingSnapshots(store: TestGraphStore, repoRoot: string): number {
  return (store.db.prepare(`
    SELECT COUNT(*) AS count FROM snapshots
    WHERE repo_identity = ? AND publication_state = 'building'
  `).get(repoRoot) as { count: number }).count;
}

function terminateIfRunning(pid: number | undefined): void {
  if (pid === undefined) return;
  try {
    process.kill(pid, "SIGTERM");
  } catch {
    // The expected crash/replacement shutdown path already removed the process.
  }
}

async function waitForDaemonMetadata(repoRoot: string, exists: boolean, timeoutMs: number): Promise<void> {
  const metadataPath = daemonPaths(createDaemonIdentity(repoRoot)).metadataPath;
  const started = Date.now();
  while (Date.now() - started <= timeoutMs) {
    if (fs.existsSync(metadataPath) === exists) {
      return;
    }
    await sleep(50);
  }
  throw new Error(`Timed out waiting for daemon metadata exists=${exists}: ${metadataPath}`);
}

async function waitForProcessExit(pid: number): Promise<void> {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      process.kill(pid, 0);
    } catch {
      return;
    }
    await sleep(50);
  }
  throw new Error(`Timed out waiting for process ${pid} to exit.`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function integrationSnapshot(
  repoRoot: string,
  id: string,
  freshness: "fresh" | "refreshing"
) {
  return {
    id,
    repo_root: repoRoot,
    workspace_root: repoRoot,
    repo_identity: repoRoot,
    config_identity: "default",
    schema_version: SCHEMA_VERSION,
    freshness,
    owner_state: "owner" as const,
    created_at: "2026-07-20T09:00:00.000Z",
    updated_at: "2026-07-20T09:00:00.000Z"
  };
}
