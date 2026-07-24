/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { spawn, type ChildProcess } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import net, { type Server, type Socket } from "node:net";
import os from "node:os";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";
import { createRootAuthorityPolicy } from "../interface-adapters/mcp/registries/root-authority.js";
import type { IntegrationLauncherIdentity } from "../contracts/index.js";
import { SCHEMA_VERSION } from "../infrastructure/sqlite/index.js";
import { retireLegacyGraphStore } from "../infrastructure/sqlite/graph-store-location.js";
import { AGENT_WORKBENCH_RUNTIME_VERSION } from "../runtime/version.js";
import {
  createAgentWorkbenchServer,
  createAsyncGraphStore,
  createAsyncPublicationPort,
  createRepositoryRefreshController,
  createRepositoryWorkspaceRefreshService,
  graphStorePath,
  repositoryOwnershipPath,
  type AgentWorkbenchDaemonHealthFacts,
  type AgentWorkbenchSharedRepositoryServices,
  type AgentWorkbenchServerOptions
} from "../server.js";
import {
  FileRepositoryOwnershipAdapter,
  waitForControllerShutdownSafety
} from "../infrastructure/runtime/repository-ownership.js";
import { createDocsRankingCursorCodec, createReferenceCursorCodec } from "../infrastructure/runtime/index.js";
import { RepositoryRefreshTriggerCoordinator } from "../application/use-cases/repository-refresh-triggers.js";
import { FilesystemWorkspaceWatcherAdapter } from "../infrastructure/filesystem/index.js";
import { SystemClockAdapter } from "../infrastructure/time/index.js";
import { resolveWorkspaceWatcherConfig } from "../domain/models/index.js";
import { SocketServerTransport } from "./socket-transport.js";
import type {
  SnapshotRefreshAdmissionFailurePort,
  SnapshotRefreshControllerPort,
  SnapshotRefreshDiagnosticsPort,
  RepositoryOwnershipLease
} from "../ports/index.js";

export const DAEMON_PROTOCOL_VERSION = 1;
const DAEMON_METADATA_FILE = "daemon.json";
const DAEMON_STARTUP_LOCK_FILE = "startup.lock";
const DEFAULT_DAEMON_START_TIMEOUT_MS = 25_000;
const DEFAULT_DAEMON_HANDSHAKE_TIMEOUT_MS = 1000;
const DEFAULT_DAEMON_PENDING_CLIENT_TIMEOUT_MS = 30_000;
const MAX_PENDING_DAEMON_CLIENTS = 64;
const DEFAULT_DAEMON_IDLE_GRACE_MS = 30_000;
const DEFAULT_DAEMON_STARTUP_REFRESH_DELAY_MS = 1000;
const DAEMON_ENV_FLAG = "AGENT_WORKBENCH_DAEMON_PROCESS";
const DAEMON_LAUNCH_TOKEN_ENV = "AGENT_WORKBENCH_DAEMON_LAUNCH_TOKEN";
const DAEMON_METADATA_PATH_ENV = "AGENT_WORKBENCH_DAEMON_METADATA_PATH";
const DAEMON_SOCKET_PATH_ENV = "AGENT_WORKBENCH_DAEMON_SOCKET_PATH";
const DAEMON_IDLE_GRACE_ENV = "AGENT_WORKBENCH_DAEMON_IDLE_GRACE_MS";
const DAEMON_STARTUP_REFRESH_DELAY_ENV = "AGENT_WORKBENCH_DAEMON_STARTUP_REFRESH_DELAY_MS";

export type AgentWorkbenchDaemonIdentity = {
  repoRoot: string;
  runtimeVersion: string;
  schemaVersion: number;
  protocolVersion: number;
  id: string;
};

export type AgentWorkbenchDaemonMetadata = {
  identity: AgentWorkbenchDaemonIdentity;
  pid: number;
  socketPath: string;
  createdAt: string;
  launchLifecycle?: {
    state: "starting" | "ready" | "failed";
    phase: "launching" | "ready" | "terminal";
    launchToken: string;
    startedAt: string;
    updatedAt: string;
    failureCode?: DaemonStartupFailureCode;
  };
};

type LifecycleDaemonMetadata = AgentWorkbenchDaemonMetadata & {
  launchLifecycle: NonNullable<AgentWorkbenchDaemonMetadata["launchLifecycle"]>;
};

export type DaemonStartupFailureCode =
  | "child_error"
  | "child_exit"
  | "bootstrap_failed"
  | "listen_failed"
  | "metadata_write_failed";

export type DaemonState =
  | { state: "absent"; reason: "missing" }
  | { state: "stale"; reason: "malformed_metadata" | "dead_process" | "missing_socket" | "identity_mismatch"; metadata?: AgentWorkbenchDaemonMetadata }
  | { state: "mismatched"; reason: "identity_mismatch"; metadata: AgentWorkbenchDaemonMetadata }
  | { state: "blocked"; reason: "ambiguous_process" | "ambiguous_metadata" | "starting" | "failed"; metadata?: AgentWorkbenchDaemonMetadata }
  | { state: "ready"; metadata: AgentWorkbenchDaemonMetadata };

export type DaemonPaths = {
  ipcDir: string;
  socketPath: string;
  metadataDir: string;
  metadataPath: string;
  startupLockPath: string;
};

export type ConnectOrStartDaemonOptions = {
  repoRoot: string;
  debugRepoRootOverride: boolean;
  integrationIdentity?: IntegrationLauncherIdentity;
  startTimeoutMs?: number;
  handshakeTimeoutMs?: number;
  env?: NodeJS.ProcessEnv;
  spawnDaemon?: (input: SpawnDaemonInput) => ChildProcess;
};

export type SpawnDaemonInput = {
  repoRoot: string;
  debugRepoRootOverride: boolean;
  metadataPath: string;
  socketPath: string;
  launchToken: string;
  env: NodeJS.ProcessEnv;
};

export type StartedAgentWorkbenchDaemon = {
  server: Server;
  metadata: AgentWorkbenchDaemonMetadata;
  close: () => Promise<void>;
  connectedClients: () => number;
};

export class DaemonRefreshLifetimeCoordinator {
  private idleHandle: { cancel(): void } | undefined;
  private closing = false;
  private readonly unsubscribe: () => void;

  public constructor(private readonly options: {
    controller: SnapshotRefreshControllerPort;
    connected_clients: () => number;
    idle_grace_ms: number;
    close: () => void | Promise<void>;
    schedule?: (delayMs: number, callback: () => void) => { cancel(): void };
  }) {
    this.unsubscribe = options.controller.onTransition((transition) => {
      if (transition.state === "active") {
        this.cancelIdle();
      } else {
        this.scheduleIdle();
      }
    });
  }

  public clientConnected(): void {
    this.cancelIdle();
  }

  public clientDisconnected(): void {
    this.scheduleIdle();
  }

  public start(): void {
    this.scheduleIdle();
  }

  public dispose(): void {
    this.closing = true;
    this.cancelIdle();
    this.unsubscribe();
  }

  private scheduleIdle(): void {
    if (this.closing || this.options.connected_clients() > 0 || this.refreshUnsafe()) return;
    this.cancelIdle();
    const schedule = this.options.schedule ?? defaultIdleSchedule;
    this.idleHandle = schedule(this.options.idle_grace_ms, () => {
      this.idleHandle = undefined;
      if (this.closing || this.options.connected_clients() > 0 || this.refreshUnsafe()) return;
      this.closing = true;
      void this.options.close();
    });
  }

  private cancelIdle(): void {
    this.idleHandle?.cancel();
    this.idleHandle = undefined;
  }

