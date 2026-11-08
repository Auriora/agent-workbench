/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { validateTreeSitterSourceBuild } from "../infrastructure/runtime/native-runtime-guard.mjs";
import path from "node:path";
import type { Socket } from "node:net";
import type { Readable, Writable } from "node:stream";
import type { IntegrationLauncherIdentity } from "../contracts/index.js";
import { AGENT_WORKBENCH_DEBUG_REPO_ROOT_OVERRIDE_ENV } from "../contracts/launch-authority-contracts.js";
import { connectOrStartDaemon } from "./daemon-client.js";

export type StdioLaunchConfig = {
  repoRoot: string;
  debugRepoRootOverride: boolean;
  integrationIdentity?: IntegrationLauncherIdentity;
};

const PROVIDER_ENV = "AGENT_WORKBENCH_PROVIDER";
const PROVIDER_PLUGIN_NAME_ENV = "AGENT_WORKBENCH_PROVIDER_PLUGIN_NAME";
const PROVIDER_PLUGIN_VERSION_ENV = "AGENT_WORKBENCH_PROVIDER_PLUGIN_VERSION";
const CLIENT_CACHE_NAME_ENV = "AGENT_WORKBENCH_CLIENT_CACHE_NAME";
const CLIENT_CACHE_VERSION_ENV = "AGENT_WORKBENCH_CLIENT_CACHE_VERSION";
const MAX_IDENTITY_NAME_LENGTH = 200;
const MAX_IDENTITY_VERSION_LENGTH = 100;

export function resolveStdioLaunchConfig(input: {
  argv?: string[];
  cwd?: string;
  env?: NodeJS.ProcessEnv;
} = {}): StdioLaunchConfig {
  const argv = input.argv ?? process.argv.slice(2);
  const cwd = input.cwd ?? process.cwd();
  const env = input.env ?? process.env;
  const repoRootArg = findRepoRootArg(argv);
  const repoRoot = repoRootArg ?? env.AGENT_WORKBENCH_DEFAULT_REPO_ROOT ?? cwd;

  return {
    repoRoot: path.resolve(cwd, repoRoot),
    debugRepoRootOverride: env[AGENT_WORKBENCH_DEBUG_REPO_ROOT_OVERRIDE_ENV] === "1",
    integrationIdentity: resolveLauncherIdentity(env)
  };
}

export type StdioBridgeSession = {
  socket: Socket;
  completed: Promise<void>;
  close: () => void;
};

type StdioBridgeIo = {
  stdin: Readable;
  stdout: Writable;
  stderr: Writable;
};

export async function connectAgentWorkbenchStdio(
  config: StdioLaunchConfig = resolveStdioLaunchConfig(),
  io: {
    stdin?: Readable;
    stdout?: Writable;
    stderr?: Writable;
  } = {}
): Promise<StdioBridgeSession> {
  validateTreeSitterSourceBuild();
  const socket = await connectOrStartDaemon({
    repoRoot: config.repoRoot,
    debugRepoRootOverride: config.debugRepoRootOverride,
    integrationIdentity: config.integrationIdentity
  });
  const stdin = io.stdin ?? process.stdin;
  const stdout = io.stdout ?? process.stdout;
  const stderr = io.stderr ?? process.stderr;
  return createStdioBridgeSession(socket, { stdin, stdout, stderr });
}

