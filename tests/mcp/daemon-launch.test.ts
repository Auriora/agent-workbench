/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import type { ChildProcess } from "node:child_process";
import {
  classifyDaemonState,
  connectOrStartDaemon,
  createDaemonIdentity,
  daemonPaths,
  startAgentWorkbenchDaemon,
  type StartedAgentWorkbenchDaemon
} from "../../src/mcp/daemon.js";
import { describe, expect, it } from "vitest";

describe("Agent Workbench daemon launcher", () => {
  it("starts the daemon for the first client and reuses it for the same repo", async () => {
    const repoRoot = makeRepoRoot("agent-workbench-daemon-reuse-");
    const daemons: StartedAgentWorkbenchDaemon[] = [];
    let starts = 0;

    try {
      const first = await connectOrStartDaemon({
        repoRoot,
        debugRepoRootOverride: false,
        startTimeoutMs: 2000,
        spawnDaemon: () => {
          starts += 1;
          void startAgentWorkbenchDaemon({
            repoRoot,
            idleGraceMs: 100,
            serverOptions: { startGraphWarmup: false }
          }).then((daemon) => daemons.push(daemon));
          return fakeChildProcess();
        }
      });
      first.destroy();

      const second = await connectOrStartDaemon({
        repoRoot,
        debugRepoRootOverride: false,
        startTimeoutMs: 2000,
        spawnDaemon: () => {
          starts += 1;
          return fakeChildProcess();
        }
      });
      second.destroy();

      expect(starts).toBe(1);
    } finally {
      await closeDaemons(daemons);
      fs.rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  it("serializes cold same-repo startup across parallel clients", async () => {
    const repoRoot = makeRepoRoot("agent-workbench-daemon-parallel-");
    const daemons: StartedAgentWorkbenchDaemon[] = [];
    let starts = 0;
    let allowDaemonStart: (() => void) | undefined;
    const daemonStartGate = new Promise<void>((resolve) => {
      allowDaemonStart = resolve;
    });

    try {
      const first = connectOrStartDaemon({
        repoRoot,
        debugRepoRootOverride: false,
        startTimeoutMs: 5000,
        spawnDaemon: () => {
          starts += 1;
          void daemonStartGate
            .then(() => startAgentWorkbenchDaemon({
              repoRoot,
              idleGraceMs: 100,
              serverOptions: { startGraphWarmup: false }
            }))
            .then((daemon) => daemons.push(daemon));
          return fakeChildProcess();
        }
      });
      const second = connectOrStartDaemon({
        repoRoot,
        debugRepoRootOverride: false,
        startTimeoutMs: 5000,
        spawnDaemon: () => {
          starts += 1;
          return fakeChildProcess();
        }
      });

      await sleep(100);
      expect(starts).toBe(1);
      allowDaemonStart?.();

      const sockets = await Promise.all([first, second]);
      for (const socket of sockets) {
        socket.destroy();
      }
      expect(starts).toBe(1);
    } finally {
      allowDaemonStart?.();
      await closeDaemons(daemons);
      fs.rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  it("keeps different repo roots isolated", async () => {
    const firstRepo = makeRepoRoot("agent-workbench-daemon-first-");
    const secondRepo = makeRepoRoot("agent-workbench-daemon-second-");
    const daemons: StartedAgentWorkbenchDaemon[] = [];
    let starts = 0;

    try {
      for (const repoRoot of [firstRepo, secondRepo]) {
        const socket = await connectOrStartDaemon({
          repoRoot,
          debugRepoRootOverride: false,
          startTimeoutMs: 2000,
          spawnDaemon: () => {
            starts += 1;
            void startAgentWorkbenchDaemon({
              repoRoot,
              idleGraceMs: 100,
              serverOptions: { startGraphWarmup: false }
            }).then((daemon) => daemons.push(daemon));
            return fakeChildProcess();
          }
        });
        socket.destroy();
      }

      expect(starts).toBe(2);
      expect(createDaemonIdentity(firstRepo).id).not.toBe(createDaemonIdentity(secondRepo).id);
    } finally {
      await closeDaemons(daemons);
      fs.rmSync(firstRepo, { recursive: true, force: true });
      fs.rmSync(secondRepo, { recursive: true, force: true });
    }
  });

  it("cleans stale metadata before starting a replacement daemon", async () => {
    const repoRoot = makeRepoRoot("agent-workbench-daemon-stale-");
    const identity = createDaemonIdentity(repoRoot);
    const paths = daemonPaths(identity);
    const daemons: StartedAgentWorkbenchDaemon[] = [];
    let starts = 0;

    fs.mkdirSync(paths.metadataDir, { recursive: true });
    fs.writeFileSync(
      paths.metadataPath,
      `${JSON.stringify({
        identity,
        pid: 999_999_999,
        socketPath: paths.socketPath,
        createdAt: "2026-07-05T00:00:00.000Z"
      })}\n`
    );
    if (process.platform !== "win32") {
      fs.mkdirSync(paths.ipcDir, { recursive: true });
      fs.writeFileSync(paths.socketPath, "");
    }

    try {
      const socket = await connectOrStartDaemon({
        repoRoot,
        debugRepoRootOverride: false,
        startTimeoutMs: 2000,
        spawnDaemon: () => {
          starts += 1;
          void startAgentWorkbenchDaemon({
            repoRoot,
            idleGraceMs: 100,
            serverOptions: { startGraphWarmup: false }
          }).then((daemon) => daemons.push(daemon));
          return fakeChildProcess();
        }
      });
      socket.destroy();

      expect(starts).toBe(1);
      const metadata = JSON.parse(fs.readFileSync(paths.metadataPath, "utf8")) as { pid: number };
      expect(metadata.pid).toBe(process.pid);
    } finally {
      await closeDaemons(daemons);
      fs.rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  it("replaces live daemon metadata with a mismatched identity", async () => {
    const repoRoot = makeRepoRoot("agent-workbench-daemon-mismatch-");
    const identity = createDaemonIdentity(repoRoot);
    const paths = daemonPaths(identity);
    const daemons: StartedAgentWorkbenchDaemon[] = [];
    let starts = 0;
    const mismatchedIdentity = {
      ...identity,
      runtimeVersion: "0.0.0-old",
      id: "mismatched-live-daemon"
    };

    fs.mkdirSync(paths.metadataDir, { recursive: true });
    fs.writeFileSync(
      paths.metadataPath,
      `${JSON.stringify({
        identity: mismatchedIdentity,
        pid: process.pid,
        socketPath: paths.socketPath,
        createdAt: "2026-07-05T00:00:00.000Z"
      })}\n`
    );
    if (process.platform !== "win32") {
      fs.mkdirSync(paths.ipcDir, { recursive: true });
      fs.writeFileSync(paths.socketPath, "");
    }

    try {
      const socket = await connectOrStartDaemon({
        repoRoot,
        debugRepoRootOverride: false,
        startTimeoutMs: 2000,
        spawnDaemon: () => {
          starts += 1;
          void startAgentWorkbenchDaemon({
            repoRoot,
            idleGraceMs: 100,
            serverOptions: { startGraphWarmup: false }
          }).then((daemon) => daemons.push(daemon));
          return fakeChildProcess();
        }
      });
      socket.destroy();

      expect(starts).toBe(1);
      const metadata = JSON.parse(fs.readFileSync(paths.metadataPath, "utf8")) as {
        identity: { id: string; runtimeVersion: string };
      };
      expect(metadata.identity).toMatchObject({
        id: identity.id,
        runtimeVersion: identity.runtimeVersion
      });
    } finally {
      await closeDaemons(daemons);
      fs.rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  it("serializes stale-owner cleanup across parallel clients", async () => {
    const repoRoot = makeRepoRoot("agent-workbench-daemon-parallel-stale-");
    const identity = createDaemonIdentity(repoRoot);
    const paths = daemonPaths(identity);
    const daemons: StartedAgentWorkbenchDaemon[] = [];
    let starts = 0;
    let allowDaemonStart: (() => void) | undefined;
    const daemonStartGate = new Promise<void>((resolve) => {
      allowDaemonStart = resolve;
    });

    fs.mkdirSync(paths.metadataDir, { recursive: true });
    fs.writeFileSync(
      paths.metadataPath,
      `${JSON.stringify({
        identity,
        pid: 999_999_999,
        socketPath: paths.socketPath,
        createdAt: "2026-07-05T00:00:00.000Z"
      })}\n`
    );
    if (process.platform !== "win32") {
      fs.mkdirSync(paths.ipcDir, { recursive: true });
      fs.writeFileSync(paths.socketPath, "");
    }

    try {
      const first = connectOrStartDaemon({
        repoRoot,
        debugRepoRootOverride: false,
        startTimeoutMs: 5000,
        spawnDaemon: () => {
          starts += 1;
          void daemonStartGate
            .then(() => startAgentWorkbenchDaemon({
              repoRoot,
              idleGraceMs: 100,
              serverOptions: { startGraphWarmup: false }
            }))
            .then((daemon) => daemons.push(daemon));
          return fakeChildProcess();
        }
      });
      const second = connectOrStartDaemon({
        repoRoot,
        debugRepoRootOverride: false,
        startTimeoutMs: 5000,
        spawnDaemon: () => {
          starts += 1;
          return fakeChildProcess();
        }
      });

      await sleep(100);
      expect(starts).toBe(1);
      allowDaemonStart?.();

      const sockets = await Promise.all([first, second]);
      for (const socket of sockets) {
        socket.destroy();
      }
      expect(starts).toBe(1);
    } finally {
      allowDaemonStart?.();
      await closeDaemons(daemons);
      fs.rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  it("creates owner-only metadata and IPC directories on POSIX", async () => {
    if (process.platform === "win32") {
      return;
    }
    const repoRoot = makeRepoRoot("agent-workbench-daemon-permissions-");
    const daemon = await startAgentWorkbenchDaemon({
      repoRoot,
      idleGraceMs: 100,
      serverOptions: { startGraphWarmup: false }
    });
    const paths = daemonPaths(createDaemonIdentity(repoRoot));

    try {
      expect(fs.statSync(paths.metadataDir).mode & 0o777).toBe(0o700);
      expect(fs.statSync(paths.ipcDir).mode & 0o777).toBe(0o700);
      expect(paths.socketPath.startsWith(`${paths.ipcDir}${path.sep}`)).toBe(true);
    } finally {
      await daemon.close();
      fs.rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  it("classifies malformed metadata as stale and rejects identity mismatches", () => {
    const repoRoot = makeRepoRoot("agent-workbench-daemon-classify-");
    const identity = createDaemonIdentity(repoRoot);
    const paths = daemonPaths(identity);

    try {
      fs.mkdirSync(paths.metadataDir, { recursive: true });
      fs.writeFileSync(paths.metadataPath, "not-json\n");

      expect(
        classifyDaemonState({
          metadataPath: paths.metadataPath,
          expectedIdentity: identity,
          socketPath: paths.socketPath
        })
      ).toEqual({ state: "stale", reason: "malformed_metadata" });

      const otherIdentity = createDaemonIdentity(path.join(repoRoot, "other"));
      fs.writeFileSync(
        paths.metadataPath,
        `${JSON.stringify({
          identity: otherIdentity,
          pid: process.pid,
          socketPath: paths.socketPath,
          createdAt: "2026-07-05T00:00:00.000Z"
        })}\n`
      );

      expect(
        classifyDaemonState({
          metadataPath: paths.metadataPath,
          expectedIdentity: identity,
          socketPath: paths.socketPath,
          isProcessAlive: () => true,
          socketExists: () => true
        })
      ).toMatchObject({ state: "mismatched", reason: "identity_mismatch" });

      expect(
        classifyDaemonState({
          metadataPath: paths.metadataPath,
          expectedIdentity: identity,
          socketPath: paths.socketPath,
          isProcessAlive: () => false,
          socketExists: () => true
        })
      ).toMatchObject({ state: "stale", reason: "identity_mismatch" });
    } finally {
      fs.rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  it("rejects malformed daemon socket handshakes", async () => {
    const repoRoot = makeRepoRoot("agent-workbench-daemon-handshake-");
    const daemon = await startAgentWorkbenchDaemon({
      repoRoot,
      idleGraceMs: 100,
      serverOptions: { startGraphWarmup: false }
    });

    try {
      const socket = net.createConnection(daemon.metadata.socketPath);
      await new Promise<void>((resolve, reject) => {
        socket.once("connect", resolve);
        socket.once("error", reject);
      });
      socket.write("this is not json\n");
      await new Promise<void>((resolve) => socket.once("close", () => resolve()));
      expect(daemon.connectedClients()).toBe(0);
    } finally {
      await daemon.close();
      fs.rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  it("reports daemon diagnostics through integration health", async () => {
    const repoRoot = makeRepoRoot("agent-workbench-daemon-health-");
    const daemons: StartedAgentWorkbenchDaemon[] = [];

    try {
      const socket = await connectOrStartDaemon({
        repoRoot,
        debugRepoRootOverride: false,
        startTimeoutMs: 2000,
        spawnDaemon: () => {
          void startAgentWorkbenchDaemon({
            repoRoot,
            idleGraceMs: 100,
            serverOptions: { startGraphWarmup: false }
          }).then((daemon) => daemons.push(daemon));
          return fakeChildProcess();
        }
      });
      const session = createSocketSession(socket);
      await session.call({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-06-18",
          capabilities: {},
          clientInfo: {
            name: "agent-workbench-test",
            version: "0.1.0"
          }
        }
      });
      session.notify({
        jsonrpc: "2.0",
        method: "notifications/initialized",
        params: {}
      });

      const health = await session.call({
        jsonrpc: "2.0",
        id: 2,
        method: "resources/read",
        params: {
          uri: "integration:///health/agent-workbench"
        }
      });
      const envelope = JSON.parse(health.result.contents[0].text) as {
        data: {
          daemon?: {
            pid: number;
            socket_path: string;
            repo_root: string;
            connected_clients: number;
            warmup_state: string;
            graph_freshness: string;
          };
        };
      };

      expect(envelope.data.daemon).toMatchObject({
        pid: process.pid,
        socket_path: daemonPaths(createDaemonIdentity(repoRoot)).socketPath,
        repo_root: repoRoot,
        connected_clients: 1,
        warmup_state: "idle",
        graph_freshness: "unknown"
      });
      socket.destroy();
    } finally {
      await closeDaemons(daemons);
      fs.rmSync(repoRoot, { recursive: true, force: true });
    }
  });
});

function makeRepoRoot(prefix: string): string {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  fs.writeFileSync(path.join(repoRoot, "package.json"), "{}\n");
  return repoRoot;
}

function fakeChildProcess(): ChildProcess {
  return {
    unref: () => fakeChildProcess()
  } as unknown as ChildProcess;
}

async function closeDaemons(daemons: StartedAgentWorkbenchDaemon[]): Promise<void> {
  await Promise.allSettled(daemons.map((daemon) => daemon.close()));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createSocketSession(socket: net.Socket): {
  call: (message: { id: number } & Record<string, unknown>) => Promise<any>;
  notify: (message: Record<string, unknown>) => void;
} {
  let stdout = "";
  const pendingCalls = new Map<number, { resolve: (message: any) => void; reject: (error: Error) => void }>();

  socket.setEncoding("utf8");
  socket.on("data", (chunk: string) => {
    stdout += chunk;
    const lines = stdout.split("\n");
    stdout = lines.pop() ?? "";
    for (const line of lines.filter(Boolean)) {
      const parsed = JSON.parse(line) as { id?: number };
      if (typeof parsed.id !== "number") {
        continue;
      }
      const pending = pendingCalls.get(parsed.id);
      if (pending !== undefined) {
        pendingCalls.delete(parsed.id);
        pending.resolve(parsed);
      }
    }
  });

  return {
    call(message: { id: number } & Record<string, unknown>) {
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          pendingCalls.delete(message.id);
          reject(new Error(`Timed out waiting for daemon MCP response id=${message.id}`));
        }, 4000);
        pendingCalls.set(message.id, {
          resolve: (response) => {
            clearTimeout(timeout);
            resolve(response);
          },
          reject
        });
        socket.write(`${JSON.stringify(message)}\n`);
      });
    },
    notify(message: Record<string, unknown>) {
      socket.write(`${JSON.stringify(message)}\n`);
    }
  };
}