  private refreshUnsafe(): boolean {
    const receipt = this.options.controller.getReceipt();
    return receipt.activity_lease?.state === "held" || receipt.worker_termination_state === "unconfirmed";
  }
}

function defaultIdleSchedule(delayMs: number, callback: () => void): { cancel(): void } {
  const timer = setTimeout(callback, delayMs);
  timer.unref?.();
  return { cancel: () => clearTimeout(timer) };
}

type DaemonHandshake = {
  protocol: "agent-workbench-daemon";
  protocolVersion: number;
  identity: AgentWorkbenchDaemonIdentity;
  integrationIdentity?: IntegrationLauncherIdentity;
};

type DaemonTestHooks = {
  /**
   * Deterministic test seam for holding or failing heavyweight repository
   * bootstrap after the daemon socket is listening.
   */
  awaitBootstrap?: Promise<void>;
};

export function createDaemonIdentity(repoRoot: string): AgentWorkbenchDaemonIdentity {
  const absoluteRepoRoot = path.resolve(repoRoot);
  const runtimeVersion = AGENT_WORKBENCH_RUNTIME_VERSION;
  const schemaVersion = SCHEMA_VERSION;
  const protocolVersion = DAEMON_PROTOCOL_VERSION;
  return {
    repoRoot: absoluteRepoRoot,
    runtimeVersion,
    schemaVersion,
    protocolVersion,
    id: stableHash([
      absoluteRepoRoot,
      runtimeVersion,
      String(schemaVersion),
      String(protocolVersion)
    ].join("\0"))
  };
}

export function daemonPaths(identity: AgentWorkbenchDaemonIdentity): DaemonPaths {
  const shortHash = identity.id.slice(0, 24);
  const metadataDir = path.join(identity.repoRoot, ".cache", "agent-workbench", "daemon");
  const ipcDir = process.platform === "win32"
    ? metadataDir
    : path.join(os.tmpdir(), `auriora-agent-workbench-${userRuntimeId()}-${shortHash}`);
  const socketPath =
    process.platform === "win32"
      ? `\\\\.\\pipe\\auriora-agent-workbench-${shortHash}`
      : path.join(ipcDir, "daemon.sock");
  return {
    ipcDir,
    socketPath,
    metadataDir,
    metadataPath: path.join(metadataDir, DAEMON_METADATA_FILE),
    startupLockPath: path.join(metadataDir, DAEMON_STARTUP_LOCK_FILE)
  };
}

export function classifyDaemonState(input: {
  metadataPath: string;
  expectedIdentity: AgentWorkbenchDaemonIdentity;
  socketPath: string;
  isProcessAlive?: (pid: number) => boolean | "ambiguous";
  socketExists?: (socketPath: string) => boolean;
}): DaemonState {
  const metadata = readDaemonMetadata(input.metadataPath);
  if (metadata === undefined) {
    return { state: "absent", reason: "missing" };
  }
  if (metadata === "malformed") {
    return { state: "blocked", reason: "ambiguous_metadata" };
  }
  const processState = (input.isProcessAlive ?? isProcessAlive)(metadata.pid);
  if (processState === "ambiguous") {
    return { state: "blocked", reason: "ambiguous_process", metadata };
  }
  if (!daemonIdentityMatches(metadata.identity, input.expectedIdentity)) {
    return processState
      ? { state: "blocked", reason: "ambiguous_process", metadata }
      : { state: "stale", reason: "identity_mismatch", metadata };
  }
  const lifecycle = resolveLifecycleState(metadata.launchLifecycle);
  if (lifecycle === "starting") {
    return processState
      ? { state: "blocked", reason: "starting", metadata }
      : { state: "stale", reason: "dead_process", metadata };
  }
  if (lifecycle === "failed") {
    return processState
      ? { state: "blocked", reason: "failed", metadata }
      : { state: "stale", reason: "dead_process", metadata };
  }
  if (!processState) {
    return { state: "stale", reason: "dead_process", metadata };
  }
  const socketExists = input.socketExists ?? defaultSocketExists;
  if (metadata.socketPath !== input.socketPath || !socketExists(metadata.socketPath)) {
    return { state: "blocked", reason: "ambiguous_process", metadata };
  }
  return { state: "ready", metadata };
}

