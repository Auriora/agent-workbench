/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * Resolve the Agent Workbench state directory for a given environment.
 *
 * This is the single source of truth for the per-OS app/state location, shared
 * by the postinstall pointer writer and the MCP launch shim so both sides agree
 * on where the runtime pointer lives for the same inputs (spec 033, P3).
 *
 * Resolution order:
 *   1. `AGENT_WORKBENCH_INSTALL_ROOT` when set (honored on all platforms).
 *   2. Per-OS default:
 *      - `win32`:  `%LOCALAPPDATA%\agent-workbench`
 *                  (fallback `<home>\AppData\Local\agent-workbench`)
 *      - POSIX:    `<home>/.local/share/agent-workbench`
 *
 * The function is pure given `env`/`platform`: the home directory is taken from
 * the environment (`USERPROFILE` on Windows, `HOME` on POSIX) so callers and
 * tests can resolve any platform's root by injecting `env`/`platform` without
 * touching the real host. It falls back to `os.homedir()` only when the
 * relevant home variable is absent.
 *
 * @param {NodeJS.ProcessEnv} [env=process.env] Environment to resolve from.
 * @param {NodeJS.Platform} [platform=process.platform] Target platform.
 * @returns {string} Absolute install root path.
 */
export function resolveInstallRoot(env = process.env, platform = process.platform) {
  const override = env.AGENT_WORKBENCH_INSTALL_ROOT;
  if (override) {
    return override;
  }
  return defaultStateDir(env, platform);
}

/**
 * Per-OS state directory, ignoring any `AGENT_WORKBENCH_INSTALL_ROOT` override.
 * The runtime pointer file always lives under this default location so the
 * shim can find it even when no override is set.
 *
 * @param {NodeJS.ProcessEnv} [env=process.env]
 * @param {NodeJS.Platform} [platform=process.platform]
 * @returns {string}
 */
export function defaultStateDir(env = process.env, platform = process.platform) {
  if (platform === "win32") {
    const home = env.USERPROFILE || os.homedir();
    const base = env.LOCALAPPDATA || path.win32.join(home, "AppData", "Local");
    return path.win32.join(base, "agent-workbench");
  }

  const home = env.HOME || os.homedir();
  return path.posix.join(home, ".local", "share", "agent-workbench");
}

/**
 * Path to the runtime-root pointer file. The pointer is a tiny text file whose
 * contents are the absolute path of the npm-installed package (where `src/`
 * lives). The package's `postinstall` writes it; the MCP launch shim reads it.
 *
 * It deliberately lives under {@link defaultStateDir} (not the override) so the
 * write and read sides agree regardless of `AGENT_WORKBENCH_INSTALL_ROOT`.
 *
 * @param {NodeJS.ProcessEnv} [env=process.env]
 * @param {NodeJS.Platform} [platform=process.platform]
 * @returns {string}
 */
export function runtimePointerPath(env = process.env, platform = process.platform) {
  return path.join(defaultStateDir(env, platform), "runtime-root");
}

/**
 * Record the absolute runtime root (the npm-installed package directory) so the
 * MCP launch shim can find it later. Creates the state directory if needed.
 *
 * @param {string} root Absolute path of the installed package (contains `src/`).
 * @param {NodeJS.ProcessEnv} [env=process.env]
 * @param {NodeJS.Platform} [platform=process.platform]
 * @returns {string} The pointer file path written.
 */
export function writeRuntimeRoot(root, env = process.env, platform = process.platform) {
  const pointer = runtimePointerPath(env, platform);
  fs.mkdirSync(path.dirname(pointer), { recursive: true });
  fs.writeFileSync(pointer, `${root}\n`, "utf8");
  return pointer;
}

/**
 * Resolve the runtime root the MCP server should be launched from.
 *
 * Resolution order:
 *   1. `AGENT_WORKBENCH_INSTALL_ROOT` when set (explicit escape hatch — e.g. a
 *      git checkout you want the plugin to launch instead of the npm install).
 *   2. The pointer file written by the package's `postinstall`.
 *   3. `null` when neither is available (the shim turns this into an actionable
 *      "install the package" error rather than a confusing spawn failure).
 *
 * @param {NodeJS.ProcessEnv} [env=process.env]
 * @param {NodeJS.Platform} [platform=process.platform]
 * @returns {string | null}
 */
export function resolveRuntimeRoot(env = process.env, platform = process.platform) {
  const override = env.AGENT_WORKBENCH_INSTALL_ROOT;
  if (override) {
    return override;
  }
  try {
    const recorded = fs.readFileSync(runtimePointerPath(env, platform), "utf8").trim();
    return recorded || null;
  } catch {
    return null;
  }
}

/**
 * Materialize the Codex plugin MCP config for an installed npm package.
 *
 * Source checkouts keep `${PLUGIN_ROOT}/mcp-launch.mjs` as a development-time
 * placeholder, but current package-backed Codex MCP launches do not expand that
 * token. The installed package therefore rewrites its own plugin config to an
 * absolute shim path during postinstall, while deliberately leaving `cwd`
 * unset so Codex's session cwd remains the default repo root.
 *
 * @param {string} packageRoot Absolute package root containing plugins/.
 * @returns {string} Path to the rewritten MCP config.
 */
export function materializeCodexMcpConfig(packageRoot) {
  const pluginRoot = path.join(packageRoot, "plugins", "agent-workbench");
  const configPath = path.join(pluginRoot, ".mcp.json");
  const launchPath = path.join(pluginRoot, "mcp-launch.mjs");
  const config = {
    mcpServers: {
      "agent-workbench": {
        command: "node",
        args: [launchPath],
        startup_timeout_sec: 30.0
      }
    }
  };

  fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);
  return configPath;
}
