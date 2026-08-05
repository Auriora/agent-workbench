/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { spawn, type ChildProcess } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import net from "node:net";
import type { Socket } from "node:net";
import os from "node:os";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";
import type { IntegrationLauncherIdentity } from "../contracts/index.js";
import { GRAPH_STORE_IDENTITY_VERSION } from "../contracts/graph-store-identity-contracts.js";
import {
  AGENT_WORKBENCH_RUNTIME_BUILD_FINGERPRINT,
  AGENT_WORKBENCH_RUNTIME_VERSION
} from "../runtime/version.js";

export const DAEMON_PROTOCOL_VERSION = 1;
const DAEMON_METADATA_FILE = "daemon.json";
const DAEMON_STARTUP_LOCK_FILE = "startup.lock";
const DEFAULT_DAEMON_START_TIMEOUT_MS = 25_000;
export const DEFAULT_DAEMON_HANDSHAKE_TIMEOUT_MS = 1000;
const DEFAULT_DAEMON_STARTUP_REFRESH_DELAY_MS = 1000;
export const DAEMON_ENV_FLAG = "AGENT_WORKBENCH_DAEMON_PROCESS";
export const DAEMON_LAUNCH_TOKEN_ENV = "AGENT_WORKBENCH_DAEMON_LAUNCH_TOKEN";
export const DAEMON_METADATA_PATH_ENV = "AGENT_WORKBENCH_DAEMON_METADATA_PATH";
export const DAEMON_SOCKET_PATH_ENV = "AGENT_WORKBENCH_DAEMON_SOCKET_PATH";
const DAEMON_STARTUP_REFRESH_DELAY_ENV = "AGENT_WORKBENCH_DAEMON_STARTUP_REFRESH_DELAY_MS";
const DAEMON_STARTUP_STDERR_CAPTURE_LIMIT = 2_048;
const NATIVE_MODULE_REBUILD_HINT = "native_module_rebuild_required" as const;
const NATIVE_MODULE_REBUILD_ERROR_MESSAGE =
  "Agent Workbench daemon startup failed because a native module could not be loaded. " +
  "Run `pnpm rebuild:native` to rebuild tree-sitter and better-sqlite3 for your local environment.";
const NATIVE_MODULE_LOAD_ERROR_PATTERN =
  /\.node\b|ERR_DLOPEN|node-gyp|node_gyp_build|tree-sitter|better-sqlite3|was compiled against|NODE_MODULE_VERSION|invalid ELF|Module did not self-register/i;

export type AgentWorkbenchDaemonIdentity = {
  repoRoot: string;
  runtimeVersion: string;
  buildFingerprint?: string;
  schemaVersion: number;
  protocolVersion: number;
  id: string;
};

type DaemonStartupFailureHint = typeof NATIVE_MODULE_REBUILD_HINT;

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
    native_module_rebuild_required?: true;
  };
};

export type LifecycleDaemonMetadata = AgentWorkbenchDaemonMetadata & {
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
  | { state: "mismatched"; reason: "build_fingerprint_mismatch"; metadata: AgentWorkbenchDaemonMetadata }
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
  signalProcess?: (pid: number, signal: NodeJS.Signals) => void;
};

export type SpawnDaemonInput = {
  repoRoot: string;
  debugRepoRootOverride: boolean;
  metadataPath: string;
  socketPath: string;
  launchToken: string;
  env: NodeJS.ProcessEnv;
};

export type DaemonHandshake = {
  protocol: "agent-workbench-daemon";
  protocolVersion: number;
  identity: AgentWorkbenchDaemonIdentity;
  integrationIdentity?: IntegrationLauncherIdentity;
};

type DaemonHealthEnvelope = {
  data?: {
    daemon?: {
      pid?: unknown;
      socket_path?: unknown;
      repo_root?: unknown;
    };
  };
};

export function isDaemonProcess(env: NodeJS.ProcessEnv = process.env): boolean {
  return env[DAEMON_ENV_FLAG] === "1";
}