export async function connectOrStartDaemon(
  options: ConnectOrStartDaemonOptions
): Promise<Socket> {
  const repoRoot = path.resolve(options.repoRoot);
  const identity = createDaemonIdentity(repoRoot);
  const paths = daemonPaths(identity);
  const env = options.env ?? process.env;
  const spawnDaemon = options.spawnDaemon ?? spawnDaemonProcess;
  ensureDaemonDirectories(paths);
  const timeoutMs = options.startTimeoutMs ?? DEFAULT_DAEMON_START_TIMEOUT_MS;
  const deadlineMs = performance.now() + timeoutMs;
  const handshakeTimeoutMs = options.handshakeTimeoutMs ?? DEFAULT_DAEMON_HANDSHAKE_TIMEOUT_MS;
  const retryStartup = (): Promise<Socket> => {
    const remainingMs = deadlineMs - performance.now();
    if (remainingMs <= 0) {
      throw new Error("Timed out connecting to Agent Workbench daemon before startup re-election.");
    }
    return connectOrStartDaemon({
      ...options,
      startTimeoutMs: remainingMs
    });
  };
  let startupLock: { release: () => void } | null = null;
  let startupLockReleased = false;
  let keepStartupLock = false;
  let startingMetadata: LifecycleDaemonMetadata | undefined;
  let startupFailure: { error: Error; code: DaemonStartupFailureCode } | undefined;

  const releaseStartupLock = (): void => {
    if (!startupLockReleased && startupLock !== null && !keepStartupLock) {
      startupLockReleased = true;
      startupLock.release();
      startupLock = null;
    }
  };
  const recordStartupFailure = (
    reasonError: Error,
    failureCode: DaemonStartupFailureCode
  ): void => {
    if (startupFailure !== undefined) {
      return;
    }
    startupFailure = { error: reasonError, code: failureCode };
    if (startingMetadata !== undefined) {
      const failureMetadata = createDaemonMetadata({
        identity,
        pid: startingMetadata.pid,
        socketPath: paths.socketPath,
        launchToken: startingMetadata.launchLifecycle.launchToken,
        launchStartedAt: startingMetadata.launchLifecycle.startedAt,
        createdAt: startingMetadata.createdAt,
        updatedAt: new Date().toISOString(),
        phase: "terminal",
        failureCode
      });
      try {
        writeDaemonMetadata(paths.metadataPath, failureMetadata);
      } catch {
        // Startup failure metadata is best effort.
      }
    }
    keepStartupLock = false;
    releaseStartupLock();
  };

  try {
    let state = classifyDaemonState({
      metadataPath: paths.metadataPath,
      expectedIdentity: identity,
      socketPath: paths.socketPath
    });

    if (state.state === "blocked") {
      if (state.reason === "starting") {
        return await waitForDaemonConnection({
          identity,
          integrationIdentity: options.integrationIdentity,
          socketPath: paths.socketPath,
          metadataPath: paths.metadataPath,
          startupLockPath: paths.startupLockPath,
          timeoutMs,
          deadlineMs,
          handshakeTimeoutMs,
          retryStartup
        });
      }
      if (state.reason === "failed" && state.metadata !== undefined) {
        throw startupFailureFromMetadata(state.metadata);
      }
      keepStartupLock = false;
      throw new Error(`Agent Workbench daemon is ${state.state}: ${state.reason}.`);
    }

    if (state.state === "absent" || state.state === "stale" || state.state === "mismatched") {
      const startupLockAdmission = acquireDaemonStartupLock(paths.startupLockPath);
      if (startupLockAdmission === "ambiguous") {
        throw new Error("Agent Workbench daemon is blocked: ambiguous startup ownership.");
      }
      startupLock = startupLockAdmission;
      const haveStartupLock = startupLock !== null;
      keepStartupLock = haveStartupLock;
      if (!haveStartupLock) {
        return await waitForDaemonConnection({
          identity,
          integrationIdentity: options.integrationIdentity,
          socketPath: paths.socketPath,
          metadataPath: paths.metadataPath,
          startupLockPath: paths.startupLockPath,
          timeoutMs,
          deadlineMs,
          handshakeTimeoutMs,
          retryStartup
        });
      }

      state = normalizeLaunchState(classifyDaemonState({
        metadataPath: paths.metadataPath,
        expectedIdentity: identity,
        socketPath: paths.socketPath
      }), paths);
      if (state.state === "blocked") {
        if (state.reason === "starting") {
          keepStartupLock = false;
          releaseStartupLock();
          return await waitForDaemonConnection({
            identity,
            integrationIdentity: options.integrationIdentity,
            socketPath: paths.socketPath,
            metadataPath: paths.metadataPath,
            startupLockPath: paths.startupLockPath,
            timeoutMs,
            deadlineMs,
            handshakeTimeoutMs,
            retryStartup
          });
        }
        if (state.reason === "failed" && state.metadata !== undefined) {
          keepStartupLock = false;
          throw startupFailureFromMetadata(state.metadata);
        }
        keepStartupLock = false;
        throw new Error(`Agent Workbench daemon is ${state.state}: ${state.reason}.`);
      }
      if (state.state === "absent") {
        const launchToken = crypto.randomUUID();
        let launchProcess: ChildProcess;
        try {
          launchProcess = spawnDaemon({
            repoRoot,
            debugRepoRootOverride: options.debugRepoRootOverride,
            metadataPath: paths.metadataPath,
            socketPath: paths.socketPath,
            launchToken,
            env
          });
        } catch (_error) {
          releaseStartupLock();
          throw new Error("Daemon start was blocked by spawn failure.");
        }

        if (typeof launchProcess.pid !== "number" || launchProcess.pid <= 0) {
          releaseStartupLock();
          throw new Error("Daemon launch did not expose a process identifier.");
        }

        let terminalCleanup = () => undefined;
        const terminalPromise = new Promise<never>((_resolve, reject) => {
          const onChildError = (error: Error): void => {
            if (startupFailure !== undefined) {
              return;
            }
            const reason = error instanceof Error ? error : new Error(String(error));
            recordStartupFailure(reason, "child_error");
            terminalCleanup();
            reject(reason);
          };
          const onChildExit = (code: number | null, signal: NodeJS.Signals | null): void => {
            if (startupFailure !== undefined) {
              return;
            }
            const reason = formatChildExitFailure(code, signal);
            recordStartupFailure(reason, "child_exit");
            terminalCleanup();
            reject(reason);
          };

          launchProcess.once("error", onChildError);
          launchProcess.once("exit", onChildExit);
          terminalCleanup = () => {
            launchProcess.off("error", onChildError);
            launchProcess.off("exit", onChildExit);
          };
        });
        void terminalPromise.catch(() => undefined);

        const startedAt = new Date().toISOString();
        startingMetadata = createDaemonMetadata({
          identity,
          pid: launchProcess.pid,
          socketPath: paths.socketPath,
          launchToken,
          launchStartedAt: startedAt,
          createdAt: startedAt,
          failureCode: undefined,
          phase: "launching",
          updatedAt: startedAt
        });
        try {
          writeDaemonMetadata(paths.metadataPath, startingMetadata);
        } catch (error) {
          recordStartupFailure(
            error instanceof Error ? error : new Error(String(error)),
            "metadata_write_failed"
          );
          releaseStartupLock();
          throw error;
        }

        try {
          const socket = await Promise.race([
            waitForDaemonConnection({
              identity,
              integrationIdentity: options.integrationIdentity,
              socketPath: paths.socketPath,
              metadataPath: paths.metadataPath,
              startupLockPath: paths.startupLockPath,
              timeoutMs,
              deadlineMs,
              handshakeTimeoutMs,
              retryStartup
            }),
            terminalPromise
          ]);
          terminalCleanup();
          keepStartupLock = false;
          releaseStartupLock();
          launchProcess.unref?.();
          return socket;
        } catch (error) {
          if (startupFailure !== undefined) {
            terminalCleanup();
            throw startupFailure.error;
          }
          terminalCleanup();
          keepStartupLock = false;
          releaseStartupLock();
          launchProcess.unref?.();
          throw error;
        }
      }
    }

    keepStartupLock = false;
    return await waitForDaemonConnection({
      identity,
      integrationIdentity: options.integrationIdentity,
      socketPath: paths.socketPath,
      metadataPath: paths.metadataPath,
      startupLockPath: paths.startupLockPath,
      timeoutMs,
      deadlineMs,
      handshakeTimeoutMs,
      retryStartup
    });
  } finally {
    releaseStartupLock();
  }
}

