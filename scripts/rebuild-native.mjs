#!/usr/bin/env node
/*
 * Copyright (C) 2026 Auriora
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// Cross-platform native rebuild (spec 033). Core tree-sitter 0.25 compiles from
// source and needs C++20, which the default build does not enable. This wrapper
// injects the right C++20 flag per toolchain — `CXXFLAGS=-std=c++20` for
// GCC/Clang on Linux/macOS, and the `CL=/std:c++20` env var that MSVC's cl.exe
// reads on Windows — then runs `pnpm rebuild` for the native packages. It is
// shell-free (no inline `VAR=value` prefix) so it works in cmd/PowerShell too.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const NATIVE_PACKAGES = [
  "tree-sitter",
  "tree-sitter-python",
  "tree-sitter-javascript",
  "tree-sitter-typescript",
  "tree-sitter-go"
];

// Resolve a command across PATH and (on Windows) PATHEXT so pnpm.cmd is found
// without a shell — CreateProcess does not consult PATHEXT for bare names.
function resolveOnPath(command, env = process.env) {
  const exts = process.platform === "win32"
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

const env = { ...process.env };
if (process.platform === "win32") {
  env.CL = `${env.CL ? `${env.CL} ` : ""}/std:c++20`;
} else {
  env.CXXFLAGS = `${env.CXXFLAGS ? `${env.CXXFLAGS} ` : ""}-std=c++20`;
}

const pnpm = resolveOnPath("pnpm");
if (!pnpm) {
  process.stderr.write(
    "rebuild-native: pnpm not found on PATH. Enable it with `corepack enable pnpm` or install pnpm@10.18.1.\n"
  );
  process.exit(1);
}

const result = spawnSync(pnpm, ["rebuild", ...NATIVE_PACKAGES], { stdio: "inherit", env });
if (result.error) {
  process.stderr.write(`rebuild-native: failed to run pnpm: ${result.error.message}\n`);
  process.exit(1);
}
process.exit(result.status ?? 1);
