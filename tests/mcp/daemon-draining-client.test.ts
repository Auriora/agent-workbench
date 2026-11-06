/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  classifyDaemonState,
  connectOrStartDaemon,
  createDaemonIdentity,
  createDaemonMetadata,
  daemonPaths,
  publishDaemonDraining,
  writeDaemonMetadata
} from "../../src/mcp/daemon-client.js";

const temporaryRoots: string[] = [];
const temporaryIpcDirs: string[] = [];

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
  for (const ipcDir of temporaryIpcDirs.splice(0)) {
    fs.rmSync(ipcDir, { recursive: true, force: true });
  }
});

describe("daemon draining lifecycle", () => {
  it("waits on a live base-matching drain before checking socket presence", () => {
    const { identity, paths, metadata } = makeMetadata("drain-live-");
    writeDaemonMetadata(paths.metadataPath, metadata);

    expect(classifyDaemonState({
      metadataPath: paths.metadataPath,
      expectedIdentity: identity,
      socketPath: paths.socketPath,
      isProcessAlive: () => true,
      socketExists: () => false
    })).toMatchObject({
      state: "blocked",
      reason: "draining",
      metadata: { launchLifecycle: { state: "draining", phase: "draining" } }
    });
  });

  it("treats a dead drain as ordinary stale state", () => {
    const { identity, paths, metadata } = makeMetadata("drain-dead-");
    writeDaemonMetadata(paths.metadataPath, metadata);

    expect(classifyDaemonState({
      metadataPath: paths.metadataPath,
      expectedIdentity: identity,
      socketPath: paths.socketPath,
      isProcessAlive: () => false,
      socketExists: () => false
    })).toMatchObject({ state: "stale", reason: "dead_process" });
  });

  it("keeps a live prior-build drain wait-only", () => {
    const { identity, paths, metadata } = makeMetadata("drain-prior-build-");
    const priorBuild = {
      ...metadata,
      identity: {
        ...identity,
        buildFingerprint: `${identity.buildFingerprint ?? "missing"}-prior`
      }
    };
    writeDaemonMetadata(paths.metadataPath, priorBuild);

    expect(classifyDaemonState({
      metadataPath: paths.metadataPath,
      expectedIdentity: identity,
      socketPath: paths.socketPath,
      isProcessAlive: () => true,
      socketExists: () => false
    })).toMatchObject({ state: "blocked", reason: "draining" });
  });

  it("rejects malformed drain lifecycle metadata as ambiguous", () => {
    const { identity, paths, metadata } = makeMetadata("drain-invalid-");
    writeDaemonMetadata(paths.metadataPath, {
      ...metadata,
      launchLifecycle: {
        ...metadata.launchLifecycle,
        state: "draining",
        phase: "ready",
        failureCode: "child_exit"
      }
    });

    expect(classifyDaemonState({
      metadataPath: paths.metadataPath,
      expectedIdentity: identity,
      socketPath: paths.socketPath,
      isProcessAlive: () => true,
      socketExists: () => true
    })).toEqual({ state: "blocked", reason: "ambiguous_metadata" });
  });

  it("publishes an exact-owner drain idempotently and refuses replacement", () => {
    const { identity, paths, metadata } = makeMetadata("drain-publish-");
    writeDaemonMetadata(paths.metadataPath, {
      ...metadata,
      launchLifecycle: { ...metadata.launchLifecycle, state: "ready", phase: "ready" }
    });

    const draining = publishDaemonDraining({ metadataPath: paths.metadataPath, metadata: {
      ...metadata,
      launchLifecycle: { ...metadata.launchLifecycle, state: "ready", phase: "ready" }
    } });
    expect(draining.launchLifecycle).toMatchObject({ state: "draining", phase: "draining" });
    expect(publishDaemonDraining({ metadataPath: paths.metadataPath, metadata: draining })).toEqual(draining);

    const replacement = {
      ...draining,
      pid: process.pid + 1,
      launchLifecycle: {
        ...draining.launchLifecycle,
        state: "ready" as const,
        phase: "ready" as const,
        launchToken: "replacement-token"
      }
    };
    writeDaemonMetadata(paths.metadataPath, replacement);
    expect(() => publishDaemonDraining({ metadataPath: paths.metadataPath, metadata: draining }))
      .toThrow("canonical owner changed");
    expect(JSON.parse(fs.readFileSync(paths.metadataPath, "utf8"))).toMatchObject({
      pid: replacement.pid,
      launchLifecycle: { launchToken: "replacement-token", state: "ready" }
    });
  });

  it("waits when a failed old-owner proof observes its exact launch draining", async () => {
    const fixture = makeReplaceableFixture("probe-failed-drain-");
    const signaled: Array<{ pid: number; signal: NodeJS.Signals }> = [];
    let spawnCount = 0;
    let successor: net.Server | undefined;
    const proof = await createProbeServer({
      socketPath: fixture.paths.socketPath,
      expectedIdentity: fixture.oldIdentity,
      health: fixture.health,
      onHealth: ({ socket, closeProof }) => {
        publishDaemonDraining({ metadataPath: fixture.paths.metadataPath, metadata: fixture.oldMetadata });
        socket.destroy();
        void replaceWithSuccessor(fixture, closeProof, (server) => { successor = server; });
      }
    });

    try {
      const socket = await connectOrStartDaemonForFixture(fixture, signaled, () => { spawnCount += 1; });
      socket.destroy();
      expect(signaled).toEqual([]);
      expect(spawnCount).toBe(0);
      expect(proof.state.healthReadCount).toBe(1);
    } finally {
      await proof.close();
      await closeServer(successor);
    }
  });

  it("rechecks after successful proof and never signals a launch that starts draining", async () => {
    const fixture = makeReplaceableFixture("probe-success-drain-");
    const signaled: Array<{ pid: number; signal: NodeJS.Signals }> = [];
    let spawnCount = 0;
    let successor: net.Server | undefined;
    const proof = await createProbeServer({
      socketPath: fixture.paths.socketPath,
      expectedIdentity: fixture.oldIdentity,
      health: fixture.health,
      onHealth: ({ socket, sendHealth, closeProof }) => {
        publishDaemonDraining({ metadataPath: fixture.paths.metadataPath, metadata: fixture.oldMetadata });
        sendHealth();
        socket.destroy();
        void replaceWithSuccessor(fixture, closeProof, (server) => { successor = server; });
      }
    });

    try {
      const socket = await connectOrStartDaemonForFixture(fixture, signaled, () => { spawnCount += 1; });
      socket.destroy();
      expect(signaled).toEqual([]);
      expect(spawnCount).toBe(0);
      expect(proof.state.healthReadCount).toBe(1);
    } finally {
      await proof.close();
      await closeServer(successor);
    }
  });

  it("keeps an unchanged ready launch ambiguous after a failed proof", async () => {
    const fixture = makeReplaceableFixture("probe-failed-unchanged-");
    const signaled: Array<{ pid: number; signal: NodeJS.Signals }> = [];
    let spawnCount = 0;
    const proof = await createProbeServer({
      socketPath: fixture.paths.socketPath,
      expectedIdentity: fixture.oldIdentity,
      health: fixture.health,
      onHealth: ({ socket }) => { socket.destroy(); }
    });

    try {
      await expect(connectOrStartDaemonForFixture(fixture, signaled, () => { spawnCount += 1; }))
        .rejects.toThrow("blocked: ambiguous_process");
      expect(signaled).toEqual([]);
      expect(spawnCount).toBe(0);
      expect(proof.state.healthReadCount).toBe(1);
    } finally {
      await proof.close();
    }
  });

  it("does not spawn or admit a client while the exact owner is draining", async () => {
    const { identity, paths, metadata } = makeMetadata("drain-wait-");
    writeDaemonMetadata(paths.metadataPath, metadata);
    let spawnCount = 0;

    await expect(connectOrStartDaemon({
      repoRoot: identity.repoRoot,
      debugRepoRootOverride: false,
      startTimeoutMs: 120,
      handshakeTimeoutMs: 10,
      spawnDaemon: () => {
        spawnCount += 1;
        throw new Error("draining client must not spawn");
      }
    })).rejects.toThrow("Timed out waiting for Agent Workbench daemon replacement handoff");
    expect(spawnCount).toBe(0);
  });
});