export async function startAgentWorkbenchDaemon(input: {
  repoRoot: string;
  debugRepoRootOverride?: boolean;
  idleGraceMs?: number;
  launchToken?: string;
  launchStartedAt?: string;
  serverOptions?: AgentWorkbenchServerOptions;
  testHooks?: DaemonTestHooks;
}): Promise<StartedAgentWorkbenchDaemon> {
  const repoRoot = path.resolve(input.repoRoot);
  const identity = createDaemonIdentity(repoRoot);
  const paths = daemonPaths(identity);
  ensureDaemonDirectories(paths);
  const launchToken = input.launchToken ??
    process.env[DAEMON_LAUNCH_TOKEN_ENV] ??
    crypto.randomUUID();
  const startedAt = input.launchStartedAt ?? new Date().toISOString();

  let metadata = createDaemonMetadata({
    identity,
    pid: process.pid,
    socketPath: paths.socketPath,
    launchToken,
    launchStartedAt: startedAt,
    createdAt: startedAt,
    updatedAt: startedAt,
    phase: "launching"
  });
  const connected = new Set<Socket>();
  const mcpServers = new Set<{ close: () => Promise<void> }>();
  const databasePath = graphStorePath(repoRoot);
  const sharedGraphStore = createAsyncGraphStore(databasePath);
  const ownerGeneration = Date.now();
  const ownership = new FileRepositoryOwnershipAdapter(repositoryOwnershipPath(databasePath));
  let ownershipLease: (RepositoryOwnershipLease & { state: "active" }) | undefined;
  let refreshController: SnapshotRefreshControllerPort &
    SnapshotRefreshDiagnosticsPort & SnapshotRefreshAdmissionFailurePort;
  let closePromise: Promise<void> | undefined;
  let startupTimer: ReturnType<typeof setTimeout> | undefined;
  let startupRefreshPromise: Promise<void> | undefined;
  let readinessEstablished = false;
  let sharedRepositoryServices: AgentWorkbenchSharedRepositoryServices | undefined;
  let lifetime: DaemonRefreshLifetimeCoordinator | undefined;
  const sharedDisposers = new Set<() => void | Promise<void>>();
  const pendingSocketTimeouts = new Map<Socket, ReturnType<typeof setTimeout>>();

  const closeSockets = (): void => {
    for (const socket of [...pendingSockets]) {
      removePendingSocket(socket);
      socket.destroy();
    }
    for (const socket of connected) {
      socket.destroy();
    }
  };

  const removePendingSocket = (socket: Socket): void => {
    pendingSockets.delete(socket);
    const timeout = pendingSocketTimeouts.get(socket);
    if (timeout !== undefined) {
      clearTimeout(timeout);
      pendingSocketTimeouts.delete(socket);
    }
  };

  const markBootstrapFailure = (metadata: LifecycleDaemonMetadata): LifecycleDaemonMetadata => {
    return {
      ...metadata,
      launchLifecycle: {
        ...metadata.launchLifecycle,
        state: "failed",
        phase: "terminal",
        updatedAt: new Date().toISOString(),
        failureCode: "bootstrap_failed"
      }
    };
  };

  const rejectOrThrow = async (error: unknown, launchCode?: DaemonStartupFailureCode): Promise<never> => {
    const reason = error instanceof Error ? error : new Error(String(error));
    try {
      if (launchCode === "listen_failed" || launchCode === "metadata_write_failed") {
        writeDaemonMetadata(paths.metadataPath, {
          ...metadata,
          launchLifecycle: {
            ...metadata.launchLifecycle,
            state: "failed",
            phase: "terminal",
            updatedAt: new Date().toISOString(),
            failureCode: launchCode
          }
        });
      } else {
        writeDaemonMetadata(paths.metadataPath, markBootstrapFailure(metadata));
      }
    } catch {
      // Metadata terminal evidence is best effort.
    }
    if (startupTimer !== undefined) {
      clearTimeout(startupTimer);
      startupTimer = undefined;
    }
    closeSockets();
    pendingSockets.clear();
    await Promise.allSettled([...sharedDisposers].map((dispose) => Promise.resolve(dispose())));
    if (startupRefreshPromise !== undefined) {
      await startupRefreshPromise.catch(() => undefined);
    }
    if (refreshController !== undefined) {
      await waitForControllerShutdownSafety(refreshController).catch(() => undefined);
    }
    lifetime?.dispose();
    if (ownershipLease !== undefined) {
      await ownership.release({ lease: ownershipLease }).catch(() => undefined);
      ownershipLease = undefined;
    }
    if (server.listening) {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error !== undefined) {
            reject(error);
            return;
          }
          resolve();
        });
      }).catch(() => undefined);
    }
    await sharedGraphStore.close().catch(() => undefined);
    removeCanonicalFile(paths.socketPath);
    if (process.platform !== "win32") {
      fsyncDirectory(paths.ipcDir);
    }
    throw reason;
  };

  const flushPendingSockets = (): void => {
    if (!readinessEstablished || sharedRepositoryServices === undefined || lifetime === undefined) {
      return;
    }
    const queue = Array.from(pendingSockets);
    if (queue.length === 0) {
      return;
    }
    for (const socket of queue) {
      removePendingSocket(socket);
      if (socket.destroyed) {
        continue;
      }
      lifetime.clientConnected();
      connected.add(socket);
      socket.once("close", () => {
        connected.delete(socket);
        lifetime?.clientDisconnected();
      });
      void acceptDaemonClient({
        socket,
        identity,
        repoRoot,
        debugRepoRootOverride: input.debugRepoRootOverride === true,
        serverOptions: input.serverOptions,
        sharedRepositoryServices,
        daemonDiagnostics: () => {
          return {
            pid: metadata.pid,
            socket_path: metadata.socketPath,
            repo_root: metadata.identity.repoRoot,
            connected_clients: connected.size
          };
        },
        mcpServers
      });
    }
  };

  const pendingSockets = new Set<Socket>();
  const server = net.createServer((socket) => {
    if (pendingSockets.size >= MAX_PENDING_DAEMON_CLIENTS) {
      socket.destroy();
      return;
    }
    pendingSockets.add(socket);
    const timeout = setTimeout(() => {
      removePendingSocket(socket);
      socket.destroy();
    }, DEFAULT_DAEMON_PENDING_CLIENT_TIMEOUT_MS);
    timeout.unref?.();
    pendingSocketTimeouts.set(socket, timeout);
    socket.once("close", () => removePendingSocket(socket));
    if (readinessEstablished) {
      flushPendingSockets();
    }
  });

  const ownershipAdmission = await ownership.acquire({
    repo_root: repoRoot,
    runtime_identity: `${AGENT_WORKBENCH_RUNTIME_VERSION}:${SCHEMA_VERSION}`,
    schema_version: SCHEMA_VERSION,
    owner_id: `daemon:${process.pid}:${ownerGeneration}`,
    owner_pid: process.pid,
    owner_generation: ownerGeneration,
    heartbeat_at: new Date().toISOString()
  });
  if (ownershipAdmission.outcome === "blocked") {
    throw new Error(
      ownershipAdmission.reason === "owner_active"
        ? "Repository refresh owner is active."
        : "Repository refresh ownership is ambiguous."
    );
  }
  ownershipLease = ownershipAdmission.lease;

  let listenFailureCode: DaemonStartupFailureCode = "listen_failed";
  try {
    if (process.platform !== "win32") {
      fs.rmSync(paths.socketPath, { force: true });
    }
    listenFailureCode = "metadata_write_failed";
    writeDaemonMetadata(paths.metadataPath, metadata);
    listenFailureCode = "listen_failed";
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(paths.socketPath, () => {
        server.off("error", reject);
        resolve();
      });
    });
  } catch (error) {
    await rejectOrThrow(error, listenFailureCode);
    throw error;
  }

  let bootstrapFailureCode: DaemonStartupFailureCode = "bootstrap_failed";
  try {
    if (input.testHooks?.awaitBootstrap !== undefined) {
      await input.testHooks.awaitBootstrap;
    }

    const store = await sharedGraphStore();
    retireLegacyGraphStore(databasePath);
    const orphanReconciliation = await store.reconcileOrphanedBuilds({
      repo_root: repoRoot,
      current_owner: ownershipLease,
      recovered_owners: ownershipAdmission.recovered_owners,
      updated_at: new Date().toISOString()
    });
    if (orphanReconciliation.outcome === "blocked") {
      throw new Error("Repository refresh ownership is ambiguous.");
    }
    refreshController = await createRepositoryRefreshController({
      repoRoot,
      graphStore: sharedGraphStore,
      databasePath,
      controllerGeneration: ownerGeneration,
      maxFiles: input.serverOptions?.startupWarmupMaxFiles ?? 2000
    });
    if (orphanReconciliation.snapshot_ids[0] !== undefined) {
      await refreshController.recordAdmissionFailure({
        repo_root: repoRoot,
        invalidation_generation: 0,
        code: "orphaned_build",
        target_snapshot_id: orphanReconciliation.snapshot_ids[0]
      });
    }
    await ownership.confirmRecovery({ lease: ownershipLease });

    const refreshTriggers = new RepositoryRefreshTriggerCoordinator({
      repo_root: repoRoot,
      controller: refreshController,
      publications: createAsyncPublicationPort(sharedGraphStore),
      snapshots: {
        async markSnapshotFreshness(request) {
          await (await sharedGraphStore()).markSnapshotFreshness(request);
        }
      }
    });
    const workspaceRefresh = createRepositoryWorkspaceRefreshService({
      repoRoot,
      triggers: refreshTriggers,
      watcher: new FilesystemWorkspaceWatcherAdapter(),
      clock: new SystemClockAdapter(),
      config: resolveWorkspaceWatcherConfig(input.serverOptions?.workspaceWatcher),
      indexedRoots: input.serverOptions?.workspaceWatcherIndexedRoots ?? ["."],
      skippedRoots: input.serverOptions?.workspaceWatcherSkippedRoots ?? []
    });
    sharedDisposers.add(() => workspaceRefresh.close());
    sharedRepositoryServices = {
      refreshController,
      refreshDiagnostics: refreshController,
      refreshTriggers,
      graphStore: sharedGraphStore,
      referenceCursorCodec: createReferenceCursorCodec(),
      docsRankingCursorCodec: createDocsRankingCursorCodec(),
      pollWorkspaceWatcher: () => workspaceRefresh.poll(),
      registerDisposer(dispose) {
        sharedDisposers.add(dispose);
        return () => sharedDisposers.delete(dispose);
      }
    };
    startupTimer = setTimeout(() => {
      startupRefreshPromise = refreshTriggers.startup({ source: "daemon-startup" })
        .then(() => undefined, () => undefined);
    }, input.serverOptions?.startupRefreshDelayMs ?? DEFAULT_DAEMON_STARTUP_REFRESH_DELAY_MS);
    startupTimer.unref?.();

    metadata = {
      ...metadata,
      launchLifecycle: {
        ...metadata.launchLifecycle,
        state: "ready",
        phase: "ready",
        updatedAt: new Date().toISOString()
      }
    };
    lifetime = new DaemonRefreshLifetimeCoordinator({
      controller: refreshController,
      connected_clients: () => connected.size,
      idle_grace_ms: input.idleGraceMs ?? readIdleGraceMs(process.env),
      close
    });
    bootstrapFailureCode = "metadata_write_failed";
    writeDaemonMetadata(paths.metadataPath, metadata);
    bootstrapFailureCode = "bootstrap_failed";
    readinessEstablished = true;
    flushPendingSockets();
    lifetime.start();
  } catch (error) {
    await rejectOrThrow(error, bootstrapFailureCode);
    throw error;
  }

  function close(): Promise<void> {
    closePromise ??= closeDaemon();
    return closePromise;
  }

  async function closeDaemon(): Promise<void> {
    const shutdownLockAdmission = acquireDaemonStartupLock(paths.startupLockPath);
    const shutdownLock = shutdownLockAdmission !== null &&
      shutdownLockAdmission !== "ambiguous"
      ? shutdownLockAdmission
      : undefined;
    try {
      if (startupTimer !== undefined) {
        clearTimeout(startupTimer);
        startupTimer = undefined;
      }
      lifetime?.dispose();
      closeSockets();
      pendingSockets.clear();
      await Promise.allSettled([...mcpServers].map((mcpServer) => mcpServer.close()));
      await Promise.allSettled([...sharedDisposers].map((dispose) => Promise.resolve(dispose())));
      if (startupRefreshPromise !== undefined) {
        await startupRefreshPromise;
      }
      if (refreshController !== undefined) {
        await waitForControllerShutdownSafety(refreshController);
      }
      if (server.listening) {
        await new Promise<void>((resolve, reject) => {
          server.close((error) => {
            if (error !== undefined) {
              reject(error);
              return;
            }
            resolve();
          });
        });
      }
      if (ownershipLease !== undefined) {
        await ownership.release({ lease: ownershipLease });
        ownershipLease = undefined;
      }
      await sharedGraphStore.close();
      if (shutdownLock !== undefined) {
        cleanupStaleDaemonState(metadata, paths);
      }
    } finally {
      shutdownLock?.release();
    }
  }

  return {
    server,
    metadata,
    close,
    connectedClients: () => connected.size
  };
}

