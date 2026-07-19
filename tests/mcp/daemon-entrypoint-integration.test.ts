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
import { graphStorePath } from "../../src/server.js";
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

  it.fails("shares one authoritative refresh diagnostic identity across checkout/source clients", async () => {
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
  }, 15_000);

  it.fails("executes a refresh requested by a non-startup checkout/source client", async () => {
    const repoRoot = createCleanFixtureCopy("agent-workbench-entrypoint-non-startup-refresh-");
    const startupClient = trackSession(await startEntryPointSession(repoRoot));
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

    // The legacy later connection remains planned with no executor. Setup and
    // stale admission pass; only this replacement/fresh assertion is expected
    // to fail until the daemon owns the controller and executor.
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
  }, 15_000);

  it("returns graph-backed results for concurrent checkout/source clients without raw lock output", async () => {
    const repoRoot = createCleanFixtureCopy("agent-workbench-entrypoint-concurrent-");
    const first = trackSession(await startEntryPointSession(repoRoot));
    const second = trackSession(await startEntryPointSession(repoRoot));
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

  it("does not expose raw SQLite lock text when graph startup is blocked", async () => {
    const repoRoot = createCleanFixtureCopy("agent-workbench-entrypoint-locked-");
    const lock = await holdExclusiveSqliteLockUntilReleased(graphStorePath(repoRoot));
    const session = trackSession(await startEntryPointSession(repoRoot, { idleGraceMs: 100 }));

    try {
      await initializeSession(session);
      const response = await session.call("resources/read", { uri: "repo:///status" }, 22_000);
      const serialized = [
        JSON.stringify(response),
        session.stderr(),
        session.stdoutRemainder()
      ].join("\n");

      expect(serialized).not.toMatch(/database is locked/i);
      expect(serialized).toMatch(/invalid_due_to_environment|blocked|provider_unavailable/i);
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
} {
  const envelope = parseEnvelope(message) as {
    data: {
      daemon?: {
        controller_generation?: number;
        diagnostic_revision?: number;
        execution_state?: string;
      };
    };
  };
  if (envelope.data.daemon === undefined) {
    throw new Error(`Missing daemon health: ${JSON.stringify(envelope)}`);
  }
  return envelope.data.daemon;
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