function makeMetadata(prefix: string) {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  temporaryRoots.push(repoRoot);
  const identity = createDaemonIdentity(repoRoot);
  const paths = daemonPaths(identity);
  const startedAt = "2026-11-06T00:00:00.000Z";
  const metadata = createDaemonMetadata({
    identity,
    pid: process.pid,
    socketPath: paths.socketPath,
    launchToken: `${prefix}token`,
    launchStartedAt: startedAt,
    createdAt: startedAt,
    updatedAt: startedAt,
    phase: "ready"
  });
  return {
    identity,
    paths,
    metadata: {
      ...metadata,
      launchLifecycle: { ...metadata.launchLifecycle, state: "draining" as const, phase: "draining" as const }
    }
  };
}

function makeReplaceableFixture(prefix: string) {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  temporaryRoots.push(repoRoot);
  const identity = createDaemonIdentity(repoRoot);
  const paths = daemonPaths(identity);
  temporaryIpcDirs.push(paths.ipcDir);
  const oldIdentity = {
    ...identity,
    buildFingerprint: `${identity.buildFingerprint ?? "missing"}-old`
  };
  const startedAt = "2026-11-06T00:00:00.000Z";
  const oldStartingMetadata = createDaemonMetadata({
    identity: oldIdentity,
    pid: process.pid,
    socketPath: paths.socketPath,
    launchToken: `${prefix}old-token`,
    launchStartedAt: startedAt,
    createdAt: startedAt,
    updatedAt: startedAt,
    phase: "ready"
  });
  const oldMetadata = {
    ...oldStartingMetadata,
    launchLifecycle: {
      ...oldStartingMetadata.launchLifecycle,
      state: "ready" as const,
      phase: "ready" as const
    }
  };
  fs.mkdirSync(paths.metadataDir, { recursive: true });
  fs.mkdirSync(paths.ipcDir, { recursive: true });
  writeDaemonMetadata(paths.metadataPath, oldMetadata);
  return {
    repoRoot,
    identity,
    oldIdentity,
    paths,
    oldMetadata,
    health: {
      pid: process.pid,
      socket_path: paths.socketPath,
      repo_root: repoRoot
    }
  };
}