export async function runDaemonFromEnv(env: NodeJS.ProcessEnv = process.env): Promise<void> {
  const repoRoot = env.AGENT_WORKBENCH_DAEMON_REPO_ROOT;
  if (repoRoot === undefined || repoRoot.trim() === "") {
    throw new Error("AGENT_WORKBENCH_DAEMON_REPO_ROOT is required.");
  }
  const identity = createDaemonIdentity(repoRoot);
  const metadataPath = env[DAEMON_METADATA_PATH_ENV];
  const socketPath = env[DAEMON_SOCKET_PATH_ENV];
  const launchToken = env[DAEMON_LAUNCH_TOKEN_ENV];
  const launchStartedAt = new Date().toISOString();
  try {
    await startAgentWorkbenchDaemon({
      repoRoot,
      debugRepoRootOverride: env.AGENT_WORKBENCH_DAEMON_DEBUG_REPO_ROOT_OVERRIDE === "1",
      idleGraceMs: readIdleGraceMs(env),
      launchToken,
      launchStartedAt,
      serverOptions: {
        startupRefreshDelayMs: daemonStartupRefreshDelayMsFromEnv(env)
      }
    });
  } catch (error) {
    recordEntrypointDaemonFailure({
      metadataPath,
      socketPath,
      launchToken,
      identity,
      launchStartedAt
    });
    throw error;
  }
}

function recordEntrypointDaemonFailure(input: {
  metadataPath: string | undefined;
  socketPath: string | undefined;
  launchToken: string | undefined;
  identity: AgentWorkbenchDaemonIdentity;
  launchStartedAt: string;
}): void {
  if (typeof input.metadataPath !== "string" || input.metadataPath.trim() === "") {
    return;
  }
  const baselineMetadata = readDaemonMetadata(input.metadataPath);
  if (
    baselineMetadata !== undefined &&
    baselineMetadata !== "malformed" &&
    (
      !daemonIdentityMatches(baselineMetadata.identity, input.identity) ||
      baselineMetadata.launchLifecycle?.state === "ready" ||
      baselineMetadata.launchLifecycle?.state === "failed" ||
      (
        input.launchToken !== undefined &&
        baselineMetadata.launchLifecycle !== undefined &&
        baselineMetadata.launchLifecycle.launchToken !== input.launchToken
      )
    )
  ) {
    return;
  }
  const launchToken = input.launchToken !== undefined && input.launchToken.length > 0
    ? input.launchToken
    : (baselineMetadata !== undefined &&
      baselineMetadata !== "malformed" &&
      baselineMetadata.launchLifecycle?.launchToken !== undefined
      ? baselineMetadata.launchLifecycle.launchToken
      : undefined);
  const socketPath = input.socketPath !== undefined && input.socketPath.trim() !== ""
    ? input.socketPath
    : (baselineMetadata !== undefined &&
      baselineMetadata !== "malformed"
      ? baselineMetadata.socketPath
      : undefined);

  if (launchToken === undefined || socketPath === undefined) {
    return;
  }

  const createdAt = baselineMetadata !== undefined &&
    baselineMetadata !== "malformed" &&
    typeof baselineMetadata.createdAt === "string"
    ? baselineMetadata.createdAt
    : input.launchStartedAt;
  const resolvedLaunchStartedAt = baselineMetadata !== undefined &&
    baselineMetadata !== "malformed" &&
    baselineMetadata.launchLifecycle !== undefined
    ? baselineMetadata.launchLifecycle.startedAt
    : input.launchStartedAt;

  try {
    writeDaemonMetadata(input.metadataPath, createDaemonMetadata({
      identity: input.identity,
      pid: process.pid,
      socketPath,
      launchToken,
      launchStartedAt: resolvedLaunchStartedAt,
      createdAt,
      updatedAt: new Date().toISOString(),
      phase: "terminal",
      failureCode: "bootstrap_failed"
    }));
  } catch {
    // Entrypoint bootstrap failure evidence is best effort.
  }
}

export function isDaemonProcess(env: NodeJS.ProcessEnv = process.env): boolean {
  return env[DAEMON_ENV_FLAG] === "1";
}

