import os from "node:os";
import path from "node:path";

/**
 * Resolve the Agent Workbench install root for a given environment.
 *
 * This is the single source of truth for the default install location, shared
 * by the installer, the generated host launcher, and the MCP launch shim so the
 * resolved root is identical on every OS for the same inputs (spec 033, P3).
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

  if (platform === "win32") {
    const home = env.USERPROFILE || os.homedir();
    const base = env.LOCALAPPDATA || path.win32.join(home, "AppData", "Local");
    return path.win32.join(base, "agent-workbench");
  }

  const home = env.HOME || os.homedir();
  return path.posix.join(home, ".local", "share", "agent-workbench");
}
