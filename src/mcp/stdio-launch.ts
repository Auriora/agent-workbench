/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import path from "node:path";
import type { Readable, Writable } from "node:stream";
import type { IntegrationLauncherIdentity } from "../contracts/index.js";
import {
  DEBUG_REPO_ROOT_OVERRIDE_ENV,
} from "../interface-adapters/mcp/registries/root-authority.js";
import { connectOrStartDaemon } from "./daemon.js";

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
    debugRepoRootOverride: env[DEBUG_REPO_ROOT_OVERRIDE_ENV] === "1",
    integrationIdentity: resolveLauncherIdentity(env)
  };
}

export async function connectAgentWorkbenchStdio(
  config: StdioLaunchConfig = resolveStdioLaunchConfig(),
  io: {
    stdin?: Readable;
    stdout?: Writable;
    stderr?: Writable;
  } = {}
): Promise<void> {
  const socket = await connectOrStartDaemon({
    repoRoot: config.repoRoot,
    debugRepoRootOverride: config.debugRepoRootOverride,
    integrationIdentity: config.integrationIdentity
  });
  const stdin = io.stdin ?? process.stdin;
  const stdout = io.stdout ?? process.stdout;
  const stderr = io.stderr ?? process.stderr;
  socket.on("error", (error) => {
    stderr.write(`agent-workbench: daemon socket error: ${error.message}\n`);
  });
  stdin.pipe(socket);
  socket.pipe(stdout);
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