export function createDaemonIdentity(repoRoot: string): AgentWorkbenchDaemonIdentity {
  const absoluteRepoRoot = path.resolve(repoRoot);
  const runtimeVersion = AGENT_WORKBENCH_RUNTIME_VERSION;
  const buildFingerprint = AGENT_WORKBENCH_RUNTIME_BUILD_FINGERPRINT;
  const schemaVersion = GRAPH_STORE_IDENTITY_VERSION;
  const protocolVersion = DAEMON_PROTOCOL_VERSION;
  return {
    repoRoot: absoluteRepoRoot,
    runtimeVersion,
    buildFingerprint,
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
    metadataPath: path.join(metadataDir, `${shortHash}-${DAEMON_METADATA_FILE}`),
    startupLockPath: path.join(metadataDir, `${shortHash}-${DAEMON_STARTUP_LOCK_FILE}`)
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
  const identityRelationship = daemonIdentityRelationship(metadata.identity, input.expectedIdentity);
  if (identityRelationship === "base_mismatch") {
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
  if (identityRelationship === "build_fingerprint_mismatch") {
    return { state: "mismatched", reason: "build_fingerprint_mismatch", metadata };
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
  const signalProcess = options.signalProcess ?? ((pid, signal) => {
    process.kill(pid, signal);
  });
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
  let startupFailure: {
    error: Error;
    code: DaemonStartupFailureCode;
    hint?: DaemonStartupFailureHint;
  } | undefined;

  const releaseStartupLock = (): void => {
    if (!startupLockReleased && startupLock !== null && !keepStartupLock) {
      startupLockReleased = true;
      startupLock.release();
      startupLock = null;
    }
  };
  const recordStartupFailure = (
    reasonError: Error,
    failureCode: DaemonStartupFailureCode,
    nativeHint?: DaemonStartupFailureHint
  ): void => {
    if (startupFailure !== undefined) {
      return;
    }
    const startupError = nativeHint === NATIVE_MODULE_REBUILD_HINT
      ? nativeModuleStartupFailure()
      : reasonError;
    startupFailure = { error: startupError, code: failureCode, hint: nativeHint };
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
        failureCode,
        nativeModuleRebuildHint: nativeHint
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
        if (state.state === "mismatched") {
          return await waitForReplaceableDaemonHandoff({
            identity,
            integrationIdentity: options.integrationIdentity,
            paths,
            timeoutMs,
            deadlineMs,
            handshakeTimeoutMs,
            retryStartup
          });
        }
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
      if (state.state === "mismatched") {
        try {
          await verifyReplaceableDaemonOwnership({
            metadata: state.metadata,
            expectedIdentity: identity,
            socketPath: paths.socketPath,
            deadlineMs,
            handshakeTimeoutMs
          });
          signalReplaceableDaemon({
            metadata: state.metadata,
            expectedIdentity: identity,
            socketPath: paths.socketPath,
            signalProcess
          });
        } finally {
          keepStartupLock = false;
          releaseStartupLock();
        }
        return await waitForReplaceableDaemonHandoff({
          identity,
          integrationIdentity: options.integrationIdentity,
          paths,
          timeoutMs,
          deadlineMs,
          handshakeTimeoutMs,
          retryStartup
        });
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
          launchProcess.stderr?.destroy();
          releaseStartupLock();
          throw new Error("Daemon launch did not expose a process identifier.");
        }

        const stderrCapture = captureDaemonStartupStderr(launchProcess);
        let terminalCleanup = () => undefined;
        const terminalPromise = new Promise<never>((_resolve, reject) => {
          let terminalActive = true;
          let terminalSignaled = false;
          const onChildError = (error: Error): void => {
            if (!terminalActive || terminalSignaled || startupFailure !== undefined) {
              return;
            }
            terminalSignaled = true;
            const reason = error instanceof Error ? error : new Error(String(error));
            recordStartupFailure(reason, "child_error", stderrCapture.hint());
            terminalCleanup();
            reject(reason);
          };
          const onChildExit = (code: number | null, signal: NodeJS.Signals | null): void => {
            if (!terminalActive || terminalSignaled || startupFailure !== undefined) {
              return;
            }
            terminalSignaled = true;
            void stderrCapture.drain().then(() => {
              if (!terminalActive || startupFailure !== undefined) {
                return;
              }
              const reason = formatChildExitFailure(code, signal);
              recordStartupFailure(reason, "child_exit", stderrCapture.hint());
              terminalCleanup();
              reject(reason);
            });
          };

          launchProcess.once("error", onChildError);
          launchProcess.once("exit", onChildExit);
          terminalCleanup = () => {
            terminalActive = false;
            launchProcess.off("error", onChildError);
            launchProcess.off("exit", onChildExit);
            stderrCapture.release();
          };
          if (
            typeof launchProcess.exitCode === "number" ||
            launchProcess.signalCode !== null && launchProcess.signalCode !== undefined
          ) {
            onChildExit(launchProcess.exitCode, launchProcess.signalCode);
          }
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
          terminalCleanup();
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

function spawnDaemonProcess(input: SpawnDaemonInput): ChildProcess {
  const entrypoint = fileURLToPath(new URL("./daemon-entrypoint.mjs", import.meta.url));
  return spawn(process.execPath, [entrypoint], {
    detached: true,
    stdio: ["ignore", "ignore", "pipe"],
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

async function waitForReplaceableDaemonHandoff(input: {
  identity: AgentWorkbenchDaemonIdentity;
  integrationIdentity?: IntegrationLauncherIdentity;
  paths: DaemonPaths;
  timeoutMs: number;
  handshakeTimeoutMs: number;
  deadlineMs: number;
  retryStartup: () => Promise<Socket>;
}): Promise<Socket> {
  while (performance.now() <= input.deadlineMs) {
    const state = normalizeLaunchState(classifyDaemonState({
      metadataPath: input.paths.metadataPath,
      expectedIdentity: input.identity,
      socketPath: input.paths.socketPath
    }), input.paths);
    if (state.state === "absent" || state.state === "stale") {
      return input.retryStartup();
    }
    if (state.state === "ready") {
      return waitForDaemonConnection({
        identity: input.identity,
        integrationIdentity: input.integrationIdentity,
        socketPath: input.paths.socketPath,
        metadataPath: input.paths.metadataPath,
        startupLockPath: input.paths.startupLockPath,
        timeoutMs: input.timeoutMs,
        deadlineMs: input.deadlineMs,
        handshakeTimeoutMs: input.handshakeTimeoutMs,
        retryStartup: input.retryStartup
      });
    }
    if (state.state === "mismatched") {
      await new Promise((resolve) => setTimeout(resolve, 50));
      continue;
    }
    if (state.state === "blocked") {
      if (state.reason === "starting") {
        return waitForDaemonConnection({
          identity: input.identity,
          integrationIdentity: input.integrationIdentity,
          socketPath: input.paths.socketPath,
          metadataPath: input.paths.metadataPath,
          startupLockPath: input.paths.startupLockPath,
          timeoutMs: input.timeoutMs,
          deadlineMs: input.deadlineMs,
          handshakeTimeoutMs: input.handshakeTimeoutMs,
          retryStartup: input.retryStartup
        });
      }
      if (state.reason === "failed" && state.metadata !== undefined) {
        throw startupFailureFromMetadata(state.metadata);
      }
      throw new Error(`Agent Workbench daemon is ${state.state}: ${state.reason}.`);
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error("Timed out waiting for Agent Workbench daemon replacement handoff.");
}

async function verifyReplaceableDaemonOwnership(input: {
  metadata: AgentWorkbenchDaemonMetadata;
  expectedIdentity: AgentWorkbenchDaemonIdentity;
  socketPath: string;
  deadlineMs: number;
  handshakeTimeoutMs: number;
}): Promise<void> {
  if (
    !daemonBaseIdentityMatches(input.metadata.identity, input.expectedIdentity) ||
    daemonIdentityMatches(input.metadata.identity, input.expectedIdentity) ||
    input.metadata.socketPath !== input.socketPath
  ) {
    throw new Error("Agent Workbench daemon is blocked: ambiguous_process.");
  }

  const remainingMs = Math.min(
    input.handshakeTimeoutMs,
    Math.max(0, Math.floor(input.deadlineMs - performance.now()))
  );
  if (remainingMs <= 0) {
    throw new Error("Agent Workbench daemon is blocked: ambiguous_process.");
  }

  let socket: Socket | undefined;
  try {
    socket = await connectSocket(input.socketPath, remainingMs);
    const session = createDaemonProbeSession(socket, input.deadlineMs);
    session.notify({
      protocol: "agent-workbench-daemon",
      protocolVersion: DAEMON_PROTOCOL_VERSION,
      identity: input.metadata.identity
    } satisfies DaemonHandshake);
    await session.call({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: {
          name: "agent-workbench-daemon-replacement",
          version: input.expectedIdentity.runtimeVersion
        }
      }
    });
    session.notify({
      jsonrpc: "2.0",
      method: "notifications/initialized",
      params: {}
    });
    const response = await session.call({
      jsonrpc: "2.0",
      id: 2,
      method: "resources/read",
      params: { uri: "integration:///health/agent-workbench" }
    });
    if (!replaceableDaemonHealthMatches(response, input.metadata)) {
      throw new Error("Agent Workbench daemon is blocked: ambiguous_process.");
    }
  } catch {
    throw new Error("Agent Workbench daemon is blocked: ambiguous_process.");
  } finally {
    socket?.destroy();
  }
}

function createDaemonProbeSession(socket: Socket, deadlineMs: number): {
  call(message: { id: number } & Record<string, unknown>): Promise<any>;
  notify(message: Record<string, unknown>): void;
} {
  let stdout = "";
  let closed = false;
  let closeError: Error | undefined;
  const pendingCalls = new Map<number, {
    resolve: (message: any) => void;
    reject: (error: Error) => void;
  }>();

  const rejectPending = (error: Error): void => {
    closed = true;
    closeError = error;
    for (const pending of pendingCalls.values()) {
      pending.reject(error);
    }
    pendingCalls.clear();
  };

  socket.setEncoding("utf8");
  socket.on("data", (chunk: string) => {
    stdout += chunk;
    const lines = stdout.split("\n");
    stdout = lines.pop() ?? "";
    for (const line of lines.filter(Boolean)) {
      let parsed: { id?: number };
      try {
        parsed = JSON.parse(line) as { id?: number };
      } catch {
        rejectPending(new Error("Agent Workbench daemon is blocked: ambiguous_process."));
        socket.destroy();
        return;
      }
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
  socket.once("error", (error) => {
    rejectPending(error instanceof Error ? error : new Error(String(error)));
  });
  socket.once("close", () => {
    rejectPending(closeError ?? new Error("Agent Workbench daemon is blocked: ambiguous_process."));
  });

  return {
    call(message: { id: number } & Record<string, unknown>) {
      if (closed) {
        return Promise.reject(closeError ?? new Error("Agent Workbench daemon is blocked: ambiguous_process."));
      }
      return new Promise((resolve, reject) => {
        const remainingMs = Math.max(0, Math.floor(deadlineMs - performance.now()));
        if (remainingMs <= 0) {
          reject(new Error("Agent Workbench daemon is blocked: ambiguous_process."));
          return;
        }
        const timeout = setTimeout(() => {
          pendingCalls.delete(message.id);
          reject(new Error("Agent Workbench daemon is blocked: ambiguous_process."));
        }, remainingMs);
        pendingCalls.set(message.id, {
          resolve: (response) => {
            clearTimeout(timeout);
            resolve(response);
          },
          reject: (error) => {
            clearTimeout(timeout);
            reject(error);
          }
        });
        socket.write(`${JSON.stringify(message)}\n`);
      });
    },
    notify(message: Record<string, unknown>) {
      if (closed) {
        return;
      }
      socket.write(`${JSON.stringify(message)}\n`);
    }
  };
}

function replaceableDaemonHealthMatches(
  response: unknown,
  metadata: AgentWorkbenchDaemonMetadata
): boolean {
  if (
    typeof response !== "object" ||
    response === null ||
    !("result" in response)
  ) {
    return false;
  }
  const result = (response as { result?: { contents?: Array<{ text?: unknown }> } }).result;
  const text = result?.contents?.[0]?.text;
  if (typeof text !== "string") {
    return false;
  }
  let envelope: DaemonHealthEnvelope;
  try {
    envelope = JSON.parse(text) as DaemonHealthEnvelope;
  } catch {
    return false;
  }
  const daemon = envelope.data?.daemon;
  return daemon?.pid === metadata.pid &&
    daemon.socket_path === metadata.socketPath &&
    daemon.repo_root === metadata.identity.repoRoot;
}

function startupFailureFromMetadata(metadata: AgentWorkbenchDaemonMetadata): Error {
  if (metadata.launchLifecycle?.native_module_rebuild_required === true) {
    return nativeModuleStartupFailure();
  }
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
  nativeModuleRebuildHint?: DaemonStartupFailureHint;
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
      native_module_rebuild_required:
        input.nativeModuleRebuildHint === NATIVE_MODULE_REBUILD_HINT ? true : undefined,
      failureCode: input.failureCode
    }
  };
}

function captureDaemonStartupStderr(daemonProcess: ChildProcess): {
  hint(): DaemonStartupFailureHint | undefined;
  drain(): Promise<void>;
  release(): void;
} {
  const stderr = daemonProcess.stderr;
  if (stderr === undefined || stderr === null || typeof stderr.on !== "function") {
    return {
      hint: () => undefined,
      drain: async () => undefined,
      release: () => undefined
    };
  }

  let captured = "";
  let failureHint: DaemonStartupFailureHint | undefined;
  let streamClosed = stderr.destroyed || stderr.readableEnded;
  let resolveStreamClosed: () => void = () => undefined;
  const streamClosedPromise = new Promise<void>((resolve) => {
    resolveStreamClosed = resolve;
  });
  const captureChunk = (chunk: Buffer | string): void => {
    const text = typeof chunk === "string" ? chunk : chunk.toString();
    const combined = `${captured}${text}`;
    captured = combined.length > DAEMON_STARTUP_STDERR_CAPTURE_LIMIT
      ? combined.slice(combined.length - DAEMON_STARTUP_STDERR_CAPTURE_LIMIT)
      : combined;
    if (
      failureHint === undefined &&
      NATIVE_MODULE_LOAD_ERROR_PATTERN.test(captured)
    ) {
      failureHint = NATIVE_MODULE_REBUILD_HINT;
    }
  };
  const onStderrData = (chunk: Buffer | string): void => {
    captureChunk(chunk);
  };
  const onStderrError = () => {
    /* Ignore stderr stream-level errors during bootstrap. */
  };
  const onStderrClosed = () => {
    streamClosed = true;
    resolveStreamClosed();
  };
  stderr.on("data", onStderrData);
  stderr.on("error", onStderrError);
  stderr.once("end", onStderrClosed);
  stderr.once("close", onStderrClosed);

  return {
    hint: () => failureHint,
    drain: async () => {
      if (streamClosed) {
        return;
      }
      await Promise.race([
        streamClosedPromise,
        new Promise<void>((resolve) => setTimeout(resolve, 100))
      ]);
    },
    release: () => {
      stderr.off("data", onStderrData);
      stderr.off("error", onStderrError);
      stderr.off("end", onStderrClosed);
      stderr.off("close", onStderrClosed);
      stderr.destroy();
    }
  };
}

function nativeModuleStartupFailure(): Error {
  return new Error(NATIVE_MODULE_REBUILD_ERROR_MESSAGE);
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

export function readDaemonMetadata(metadataPath: string): AgentWorkbenchDaemonMetadata | "malformed" | undefined {
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

export function writeDaemonMetadata(metadataPath: string, metadata: AgentWorkbenchDaemonMetadata): void {
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

export function fsyncDirectory(directoryPath: string): void {
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

export function ensureDaemonDirectories(paths: DaemonPaths): void {
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

export function acquireDaemonStartupLock(
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

export function cleanupStaleDaemonState(metadata: AgentWorkbenchDaemonMetadata | undefined, paths: DaemonPaths): void {
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

function normalizeLaunchState(state: DaemonState, paths: DaemonPaths): DaemonState {
  if (state.state !== "stale") {
    return state;
  }
  cleanupStaleDaemonState(state.metadata, paths);
  return { state: "absent", reason: "missing" };
}

function resolveLifecycleState(
  lifecycle: AgentWorkbenchDaemonMetadata["launchLifecycle"] | undefined
): "ready" | "starting" | "failed" {
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

export function daemonIdentityMatches(
  actual: AgentWorkbenchDaemonIdentity,
  expected: AgentWorkbenchDaemonIdentity
): boolean {
  return daemonIdentityRelationship(actual, expected) === "full_match";
}

export function daemonBaseIdentityMatches(
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

function daemonIdentityRelationship(
  actual: AgentWorkbenchDaemonIdentity,
  expected: AgentWorkbenchDaemonIdentity
): "full_match" | "build_fingerprint_mismatch" | "base_mismatch" {
  if (!daemonBaseIdentityMatches(actual, expected)) {
    return "base_mismatch";
  }
  return actual.buildFingerprint === expected.buildFingerprint
    ? "full_match"
    : "build_fingerprint_mismatch";
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
    (identity.buildFingerprint === undefined || typeof identity.buildFingerprint === "string") &&
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

function isNoSuchProcessError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "ESRCH"
  );
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

function signalReplaceableDaemon(input: {
  metadata: AgentWorkbenchDaemonMetadata;
  expectedIdentity: AgentWorkbenchDaemonIdentity;
  socketPath: string;
  signalProcess: (pid: number, signal: NodeJS.Signals) => void;
}): void {
  if (
    !daemonBaseIdentityMatches(input.metadata.identity, input.expectedIdentity) ||
    daemonIdentityMatches(input.metadata.identity, input.expectedIdentity) ||
    input.metadata.socketPath !== input.socketPath
  ) {
    throw new Error("Agent Workbench daemon is blocked: ambiguous_process.");
  }
  try {
    input.signalProcess(input.metadata.pid, "SIGTERM");
  } catch (error) {
    if (isNoSuchProcessError(error)) {
      return;
    }
    throw error instanceof Error ? error : new Error(String(error));
  }
}

export function removeCanonicalFile(filePath: string): void {
  try {
    const stat = fs.lstatSync(filePath);
    if (stat.isFile() || stat.isSocket()) fs.rmSync(filePath);
  } catch (error) {
    if (!isMissingFileError(error)) throw error;
  }
}

type DaemonStartupLockPayload = {
  pid: number;
  created_at: string;
  token: string;
};

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