function spawnDaemonProcess(input: SpawnDaemonInput): ChildProcess {
  const entrypoint = fileURLToPath(new URL("./daemon-entrypoint.mjs", import.meta.url));
  return spawn(process.execPath, [entrypoint], {
    detached: true,
    stdio: "ignore",
    env: {
      ...input.env,
      [DAEMON_ENV_FLAG]: "1",
      AGENT_WORKBENCH_DAEMON_REPO_ROOT: input.repoRoot,
      AGENT_WORKBENCH_DAEMON_DEBUG_REPO_ROOT_OVERRIDE: input.debugRepoRootOverride ? "1" : "0",
      AGENT_WORKBENCH_DAEMON_METADATA_PATH: input.metadataPath,
      AGENT_WORKBENCH_DAEMON_SOCKET_PATH: input.socketPath,
      [DAEMON_LAUNCH_TOKEN_ENV]: input.launchToken
    }
  });
}

async function acceptDaemonClient(input: {
  socket: Socket;
  identity: AgentWorkbenchDaemonIdentity;
  repoRoot: string;
  debugRepoRootOverride: boolean;
  serverOptions?: AgentWorkbenchServerOptions;
  sharedRepositoryServices: AgentWorkbenchSharedRepositoryServices;
  daemonDiagnostics: () => AgentWorkbenchDaemonHealthFacts;
  mcpServers: Set<{ close: () => Promise<void> }>;
}): Promise<void> {
  try {
    const { handshake, remainder } = await readHandshake(input.socket);
    if (!validHandshake(handshake, input.identity)) {
      input.socket.destroy();
      return;
    }
    const mcpServer = createAgentWorkbenchServer(input.repoRoot, {
      ...input.serverOptions,
      integrationIdentity: handshake.integrationIdentity,
      sharedRepositoryServices: input.sharedRepositoryServices,
      daemonDiagnostics: input.daemonDiagnostics,
      rootAuthorityPolicy: createRootAuthorityPolicy({
        launchRoot: input.repoRoot,
        debugRepoRootOverride: input.debugRepoRootOverride
      })
    });
    input.mcpServers.add(mcpServer);
    input.socket.once("close", () => {
      input.mcpServers.delete(mcpServer);
      void mcpServer.close();
    });
    await mcpServer.connect(new SocketServerTransport(input.socket, remainder));
  } catch (error) {
    input.socket.destroy();
  }
}

function readHandshake(socket: Socket): Promise<{ handshake: unknown; remainder: Buffer }> {
  return new Promise((resolve, reject) => {
    let buffer = Buffer.alloc(0);
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error("Timed out waiting for Agent Workbench daemon handshake."));
    }, DEFAULT_DAEMON_HANDSHAKE_TIMEOUT_MS);

    const cleanup = (): void => {
      clearTimeout(timeout);
      socket.off("data", onData);
      socket.off("error", onError);
      socket.off("close", onClose);
    };
    const onError = (error: Error): void => {
      cleanup();
      reject(error);
    };
    const onClose = (): void => {
      cleanup();
      reject(new Error("Socket closed before Agent Workbench daemon handshake."));
    };
    const onData = (chunk: Buffer): void => {
      buffer = Buffer.concat([buffer, chunk]);
      const newlineIndex = buffer.indexOf(0x0a);
      if (newlineIndex < 0) {
        return;
      }
      const line = buffer.subarray(0, newlineIndex).toString("utf8");
      const remainder = buffer.subarray(newlineIndex + 1);
      cleanup();
      try {
        resolve({
          handshake: JSON.parse(line),
          remainder
        });
      } catch (error) {
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    };

    socket.on("data", onData);
    socket.once("error", onError);
    socket.once("close", onClose);
  });
}

async function waitForDaemonConnection(input: {
  identity: AgentWorkbenchDaemonIdentity;
  integrationIdentity?: IntegrationLauncherIdentity;
  socketPath: string;
  metadataPath?: string;
  startupLockPath?: string;
  timeoutMs: number;
  handshakeTimeoutMs: number;
  deadlineMs?: number;
  retryStartup?: () => Promise<Socket>;
}): Promise<Socket> {
  const deadlineMs = input.deadlineMs ?? (performance.now() + input.timeoutMs);
  let lastError: unknown = new Error("Daemon socket is listening but repository services are not ready.");
  let observedReady = false;
  let pendingSocket: Socket | undefined;
  while (performance.now() <= deadlineMs) {
    let readyForHandshake = input.metadataPath === undefined;
    if (input.metadataPath !== undefined) {
      const metadata = readDaemonMetadata(input.metadataPath);
      if (metadata !== undefined && metadata !== "malformed") {
        const lifecycle = metadata.launchLifecycle;
        if (lifecycle !== undefined && lifecycle.state === "failed") {
          pendingSocket?.destroy();
          throw startupFailureFromMetadata(metadata);
        }
        if (resolveLifecycleState(lifecycle) === "ready") {
          observedReady = true;
          readyForHandshake = true;
        }
        const state = classifyDaemonState({
          metadataPath: input.metadataPath,
          expectedIdentity: input.identity,
          socketPath: input.socketPath
        });
        if (
          input.retryStartup !== undefined &&
          state.state === "stale"
        ) {
          pendingSocket?.destroy();
          return input.retryStartup();
        }
      } else if (
        metadata === undefined &&
        input.retryStartup !== undefined &&
        (
          observedReady ||
          (
            input.startupLockPath !== undefined &&
            fs.existsSync(input.startupLockPath) &&
            daemonStartupLockIsStale(input.startupLockPath) === true
          )
        )
      ) {
        pendingSocket?.destroy();
        return input.retryStartup();
      }
    }

    if (pendingSocket?.destroyed === true) {
      pendingSocket = undefined;
    }
    if (pendingSocket === undefined) {
      try {
        pendingSocket = await connectSocket(input.socketPath, input.handshakeTimeoutMs);
      } catch (error) {
        lastError = error;
      }
    }
    if (pendingSocket !== undefined && readyForHandshake) {
      pendingSocket.write(`${JSON.stringify({
        protocol: "agent-workbench-daemon",
        protocolVersion: DAEMON_PROTOCOL_VERSION,
        identity: input.identity,
        integrationIdentity: input.integrationIdentity
      } satisfies DaemonHandshake)}\n`);
      return pendingSocket;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  pendingSocket?.destroy();
  throw new Error(`Timed out connecting to Agent Workbench daemon: ${String(lastError)}`);
}

function startupFailureFromMetadata(metadata: AgentWorkbenchDaemonMetadata): Error {
  const failureCode = metadata.launchLifecycle?.failureCode;
  const message = failureCode === undefined
    ? "Agent Workbench daemon startup failed."
    : `Agent Workbench daemon startup failed with code: ${failureCode}.`;
  return new Error(message);
}

export function createDaemonMetadata(input: {
  identity: AgentWorkbenchDaemonIdentity;
  pid: number;
  socketPath: string;
  launchToken: string;
  launchStartedAt: string;
  createdAt: string;
  updatedAt: string;
  phase: "launching" | "ready" | "terminal";
  failureCode?: DaemonStartupFailureCode;
}): LifecycleDaemonMetadata {
  return {
    identity: input.identity,
    pid: input.pid,
    socketPath: input.socketPath,
    createdAt: input.createdAt,
    launchLifecycle: {
      state: input.failureCode === undefined ? "starting" : "failed",
      phase: input.phase,
      launchToken: input.launchToken,
      startedAt: input.launchStartedAt,
      updatedAt: input.updatedAt,
      failureCode: input.failureCode
    }
  };
}

export function formatChildExitFailure(code: number | null, signal: NodeJS.Signals | null): Error {
  if (code === 0) {
    return new Error("daemon-child-exit-0");
  }
  const reason = code === null ? signal ?? "unknown" : `code-${code}`;
  return new Error(`daemon-child-exit-${reason}`);
}

function connectSocket(socketPath: string, timeoutMs: number): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection(socketPath);
    const timeout = setTimeout(() => {
      socket.destroy();
      reject(new Error("Timed out opening Agent Workbench daemon socket."));
    }, timeoutMs);
    socket.once("connect", () => {
      clearTimeout(timeout);
      resolve(socket);
    });
    socket.once("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
  });
}

