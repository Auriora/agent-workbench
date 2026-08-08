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
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const NATIVE_PACKAGES = [
  "tree-sitter",
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
    env._CL_ = `${env._CL_ ? `${env._CL_} ` : ""}/std:c++20`;
    return env;
  }

  env.CXXFLAGS = `${env.CXXFLAGS ? `${env.CXXFLAGS} ` : ""}-std=c++20`;
  return env;
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
