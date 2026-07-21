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
  SnapshotRefreshDiagnosticsPort
} from "../ports/index.js";

export const DAEMON_PROTOCOL_VERSION = 1;
const DAEMON_METADATA_FILE = "daemon.json";
const DAEMON_STARTUP_LOCK_FILE = "startup.lock";
const DEFAULT_DAEMON_START_TIMEOUT_MS = 4000;
const DEFAULT_DAEMON_HANDSHAKE_TIMEOUT_MS = 1000;
const DEFAULT_DAEMON_IDLE_GRACE_MS = 30_000;
const DEFAULT_DAEMON_STARTUP_REFRESH_DELAY_MS = 1000;
const DAEMON_ENV_FLAG = "AGENT_WORKBENCH_DAEMON_PROCESS";
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
};

export type DaemonState =
  | { state: "absent"; reason: "missing" }
  | { state: "stale"; reason: "malformed_metadata" | "dead_process" | "missing_socket" | "identity_mismatch"; metadata?: AgentWorkbenchDaemonMetadata }
  | { state: "mismatched"; reason: "identity_mismatch"; metadata: AgentWorkbenchDaemonMetadata }
  | { state: "blocked"; reason: "ambiguous_process" | "ambiguous_metadata"; metadata?: AgentWorkbenchDaemonMetadata }
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
  let startupLock: { release: () => void } | null = null;

  try {
    let state = classifyDaemonState({
      metadataPath: paths.metadataPath,
      expectedIdentity: identity,
      socketPath: paths.socketPath
    });

    if (state.state === "blocked") {
      throw new Error(`Agent Workbench daemon is ${state.state}: ${state.reason}.`);
    }

    if (state.state === "absent" || state.state === "stale" || state.state === "mismatched") {
      const startupLockAdmission = acquireDaemonStartupLock(paths.startupLockPath);
      if (startupLockAdmission === "ambiguous") {
        throw new Error("Agent Workbench daemon is blocked: ambiguous startup ownership.");
      }
      startupLock = startupLockAdmission;
      if (startupLock !== null) {
        state = normalizeLaunchState(classifyDaemonState({
          metadataPath: paths.metadataPath,
          expectedIdentity: identity,
          socketPath: paths.socketPath
        }), paths);
        if (state.state === "blocked") {
          throw new Error(`Agent Workbench daemon is ${state.state}: ${state.reason}.`);
        }
        if (state.state === "absent") {
          spawnDaemon({
            repoRoot,
            debugRepoRootOverride: options.debugRepoRootOverride,
            metadataPath: paths.metadataPath,
            socketPath: paths.socketPath,
            env
          }).unref();
        }
      }
    }

    return await waitForDaemonConnection({
      identity,
      integrationIdentity: options.integrationIdentity,
      socketPath: paths.socketPath,
      timeoutMs: options.startTimeoutMs ?? DEFAULT_DAEMON_START_TIMEOUT_MS,
      handshakeTimeoutMs: options.handshakeTimeoutMs ?? DEFAULT_DAEMON_HANDSHAKE_TIMEOUT_MS
    });
  } finally {
    startupLock?.release();
  }
}

