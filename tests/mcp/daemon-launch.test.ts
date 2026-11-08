/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import fs from "node:fs";
import crypto from "node:crypto";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { spawn, type ChildProcess } from "node:child_process";
import { PassThrough } from "node:stream";
import { EventEmitter } from "node:events";
import { performance } from "node:perf_hooks";
import {
  acquireDaemonStartupLock,
  DAEMON_PROTOCOL_VERSION,
  classifyDaemonState,
  connectOrStartDaemon,
  createDaemonMetadata,
  createDaemonStartupLock,
  createDaemonIdentity,
  daemonStartupRefreshDelayMsFromEnv,
  DaemonRefreshLifetimeCoordinator,
  daemonPaths,
  startAgentWorkbenchDaemon,
  type StartedAgentWorkbenchDaemon
} from "../../src/mcp/daemon.js";
import { afterEach, describe, expect, it, vi } from "vitest";
import { currentStartupGuardOwnerScope } from "../../src/infrastructure/runtime/startup-guard-scope.js";
import { createPhase1DaemonLifetimeReproduction } from "../helpers/spec041-refresh-reproductions.js";
import {
  FileRepositoryOwnershipAdapter,
  LazyOwnershipGatedRefreshAuthority
} from "../../src/infrastructure/runtime/repository-ownership.js";
import type {
  DaemonLifetimeEvidencePort,
  DaemonRefreshActivityTransition,
  RepositoryOwnershipLease,
  RepositoryOwnershipPort,
  SnapshotRefreshControllerPort,
  TelemetryRecorderPort
} from "../../src/ports/index.js";
import type {
  DaemonLifetimeEvidence,
  DaemonLifetimeLaunch
} from "../../src/contracts/daemon-lifetime-contracts.js";
import type { DaemonShutdownReceipt } from "../../src/contracts/daemon-shutdown-contracts.js";
import {
  MAX_DAEMON_HANDSHAKE_BYTES,
  MAX_MCP_FRAME_BYTES
} from "../../src/contracts/mcp-transport-contracts.js";
import { openGraphStore, SCHEMA_VERSION } from "../../src/infrastructure/sqlite/graph-store.js";
import { graphStorePath } from "../../src/infrastructure/sqlite/graph-store-location.js";

