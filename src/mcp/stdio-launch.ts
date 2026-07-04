/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import path from "node:path";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createAgentWorkbenchServer } from "../server.js";
import {
  DEBUG_REPO_ROOT_OVERRIDE_ENV,
  createRootAuthorityPolicy
} from "../interface-adapters/mcp/registries/root-authority.js";

export type StdioLaunchConfig = {
  repoRoot: string;
  debugRepoRootOverride: boolean;
};

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
    debugRepoRootOverride: env[DEBUG_REPO_ROOT_OVERRIDE_ENV] === "1"
  };
}

export async function connectAgentWorkbenchStdio(
  config: StdioLaunchConfig = resolveStdioLaunchConfig()
): Promise<void> {
  const server = createAgentWorkbenchServer(config.repoRoot, {
    rootAuthorityPolicy: createRootAuthorityPolicy({
      launchRoot: config.repoRoot,
      debugRepoRootOverride: config.debugRepoRootOverride
    })
  });
  await server.connect(new StdioServerTransport());
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