export async function startAgentWorkbenchDaemon(input: {
  repoRoot: string;
  debugRepoRootOverride?: boolean;
  idleGraceMs?: number;
  serverOptions?: AgentWorkbenchServerOptions;
}): Promise<StartedAgentWorkbenchDaemon> {
  const repoRoot = path.resolve(input.repoRoot);
  const identity = createDaemonIdentity(repoRoot);
  const paths = daemonPaths(identity);
  ensureDaemonDirectories(paths);

  const metadata: AgentWorkbenchDaemonMetadata = {
    identity,
    pid: process.pid,
    socketPath: paths.socketPath,
    createdAt: new Date().toISOString()
  };
  const connected = new Set<Socket>();
  const mcpServers = new Set<{ close: () => Promise<void> }>();
  const databasePath = graphStorePath(repoRoot);
  const sharedGraphStore = createAsyncGraphStore(databasePath);
  const ownerGeneration = Date.now();
  const ownership = new FileRepositoryOwnershipAdapter(repositoryOwnershipPath(databasePath));
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
  const ownershipLease = ownershipAdmission.lease;
  let refreshController: SnapshotRefreshControllerPort &
    SnapshotRefreshDiagnosticsPort & SnapshotRefreshAdmissionFailurePort;
  try {
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
  } catch (error) {
    await ownership.release({ lease: ownershipLease });
    await sharedGraphStore.close();
    throw error;
  }
  const sharedDisposers = new Set<() => void | Promise<void>>();
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
  const sharedRepositoryServices: AgentWorkbenchSharedRepositoryServices = {
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
  let closePromise: Promise<void> | undefined;
  const lifetime = new DaemonRefreshLifetimeCoordinator({
    controller: refreshController,
    connected_clients: () => connected.size,
    idle_grace_ms: input.idleGraceMs ?? readIdleGraceMs(process.env),
    close
  });

  const server = net.createServer((socket) => {
    lifetime.clientConnected();
    connected.add(socket);
    socket.once("close", () => {
      connected.delete(socket);
      lifetime.clientDisconnected();
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
  });
  let startupRefreshPromise: Promise<void> | undefined;
  const startupTimer = setTimeout(() => {
    startupRefreshPromise = refreshTriggers.startup({ source: "daemon-startup" })
      .then(() => undefined, () => undefined);
  }, input.serverOptions?.startupRefreshDelayMs ?? DEFAULT_DAEMON_STARTUP_REFRESH_DELAY_MS);
  startupTimer.unref?.();

  if (process.platform !== "win32") {
    fs.rmSync(paths.socketPath, { force: true });
  }

  try {
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(paths.socketPath, () => {
        server.off("error", reject);
        try {
          writeDaemonMetadata(paths.metadataPath, metadata);
          resolve();
        } catch (error) {
          reject(error);
        }
      });
    });
  } catch (error) {
    clearTimeout(startupTimer);
    await Promise.allSettled([...sharedDisposers].map((dispose) => Promise.resolve(dispose())));
    if (server.listening) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    await ownership.release({ lease: ownershipLease });
    await sharedGraphStore.close();
    cleanupStaleDaemonState(undefined, paths);
    throw error;
  }
  lifetime.start();

  function close(): Promise<void> {
    closePromise ??= closeDaemon();
    return closePromise;
  }

  async function closeDaemon(): Promise<void> {
    clearTimeout(startupTimer);
    lifetime.dispose();
    for (const socket of connected) {
      socket.destroy();
    }
    await Promise.allSettled([...mcpServers].map((mcpServer) => mcpServer.close()));
    await Promise.allSettled([...sharedDisposers].map((dispose) => Promise.resolve(dispose())));
    await startupRefreshPromise;
    await waitForControllerShutdownSafety(refreshController);
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await ownership.release({ lease: ownershipLease });
    await sharedGraphStore.close();
    cleanupStaleDaemonState(metadata, paths);
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
  await startAgentWorkbenchDaemon({
    repoRoot,
    debugRepoRootOverride: env.AGENT_WORKBENCH_DAEMON_DEBUG_REPO_ROOT_OVERRIDE === "1",
    idleGraceMs: readIdleGraceMs(env),
    serverOptions: {
      startupRefreshDelayMs: daemonStartupRefreshDelayMsFromEnv(env)
    }
  });
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
      AGENT_WORKBENCH_DAEMON_SOCKET_PATH: input.socketPath
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
  timeoutMs: number;
  handshakeTimeoutMs: number;
}): Promise<Socket> {
  const startedAt = Date.now();
  let lastError: unknown;
  while (Date.now() - startedAt <= input.timeoutMs) {
    try {
      const socket = await connectSocket(input.socketPath, input.handshakeTimeoutMs);
      socket.write(`${JSON.stringify({
        protocol: "agent-workbench-daemon",
        protocolVersion: DAEMON_PROTOCOL_VERSION,
        identity: input.identity,
        integrationIdentity: input.integrationIdentity
      } satisfies DaemonHandshake)}\n`);
      return socket;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }
  throw new Error(`Timed out connecting to Agent Workbench daemon: ${String(lastError)}`);
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
  fs.writeFileSync(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`);
}

function cleanupStaleDaemonState(metadata: AgentWorkbenchDaemonMetadata | undefined, paths: DaemonPaths): void {
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
    typeof metadata.createdAt === "string"
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