function readDaemonMetadata(metadataPath: string): AgentWorkbenchDaemonMetadata | "malformed" | undefined {
  let parsed: unknown;
  try {
    parsed = JSON.parse(fs.readFileSync(metadataPath, "utf8"));
  } catch (error) {
    if (isMissingFileError(error)) {
      return undefined;
    }
    return "malformed";
  }
  if (!isDaemonMetadata(parsed)) {
    return "malformed";
  }
  return parsed;
}

function writeDaemonMetadata(metadataPath: string, metadata: AgentWorkbenchDaemonMetadata): void {
  fs.mkdirSync(path.dirname(metadataPath), { recursive: true });
  const serialized = `${JSON.stringify(metadata, null, 2)}\n`;
  const tempPath = `${metadataPath}.${process.pid}.${Date.now()}.${crypto.randomUUID()}.tmp`;
  let fd: number | undefined;
  let fdClosed = false;
  try {
    fd = fs.openSync(tempPath, "w", 0o600);
    fs.writeFileSync(fd, serialized);
    fs.fsyncSync(fd);
    fs.closeSync(fd);
    fdClosed = true;
    fs.renameSync(tempPath, metadataPath);
    fsyncDirectory(path.dirname(metadataPath));
  } finally {
    if (!fdClosed && fd !== undefined) {
      try { fs.closeSync(fd); } catch {}
    }
    fs.rmSync(tempPath, { force: true });
  }
}

function fsyncDirectory(directoryPath: string): void {
  let directoryFd: number | undefined;
  try {
    directoryFd = fs.openSync(directoryPath, "r");
    fs.fsyncSync(directoryFd);
  } catch {
    // Optional durability hint for filesystem visibility in tests and non-windows
    // environments; this path is best-effort and intentionally ignored when
    // unavailable.
  } finally {
    if (directoryFd !== undefined) {
      try { fs.closeSync(directoryFd); } catch {}
    }
  }
}

function cleanupStaleDaemonState(metadata: AgentWorkbenchDaemonMetadata | undefined, paths: DaemonPaths): void {
  if (metadata !== undefined) {
    const current = readDaemonMetadata(paths.metadataPath);
    if (
      current !== undefined &&
      (
        current === "malformed" ||
        !sameDaemonLaunch(current, metadata)
      )
    ) {
      return;
    }
  }
  removeCanonicalFile(paths.metadataPath);
  if (process.platform !== "win32") {
    removeCanonicalFile(paths.socketPath);
    try {
      fs.rmdirSync(paths.ipcDir);
    } catch {
      // The private IPC directory may contain a freshly started daemon socket or
      // be absent already; the socket unlink above is the required cleanup.
    }
  }
}

function sameDaemonLaunch(
  current: AgentWorkbenchDaemonMetadata,
  expected: AgentWorkbenchDaemonMetadata
): boolean {
  const currentToken = current.launchLifecycle?.launchToken;
  const expectedToken = expected.launchLifecycle?.launchToken;
  if (currentToken !== undefined || expectedToken !== undefined) {
    return currentToken !== undefined && currentToken === expectedToken;
  }
  return (
    current.pid === expected.pid &&
    current.createdAt === expected.createdAt &&
    current.socketPath === expected.socketPath &&
    daemonIdentityMatches(current.identity, expected.identity)
  );
}

function removeCanonicalFile(filePath: string): void {
  try {
    const stat = fs.lstatSync(filePath);
    if (stat.isFile() || stat.isSocket()) fs.rmSync(filePath);
  } catch (error) {
    if (!isMissingFileError(error)) throw error;
  }
}

function normalizeLaunchState(state: DaemonState, paths: DaemonPaths): DaemonState {
  if (state.state !== "stale") {
    return state;
  }
  cleanupStaleDaemonState(state.metadata, paths);
  return { state: "absent", reason: "missing" };
}

function ensureDaemonDirectories(paths: DaemonPaths): void {
  ensurePrivateDirectory(paths.metadataDir);
  if (process.platform !== "win32") {
    ensurePrivateDirectory(paths.ipcDir);
  }
}

function ensurePrivateDirectory(directory: string): void {
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  if (process.platform !== "win32") {
    fs.chmodSync(directory, 0o700);
  }
}

function acquireDaemonStartupLock(
  lockPath: string
): { release: () => void } | "ambiguous" | null {
  try {
    return createDaemonStartupLock(lockPath);
  } catch (error) {
    if (!isFileExistsError(error)) {
      throw error;
    }
  }

  const stale = daemonStartupLockIsStale(lockPath);
  if (stale === "ambiguous") {
    return "ambiguous";
  }
  if (!stale) {
    return null;
  }

  try {
    fs.rmSync(lockPath, { force: true });
    return createDaemonStartupLock(lockPath);
  } catch (error) {
    if (isFileExistsError(error)) {
      return null;
    }
    throw error;
  }
}

type DaemonStartupLockPayload = {
  pid: number;
  created_at: string;
  token: string;
};

export function createDaemonStartupLock(
  lockPath: string,
  hooks: {
    before_claim?: () => void;
    persist_candidate?: (fd: number, serialized: string) => void;
  } = {}
): { release: () => void } {
  const token = crypto.randomUUID();
  const candidatePath = `${lockPath}.${process.pid}.${token}.candidate`;
  const payload: DaemonStartupLockPayload = {
    pid: process.pid,
    created_at: new Date().toISOString(),
    token
  };
  let released = false;
  let fd: number | undefined;
  let claimedStat: fs.Stats;
  try {
    fd = fs.openSync(candidatePath, "wx", 0o600);
    const serialized = `${JSON.stringify(payload)}\n`;
    if (hooks.persist_candidate !== undefined) {
      hooks.persist_candidate(fd, serialized);
    } else {
      fs.writeFileSync(fd, serialized);
      fs.fsyncSync(fd);
    }
    fs.closeSync(fd);
    fd = undefined;
    hooks.before_claim?.();
    fs.linkSync(candidatePath, lockPath);
    claimedStat = fs.statSync(candidatePath);
  } finally {
    if (fd !== undefined) {
      try { fs.closeSync(fd); } catch {}
    }
    fs.rmSync(candidatePath, { force: true });
  }

  return {
    release() {
      if (released) {
        return;
      }
      released = true;
      try {
        const currentStat = fs.statSync(lockPath);
        if (currentStat.dev !== claimedStat.dev || currentStat.ino !== claimedStat.ino) return;
        const current = readDaemonStartupLockPayload(lockPath);
        if (current !== undefined && (current.token !== token || current.pid !== process.pid)) return;
        fs.rmSync(lockPath);
      } catch (error) {
        if (!isMissingFileError(error)) throw error;
      }
    }
  };
}

function daemonStartupLockIsStale(lockPath: string): boolean | "ambiguous" {
  const payload = readDaemonStartupLockPayload(lockPath);
  if (payload === undefined) return "ambiguous";

  const processState = isProcessAlive(payload.pid);
  return processState === "ambiguous" ? "ambiguous" : processState === false;
}