export function createStdioBridgeSession(
  socket: Socket,
  io: StdioBridgeIo
): StdioBridgeSession {
  let completedResolve!: () => void;
  let completed = false;
  let cleanupComplete = false;
  let socketErrorReported = false;
  let stdoutErrorReported = false;
  let socketClosed = false;
  let cleanupRequested = false;
  const outputWriteSettlers = new Set<() => void>();
  const stderrWriteSettlers = new Set<() => void>();
  const completedPromise = new Promise<void>((resolve) => {
    completedResolve = resolve;
  });

  const writeStderr = (message: string): void => {
    try {
      if (!io.stderr.destroyed && !io.stderr.writableEnded) {
        const settle = (): void => settleStderrWrite(settle);
        stderrWriteSettlers.add(settle);
        io.stderr.write(message, settle);
      }
    } catch {
      // Failure reporting must not prevent transport teardown.
      for (const settle of [...stderrWriteSettlers]) settle();
    }
  };

  const handleStderrError = (): void => {
    // Keep a session-owned listener installed while terminal diagnostics are
    // being written so a failed stderr cannot become an unhandled error.
    for (const settle of [...stderrWriteSettlers]) settle();
  };

  const removeBridgeListeners = (
    removeStdoutListeners = true,
    removeStderrListener = true
  ): void => {
    io.stdin.removeListener("end", handleStdinTerminal);
    io.stdin.removeListener("close", handleStdinTerminal);
    io.stdin.removeListener("error", handleStdinError);
    if (removeStdoutListeners) {
      io.stdout.removeListener("close", handleStdoutClose);
      io.stdout.removeListener("error", handleStdoutError);
      io.stdout.removeListener("drain", handleStdoutDrain);
    }
    if (removeStderrListener) io.stderr.removeListener("error", handleStderrError);
    if (removeStderrListener) io.stderr.removeListener("close", handleStderrClose);
    socket.removeListener("close", handleSocketClose);
    socket.removeListener("error", handleSocketError);
    socket.removeListener("data", handleSocketData);
  };

  const finishCleanup = (): void => {
    if (cleanupComplete) return;
    cleanupComplete = true;
    const stderrSettled = stderrWriteSettlers.size === 0;
    removeBridgeListeners(outputWriteSettlers.size === 0, stderrSettled);
    if (outputWriteSettlers.size > 0) {
      io.stdout.removeListener("drain", handleStdoutDrain);
    }
    if (!stderrSettled) {
      setImmediate(() => {
        if (stderrWriteSettlers.size === 0) {
          io.stderr.removeListener("error", handleStderrError);
          io.stderr.removeListener("close", handleStderrClose);
        }
      });
    }
    completedResolve();
  };

  const tryFinishCleanup = (): void => {
    if (
      cleanupRequested &&
      socketClosed
    ) {
      finishCleanup();
    }
  };

  const settleStderrWrite = (settler: () => void): void => {
    setImmediate(() => {
      if (!stderrWriteSettlers.delete(settler)) return;
      if (cleanupComplete && stderrWriteSettlers.size === 0) {
        io.stderr.removeListener("error", handleStderrError);
        io.stderr.removeListener("close", handleStderrClose);
      }
      tryFinishCleanup();
    });
  };

  const settleOutputWrite = (settler: () => void): void => {
    setImmediate(() => {
      if (!outputWriteSettlers.delete(settler)) return;
      if (cleanupComplete && outputWriteSettlers.size === 0) {
        io.stdout.removeListener("close", handleStdoutClose);
        io.stdout.removeListener("error", handleStdoutError);
        io.stdout.removeListener("drain", handleStdoutDrain);
      }
      tryFinishCleanup();
    });
  };

  const handleSocketData = (chunk: Buffer): void => {
    if (completed) return;
    let settled = false;
    const settle = (): void => {
      if (settled) return;
      settled = true;
      settleOutputWrite(settle);
    };
    outputWriteSettlers.add(settle);
    try {
      if (!io.stdout.write(chunk, settle)) socket.pause();
    } catch {
      settle();
      handleStdoutError();
    }
  };

  const handleStdoutDrain = (): void => {
    if (!completed && !socket.destroyed) socket.resume();
  };

  const teardown = (
    owner: "stdin" | "socket-close" | "socket-error" | "stdout-close" | "stdout-error" | "manual"
  ): void => {
    if (completed) return;
    completed = true;
    cleanupRequested = true;
    io.stdin.unpipe(socket);
    socket.unpipe(io.stdout);
    if (owner === "socket-close") {
      io.stdin.pause();
    } else {
      if (
        owner === "socket-error" ||
        owner === "stdout-close" ||
        owner === "stdout-error" ||
        owner === "manual"
      ) {
        io.stdin.pause();
      }
      if (!socket.destroyed) {
        try {
          socket.destroy();
        } catch {
          socketClosed = true;
        }
      }
    }
    tryFinishCleanup();
  };

  const handleSocketError = (error: Error): void => {
    if (!socketErrorReported && !completed) {
      socketErrorReported = true;
      writeStderr(`agent-workbench: daemon socket error: ${error.message}\n`);
    }
    teardown("socket-error");
  };

  const handleStdinTerminal = (): void => {
    teardown("stdin");
  };

  const handleStdinError = (error: Error): void => {
    if (!completed) writeStderr(`agent-workbench: stdin error: ${error.message}\n`);
    teardown("stdin");
  };

  const handleSocketClose = (): void => {
    socketClosed = true;
    if (completed) {
      tryFinishCleanup();
      return;
    }
    if (!io.stdin.destroyed && !io.stdin.readableEnded) {
      writeStderr(
        "agent-workbench: daemon socket closed unexpectedly; the MCP session is ending. " +
          "Restart the MCP connection and inspect integration:///health/agent-workbench.\n"
      );
    }
    teardown("socket-close");
  };

  const handleStdoutError = (): void => {
    for (const settle of [...outputWriteSettlers]) settle();
    if (!stdoutErrorReported && !completed) {
      stdoutErrorReported = true;
      writeStderr("agent-workbench: MCP stdout error; the MCP session is ending.\n");
    }
    teardown("stdout-error");
  };

  const handleStderrClose = (): void => {
    for (const settle of [...stderrWriteSettlers]) settle();
  };

  const handleStdoutClose = (): void => {
    for (const settle of [...outputWriteSettlers]) settle();
    if (completed) {
      tryFinishCleanup();
      return;
    }
    writeStderr("agent-workbench: MCP stdout closed unexpectedly; the MCP session is ending.\n");
    teardown("stdout-close");
  };

  io.stdin.once("end", handleStdinTerminal);
  io.stdin.once("close", handleStdinTerminal);
  io.stdin.once("error", handleStdinError);
  io.stdout.on("error", handleStdoutError);
  io.stdout.on("close", handleStdoutClose);
  io.stdout.on("drain", handleStdoutDrain);
  io.stderr.on("error", handleStderrError);
  io.stderr.on("close", handleStderrClose);
  socket.on("error", handleSocketError);
  socket.on("close", handleSocketClose);
  socket.on("data", handleSocketData);

  if (socket.destroyed) {
    handleSocketClose();
  } else if (io.stdin.destroyed || io.stdin.readableEnded) {
    handleStdinTerminal();
  } else if (io.stdout.destroyed || io.stdout.writableEnded) {
    handleStdoutClose();
  } else {
    io.stdin.pipe(socket);
  }

  return {
    socket,
    completed: completedPromise,
    close: () => teardown("manual")
  };
}

