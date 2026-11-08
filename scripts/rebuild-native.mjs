#!/usr/bin/env node
/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// Cross-platform native rebuild (spec 033). Core tree-sitter 0.25 compiles from
// source and needs C++20, which the default build does not enable. This wrapper
// injects the right C++20 flag per toolchain: `CXXFLAGS=-std=c++20` for
// GCC/Clang on Linux/macOS, and `_CL_=/std:c++20` for MSVC on Windows so the
// standard override is appended after project-supplied compiler options. It is
// shell-free (no inline `VAR=value` prefix) so it works in cmd/PowerShell too.
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { Worker } from "node:worker_threads";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  TREE_SITTER_VERSION, NODE_GYP_VERSION, TERMINATION_SAFE_DEFINE,
  treeSitterRuntime, validateTreeSitterSourceBuild
} from "../src/infrastructure/runtime/native-runtime-guard.mjs";
export { TREE_SITTER_VERSION, NODE_GYP_VERSION, TERMINATION_SAFE_DEFINE, validateTreeSitterSourceBuild };

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const NATIVE_PACKAGES = [
  "tree-sitter-python",
  "tree-sitter-javascript",
  "tree-sitter-typescript",
  "tree-sitter-go",
  "tree-sitter-ruby"
];

// Resolve a command across PATH and (on Windows) PATHEXT so pnpm.cmd is found
// without a shell; CreateProcess does not consult PATHEXT for bare names.
export function resolveOnPath(command, env = process.env, platform = process.platform) {
  const exts = platform === "win32"
    ? (env.PATHEXT || ".COM;.EXE;.BAT;.CMD").split(";").map((e) => e.trim()).filter(Boolean)
    : [""];
  for (const dir of (env.PATH || "").split(path.delimiter)) {
    if (!dir) continue;
    for (const ext of exts) {
      const candidate = path.join(dir, command + ext);
      if (fs.existsSync(candidate)) return candidate;
    }
  }
  return null;
}

export function buildRebuildEnv(baseEnv = process.env, platform = process.platform) {
  const env = { ...baseEnv };
  if (platform === "win32") {
    const required = `/std:c++20 /D${TERMINATION_SAFE_DEFINE}`;
    if (!(env._CL_ ?? "").trimEnd().endsWith(required)) {
      env._CL_ = `${env._CL_ ? `${env._CL_} ` : ""}${required}`;
    }
    return env;
  }

  const required = `-std=c++20 -D${TERMINATION_SAFE_DEFINE}`;
  if (!(env.CXXFLAGS ?? "").trimEnd().endsWith(required)) {
    env.CXXFLAGS = `${env.CXXFLAGS ? `${env.CXXFLAGS} ` : ""}${required}`;
  }
  return env;
}

/** One source-build route shared by npm postinstall and the development rebuild. */
export function treeSitterSourceBuildPlan({ packageRoot = PACKAGE_ROOT, env = process.env } = {}) {
  const runtime = treeSitterRuntime(packageRoot);
  const require = createRequire(path.join(packageRoot, "package.json"));
  const builderManifest = JSON.parse(fs.readFileSync(require.resolve("node-gyp/package.json"), "utf8"));
  if (builderManifest.version !== NODE_GYP_VERSION) {
    throw new Error(`Termination-safe native build requires node-gyp ${NODE_GYP_VERSION}.`);
  }
  return {
    command: process.execPath,
    args: [require.resolve("node-gyp/bin/node-gyp.js"), "rebuild"],
    cwd: runtime.root,
    env: buildRebuildEnv(env),
    addon_header_sha256: runtime.addon_header_sha256,
    node_gyp_version: builderManifest.version
  };
}

/** Installation/portable smoke: the actual selected parser must survive a
 * worker termination and still preserve normal callback-error semantics. */