async function connectOrStartDaemonForFixture(
  fixture: ReturnType<typeof makeReplaceableFixture>,
  signaled: Array<{ pid: number; signal: NodeJS.Signals }>,
  onSpawn: () => void
) {
  return connectOrStartDaemon({
    repoRoot: fixture.repoRoot,
    debugRepoRootOverride: false,
    startTimeoutMs: 2_000,
    handshakeTimeoutMs: 250,
    signalProcess: (pid, signal) => {
      signaled.push({ pid, signal });
    },
    spawnDaemon: () => {
      onSpawn();
      throw new Error("unexpected daemon spawn during replaceable proof test");
    }
  });
}

type ProbeServer = {
  close(): Promise<void>;
  state: { handshakeCount: number; healthReadCount: number };
};

async function createProbeServer(input: {
  socketPath: string;
  expectedIdentity: ReturnType<typeof createDaemonIdentity>;
  health: { pid: number; socket_path: string; repo_root: string };
  onHealth(input: {
    socket: net.Socket;
    sendHealth(): void;
    closeProof(): Promise<void>;
  }): void;
}): Promise<ProbeServer> {
  const state = { handshakeCount: 0, healthReadCount: 0 };
  const sockets = new Set<net.Socket>();
  let close: () => Promise<void> = async () => undefined;
  const server = net.createServer((socket) => {
    sockets.add(socket);
    socket.once("close", () => sockets.delete(socket));
    let buffer = "";
    let handshakeAccepted = false;
    socket.setEncoding("utf8");
    socket.on("data", (chunk: string) => {
      buffer += chunk;
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines.filter(Boolean)) {
        const message = JSON.parse(line) as {
          protocol?: string;
          protocolVersion?: number;
          identity?: ReturnType<typeof createDaemonIdentity>;
          id?: number;
          method?: string;
        };
        if (!handshakeAccepted) {
          const identity = message.identity;
          if (
            message.protocol !== "agent-workbench-daemon" ||
            message.protocolVersion !== 1 ||
            identity === undefined ||
            identity.repoRoot !== input.expectedIdentity.repoRoot ||
            identity.runtimeVersion !== input.expectedIdentity.runtimeVersion ||
            identity.schemaVersion !== input.expectedIdentity.schemaVersion ||
            identity.protocolVersion !== input.expectedIdentity.protocolVersion ||
            identity.id !== input.expectedIdentity.id ||
            identity.buildFingerprint !== input.expectedIdentity.buildFingerprint
          ) {
            socket.destroy();
            return;
          }
          handshakeAccepted = true;
          state.handshakeCount += 1;
          continue;
        }
        if (message.method === "initialize" && typeof message.id === "number") {
          socket.write(`${JSON.stringify({
            jsonrpc: "2.0",
            id: message.id,
            result: { protocolVersion: "2025-06-18", capabilities: {}, serverInfo: { name: "probe", version: "1" } }
          })}\n`);
          continue;
        }
        if (message.method === "notifications/initialized") {
          continue;
        }
        if (message.method === "resources/read" && typeof message.id === "number") {
          state.healthReadCount += 1;
          const sendHealth = () => socket.write(`${JSON.stringify({
            jsonrpc: "2.0",
            id: message.id,
            result: { contents: [{ text: JSON.stringify({ data: { daemon: input.health } }) }] }
          })}\n`);
          input.onHealth({ socket, sendHealth, closeProof: close });
          continue;
        }
        socket.destroy();
      }
    });
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(input.socketPath, () => {
      server.off("error", reject);
      resolve();
    });
  });
  close = async () => {
    for (const socket of sockets) socket.destroy();
    await closeServer(server);
  };
  return { close, state };
}

