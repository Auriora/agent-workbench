#!/usr/bin/env node
// Portable MCP launch shim (spec 033). Referenced from .mcp.json as
//   "command": "node", "args": ["${CLAUDE_PLUGIN_ROOT}/mcp-launch.mjs"]
// so the server starts without a `bash -lc` wrapper or POSIX ${VAR:-default}.
//
// Source of truth. Vendored byte-identical into claude-plugin/ (with its
// install-root.mjs) by `npm run sync:claude-hooks`, because Claude installs only
// the plugin-root subtree and an import escaping it via ../.. breaks at runtime.
//
// Preserves the behavior of the retired bin/agent-workbench-mcp bash launcher:
//   - default AGENT_WORKBENCH_DEFAULT_REPO_ROOT to the launch cwd when unset
//     (that cwd is the repo the MCP client launched from);
//   - run the child with cwd = install root so `--import tsx` can resolve the
//     bare `tsx` specifier from the install root's node_modules;
//   - pass through any extra argv.
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveInstallRoot } from "./install-root.mjs";

/**
 * Build the spawn plan for the MCP server from the current environment.
 *
 * @param {NodeJS.ProcessEnv} [env=process.env]
 * @param {string[]} [argv=process.argv.slice(2)] Extra args to pass through.
 * @param {string} [cwd=process.cwd()] Launch directory (the client's repo root).
 * @returns {{ command: string, args: string[], options: object, root: string }}
 */
export function planLaunch(env = process.env, argv = process.argv.slice(2), cwd = process.cwd()) {
  const root = resolveInstallRoot(env);
  const entry = path.join(root, "src", "mcp", "stdio.ts");

  const childEnv = { ...env };
  if (!childEnv.AGENT_WORKBENCH_DEFAULT_REPO_ROOT) {
    childEnv.AGENT_WORKBENCH_DEFAULT_REPO_ROOT = cwd;
  }

  return {
    command: process.execPath,
    args: ["--import", "tsx", entry, ...argv],
    options: { stdio: "inherit", cwd: root, env: childEnv },
    root
  };
}

function main() {
  const { command, args, options } = planLaunch();
  const child = spawn(command, args, options);

  // Forward termination signals so the server dies with this shim (the bash
  // launcher used exec, so there was only one process to signal).
  const forwarded = ["SIGINT", "SIGTERM", "SIGHUP"];
  for (const signal of forwarded) {
    process.on(signal, () => child.kill(signal));
  }

  child.on("error", (err) => {
    process.stderr.write(`agent-workbench: failed to launch MCP server: ${err.message}\n`);
    process.exit(1);
  });
  child.on("exit", (code, signal) => {
    process.exit(code ?? (signal ? 1 : 0));
  });
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  main();
}