export async function proveTreeSitterTermination({ packageRoot = PACKAGE_ROOT } = {}) {
  const require = createRequire(path.join(packageRoot, "package.json"));
  const Parser = require("tree-sitter");
  const Python = require("tree-sitter-python");
  const parser = new Parser();
  parser.setLanguage(Python);
  const expected = new Error("native-install-callback-proof");
  let caught;
  try { parser.parse(() => { throw expected; }); } catch (error) { caught = error; }
  if (caught !== expected || parser.parse("def proof():\n    return 1\n").rootNode.type !== "module") {
    throw new Error("Installed tree-sitter did not preserve ordinary parse/error behavior.");
  }
  const shared = new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT);
  const state = new Int32Array(shared);
  const source = `
    const { parentPort, workerData } = require('node:worker_threads');
    const Parser = require(workerData.parser);
    const Python = require(workerData.python);
    const parser = new Parser(); parser.setLanguage(Python);
    const unit = 'def work():\\n    return target()\\n';
    const content = unit.repeat(Math.floor(1900000 / unit.length));
    const state = new Int32Array(workerData.shared);
    Atomics.store(state, 0, 1); parentPort.postMessage('entered');
    parser.parse(content);
    Atomics.store(state, 0, 2); parentPort.postMessage('returned');
  `;
  const worker = new Worker(source, { eval: true, execArgv: [], workerData: {
    parser: require.resolve("tree-sitter"), python: require.resolve("tree-sitter-python"), shared
  } });
  let timer;
  try {
    await new Promise((resolve, reject) => {
      worker.once("error", reject);
      worker.once("exit", () => reject(new Error("Installed parser worker exited before its parse boundary.")));
      worker.once("message", (message) => message === "entered" ? resolve() : reject(new Error("Unexpected installed parser marker.")));
      timer = setTimeout(() => reject(new Error("Installed parser did not enter its parse boundary.")), 60_000);
    });
    const exitCode = await worker.terminate();
    if (exitCode !== 1 || Atomics.load(state, 0) !== 1) {
      throw new Error("Installed parser termination returned a successful/finished parse instead of stopping the worker.");
    }
    return { worker_exit_code: exitCode, parser_returned: false, ordinary_callback_error_preserved: true };
  } finally {
    clearTimeout(timer);
    await worker.terminate();
  }
}

export function runTreeSitterSourceBuild({
  packageRoot = PACKAGE_ROOT,
  env = buildRebuildEnv(),
  spawn = spawnSync
} = {}) {
  try {
    const plan = treeSitterSourceBuildPlan({ packageRoot, env });
    const result = spawn(plan.command, plan.args, { cwd: plan.cwd, stdio: "inherit", env: plan.env });
    if (result.error) throw result.error;
    if (result.status !== 0) return result.status ?? 1;
    const binaryPath = path.join(plan.cwd, "build", "Release", "tree_sitter_runtime_binding.node");
    const binary = fs.readFileSync(binaryPath);
    // Generated installation evidence belongs beside the compiled binding,
    // never in the source package or repository's tracked artifacts.
    fs.writeFileSync(path.join(plan.cwd, "build", "Release", "agent-workbench-native.json"), JSON.stringify({
      schema_version: 1,
      tree_sitter_version: TREE_SITTER_VERSION,
      node_gyp_version: plan.node_gyp_version,
      node_version: process.version,
      platform: process.platform,
      arch: process.arch,
      define: TERMINATION_SAFE_DEFINE,
      node_addon_api_header_sha256: plan.addon_header_sha256,
      binding_sha256: createHash("sha256").update(binary).digest("hex")
    }, null, 2) + "\n");
    return 0;
  } catch (error) {
    process.stderr.write(`rebuild-native: tree-sitter source build failed: ${error.message}\n`);
    return 1;
  }
}

export function runRebuildNative({
  env = buildRebuildEnv(),
  platform = process.platform
} = {}) {
  const pnpm = resolveOnPath("pnpm", env, platform);
  if (!pnpm) {
    process.stderr.write(
      "rebuild-native: pnpm not found on PATH. Enable it with `corepack enable pnpm` or install pnpm@10.18.1.\n"
    );
    return 1;
  }

  const coreStatus = runTreeSitterSourceBuild({ env });
  if (coreStatus !== 0) return coreStatus;

  const result = spawnSync(pnpm, ["rebuild", ...NATIVE_PACKAGES], { stdio: "inherit", env });
  if (result.error) {
    process.stderr.write(`rebuild-native: failed to run pnpm: ${result.error.message}\n`);
    return 1;
  }
  return result.status ?? 1;
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(runRebuildNative());
}
