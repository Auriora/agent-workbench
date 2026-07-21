#!/usr/bin/env node
/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptRepoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Build a generated Codex marketplace for checkout-local development.
 *
 * The tracked plugin remains portable and retains `${PLUGIN_ROOT}`. The staged
 * copy is the host-specific installation artifact: its MCP config names the
 * checkout launcher and runtime root explicitly because Codex does not expand
 * `${PLUGIN_ROOT}` in a cached checkout plugin's `.mcp.json`.
 */
export function materializeCodexRepoPlugin({ repoRoot, stageRoot }) {
  const resolvedRepoRoot = path.resolve(repoRoot);
  const resolvedStageRoot = path.resolve(stageRoot);
  const sourcePluginRoot = path.join(resolvedRepoRoot, "plugins", "agent-workbench");
  const stagedPluginRoot = path.join(resolvedStageRoot, "plugins", "agent-workbench");

  assertDirectory(sourcePluginRoot, "Agent Workbench plugin source");
  assertFile(path.join(resolvedRepoRoot, "package.json"), "package manifest");
  assertSafeStageRoot(resolvedRepoRoot, sourcePluginRoot, resolvedStageRoot);

  fs.rmSync(stagedPluginRoot, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(stagedPluginRoot), { recursive: true });
  fs.cpSync(sourcePluginRoot, stagedPluginRoot, { recursive: true });

  const packageManifest = readJson(path.join(resolvedRepoRoot, "package.json"));
  const pluginManifest = readJson(path.join(sourcePluginRoot, ".codex-plugin", "plugin.json"));
  const checkoutLauncher = path.join(sourcePluginRoot, "mcp-launch.mjs");
  assertFile(checkoutLauncher, "checkout MCP launcher");

  const mcpConfig = {
    mcpServers: {
      "agent-workbench": {
        command: "node",
        args: [checkoutLauncher],
        env: {
          AGENT_WORKBENCH_INSTALL_ROOT: resolvedRepoRoot,
          AGENT_WORKBENCH_PROVIDER: "codex",
          AGENT_WORKBENCH_PROVIDER_PLUGIN_NAME: "agent-workbench",
          AGENT_WORKBENCH_PROVIDER_PLUGIN_VERSION: packageManifest.version
        },
        startup_timeout_sec: 30.0
      }
    }
  };
  fs.writeFileSync(
    path.join(stagedPluginRoot, ".mcp.json"),
    `${JSON.stringify(mcpConfig, null, 2)}\n`,
    "utf8"
  );

  const marketplace = {
    name: "agent-workbench-local",
    interface: {
      displayName: "Agent Workbench (repository checkout)"
    },
    owner: {
      name: "Auriora",
      url: "https://github.com/bcherrington"
    },
    plugins: [
      {
        name: "agent-workbench",
        source: {
          source: "local",
          path: "./plugins/agent-workbench"
        },
        policy: {
          installation: "AVAILABLE",
          authentication: "ON_INSTALL"
        },
        category: pluginManifest.interface.category
      }
    ]
  };
  const marketplaceDir = path.join(resolvedStageRoot, ".agents", "plugins");
  fs.mkdirSync(marketplaceDir, { recursive: true });
  fs.writeFileSync(
    path.join(marketplaceDir, "marketplace.json"),
    `${JSON.stringify(marketplace, null, 2)}\n`,
    "utf8"
  );

  return {
    marketplaceName: marketplace.name,
    repoRoot: resolvedRepoRoot,
    stageRoot: resolvedStageRoot,
    stagedPluginRoot,
    checkoutLauncher
  };
}

function assertSafeStageRoot(repoRoot, sourcePluginRoot, stageRoot) {
  if (stageRoot === repoRoot || stageRoot === sourcePluginRoot || stageRoot.startsWith(`${sourcePluginRoot}${path.sep}`)) {
    throw new Error("The Codex repo-local stage must not replace the checkout or tracked plugin source.");
  }
}

function assertDirectory(target, label) {
  if (!fs.existsSync(target) || !fs.statSync(target).isDirectory()) {
    throw new Error(`${label} is missing: ${target}`);
  }
}

function assertFile(target, label) {
  if (!fs.existsSync(target) || !fs.statSync(target).isFile()) {
    throw new Error(`${label} is missing: ${target}`);
  }
}

function readJson(target) {
  return JSON.parse(fs.readFileSync(target, "utf8"));
}

function parseArgs(argv) {
  let repoRoot = scriptRepoRoot;
  let stageRoot = path.join(repoRoot, ".cache", "agent-workbench", "codex-repo-local-marketplace");
  let stageRootExplicit = false;

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--repo-root") {
      repoRoot = path.resolve(requireValue(argv, ++index, argument));
      continue;
    }
    if (argument === "--stage-root") {
      stageRoot = path.resolve(requireValue(argv, ++index, argument));
      stageRootExplicit = true;
      continue;
    }
    if (argument === "--help" || argument === "-h") {
      process.stdout.write(
        "Usage: node scripts/materialize-codex-repo-plugin.mjs [--repo-root <path>] [--stage-root <path>]\n"
      );
      process.exit(0);
    }
    throw new Error(`Unknown option: ${argument}`);
  }

  if (!stageRootExplicit) {
    stageRoot = path.join(repoRoot, ".cache", "agent-workbench", "codex-repo-local-marketplace");
  }
  return { repoRoot, stageRoot };
}

function requireValue(argv, index, option) {
  const value = argv[index];
  if (!value) {
    throw new Error(`${option} requires a path`);
  }
  return value;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = materializeCodexRepoPlugin(parseArgs(process.argv.slice(2)));
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } catch (error) {
    process.stderr.write(`materialize-codex-repo-plugin: ${error.message}\n`);
    process.exitCode = 1;
  }
}