export function resolveLauncherIdentity(
  env: NodeJS.ProcessEnv
): IntegrationLauncherIdentity | undefined {
  const provider = env[PROVIDER_ENV];
  if (!isIntegrationProvider(provider)) {
    return undefined;
  }

  return {
    provider,
    plugin_name: boundedIdentityField(env[PROVIDER_PLUGIN_NAME_ENV], MAX_IDENTITY_NAME_LENGTH),
    plugin_version: boundedIdentityField(env[PROVIDER_PLUGIN_VERSION_ENV], MAX_IDENTITY_VERSION_LENGTH),
    cache_name: boundedIdentityField(env[CLIENT_CACHE_NAME_ENV], MAX_IDENTITY_NAME_LENGTH),
    cache_version: boundedIdentityField(env[CLIENT_CACHE_VERSION_ENV], MAX_IDENTITY_VERSION_LENGTH)
  };
}

function isIntegrationProvider(
  value: string | undefined
): value is IntegrationLauncherIdentity["provider"] {
  return value === "codex" || value === "claude_code" || value === "kiro" || value === "unknown";
}

function boundedIdentityField(value: string | undefined, maxLength: number): string | undefined {
  const trimmed = value?.trim();
  return trimmed !== undefined && trimmed.length > 0 && trimmed.length <= maxLength
    ? trimmed
    : undefined;
}

function findRepoRootArg(argv: string[]): string | undefined {
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--") {
      continue;
    }
    if (arg === "--repo-root") {
      return argv[index + 1];
    }
    if (arg.startsWith("--repo-root=")) {
      return arg.slice("--repo-root=".length);
    }
    if (!arg.startsWith("-")) {
      return arg;
    }
  }

  return undefined;
}
