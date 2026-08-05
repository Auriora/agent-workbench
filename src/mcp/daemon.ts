/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import fs from "node:fs";
import net, { type Server, type Socket } from "node:net";
import path from "node:path";
import { createRootAuthorityPolicy } from "../interface-adapters/mcp/registries/root-authority.js";
import type { IntegrationLauncherIdentity } from "../contracts/index.js";
import { GRAPH_STORE_IDENTITY_VERSION } from "../contracts/graph-store-identity-contracts.js";
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
  LazyOwnershipGatedRefreshAuthority,
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
import {
  acquireDaemonStartupLock,
  classifyDaemonState,
  cleanupStaleDaemonState,
  createDaemonIdentity,
  createDaemonMetadata,
  daemonIdentityMatches,
  daemonPaths,
  daemonStartupRefreshDelayMsFromEnv,
  ensureDaemonDirectories,
  fsyncDirectory,
  isDaemonProcess,
  readDaemonMetadata,
  removeCanonicalFile,
  writeDaemonMetadata,
  DAEMON_LAUNCH_TOKEN_ENV,
  DAEMON_METADATA_PATH_ENV,
  DAEMON_PROTOCOL_VERSION,
  DAEMON_SOCKET_PATH_ENV,
  DEFAULT_DAEMON_HANDSHAKE_TIMEOUT_MS,
  type AgentWorkbenchDaemonIdentity,
  type AgentWorkbenchDaemonMetadata,
  type DaemonHandshake,
  type DaemonStartupFailureCode,
  type LifecycleDaemonMetadata
} from "./daemon-client.js";

const DAEMON_SIGTERM_GRACE_MS = 1_000;

export * from "./daemon-client.js";

const DEFAULT_DAEMON_PENDING_CLIENT_TIMEOUT_MS = 30_000;
const MAX_PENDING_DAEMON_CLIENTS = 64;
const DEFAULT_DAEMON_IDLE_GRACE_MS = 30_000;
const DEFAULT_DAEMON_STARTUP_REFRESH_DELAY_MS = 1000;
const DAEMON_IDLE_GRACE_ENV = "AGENT_WORKBENCH_DAEMON_IDLE_GRACE_MS";

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


