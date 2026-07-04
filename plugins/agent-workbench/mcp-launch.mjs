#!/usr/bin/env node
/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// Portable MCP launch shim (spec 033). Referenced from plugin MCP config as
// a direct `node <plugin-root>/mcp-launch.mjs` exec-form launch
// so the server starts without a `bash -lc` wrapper or POSIX ${VAR:-default}.
// A direct `node <script>` invocation is the only command shape that resolves
// reliably on every OS: bare bin names and `.cmd`/`.ps1`/`npx` shims are not
// spawnable in MCP exec form on Windows (no PATHEXT, no shell), but `node` is.
//
// Source of truth. Vendored byte-identical into claude-plugin/ (with its
// install-root.mjs) by `npm run sync:claude-hooks`, because Claude installs only
// the plugin-root subtree and an import escaping it via ../.. breaks at runtime.
//
// Resolution: the runtime root is the directory where `npm install` placed the
// package (it is NOT copied anywhere). `resolveRuntimeRoot` finds it from the
// `AGENT_WORKBENCH_INSTALL_ROOT` override or the pointer file written by the
// package's postinstall. The server is launched through
// `src/mcp/stdio-entrypoint.mjs`, which registers tsx relative to its own file —
// so no cwd juggling is needed to resolve the bare `tsx` specifier.
//
//   - default AGENT_WORKBENCH_DEFAULT_REPO_ROOT to the launch cwd when unset
//     (that cwd is the repo the MCP client launched from);
//   - pass through any extra argv.
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveRuntimeRoot } from "./install-root.mjs";

/**
 * Build the spawn plan for the MCP server from the current environment.
 *
 * @param {NodeJS.ProcessEnv} [env=process.env]
 * @param {string[]} [argv=process.argv.slice(2)] Extra args to pass through.
 * @param {string} [cwd=process.cwd()] Launch directory (the client's repo root).
 * @returns {{ command: string, args: string[], options: object, root: string }}
 */
export function planLaunch(env = process.env, argv = process.argv.slice(2), cwd = process.cwd()) {
  const root = resolveRuntimeRoot(env);
  if (!root) {
    throw new Error(
      "agent-workbench runtime not found. Install it from the GitHub release tarball " +
        "(npm install -g <url from https://github.com/Auriora/agent-workbench/releases>), " +
        "or set AGENT_WORKBENCH_INSTALL_ROOT to a checkout that contains src/mcp/stdio-entrypoint.mjs."
    );
  }
  const entry = path.join(root, "src", "mcp", "stdio-entrypoint.mjs");

  const childEnv = { ...env };
  if (!childEnv.AGENT_WORKBENCH_DEFAULT_REPO_ROOT) {
    childEnv.AGENT_WORKBENCH_DEFAULT_REPO_ROOT = cwd;
  }

  return {
    command: process.execPath,
    args: [entry, ...argv],
    options: { stdio: ["pipe", "pipe", "pipe"], env: childEnv },
    root
  };
}

function main() {
  let plan;
  try {
    plan = planLaunch();
  } catch (err) {
    process.stderr.write(`agent-workbench: ${err.message}\n`);
    process.exit(1);
    return;
  }

  if (typeof process.execve === "function") {
    process.execve(plan.command, [plan.command, ...plan.args], plan.options.env);
  }

  const child = spawn(plan.command, plan.args, plan.options);

  process.stdin.pipe(child.stdin);
  child.stdout.pipe(process.stdout);
  child.stderr.pipe(process.stderr);

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
