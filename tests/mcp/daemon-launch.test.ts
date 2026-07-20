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
  DAEMON_PROTOCOL_VERSION,
  classifyDaemonState,
  connectOrStartDaemon,
  createDaemonIdentity,
  daemonStartupRefreshDelayMsFromEnv,
  DaemonRefreshLifetimeCoordinator,
  daemonPaths,
  startAgentWorkbenchDaemon,
  type StartedAgentWorkbenchDaemon
} from "../../src/mcp/daemon.js";
import { describe, expect, it } from "vitest";
import { createPhase1DaemonLifetimeReproduction } from "../helpers/spec041-refresh-reproductions.js";
import {
  FileRepositoryOwnershipAdapter,
  LazyOwnershipGatedRefreshAuthority
} from "../../src/infrastructure/runtime/repository-ownership.js";
import type {
  DaemonRefreshActivityTransition,
  RepositoryOwnershipLease,
  RepositoryOwnershipPort,
  SnapshotRefreshControllerPort
} from "../../src/ports/index.js";

describe("Agent Workbench daemon launcher", () => {
  it("blocks lazy standalone controller creation for active and ambiguous owners", async () => {
    const owner = ownershipLease("active");
    for (const blocked of [
      { outcome: "blocked", reason: "owner_active", owner } as const,
      {
        outcome: "blocked",
        reason: "ownership_ambiguous",
        owner: { ...owner, state: "ambiguous" as const }
      } as const
    ]) {
      let controllerCreations = 0;
      const ownership: RepositoryOwnershipPort = {
        async acquire() { return blocked; },
        async release() {}
      };
      const authority = new LazyOwnershipGatedRefreshAuthority({
        ownership,
        ownership_request: ownershipRequest(),
        async create_controller() {
          controllerCreations += 1;
          throw new Error("controller must not be created");
        }
      });
      const admission = await authority.request({
        repo_root: "/repo",
        reason: "startup",
        source: "test",
        invalidation_generation: 0
      });
      expect(admission).toMatchObject({ outcome: "blocked", reason: blocked.reason, state: "idle" });
      expect(controllerCreations).toBe(0);
    }
  });

  it("reclaims repository ownership only after positive dead-owner evidence", async () => {
    const root = makeRepoRoot("agent-workbench-owner-reclaim-");
    const lockPath = path.join(root, "refresh-owner.json");
    try {
      const active = new FileRepositoryOwnershipAdapter(lockPath, () => "active");
      const first = await active.acquire(ownershipRequest());
      expect(first.outcome).toBe("acquired");
      const blocked = await active.acquire({ ...ownershipRequest(), owner_id: "contender" });
      expect(blocked).toMatchObject({ outcome: "blocked", reason: "owner_active" });

      const dead = new FileRepositoryOwnershipAdapter(lockPath, () => "dead");
      const replacement = await dead.acquire({ ...ownershipRequest(), owner_id: "replacement" });
      expect(replacement).toMatchObject({ outcome: "acquired", lease: { owner_id: "replacement" } });
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it("admits exactly one simultaneous contender for a positively dead owner", async () => {
    const root = makeRepoRoot("agent-workbench-owner-contention-");
    const lockPath = path.join(root, "refresh-owner.json");
    let arrivals = 0;
    let releaseBarrier!: () => void;
    const barrier = new Promise<void>((resolve) => { releaseBarrier = resolve; });
    const beforeReclaim = async (): Promise<void> => {
      arrivals += 1;
      if (arrivals === 2) releaseBarrier();
      await barrier;
    };
    try {
      const initial = new FileRepositoryOwnershipAdapter(lockPath, () => "active");
      await initial.acquire(ownershipRequest());
      const first = new FileRepositoryOwnershipAdapter(lockPath, () => "dead", beforeReclaim);
      const second = new FileRepositoryOwnershipAdapter(lockPath, () => "dead", beforeReclaim);
      const results = await Promise.all([
        first.acquire({ ...ownershipRequest(), owner_id: "contender-a", owner_generation: 2 }),
        second.acquire({ ...ownershipRequest(), owner_id: "contender-b", owner_generation: 3 })
      ]);

      expect(results.filter((result) => result.outcome === "acquired")).toHaveLength(1);
      expect(results.filter((result) => result.outcome === "blocked")).toEqual([
        expect.objectContaining({ reason: "ownership_ambiguous" })
      ]);
      const winner = results.find((result) => result.outcome === "acquired");
      expect(JSON.parse(fs.readFileSync(lockPath, "utf8"))).toMatchObject({
        owner_id: winner?.outcome === "acquired" ? winner.lease.owner_id : "missing"
      });
      expect(fs.readdirSync(root).filter((name) => name.endsWith(".reclaim"))).toEqual([]);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it("validates the daemon startup refresh delay contract including default and zero", () => {
    expect(daemonStartupRefreshDelayMsFromEnv({})).toBe(1000);
    expect(daemonStartupRefreshDelayMsFromEnv({
      AGENT_WORKBENCH_DAEMON_STARTUP_REFRESH_DELAY_MS: "0"
    })).toBe(0);
    expect(daemonStartupRefreshDelayMsFromEnv({
      AGENT_WORKBENCH_DAEMON_STARTUP_REFRESH_DELAY_MS: "2500"
    })).toBe(2500);
    for (const value of ["-1", "1.5", "NaN", "", "9007199254740992"]) {
      expect(() => daemonStartupRefreshDelayMsFromEnv({
        AGENT_WORKBENCH_DAEMON_STARTUP_REFRESH_DELAY_MS: value
      })).toThrow(/AGENT_WORKBENCH_DAEMON_STARTUP_REFRESH_DELAY_MS/);
    }
  });

  it("blocks malformed repository-owner evidence as ambiguous", async () => {
    const root = makeRepoRoot("agent-workbench-owner-ambiguous-");
    const lockPath = path.join(root, "refresh-owner.json");
    try {
      fs.writeFileSync(lockPath, "not-json\n");
      const ownership = new FileRepositoryOwnershipAdapter(lockPath, () => "dead");
      await expect(ownership.acquire(ownershipRequest())).resolves.toMatchObject({
        outcome: "blocked",
        reason: "ownership_ambiguous",
        owner: { state: "ambiguous" }
      });
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it("keeps idle close quarantined until worker termination is confirmed", () => {
    let terminationState: "unconfirmed" | "confirmed" = "unconfirmed";
    let listener: ((transition: DaemonRefreshActivityTransition) => void | Promise<void>) | undefined;
    let fireIdle: (() => void) | undefined;
    let closed = false;
    const controller: SnapshotRefreshControllerPort = {
      async request() {
        throw new Error("request is not part of this lifetime fixture");
      },
      getReceipt() {
        return {
          repo_root: "/repo",
          controller_generation: 1,
          execution_state: "failed",
          execution_id: "exec-1",
          target_snapshot_id: "1001",
          started_generation: 1,
          requested_generation: 1,
          activity_lease: null,
          worker_invocations: 1,
          worker_termination_state: terminationState
        };
      },
      onTransition(next) {
        listener = next;
        return () => { listener = undefined; };
      }
    };
    const lifetime = new DaemonRefreshLifetimeCoordinator({
      controller,
      connected_clients: () => 0,
      idle_grace_ms: 1,
      close: () => { closed = true; },
      schedule: (_delay, callback) => {
        fireIdle = callback;
        return { cancel: () => { fireIdle = undefined; } };
      }
    });

    lifetime.start();
    expect(fireIdle).toBeUndefined();
    terminationState = "confirmed";
    void listener?.({
      execution_id: "exec-1",
      controller_generation: 1,
      state: "termination_confirmed",
      execution_state: "failed"
    });
    fireIdle?.();
    expect(closed).toBe(true);
    lifetime.dispose();
  });

  it("releases standalone ownership exactly once only after active refresh succeeds", async () => {
    const fixture = createShutdownController("running");
    let releases = 0;
    const ownership: RepositoryOwnershipPort = {
      async acquire() { return { outcome: "acquired", lease: ownershipLease("active") }; },
      async release() { releases += 1; }
    };
    const authority = new LazyOwnershipGatedRefreshAuthority({
      ownership,
      ownership_request: ownershipRequest(),
      create_controller: async () => fixture.controller
    });
    await authority.request(refreshRequest());

    const firstClose = authority.close();
    const secondClose = authority.close();
    await Promise.resolve();
    expect(releases).toBe(0);
    fixture.settle("complete", "not_required");
    await Promise.all([firstClose, secondClose]);
    expect(releases).toBe(1);
  });

  it("retains standalone ownership through failed worker termination quarantine", async () => {
    const fixture = createShutdownController("running");
    let releases = 0;
    const ownership: RepositoryOwnershipPort = {
      async acquire() { return { outcome: "acquired", lease: ownershipLease("active") }; },
      async release() { releases += 1; }
    };
    const authority = new LazyOwnershipGatedRefreshAuthority({
      ownership,
      ownership_request: ownershipRequest(),
      create_controller: async () => fixture.controller
    });
    await authority.request(refreshRequest());
    const closing = authority.close();

    fixture.settle("failed", "unconfirmed");
    await Promise.resolve();
    expect(releases).toBe(0);
    fixture.confirmTermination();
    await closing;
    expect(releases).toBe(1);
  });

  it("delegates standalone pre-admission failure to the acquired controller", async () => {
    let recorded: unknown;
    let releases = 0;
    const controller: SnapshotRefreshControllerPort & {
      recordAdmissionFailure(input: unknown): Promise<any>;
    } = {
      async request() {
        throw new Error("request should not run");
      },
      async recordAdmissionFailure(input) {
        recorded = input;
        return {
          outcome: "blocked",
          reused: false,
          state: "idle",
          reason: "store_failure",
          message: "Refresh store operation failed."
        };
      },
      getReceipt() {
        return {
          repo_root: "/repo",
          controller_generation: 1,
          execution_state: "idle",
          started_generation: 0,
          requested_generation: 0,
          activity_lease: null,
          worker_invocations: 0,
          worker_termination_state: "not_required"
        };
      },
      onTransition() { return () => undefined; }
    };
    const authority = new LazyOwnershipGatedRefreshAuthority({
      ownership: {
        async acquire() { return { outcome: "acquired", lease: ownershipLease("active") }; },
        async release() { releases += 1; }
      },
      ownership_request: ownershipRequest(),
      create_controller: async () => controller
    });

    await expect(authority.recordAdmissionFailure({
      repo_root: "/repo",
      invalidation_generation: 4,
      code: "store_failure"
    })).resolves.toMatchObject({ outcome: "blocked", reason: "store_failure" });
    expect(recorded).toEqual({
      repo_root: "/repo",
      invalidation_generation: 4,
      code: "store_failure"
    });
    await authority.close();
    expect(releases).toBe(1);
  });

  it("does not release ownership when close races controller creation and active admission", async () => {
    const fixture = createShutdownController("running");
    const controllerReady = controlledDeferred<SnapshotRefreshControllerPort>();
    const creationEntered = controlledDeferred<void>();
    let releases = 0;
    const ownership: RepositoryOwnershipPort = {
      async acquire() { return { outcome: "acquired", lease: ownershipLease("active") }; },
      async release() { releases += 1; }
    };
    const authority = new LazyOwnershipGatedRefreshAuthority({
      ownership,
      ownership_request: ownershipRequest(),
      create_controller: async () => {
        creationEntered.resolve(undefined);
        return await controllerReady.promise;
      }
    });

    const request = authority.request(refreshRequest());
    await creationEntered.promise;
    const closing = authority.close();
    await Promise.resolve();
    expect(releases).toBe(0);
    controllerReady.resolve(fixture.controller);
    await request;
    await Promise.resolve();
    expect(releases).toBe(0);
    fixture.settle("complete", "not_required");
    await closing;
    expect(releases).toBe(1);
  });
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
            serverOptions: { startupRefreshDelayMs: 60_000 }
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
              serverOptions: { startupRefreshDelayMs: 60_000 }
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
              serverOptions: { startupRefreshDelayMs: 60_000 }
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

  it("keeps launcher identity isolated for mixed clients on one daemon", async () => {
    const repoRoot = makeRepoRoot("agent-workbench-daemon-mixed-identity-");
    const daemons: StartedAgentWorkbenchDaemon[] = [];

    try {
      const codexSocket = await connectOrStartDaemon({
        repoRoot,
        debugRepoRootOverride: false,
        integrationIdentity: {
          provider: "codex",
          plugin_name: "agent-workbench",
          plugin_version: "0.5.2"
        },
        startTimeoutMs: 2000,
        spawnDaemon: () => {
          void startAgentWorkbenchDaemon({
            repoRoot,
            idleGraceMs: 100,
            serverOptions: { startupRefreshDelayMs: 60_000 }
          }).then((daemon) => daemons.push(daemon));
          return fakeChildProcess();
        }
      });
      const claudeSocket = await connectOrStartDaemon({
        repoRoot,
        debugRepoRootOverride: false,
        integrationIdentity: {
          provider: "claude_code",
          plugin_name: "agent-workbench",
          plugin_version: "0.5.2"
        },
        startTimeoutMs: 2000,
        spawnDaemon: () => fakeChildProcess()
      });
      const codex = createSocketSession(codexSocket);
      const claude = createSocketSession(claudeSocket);

      await Promise.all([
        initializeSocketSession(codex, 1, "codex-cli"),
        initializeSocketSession(claude, 10, "codex-cli")
      ]);
      const [codexHealth, claudeHealth] = await Promise.all([
        readIntegrationProvider(codex, 2),
        readIntegrationProvider(claude, 11)
      ]);

      expect(codexHealth).toBe("codex");
      expect(claudeHealth).toBe("claude_code");
      codexSocket.destroy();
      claudeSocket.destroy();
    } finally {
      await closeDaemons(daemons);
      fs.rmSync(repoRoot, { recursive: true, force: true });
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
            serverOptions: { startupRefreshDelayMs: 60_000 }
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
            serverOptions: { startupRefreshDelayMs: 60_000 }
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
              serverOptions: { startupRefreshDelayMs: 60_000 }
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
      serverOptions: { startupRefreshDelayMs: 60_000 }
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
      serverOptions: { startupRefreshDelayMs: 60_000 }
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

  it("rejects unrecognized or unbounded launcher identity in the daemon handshake", async () => {
    const repoRoot = makeRepoRoot("agent-workbench-daemon-identity-handshake-");
    const daemon = await startAgentWorkbenchDaemon({
      repoRoot,
      idleGraceMs: 100,
      serverOptions: { startupRefreshDelayMs: 60_000 }
    });

    try {
      for (const integrationIdentity of [
        { provider: "claude" },
        { provider: "codex", plugin_version: "x".repeat(101) }
      ]) {
        const socket = net.createConnection(daemon.metadata.socketPath);
        await new Promise<void>((resolve, reject) => {
          socket.once("connect", resolve);
          socket.once("error", reject);
        });
        socket.write(`${JSON.stringify({
          protocol: "agent-workbench-daemon",
          protocolVersion: DAEMON_PROTOCOL_VERSION,
          identity: daemon.metadata.identity,
          integrationIdentity
        })}\n`);
        await new Promise<void>((resolve) => socket.once("close", () => resolve()));
      }
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
            serverOptions: { startupRefreshDelayMs: 60_000 }
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
            controller_generation: number;
            diagnostic_revision: number;
            warmup_state: string;
            graph_freshness: string;
            activity_lease_held: boolean;
            worker_termination_state: string;
          };
        };
      };

      expect(envelope.data.daemon).toMatchObject({
        pid: process.pid,
        socket_path: daemonPaths(createDaemonIdentity(repoRoot)).socketPath,
        repo_root: repoRoot,
        connected_clients: 1,
        controller_generation: expect.any(Number),
        diagnostic_revision: 0,
        warmup_state: "idle",
        graph_freshness: "cold",
        activity_lease_held: false,
        worker_termination_state: "not_required"
      });
      socket.destroy();
    } finally {
      await closeDaemons(daemons);
      fs.rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  it("reports daemon-owned diagnostic identity instead of connection-local synthetic state", async () => {
    const repoRoot = makeRepoRoot("agent-workbench-daemon-authoritative-health-");
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
            serverOptions: { startupRefreshDelayMs: 60_000 }
          }).then((daemon) => daemons.push(daemon));
          return fakeChildProcess();
        }
      });
      const session = createSocketSession(socket);
      await initializeSocketSession(session, 1, "agent-workbench-test");

      const health = await session.call({
        jsonrpc: "2.0",
        id: 2,
        method: "resources/read",
        params: { uri: "integration:///health/agent-workbench" }
      });
      const envelope = JSON.parse(health.result.contents[0].text) as {
        data: {
          daemon?: {
            controller_generation?: number;
            diagnostic_revision?: number;
            warmup_state?: string;
          };
        };
      };

      expect(envelope.data.daemon).toMatchObject({
        controller_generation: expect.any(Number),
        diagnostic_revision: expect.any(Number),
        warmup_state: "idle"
      });
      socket.destroy();
    } finally {
      await closeDaemons(daemons);
      fs.rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  it("keeps the daemon alive when requester disconnect races the idle timer", async () => {
    const lifetime = createPhase1DaemonLifetimeReproduction();
    lifetime.connectRequester();
    const worker = lifetime.startRefresh();
    await lifetime.workerStarted.promise;
    expect(lifetime.receipt()).toMatchObject({
      connected_clients: 1,
      closed: false,
      activity_lease: { state: "held", execution_id: "exec-1" }
    });

    lifetime.disconnectRequester();
    expect(lifetime.receipt()).toMatchObject({
      connected_clients: 0,
      closed: false,
      activity_lease: { state: "held" }
    });
    lifetime.fireIdleDecision();

    expect(lifetime.receipt()).toMatchObject({
      connected_clients: 0,
      closed: false,
      activity_lease: { state: "held" }
    });
    lifetime.releaseWorker.resolve(undefined);
    await worker;
  });
});

function makeRepoRoot(prefix: string): string {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  fs.writeFileSync(path.join(repoRoot, "package.json"), "{}\n");
  return repoRoot;
}

function ownershipRequest() {
  return {
    repo_root: "/repo",
    runtime_identity: "runtime:2",
    schema_version: 2,
    owner_id: "owner",
    owner_pid: process.pid,
    owner_generation: 1,
    heartbeat_at: "2026-07-20T00:00:00.000Z"
  };
}

function ownershipLease(state: "active"): RepositoryOwnershipLease & { state: "active" } {
  return { ...ownershipRequest(), state };
}

function refreshRequest() {
  return {
    repo_root: "/repo",
    reason: "startup" as const,
    source: "test",
    invalidation_generation: 1
  };
}

function createShutdownController(initialState: "running") {
  let executionState: "running" | "complete" | "failed" = initialState;
  let terminationState: "not_required" | "unconfirmed" | "confirmed" = "not_required";
  let leaseHeld = true;
  let listener: ((transition: DaemonRefreshActivityTransition) => void | Promise<void>) | undefined;
  const failure = {
    code: "worker_error" as const,
    category: "worker" as const,
    message: "Refresh worker failed." as const,
    execution_id: "exec-1",
    target_snapshot_id: "1001",
    occurred_at: "2026-07-20T00:00:01.000Z"
  };
  const controller: SnapshotRefreshControllerPort = {
    async request() {
      return {
        outcome: "accepted",
        reused: false,
        execution_id: "exec-1",
        target_snapshot_id: "1001",
        state: "planned",
        started_generation: 1,
        requested_generation: 1
      };
    },
    getReceipt() {
      return {
        repo_root: "/repo",
        controller_generation: 1,
        execution_state: executionState,
        execution_id: "exec-1",
        target_snapshot_id: "1001",
        started_generation: 1,
        requested_generation: 1,
        activity_lease: leaseHeld ? {
          execution_id: "exec-1",
          controller_generation: 1,
          acquired_at: "2026-07-20T00:00:00.000Z",
          state: "held"
        } : null,
        worker_invocations: 1,
        worker_termination_state: terminationState,
        last_failure: executionState === "failed" ? failure : undefined
      };
    },
    onTransition(next) {
      listener = next;
      return () => { listener = undefined; };
    }
  };
  return {
    controller,
    settle(state: "complete" | "failed", workerTerminationState: "not_required" | "unconfirmed") {
      executionState = state;
      terminationState = workerTerminationState;
      leaseHeld = false;
      if (state === "complete") {
        void listener?.({
          execution_id: "exec-1",
          controller_generation: 1,
          state: "terminal",
          execution_state: "complete",
          lease: {
            execution_id: "exec-1",
            controller_generation: 1,
            acquired_at: "2026-07-20T00:00:00.000Z",
            state: "released",
            released_at: "2026-07-20T00:00:01.000Z"
          }
        });
      } else {
        void listener?.({
          execution_id: "exec-1",
          controller_generation: 1,
          state: "terminal",
          execution_state: "failed",
          lease: {
            execution_id: "exec-1",
            controller_generation: 1,
            acquired_at: "2026-07-20T00:00:00.000Z",
            state: "released",
            released_at: "2026-07-20T00:00:01.000Z"
          },
          failure
        });
      }
    },
    confirmTermination() {
      terminationState = "confirmed";
      void listener?.({
        execution_id: "exec-1",
        controller_generation: 1,
        state: "termination_confirmed",
        execution_state: "failed"
      });
    }
  };
}

function controlledDeferred<T>(): {
  promise: Promise<T>;
  resolve(value: T): void;
} {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((promiseResolve) => { resolve = promiseResolve; });
  return { promise, resolve };
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

async function initializeSocketSession(
  session: ReturnType<typeof createSocketSession>,
  id: number,
  clientName: string
): Promise<void> {
  await session.call({
    jsonrpc: "2.0",
    id,
    method: "initialize",
    params: {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: clientName, version: "1.0.0" }
    }
  });
  session.notify({
    jsonrpc: "2.0",
    method: "notifications/initialized",
    params: {}
  });
}

async function readIntegrationProvider(
  session: ReturnType<typeof createSocketSession>,
  id: number
): Promise<string> {
  const response = await session.call({
    jsonrpc: "2.0",
    id,
    method: "resources/read",
    params: { uri: "integration:///health/agent-workbench" }
  });
  const envelope = JSON.parse(response.result.contents[0].text) as {
    data: { provider: string };
  };
  return envelope.data.provider;
}