describe("Agent Workbench daemon launcher", () => {
  it("blocks shutdown cleanup and a successor while disconnected application work remains unsettled", async () => {
    const repoRoot = makeRepoRoot("agent-workbench-admission-shutdown-");
    const entered = controlledDeferred<void>();
    const finish = controlledDeferred<void>();
    const settled = controlledDeferred<void>();
    const daemon = await startAgentWorkbenchDaemon({
      repoRoot,
      idleGraceMs: 60_000,
      serverOptions: { startupRefreshDelayMs: 60_000 },
      testHooks: {
        configureMcpServer(server) {
          server.tool("delayed_admission_test", {}, async () => {
            entered.resolve();
            await finish.promise;
            settled.resolve();
            return { content: [{ type: "text", text: "finished" }] };
          });
        }
      }
    });
    const socket = await connectSocketEventually(daemon.metadata.socketPath);
    try {
      const session = createSocketSession(socket);
      socket.write(`${JSON.stringify({
        protocol: "agent-workbench-daemon",
        protocolVersion: DAEMON_PROTOCOL_VERSION,
        identity: daemon.metadata.identity
      })}\n`);
      await initializeSocketSession(session, 7101, "admission-shutdown");
      socket.write(`${JSON.stringify({
        jsonrpc: "2.0", id: 7102, method: "tools/call",
        params: { name: "delayed_admission_test", arguments: {} }
      })}\n`);
      await entered.promise;
      const outcome = await daemon.close();
      expect(outcome).toMatchObject({ state: "blocked", phase: "resources", cause: "deadline" });
      const paths = daemonPaths(daemon.metadata.identity);
      const retained = JSON.parse(fs.readFileSync(paths.metadataPath, "utf8"));
      expect(retained.launchLifecycle.state).toBe("draining");
      await expect(startAgentWorkbenchDaemon({
        repoRoot, serverOptions: { startupRefreshDelayMs: 60_000 }
      })).rejects.toThrow();
      expect(JSON.parse(fs.readFileSync(paths.metadataPath, "utf8")).launchLifecycle.state).toBe("draining");
      finish.resolve();
      await settled.promise;
      await new Promise<void>((resolve) => setImmediate(resolve));
      // Late settlement cannot bypass the coordinator's terminal cleanup fence.
      expect(JSON.parse(fs.readFileSync(paths.metadataPath, "utf8")).launchLifecycle.state).toBe("draining");
    } finally {
      finish.resolve();
      socket.destroy();
      await daemon.close();
      fs.rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  it("caps ready and handshaking sessions together while an established client remains callable", async () => {
    const repoRoot = makeRepoRoot("agent-workbench-daemon-admission-");
    const daemon = await startAgentWorkbenchDaemon({
      repoRoot,
      idleGraceMs: 60_000,
      serverOptions: { startupRefreshDelayMs: 60_000 }
    });
    const sockets: net.Socket[] = [];
    try {
      const healthy = await connectSocketEventually(daemon.metadata.socketPath);
      sockets.push(healthy);
      const session = createSocketSession(healthy);
      healthy.write(`${JSON.stringify({
        protocol: "agent-workbench-daemon",
        protocolVersion: DAEMON_PROTOCOL_VERSION,
        identity: daemon.metadata.identity
      })}\n`);
      await initializeSocketSession(session, 7001, "admission-healthy");
      for (let index = 1; index < 64; index += 1) {
        const socket = await connectSocketEventually(daemon.metadata.socketPath);
        socket.on("error", () => undefined);
        sockets.push(socket);
      }
      await vi.waitFor(() => expect(daemon.connectedClients()).toBe(64));
      const excess = net.createConnection(daemon.metadata.socketPath);
      excess.on("error", () => undefined);
      sockets.push(excess);
      await new Promise<void>((resolve) => excess.once("close", () => resolve()));
      expect(daemon.connectedClients()).toBe(64);
      expect((await session.call({ jsonrpc: "2.0", id: 7002, method: "ping" })).result).toEqual({});

      sockets[1].destroy();
      await vi.waitFor(() => expect(daemon.connectedClients()).toBe(63));
      const replacement = await connectSocketEventually(daemon.metadata.socketPath);
      sockets.push(replacement);
      await vi.waitFor(() => expect(daemon.connectedClients()).toBe(64));
      expect((await session.call({ jsonrpc: "2.0", id: 7003, method: "ping" })).result).toEqual({});
    } finally {
      for (const socket of sockets) socket.destroy();
      await daemon.close();
      fs.rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  it("activates lifetime evidence on admission and exposes it through health", async () => {
    const repoRoot = makeRepoRoot("agent-workbench-daemon-lifetime-");
    const evidence = new AdmissionEvidence();
    const daemon = await startAgentWorkbenchDaemon({
      repoRoot,
      idleGraceMs: 3_000,
      lifetimeEvidence: evidence,
      serverOptions: { startupRefreshDelayMs: 60_000 }
    });
    const socket = await connectOrStartDaemon({
      repoRoot,
      debugRepoRootOverride: false,
      startTimeoutMs: 2_000
    });
    const session = createSocketSession(socket);

    try {
      expect(evidence.readyCalls).toHaveLength(1);
      await initializeSocketSession(session, 1, "lifetime-test");
      const response = await session.call({
        jsonrpc: "2.0",
        id: 2,
        method: "resources/read",
        params: { uri: "integration:///health/agent-workbench" }
      });
      const text = response.result?.contents?.[0]?.text ?? response.result?.content?.[0]?.text;
      expect(text).toBeTypeOf("string");
      const health = JSON.parse(text ?? "{}");
      expect(health.data.daemon_lifetime_evidence).toMatchObject({
        status: "available",
        current: { phase: "ready", reason: "admitted" }
      });
    } finally {
      socket.destroy();
      const receipt = await daemon.close();
      expect(receipt.state).toBe("settled");
      expect(evidence.shutdownReceipts.at(-1)).toMatchObject({
        state: "settled",
        phase: "complete",
        cause: "complete"
      });
    }
  });

  it("owns one shared telemetry lifecycle across daemon clients", async () => {
    const repoRoot = makeRepoRoot("agent-workbench-daemon-telemetry-");
    const paths = daemonPaths(createDaemonIdentity(repoRoot));
    const records: string[] = [];
    let factoryCalls = 0;
    const shutdown = vi.fn(async () => undefined);
    const telemetry: TelemetryRecorderPort = {
      record(name) { records.push(name); },
      recordError() {},
      flush() {},
      shutdown
    };
    const daemon = await startAgentWorkbenchDaemon({
      repoRoot,
      idleGraceMs: 3_000,
      serverOptions: { startupRefreshDelayMs: 60_000 },
      testHooks: {
        createTelemetry() {
          factoryCalls += 1;
          return telemetry;
        }
      }
    });
    const sockets: net.Socket[] = [];

    try {
      for (const [index, clientName] of ["first", "second"].entries()) {
        const socket = await connectOrStartDaemon({
          repoRoot,
          debugRepoRootOverride: false,
          startTimeoutMs: 2_000
        });
        sockets.push(socket);
        const session = createSocketSession(socket);
        await initializeSocketSession(session, index + 1, clientName);
        await session.call({
          jsonrpc: "2.0",
          id: index + 10,
          method: "resources/read",
          params: { uri: "repo:///status" }
        });
      }

      expect(factoryCalls).toBe(1);
      expect(records.filter((name) => name === "mcp.resource.dispatch")).toHaveLength(2);
    } finally {
      for (const socket of sockets) socket.destroy();
      await daemon.close();
      await daemon.close();
      fs.rmSync(repoRoot, { recursive: true, force: true });
      fs.rmSync(paths.ipcDir, { recursive: true, force: true });
    }

    expect(shutdown).toHaveBeenCalledTimes(1);
  });

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

  it("retries lazy refresh ownership after an active owner releases", async () => {
    const fixture = createShutdownController("running");
    const owner = ownershipLease("active");
    let acquisitions = 0;
    const authority = new LazyOwnershipGatedRefreshAuthority({
      ownership: {
        async acquire() {
          acquisitions += 1;
          return acquisitions === 1
            ? { outcome: "blocked", reason: "owner_active", owner } as const
            : { outcome: "acquired", lease: owner } as const;
        },
        async release() {}
      },
      ownership_request: ownershipRequest(),
      create_controller: async () => fixture.controller
    });

    expect(await authority.request(refreshRequest())).toMatchObject({
      outcome: "blocked",
      reason: "owner_active",
      state: "idle"
    });
    expect(await authority.request(refreshRequest())).toMatchObject({
      outcome: "accepted",
      state: "planned"
    });
    expect(acquisitions).toBe(2);
    fixture.settle("complete", "not_required");
    await authority.close();
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
      expect(replacement).toMatchObject({
        outcome: "acquired",
        lease: { owner_id: "replacement" },
        recovered_owners: [{ owner_id: "owner", state: "dead" }]
      });
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it("preserves dead-owner evidence until recovery is confirmed across replacement crashes", async () => {
    const root = makeRepoRoot("agent-workbench-owner-chain-");
    const lockPath = path.join(root, "refresh-owner.json");
    try {
      const first = new FileRepositoryOwnershipAdapter(lockPath, () => "dead");
      await first.acquire({ ...ownershipRequest(), owner_pid: 700001, owner_generation: 1 });
      const second = await first.acquire({
        ...ownershipRequest(), owner_id: "second", owner_pid: 700002, owner_generation: 2
      });
      expect(second).toMatchObject({ outcome: "acquired", recovered_owners: [{ owner_generation: 1 }] });

      const thirdAdapter = new FileRepositoryOwnershipAdapter(lockPath, () => "dead");
      const third = await thirdAdapter.acquire({
        ...ownershipRequest(), owner_id: "third", owner_pid: 700003, owner_generation: 3
      });
      expect(third).toMatchObject({
        outcome: "acquired",
        recovered_owners: [{ owner_generation: 1 }, { owner_generation: 2 }]
      });
      if (third.outcome === "acquired") {
        await thirdAdapter.release({ lease: third.lease });
      }
      expect(JSON.parse(fs.readFileSync(lockPath, "utf8"))).toMatchObject({
        owner_generation: 2,
        state: "dead",
        recovered_owners: [{ owner_generation: 1 }]
      });
      const fourth = await new FileRepositoryOwnershipAdapter(lockPath, () => "dead").acquire({
        ...ownershipRequest(), owner_id: "fourth", owner_pid: 700004, owner_generation: 4
      });
      expect(fourth).toMatchObject({
        outcome: "acquired",
        recovered_owners: [{ owner_generation: 1 }, { owner_generation: 2 }]
      });
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it("reclaims an abandoned reclaim guard only with positive guard-owner death", async () => {
    const root = makeRepoRoot("agent-workbench-reclaim-guard-");
    const lockPath = path.join(root, "refresh-owner.json");
    const guardPath = `${lockPath}.reclaim`;
    try {
      fs.writeFileSync(lockPath, `${JSON.stringify({
        ...ownershipRequest(), owner_pid: 700010, owner_generation: 10, state: "active"
      })}\n`);
      fs.writeFileSync(guardPath, `${JSON.stringify({
        ...ownershipRequest(), owner_id: "dead-guard", owner_pid: 700011,
        owner_generation: 11, state: "active"
      })}\n`);
      const adapter = new FileRepositoryOwnershipAdapter(lockPath, (pid) =>
        pid === process.pid ? "active" : "dead"
      );
      await expect(adapter.acquire({
        ...ownershipRequest(), owner_id: "replacement", owner_generation: 12
      })).resolves.toMatchObject({ outcome: "acquired" });
      expect(fs.existsSync(guardPath)).toBe(false);

      fs.writeFileSync(lockPath, `${JSON.stringify({
        ...ownershipRequest(), owner_pid: 700020, owner_generation: 20, state: "active"
      })}\n`);
      fs.writeFileSync(guardPath, `${JSON.stringify({
        ...ownershipRequest(), owner_id: "live-guard", owner_pid: process.pid,
        owner_generation: 21, state: "active"
      })}\n`);
      await expect(adapter.acquire({
        ...ownershipRequest(), owner_id: "blocked", owner_generation: 22
      })).resolves.toMatchObject({ outcome: "blocked", reason: "ownership_ambiguous" });
      expect(fs.existsSync(guardPath)).toBe(true);

      fs.rmSync(lockPath, { force: true });
      fs.writeFileSync(guardPath, `${JSON.stringify({
        ...ownershipRequest(), owner_id: "orphaned-dead-guard", owner_pid: 700030,
        owner_generation: 30, state: "active"
      })}\n`);
      await expect(adapter.acquire({
        ...ownershipRequest(), owner_id: "guard-replacement", owner_generation: 31
      })).resolves.toMatchObject({
        outcome: "acquired",
        recovered_owners: [{ owner_generation: 30 }]
      });
      expect(fs.existsSync(guardPath)).toBe(false);
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
      async shutdown() {},
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
      async shutdown() {},
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
        spawnDaemon: (spawnInput) => {
          starts += 1;
          void startAgentWorkbenchDaemon({
            launchToken: spawnInput.launchToken,
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
        spawnDaemon: (spawnInput) => {
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

  it("lets contenders wait on one in-flight launch and reuse a single spawn", async () => {
    const repoRoot = makeRepoRoot("agent-workbench-daemon-starting-");
    const identity = createDaemonIdentity(repoRoot);
    const paths = daemonPaths(identity);
    const daemons: StartedAgentWorkbenchDaemon[] = [];
    let releaseStart: (() => void) | undefined;
    const startGate = new Promise<void>((resolve) => { releaseStart = resolve; });
    let starts = 0;

    try {
      const first = connectOrStartDaemon({
        repoRoot,
        debugRepoRootOverride: false,
        startTimeoutMs: 1500,
        spawnDaemon: (spawnInput) => {
          starts += 1;
          void startGate.then(async () => {
            const daemon = await startAgentWorkbenchDaemon({
              launchToken: spawnInput.launchToken,
              repoRoot,
              idleGraceMs: 100,
              serverOptions: { startupRefreshDelayMs: 60_000 }
            });
            daemons.push(daemon);
          });
          return fakeChildProcess();
        }
      });
      await sleep(25);
      let starting: unknown | undefined;
      for (let attempt = 0; attempt < 25 && starting === undefined; attempt += 1) {
        if (fs.existsSync(paths.metadataPath)) {
          starting = safeReadJson(paths.metadataPath);
          if (
            typeof starting === "object" &&
            starting !== null &&
            (starting as { launchLifecycle?: { state?: string } }).launchLifecycle?.state === "starting"
          ) {
            break;
          }
        }
        await sleep(20);
      }
      expect(starting).toBeDefined();

      const second = connectOrStartDaemon({
        repoRoot,
        debugRepoRootOverride: false,
        startTimeoutMs: 2000,
        spawnDaemon: (spawnInput) => {
          starts += 1;
          return fakeChildProcess();
        }
      });
      releaseStart?.();
      const [firstSocket, secondSocket] = await Promise.all([first, second]);
      firstSocket.destroy();
      secondSocket.destroy();
      expect(starts).toBe(1);
      expect(fs.existsSync(paths.startupLockPath)).toBe(false);
      const finalMetadata = safeReadJson(paths.metadataPath) as { launchLifecycle?: { state?: string } };
      expect(finalMetadata.launchLifecycle).toMatchObject({ state: "ready" });
    } finally {
      releaseStart?.();
      await closeDaemons(daemons);
      fs.rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  it("does not rewrite live startup evidence as terminal on caller timeout", async () => {
    const repoRoot = makeRepoRoot("agent-workbench-daemon-startup-timeout-");
    const paths = daemonPaths(createDaemonIdentity(repoRoot));

    try {
      await expect(connectOrStartDaemon({
        repoRoot,
        debugRepoRootOverride: false,
        startTimeoutMs: 120,
        spawnDaemon: (spawnInput) => {
          return fakeChildProcess();
        }
      })).rejects.toThrow(/Timed out connecting to Agent Workbench daemon/);

      const metadata = safeReadJson(paths.metadataPath) as {
        launchLifecycle?: { state?: string; phase?: string; failureCode?: string };
        pid?: number;
      };
      expect(metadata).toMatchObject({
        launchLifecycle: {
          state: "starting",
          phase: "launching"
        }
      });
      expect(typeof metadata.pid).toBe("number");
      expect(fs.existsSync(paths.startupLockPath)).toBe(false);
    } finally {
      fs.rmSync(repoRoot, { recursive: true, force: true });
      fs.rmSync(paths.ipcDir, { recursive: true, force: true });
    }
  });

  it("reuses an existing legacy daemon metadata record without launch lifecycle state", async () => {
    const repoRoot = makeRepoRoot("agent-workbench-daemon-legacy-metadata-");
    const identity = createDaemonIdentity(repoRoot);
    const paths = daemonPaths(identity);
    const startedAt = "2026-07-05T00:00:00.000Z";
    const metadata = {
      identity,
      pid: process.pid,
      socketPath: paths.socketPath,
      createdAt: startedAt
    };

    fs.mkdirSync(paths.metadataDir, { recursive: true });
    if (process.platform !== "win32") {
      fs.mkdirSync(paths.ipcDir, { recursive: true });
    }
    fs.writeFileSync(paths.metadataPath, `${JSON.stringify(metadata)}\n`);

    const acceptedSockets = new Set<net.Socket>();
    const server = net.createServer((socket) => {
      acceptedSockets.add(socket);
      socket.once("close", () => acceptedSockets.delete(socket));
      socket.write(`${JSON.stringify({
        protocol: "agent-workbench-daemon",
        protocolVersion: DAEMON_PROTOCOL_VERSION,
        identity
      })}\n`);
    });
    await new Promise<void>((resolve) => {
      server.listen(paths.socketPath, () => {
        resolve();
      });
    });
    let socket: net.Socket | undefined;
    try {
      socket = await connectOrStartDaemon({
        repoRoot,
        debugRepoRootOverride: false,
        startTimeoutMs: 2000,
        spawnDaemon: (spawnInput) => {
          throw new Error("Legacy metadata should reuse existing daemon.");
        }
      });
      socket.destroy();
    } finally {
      if (socket !== undefined) {
        socket.destroy();
      }
      for (const acceptedSocket of acceptedSockets) {
        acceptedSocket.destroy();
      }
      await new Promise<void>((resolve) => {
        server.close(() => {
          resolve();
        });
      });
      fs.rmSync(repoRoot, { recursive: true, force: true });
      fs.rmSync(paths.ipcDir, { recursive: true, force: true });
    }
  });

  it("uses identity-scoped metadata and startup-lock paths for startup convergence", () => {
    const repoRoot = makeRepoRoot("agent-workbench-daemon-identity-paths-");
    const identity = createDaemonIdentity(repoRoot);
    const sameIdentity = daemonPaths(identity);
    const alternateIdentity = {
      ...identity,
      runtimeVersion: "0.0.0-legacy",
      id: `alternate-${identity.id.slice(12)}`
    };
    const rebuiltSameVersionIdentity = {
      ...identity,
      buildFingerprint: `${identity.buildFingerprint ?? "missing"}-rebuilt`
    };
    const alternate = daemonPaths(alternateIdentity);
    const rebuiltSameVersion = daemonPaths(rebuiltSameVersionIdentity);
    const shortHash = identity.id.slice(0, 24);
    const alternateHash = alternateIdentity.id.slice(0, 24);
    const expectedIdentityId = crypto.createHash("sha256").update([
      identity.repoRoot,
      identity.runtimeVersion,
      String(identity.schemaVersion),
      String(identity.protocolVersion)
    ].join("\0")).digest("hex");

    try {
      expect(identity.id).toBe(expectedIdentityId);
      expect(sameIdentity.metadataPath).toBe(path.join(
        sameIdentity.metadataDir,
        `${shortHash}-daemon.json`
      ));
      expect(sameIdentity.startupLockPath).toBe(path.join(
        sameIdentity.metadataDir,
        `${shortHash}-startup.lock`
      ));
      expect(alternate.metadataPath).toBe(path.join(
        alternate.metadataDir,
        `${alternateHash}-daemon.json`
      ));
      expect(alternate.startupLockPath).toBe(path.join(
        alternate.metadataDir,
        `${alternateHash}-startup.lock`
      ));
      expect(sameIdentity.metadataPath).not.toBe(alternate.metadataPath);
      expect(sameIdentity.startupLockPath).not.toBe(alternate.startupLockPath);
      expect(rebuiltSameVersion.metadataPath).toBe(sameIdentity.metadataPath);
      expect(rebuiltSameVersion.startupLockPath).toBe(sameIdentity.startupLockPath);
      expect(daemonPaths(createDaemonIdentity(repoRoot)).metadataPath).toBe(sameIdentity.metadataPath);
      expect(sameIdentity.metadataDir).toBe(alternate.metadataDir);
    } finally {
      fs.rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  it("starts a new daemon when only a legacy unsuffixed receipt exists", async () => {
    const repoRoot = makeRepoRoot("agent-workbench-daemon-legacy-unsuffixed-receipt-");
    const identity = createDaemonIdentity(repoRoot);
    const paths = daemonPaths(identity);
    const legacyMetadataPath = path.join(
      paths.metadataDir,
      "daemon.json"
    );
    const legacyStartupLockPath = path.join(
      paths.metadataDir,
      "startup.lock"
    );
    const daemons: StartedAgentWorkbenchDaemon[] = [];
    let starts = 0;

    try {
      fs.mkdirSync(paths.metadataDir, { recursive: true });
      if (process.platform !== "win32") {
        fs.mkdirSync(paths.ipcDir, { recursive: true });
      }
      const startedAt = "2026-07-05T00:00:00.000Z";
      fs.writeFileSync(legacyMetadataPath, `${JSON.stringify({
        identity,
        pid: process.pid,
        socketPath: paths.socketPath,
        createdAt: startedAt
      })}\n`);
      fs.writeFileSync(legacyStartupLockPath, `${JSON.stringify({
        pid: process.pid,
        created_at: startedAt,
        token: "legacy-token"
      })}\n`);

      const socket = await connectOrStartDaemon({
        repoRoot,
        debugRepoRootOverride: false,
        startTimeoutMs: 2500,
        spawnDaemon: (spawnInput) => {
          starts += 1;
          void startAgentWorkbenchDaemon({
            launchToken: spawnInput.launchToken,
            repoRoot,
            idleGraceMs: 100,
            serverOptions: { startupRefreshDelayMs: 60_000 }
          }).then((daemon) => daemons.push(daemon));
          return fakeChildProcess();
        }
      });
      socket.destroy();

      expect(starts).toBe(1);
      expect(fs.existsSync(paths.metadataPath)).toBe(true);
      expect(fs.existsSync(legacyMetadataPath)).toBe(true);
      expect(fs.existsSync(legacyStartupLockPath)).toBe(true);
      expect(safeReadJson(paths.metadataPath)).toMatchObject({
        identity: {
          id: identity.id
        }
      });
    } finally {
      await closeDaemons(daemons);
      fs.rmSync(repoRoot, { recursive: true, force: true });
      fs.rmSync(paths.ipcDir, { recursive: true, force: true });
    }
  });

  it("re-elects startup when ready evidence disappears before socket connection", async () => {
    const repoRoot = makeRepoRoot("agent-workbench-daemon-ready-race-");
    const identity = createDaemonIdentity(repoRoot);
    const paths = daemonPaths(identity);
    const daemons: StartedAgentWorkbenchDaemon[] = [];
    let starts = 0;

    fs.mkdirSync(paths.metadataDir, { recursive: true });
    if (process.platform !== "win32") {
      fs.mkdirSync(paths.ipcDir, { recursive: true });
    }
    const startedAt = new Date().toISOString();
    fs.writeFileSync(paths.socketPath, "not-a-socket\n");
    fs.writeFileSync(paths.metadataPath, `${JSON.stringify({
      ...createDaemonMetadata({
        identity,
        pid: process.pid,
        socketPath: paths.socketPath,
        launchToken: "vanished-ready-launch",
        launchStartedAt: startedAt,
        createdAt: startedAt,
        updatedAt: startedAt,
        phase: "ready"
      }),
      launchLifecycle: {
        state: "ready",
        phase: "ready",
        launchToken: "vanished-ready-launch",
        startedAt,
        updatedAt: startedAt
      }
    })}\n`);

    const removeVanishedReady = setTimeout(() => {
      fs.rmSync(paths.metadataPath, { force: true });
      fs.rmSync(paths.socketPath, { force: true });
    }, 20);
    try {
      const socket = await connectOrStartDaemon({
        repoRoot,
        debugRepoRootOverride: false,
        startTimeoutMs: 2000,
        spawnDaemon: (spawnInput) => {
          starts += 1;
          void startAgentWorkbenchDaemon({
            launchToken: spawnInput.launchToken,
            repoRoot,
            idleGraceMs: 100,
            serverOptions: { startupRefreshDelayMs: 60_000 }
          }).then((daemon) => daemons.push(daemon));
          return fakeChildProcess();
        }
      });
      socket.destroy();
      expect(starts).toBe(1);
    } finally {
      clearTimeout(removeVanishedReady);
      await closeDaemons(daemons);
      fs.rmSync(repoRoot, { recursive: true, force: true });
      fs.rmSync(paths.ipcDir, { recursive: true, force: true });
    }
  });

  it("reclaims startup when the lock owner dies before publishing metadata", async () => {
    const repoRoot = makeRepoRoot("agent-workbench-daemon-lock-owner-dies-");
    const identity = createDaemonIdentity(repoRoot);
    const paths = daemonPaths(identity);
    const daemons: StartedAgentWorkbenchDaemon[] = [];
    const lockOwner = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], {
      stdio: "ignore"
    });
    let starts = 0;

    try {
      if (typeof lockOwner.pid !== "number") {
        throw new Error("Test lock owner did not expose a pid.");
      }
      fs.mkdirSync(paths.metadataDir, { recursive: true });
      if (process.platform !== "win32") {
        fs.mkdirSync(paths.ipcDir, { recursive: true });
      }
      fs.writeFileSync(paths.startupLockPath, `${JSON.stringify({
        pid: lockOwner.pid,
        created_at: new Date().toISOString(),
        token: "doomed-lock-owner"
      })}\n`);

      const connection = connectOrStartDaemon({
        repoRoot,
        debugRepoRootOverride: false,
        startTimeoutMs: 2000,
        spawnDaemon: (spawnInput) => {
          starts += 1;
          void startAgentWorkbenchDaemon({
            launchToken: spawnInput.launchToken,
            repoRoot,
            idleGraceMs: 100,
            serverOptions: { startupRefreshDelayMs: 60_000 }
          }).then((daemon) => daemons.push(daemon));
          return fakeChildProcess();
        }
      });
      await sleep(30);
      const lockOwnerExit = new Promise<void>((resolve) => {
        lockOwner.once("exit", () => resolve());
      });
      lockOwner.kill("SIGKILL");
      await lockOwnerExit;

      const socket = await connection;
      socket.destroy();
      expect(starts).toBe(1);
    } finally {
      if (lockOwner.exitCode === null && lockOwner.signalCode === null) {
        lockOwner.kill("SIGKILL");
      }
      await closeDaemons(daemons);
      fs.rmSync(repoRoot, { recursive: true, force: true });
      fs.rmSync(paths.ipcDir, { recursive: true, force: true });
    }
  });

  it("allows a timed-out contender to be followed by a successful later contender", async () => {
    const repoRoot = makeRepoRoot("agent-workbench-daemon-startup-timeout-recovery-");
    const identity = createDaemonIdentity(repoRoot);
    const paths = daemonPaths(identity);
    const daemons: StartedAgentWorkbenchDaemon[] = [];
    let releaseStart: (() => void) | undefined;
    const startGate = new Promise<void>((resolve) => { releaseStart = resolve; });
    let starts = 0;
    let launchChild: ChildProcess | undefined;

    try {
      const first = connectOrStartDaemon({
        repoRoot,
        debugRepoRootOverride: false,
        startTimeoutMs: 120,
        spawnDaemon: (spawnInput) => {
          starts += 1;
          void startGate.then(async () => {
            const daemon = await startAgentWorkbenchDaemon({
              launchToken: spawnInput.launchToken,
              repoRoot,
              idleGraceMs: 100,
              serverOptions: { startupRefreshDelayMs: 60_000 }
            });
            daemons.push(daemon);
          });
          launchChild = fakeChildProcess();
          return launchChild;
        }
      });
      const firstTimeout = expect(first).rejects.toThrow(
        /Timed out connecting to Agent Workbench daemon/
      );

      await sleep(25);
      let starting: unknown | undefined;
      for (let attempt = 0; attempt < 25 && starting === undefined; attempt += 1) {
        if (fs.existsSync(paths.metadataPath)) {
          starting = safeReadJson(paths.metadataPath);
          if (
            typeof starting === "object" &&
            starting !== null &&
            (starting as { launchLifecycle?: { state?: string } }).launchLifecycle?.state === "starting"
          ) {
            break;
          }
        }
        await sleep(20);
      }
      expect(starting).toBeDefined();

      const second = connectOrStartDaemon({
        repoRoot,
        debugRepoRootOverride: false,
        startTimeoutMs: 1500,
        spawnDaemon: (spawnInput) => {
          starts += 1;
          return fakeChildProcess();
        }
      });

      await firstTimeout;
      releaseStart?.();

      const secondSocket = await second;
      secondSocket.destroy();

      expect(starts).toBe(1);
      await closeDaemons(daemons);
      launchChild?.emit("exit", 0, null);
      await sleep(20);
      expect(fs.existsSync(paths.startupLockPath)).toBe(false);
      expect(fs.existsSync(paths.metadataPath)).toBe(false);
    } finally {
      releaseStart?.();
      await closeDaemons(daemons);
      fs.rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  it("accepts sockets during delayed bootstrap and defers clients until ready", async () => {
    const repoRoot = makeRepoRoot("agent-workbench-daemon-startup-timeout-recovery-");
    const identity = createDaemonIdentity(repoRoot);
    const paths = daemonPaths(identity);
    const daemons: StartedAgentWorkbenchDaemon[] = [];
    const releaseStart = controlledDeferred<void>();
    let starts = 0;
    let launchChild: ChildProcess | undefined;
    const sessionCalls: Error[] = [];

    try {
      const first = connectOrStartDaemon({
        repoRoot,
        debugRepoRootOverride: false,
        startTimeoutMs: 1000,
        spawnDaemon: (spawnInput) => {
          starts += 1;
          void startAgentWorkbenchDaemon({
            launchToken: spawnInput.launchToken,
            repoRoot,
            idleGraceMs: 100,
            serverOptions: { startupRefreshDelayMs: 60_000 },
            testHooks: {
              awaitBootstrap: releaseStart.promise
            }
          }).then((daemon) => daemons.push(daemon)).catch((error) => {
            sessionCalls.push(error instanceof Error ? error : new Error(String(error)));
          });
          launchChild = fakeChildProcess();
          return launchChild;
        }
      });
      const second = connectOrStartDaemon({
        repoRoot,
        debugRepoRootOverride: false,
        startTimeoutMs: 1000,
        spawnDaemon: (spawnInput) => {
          starts += 1;
          return fakeChildProcess();
        }
      });

      const starting = await (async () => {
        let metadata: unknown | undefined;
        for (let attempt = 0; attempt < 60 && metadata === undefined; attempt += 1) {
          if (!fs.existsSync(paths.metadataPath)) {
            await sleep(20);
            continue;
          }
          metadata = safeReadJson(paths.metadataPath);
          if (
            typeof metadata === "object" && metadata !== null &&
            (metadata as { launchLifecycle?: { state?: string } }).launchLifecycle?.state === "starting"
          ) {
            break;
          }
          await sleep(20);
          metadata = undefined;
        }
        return metadata;
      })();

      expect(starting).toBeDefined();
      expect(starts).toBe(1);

      const rawSocket = await connectSocketEventually(paths.socketPath);
      rawSocket.write(`${JSON.stringify({
        protocol: "agent-workbench-daemon",
        protocolVersion: DAEMON_PROTOCOL_VERSION,
        identity
      })}\n`);
      const session = createSocketSession(rawSocket);
      const initializeResult = session.call({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-06-18",
          capabilities: {},
          clientInfo: { name: "agent-workbench-test", version: "0.1.0" }
        }
      });
      let initializeSettled = false;
      void initializeResult.then(() => {
        initializeSettled = true;
      });
      await expect(Promise.race([
        Promise.all([first, second]).then(() => true),
        sleep(220).then(() => false)
      ])).resolves.toBe(false);
      expect(initializeSettled).toBe(false);

      releaseStart.resolve(undefined);

      const [firstSocket, secondSocket] = await Promise.all([first, second]);
      const response = await initializeResult;
      expect(response).toMatchObject({ id: 1, jsonrpc: "2.0", result: { protocolVersion: "2025-06-18" } });
      rawSocket.destroy();
      firstSocket.destroy();
      secondSocket.destroy();

      expect(starts).toBe(1);
      expect(sessionCalls).toEqual([]);
    } finally {
      releaseStart.resolve(undefined);
      await closeDaemons(daemons);
      launchChild?.emit("exit", 0, null);
      fs.rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  it("keeps the caller startup deadline while bootstrap is stalled after listen", async () => {
    const repoRoot = makeRepoRoot("agent-workbench-daemon-post-listen-timeout-");
    const paths = daemonPaths(createDaemonIdentity(repoRoot));
    const bootstrapGate = controlledDeferred<void>();
    let daemonStart: Promise<StartedAgentWorkbenchDaemon> | undefined;

    try {
      const connection = connectOrStartDaemon({
        repoRoot,
        debugRepoRootOverride: false,
        startTimeoutMs: 300,
        spawnDaemon: (spawnInput) => {
          daemonStart = startAgentWorkbenchDaemon({
            launchToken: spawnInput.launchToken,
            repoRoot,
            idleGraceMs: 100,
            serverOptions: { startupRefreshDelayMs: 60_000 },
            testHooks: {
              awaitBootstrap: bootstrapGate.promise
            }
          });
          void daemonStart.catch(() => undefined);
          return fakeChildProcess();
        }
      });

      await expect(connection).rejects.toThrow(/Timed out connecting to Agent Workbench daemon/);
      expect(fs.existsSync(paths.socketPath)).toBe(process.platform !== "win32");
      expect(safeReadJson(paths.metadataPath)).toMatchObject({
        launchLifecycle: { state: "starting", phase: "launching" }
      });

      bootstrapGate.reject(new Error("release stalled bootstrap"));
      await expect(daemonStart).rejects.toThrow("release stalled bootstrap");
      expect(fs.existsSync(paths.socketPath)).toBe(false);
    } finally {
      bootstrapGate.reject(new Error("test cleanup"));
      await daemonStart?.catch(() => undefined);
      fs.rmSync(repoRoot, { recursive: true, force: true });
      fs.rmSync(paths.ipcDir, { recursive: true, force: true });
    }
  });

  it("closes queued sockets and writes bootstrap failure evidence", async () => {
    const repoRoot = makeRepoRoot("agent-workbench-daemon-bootstrap-failure-");
    const identity = createDaemonIdentity(repoRoot);
    const paths = daemonPaths(identity);
    const daemons: StartedAgentWorkbenchDaemon[] = [];
    const startFailures: Error[] = [];
    let bootstrapFailure: ((error: Error) => void) | undefined;
    const bootstrapGate = new Promise<void>((_resolve, reject) => {
      bootstrapFailure = (error: Error) => reject(error);
    });
    let starts = 0;

    try {
      const connection = connectOrStartDaemon({
        repoRoot,
        debugRepoRootOverride: false,
        startTimeoutMs: 2000,
        spawnDaemon: (spawnInput) => {
          starts += 1;
          void startAgentWorkbenchDaemon({
            launchToken: spawnInput.launchToken,
            repoRoot,
            idleGraceMs: 100,
            serverOptions: { startupRefreshDelayMs: 60_000 },
            testHooks: {
              awaitBootstrap: bootstrapGate
            }
          }).then((daemon) => daemons.push(daemon)).catch((error) => {
            startFailures.push(error instanceof Error ? error : new Error(String(error)));
          });
          return fakeChildProcess();
        }
      });

      let starting: unknown | undefined;
      for (let attempt = 0; attempt < 60 && starting === undefined; attempt += 1) {
        if (!fs.existsSync(paths.metadataPath)) {
          await sleep(20);
          continue;
        }
        starting = safeReadJson(paths.metadataPath);
        if (
          typeof starting === "object" &&
          starting !== null &&
          (starting as { launchLifecycle?: { state?: string } }).launchLifecycle?.state === "starting"
        ) {
          break;
        }
        starting = undefined;
        await sleep(20);
      }
      expect(starting).toBeDefined();

      const rawSocket = await connectSocketEventually(paths.socketPath);
      const closed = new Promise<void>((resolve) => rawSocket.once("close", resolve));
      bootstrapFailure?.(new Error("bootstrap failed"));
      await expect(connection).rejects.toThrow("bootstrap_failed");
      await closed;

      const metadata = safeReadJson(paths.metadataPath) as {
        launchLifecycle?: { state?: string; phase?: string; failureCode?: string };
      };
      expect(metadata).toMatchObject({
        launchLifecycle: {
          state: "failed",
          phase: "terminal",
          failureCode: "bootstrap_failed"
        }
      });
      expect(fs.existsSync(paths.socketPath)).toBe(false);
      expect(starts).toBe(1);
      expect(fs.existsSync(path.join(repoRoot, ".cache", "agent-workbench", "refresh-owner.json"))).toBe(false);
      expect(startFailures).toHaveLength(1);
    } finally {
      await closeDaemons(daemons);
      fs.rmSync(repoRoot, { recursive: true, force: true });
      fs.rmSync(paths.ipcDir, { recursive: true, force: true });
    }
  });

  it("maps native-module launch failures to a bounded actionable rebuild hint for owners and metadata waiters", async () => {
    const repoRoot = makeRepoRoot("agent-workbench-daemon-native-module-hint-");
    const paths = daemonPaths(createDaemonIdentity(repoRoot));
    const childStderr = new PassThrough();
    const leakSentinel = `raw-native-loader-noise-${"x".repeat(3_000)}`;
    const nativeStderr = `${leakSentinel} ERR_DLOPEN: Module did not self-register.`;
    let metadataWaiterSpawned = false;
    let ownerError: Error | undefined;

    try {
      try {
        await connectOrStartDaemon({
          repoRoot,
          debugRepoRootOverride: false,
          startTimeoutMs: 1500,
          spawnDaemon: () => fakeChildProcess((child) => {
            setTimeout(() => {
              child.emit("exit", 1, null);
              setImmediate(() => childStderr.end(nativeStderr));
            }, 5);
          }, { stderr: childStderr })
        });
        throw new Error("expected launch to fail");
      } catch (error) {
        ownerError = error instanceof Error ? error : new Error(String(error));
      }

      expect(ownerError).toBeDefined();
      const ownerMessage = ownerError!.message;
      expect(ownerMessage).toContain("pnpm rebuild:native");
      expect(ownerMessage).not.toContain(leakSentinel);
      expect(ownerMessage.length).toBeLessThan(260);
      expect(childStderr.destroyed).toBe(true);

      const metadata = safeReadJson(paths.metadataPath) as {
        launchLifecycle?: {
          failureCode?: string;
          state?: string;
          phase?: string;
          native_module_rebuild_required?: true;
        };
      };
      expect(metadata).toMatchObject({
        launchLifecycle: {
          state: "failed",
          phase: "terminal",
          failureCode: "child_exit",
          native_module_rebuild_required: true
        }
      });

      await expect(connectOrStartDaemon({
        repoRoot,
        debugRepoRootOverride: false,
        startTimeoutMs: 500,
        spawnDaemon: (spawnInput) => {
          metadataWaiterSpawned = true;
          return fakeChildProcess();
        }
      })).rejects.toThrow(ownerMessage);
      expect(metadataWaiterSpawned).toBe(false);
    } finally {
      childStderr.destroy();
      fs.rmSync(repoRoot, { recursive: true, force: true });
      fs.rmSync(paths.ipcDir, { recursive: true, force: true });
    }
  });

  it("preserves the native-module rebuild hint through a real child stderr and exit sequence", async () => {
    const repoRoot = makeRepoRoot("agent-workbench-daemon-native-module-real-child-");
    const paths = daemonPaths(createDaemonIdentity(repoRoot));
    let spawnCount = 0;

    try {
      const spawnDaemon = () => {
        spawnCount += 1;
        return spawn(process.execPath, [
          "--input-type=module",
          "--eval",
          [
            "import fs from 'node:fs';",
            "setTimeout(() => {",
            "  fs.writeSync(2, 'agent-workbench: daemon failed: ERR_DLOPEN: Module did not self-register.\\n');",
            "  process.exitCode = 1;",
            "}, 75);"
          ].join("")
        ], {
          stdio: ["ignore", "ignore", "pipe"]
        });
      };

      const owner = connectOrStartDaemon({
        repoRoot,
        debugRepoRootOverride: false,
        startTimeoutMs: 1500,
        spawnDaemon
      });
      await new Promise((resolve) => setTimeout(resolve, 25));
      const waiter = connectOrStartDaemon({
        repoRoot,
        debugRepoRootOverride: false,
        startTimeoutMs: 1500,
        spawnDaemon
      });
      const [ownerResult, waiterResult] = await Promise.allSettled([owner, waiter]);

      expect(spawnCount).toBe(1);
      expect(ownerResult.status).toBe("rejected");
      expect(waiterResult.status).toBe("rejected");
      expect(ownerResult.status === "rejected" ? ownerResult.reason.message : "").toMatch(/pnpm rebuild:native/);
      expect(waiterResult.status === "rejected" ? waiterResult.reason.message : "").toBe(
        ownerResult.status === "rejected" ? ownerResult.reason.message : ""
      );

      const metadata = safeReadJson(paths.metadataPath) as {
        launchLifecycle?: {
          failureCode?: string;
          state?: string;
          phase?: string;
          native_module_rebuild_required?: true;
        };
      };
      expect(metadata).toMatchObject({
        launchLifecycle: {
          state: "failed",
          phase: "terminal",
          failureCode: "child_exit",
          native_module_rebuild_required: true
        }
      });
    } finally {
      fs.rmSync(repoRoot, { recursive: true, force: true });
      fs.rmSync(paths.ipcDir, { recursive: true, force: true });
    }
  });

  it("maps native load failure from the real detached daemon entrypoint", async () => {
    const repoRoot = makeRepoRoot("agent-workbench-daemon-real-native-module-hint-");
    const paths = daemonPaths(createDaemonIdentity(repoRoot));
    const loaderPath = path.resolve("tests/fixtures/native-module-load-failure-loader.mjs");

    try {
      await expect(connectOrStartDaemon({
        repoRoot,
        debugRepoRootOverride: false,
        startTimeoutMs: 10_000,
        env: {
          ...process.env,
          NODE_OPTIONS: `--experimental-loader=${loaderPath}`
        }
      })).rejects.toThrow("pnpm rebuild:native");

      expect(safeReadJson(paths.metadataPath)).toMatchObject({
        launchLifecycle: {
          state: "failed",
          phase: "terminal",
          failureCode: "child_exit",
          native_module_rebuild_required: true
        }
      });
    } finally {
      fs.rmSync(repoRoot, { recursive: true, force: true });
      fs.rmSync(paths.ipcDir, { recursive: true, force: true });
    }
  }, 20_000);

  it("destroys startup stderr capture when launch completes", async () => {
    const repoRoot = makeRepoRoot("agent-workbench-daemon-native-hint-cleanup-ready-");
    const daemons: StartedAgentWorkbenchDaemon[] = [];
    const childStderr = new PassThrough();
    let launchChild: ChildProcess | undefined;

    try {
      const socket = await connectOrStartDaemon({
        repoRoot,
        debugRepoRootOverride: false,
        startTimeoutMs: 5000,
        spawnDaemon: (spawnInput) => {
          const child = fakeChildProcess(() => {
            // no-op startup process.
          }, { stderr: childStderr });
          launchChild = child;
          void startAgentWorkbenchDaemon({
            launchToken: spawnInput.launchToken,
            repoRoot,
            idleGraceMs: 100,
            serverOptions: { startupRefreshDelayMs: 60_000 }
          }).then((daemon) => daemons.push(daemon));
          return child;
        }
      });

      socket.destroy();
      expect(launchChild).toBeDefined();
      expect(childStderr.destroyed).toBe(true);
    } finally {
      launchChild?.emit("exit", 0, null);
      await closeDaemons(daemons);
      childStderr.destroy();
      fs.rmSync(repoRoot, { recursive: true, force: true });
      fs.rmSync(daemonPaths(createDaemonIdentity(repoRoot)).ipcDir, { recursive: true, force: true });
    }
  });

  it("records immediate child exit as terminal failure evidence", async () => {
    const repoRoot = makeRepoRoot("agent-workbench-daemon-child-exit-");
    const paths = daemonPaths(createDaemonIdentity(repoRoot));

    try {
      await expect(connectOrStartDaemon({
        repoRoot,
        debugRepoRootOverride: false,
        startTimeoutMs: 1500,
        spawnDaemon: () => fakeChildProcess((child) => {
          setTimeout(() => {
            child.emit("exit", 1, null);
          }, 5);
        })
      })).rejects.toThrow("daemon-child-exit-code-1");

      const metadata = safeReadJson(paths.metadataPath) as {
        launchLifecycle?: { state?: string; phase?: string; failureCode?: string; native_module_rebuild_required?: true };
      };
      expect(metadata).toMatchObject({
        launchLifecycle: {
          state: "failed",
          phase: "terminal",
          failureCode: "child_exit"
        }
      });
      expect(metadata.launchLifecycle?.native_module_rebuild_required).toBeUndefined();
    } finally {
      fs.rmSync(repoRoot, { recursive: true, force: true });
      fs.rmSync(paths.ipcDir, { recursive: true, force: true });
    }
  });

  it("starts as an observer while another runtime owns refresh without displacing it", async () => {
    const repoRoot = makeRepoRoot("agent-workbench-daemon-observer-owner-");
    const databasePath = graphStorePath(repoRoot);
    const seededStore = openGraphStore(databasePath);
    await seededStore.upsertSnapshot({
      snapshot: {
        id: "901",
        repo_root: repoRoot,
        workspace_root: repoRoot,
        repo_identity: repoRoot,
        config_identity: "default",
        schema_version: SCHEMA_VERSION,
        freshness: "fresh",
        owner_state: "owner",
        created_at: "2026-11-08T00:00:00.000Z",
        updated_at: "2026-11-08T00:00:00.000Z"
      }
    });
    seededStore.close();
    const ownership = new FileRepositoryOwnershipAdapter(
      path.join(repoRoot, ".cache", "agent-workbench", "refresh-owner.json")
    );
    const external = await ownership.acquire({
      repo_root: repoRoot,
      runtime_identity: "legacy-runtime:3",
      schema_version: 3,
      owner_id: "legacy-daemon",
      owner_pid: process.pid,
      owner_generation: 41,
      heartbeat_at: "2026-07-30T09:00:00.000Z"
    });
    expect(external.outcome).toBe("acquired");
    if (external.outcome !== "acquired") {
      throw new Error("Expected external refresh ownership.");
    }
    const daemon = await startAgentWorkbenchDaemon({
      repoRoot,
      idleGraceMs: 3000,
      serverOptions: { startupRefreshDelayMs: 0 }
    });
    let socket: net.Socket | undefined;

    try {
      expect(daemon.metadata.launchLifecycle?.state).toBe("ready");
      expect(fs.existsSync(databasePath)).toBe(true);
      socket = await connectOrStartDaemon({
        repoRoot,
        debugRepoRootOverride: false,
        startTimeoutMs: 2000
      });
      const session = createSocketSession(socket);
      await initializeSocketSession(session, 1, "observer-owner-test");

      const graphQuery = await session.call({
        jsonrpc: "2.0",
        id: 3,
        method: "tools/call",
        params: {
          name: "symbol_search",
          arguments: { query: "not-indexed", repo_root: repoRoot, max_results: 1 }
        }
      });
      expect(graphQuery.error).toBeUndefined();
      const graphEnvelope = JSON.parse(graphQuery.result.content[0].text) as {
        data: { snapshot_id: string };
      };
      expect(graphEnvelope.data.snapshot_id).toBe("901");

      await sleep(25);
      const health = await session.call({
        jsonrpc: "2.0",
        id: 2,
        method: "resources/read",
        params: { uri: "integration:///health/agent-workbench" }
      });
      const healthEnvelope = JSON.parse(health.result.contents[0].text) as {
        data: {
          daemon?: {
            warmup_state?: string;
            activity_lease_held?: boolean;
          };
        };
      };
      expect(healthEnvelope.data.daemon).toMatchObject({
        warmup_state: "idle",
        activity_lease_held: false
      });
      expect(safeReadJson(
        path.join(repoRoot, ".cache", "agent-workbench", "refresh-owner.json")
      )).toMatchObject({
        owner_id: "legacy-daemon",
        runtime_identity: "legacy-runtime:3"
      });

    } finally {
      socket?.destroy();
      await daemon.close();
      await ownership.release({ lease: external.lease });
      fs.rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  it.each([
    {
      name: "an older schema marker",
      damage(store: ReturnType<typeof openGraphStore>) {
        store.db.prepare("DELETE FROM schema_migrations").run();
        store.db.prepare("INSERT INTO schema_migrations (version) VALUES (?)").run(3);
      }
    },
    {
      name: "a missing required v4 table",
      damage(store: ReturnType<typeof openGraphStore>) {
        store.db.exec("DROP TABLE graph_build_validation_receipts");
      }
    }
  ])("does not repair $name when an external owner is active and an MCP graph query is attempted", async ({ damage }) => {
    const repoRoot = makeRepoRoot("agent-workbench-daemon-observer-incompatible-");
    const databasePath = graphStorePath(repoRoot);
    const store = openGraphStore(databasePath);
    damage(store);
    store.close();
    const before = fs.readFileSync(databasePath);
    const ownership = new FileRepositoryOwnershipAdapter(
      path.join(repoRoot, ".cache", "agent-workbench", "refresh-owner.json")
    );
    const external = await ownership.acquire({
      repo_root: repoRoot,
      runtime_identity: "external-runtime:4",
      schema_version: SCHEMA_VERSION,
      owner_id: "external-daemon",
      owner_pid: process.pid,
      owner_generation: 41,
      heartbeat_at: "2026-11-08T00:00:00.000Z"
    });
    expect(external.outcome).toBe("acquired");
    if (external.outcome !== "acquired") throw new Error("Expected external refresh ownership.");
    const daemon = await startAgentWorkbenchDaemon({
      repoRoot,
      idleGraceMs: 3000,
      serverOptions: { startupRefreshDelayMs: 60_000 }
    });
    let socket: net.Socket | undefined;

    try {
      socket = await connectOrStartDaemon({ repoRoot, debugRepoRootOverride: false, startTimeoutMs: 2000 });
      const session = createSocketSession(socket);
      await initializeSocketSession(session, 31, "observer-incompatible-test");
      const response = await session.call({
        jsonrpc: "2.0",
        id: 32,
        method: "tools/call",
        params: { name: "symbol_search", arguments: { query: "anything", repo_root: repoRoot } }
      });
      expect(response.error).toBeUndefined();
      const envelope = JSON.parse(response.result.content[0].text) as {
        errors?: Array<{ code: string }>;
      };
      expect(envelope.errors?.[0]?.code).toBe("environment_unavailable");
      expect(fs.readFileSync(databasePath)).toEqual(before);
    } finally {
      socket?.destroy();
      await daemon.close();
      await ownership.release({ lease: external.lease });
      fs.rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  it("keeps an active-owner watcher admission blocked, then promotes and indexes a later file after release", async () => {
    const repoRoot = makeRepoRoot("agent-workbench-daemon-observer-promotion-");
    const databasePath = graphStorePath(repoRoot);
    const store = openGraphStore(databasePath);
    await store.upsertSnapshot({
      snapshot: {
        id: "902",
        repo_root: repoRoot,
        workspace_root: repoRoot,
        repo_identity: repoRoot,
        config_identity: "default",
        schema_version: SCHEMA_VERSION,
        freshness: "fresh",
        owner_state: "owner",
        created_at: "2026-11-08T00:00:00.000Z",
        updated_at: "2026-11-08T00:00:00.000Z"
      }
    });
    store.close();
    const ownership = new FileRepositoryOwnershipAdapter(
      path.join(repoRoot, ".cache", "agent-workbench", "refresh-owner.json")
    );
    const external = await ownership.acquire({
      repo_root: repoRoot,
      runtime_identity: "external-runtime:4",
      schema_version: SCHEMA_VERSION,
      owner_id: "external-daemon",
      owner_pid: process.pid,
      owner_generation: 41,
      heartbeat_at: "2026-11-08T00:00:00.000Z"
    });
    expect(external.outcome).toBe("acquired");
    if (external.outcome !== "acquired") throw new Error("Expected external refresh ownership.");
    const daemon = await startAgentWorkbenchDaemon({
      repoRoot,
      idleGraceMs: 3000,
      serverOptions: { startupRefreshDelayMs: 60_000 }
    });
    let released = false;
    let socket: net.Socket | undefined;

    try {
      socket = await connectOrStartDaemon({ repoRoot, debugRepoRootOverride: false, startTimeoutMs: 2000 });
      const session = createSocketSession(socket);
      await initializeSocketSession(session, 41, "observer-promotion-test");
      // Establish the watcher while the foreign owner is still active.
      await session.call({
        jsonrpc: "2.0",
        id: 42,
        method: "resources/read",
        params: { uri: "repo:///status" }
      });
      fs.writeFileSync(path.join(repoRoot, "blocked-while-owned.py"), "def blocked_while_owned():\n    return 1\n");
      await sleep(100);
      await session.call({
        jsonrpc: "2.0",
        id: 43,
        method: "resources/read",
        params: { uri: "repo:///status" }
      });
      expect(safeReadJson(path.join(repoRoot, ".cache", "agent-workbench", "refresh-owner.json"))).toMatchObject({
        owner_id: "external-daemon"
      });

      await ownership.release({ lease: external.lease });
      released = true;
      // A later included-file event is a new admission, not a retry of the
      // earlier foreign-owner refusal.
      fs.writeFileSync(path.join(repoRoot, "promoted-after-release.py"), "def promoted_after_release():\n    return 2\n");
      await sleep(100);
      const status = await session.call({
        jsonrpc: "2.0",
        id: 44,
        method: "resources/read",
        params: { uri: "repo:///status" }
      });
      expect(status.error).toBeUndefined();
      await vi.waitFor(() => {
        expect(safeReadJson(path.join(repoRoot, ".cache", "agent-workbench", "refresh-owner.json"))).toMatchObject({
          owner_id: expect.stringMatching(/^daemon:/)
        });
      });
      await vi.waitFor(async () => {
        const query = await session.call({
          jsonrpc: "2.0",
          id: 45,
          method: "tools/call",
          params: {
            name: "symbol_search",
            arguments: { query: "promoted_after_release", repo_root: repoRoot, exact: true, max_results: 5 }
          }
        });
        const envelope = JSON.parse(query.result.content[0].text) as {
          data: { symbols: Array<{ name: string }> };
          meta: { freshness?: string };
        };
        expect(envelope.meta.freshness).toBe("fresh");
        expect(envelope.data.symbols).toEqual(expect.arrayContaining([
          expect.objectContaining({ name: "promoted_after_release" })
        ]));
      }, { timeout: 20_000, interval: 100 });
    } finally {
      socket?.destroy();
      await daemon.close();
      if (!released) await ownership.release({ lease: external.lease });
      fs.rmSync(repoRoot, { recursive: true, force: true });
    }
  }, 30_000);

  it("continues a stale-first-read MCP status request after observer promotion", async () => {
    const repoRoot = makeRepoRoot("agent-workbench-daemon-observer-stale-request-");
    const databasePath = graphStorePath(repoRoot);
    const store = openGraphStore(databasePath);
    await store.upsertSnapshot({
      snapshot: {
        id: "903", repo_root: repoRoot, workspace_root: repoRoot, repo_identity: repoRoot,
        config_identity: "default", schema_version: SCHEMA_VERSION, freshness: "fresh", owner_state: "owner",
        created_at: "2026-11-08T00:00:00.000Z", updated_at: "2026-11-08T00:00:00.000Z"
      }
    });
    store.db.prepare(`
      INSERT INTO files (snapshot_id, path, language, content_hash, size_bytes, mtime_ms)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(903, "missing-for-stale-first-read.py", "python", "missing", 1, 1);
    store.close();
    const ownership = new FileRepositoryOwnershipAdapter(
      path.join(repoRoot, ".cache", "agent-workbench", "refresh-owner.json")
    );
    const external = await ownership.acquire({
      repo_root: repoRoot, runtime_identity: "external-runtime:4", schema_version: SCHEMA_VERSION,
      owner_id: "external-daemon", owner_pid: process.pid, owner_generation: 41,
      heartbeat_at: "2026-11-08T00:00:00.000Z"
    });
    expect(external.outcome).toBe("acquired");
    if (external.outcome !== "acquired") throw new Error("Expected external refresh ownership.");
    const daemon = await startAgentWorkbenchDaemon({
      repoRoot, idleGraceMs: 3000, serverOptions: { startupRefreshDelayMs: 60_000 }
    });
    let released = false;
    let socket: net.Socket | undefined;

    try {
      await ownership.release({ lease: external.lease });
      released = true;
      socket = await connectOrStartDaemon({ repoRoot, debugRepoRootOverride: false, startTimeoutMs: 2000 });
      const session = createSocketSession(socket);
      await initializeSocketSession(session, 51, "observer-stale-request-test");
      const status = await session.call({
        jsonrpc: "2.0", id: 52, method: "resources/read", params: { uri: "repo:///status" }
      });
      expect(status.error).toBeUndefined();
      const envelope = JSON.parse(status.result.contents[0].text) as { data: { snapshot_id?: string } };
      // selectValidatedSnapshot read the old published snapshot, then
      // staleFirstRead promoted; getRepoStatus continued using the facade.
      expect(envelope.data.snapshot_id).toBe("903");
      expect(safeReadJson(path.join(repoRoot, ".cache", "agent-workbench", "refresh-owner.json"))).toMatchObject({
        owner_id: expect.stringMatching(/^daemon:/)
      });
    } finally {
      socket?.destroy();
      await daemon.close();
      if (!released) await ownership.release({ lease: external.lease });
      fs.rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  it("blocks ambiguous ownership before opening a graph store", async () => {
    const repoRoot = makeRepoRoot("agent-workbench-daemon-observer-ambiguous-");
    const databasePath = graphStorePath(repoRoot);
    const store = openGraphStore(databasePath);
    store.close();
    const before = fs.readFileSync(databasePath);
    fs.writeFileSync(
      path.join(repoRoot, ".cache", "agent-workbench", "refresh-owner.json"),
      "not a repository ownership lease\n"
    );

    try {
      await expect(startAgentWorkbenchDaemon({
        repoRoot,
        idleGraceMs: 3000,
        serverOptions: { startupRefreshDelayMs: 60_000 }
      })).rejects.toThrow("ownership is ambiguous");
      expect(fs.readFileSync(databasePath)).toEqual(before);
    } finally {
      fs.rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  it("blocks a concurrent same-process direct start with a different launch token", async () => {
    const repoRoot = makeRepoRoot("agent-workbench-daemon-direct-starting-");
    const bootstrapGate = controlledDeferred<void>();
    const firstStart = startAgentWorkbenchDaemon({
      repoRoot,
      launchToken: "first-direct-launch",
      idleGraceMs: 3000,
      serverOptions: { startupRefreshDelayMs: 60_000 },
      testHooks: { awaitBootstrap: bootstrapGate.promise }
    });
    const paths = daemonPaths(createDaemonIdentity(repoRoot));
    const firstSocket = await connectSocketEventually(paths.socketPath);
    firstSocket.destroy();

    try {
      await expect(startAgentWorkbenchDaemon({
        repoRoot,
        launchToken: "second-direct-launch",
        idleGraceMs: 3000,
        serverOptions: { startupRefreshDelayMs: 60_000 }
      })).rejects.toThrow("blocked: starting");
      expect(fs.existsSync(paths.socketPath)).toBe(process.platform !== "win32");
    } finally {
      bootstrapGate.resolve(undefined);
      const first = await firstStart;
      await first.close();
      fs.rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  it("does not unlink a healthy daemon socket when a second direct start loses identity admission", async () => {
    const repoRoot = makeRepoRoot("agent-workbench-daemon-second-start-");
    const first = await startAgentWorkbenchDaemon({
      repoRoot,
      idleGraceMs: 3000,
      serverOptions: { startupRefreshDelayMs: 60_000 }
    });
    try {
      await expect(startAgentWorkbenchDaemon({
        repoRoot,
        idleGraceMs: 3000,
        serverOptions: { startupRefreshDelayMs: 60_000 }
      })).rejects.toThrow("already running for this runtime identity");
      expect(fs.existsSync(first.metadata.socketPath)).toBe(process.platform !== "win32");
      const socket = net.createConnection(first.metadata.socketPath);
      await new Promise<void>((resolve, reject) => {
        socket.once("connect", resolve);
        socket.once("error", reject);
      });
      socket.destroy();
    } finally {
      await first.close();
      fs.rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  it("does not delete a replacement launch receipt during old-daemon shutdown", async () => {
    const repoRoot = makeRepoRoot("agent-workbench-daemon-shutdown-replacement-");
    const identity = createDaemonIdentity(repoRoot);
    const paths = daemonPaths(identity);
    const daemon = await startAgentWorkbenchDaemon({
      repoRoot,
      idleGraceMs: 3000,
      serverOptions: { startupRefreshDelayMs: 60_000 }
    });
    const replacementStartedAt = new Date().toISOString();
    const replacement = createDaemonMetadata({
      identity,
      pid: process.pid,
      socketPath: paths.socketPath,
      launchToken: "replacement-launch-token",
      launchStartedAt: replacementStartedAt,
      createdAt: replacementStartedAt,
      updatedAt: replacementStartedAt,
      phase: "launching"
    });

    try {
      fs.writeFileSync(paths.metadataPath, `${JSON.stringify(replacement)}\n`);
      await daemon.close();
      expect(safeReadJson(paths.metadataPath)).toMatchObject({
        launchLifecycle: {
          launchToken: "replacement-launch-token",
          state: "starting"
        }
      });
    } finally {
      await daemon.close();
      fs.rmSync(repoRoot, { recursive: true, force: true });
      fs.rmSync(paths.ipcDir, { recursive: true, force: true });
    }
  });

  it("unwinds ownership, store, and canonical socket when daemon startup fails after listen", async () => {
    const repoRoot = makeRepoRoot("agent-workbench-daemon-start-failure-");
    const identity = createDaemonIdentity(repoRoot);
    const paths = daemonPaths(identity);
    fs.mkdirSync(paths.metadataPath, { recursive: true });
    try {
      await expect(startAgentWorkbenchDaemon({
        repoRoot,
        idleGraceMs: 3000,
        serverOptions: { startupRefreshDelayMs: 60_000 }
      })).rejects.toThrow();
      expect(fs.existsSync(path.join(repoRoot, ".cache", "agent-workbench", "refresh-owner.json"))).toBe(false);
      expect(fs.existsSync(paths.socketPath)).toBe(false);
    } finally {
      fs.rmSync(repoRoot, { recursive: true, force: true });
      fs.rmSync(paths.ipcDir, { recursive: true, force: true });
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
        spawnDaemon: (spawnInput) => {
          starts += 1;
          void daemonStartGate
            .then(() => startAgentWorkbenchDaemon({
              launchToken: spawnInput.launchToken,
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
        spawnDaemon: (spawnInput) => {
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
          spawnDaemon: (spawnInput) => {
            starts += 1;
            void startAgentWorkbenchDaemon({
              launchToken: spawnInput.launchToken,
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
        spawnDaemon: (spawnInput) => {
          void startAgentWorkbenchDaemon({
            launchToken: spawnInput.launchToken,
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
        spawnDaemon: (spawnInput) => {
          starts += 1;
          void startAgentWorkbenchDaemon({
            launchToken: spawnInput.launchToken,
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

  it("blocks live mismatched daemon identity without deleting its canonical socket", async () => {
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
      await expect(connectOrStartDaemon({
        repoRoot,
        debugRepoRootOverride: false,
        startTimeoutMs: 2000,
        spawnDaemon: (spawnInput) => {
          starts += 1;
          void startAgentWorkbenchDaemon({
            launchToken: spawnInput.launchToken,
            repoRoot,
            idleGraceMs: 100,
            serverOptions: { startupRefreshDelayMs: 60_000 }
          }).then((daemon) => daemons.push(daemon));
          return fakeChildProcess();
        }
      })).rejects.toThrow("blocked: ambiguous_process");

      expect(starts).toBe(0);
      expect(fs.existsSync(paths.socketPath)).toBe(process.platform !== "win32");
    } finally {
      await closeDaemons(daemons);
      fs.rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  it("gracefully replaces a live same-base legacy daemon only after verified health proof", async () => {
    const repoRoot = makeRepoRoot("agent-workbench-daemon-build-fingerprint-replace-");
    const identity = createDaemonIdentity(repoRoot);
    const paths = daemonPaths(identity);
    const daemons: StartedAgentWorkbenchDaemon[] = [];
    const oldPid = process.pid;
    let starts = 0;
    const signaled: Array<{ pid: number; signal: NodeJS.Signals }> = [];
    const previousIdentity = {
      ...identity,
      buildFingerprint: undefined
    };

    fs.mkdirSync(paths.metadataDir, { recursive: true });
    fs.writeFileSync(
      paths.metadataPath,
      `${JSON.stringify({
        identity: previousIdentity,
        pid: oldPid,
        socketPath: paths.socketPath,
        createdAt: "2026-08-01T00:00:00.000Z"
      })}\n`
    );
    if (process.platform !== "win32") {
      fs.mkdirSync(paths.ipcDir, { recursive: true });
    }
    const proofServer = await createReplaceableProofServer({
      socketPath: paths.socketPath,
      expectedIdentity: previousIdentity,
      health: {
        pid: oldPid,
        socket_path: paths.socketPath,
        repo_root: repoRoot
      }
    });

    try {
      const socket = await connectOrStartDaemon({
        repoRoot,
        debugRepoRootOverride: false,
        startTimeoutMs: 2500,
        signalProcess: (pid, signal) => {
          signaled.push({ pid, signal });
          fs.rmSync(paths.metadataPath, { force: true });
          void proofServer.close();
        },
        spawnDaemon: (spawnInput) => {
          starts += 1;
          void startAgentWorkbenchDaemon({
            launchToken: spawnInput.launchToken,
            repoRoot,
            idleGraceMs: 100,
            serverOptions: { startupRefreshDelayMs: 60_000 }
          }).then((daemon) => daemons.push(daemon));
          return fakeChildProcess();
        }
      });
      socket.destroy();

      expect(starts).toBe(1);
      expect(signaled).toEqual([{ pid: oldPid, signal: "SIGTERM" }]);
      expect(proofServer.state.handshakeCount).toBe(1);
      expect(proofServer.state.healthReadCount).toBe(1);
      expect(safeReadJson(paths.metadataPath)).toMatchObject({
        identity: {
          id: identity.id,
          runtimeVersion: identity.runtimeVersion,
          buildFingerprint: identity.buildFingerprint
        },
        pid: process.pid
      });
    } finally {
      await proofServer.close();
      await closeDaemons(daemons);
      fs.rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  it("refuses replaceable handoff when the canonical daemon proof reports mismatched pid or socket", async () => {
    const cases = [
      {
        label: "pid",
        health: (repoRoot: string, socketPath: string) => ({
          pid: 999_999,
          socket_path: socketPath,
          repo_root: repoRoot
        })
      },
      {
        label: "socket",
        health: (repoRoot: string, socketPath: string) => ({
          pid: 424_242,
          socket_path: `${socketPath}.other`,
          repo_root: repoRoot
        })
      }
    ] as const;

    for (const testCase of cases) {
      const repoRoot = makeRepoRoot(`agent-workbench-daemon-build-fingerprint-refuse-${testCase.label}-`);
      const identity = createDaemonIdentity(repoRoot);
      const paths = daemonPaths(identity);
      const previousIdentity = {
        ...identity,
        buildFingerprint: undefined
      };
      const signalProcess = vi.fn<(pid: number, signal: NodeJS.Signals) => void>();
      let starts = 0;

      fs.mkdirSync(paths.metadataDir, { recursive: true });
      fs.writeFileSync(
        paths.metadataPath,
        `${JSON.stringify({
          identity: previousIdentity,
          pid: process.pid,
          socketPath: paths.socketPath,
          createdAt: "2026-08-01T00:00:00.000Z"
        })}\n`
      );
      if (process.platform !== "win32") {
        fs.mkdirSync(paths.ipcDir, { recursive: true });
      }

      const proofServer = await createReplaceableProofServer({
        socketPath: paths.socketPath,
        expectedIdentity: previousIdentity,
        health: testCase.health(repoRoot, paths.socketPath)
      });

      try {
        await expect(connectOrStartDaemon({
          repoRoot,
          debugRepoRootOverride: false,
          startTimeoutMs: 1500,
          signalProcess,
          spawnDaemon: () => {
            starts += 1;
            return fakeChildProcess();
          }
        })).rejects.toThrow("blocked: ambiguous_process");

        expect(signalProcess).not.toHaveBeenCalled();
        expect(starts).toBe(0);
        expect(proofServer.state.handshakeCount).toBe(1);
        expect(proofServer.state.healthReadCount).toBe(1);
      } finally {
        await proofServer.close();
        fs.rmSync(repoRoot, { recursive: true, force: true });
      }
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
        spawnDaemon: (spawnInput) => {
          starts += 1;
          void daemonStartGate
            .then(() => startAgentWorkbenchDaemon({
              launchToken: spawnInput.launchToken,
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
        spawnDaemon: (spawnInput) => {
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

  it("blocks malformed daemon startup-lock evidence without deleting it", async () => {
    const repoRoot = makeRepoRoot("agent-workbench-daemon-startup-lock-ambiguous-");
    const paths = daemonPaths(createDaemonIdentity(repoRoot));
    let starts = 0;

    fs.mkdirSync(paths.metadataDir, { recursive: true });
    fs.writeFileSync(paths.startupLockPath, "not-json\n");

    try {
      await expect(connectOrStartDaemon({
        repoRoot,
        debugRepoRootOverride: false,
        startTimeoutMs: 200,
        spawnDaemon: (spawnInput) => {
          starts += 1;
          return fakeChildProcess();
        }
      })).rejects.toThrow("blocked: ambiguous startup ownership");

      expect(starts).toBe(0);
      expect(fs.readFileSync(paths.startupLockPath, "utf8")).toBe("not-json\n");
    } finally {
      fs.rmSync(repoRoot, { recursive: true, force: true });
      fs.rmSync(paths.ipcDir, { recursive: true, force: true });
    }
  });

  it.each(["before acquisition", "after publication"])("fences startup deadline %s without retaining a provisional claim", async (stage) => {
    const repoRoot = makeRepoRoot("agent-workbench-startup-deadline-fence-");
    const paths = daemonPaths(createDaemonIdentity(repoRoot));
    let starts = 0;
    const clock = vi.spyOn(performance, "now").mockReturnValue(0);
    const originalLink = fs.linkSync.bind(fs);
    const link = vi.spyOn(fs, "linkSync").mockImplementation(((from: fs.PathLike, to: fs.PathLike) => {
      const result = originalLink(from, to);
      if (String(to) === paths.startupLockPath && stage === "after publication") clock.mockReturnValue(20);
      return result;
    }) as typeof fs.linkSync);
    if (stage === "before acquisition") clock.mockReturnValueOnce(0).mockReturnValue(20);
    try {
      await expect(connectOrStartDaemon({
        repoRoot, debugRepoRootOverride: false, startTimeoutMs: 10,
        spawnDaemon: () => { starts += 1; return fakeChildProcess(); }
      })).rejects.toThrow("Timed out connecting");
      expect(starts).toBe(0);
      expect(fs.existsSync(paths.startupLockPath)).toBe(false);
      expect(fs.existsSync(`${paths.startupLockPath}.reclaim`)).toBe(false);
    } finally {
      link.mockRestore();
      clock.mockRestore();
      fs.rmSync(repoRoot, { recursive: true, force: true });
      fs.rmSync(paths.ipcDir, { recursive: true, force: true });
    }
  });

  it.skipIf(process.platform !== "linux").each(["dead", "missing"])("recovers a scoped dead guard with a %s canonical claim through normal election", async (canonical) => {
    const repoRoot = makeRepoRoot("agent-workbench-dead-guard-helper-");
    const paths = daemonPaths(createDaemonIdentity(repoRoot));
    fs.mkdirSync(paths.metadataDir, { recursive: true, mode: 0o700 });
    const scope = currentStartupGuardOwnerScope();
    expect(scope).toBeDefined();
    const guardPath = `${paths.startupLockPath}.reclaim`;
    const stale = { pid: 999999999, token: "dead-canonical", created_at: new Date().toISOString() };
    if (canonical === "dead") fs.writeFileSync(paths.startupLockPath, `${JSON.stringify(stale)}\n`, { mode: 0o600 });
    fs.writeFileSync(guardPath, `${JSON.stringify({ ...stale, token: "dead-guard", owner_scope: scope })}\n`, { mode: 0o600 });
    let claim: Awaited<ReturnType<typeof acquireDaemonStartupLock>> = null;
    try {
      claim = await acquireDaemonStartupLock(paths.startupLockPath);
      expect(claim).not.toBeNull();
      expect(claim).not.toBe("ambiguous");
      expect(JSON.parse(fs.readFileSync(paths.startupLockPath, "utf8"))).toMatchObject({ pid: process.pid });
      expect(fs.existsSync(guardPath)).toBe(false);
      expect(fs.existsSync(`${guardPath}.sqlite`)).toBe(true);
    } finally {
      if (claim !== null && claim !== "ambiguous") claim.release();
      fs.rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  it.skipIf(process.platform !== "linux").each(["legacy", "foreign-scope"])("preserves a %s hard-link claimant winning the post-helper gap", async (kind) => {
    const repoRoot = makeRepoRoot("agent-workbench-helper-legacy-gap-");
    const paths = daemonPaths(createDaemonIdentity(repoRoot));
    fs.mkdirSync(paths.metadataDir, { recursive: true, mode: 0o700 });
    const guardPath = `${paths.startupLockPath}.reclaim`;
    const stale = { pid: 999999999, token: "dead", created_at: new Date().toISOString() };
    fs.writeFileSync(paths.startupLockPath, `${JSON.stringify(stale)}\n`, { mode: 0o600 });
    fs.writeFileSync(guardPath, `${JSON.stringify({ ...stale, owner_scope: currentStartupGuardOwnerScope() })}\n`, { mode: 0o600 });
    const legacy = {
      pid: kind === "legacy" ? process.pid : 999999999,
      token: "gap-winner",
      created_at: new Date().toISOString(),
      ...(kind === "foreign-scope" ? { owner_scope: { kind: "linux-pid-namespace-v1", fingerprint: "0".repeat(64) } } : {})
    };
    const originalLink = fs.linkSync.bind(fs);
    let won = false;
    const publishLegacyClaim = (target: string) => {
      const candidate = `${target}.legacy-candidate`;
      fs.writeFileSync(candidate, `${JSON.stringify(legacy)}\n`, { mode: 0o600 });
      originalLink(candidate, target);
      fs.unlinkSync(candidate);
    };
    const link = vi.spyOn(fs, "linkSync").mockImplementation(((from: fs.PathLike, to: fs.PathLike) => {
      if (!won && String(to) === paths.startupLockPath && fs.existsSync(`${guardPath}.sqlite`) && !fs.existsSync(guardPath)) {
        won = true;
        publishLegacyClaim(guardPath);
        fs.unlinkSync(paths.startupLockPath);
        publishLegacyClaim(paths.startupLockPath);
        fs.unlinkSync(guardPath);
      }
      return originalLink(from, to);
    }) as typeof fs.linkSync);
    try {
      expect(await acquireDaemonStartupLock(paths.startupLockPath)).toBe(kind === "legacy" ? null : "ambiguous");
      expect(won).toBe(true);
      expect(fs.readFileSync(paths.startupLockPath, "utf8")).toBe(`${JSON.stringify(legacy)}\n`);
      expect(JSON.parse(fs.readFileSync(paths.startupLockPath, "utf8"))).toEqual(legacy);
      expect(fs.existsSync(guardPath)).toBe(false);
    } finally {
      link.mockRestore();
      fs.rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  it.each([undefined, { kind: "linux-pid-namespace-v1", fingerprint: "0".repeat(64) }])(
    "preserves a dead guard without matching process scope (%j)",
    async (owner_scope) => {
      const repoRoot = makeRepoRoot("agent-workbench-unproven-guard-");
      const paths = daemonPaths(createDaemonIdentity(repoRoot));
      fs.mkdirSync(paths.metadataDir, { recursive: true, mode: 0o700 });
      const guardPath = `${paths.startupLockPath}.reclaim`;
      const bytes = `${JSON.stringify({ pid: 999999999, token: "unproven", created_at: new Date().toISOString(), owner_scope })}\n`;
      fs.writeFileSync(guardPath, bytes, { mode: 0o600 });
      try {
        expect(await acquireDaemonStartupLock(paths.startupLockPath)).toBe("ambiguous");
        expect(fs.readFileSync(guardPath, "utf8")).toBe(bytes);
        expect(fs.existsSync(paths.startupLockPath)).toBe(false);
        expect(fs.existsSync(`${guardPath}.sqlite`)).toBe(false);
      } finally {
        fs.rmSync(repoRoot, { recursive: true, force: true });
      }
    }
  );

  it("serializes stale startup-lock reclaim and fails closed on an abandoned guard", async () => {
    const repoRoot = makeRepoRoot("agent-workbench-daemon-startup-reclaim-guard-");
    const paths = daemonPaths(createDaemonIdentity(repoRoot));
    fs.mkdirSync(paths.metadataDir, { recursive: true });
    try {
      fs.writeFileSync(paths.startupLockPath, `${JSON.stringify({
        pid: 999999999,
        created_at: new Date().toISOString(),
        token: "stale-owner"
      })}\n`);
      fs.writeFileSync(`${paths.startupLockPath}.reclaim`, "abandoned\n");

      expect(await acquireDaemonStartupLock(paths.startupLockPath)).toBe("ambiguous");
      expect(fs.existsSync(paths.startupLockPath)).toBe(true);
      expect(fs.readFileSync(`${paths.startupLockPath}.reclaim`, "utf8")).toBe("abandoned\n");
      fs.rmSync(paths.startupLockPath);
      expect(await acquireDaemonStartupLock(paths.startupLockPath)).toBe("ambiguous");
      expect(fs.existsSync(paths.startupLockPath)).toBe(false);
    } finally {
      fs.rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  it("reclaims a positively dead startup owner and removes only its guard", async () => {
    const repoRoot = makeRepoRoot("agent-workbench-daemon-startup-reclaim-dead-");
    const paths = daemonPaths(createDaemonIdentity(repoRoot));
    fs.mkdirSync(paths.metadataDir, { recursive: true });
    try {
      fs.writeFileSync(paths.startupLockPath, `${JSON.stringify({
        pid: 999999999,
        created_at: new Date().toISOString(),
        token: "stale-owner"
      })}\n`);
      const replacement = await acquireDaemonStartupLock(paths.startupLockPath);
      expect(replacement).not.toBe("ambiguous");
      expect(replacement).not.toBeNull();
      expect(fs.existsSync(`${paths.startupLockPath}.reclaim`)).toBe(false);
      replacement !== null && replacement !== "ambiguous" && replacement.release();
      expect(fs.existsSync(paths.startupLockPath)).toBe(false);
    } finally {
      fs.rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  it("treats a live reclaimer as busy without mutating the canonical owner", async () => {
    const repoRoot = makeRepoRoot("agent-workbench-daemon-startup-live-reclaimer-");
    const paths = daemonPaths(createDaemonIdentity(repoRoot));
    fs.mkdirSync(paths.metadataDir, { recursive: true });
    const guardPath = `${paths.startupLockPath}.reclaim`;
    let guard: { release: () => void } | undefined;
    try {
      fs.writeFileSync(paths.startupLockPath, `${JSON.stringify({
        pid: 999999999,
        created_at: new Date().toISOString(),
        token: "stale-owner"
      })}\n`);
      const before = fs.readFileSync(paths.startupLockPath, "utf8");
      guard = createDaemonStartupLock(guardPath);
      expect(await acquireDaemonStartupLock(paths.startupLockPath)).toBeNull();
      expect(fs.readFileSync(paths.startupLockPath, "utf8")).toBe(before);
    } finally {
      guard?.release();
      fs.rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  it("releases its fresh canonical claim when a live reclaim guard is observed", async () => {
    const repoRoot = makeRepoRoot("agent-workbench-daemon-startup-live-guard-fastpath-");
    const paths = daemonPaths(createDaemonIdentity(repoRoot));
    fs.mkdirSync(paths.metadataDir, { recursive: true });
    const guardPath = `${paths.startupLockPath}.reclaim`;
    let guard: { release: () => void } | undefined;
    try {
      guard = createDaemonStartupLock(guardPath);
      expect(await acquireDaemonStartupLock(paths.startupLockPath)).toBeNull();
      expect(fs.existsSync(paths.startupLockPath)).toBe(false);
      expect(fs.existsSync(guardPath)).toBe(true);
    } finally {
      guard?.release();
      fs.rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  it("treats a canonical owner disappearing during guarded inspection as election progress", async () => {
    const repoRoot = makeRepoRoot("agent-workbench-daemon-startup-owner-gap-");
    const paths = daemonPaths(createDaemonIdentity(repoRoot));
    fs.mkdirSync(paths.metadataDir, { recursive: true });
    const guardPath = `${paths.startupLockPath}.reclaim`;
    const incumbent = createDaemonStartupLock(paths.startupLockPath);
    const originalLinkSync = fs.linkSync.bind(fs);
    const linkSyncSpy = vi.spyOn(fs, "linkSync").mockImplementation(((existingPath: fs.PathLike, newPath: fs.PathLike) => {
      const result = originalLinkSync(existingPath, newPath);
      if (String(newPath) === guardPath) incumbent.release();
      return result;
    }) as typeof fs.linkSync);
    try {
      expect(await acquireDaemonStartupLock(paths.startupLockPath)).toBeNull();
      expect(fs.existsSync(paths.startupLockPath)).toBe(false);
      expect(fs.existsSync(guardPath)).toBe(false);
    } finally {
      linkSyncSpy.mockRestore();
      incumbent.release();
      fs.rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  it("keeps a fresh contender that wins the reclaim unlink/create gap", async () => {
    const repoRoot = makeRepoRoot("agent-workbench-daemon-startup-reclaim-gap-");
    const paths = daemonPaths(createDaemonIdentity(repoRoot));
    fs.mkdirSync(paths.metadataDir, { recursive: true });
    let winner: { release: () => void } | undefined;
    let injected = false;
    const originalRmSync = fs.rmSync.bind(fs);
    const rmSyncSpy = vi.spyOn(fs, "rmSync").mockImplementation(((target: fs.PathLike, options?: fs.RmDirOptions | fs.RmOptions) => {
      const result = originalRmSync(target, options as never);
      if (String(target) === paths.startupLockPath && !injected) {
        injected = true;
        winner = createDaemonStartupLock(paths.startupLockPath);
      }
      return result;
    }) as typeof fs.rmSync);
    try {
      fs.writeFileSync(paths.startupLockPath, `${JSON.stringify({
        pid: 999999999,
        created_at: new Date().toISOString(),
        token: "stale-owner"
      })}\n`);
      expect(await acquireDaemonStartupLock(paths.startupLockPath)).toBeNull();
      expect(JSON.parse(fs.readFileSync(paths.startupLockPath, "utf8"))).toMatchObject({
        pid: process.pid
      });
    } finally {
      rmSyncSpy.mockRestore();
      winner?.release();
      fs.rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  it("atomically publishes one complete startup owner and checks ownership before release", () => {
    const repoRoot = makeRepoRoot("agent-workbench-daemon-startup-lock-atomic-");
    const paths = daemonPaths(createDaemonIdentity(repoRoot));
    fs.mkdirSync(paths.metadataDir, { recursive: true });
    let winner: { release: () => void } | undefined;

    try {
      expect(() => createDaemonStartupLock(paths.startupLockPath, {
        before_claim: () => {
          winner = createDaemonStartupLock(paths.startupLockPath);
        }
      })).toThrow(/EEXIST/);

      const published = JSON.parse(fs.readFileSync(paths.startupLockPath, "utf8")) as {
        pid?: unknown;
        created_at?: unknown;
        token?: unknown;
      };
      expect(published).toMatchObject({
        pid: process.pid,
        created_at: expect.any(String),
        token: expect.any(String)
      });
      expect(Date.parse(published.created_at as string)).not.toBeNaN();
      expect((published.token as string).length).toBeGreaterThan(0);
      expect(fs.readdirSync(paths.metadataDir).filter((name) => name.endsWith(".candidate"))).toEqual([]);

      fs.rmSync(paths.startupLockPath);
      const replacement = createDaemonStartupLock(paths.startupLockPath);
      winner?.release();
      expect(fs.existsSync(paths.startupLockPath)).toBe(true);
      replacement.release();
      expect(fs.existsSync(paths.startupLockPath)).toBe(false);

      const corruptedOwner = createDaemonStartupLock(paths.startupLockPath);
      fs.writeFileSync(paths.startupLockPath, "not-json\n");
      corruptedOwner.release();
      expect(fs.existsSync(paths.startupLockPath)).toBe(false);
    } finally {
      winner?.release();
      fs.rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  it("removes its candidate when startup-lock persistence fails", () => {
    const repoRoot = makeRepoRoot("agent-workbench-daemon-startup-lock-write-failure-");
    const paths = daemonPaths(createDaemonIdentity(repoRoot));
    fs.mkdirSync(paths.metadataDir, { recursive: true });

    try {
      expect(() => createDaemonStartupLock(paths.startupLockPath, {
        persist_candidate: (fd, serialized) => {
          fs.writeFileSync(fd, serialized);
          throw new Error("injected startup-lock persistence failure");
        }
      })).toThrow("injected startup-lock persistence failure");
      expect(fs.existsSync(paths.startupLockPath)).toBe(false);
      expect(fs.readdirSync(paths.metadataDir).filter((name) => name.endsWith(".candidate"))).toEqual([]);
    } finally {
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

  it("blocks ambiguous metadata and live identity or socket mismatches", () => {
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
      ).toEqual({ state: "blocked", reason: "ambiguous_metadata" });

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
      ).toMatchObject({ state: "blocked", reason: "ambiguous_process" });

      const priorBuildIdentity = {
        ...identity,
        buildFingerprint: `${identity.buildFingerprint ?? "missing"}-prior`
      };
      fs.writeFileSync(
        paths.metadataPath,
        `${JSON.stringify({
          identity: priorBuildIdentity,
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
      ).toMatchObject({ state: "mismatched", reason: "build_fingerprint_mismatch" });

      fs.writeFileSync(
        paths.metadataPath,
        `${JSON.stringify({
          identity,
          pid: process.pid,
          socketPath: paths.socketPath,
          createdAt: "2026-07-05T00:00:00.000Z"
        })}\n`
      );
      expect(classifyDaemonState({
        metadataPath: paths.metadataPath,
        expectedIdentity: identity,
        socketPath: paths.socketPath,
        isProcessAlive: () => true,
        socketExists: () => false
      })).toMatchObject({ state: "blocked", reason: "ambiguous_process" });

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
          isProcessAlive: () => false,
          socketExists: () => true
        })
      ).toMatchObject({ state: "stale", reason: "identity_mismatch" });
    } finally {
      fs.rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  it("validates strict launch-lifecycle invariants in metadata files", () => {
    const repoRoot = makeRepoRoot("agent-workbench-daemon-lifecycle-invariants-");
    const identity = createDaemonIdentity(repoRoot);
    const paths = daemonPaths(identity);
    const createdAt = "2026-07-05T00:00:00.000Z";
    const launchLifecycleToken = "test-token";

    try {
      fs.mkdirSync(paths.metadataDir, { recursive: true });

      fs.writeFileSync(
        paths.metadataPath,
        `${JSON.stringify({
          identity,
          pid: process.pid,
          socketPath: paths.socketPath,
          createdAt,
          launchLifecycle: {
            state: "starting",
            phase: "ready",
            launchToken: launchLifecycleToken,
            startedAt: createdAt,
            updatedAt: createdAt
          }
        })}\n`
      );
      expect(classifyDaemonState({
        metadataPath: paths.metadataPath,
        expectedIdentity: identity,
        socketPath: paths.socketPath,
        isProcessAlive: () => true,
        socketExists: () => true
      })).toEqual({ state: "blocked", reason: "ambiguous_metadata" });

      fs.writeFileSync(
        paths.metadataPath,
        `${JSON.stringify({
          identity,
          pid: process.pid,
          socketPath: paths.socketPath,
          createdAt,
          launchLifecycle: {
            state: "ready",
            phase: "launching",
            launchToken: launchLifecycleToken,
            startedAt: createdAt,
            updatedAt: createdAt
          }
        })}\n`
      );
      expect(classifyDaemonState({
        metadataPath: paths.metadataPath,
        expectedIdentity: identity,
        socketPath: paths.socketPath,
        isProcessAlive: () => true,
        socketExists: () => true
      })).toEqual({ state: "blocked", reason: "ambiguous_metadata" });

      fs.writeFileSync(
        paths.metadataPath,
        `${JSON.stringify({
          identity,
          pid: process.pid,
          socketPath: paths.socketPath,
          createdAt,
          launchLifecycle: {
            state: "failed",
            phase: "terminal",
            launchToken: launchLifecycleToken,
            startedAt: createdAt,
            updatedAt: createdAt
          }
        })}\n`
      );
      expect(classifyDaemonState({
        metadataPath: paths.metadataPath,
        expectedIdentity: identity,
        socketPath: paths.socketPath,
        isProcessAlive: () => true,
        socketExists: () => true
      })).toEqual({ state: "blocked", reason: "ambiguous_metadata" });

      fs.writeFileSync(
        paths.metadataPath,
        `${JSON.stringify({
          identity,
          pid: process.pid,
          socketPath: paths.socketPath,
          createdAt,
          launchLifecycle: {
            state: "failed",
            phase: "terminal",
            launchToken: launchLifecycleToken,
            startedAt: createdAt,
            updatedAt: createdAt,
            failureCode: "child_exit"
          }
        })}\n`
      );
      expect(classifyDaemonState({
        metadataPath: paths.metadataPath,
        expectedIdentity: identity,
        socketPath: paths.socketPath,
        isProcessAlive: () => true,
        socketExists: () => true
      })).toMatchObject({ state: "blocked", reason: "failed" });
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

  it("rejects an oversized handshake without affecting the next client", async () => {
    const repoRoot = makeRepoRoot("agent-workbench-daemon-handshake-limit-");
    const daemon = await startAgentWorkbenchDaemon({
      repoRoot,
      idleGraceMs: 100,
      serverOptions: { startupRefreshDelayMs: 60_000 }
    });

    try {
      const oversized = net.createConnection(daemon.metadata.socketPath);
      await new Promise<void>((resolve, reject) => {
        oversized.once("connect", resolve);
        oversized.once("error", reject);
      });
      oversized.write(Buffer.alloc(MAX_DAEMON_HANDSHAKE_BYTES + 1, 0x78));
      await new Promise<void>((resolve) => oversized.once("close", () => resolve()));

      const healthy = net.createConnection(daemon.metadata.socketPath);
      await new Promise<void>((resolve, reject) => {
        healthy.once("connect", resolve);
        healthy.once("error", reject);
      });
      healthy.write(`${JSON.stringify({
        protocol: "agent-workbench-daemon",
        protocolVersion: DAEMON_PROTOCOL_VERSION,
        identity: daemon.metadata.identity
      })}\n`);
      await new Promise<void>((resolve) => setImmediate(resolve));
      expect(daemon.connectedClients()).toBe(1);
      healthy.destroy();
    } finally {
      await daemon.close();
      fs.rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  it("accepts the exact handshake limit and isolates an oversized MCP remainder", async () => {
    const repoRoot = makeRepoRoot("agent-workbench-daemon-transport-boundary-");
    const daemon = await startAgentWorkbenchDaemon({
      repoRoot,
      idleGraceMs: 100,
      serverOptions: { startupRefreshDelayMs: 60_000 }
    });
    const baseHandshake = {
      protocol: "agent-workbench-daemon",
      protocolVersion: DAEMON_PROTOCOL_VERSION,
      identity: daemon.metadata.identity,
      padding: ""
    };
    const baseBytes = Buffer.byteLength(JSON.stringify(baseHandshake));
    const handshakeLine = (paddingBytes: number, ending = "\n"): Buffer => Buffer.from(
      `${JSON.stringify({ ...baseHandshake, padding: "a".repeat(paddingBytes) })}${ending}`
    );

    try {
      const exact = net.createConnection(daemon.metadata.socketPath);
      await new Promise<void>((resolve, reject) => {
        exact.once("connect", resolve);
        exact.once("error", reject);
      });
      exact.write(handshakeLine(MAX_DAEMON_HANDSHAKE_BYTES - baseBytes));
      await new Promise<void>((resolve) => setImmediate(resolve));
      expect(daemon.connectedClients()).toBe(1);
      exact.destroy();

      const over = net.createConnection(daemon.metadata.socketPath);
      await new Promise<void>((resolve, reject) => {
        over.once("connect", resolve);
        over.once("error", reject);
      });
      over.write(handshakeLine(MAX_DAEMON_HANDSHAKE_BYTES - baseBytes + 1));
      await new Promise<void>((resolve) => over.once("close", () => resolve()));

      const fragmented = net.createConnection(daemon.metadata.socketPath);
      await new Promise<void>((resolve, reject) => {
        fragmented.once("connect", resolve);
        fragmented.once("error", reject);
      });
      const fragmentedLine = handshakeLine(0, "\r\n");
      fragmented.write(fragmentedLine.subarray(0, Math.floor(fragmentedLine.length / 2)));
      fragmented.write(fragmentedLine.subarray(Math.floor(fragmentedLine.length / 2)));
      await new Promise<void>((resolve) => setImmediate(resolve));
      expect(daemon.connectedClients()).toBe(1);
      fragmented.destroy();

      const oversizedRemainder = net.createConnection(daemon.metadata.socketPath);
      await new Promise<void>((resolve, reject) => {
        oversizedRemainder.once("connect", resolve);
        oversizedRemainder.once("error", reject);
      });
      oversizedRemainder.write(Buffer.concat([
        handshakeLine(0),
        Buffer.alloc(MAX_MCP_FRAME_BYTES + 1, 0x78)
      ]));
      await new Promise<void>((resolve) => oversizedRemainder.once("close", () => resolve()));

      const healthy = await connectSocketEventually(daemon.metadata.socketPath);
      const healthySession = createSocketSession(healthy);
      healthy.write(handshakeLine(0));
      await initializeSocketSession(healthySession, 401, "healthy-after-boundary");
      expect(await readIntegrationProvider(healthySession, 402)).toBe("unknown");
      healthy.destroy();
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
        spawnDaemon: (spawnInput) => {
          void startAgentWorkbenchDaemon({
            launchToken: spawnInput.launchToken,
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
        spawnDaemon: (spawnInput) => {
          void startAgentWorkbenchDaemon({
            launchToken: spawnInput.launchToken,
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

const createdRepoRoots: string[] = [];

class AdmissionEvidence implements DaemonLifetimeEvidencePort {
  public readonly readyCalls: DaemonLifetimeLaunch[] = [];
  public readonly shutdownReceipts: DaemonShutdownReceipt[] = [];

  public ready(launch: DaemonLifetimeLaunch): void {
    this.readyCalls.push(launch);
  }

  public observeFatal(): void {}
  public observeSignal(): void {}
  public observeExit(): void {}
  public observeShutdown(receipt: DaemonShutdownReceipt): void {
    this.shutdownReceipts.push(receipt);
  }

  public getEvidence(): DaemonLifetimeEvidence {
    const launch = this.readyCalls[0];
    if (launch === undefined) {
      return { status: "unavailable", reason: "not_admitted" };
    }
    return {
      status: "available",
      current: {
        ...launch,
        timestamp: launch.started_at,
        phase: "ready",
        reason: "admitted"
      }
    };
  }
}

afterEach(() => {
  const uniqueRepoRoots = Array.from(new Set(createdRepoRoots.splice(0, createdRepoRoots.length)));
  for (const repoRoot of uniqueRepoRoots) {
    const paths = daemonPaths(createDaemonIdentity(repoRoot));
    fs.rmSync(paths.ipcDir, { recursive: true, force: true });
  }
});

function makeRepoRoot(prefix: string): string {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  createdRepoRoots.push(repoRoot);
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
  const shutdownWaiters = new Set<() => void>();
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
    async shutdown() {
      if (!leaseHeld && terminationState !== "unconfirmed") return;
      await new Promise<void>((resolve) => shutdownWaiters.add(resolve));
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
      if (terminationState !== "unconfirmed") {
        for (const resolve of shutdownWaiters) resolve();
        shutdownWaiters.clear();
      }
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
      for (const resolve of shutdownWaiters) resolve();
      shutdownWaiters.clear();
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
  reject(reason?: unknown): void;
} {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
}

function fakeChildProcess(
  onStart: (child: ChildProcess) => void = () => undefined,
  options: { stderr?: NodeJS.ReadableStream } = {}
): ChildProcess {
  const child = new EventEmitter() as unknown as ChildProcess;
  Object.assign(child, {
    pid: process.pid,
    unref: () => child,
    stderr: options.stderr
  });
  onStart(child);
  return child;
}

function safeReadJson(filePath: string): unknown {
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as unknown;
}

async function closeDaemons(daemons: StartedAgentWorkbenchDaemon[]): Promise<void> {
  await Promise.allSettled(daemons.map((daemon) => daemon.close()));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function connectSocketEventually(socketPath: string, timeoutMs = 1000): Promise<net.Socket> {
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown;
  while (Date.now() <= deadline) {
    try {
      return await new Promise<net.Socket>((resolve, reject) => {
        const socket = net.createConnection(socketPath);
        socket.once("connect", () => resolve(socket));
        socket.once("error", reject);
      });
    } catch (error) {
      lastError = error;
      await sleep(10);
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

async function createReplaceableProofServer(input: {
  socketPath: string;
  expectedIdentity: ReturnType<typeof createDaemonIdentity>;
  health: {
    pid: number;
    socket_path: string;
    repo_root: string;
  };
}): Promise<{
  close(): Promise<void>;
  state: { handshakeCount: number; healthReadCount: number };
}> {
  const state = {
    handshakeCount: 0,
    healthReadCount: 0
  };
  const server = net.createServer((socket) => {
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
          const validHandshake =
            message.protocol === "agent-workbench-daemon" &&
            message.protocolVersion === DAEMON_PROTOCOL_VERSION &&
            identity !== undefined &&
            identity.repoRoot === input.expectedIdentity.repoRoot &&
            identity.runtimeVersion === input.expectedIdentity.runtimeVersion &&
            identity.schemaVersion === input.expectedIdentity.schemaVersion &&
            identity.protocolVersion === input.expectedIdentity.protocolVersion &&
            identity.id === input.expectedIdentity.id &&
            identity.buildFingerprint === input.expectedIdentity.buildFingerprint;
          if (!validHandshake) {
            socket.destroy(new Error(`unexpected replaceable proof handshake: ${line}`));
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
            result: {
              protocolVersion: "2025-06-18",
              capabilities: {},
              serverInfo: { name: "agent-workbench-test", version: "1.0.0" }
            }
          })}\n`);
          continue;
        }
        if (message.method === "notifications/initialized") {
          continue;
        }
        if (message.method === "resources/read" && typeof message.id === "number") {
          state.healthReadCount += 1;
          socket.write(`${JSON.stringify({
            jsonrpc: "2.0",
            id: message.id,
            result: {
              contents: [{
                text: JSON.stringify({
                  data: {
                    daemon: input.health
                  }
                })
              }]
            }
          })}\n`);
          continue;
        }
        socket.destroy(new Error(`unexpected replaceable proof message: ${line}`));
        return;
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

  return {
    close() {
      return new Promise((resolve, reject) => {
        if (!server.listening) {
          resolve();
          return;
        }
        server.close((error) => {
          if (error !== undefined) {
            reject(error);
            return;
          }
          resolve();
        });
      });
    },
    state
  };
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