async function replaceWithSuccessor(
  fixture: ReturnType<typeof makeReplaceableFixture>,
  closeProof: () => Promise<void>,
  assign: (server: net.Server) => void
): Promise<void> {
  await closeProof();
  const successor = net.createServer();
  successor.on("connection", (socket) => socket.on("data", () => socket.destroy()));
  await new Promise<void>((resolve, reject) => {
    successor.once("error", reject);
    successor.listen(fixture.paths.socketPath, () => {
      successor.off("error", reject);
      resolve();
    });
  });
  const successorStartingMetadata = createDaemonMetadata({
    identity: fixture.identity,
    pid: process.pid,
    socketPath: fixture.paths.socketPath,
    launchToken: "successor-token",
    launchStartedAt: "2026-11-06T00:00:01.000Z",
    createdAt: "2026-11-06T00:00:01.000Z",
    updatedAt: "2026-11-06T00:00:01.000Z",
    phase: "ready"
  });
  writeDaemonMetadata(fixture.paths.metadataPath, {
    ...successorStartingMetadata,
    launchLifecycle: {
      ...successorStartingMetadata.launchLifecycle,
      state: "ready",
      phase: "ready"
    }
  });
  assign(successor);
}

async function closeServer(server: net.Server | undefined): Promise<void> {
  if (server === undefined || !server.listening) return;
  await new Promise<void>((resolve, reject) => {
    server.close((error) => error === undefined ? resolve() : reject(error));
  });
}