type DaemonTestHooks = {
  /**
   * Deterministic test seam for holding or failing heavyweight repository
   * bootstrap after the daemon socket is listening.
   */
  awaitBootstrap?: Promise<void>;
};

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
  let refreshController: SnapshotRefreshControllerPort &
    SnapshotRefreshDiagnosticsPort & SnapshotRefreshAdmissionFailurePort;
  let refreshAuthority: LazyOwnershipGatedRefreshAuthority | undefined;
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
    await refreshAuthority?.close().catch(() => undefined);
    if (refreshAuthority === undefined && refreshController !== undefined) {
      await waitForControllerShutdownSafety(refreshController).catch(() => undefined);
    }
    lifetime?.dispose();
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

  const existingState = classifyDaemonState({
    metadataPath: paths.metadataPath,
    expectedIdentity: identity,
    socketPath: paths.socketPath
  });
  const ownStartingReceipt = existingState.state === "blocked" &&
    existingState.reason === "starting" &&
    existingState.metadata?.pid === process.pid &&
    existingState.metadata?.launchLifecycle?.launchToken === launchToken;
  if (existingState.state === "ready") {
    throw new Error("Agent Workbench daemon is already running for this runtime identity.");
  }
  if (existingState.state === "mismatched") {
    throw new Error(`Agent Workbench daemon is blocked: ${existingState.reason}.`);
  }
  if (existingState.state === "blocked" && !ownStartingReceipt) {
    throw new Error(`Agent Workbench daemon is blocked: ${existingState.reason}.`);
  }

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
    refreshController = await createRepositoryRefreshController({
      repoRoot,
      graphStore: sharedGraphStore,
      databasePath,
      controllerGeneration: ownerGeneration,
      maxFiles: input.serverOptions?.startupWarmupMaxFiles ?? 2000
    });
    let recoveredSnapshotIds: readonly string[] = [];
    let recoveryLease: (RepositoryOwnershipLease & { state: "active" }) | undefined;
    refreshAuthority = new LazyOwnershipGatedRefreshAuthority({
      ownership,
      ownership_request: {
        repo_root: repoRoot,
        runtime_identity: `${AGENT_WORKBENCH_RUNTIME_VERSION}:${GRAPH_STORE_IDENTITY_VERSION}`,
        schema_version: GRAPH_STORE_IDENTITY_VERSION,
        owner_id: `daemon:${process.pid}:${ownerGeneration}`,
        owner_pid: process.pid,
        owner_generation: ownerGeneration,
        heartbeat_at: new Date().toISOString()
      },
      prepare_controller: async (admission) => {
        const orphanReconciliation = await store.reconcileOrphanedBuilds({
          repo_root: repoRoot,
          current_owner: admission.lease,
          recovered_owners: admission.recovered_owners,
          updated_at: new Date().toISOString()
        });
        recoveredSnapshotIds = orphanReconciliation.outcome === "reconciled"
          ? orphanReconciliation.snapshot_ids
          : [];
        recoveryLease = orphanReconciliation.outcome === "reconciled"
          ? admission.lease
          : undefined;
        return orphanReconciliation.outcome === "blocked"
          ? "ownership_ambiguous"
          : "ready";
      },
      create_controller: async () => {
        if (recoveredSnapshotIds[0] !== undefined) {
          await refreshController.recordAdmissionFailure({
            repo_root: repoRoot,
            invalidation_generation: 0,
            code: "orphaned_build",
            target_snapshot_id: recoveredSnapshotIds[0]
          });
        }
        if (recoveryLease !== undefined) {
          await ownership.confirmRecovery({ lease: recoveryLease });
        }
        return refreshController;
      }
    });
    const refreshPreparation = await refreshAuthority.prepare();
    if (
      refreshPreparation.outcome === "blocked" &&
      refreshPreparation.reason === "ownership_ambiguous"
    ) {
      throw new Error("Repository refresh ownership is ambiguous.");
    }

    const refreshTriggers = new RepositoryRefreshTriggerCoordinator({
      repo_root: repoRoot,
      controller: refreshAuthority,
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
      refreshController: refreshAuthority,
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
      controller: refreshAuthority,
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
      await refreshAuthority?.close();
      if (refreshAuthority === undefined && refreshController !== undefined) {
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
    const daemon = await startAgentWorkbenchDaemon({
      repoRoot,
      debugRepoRootOverride: env.AGENT_WORKBENCH_DAEMON_DEBUG_REPO_ROOT_OVERRIDE === "1",
      idleGraceMs: readIdleGraceMs(env),
      launchToken,
      launchStartedAt,
      serverOptions: {
        startupRefreshDelayMs: daemonStartupRefreshDelayMsFromEnv(env)
      }
    });
    if (isDaemonProcess(env)) {
      let shuttingDown = false;
      process.once("SIGTERM", () => {
        if (shuttingDown) {
          return;
        }
        shuttingDown = true;
        void closeDaemonForTermination(daemon)
          .then((clean) => process.exit(clean ? 0 : 1));
      });
    }
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

async function closeDaemonForTermination(
  daemon: Pick<StartedAgentWorkbenchDaemon, "close">
): Promise<boolean> {
  let timeout: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      daemon.close().then(() => true, () => false),
      new Promise<false>((resolve) => {
        timeout = setTimeout(() => resolve(false), DAEMON_SIGTERM_GRACE_MS);
        timeout.unref();
      })
    ]);
  } finally {
    if (timeout !== undefined) {
      clearTimeout(timeout);
    }
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

function readIdleGraceMs(env: NodeJS.ProcessEnv): number {
  const raw = env[DAEMON_IDLE_GRACE_ENV];
  if (raw === undefined) {
    return DEFAULT_DAEMON_IDLE_GRACE_MS;
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : DEFAULT_DAEMON_IDLE_GRACE_MS;
}
