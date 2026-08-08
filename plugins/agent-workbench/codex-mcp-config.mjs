/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import fs from "node:fs";
import path from "node:path";

/**
 * Materialize the installed Codex MCP config without changing launch cwd.
 *
 * @param {string} packageRoot
 * @param {{ nodeCommand?: string }} [options]
 * @returns {string}
 */
export function materializeCodexMcpConfig(packageRoot, options = {}) {
  const pluginRoot = path.join(packageRoot, "plugins", "agent-workbench");
  const configPath = path.join(pluginRoot, ".mcp.json");
  const nodeCommand = typeof options.nodeCommand === "string" && options.nodeCommand.trim() !== ""
    ? options.nodeCommand
    : "node";
  const config = {
    mcpServers: {
      "agent-workbench": {
        command: nodeCommand,
        args: [path.join(pluginRoot, "mcp-launch.mjs")],
        env: {
          AGENT_WORKBENCH_PROVIDER: "codex",
          AGENT_WORKBENCH_PROVIDER_PLUGIN_NAME: "agent-workbench",
          AGENT_WORKBENCH_PROVIDER_PLUGIN_VERSION: packageVersion(packageRoot)
        },
        startup_timeout_sec: 30.0
      }
    }
  };

  fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);
  return configPath;
}

/** @param {string} packageRoot */
function packageVersion(packageRoot) {
  const manifest = JSON.parse(fs.readFileSync(path.join(packageRoot, "package.json"), "utf8"));
  if (typeof manifest.version !== "string" || manifest.version.trim() === "") {
    throw new Error("Agent Workbench package version is missing from package.json.");
  }
  return manifest.version;
}