function readDaemonStartupLockPayload(lockPath: string): DaemonStartupLockPayload | undefined {
  try {
    const payload = JSON.parse(fs.readFileSync(lockPath, "utf8")) as unknown;
    if (typeof payload !== "object" || payload === null) return undefined;
    const value = payload as Partial<DaemonStartupLockPayload>;
    if (
      typeof value.pid !== "number" ||
      !Number.isInteger(value.pid) ||
      value.pid <= 0 ||
      typeof value.created_at !== "string" ||
      !Number.isFinite(Date.parse(value.created_at)) ||
      typeof value.token !== "string" ||
      value.token.length === 0
    ) return undefined;
    return value as DaemonStartupLockPayload;
  } catch {
    return undefined;
  }
}

function isFileExistsError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "EEXIST"
  );
}

function resolveLifecycleState(lifecycle: AgentWorkbenchDaemonMetadata["launchLifecycle"] | undefined): "ready" | "starting" | "failed" {
  if (lifecycle === undefined) {
    return "ready";
  }
  if (lifecycle.state === "failed" || lifecycle.state === "starting") {
    return lifecycle.state;
  }
  return lifecycle.state;
}

function isProcessAlive(pid: number): boolean | "ambiguous" {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    const code =
      typeof error === "object" && error !== null && "code" in error
        ? (error as { code?: unknown }).code
        : undefined;
    if (code === "ESRCH") {
      return false;
    }
    return "ambiguous";
  }
}

function defaultSocketExists(socketPath: string): boolean {
  return process.platform === "win32" || fs.existsSync(socketPath);
}

function daemonIdentityMatches(
  actual: AgentWorkbenchDaemonIdentity,
  expected: AgentWorkbenchDaemonIdentity
): boolean {
  return (
    actual.repoRoot === expected.repoRoot &&
    actual.runtimeVersion === expected.runtimeVersion &&
    actual.schemaVersion === expected.schemaVersion &&
    actual.protocolVersion === expected.protocolVersion &&
    actual.id === expected.id
  );
}

function validHandshake(
  handshake: unknown,
  identity: AgentWorkbenchDaemonIdentity
): handshake is DaemonHandshake {
  return (
    typeof handshake === "object" &&
    handshake !== null &&
    (handshake as { protocol?: unknown }).protocol === "agent-workbench-daemon" &&
    (handshake as { protocolVersion?: unknown }).protocolVersion === DAEMON_PROTOCOL_VERSION &&
    "identity" in handshake &&
    typeof (handshake as { identity?: unknown }).identity === "object" &&
    (handshake as { identity: AgentWorkbenchDaemonIdentity }).identity !== null &&
    daemonIdentityMatches((handshake as { identity: AgentWorkbenchDaemonIdentity }).identity, identity) &&
    validIntegrationIdentity((handshake as { integrationIdentity?: unknown }).integrationIdentity)
  );
}

function validIntegrationIdentity(value: unknown): value is IntegrationLauncherIdentity | undefined {
  if (value === undefined) {
    return true;
  }
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const identity = value as Record<string, unknown>;
  const keys = Object.keys(identity);
  if (keys.some((key) => ![
    "provider",
    "plugin_name",
    "plugin_version",
    "cache_name",
    "cache_version"
  ].includes(key))) {
    return false;
  }
  if (![
    "codex",
    "claude_code",
    "kiro",
    "unknown"
  ].includes(String(identity.provider))) {
    return false;
  }
  return validOptionalIdentityField(identity.plugin_name, 200) &&
    validOptionalIdentityField(identity.plugin_version, 100) &&
    validOptionalIdentityField(identity.cache_name, 200) &&
    validOptionalIdentityField(identity.cache_version, 100);
}

function validOptionalIdentityField(field: unknown, maxLength: number): boolean {
  return field === undefined || (
    typeof field === "string" &&
    field.trim() === field &&
    field.length > 0 &&
    field.length <= maxLength
  );
}

function isDaemonMetadata(value: unknown): value is AgentWorkbenchDaemonMetadata {
  const metadata = value as AgentWorkbenchDaemonMetadata;
  return (
    typeof value === "object" &&
    value !== null &&
    isDaemonIdentity(metadata.identity) &&
    typeof metadata.pid === "number" &&
    Number.isInteger(metadata.pid) &&
    metadata.pid > 0 &&
    typeof metadata.socketPath === "string" &&
    typeof metadata.createdAt === "string" &&
    (metadata.launchLifecycle === undefined || isDaemonLifecycle(metadata.launchLifecycle))
  );
}

function isDaemonLifecycle(
  value: unknown
): value is AgentWorkbenchDaemonMetadata["launchLifecycle"] {
  const lifecycle = value as AgentWorkbenchDaemonMetadata["launchLifecycle"];
  if (typeof lifecycle !== "object" || lifecycle === null) {
    return false;
  }
  if (
    typeof lifecycle.launchToken !== "string" ||
    lifecycle.launchToken.length === 0 ||
    typeof lifecycle.startedAt !== "string" ||
    !Number.isFinite(Date.parse(lifecycle.startedAt)) ||
    typeof lifecycle.updatedAt !== "string" ||
    !Number.isFinite(Date.parse(lifecycle.updatedAt))
  ) {
    return false;
  }
  if (lifecycle.state === "starting") {
    return lifecycle.phase === "launching" && lifecycle.failureCode === undefined;
  }
  if (lifecycle.state === "ready") {
    return lifecycle.phase === "ready" && lifecycle.failureCode === undefined;
  }
  if (lifecycle.state === "failed") {
    return lifecycle.phase === "terminal" && isValidDaemonStartupFailureCode(lifecycle.failureCode);
  }
  return false;
}

function isValidDaemonStartupFailureCode(value: unknown): value is DaemonStartupFailureCode {
  return (
    value === "child_error" ||
    value === "child_exit" ||
    value === "bootstrap_failed" ||
    value === "listen_failed" ||
    value === "metadata_write_failed"
  );
}

function isDaemonIdentity(value: unknown): value is AgentWorkbenchDaemonIdentity {
  const identity = value as AgentWorkbenchDaemonIdentity;
  return (
    typeof value === "object" &&
    value !== null &&
    typeof identity.repoRoot === "string" &&
    typeof identity.runtimeVersion === "string" &&
    typeof identity.schemaVersion === "number" &&
    typeof identity.protocolVersion === "number" &&
    typeof identity.id === "string"
  );
}

function isMissingFileError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "ENOENT"
  );
}

function userRuntimeId(): string {
  const getuid = process.getuid?.();
  if (typeof getuid === "number") {
    return String(getuid);
  }
  try {
    return stableHash(os.userInfo().username).slice(0, 12);
  } catch {
    return "unknown";
  }
}

function readIdleGraceMs(env: NodeJS.ProcessEnv): number {
  const raw = env[DAEMON_IDLE_GRACE_ENV];
  if (raw === undefined) {
    return DEFAULT_DAEMON_IDLE_GRACE_MS;
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : DEFAULT_DAEMON_IDLE_GRACE_MS;
}

export function daemonStartupRefreshDelayMsFromEnv(env: NodeJS.ProcessEnv): number {
  const raw = env[DAEMON_STARTUP_REFRESH_DELAY_ENV];
  if (raw === undefined) return DEFAULT_DAEMON_STARTUP_REFRESH_DELAY_MS;
  if (!/^\d+$/u.test(raw)) {
    throw new Error(`${DAEMON_STARTUP_REFRESH_DELAY_ENV} must be a nonnegative integer.`);
  }
  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed)) {
    throw new Error(`${DAEMON_STARTUP_REFRESH_DELAY_ENV} must be a nonnegative safe integer.`);
  }
  return parsed;
}

function stableHash(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}
