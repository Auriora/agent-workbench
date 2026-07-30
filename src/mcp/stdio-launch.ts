/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

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
  let socketErrorReported = false;
  const completedPromise = new Promise<void>((resolve) => {
    completedResolve = resolve;
  });

  const removeBridgeListeners = (): void => {
    io.stdin.removeListener("end", handleStdinTerminal);
    io.stdin.removeListener("close", handleStdinTerminal);
    io.stdin.removeListener("error", handleStdinError);
    socket.removeListener("close", handleSocketClose);
    socket.removeListener("error", handleSocketError);
  };

  const teardown = (owner: "stdin" | "socket-close" | "socket-error" | "manual"): void => {
    if (completed) return;
    completed = true;
    removeBridgeListeners();
    io.stdin.unpipe(socket);
    socket.unpipe(io.stdout);
    if (owner === "socket-close") {
      io.stdin.pause();
    } else {
      if (owner === "socket-error" || owner === "manual") {
        io.stdin.pause();
      }
      if (!socket.destroyed) socket.destroy();
    }
    completedResolve();
  };

  const handleSocketError = (error: Error): void => {
    if (!socketErrorReported) {
      socketErrorReported = true;
      io.stderr.write(`agent-workbench: daemon socket error: ${error.message}\n`);
    }
    teardown("socket-error");
  };

  const handleStdinTerminal = (): void => {
    teardown("stdin");
  };

  const handleStdinError = (error: Error): void => {
    io.stderr.write(`agent-workbench: stdin error: ${error.message}\n`);
    teardown("stdin");
  };

  const handleSocketClose = (): void => {
    teardown("socket-close");
  };

  io.stdin.once("end", handleStdinTerminal);
  io.stdin.once("close", handleStdinTerminal);
  io.stdin.once("error", handleStdinError);
  socket.once("error", handleSocketError);
  socket.once("close", handleSocketClose);

  if (socket.destroyed) {
    handleSocketClose();
  } else if (io.stdin.destroyed || io.stdin.readableEnded) {
    handleStdinTerminal();
  } else {
    io.stdin.pipe(socket);
    socket.pipe(io.stdout, { end: false });
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
